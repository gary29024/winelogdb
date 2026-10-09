"""Dated legal-entity rights and cadastral lineage for every mapped parcel of a cru.

Compares the bundle's current rights snapshot with the DGFiP legal-entity parcel files
for earlier 1 January snapshots and Etalab cadastre vintages. The output is research
evidence of recorded rights and parcel splits; it never names a farmer.

  python scripts/build_grand_cru_rights_history.py --cru echezeaux
  python scripts/build_grand_cru_rights_history.py --cru echezeaux --check

Inputs come from download_grand_cru_sources.py, once per commune bundle.
Requires scripts/burgundy-map-requirements.txt.
"""
import argparse
import csv
import gzip
import io
import json
from functools import lru_cache

from grand_cru import (record_json, cadastre_sources, communes, in_cru, load_bundle, load_cru, load_manifest, parcel_asset, parcels_file, pinned,
                       official_inventory, official_sources, require, research_path, source_dir,
                       vintage_file, village_map, write_or_check)
from grand_cru_filiation import historical_evidence_paths, parse_dfi, trace_ancestry
from grand_cru_spatial_lineage import observed_geometry, spatial_candidates, trace_spatial_ancestry


def parcel_id(row):
    prefix, section, number = (row[4].strip() or '000').zfill(3), row[5].strip().zfill(2), row[6].strip().zfill(4)
    return row[0] + row[2] + prefix + section + number


def read_rights(data, encoding, allowed):
    rows = csv.reader(io.StringIO(data.decode(encoding)), delimiter=';')
    header = next(rows)
    require(len(header) == 24 and 'SIREN' in header[19] and 'nomination' in header[23], 'Review changed rights schema')
    result = {}
    for row in rows:
        require(len(row) == 24, 'Review changed rights row')
        if row[0] + row[2] not in allowed:
            continue
        # 2024+ files expand the code ("P - Propriétaire"); earlier years give the letter only.
        # The MAJIC account can be reissued for the same SIREN; keep it only as the fallback identifier.
        siren = row[19].strip() or None
        record = {'siren': siren, 'majic': None if siren else row[18].strip(), 'name': row[23].strip(),
                  'rightCode': row[17].strip()[:1]}
        require(record['name'] and record['rightCode'], 'Incomplete rights row')
        records = result.setdefault(parcel_id(row), [])
        if record not in records:
            records.append(record)
    return {key: sorted(value, key=lambda r: (r['siren'] or '', r['majic'] or '', r['rightCode'])) for key, value in result.items()}


def holder_key(record):
    return record['siren'] or record['majic']


def is_siren(value):
    # DGFiP uses provisional U-numbers for entities without a SIREN; they are not company identities.
    # INSEE documents the ninth digit as the Luhn control digit:
    # https://xml.insee.fr/schema/siret.html#Controles
    if not value or len(value) != 9 or not value.isascii() or not value.isdigit() or value == '000000000':
        return False
    return sum((2 * int(d) // 10 + 2 * int(d) % 10) if i % 2 else int(d)
               for i, d in enumerate(value)) % 10 == 0


def classify(before, after, existed_before):
    """Describe a change between consecutive snapshots without inferring identity from names."""
    if not before:
        return 'new-parcel-reference' if existed_before is False else 'record-appeared'
    if not after:
        return 'record-disappeared'
    before_ids, after_ids = {holder_key(r) for r in before}, {holder_key(r) for r in after}
    if before_ids == after_ids:
        if not all(is_siren(r['siren']) for r in before + after):
            return 'unprovable-identifier-change'
        return 'same-holder-renamed' if {r['name'] for r in before} != {r['name'] for r in after} else 'right-type-changed'
    if not all(is_siren(r['siren']) for r in before + after):
        # Without a SIREN on the earlier record, identity continuity cannot be proved or excluded.
        return 'unprovable-identifier-change'
    return 'holder-changed'


@lru_cache(maxsize=1)
def bundle_observations(bundle_id, directory_name, configuration):
    """Read/transform shared inputs once while processing all crus in a bundle.

    Configuration is part of the cache key, so a changed pin cannot reuse stale
    bytes within a repeat-import process. Callers do not mutate these snapshots.
    """
    from pyproj import Transformer
    from shapely.geometry import shape
    from shapely.ops import transform

    bundle = json.loads(configuration)
    config, parcels_config = bundle['rightsHistory'], bundle['parcels']
    allowed = communes(bundle)
    by_snapshot, by_date, communes_by_date = {}, {}, {}
    for r in config['rights']:
        by_snapshot.setdefault(r['asOf'], {}).update(read_rights(pinned(directory_name, r['member'], r['sha256']), r['encoding'], allowed))
    by_snapshot.setdefault(parcels_config['rightsAsOf'], {}).update(read_rights(
        pinned(directory_name, parcels_config['rightsMember'], parcels_config['rightsMemberSha256']), 'utf-8-sig', allowed))
    project = Transformer.from_crs(4326, 2154, always_xy=True).transform
    inputs = [(c.get('commune', parcels_config['commune']), c['date'], vintage_file(c.get('commune', parcels_config['commune']), c['date']), c['sha256'])
              for c in config['cadastre']]
    inputs += [(insee, parcels_config['cadastreDate'], parcels_file(insee), digest) for insee, _, digest in cadastre_sources(bundle)]
    for insee, date, name, digest in inputs:
        features = json.loads(gzip.decompress(pinned(directory_name, name, digest)))['features']
        by_date.setdefault(date, {}).update({f['properties']['id']: transform(project, shape(f['geometry'])) for f in features})
        communes_by_date.setdefault(date, set()).add(insee)
    return sorted(by_snapshot.items()), sorted(by_date.items()), communes_by_date


def build(cru, bundle, manifest, directory):
    from pyproj import Transformer
    from shapely.geometry import shape
    from shapely.ops import transform

    config, parcels_config = bundle['rightsHistory'], bundle['parcels']
    parent = cru['parentFeatureId']
    current = {f['id']: f for f in json.loads(parcel_asset(manifest))['features'] if in_cru(f, parent)}
    project = Transformer.from_crs(4326, 2154, always_xy=True).transform
    metric = {i: transform(project, shape(f['geometry'])) for i, f in current.items()}
    _, canonical, _ = village_map(bundle, parent)
    parent_feature = next(f for f in json.loads(canonical)['features'] if f['id'] == parent)
    allowed = parent_feature['properties']['communes']
    cru_shape = transform(project, shape(parent_feature['geometry']))

    snapshots, shared_vintages, shared_communes = bundle_observations(bundle['id'], str(directory), json.dumps(bundle, sort_keys=True))
    vintages = [(d, {p: g for p, g in geometries.items() if p[:5] in allowed}) for d, geometries in shared_vintages
                if set(allowed) & shared_communes[d]]
    communes_by_date = {d: shared_communes[d] & set(allowed) for d, _ in vintages}

    # Spatial overlaps are only candidates. A split is accepted when the successor first appears in the vintage
    # right after the retired reference disappears and lies almost entirely inside it; boundary slivers and
    # neighbours that already existed are kept as rejected candidates and never carry evidence.
    dates = [d for d, _ in vintages]
    first_seen = {cid: next(d for d, g in vintages if cid in g) for cid in metric}
    predecessors, retired = {}, {}
    for date, geometries in vintages[:-1]:
        for pid, geometry in geometries.items():
            if pid in vintages[-1][1]:
                continue
            geometry = observed_geometry(geometry, cru_shape, pid, date)
            if geometry is None:
                continue
            if geometry.intersection(cru_shape).area <= parcels_config['minimumOverlapM2']:
                continue
            entry = retired.setdefault(pid, {'parcelId': pid, 'reference': f'{pid[8:10].lstrip("0")} {pid[10:]}',
                                             'lastSeenCadastre': date, 'cruOverlapM2': 0, 'areaM2': 0, 'successors': {}})
            entry['lastSeenCadastre'] = date
            entry['cruOverlapM2'] = round(geometry.intersection(cru_shape).area, 1)
            entry['areaM2'] = round(geometry.area, 1)
            for cid, cg in metric.items():
                shared = geometry.intersection(cg).area
                if shared > parcels_config['minimumOverlapM2']:
                    entry['successors'][cid] = (shared, shared / cg.area, shared / geometry.area)
    for entry in retired.values():
        next_vintage = dates[dates.index(entry['lastSeenCadastre']) + 1]
        rows = []
        for cid, (shared, of_successor, of_retired) in sorted(entry['successors'].items()):
            accepted = first_seen[cid] == next_vintage and of_successor >= config['successorInsideShare']
            rows.append({'parcelId': cid, 'sharedAreaM2': round(shared, 1), 'shareOfSuccessor': round(of_successor, 4),
                         'shareOfRetired': round(of_retired, 4), 'successorFirstSeen': first_seen[cid],
                         'accepted': accepted})
            if accepted:
                predecessors.setdefault(cid, set()).add(entry['parcelId'])
        entry['successors'] = rows
        entry['rightsHistory'] = [{'asOf': d, 'records': s.get(entry['parcelId'], [])} for d, s in snapshots
                                  if s.get(entry['parcelId'])]

    def present(pid, as_of):
        # Nearest cadastre vintage on or after the rights date (2021 has no 1 January release).
        observed = next((v for v in vintages if v[0] >= as_of and pid[:5] in communes_by_date[v[0]]), None)
        return pid in observed[1] if observed else None

    rows = []
    for pid in sorted(current):
        history = [{'asOf': d, 'records': s.get(pid, [])} for d, s in snapshots]
        changes = []
        for before, after in zip(history, history[1:]):
            if before['records'] != after['records']:
                changes.append({'from': before['asOf'], 'to': after['asOf'],
                                'kind': classify(before['records'], after['records'], present(pid, before['asOf'])),
                                'before': sorted({r['name'] for r in before['records']}),
                                'after': sorted({r['name'] for r in after['records']})})
        cadastre = []
        for date, geometries in vintages[:-1]:
            if pid[:5] not in communes_by_date[date]:
                cadastre.append({'date': date, 'present': None, 'coverage': 'commune-source-not-obtained', 'symmetricDifferenceM2': None})
                continue
            geometry = geometries.get(pid)
            cadastre.append({'date': date, 'present': geometry is not None,
                             'symmetricDifferenceM2': None if geometry is None else
                             round(geometry.symmetric_difference(metric[pid]).area, 1)})
        rows.append({'parcelId': pid, 'reference': current[pid]['properties']['reference'],
                     'firstSeenCadastre': next((c['date'] for c in cadastre if c['present']), parcels_config['cadastreDate']),
                     'predecessorIds': sorted(predecessors.get(pid, ())), 'cadastre': cadastre,
                     'rightsHistory': history, 'rightsChanges': changes})
    kinds = {}
    for row in rows:
        for change in row['rightsChanges']:
            kinds[change['kind']] = kinds.get(change['kind'], 0) + 1
    current_cadastre = [{'date': parcels_config['cadastreDate'], 'url': url, 'sha256': digest}
                        for _, url, digest in cadastre_sources(bundle)]
    result = {
        'schemaVersion': 1, 'purpose': cru['rightsHistoryPurpose'], 'parentFeatureId': parent,
        'inputs': {'parcelSnapshotSha256': manifest['sha256'],
                   'rights': [{'asOf': r['asOf'], 'url': r['url'], 'member': r['member'], 'sha256': r['sha256']}
                              for r in config['rights']] +
                             [{'asOf': parcels_config['rightsAsOf'], 'url': parcels_config['rightsUrl'],
                               'member': parcels_config['rightsMember'], 'sha256': parcels_config['rightsMemberSha256']}],
                   'cadastre': [{'date': c['date'], 'url': c['url'], 'sha256': c['sha256']} for c in config['cadastre']] +
                               current_cadastre},
        'rules': ['A recorded right is legal-entity ownership or another real right on 1 January, never farming.',
                  'Private individuals are not in the legal-entity files: no record does not mean no owner.',
                  'Holder continuity is proved only by the same SIREN; names alone are hints for review.',
                  'Lineage is accepted only when a successor first appears in the next vintage and lies at least '
                  f"{config['successorInsideShare']:.0%} inside the retired reference; other overlaps are rejected candidates. "
                  'It is rule-based, not a documented division act.'],
        'counts': {'parcels': len(rows), 'withAnyRightsChange': sum(bool(r['rightsChanges']) for r in rows),
                   'firstObservedAfterEarliestVintage': sum(r['firstSeenCadastre'] != vintages[0][0] for r in rows),
                   'withPredecessor': sum(bool(r['predecessorIds']) for r in rows),
                   'retiredReferences': len(retired), 'changeKinds': dict(sorted(kinds.items()))},
        'retiredParcels': [retired[k] for k in sorted(retired)],
        'parcels': rows,
    }
    inventory = official_inventory(bundle)
    if inventory is not None:
        extend_official_history(result, bundle, directory, snapshots, vintages, current, allowed, communes_by_date)
    candidates = spatial_candidates(vintages, communes_by_date, cru_shape=cru_shape,
                                    minimum_overlap=parcels_config['minimumOverlapM2'], inside_share=config['successorInsideShare'])
    inferred, conflicts = trace_spatial_ancestry(current, candidates, result.get('documentedEvents', []))
    result['spatialCandidates'], result['spatialConflicts'] = candidates, conflicts
    for row, spatial in zip(result['parcels'], inferred):
        require(row['parcelId'] == spatial['parcelId'], 'Mismatched spatial ancestry')
        row['inferredAncestry'] = spatial
    if 'coverage' in result:
        result['coverage']['spatialCandidatesAccepted'] = sum(c['accepted'] for c in candidates)
        result['coverage']['spatialCandidatesRejected'] = sum(not c['accepted'] for c in candidates)
        # The #411 next-vintage rule keeps its own accepted and rejected successors on each retired reference.
        successors = [s for r in result['retiredParcels'] for s in r['successors']]
        result['coverage']['nextVintageSuccessorsAccepted'] = sum(s['accepted'] for s in successors)
        result['coverage']['nextVintageSuccessorsRejected'] = sum(not s['accepted'] for s in successors)
        result['coverage']['spatialCountsNote'] = ('spatialCandidates* count the multi-vintage lineage candidates; '
                                                   'nextVintageSuccessors* count the #411 successors under retiredParcels.')
        result['coverage']['spatialConflicts'] = conflicts
        result['coverage']['inferredOnlyCurrentParcels'] = sum(bool(r['inferredAncestry']['paths']) and not r['documentedAncestry']['ancestorIds']
                                                            for r in result['parcels'])
    return result


def extend_official_history(result, bundle, directory, snapshots, vintages, current, cru_communes, communes_by_date):
    """Attach DFI paths and original-reference rights, never inherited current rights."""
    inventory = official_inventory(bundle)
    sources = [s for s in official_sources(bundle, 'dfi') if any(c[:2] == s['department'] for c in cru_communes)]
    schema = official_sources(bundle, 'dfi-schema')
    for source in schema:
        if source['status'] == 'obtained':
            require(source['schemaVersion'] == '2025-01', 'Review the updated DFI schema before parsing its new release')
            pinned(directory, source['fileName'], source['sha256'])
    events, issues, commune_coverage = [], [], []
    for source in sources:
        selected = [c for c in cru_communes if c[:2] == source['department']]
        if source['status'] != 'obtained':
            issues.append({'kind': 'dfi-source-not-obtained', 'sourceId': source['id'], 'reason': source['reason']})
            continue
        parsed = parse_dfi(pinned(directory, source['fileName'], source['sha256']),
                           department_code=source['departmentCode'], insee_department=source['department'],
                           allowed_communes=selected, as_of=source['asOf'])
        events += [{**e, 'sourceId': source['id']} for e in parsed['events']]
        issues += parsed['issues']
        for commune in selected:
            dated = [e['validationDate'] for e in parsed['events'] if e['commune'] == commune and e['validationDate']]
            commune_coverage.append({'commune': commune, 'sourceId': source['id'],
                                    'completeDepartmentMemberObtained': True,
                                    'earliestValidationDateInCommune': min(dated) if dated else None,
                                    'latestValidationDateInCommune': max(dated) if dated else None})
    first_seen = {pid: next(d for d, geometries in vintages if pid in geometries)
                  for pid in {p for _, geometries in vintages for p in geometries}}
    earliest_by_commune = {c: next(d for d, _ in vintages if c in communes_by_date[d]) for c in cru_communes}
    ancestry = trace_ancestry(current, events, geometry_as_of=bundle['parcels']['cadastreDate'],
                              first_seen=first_seen, earliest_geometry=earliest_by_commune)
    by_parcel = {p['parcelId']: p for p in ancestry}
    relevant_ids = {i for p in ancestry for i in p['eventIds']}
    relevant_references = set(current) | {i for p in ancestry for i in p['ancestorIds']}
    relevant_events = [e for e in events if e['id'] in relevant_ids
                       or (not e['daughterIds'] and set(e['motherIds']) & relevant_references)]
    historical_rights = []
    for original_reference in sorted(relevant_references - set(current)):
        for snapshot_date, rights in snapshots:
            if records := rights.get(original_reference):
                paths = historical_evidence_paths(ancestry, events, original_reference, snapshot_date)
                historical_rights.append({'originalReferenceId': original_reference, 'asOf': snapshot_date,
                                          'dateRole': '1-january-rights-snapshot', 'records': records,
                                          'originalScope': 'entire-printed-parcel-reference', 'contextPaths': paths})
    reconciliation = []
    for event in relevant_events:
        validation = event['validationDate']
        if validation is None:
            continue
        before = next(((d, g) for d, g in reversed(vintages) if d < validation and event['commune'] in communes_by_date[d]), None)
        after = next(((d, g) for d, g in vintages if d >= validation and event['commune'] in communes_by_date[d]), None)
        reconciliation.append({
            'eventId': event['id'], 'validationDate': validation, 'dateRole': 'dfi-validation',
            'beforeObservation': before[0] if before else None, 'afterObservation': after[0] if after else None,
            'mothersObservedBefore': [p for p in event['motherIds'] if before and p in before[1]],
            'daughtersObservedAfter': [p for p in event['daughterIds'] if after and p in after[1]],
            'daughtersObservedBeforeValidation': [p for p in event['daughterIds'] if before and p in before[1]],
            'mothersObservedAfterValidation': [p for p in event['motherIds'] if after and p in after[1]],
            'unobservedMotherIds': [p for p in event['motherIds'] if not before or p not in before[1]],
            'unobservedDaughterIds': [p for p in event['daughterIds'] if not after or p not in after[1]],
            'status': 'before-earliest-obtained-geometry' if before is None else
                      'after-pinned-geometry' if after is None else 'dated-id-comparison',
            'limitation': 'An intermediate reference can appear and retire between releases. Missing observed geometry does not negate a DFI event.',
        })
    for row in result['parcels']:
        documented = by_parcel[row['parcelId']]
        if any(s['status'] != 'obtained' and row['parcelId'].startswith(s['department']) for s in sources):
            for terminal in documented['terminals']:
                if terminal['reason'] == 'source-boundary-or-unrecorded-event':
                    terminal['reason'] = 'dfi-source-not-obtained'
        row['documentedAncestry'] = documented
        row['earliestSupportedEvent'] = ({'date': documented['earliestValidationDate'], 'dateRole': 'dfi-validation'}
                                         if documented['earliestValidationDate'] else
                                         {'date': row['firstSeenCadastre'], 'dateRole': 'first-observed-cadastral-release'})
        row['spatialPredecessorIds'] = row['predecessorIds']
    dates = [p['earliestValidationDate'] for p in ancestry if p['earliestValidationDate']]
    latest = [p['latestValidationDate'] for p in ancestry if p['latestValidationDate']]
    supported = {i for p in ancestry for i in p['supportedEventIds']}
    supported_events = [e for e in events if e['id'] in supported]
    terminal_counts = {}
    for p in ancestry:
        for terminal in p['terminals']:
            terminal_counts[terminal['reason']] = terminal_counts.get(terminal['reason'], 0) + 1
    selected_sources = [s for s in inventory['sources'] if s['kind'] == 'dfi-schema'
                        or s.get('department') in {c[:2] for c in cru_communes}
                        or (s.get('commune') in cru_communes and s.get('date', '') <= bundle['parcels']['cadastreDate'])]
    result.update({
        'schemaVersion': 2, 'documentedEvents': relevant_events, 'dfiParseIssues': issues,
        'historicalReferenceRights': historical_rights, 'geometryReconciliation': reconciliation,
        'coverage': {
            'inventory': bundle['officialHistory']['inventory'], 'catalogueDate': inventory['catalogueDate'],
            'rightsAvailable': {d: [r['asOf'] for r in inventory['available']['rights'][d]]
                                for d in sorted({c[:2] for c in cru_communes})},
            'rightsImported': [d for d, _ in snapshots], 'dfiSources': sources, 'dfiSchema': schema,
            'dfiCommuneCoverage': commune_coverage,
            'earliestReachableDfiValidationDate': min(dates) if dates else None,
            'latestReachableDfiValidationDate': max(latest) if latest else None,
            'geometry': {c: {**inventory['available']['geometry'][c],
                             'obtainedDates': [s['date'] for s in selected_sources if s['kind'] == 'geometry'
                                               and s['commune'] == c and s['status'] == 'obtained']}
                         for c in cru_communes},
            'currentParcelsWithDocumentedAncestors': sum(bool(p['ancestorIds']) for p in ancestry),
            'currentParcelsWithPre2019DfiEvents': sum(bool(p['earliestValidationDate']) and p['earliestValidationDate'] < '2019-01-01'
                                                    for p in ancestry),
            'distinctDfiDocuments': len({(e['departmentCode'], e['commune'], e['sectionPrefix'], e['documentId']) for e in supported_events}),
            'distinctDfiAnalysisLots': len(supported),
            'inferredOnlyCurrentParcels': sum(bool(r['predecessorIds']) and not by_parcel[r['parcelId']]['ancestorIds']
                                            for r in result['parcels']),
            'unresolvedEvents': sum(not e['traceable'] for e in relevant_events),
            'traversalIssues': [p for row in ancestry for p in row['issues']], 'terminalReasons': terminal_counts,
            'missingSources': [s for s in selected_sources if s['status'] != 'obtained'],
            'salesAndNotices': 'Independent inventories and original-reference matches are published with sale records and notice audits.',
        },
    })
    result['inputs']['officialInventory'] = bundle['officialHistory']['inventory']
    result['rules'] += [
        'Documented DFI event groups are primary filiation evidence; spatial candidates remain labelled inference.',
        'All reachable predecessor generations and original date roles are retained, without a calendar cutoff.',
        'Many-to-many lots do not assert individual geographic parent-child matches; partial routes stay qualified.',
        'Historical-reference rights are contextual records on their original reference, never transferred current rights.',
        'First supported events and source-boundary stops do not establish creation, original ownership or uninterrupted continuity.',
    ]


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--cru', required=True)
    parser.add_argument('--source-dir')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    cru, bundle = load_cru(args.cru)
    require('rightsHistoryPurpose' in cru and 'rightsHistory' in bundle, f'{cru["slug"]}: rights history not configured yet')
    result = build(cru, bundle, load_manifest(bundle), source_dir(bundle, args.source_dir))
    write_or_check(research_path(cru, 'rights-history.json'), record_json(result), args.check)
    print(json.dumps(result['counts']))


if __name__ == '__main__':
    main()
