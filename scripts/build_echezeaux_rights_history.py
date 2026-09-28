"""Dated legal-entity rights and cadastral lineage for every mapped Échezeaux parcel.

Compares the pinned 2025 pilot snapshot with the DGFiP legal-entity parcel files
for 1 January 2019-2024 and Etalab cadastre vintages for 2019-2025. The output is
research evidence of recorded rights and parcel splits; it never names a farmer.

  python scripts/build_echezeaux_rights_history.py --source-dir .tmp/echezeaux-sources --download
  python scripts/build_echezeaux_rights_history.py --source-dir .tmp/echezeaux-sources --check

--download fetches only the pinned inputs (one ZIP member per year, by HTTP range)
and verifies each hash. Requires scripts/burgundy-map-requirements.txt.
"""
import argparse
import csv
import gzip
import hashlib
import io
import json
import struct
import urllib.request
import zlib
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import shape
from shapely.ops import transform

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / 'scripts/echezeaux-rights-history.json'
PARCELS_CONFIG = ROOT / 'scripts/echezeaux-parcels.json'
MANIFEST = ROOT / 'src/lib/places/echezeauxParcelManifest.json'
OUTPUT = ROOT / 'docs/research/echezeaux-rights-history.json'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def fetch(url, byte_range=None):
    headers = {'Accept-Encoding': 'identity'}
    if byte_range:
        headers['Range'] = byte_range
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=300) as response:
        require(not byte_range or response.status == 206, f'Range request not honoured: {url}')
        return response.read()


def zip_member(url, member):
    """Read one deflated member of a remote ZIP (including ZIP64 directories)."""
    tail = fetch(url, 'bytes=-65557')
    end = tail.rfind(b'PK\x05\x06')
    require(end >= 0, 'ZIP end record missing')
    size, offset = struct.unpack('<II', tail[end + 12:end + 20])
    if offset == 0xFFFFFFFF:
        z64 = tail.rfind(b'PK\x06\x06')
        size, offset = struct.unpack('<QQ', tail[z64 + 40:z64 + 56])
    directory, found, p = fetch(url, f'bytes={offset}-{offset + size - 1}'), [], 0
    while p < len(directory):
        require(directory[p:p + 4] == b'PK\x01\x02', 'Invalid central directory')
        method, = struct.unpack('<H', directory[p + 10:p + 12])
        crc, compressed, uncompressed = struct.unpack('<III', directory[p + 16:p + 28])
        name_len, extra_len, comment_len = struct.unpack('<HHH', directory[p + 28:p + 34])
        local, = struct.unpack('<I', directory[p + 42:p + 46])
        name = directory[p + 46:p + 46 + name_len].decode('cp437')
        extra, q = directory[p + 46 + name_len:p + 46 + name_len + extra_len], 0
        while q < len(extra):
            tag, length = struct.unpack('<HH', extra[q:q + 4])
            if tag == 1:  # ZIP64: 8-byte values replace, in order, each saturated 4-byte field.
                values = iter(struct.unpack(f'<{length // 8}Q', extra[q + 4:q + 4 + length // 8 * 8]))
                uncompressed = next(values) if uncompressed == 0xFFFFFFFF else uncompressed
                compressed = next(values) if compressed == 0xFFFFFFFF else compressed
                local = next(values) if local == 0xFFFFFFFF else local
            q += 4 + length
        if name.split('/')[-1] == member:
            found.append((method, crc, compressed, uncompressed, local))
        p += 46 + name_len + extra_len + comment_len
    require(len(found) == 1, f'Missing or ambiguous ZIP member: {member}')
    method, crc, compressed, uncompressed, local = found[0]
    require(method == 8, 'Unexpected ZIP compression')
    header = fetch(url, f'bytes={local}-{local + 29}')
    require(header[:4] == b'PK\x03\x04', 'Invalid local header')
    start = local + 30 + sum(struct.unpack('<HH', header[26:30]))
    data = zlib.decompress(fetch(url, f'bytes={start}-{start + compressed - 1}'), -15)
    require(len(data) == uncompressed and zlib.crc32(data) == crc, f'ZIP member check failed: {member}')
    return data


def download(config, parcels_config, source_dir):
    source_dir.mkdir(parents=True, exist_ok=True)
    wanted = [(r['member'], r['sha256'], lambda r=r: zip_member(r['url'], r['member'])) for r in config['rights']]
    wanted.append((parcels_config['rightsMember'], parcels_config['rightsMemberSha256'],
                   lambda: zip_member(parcels_config['rightsUrl'], parcels_config['rightsMember'])))
    wanted += [(c['file'], c['sha256'], lambda c=c: fetch(c['url'])) for c in config['cadastre']]
    wanted.append(('parcelles-21267.json.gz', parcels_config['cadastreSha256'], lambda: fetch(parcels_config['cadastreUrl'])))
    for name, digest, get in wanted:
        path = source_dir / name
        if path.exists() and hashlib.sha256(path.read_bytes()).hexdigest() == digest:
            continue
        data = get()
        require(hashlib.sha256(data).hexdigest() == digest, f'Changed source; review before updating hash: {name}')
        path.write_bytes(data)
        print(f'{name}: {len(data)} bytes, SHA-256 verified')


def parcel_id(row):
    prefix, section, number = (row[4].strip() or '000').zfill(3), row[5].strip().zfill(2), row[6].strip().zfill(4)
    return '21267' + prefix + section + number


def read_rights(data, encoding, commune):
    rows = csv.reader(io.StringIO(data.decode(encoding)), delimiter=';')
    header = next(rows)
    require(len(header) == 24 and 'SIREN' in header[19] and 'nomination' in header[23], 'Review changed rights schema')
    result = {}
    for row in rows:
        require(len(row) == 24, 'Review changed rights row')
        if row[0] != '21' or row[2] != commune:
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


def build(config, manifest, source_dir):
    def source(name, digest):
        data = (source_dir / name).read_bytes()
        require(hashlib.sha256(data).hexdigest() == digest, f'Review changed input: {name}')
        return data

    parcels_config = json.loads(PARCELS_CONFIG.read_text(encoding='utf-8'))
    parent = config['parentFeatureId']
    asset = (ROOT / 'public' / manifest['dataUrl'].lstrip('/')).read_bytes().replace(b'\r\n', b'\n')
    require(hashlib.sha256(asset).hexdigest() == manifest['sha256'], 'Parcel snapshot hash changed')
    current = {f['id']: f for f in json.loads(asset)['features']
               if any(o['parentFeatureId'] == parent for o in f['properties']['overlaps'])}
    project = Transformer.from_crs(4326, 2154, always_xy=True).transform
    metric = {i: transform(project, shape(f['geometry'])) for i, f in current.items()}
    catalogue = json.loads((ROOT / 'src/lib/places/vosneVillageMapCatalogue.json').read_text(encoding='utf-8'))
    cru = next(f for f in json.loads((ROOT / 'public' / catalogue['dataUrl'].lstrip('/')).read_text(encoding='utf-8'))['features']
               if f['id'] == parent)
    cru = transform(project, shape(cru['geometry']))

    snapshots = [(r['asOf'], read_rights(source(r['member'], r['sha256']), r['encoding'], config['commune']))
                 for r in config['rights']]
    snapshots.append((config['currentRights']['asOf'], read_rights(
        source(parcels_config['rightsMember'], parcels_config['rightsMemberSha256']), 'utf-8-sig', config['commune'])))
    vintages = []
    for c in config['cadastre']:
        features = json.loads(gzip.decompress(source(c['file'], c['sha256'])))['features']
        vintages.append((c['date'], {f['properties']['id']: transform(project, shape(f['geometry'])) for f in features}))
    vintages.append((parcels_config['cadastreDate'], metric))

    predecessors, retired = {}, {}
    for date, geometries in vintages[:-1]:
        for pid, geometry in geometries.items():
            if pid in current:
                continue
            geometry = geometry if geometry.is_valid else geometry.buffer(0)
            if geometry.intersection(cru).area <= config['minimumOverlapM2']:
                continue
            entry = retired.setdefault(pid, {'parcelId': pid, 'reference': f'{pid[8:10].lstrip("0")} {pid[10:]}',
                                             'lastSeenCadastre': date, 'cruOverlapM2': 0, 'successors': {}})
            entry['lastSeenCadastre'] = date
            entry['cruOverlapM2'] = round(geometry.intersection(cru).area, 1)
            for cid, cg in metric.items():
                shared = geometry.intersection(cg).area
                if shared > config['minimumOverlapM2']:
                    entry['successors'][cid] = round(shared, 1)
                    predecessors.setdefault(cid, set()).add(pid)
    for entry in retired.values():
        entry['successors'] = [{'parcelId': k, 'sharedAreaM2': v} for k, v in sorted(entry['successors'].items())]
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
    return {
        'schemaVersion': 1, 'purpose': config['purpose'], 'parentFeatureId': parent,
        'inputs': {'parcelSnapshotSha256': manifest['sha256'],
                   'rights': [{'asOf': r['asOf'], 'url': r['url'], 'member': r['member'], 'sha256': r['sha256']}
                              for r in config['rights']] +
                             [{'asOf': config['currentRights']['asOf'], 'url': parcels_config['rightsUrl'],
                               'member': parcels_config['rightsMember'], 'sha256': parcels_config['rightsMemberSha256']}],
                   'cadastre': [{'date': c['date'], 'url': c['url'], 'sha256': c['sha256']} for c in config['cadastre']] +
                               [{'date': parcels_config['cadastreDate'], 'url': parcels_config['cadastreUrl'],
                                 'sha256': parcels_config['cadastreSha256']}]},
        'rules': ['A recorded right is legal-entity ownership or another real right on 1 January, never farming.',
                  'Private individuals are not in the legal-entity files: no record does not mean no owner.',
                  'Holder continuity is proved only by the same SIREN; names alone are hints for review.',
                  'Lineage is a spatial overlap between cadastre vintages, not a documented division act.'],
        'counts': {'parcels': len(rows), 'withAnyRightsChange': sum(bool(r['rightsChanges']) for r in rows),
                   'createdSinceFirstVintage': sum(r['firstSeenCadastre'] != vintages[0][0] for r in rows),
                   'withPredecessor': sum(bool(r['predecessorIds']) for r in rows),
                   'retiredReferences': len(retired), 'changeKinds': dict(sorted(kinds.items()))},
        'retiredParcels': [retired[k] for k in sorted(retired)],
        'parcels': rows,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--source-dir', type=Path, required=True)
    parser.add_argument('--download', action='store_true')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    config = json.loads(CONFIG.read_text(encoding='utf-8'))
    if args.download:
        download(config, json.loads(PARCELS_CONFIG.read_text(encoding='utf-8')), args.source_dir)
    result = build(config, json.loads(MANIFEST.read_text(encoding='utf-8')), args.source_dir)
    content = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
    if args.check:
        require(OUTPUT.exists() and OUTPUT.read_text(encoding='utf-8') == content, f'Stale output: {OUTPUT}')
    else:
        OUTPUT.write_text(content, encoding='utf-8', newline='\n')
    print(json.dumps(result['counts']))


if __name__ == '__main__':
    main()
