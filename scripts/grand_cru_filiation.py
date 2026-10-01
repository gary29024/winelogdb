"""Official DGFiP DFI event groups and recursive, qualified parcel ancestry (#461).

The January 2025 schema describes consecutive mother/daughter rows, not individual
geographic edges. A many-to-many lot stays one event. Dates are validation dates;
none of these paths transfers a holder, a sale party, or an operator.
"""
from collections import defaultdict
from datetime import date
import re

CHANGE_TYPES = {
    '1': "document d'arpentage", '2': 'croquis de conservation', '4': 'remaniement',
    '5': "document d'arpentage numérique", '6': 'lotissement numérique',
    '7': 'lotissement', '8': 'rénovation',
}
FIELD_WIDTHS = (3, 3, 3, 7, 1, 8, 30, 5, 5, 1)
IDENTITY_PATTERN = re.compile(r'[0-9A-Z]{5}[0-9]{3}[0-9A-Z]{2}[0-9]{4}\Z')
PRINTED_PATTERN = re.compile(r'[ 0-9A-Z][0-9A-Z][0-9]{4}\Z')


def full_parcel_id(department, commune, prefix, printed):
    """Use an explicitly configured INSEE department, never guess from a DFI code.

    Côte-d'Or is 210 in the member, 21 in INSEE; Yonne is 890 / 89. The schema's
    sample uses 023, so dropping either the first or last digit unconditionally
    would corrupt some identities. The source configuration records both codes.
    """
    if (not re.fullmatch(r'[0-9A-Z]{2}', department)
            or not re.fullmatch(r'\d{3}', commune) or not re.fullmatch(r'\d{3}', prefix)
            or not PRINTED_PATTERN.fullmatch(printed)):
        raise ValueError(f'Malformed DFI identity: {department}/{commune}/{prefix}/{printed!r}')
    return department + commune + prefix + printed[:2].replace(' ', '0') + printed[2:]


def parse_dfi(data, *, department_code, insee_department, allowed_communes=None, as_of=None):
    """Parse a complete department member, preserving problems and their raw rows.

    Filtering communes happens only after row identities are inspected. Incomplete
    or conflicting pairs stay in the event catalogue but cannot support traversal.
    Duplicate identical rows are reported and coalesced; conflicting rows stop it.
    """
    groups, issues = {}, []
    allowed = set(allowed_communes) if allowed_communes is not None else None
    for line_number, raw_bytes in enumerate(data.splitlines(), 1):
        raw = raw_bytes.decode('ascii', errors='replace')
        non_ascii = any(value > 127 for value in raw_bytes)
        if not raw:
            continue
        fields = raw.split(';')
        if len(fields) < 10:
            issues.append({'kind': 'malformed-row', 'line': line_number, 'raw': raw})
            continue
        dept, commune, prefix, document, nature, validation, _, _, lot, row_type = fields[:10]
        identity_ok = (dept == department_code and re.fullmatch(r'\d{3}', commune)
                       and re.fullmatch(r'\d{3}', prefix) and re.fullmatch(r'\d{7}', document)
                       and re.fullmatch(r'\d{5}', lot))
        if not identity_ok:
            issues.append({'kind': 'malformed-event-identity', 'line': line_number, 'raw': raw})
            continue
        if allowed is not None and insee_department + commune not in allowed:
            continue
        key = ':'.join((dept, commune, prefix, document, lot))
        group = groups.setdefault(key, {
            'id': key, 'departmentCode': dept, 'department': insee_department,
            'commune': insee_department + commune, 'sectionPrefix': prefix,
            'documentId': document, 'analysisLot': lot, 'changeType': nature,
            'changeLabel': CHANGE_TYPES.get(nature, 'unsupported'), 'validationDate': None,
            'dateRole': 'dfi-validation', 'method': 'documented-dfi',
            'motherIds': [], 'daughterIds': [], 'printedMothers': [], 'printedDaughters': [],
            'sourceLines': [], 'issues': [], 'traceable': True,
        })
        group['sourceLines'].append(line_number)

        def problem(kind, **details):
            value = {'kind': kind, 'eventId': key, 'line': line_number, **details}
            group['issues'].append(value)
            issues.append(value)
            if kind != 'duplicate-identical-row':
                group['traceable'] = False

        if non_ascii:
            problem('non-ascii-dfi-row', rawBytesHex=raw_bytes.hex())

        if tuple(map(len, fields[:10])) != FIELD_WIDTHS:
            problem('malformed-field-width', raw=raw)
        try:
            parsed_date = date(int(validation[:4]), int(validation[4:6]), int(validation[6:8])).isoformat()
            if as_of is not None and parsed_date > as_of:
                problem('validation-after-source-snapshot', validationDate=parsed_date, sourceAsOf=as_of)
        except ValueError:
            parsed_date = None
            problem('invalid-validation-date', rawDate=validation)
        if '_metadata' in group and group['_metadata'] != (nature, validation):
            problem('conflicting-event-metadata', raw=raw)
        group['_metadata'] = (nature, validation)
        group['validationDate'] = parsed_date
        if nature not in CHANGE_TYPES:
            problem('unsupported-change-type', changeType=nature)
        if row_type not in {'1', '2'}:
            problem('unsupported-row-type', rowType=row_type, raw=raw)
            continue
        # The final semicolon is a separator, not a blank parcel. Interior blank
        # cells and >175 references are schema violations rather than lost data.
        printed = fields[10:]
        if printed and printed[-1] == '':
            printed = printed[:-1]
        if len(printed) > 175:
            problem('too-many-parcel-cells', count=len(printed))
        ids = []
        for value in printed:
            try:
                ids.append(full_parcel_id(insee_department, commune, prefix, value))
            except ValueError:
                problem('malformed-parcel-identity', printedReference=value)
        if len(ids) != len(set(ids)):
            problem('duplicate-parcel-reference', rowType=row_type)
        rows = group.setdefault('_rows', {})
        if row_type in rows:
            if rows[row_type]['raw'] == raw:
                problem('duplicate-identical-row', rowType=row_type)
            else:
                problem('conflicting-row-pair', rowType=row_type, raw=raw)
            # Preserve every reference of conflicting variants for review.
        rows.setdefault(row_type, {'raw': raw, 'line': line_number})
        side = 'mother' if row_type == '1' else 'daughter'
        group[side + 'Ids'] = sorted(set(group[side + 'Ids']) | set(ids))
        group['printed' + ('Mothers' if row_type == '1' else 'Daughters')] += [
            value for value in printed if value not in group['printed' + ('Mothers' if row_type == '1' else 'Daughters')]]

    events = []
    for key, group in sorted(groups.items()):
        rows = group.pop('_rows', {})
        group.pop('_metadata', None)
        if set(rows) != {'1', '2'}:
            problem = {'kind': 'missing-row-pair', 'eventId': key, 'sourceLines': group['sourceLines']}
        elif rows['2']['line'] != rows['1']['line'] + 1:
            problem = {'kind': 'nonconsecutive-row-pair', 'eventId': key, 'sourceLines': group['sourceLines']}
        else:
            problem = None
        if problem:
            group['issues'].append(problem)
            issues.append(problem)
            group['traceable'] = False
        if not group['motherIds'] and not group['daughterIds']:
            problem = {'kind': 'empty-event', 'eventId': key}
            group['issues'].append(problem)
            issues.append(problem)
            group['traceable'] = False
        group['scope'] = ('non-cadastral-domain-origin' if not group['motherIds'] else
                          'passage-to-public-domain' if not group['daughterIds'] else
                          'many-to-many-event-group' if len(group['motherIds']) > 1 and len(group['daughterIds']) > 1 else
                          'merge-event-group' if len(group['motherIds']) > 1 else
                          'split-event-group' if len(group['daughterIds']) > 1 else 'one-to-one-event-group')
        events.append(group)
    return {'events': events, 'issues': issues, 'rowsRead': line_number if data else 0}


def trace_ancestry(current_ids, events, *, geometry_as_of, first_seen=None, earliest_geometry=None):
    """Trace every generation as paths through complete event groups.

    This walks all mothers, including references outside today's mapped cru. An
    ambiguous lot qualifies the entire path; it never becomes mother→daughter
    geographic correspondences. A terminal is a coverage boundary, not creation.
    """
    by_daughter, by_mother = defaultdict(list), defaultdict(list)
    by_id = {}
    for event in events:
        if event['id'] in by_id:
            raise ValueError(f'Duplicate event ID after parsing: {event["id"]}')
        by_id[event['id']] = event
        for pid in event['daughterIds']:
            by_daughter[pid].append(event)
        for pid in event['motherIds']:
            by_mother[pid].append(event)
    results = []
    for root in sorted(current_ids):
        paths, terminals, used, supported, problems = [], [], set(), set(), []
        stack = [(root, [], [root], geometry_as_of, [])]
        while stack:
            pid, event_path, reference_path, upper_date, qualifications = stack.pop()

            def terminal(reason, **details):
                terminals.append({'referenceId': pid, 'eventPath': event_path,
                                  'referencePath': reference_path, 'reason': reason,
                                  'qualifications': qualifications, **details})

            candidates = sorted(by_daughter.get(pid, []), key=lambda e: (e['validationDate'] or '', e['id']))
            if not candidates:
                earliest = earliest_geometry.get(pid[:5]) if isinstance(earliest_geometry, dict) else earliest_geometry
                missing = (first_seen and earliest and first_seen.get(pid, earliest) > earliest)
                terminal('missing-document-for-observed-new-reference' if missing else 'source-boundary-or-unrecorded-event')
                continue
            if len(candidates) > 1:
                qualifications = sorted(set(qualifications + ['conflicting-creation-events']))
                problems.append({'kind': 'conflicting-creation-events', 'referenceId': pid,
                                 'eventIds': [e['id'] for e in candidates]})
            for event in reversed(candidates):
                used.add(event['id'])
                if not event['traceable']:
                    terminal('unresolved-dfi-event', eventId=event['id'], issues=event['issues'])
                    continue
                if event['id'] in event_path or any(m in reference_path for m in event['motherIds']):
                    terminal('cycle', eventId=event['id'])
                    problems.append({'kind': 'cycle', 'referenceId': pid, 'eventId': event['id']})
                    continue
                if event['validationDate'] > upper_date:
                    terminal('impossible-chronology', eventId=event['id'], validationDate=event['validationDate'], before=upper_date)
                    problems.append({'kind': 'impossible-chronology', 'referenceId': pid, 'eventId': event['id']})
                    continue
                next_path = event_path + [event['id']]
                supported.add(event['id'])
                qualified = list(qualifications)
                if len(event['motherIds']) > 1:
                    qualified.append('ambiguous-many-to-many-scope' if len(event['daughterIds']) > 1 else 'partial-current-parcel-scope')
                elif len(event['daughterIds']) > 1:
                    qualified.append('former-parcel-includes-other-daughters')
                if event_path and event['validationDate'] == upper_date:
                    qualified.append('same-day-order-unresolved')
                qualified = sorted(set(qualified))
                if not event['motherIds']:
                    terminal('non-cadastral-domain-origin', eventId=event['id'], eventPath=next_path,
                             validationDate=event['validationDate'])
                for mother in reversed(event['motherIds']):
                    next_refs = reference_path + [mother]
                    paths.append({'referenceId': mother, 'eventPath': next_path, 'referencePath': next_refs,
                                  'method': 'documented-dfi', 'qualifications': qualified,
                                  'scope': 'historical-reference-context'})
                    stack.append((mother, next_path, next_refs, event['validationDate'], qualified))
        dates = [by_id[i]['validationDate'] for i in supported]
        # A present current ID which already passed to the public domain is a
        # discrepancy, unless the event postdates the pinned geometry.
        for event in by_mother.get(root, []):
            if not event['daughterIds'] and event['validationDate'] and event['validationDate'] <= geometry_as_of:
                problems.append({'kind': 'current-reference-passed-to-public-domain', 'eventId': event['id']})
        results.append({
            'parcelId': root, 'eventIds': sorted(used), 'supportedEventIds': sorted(supported),
            'ancestorIds': sorted({p['referenceId'] for p in paths}),
            'earliestValidationDate': min(dates) if dates else None, 'latestValidationDate': max(dates) if dates else None,
            'paths': sorted(paths, key=lambda p: (p['referenceId'], p['eventPath'])),
            'terminals': sorted(terminals, key=lambda p: (p['referenceId'], p['eventPath'], p['reason'])),
            'issues': problems,
        })
    return results


def historical_evidence_paths(ancestry, events, original_reference, original_date):
    """Return context routes with original scope/date; ambiguous routes stay unassigned.

    Rights and sales on a former reference are never rewritten as rights or sales
    on a current parcel. This returns a relation to display alongside the original
    record, not a transferred record. Date discrepancies are retained explicitly.
    """
    by_id = {e['id']: e for e in events}
    results = []
    for parcel in ancestry:
        for path in parcel['paths']:
            if path['referenceId'] != original_reference:
                continue
            qualifications = list(path['qualifications'])
            if original_date is not None:
                retirement = by_id[path['eventPath'][-1]]['validationDate']
                if original_date >= retirement:
                    qualifications.append('record-on-or-after-retirement-validation')
                births = [by_id[i]['validationDate'] for i in parcel['eventIds']
                          if original_reference in by_id[i]['daughterIds'] and by_id[i]['traceable']]
                if births and original_date < min(births):
                    qualifications.append('record-before-reference-validation')
            unassigned = any(q in qualifications for q in (
                'ambiguous-many-to-many-scope', 'partial-current-parcel-scope',
                'conflicting-creation-events', 'same-day-order-unresolved',
                'record-on-or-after-retirement-validation', 'record-before-reference-validation'))
            results.append({'currentParcelId': parcel['parcelId'], 'originalReferenceId': original_reference,
                            'originalDate': original_date, 'eventPath': path['eventPath'],
                            'referencePath': path['referencePath'], 'method': 'documented-dfi',
                            'assignment': 'unassigned-context' if unassigned else 'historical-context',
                            'qualifications': sorted(set(qualifications)),
                            'limitation': 'Filiation supplies reference context; it does not transfer rights, sale parties or farming.'})
    return results
