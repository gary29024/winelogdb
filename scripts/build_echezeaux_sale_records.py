"""Dated sale and exchange deeds for mapped Échezeaux parcels, from open DVF+ data.

Cerema's DVF+ open-data (release April 2026) restructures the DGFiP DVF files by
deed and keeps every year since 2014, where the data.gouv.fr files keep only the last
five. A deed tells when a parcel changed hands and which parcels went with it; it
never names a buyer, seller or farmer. Prices and addresses are dropped so the output
cannot help re-identify private parties.

  python scripts/build_echezeaux_sale_records.py --source-dir .tmp/echezeaux-dvf --download
  python scripts/build_echezeaux_sale_records.py --source-dir .tmp/echezeaux-dvf --check

Only the standard library is required. The regional archive is about 73 MB.
"""
import argparse
import csv
import hashlib
import io
import json
import sys
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / 'scripts/echezeaux-sale-records.json'
MANIFEST = ROOT / 'src/lib/places/echezeauxParcelManifest.json'
OUTPUT = ROOT / 'docs/research/echezeaux-sale-records.json'
PARENT = 'inao-denom-565'
NATURES = {'Vente': 'sale', 'Echange': 'exchange', 'Adjudication': 'auction'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def download(config, source_dir):
    source_dir.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(config['url'], timeout=900) as response:
        data = response.read()
    require(hashlib.sha256(data).hexdigest() == config['sha256'], 'DVF+ archive changed')
    (source_dir / config['fileName']).write_bytes(data)


def mapped_parcels(manifest):
    asset = (ROOT / 'public' / manifest['dataUrl'].lstrip('/')).read_bytes().replace(b'\r\n', b'\n')
    require(hashlib.sha256(asset).hexdigest() == manifest['sha256'], 'Parcel snapshot hash changed')
    return {f['properties']['id'] for f in json.loads(asset)['features']
            if any(o['parentFeatureId'] == PARENT for o in f['properties']['overlaps'])}


def parcel_list(value):
    return [p.strip() for p in value.strip('{}').split(',') if p.strip()]


def build(config, manifest, source_dir):
    ids = mapped_parcels(manifest)
    data = (source_dir / config['fileName']).read_bytes()
    require(hashlib.sha256(data).hexdigest() == config['sha256'], 'DVF+ archive hash mismatch')
    csv.field_size_limit(sys.maxsize)  # a few deeds list thousands of parcels
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        rows = list(csv.DictReader(io.TextIOWrapper(archive.open(config['member']), encoding='utf-8'), delimiter='|'))
    deeds, seen = [], set()
    for r in rows:
        if config['commune'] not in parcel_list(r['l_codinsee']):
            continue
        parcels = parcel_list(r['l_idpar'])
        inside = sorted(set(parcels) & ids)
        if not inside:
            continue
        require(r['idmutinvar'] not in seen, f"Duplicate deed {r['idmutinvar']}")
        seen.add(r['idmutinvar'])
        # DVF+ merges a deed's dispositions; parcels share one price and direction only when there is one.
        deeds.append({'deedId': r['idmutinvar'], 'date': r['datemut'], 'nature': NATURES.get(r['libnatmut'], 'other'),
                      'dispositions': int(r['nbdispo']), 'parcelIds': inside, 'otherParcels': len(set(parcels)) - len(inside)})
    deeds.sort(key=lambda d: (d['date'], d['deedId']))
    commune_dates = [r['datemut'] for r in rows if config['commune'] in parcel_list(r['l_codinsee'])]
    return {
        'schemaVersion': 2, 'dataset': config['dataset'], 'licence': config['licence'], 'release': config['release'],
        'parentFeatureId': PARENT,
        'coverage': f'{min(commune_dates)} to {max(commune_dates)}',
        'inputs': {'parcelSnapshotSha256': manifest['sha256'], 'dvfPlus': {k: config[k] for k in ('url', 'fileName', 'sha256')}},
        'note': ('A deed dates a transfer and groups parcels; it names no party and never establishes farming. '
                 'Parcel references are those printed at the deed date.'),
        'counts': {'deeds': len(deeds), 'parcels': len({p for d in deeds for p in d['parcelIds']})},
        'deeds': deeds,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--source-dir', type=Path, required=True)
    parser.add_argument('--download', action='store_true')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    config = json.loads(CONFIG.read_text(encoding='utf-8'))
    if args.download:
        download(config, args.source_dir)
    result = build(config, json.loads(MANIFEST.read_text(encoding='utf-8')), args.source_dir)
    content = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
    if args.check:
        require(OUTPUT.exists() and OUTPUT.read_text(encoding='utf-8') == content, f'Stale output: {OUTPUT}')
    else:
        OUTPUT.write_text(content, encoding='utf-8', newline='\n')
    print(json.dumps(result['counts']))


if __name__ == '__main__':
    main()
