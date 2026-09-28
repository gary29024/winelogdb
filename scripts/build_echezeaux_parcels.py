"""Reproducible cadastral parcel / historical legal-entity-rights pilot.

Use the pinned GIS requirements and --source-dir containing the inputs named
in scripts/echezeaux-parcels.json. Geometry is never clipped or simplified;
the INAO intersection is a separate area measurement, not parcel ownership.
"""
import argparse
import csv
import gzip
import hashlib
import io
import json
import re
import zlib
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import shape
from shapely.ops import transform

from build_burgundy_village_map import ROOT, read_json, write_json


def parcel_id(row):
    department, direction, commune = row[:3]
    assert department == '21' and direction == '0' and commune == '267'
    prefix, section, number = row[4].strip() or '000', row[5].strip(), row[6].strip()
    assert prefix.isdigit() and len(prefix) <= 3 and re.fullmatch('[A-Z0-9]{1,2}', section)
    assert number.isdigit() and len(number) <= 4
    return department + commune + prefix.zfill(3) + section.zfill(2) + number.zfill(4)


def add_right(props, row):
    """Deduplicate fiscal subdivisions, never distinct holders or right types."""
    code, label = row[17].strip().split(' - ', 1)
    assert len(code) == 1 and code in 'PUNBRFTDVWAEKLGSHOJQXYCMZ'
    holder_id = row[19].strip()
    assert re.fullmatch(r'(?:\d{9}|U\d{8})', holder_id), 'Review missing/unrecognised legal-entity identifier'
    right = {'holderId': holder_id, 'siren': holder_id if holder_id.isdigit() else None,
             'name': row[23].strip(), 'rightCode': code, 'rightLabel': label.strip(),
             'legalForm': row[21].strip(), 'legalFormLabel': row[22].strip()}
    assert right['name']
    if right not in props['recordedRights']:
        props['recordedRights'].append(right)
    record_area = int(row[13])
    if record_area not in props['recordAreasM2']:
        props['recordAreasM2'].append(record_area)


def record_match(props):
    if not props['recordedRights']:
        return 'unknown'
    return 'reference-and-area' if sorted(props['recordAreasM2']) == [props['cadastreAreaM2']] else 'area-mismatch'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, required=True)
    args = parser.parse_args()
    config = read_json(ROOT / 'scripts/echezeaux-parcels.json')
    def source(name, digest):
        data = (args.source_dir / name).read_bytes()
        assert hashlib.sha256(data).hexdigest() == digest, f'Review changed input: {name}'
        return data
    cadastre = source('parcelles-21267.json.gz', config['cadastreSha256'])
    rights = source(config['rightsMember'], config['rightsMemberSha256'])
    assert zlib.crc32(rights) == config['rightsMemberCrc32']
    source('dgfip-2025-description.odt', config['schemaSha256'])
    parcels = json.loads(gzip.decompress(cadastre))['features']
    current_ids = {p['properties']['id'] for p in parcels}
    catalogue = read_json(ROOT / 'src/lib/places/vosneVillageMapCatalogue.json')
    canonical = (ROOT / ('public' + catalogue['dataUrl'])).read_text(encoding='utf8').replace('\r\n', '\n').encode()
    expected = next(m for m in read_json(ROOT / 'scripts/burgundy-lossless-map-report.json')['maps'] if m['id'] == 'vosne-romanee')['sourceSha256']
    assert hashlib.sha256(canonical).hexdigest() == expected
    parents = {f['id']: f for f in json.loads(canonical)['features'] if f['id'] in config['parentFeatureIds']}
    assert set(parents) == set(config['parentFeatureIds'])
    project = Transformer.from_crs(4326, 2154, always_xy=True).transform
    projected = {id: transform(project, shape(f['geometry'])) for id, f in parents.items()}
    selected, contacts = {}, []
    for f in parcels:
        props = f['properties']
        assert props['commune'] == config['commune']
        geometry = shape(f['geometry'])
        assert geometry.is_valid
        metric = transform(project, geometry)
        overlaps = []
        for parent_id, parent in projected.items():
            overlap = metric.intersection(parent).area
            if overlap > config['minimumOverlapM2']:
                overlaps.append({'parentFeatureId': parent_id, 'name': parents[parent_id]['properties']['name'],
                                 'areaM2': round(overlap, 4), 'parcelPercent': round(100 * overlap / metric.area, 4)})
            elif overlap > 0:
                contacts.append({'parcelId': props['id'], 'parentFeatureId': parent_id, 'overlapM2': overlap})
        if not overlaps:
            continue
        assert props['id'] not in selected
        point = geometry.representative_point()
        selected[props['id']] = {'type': 'Feature', 'id': props['id'], 'geometry': f['geometry'], 'properties': {
            'id': props['id'], 'reference': f"{props['section']} {str(props['numero']).zfill(4)}", 'commune': config['commune'],
            'cadastreAreaM2': props['contenance'], 'geometryAreaM2': round(metric.area, 4),
            'bounds': list(geometry.bounds), 'labelPoint': [point.x, point.y], 'overlaps': overlaps,
            'recordedRights': [], 'domaineLinks': [], 'recordMatch': 'unknown', 'recordAreasM2': [],
        }}
    rows = csv.reader(io.StringIO(rights.decode('utf-8-sig')), delimiter=';')
    header = next(rows)
    assert len(header) == 24 and header[17:20] == ['Code droit - par', 'N° Majic - par', 'N° SIREN - par'] and header[23] == 'Dénomination - par'
    unmatched_refs, matched_rows = set(), 0
    for row in rows:
        assert len(row) == len(header), 'Review changed 2025 schema'
        if row[0] != '21' or row[2] != '267':
            continue
        id = parcel_id(row)
        if id not in selected:
            # Retain only missing geometry references for the commune; normal
            # parcels elsewhere in Flagey are not failed pilot joins.
            if id not in current_ids:
                unmatched_refs.add(id)
            continue
        matched_rows += 1
        props = selected[id]['properties']
        add_right(props, row)
    for feature in selected.values():
        p = feature['properties']
        p['recordedRights'].sort(key=lambda r: (r['holderId'], r['rightCode']))
        p['recordAreasM2'].sort()
        p['recordMatch'] = record_match(p)
        # No legal-name heuristic is allowed to create a farming relationship.
        # producerNames are reviewed spellings of a wine's producer field; the
        # UI joins on them because producer records are per-user.
        p['domaineLinks'] = [link for link in config['domaineLinks'] if p['id'] in link['parcelIds']]
        for link in p['domaineLinks']:
            assert link['status'] in ('verified', 'proposed') and link['evidence'] and link['effectiveDate']
            assert link['producerNames'] and all(isinstance(name, str) and name.strip() for name in link['producerNames'])
            if link['status'] == 'verified':
                assert link['producerId'] and link['role'] == 'operator' and p['recordMatch'] != 'area-mismatch'
    result = {'type': 'FeatureCollection', 'features': [selected[id] for id in sorted(selected)]}
    payload = (json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
    digest = hashlib.sha256(payload).hexdigest()
    data_url = f'/maps/echezeaux-parcels.{config["cadastreDate"]}.{digest[:12]}.geojson'
    (ROOT / ('public' + data_url)).write_bytes(payload)
    counts = {'parcels': len(selected), 'withRecordedRights': sum(bool(f['properties']['recordedRights']) for f in selected.values()),
              'rightRecords': sum(len(f['properties']['recordedRights']) for f in selected.values()),
              'unknownRights': sum(not f['properties']['recordedRights'] for f in selected.values()),
              'areaMismatches': sum(f['properties']['recordMatch'] == 'area-mismatch' for f in selected.values()),
              'multipleRights': sum(len(f['properties']['recordedRights']) > 1 for f in selected.values()),
              'verifiedDomaineLinks': sum(l['status'] == 'verified' for f in selected.values() for l in f['properties']['domaineLinks']),
              'proposedDomaineLinks': sum(l['status'] == 'proposed' for f in selected.values() for l in f['properties']['domaineLinks'])}
    manifest = {'dataUrl': data_url, 'sha256': digest, 'cadastreDate': config['cadastreDate'], 'rightsAsOf': config['rightsAsOf'],
                'sourceUrl': config['cadastreUrl'], 'rightsUrl': config['rightsUrl'], 'schemaUrl': config['schemaUrl'],
                'parentFeatureIds': config['parentFeatureIds'], 'minimumOverlapM2': config['minimumOverlapM2'], 'counts': counts}
    write_json(ROOT / 'src/lib/places/echezeauxParcelManifest.json', manifest)
    report = {'sources': config, 'parentSourceSha256': expected, **manifest, 'bytes': len(payload),
              'gzipEquivalentBytes': len(gzip.compress(payload, mtime=0)), 'matchedFiscalRows': matched_rows,
              'excludedBoundaryContacts': contacts, 'communeRecordsWithoutCurrentGeometry': sorted(unmatched_refs),
              'byCru': {id: {'parcels': sum(any(o['parentFeatureId'] == id for o in f['properties']['overlaps']) for f in selected.values()),
                             'areaHa': sum(o['areaM2'] for f in selected.values() for o in f['properties']['overlaps'] if o['parentFeatureId'] == id) / 10000}
                        for id in parents}}
    write_json(ROOT / 'scripts/echezeaux-parcel-report.json', report)
    print(json.dumps({'counts': counts, 'bytes': len(payload), 'gzipEquivalentBytes': report['gzipEquivalentBytes'], 'byCru': report['byCru']}))


if __name__ == '__main__':
    main()
