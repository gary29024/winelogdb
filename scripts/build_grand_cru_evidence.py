"""App-facing evidence file for a cru's parcel panel (src/lib/places/grandCruParcels/<slug>.evidence.json).

Turns the research register into one short, dated list of records per parcel
(official notices, published research, ownership changes and weak leads) so the
app can show "History and evidence" without reading the large research files.
Every record is dated evidence; none states who farms a parcel today.
"""
import re
from build_grand_cru_notice_history import indexed_event_notice
from grand_cru_filiation import historical_evidence_paths

SCHEMA_VERSION = 2
NOTE_LIMIT = 330
KIND_ORDER = ['authorisation', 'suspended', 'application', 'notice', 'filing', 'research', 'ownership', 'sale', 'filiation', 'lineage', 'lead']
EVENT_KINDS = {'authorisation': 'authorisation', 'suspended-application': 'suspended', 'historical-application': 'application',
               'refused-application': 'notice'}
RESEARCH_LABELS = {
    'critic-named-cadastral-reference': 'Named by parcel number',
    'critic-attribution-area-reconstructed': 'Matched by area only',
    'critic-holding-description': 'Holding described, parcel not named',
    'estate-area-exact-match': 'Matched by exact area',
    'estate-area-near-match': 'Near-area reconstruction',
    'court-named-cadastral-reference': 'Named in a court ruling',
    'filing-named-cadastral-reference': 'Named in a company filing',
}
LEAD_LABELS = {
    'brand-identity-confirmed': 'Brand identity confirmed',
    'estate-context': 'Estate context',
    'secondary-estate-context': 'Estate context (secondary source)',
    'management-and-estate-context': 'Management and estate context',
    'group-and-estate-context': 'Parent group and estate context',
    'management-and-reported-estate-context': 'Management and reported estate context',
    'management-only-lead': 'Management link only',
    'bottler-only-lead': 'Bottler only',
    'identity-only': 'Identity only',
    'weak-identity-lead': 'Similar name only',
    'reported-operator-relationship': 'Reported relationship',
    'succession-lead': 'Succession lead',
    'partial-succession-lead': 'Partial succession lead',
    'registered-office-match': 'Same registered office',
    'filing-tenant-relationship': 'Dated lease relationship',
    'filing-lease-mandate': 'Named in a lease mandate',
    'filing-family-tenant-context': 'Named individual tenant',
    'company-identity': 'Company record',
    'family-company-record': 'Family company record',
    'group-company-record': 'Group company record',
    'name-and-seat-crosswalk': 'Identity by name and seat only',
    # Tier 3 placeholder: the domaine's own dated reply, recorded as a domaine-outreach source.
    'domaine-confirmed': 'Confirmed by the domaine',
}
OWNERSHIP_KINDS = {'record-appeared', 'holder-changed'}
SALE_TITLES = {'sale': 'Sold', 'exchange': 'Exchanged', 'auction': 'Sold at auction', 'other': 'Transferred'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def year(date):
    return date[:4]


def title_case_owner(name):
    """DGFiP names are upper case; keep legal-form acronyms."""
    forms = {'GFA', 'GFV', 'SA', 'SAS', 'SARL', 'SCEA', 'SCEV', 'SCI', 'EARL', 'GAEC', 'SCA', 'BND', 'HOR'}
    small = {'de', 'du', 'des', 'la', 'le', 'les', 'et', 'en', 'aux'}
    words = re.split(r'(\s+|-)', name.lower())
    out = []
    for i, word in enumerate(words):
        if not word.strip() or word == '-':
            out.append(word)
        elif word.upper() in forms:
            out.append(word.upper())
        elif i > 0 and word in small:
            out.append(word)
        else:
            out.append(re.sub(r"^(d'|l')?(.)", lambda m: (m.group(1) or '') + m.group(2).upper(), word))
    return ''.join(out)


def short_reference(parcel_id):
    """Section and number, e.g. A0523. A non-000 prefix (a former, absorbed commune) is kept so references stay unique."""
    prefix, section = parcel_id[5:8], parcel_id[8:10].lstrip('0')
    return f"{'' if prefix == '000' else prefix + ' '}{section}{parcel_id[10:]}"


SOURCE_KINDS = {
    'critic-research': 'research', 'registry-dataset': 'data', 'geometry': 'data', 'court-decision': 'official',
    'registry': 'company', 'registry-aggregator': 'company', 'company-filing': 'company', 'legal-notice-republisher': 'company',
    'estate': 'estate', 'estate-hosted-press': 'estate', 'estate-visit-report': 'estate', 'domaine-outreach': 'estate',
}


def source_entry(source):
    kind = 'official' if source['type'].startswith('government') else SOURCE_KINDS.get(source['type'], 'other')
    return {'title': source['title'], 'url': source['url'], 'kind': kind, 'date': source.get('documentDate')}


def event_item(event, via=None):
    kind = EVENT_KINDS[event['kind']]
    item = {'kind': kind, 'date': event['documentDate'], 'title': event['applicant'], 'note': event['appNote'],
            'sources': [event['sourceId']]}
    if event.get('operation') == 'aerial-spraying-derogation':
        item['label'] = 'Aerial-spraying derogation'
    if event['kind'] == 'refused-application':
        item['label'] = 'Application refused'
    previous = event.get('previousOperator')
    if previous and previous != 'Not stated':
        item['detail'] = f'Previous operator named in notice: {previous}'
    if via:
        item['via'] = short_reference(via)
    return item


def research_item(entry, source_dates, via=None):
    # An undated primary research source stays undated even when a supporting registry is dated.
    item = {'kind': 'research', 'date': source_dates.get(entry['dateSourceId']),
            'title': entry['title'], 'label': RESEARCH_LABELS[entry['basis']], 'note': entry['appNote'],
            'sources': list(entry['sourceIds'])}
    if via:
        item['via'] = short_reference(via)
    return item


def ownership_items(row):
    items = []
    for change in row['rightsChanges']:
        if change['kind'] not in OWNERSHIP_KINDS:
            continue
        after = ' / '.join(title_case_owner(n) for n in change['after'])
        if change['kind'] == 'holder-changed':
            before = ' / '.join(title_case_owner(n) for n in change['before'])
            title = f'Recorded right holder changed to {after}'
            detail = f'Previously {before}'
        else:
            title = f'Legal-entity right first observed in these snapshots: {after}'
            detail = f'No legal-entity right was recorded on 1 January {year(change["from"])}'
        items.append({'kind': 'ownership', 'date': change['to'], 'dateRole': '1-january-rights-snapshot', 'title': title, 'detail': detail,
                      'note': 'Legal-entity rights only. A change can be a sale, a transfer into a company or another recorded right.',
                      'sources': ['dgfip-history']})
    if row['predecessorIds']:
        refs = ', '.join(short_reference(p) for p in row['predecessorIds'])
        items.append({'kind': 'lineage', 'date': row['cadastreFirstSeen'], 'dateRole': 'cadastral-observation',
                      'method': 'spatial-inference', 'title': f'Spatial inference from former parcel {refs}',
                      'sources': ['cadastre-history'],
                      'note': 'First observed in the next obtained vintage and at least 95% inside the former polygon. This is a spatial inference, not an official filiation document or a creation date.'})
    return items


def sale_items(row):
    items = []
    for sale in row['saleRecords']:
        item = {'kind': 'sale', 'date': sale['date'], 'dateRole': 'deed-date', 'title': SALE_TITLES[sale['nature']], 'sources': ['dvf-sales'],
                'note': 'Public sale record: a date and a deed, with no buyer, seller or price. A buyer need not farm the land.'}
        parts = [short_reference(p) for p in sale['sameDeed']]
        if sale['otherParcels']:
            parts.append(f"{sale['otherParcels']} parcel{'s' if sale['otherParcels'] > 1 else ''} outside the cru")
        if parts:
            # Only a single-disposition sale moves all its parcels together, for one price.
            together = sale['nature'] == 'sale' and sale['dispositions'] == 1
            item['detail'] = ('Sold together with ' if together else 'In the same deed as ') + ', '.join(parts)
        later_holders = [c for c in row['candidateLeads'] if c['basis'] == 'co-sale-with-later-company-holder' and c['deedId'] == sale['deedId']]
        if later_holders:
            names = ' / '.join(title_case_owner(c['name']) for c in later_holders)
            item['detail'] += f'. Other parcels were later recorded to {names}. That later record does not identify the buyer of this parcel.'
            item['sources'] = ['dvf-sales', 'dgfip-history']
        items.append(item)
    return items


def lead_items(row, holders):
    items = []
    for lead in row['candidateLeads']:
        if 'holderId' not in lead:
            continue
        holder = holders[lead['holderId']]
        note = holder['finding']
        require(len(note) <= NOTE_LIMIT, f'Holder finding too long for the app: {lead["holderId"]}')
        items.append({'kind': 'lead', 'date': None, 'title': f'Possible domaine: {lead["name"]}',
                      'label': LEAD_LABELS.get(lead['basis'], lead['basis'].replace('-', ' ').capitalize()),
                      'note': note, 'sources': list(lead['sourceIds'])})
    return items


def sort_key(item):
    return KIND_ORDER.index(item['kind']), tuple(-ord(c) for c in (item.get('date') or '')), item['title']


def build_evidence(register, curation, history, features):
    sources = {s['id']: s for s in curation['sources']}
    for source in history.get('coverage', {}).get('dfiSources', []):
        sources[source['id']] = {'title': f"DGFiP official DFI, department {source['department']}, snapshot {source['asOf']}",
                                 'url': source['url'], 'type': 'registry-dataset', 'documentDate': source['asOf'],
                                 'provenance': source}
    source_dates = {s['id']: s.get('documentDate') for s in curation['sources']}
    holders = {h['holderId']: h for h in curation['holders']}
    by_id = {r['parcelId']: r for r in register['parcels']}
    history_by_id = {r['parcelId']: r for r in history['parcels']}
    dfi_events = {e['id']: e for e in history.get('documentedEvents', [])}
    features_by_id = {f['id'] for f in features}
    accepted = {r['parcelId']: {s['parcelId'] for s in r['successors'] if s['accepted']} for r in history['retiredParcels']}
    parcels = {}
    used = set()
    for event in curation['exactParcelEvents']:
        require(event.get('appNote') and len(event['appNote']) <= NOTE_LIMIT, f'{event["sourceId"]}: needs a short appNote')
    for entry in curation['externalResearch']:
        if entry['parcelIds'] or entry.get('predecessorReferences'):
            require(entry.get('appNote') and len(entry['appNote']) <= NOTE_LIMIT, f'{entry["id"]}: needs a short appNote')
    for filing in curation['parcelFilings']:
        for note in [filing.get('appNote'), *filing.get('appNotesByParcel', {}).values()]:
            require(note and len(note) <= NOTE_LIMIT, f'{filing["id"]}: needs a short appNote')

    def add(parcel_id, item):
        parcels.setdefault(parcel_id, []).append(item)
        used.update(item['sources'])

    def original_context(parcel_id, item, former, scope):
        paths = historical_evidence_paths([r['documentedAncestry'] for r in history['parcels'] if 'documentedAncestry' in r],
                                          history.get('documentedEvents', []), former, item['date'])
        paths = [p for p in paths if p['currentParcelId'] == parcel_id]
        if not paths:
            inferred = [p for p in history_by_id[parcel_id].get('inferredAncestry', {}).get('paths', []) if p['referenceId'] == former]
            paths = [{'referencePath': p['referencePath'], 'eventPath': [], 'candidatePath': p['candidatePath'],
                      'method': 'spatial-inference', 'assignment': 'unassigned-context',
                      'qualifications': ['spatial-inference-only', 'original-scope-not-located-on-current-parcel']} for p in inferred]
        if not paths:
            paths = [{'referencePath': [parcel_id, former], 'eventPath': [], 'method': 'unknown',
                      'assignment': 'unassigned-context', 'qualifications': ['no-supported-ancestry-route']}]
        return {**item, 'originalReferenceId': former, 'originalScope': scope, 'contextPaths': paths}

    for parcel_id, row in by_id.items():
        for filing in curation['parcelFilings']:
            if parcel_id in filing['parcelAreasM2']:
                add(parcel_id, {'kind': 'filing', 'date': filing['documentDate'], 'title': filing['title'],
                                'note': filing.get('appNotesByParcel', {}).get(parcel_id, filing['appNote']),
                                'sources': list(dict.fromkeys([filing['sourceId'], *filing.get('supportingSourceIds', [])]))})
        for event in curation['exactParcelEvents']:
            if parcel_id in event['parcelIds']:
                item = event_item(event)
                if 'indexedNotice' in event:
                    notice = indexed_event_notice(event, sources[event['sourceId']], row['reviewedNoticeReferences'])
                    item.update(dateRole=notice['dateRole'], originalNoticeRecord=notice['originalRecord'],
                                originalReferenceIds=notice['matchedReferenceIds'],
                                originalScope='printed-notice-reference-and-area', contextPaths=notice['contextPaths'])
                add(parcel_id, item)
            for retired, current in event.get('predecessorReferences', {}).items():
                if parcel_id in current:
                    add(parcel_id, original_context(parcel_id, event_item(event, via=retired), retired, 'printed-notice-reference-and-area'))
        for entry in curation['externalResearch']:
            if not (entry['parcelIds'] or entry.get('predecessorReferences')):
                continue
            if parcel_id in entry['parcelIds']:
                add(parcel_id, research_item(entry, source_dates))
            for retired, current in entry.get('predecessorReferences', {}).items():
                if parcel_id in current:
                    add(parcel_id, original_context(parcel_id, research_item(entry, source_dates, via=retired), retired, 'original-research-reference-and-stated-area'))
        for item in ownership_items(row) + sale_items(row) + lead_items(row, holders):
            add(parcel_id, item)
        for deed in row.get('historicalReferenceSales', []):
            add(parcel_id, {'kind': 'sale', 'date': deed['date'], 'dateRole': 'deed-date',
                            'title': 'Historical-reference ' + SALE_TITLES[deed['nature']].lower(),
                            'detail': 'Original deed references: ' + ', '.join(deed['originalParcelIds']),
                            'originalReferenceIds': deed['originalParcelIds'], 'originalScope': deed['originalScope'],
                            'contextPaths': deed['contextPaths'], 'sources': ['dvf-sales'], 'note': deed['limitation']})
        for notice in row.get('reviewedNoticeReferences', []):
            # Existing curated events keep their reviewed titles. The new record
            # supplies historical-reference context, never an inherited operator.
            if notice['indexId'] == 'cru-reviewed-notice-curation':
                continue
            source = notice.get('source') or {}
            url = source.get('url')
            if not url:
                continue
            document_key = lambda value: value.split('/telechargement/')[-1].split('#')[0]
            if any((e.get('indexedNotice', {}).get('noticeId') == notice['originalRecord']['noticeId'] and
                    e['indexedNotice']['indexId'] == notice['indexId'] and
                    e['indexedNotice']['originalReferenceId'] in notice['matchedReferenceIds'])
                   if 'indexedNotice' in e else
                   (e['documentDate'] == notice['originalDate'] and
                   document_key(sources[e['sourceId']]['url']) == document_key(url) and
                   (parcel_id in e['parcelIds'] or parcel_id in {p for ps in e.get('predecessorReferences', {}).values() for p in ps}))
                   for e in curation['exactParcelEvents']):
                continue
            source_id = 'notice-history:' + notice['indexId'] + ':' + str(notice['originalRecord']['noticeId'])
            sources[source_id] = {'title': source.get('title', 'Reviewed administrative notice'), 'url': url,
                                  'type': 'government-notice', 'documentDate': notice['originalDate']}
            add(parcel_id, {'kind': 'notice', 'date': notice['originalDate'], 'dateRole': notice['dateRole'],
                            'title': 'Reviewed notice reference: ' + (notice['originalPrintedReference'] or ', '.join(notice['matchedReferenceIds'])),
                            # A treatment derogation's requester is not a farm applicant or operator.
                            'detail': ('Aerial-spraying derogation requested by ' if notice['originalRecord'].get('status') == 'derogation-granted'
                                       else 'Applicant: ') +
                                      (notice['originalRecord'].get('applicant') or 'not identified in this reading') +
                                      '; printed area: ' + str(notice['originalRecord'].get('areaHa', 'not recorded')) + ' ha',
                            'originalNoticeRecord': notice['originalRecord'],
                            'originalReferenceIds': notice['matchedReferenceIds'], 'originalScope': 'printed-notice-reference-and-area',
                            'contextPaths': notice['contextPaths'], 'sources': [source_id], 'note': notice['limitation']})
        for event_id in history_by_id[parcel_id].get('documentedAncestry', {}).get('eventIds', []):
            event = dfi_events[event_id]
            mothers = ', '.join(short_reference(p) for p in event['motherIds']) or 'Non-cadastral domain'
            daughters = ', '.join(short_reference(p) for p in event['daughterIds']) or 'Public domain'
            add(parcel_id, {'kind': 'filiation', 'date': event['validationDate'], 'dateRole': 'dfi-validation',
                            'method': 'documented-dfi', 'title': f'Official event group: {mothers} → {daughters}',
                            'detail': f"Commune {event['commune']} · prefix {event['sectionPrefix']} · document {event['documentId']} · lot {event['analysisLot']}",
                            'note': 'Validation date of a documented event group. Many-to-many and partial scope remain qualified; no holder or farmer is inferred.'
                                    if event['traceable'] else 'This event group has unresolved source problems and does not support an ancestry assignment.',
                            'sources': [event['sourceId']],
                            'eventId': event_id, 'motherIds': event['motherIds'], 'daughterIds': event['daughterIds']})
        for record in history.get('historicalReferenceRights', []):
            paths = [p for p in record['contextPaths'] if p['currentParcelId'] == parcel_id]
            if not paths:
                continue
            names = ' / '.join(title_case_owner(r['name']) + ' (' + r['rightCode'] + ')' for r in record['records'])
            add(parcel_id, {'kind': 'ownership', 'date': record['asOf'], 'dateRole': '1-january-rights-snapshot',
                            'title': f'Former-reference rights: {names}', 'via': short_reference(record['originalReferenceId']),
                            'originalReferenceId': record['originalReferenceId'], 'originalScope': record['originalScope'],
                            'contextPaths': paths, 'sources': ['dgfip-history'],
                            'note': 'Rights recorded on the original reference at this snapshot. Filiation supplies context and does not transfer these rights to this parcel.'})
    for event in curation['exactParcelEvents']:
        for parcel_id in event.get('otherCruParcelIds', []):
            require(parcel_id in features_by_id and parcel_id not in by_id, f'Unknown other-cru parcel: {parcel_id}')
            add(parcel_id, event_item(event))
    for items in parcels.values():
        items.sort(key=sort_key)
        for item in items:
            require(all(s in sources or s in {'dgfip-history', 'cadastre-history'} for s in item['sources']), 'Unknown evidence source')
    # Domaine headings are sourced research context, not verified operators.
    # Ambiguous/missing candidates retain the legal holder name in the UI.
    holder_domains = {hid: {'name': h['candidateNames'][0], 'basis': h['basis'],
                            'note': h['finding'], 'sources': list(h['sourceIds'])}
                      for hid, h in holders.items() if len(h['candidateNames']) == 1}
    used.update(s for h in holder_domains.values() for s in h['sources'])
    return {
        'holderDomains': dict(sorted(holder_domains.items())),
        'schemaVersion': SCHEMA_VERSION,
        'note': 'Dated records per parcel. None states who farms a parcel today; each needs a dated confirmation of actual operation.',
        'reviewedAt': curation['reviewedAt'],
        'sources': {s: {**source_entry(sources[s]),
                        **({'provenance': sources[s]['provenance']} if 'provenance' in sources[s] else {})}
                    for s in sorted(used)},
        'parcels': {p: parcels[p] for p in sorted(parcels)},
        **({'coverage': {register['parentFeatureId']: register['historyCoverage']},
            'tracing': {r['parcelId']: {'earliestSupportedEvent': r['earliestSupportedEvent'],
                                       'paths': r['documentedAncestry']['paths'],
                                       'terminals': r['documentedAncestry']['terminals'],
                                       'issues': r['documentedAncestry']['issues']}
                        for r in history['parcels']}}
           if 'coverage' in history else {}),
    }
