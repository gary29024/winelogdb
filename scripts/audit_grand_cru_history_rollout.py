"""Independently cross-check all deliveries against raw pinned sources and INAO.

This does not call the history, parcel or register builders. It checks exact raw
geometry, complete DFI row sets, current holder/right sets, event paths, every
current parcel, distinct dates/scope, unknown farming, lazy payloads and gaps.
The compact JSON/Markdown report is reproducible with --check after acquisition.
"""
import argparse
from collections import defaultdict
import csv
import gzip
import io
import json
from pathlib import Path

from grand_cru import (APP_DIR, CONFIG_DIR, REPORT_DIR, ROOT, SOURCE_ROOT, bundle_parent_features,
                       cadastre_sources, cru_slugs, in_cru, load_cru, load_manifest, official_inventory,
                       parcel_asset, parcels_file, pinned, read_json, relative, require, sha256, source_dir, write_or_check)


def audit():
    cached_geometry, cached_dfi, cached_rights = {}, {}, {}
    results, unique_current = [], set()
    inventory = read_json(CONFIG_DIR / 'sources/inventory-2026-10-01.json')
    for source in inventory['sources']:
        if source['status'] == 'obtained':
            raw = pinned(SOURCE_ROOT / 'shared', source['fileName'], source['sha256'])
            require(len(raw) == source['size'], f"Raw size drift: {source['id']}")
    for slug in sorted(cru_slugs(), key=lambda s: load_cru(s)[0]['issue']):
        cru, bundle = load_cru(slug)
        manifest = load_manifest(bundle)
        parents, map_hashes = bundle_parent_features(bundle)
        require(parents[cru['parentFeatureId']]['properties']['communes'] == sorted(parents[cru['parentFeatureId']]['properties']['communes']),
                f'{slug}: review noncanonical INAO commune ordering')
        inao_communes = set(parents[cru['parentFeatureId']]['properties']['communes'])
        features = [f for f in json.loads(parcel_asset(manifest))['features'] if in_cru(f, cru['parentFeatureId'])]
        current = {f['id'] for f in features}
        unique_current.update(current)
        for commune, _, digest in cadastre_sources(bundle):
            if commune not in cached_geometry:
                raw = pinned(source_dir(bundle), parcels_file(commune), digest)
                cached_geometry[commune] = {f['properties']['id']: f for f in json.loads(gzip.decompress(raw))['features']}
        for f in features:
            require(f['properties']['commune'] in inao_communes, f'{slug}: non-INAO commune added')
            require(f['geometry'] == cached_geometry[f['id'][:5]][f['id']]['geometry'], f"{slug}: current geometry changed: {f['id']}")
        history, register, sales, notices = [read_json(research_path) for research_path in
                                            [ROOT / f'docs/research/{slug}/{name}.json' for name in
                                             ['rights-history', 'register', 'sale-records', 'notice-history']]]
        evidence_path = APP_DIR / f'{slug}.evidence.json'
        payload = evidence_path.read_bytes().replace(b'\r\n', b'\n')
        evidence = json.loads(payload)
        require({r['parcelId'] for r in history['parcels']} == {r['parcelId'] for r in register['parcels']} == set(evidence['tracing']) == current,
                f'{slug}: incomplete mapped-parcel delivery')
        require(register['counts']['currentFarmerConfirmed'] == 0 and
                all(r['currentFarmer'] is None and r['verifiedAsOf'] is None for r in register['parcels']), f'{slug}: farming claim added')
        events = {e['id']: e for e in history['documentedEvents']}
        for source in history['coverage']['dfiSources']:
            if source['id'] not in cached_dfi:
                raw = pinned(source_dir(bundle), source['fileName'], source['sha256'])
                cached_dfi[source['id']] = raw.decode('ascii').splitlines()
        for event in events.values():
            sides = defaultdict(set)
            for line in event['sourceLines']:
                fields = cached_dfi[event['sourceId']][line - 1].split(';')
                require(':'.join([fields[0], fields[1], fields[2], fields[3], fields[8]]) == event['id'], f'{slug}: DFI document/lot drift')
                require(fields[4] == event['changeType'] and fields[5] == event['validationDate'].replace('-', ''), f'{slug}: DFI metadata drift')
                for printed in fields[10:]:
                    if printed:
                        sides[fields[9]].add(event['department'] + fields[1] + fields[2] + printed[:2].replace(' ', '0') + printed[2:])
            require(sides['1'] == set(event['motherIds']) and sides['2'] == set(event['daughterIds']), f'{slug}: incomplete DFI event group')
        for row in history['parcels']:
            ancestry = row['documentedAncestry']
            require(ancestry['terminals'], f"{slug}: missing tracing stop for {row['parcelId']}")
            for path in ancestry['paths']:
                require(path['referencePath'][0] == row['parcelId'] and len(path['referencePath']) == len(path['eventPath']) + 1,
                        f'{slug}: broken ancestor path')
                for index, event_id in enumerate(path['eventPath']):
                    event = events[event_id]
                    require(path['referencePath'][index] in event['daughterIds'] and path['referencePath'][index + 1] in event['motherIds'],
                            f'{slug}: path not in the complete source group')
            dates = [events[i]['validationDate'] for i in ancestry['supportedEventIds']]
            require(ancestry['earliestValidationDate'] == min(dates, default=None), f'{slug}: unsupported earliest event date')
        rights_config = bundle['parcels']
        member = rights_config['rightsMember']
        if member not in cached_rights:
            raw = pinned(source_dir(bundle), member, rights_config['rightsMemberSha256'])
            rows = csv.reader(io.StringIO(raw.decode('utf-8-sig')), delimiter=';')
            next(rows)
            by_reference = defaultdict(set)
            for row in rows:
                pid = row[0] + row[2] + (row[4].strip() or '000').zfill(3) + row[5].strip().zfill(2) + row[6].strip().zfill(4)
                by_reference[pid].add((row[19].strip(), row[17].strip().split(' - ')[0], row[23].strip()))
            cached_rights[member] = by_reference
        for f in features:
            rights = {(r['holderId'], r['rightCode'], r['name']) for r in f['properties']['recordedRights']}
            require(rights == cached_rights[member].get(f['id'], set()), f"{slug}: holder/right set lost for {f['id']}")
        coverage = register['historyCoverage']
        require(set(coverage['geometry']) == inao_communes, f'{slug}: coverage copied from another commune')
        require(set(coverage['notices']['availabilityAudit']['departments']) == {c[:2] for c in inao_communes}, f'{slug}: wrong notice department')
        require(coverage['sales'] == sales['sourceCoverage'] and coverage['notices'] == notices['coverage'], f'{slug}: evidence coverage drift')
        require(evidence['coverage'][cru['parentFeatureId']] == coverage, f'{slug}: app coverage differs')
        results.append({'cru': slug, 'issue': cru['issue'], 'parentFeatureId': cru['parentFeatureId'],
                        'status': 'passed-with-explicit-source-gaps', 'communes': sorted(inao_communes),
                        'parcels': len(current), 'currentFarmerConfirmed': 0, 'parentSourceSha256ByMap': map_hashes,
                        'rightsImported': coverage['rightsImported'],
                        'earliestReachableDfiValidationDate': coverage['earliestReachableDfiValidationDate'],
                        'latestReachableDfiValidationDate': coverage['latestReachableDfiValidationDate'],
                        'documentedAncestors': coverage['currentParcelsWithDocumentedAncestors'],
                        'pre2019Events': coverage['currentParcelsWithPre2019DfiEvents'],
                        'documents': coverage['distinctDfiDocuments'], 'lots': coverage['distinctDfiAnalysisLots'],
                        'inferredOnlyParcels': coverage['inferredOnlyCurrentParcels'],
                        'traversalIssues': len(coverage['traversalIssues']), 'unresolvedEvents': coverage['unresolvedEvents'],
                        'missingSources': [s['id'] for s in coverage['missingSources']],
                        'geometryObtained': {c: [min(v['obtainedDates']), max(v['obtainedDates']), len(v['obtainedDates'])]
                                             for c, v in coverage['geometry'].items()},
                        'salesObservedCommuneRange': sales['sourceCoverage']['observedCommuneRange'],
                        'noticeMatches': notices['coverage']['reviewedMatches'],
                        'unreviewedNoticeCandidates': notices['coverage']['unreviewedSearchCandidates'],
                        'noticeGaps': {d: a['unsearchedIntervals'] for d, a in notices['coverage']['availabilityAudit']['departments'].items()},
                        'registerSha256': sha256((ROOT / f'docs/research/{slug}/register.json').read_bytes().replace(b'\r\n', b'\n')),
                        'evidenceSha256': sha256(payload), 'evidenceBytes': len(payload),
                        'evidenceGzipBytes': len(gzip.compress(payload, mtime=0)),
                        'earliestRawEventSample': min(events.values(), key=lambda e: (e['validationDate'], e['id'])) if events else None})
    require(len(results) == 33, 'Incomplete 33-cru audit')
    return {'schemaVersion': 1, 'sourceInventory': relative(CONFIG_DIR / 'sources/inventory-2026-10-01.json'),
            'reviewMethod': 'Independent raw-byte size/hash, unmodified current geometry, raw DFI rows, complete current holder/right sets, INAO identity and per-parcel paths/coverage cross-check; does not call builders.',
            'sourceResourcesObtained': sum(s['status'] == 'obtained' for s in inventory['sources']),
            'sourceResourcesMissing': sum(s['status'] != 'obtained' for s in inventory['sources']),
            'crus': 33, 'sharedBundles': len({load_cru(s)[1]['id'] for s in cru_slugs()}),
            'distinctCurrentParcels': len(unique_current), 'currentFarmerConfirmed': 0,
            'evidenceBytesTotal': sum(r['evidenceBytes'] for r in results),
            'evidenceGzipBytesTotal': sum(r['evidenceGzipBytes'] for r in results), 'deliveries': results}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    result = audit()
    path = REPORT_DIR / 'history-rollout-audit.json'
    write_or_check(path, json.dumps(result, ensure_ascii=False, indent=2) + '\n', args.check)
    lines = ['# Grand Cru history audit (#461)', '', result['reviewMethod'], '',
             f"33 crus / {result['sharedBundles']} bundles / {result['distinctCurrentParcels']} distinct current parcels. "
             f"{result['sourceResourcesObtained']} source resources obtained; {result['sourceResourcesMissing']} failed bulletin downloads. "
             'Current farmers confirmed: 0.', '',
             'Notice availability and search gaps remain explicit, especially all Yonne departmental years. '
             'This audit does not imply complete notice coverage, named-area crosswalks, producer investigations or original ownership.', '',
             f"Lazy evidence total: {result['evidenceBytesTotal']} bytes raw / {result['evidenceGzipBytesTotal']} bytes gzip. "
             'Each cru loads its own chunk on demand. Full per-cru metadata, source samples and payload sizes are in [the JSON audit](history-rollout-audit.json).', '',
             '| Cru | Parcels | DFI validation range | Ancestors / pre-2019 | Documents / lots | Inferred only | Notice matches / candidates | Evidence gzip bytes |',
             '| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |']
    for r in result['deliveries']:
        lines.append(f"| [{r['cru']}](../../../docs/research/{r['cru']}/register.md) | {r['parcels']} | "
                     f"{r['earliestReachableDfiValidationDate'] or 'none matched'} → {r['latestReachableDfiValidationDate'] or 'none matched'} | "
                     f"{r['documentedAncestors']} / {r['pre2019Events']} | {r['documents']} / {r['lots']} | {r['inferredOnlyParcels']} | "
                     f"{r['noticeMatches']} / {r['unreviewedNoticeCandidates']} | {r['evidenceGzipBytes']} |")
    write_or_check(path.with_suffix('.md'), '\n'.join(lines) + '\n', args.check)
    print(json.dumps({k: v for k, v in result.items() if k != 'deliveries'}))


if __name__ == '__main__':
    main()
