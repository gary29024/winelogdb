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

from pyproj import Transformer
from shapely.geometry import shape
from shapely.ops import transform

from grand_cru import (cadastre_sources, communes, in_cru, load_cru, load_manifest, parcel_asset, parcels_file, pinned,
                       require, research_path, source_dir, vintage_file, village_map, write_or_check)


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
    return bool(value) and value.isdigit()


def classify(before, after, existed_before):
    """Describe a change between consecutive snapshots without inferring identity from names."""
    if not before:
        return 'record-appeared' if existed_before else 'new-parcel-reference'
    if not after:
        return 'record-disappeared'
    before_ids, after_ids = {holder_key(r) for r in before}, {holder_key(r) for r in after}
    if before_ids == after_ids:
        return 'same-holder-renamed' if {r['name'] for r in before} != {r['name'] for r in after} else 'right-type-changed'
    if not any(is_siren(r['siren']) for r in before):
        # Without a SIREN on the earlier record, identity continuity cannot be proved or excluded.
        return 'unprovable-identifier-change'
    return 'holder-changed'


def build(cru, bundle, manifest, directory):
    config, parcels_config = bundle['rightsHistory'], bundle['parcels']
    parent = cru['parentFeatureId']
    allowed = communes(bundle)
    current = {f['id']: f for f in json.loads(parcel_asset(manifest))['features'] if in_cru(f, parent)}
    project = Transformer.from_crs(4326, 2154, always_xy=True).transform
    metric = {i: transform(project, shape(f['geometry'])) for i, f in current.items()}
    _, canonical, _ = village_map(bundle)
    cru_shape = transform(project, shape(next(f for f in json.loads(canonical)['features'] if f['id'] == parent)['geometry']))

    snapshots = [(r['asOf'], read_rights(pinned(directory, r['member'], r['sha256']), r['encoding'], allowed))
                 for r in config['rights']]
    snapshots.append((parcels_config['rightsAsOf'], read_rights(
        pinned(directory, parcels_config['rightsMember'], parcels_config['rightsMemberSha256']), 'utf-8-sig', allowed)))
    by_date = {}
    for c in config['cadastre']:
        insee = c.get('commune', parcels_config['commune'])
        features = json.loads(gzip.decompress(pinned(directory, vintage_file(insee, c['date']), c['sha256'])))['features']
        by_date.setdefault(c['date'], {}).update({f['properties']['id']: transform(project, shape(f['geometry'])) for f in features})
    vintages = sorted(by_date.items())
    for insee, _, digest in cadastre_sources(bundle):
        pinned(directory, parcels_file(insee), digest)
    vintages.append((parcels_config['cadastreDate'], metric))

    # Spatial overlaps are only candidates. A split is accepted when the successor first appears in the vintage
    # right after the retired reference disappears and lies almost entirely inside it; boundary slivers and
    # neighbours that already existed are kept as rejected candidates and never carry evidence.
    dates = [d for d, _ in vintages]
    first_seen = {cid: next(d for d, g in vintages if cid in g) for cid in metric}
    predecessors, retired = {}, {}
    for date, geometries in vintages[:-1]:
        for pid, geometry in geometries.items():
            if pid in current:
                continue
            geometry = geometry if geometry.is_valid else geometry.buffer(0)
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
        date, geometries = next(v for v in vintages if v[0] >= as_of)
        return pid in geometries

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
    return {
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
                   'createdSinceFirstVintage': sum(r['firstSeenCadastre'] != vintages[0][0] for r in rows),
                   'withPredecessor': sum(bool(r['predecessorIds']) for r in rows),
                   'retiredReferences': len(retired), 'changeKinds': dict(sorted(kinds.items()))},
        'retiredParcels': [retired[k] for k in sorted(retired)],
        'parcels': rows,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--cru', required=True)
    parser.add_argument('--source-dir')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    cru, bundle = load_cru(args.cru)
    require('rightsHistoryPurpose' in cru and 'rightsHistory' in bundle, f'{cru["slug"]}: rights history not configured yet')
    result = build(cru, bundle, load_manifest(bundle), source_dir(bundle, args.source_dir))
    write_or_check(research_path(cru, 'rights-history.json'), json.dumps(result, ensure_ascii=False, indent=1) + '\n', args.check)
    print(json.dumps(result['counts']))


if __name__ == '__main__':
    main()
