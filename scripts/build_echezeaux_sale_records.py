"""Dated sale and exchange deeds for mapped Échezeaux parcels, from open DVF files.

DVF lists every registered transfer for a fee since 2021 (five rolling years), by
parcel, with no party names. It tells when a parcel changed hands and which parcels
went in the same deed; it never names a buyer, seller or farmer. Prices and
addresses are dropped so the output cannot help re-identify private parties.

  python scripts/build_echezeaux_sale_records.py --source-dir .tmp/echezeaux-dvf --download
  python scripts/build_echezeaux_sale_records.py --source-dir .tmp/echezeaux-dvf --check

Only the standard library is required.
"""
import argparse
import csv
import hashlib
import io
import json
import urllib.request
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


def source_path(source_dir, year):
    return source_dir / f'dvf-{year}-21267.csv'


def download(config, source_dir):
    source_dir.mkdir(parents=True, exist_ok=True)
    for entry in config['years']:
        url = config['urlTemplate'].format(year=entry['year'])
        with urllib.request.urlopen(url, timeout=120) as response:
            data = response.read()
        require(hashlib.sha256(data).hexdigest() == entry['sha256'], f'DVF file changed: {url}')
        source_path(source_dir, entry['year']).write_bytes(data)


def mapped_parcels(manifest):
    asset = (ROOT / 'public' / manifest['dataUrl'].lstrip('/')).read_bytes().replace(b'\r\n', b'\n')
    require(hashlib.sha256(asset).hexdigest() == manifest['sha256'], 'Parcel snapshot hash changed')
    return {f['properties']['id'] for f in json.loads(asset)['features']
            if any(o['parentFeatureId'] == PARENT for o in f['properties']['overlaps'])}


def build(config, manifest, source_dir):
    ids = mapped_parcels(manifest)
    rows, inputs = [], []
    for entry in config['years']:
        data = source_path(source_dir, entry['year']).read_bytes()
        require(hashlib.sha256(data).hexdigest() == entry['sha256'], f"DVF {entry['year']} hash mismatch")
        inputs.append({'year': entry['year'], 'url': config['urlTemplate'].format(year=entry['year']),
                       'sha256': entry['sha256']})
        rows += list(csv.DictReader(io.StringIO(data.decode('utf-8'))))
    deeds = {}
    for r in rows:
        require(r['code_commune'] == config['commune'], 'Row from another commune')
        deed = deeds.setdefault(r['id_mutation'], {'deedId': r['id_mutation'], 'date': r['date_mutation'],
                                                   'nature': NATURES.get(r['nature_mutation'], 'other'),
                                                   'dispositions': {}})
        require(deed['date'] == r['date_mutation'], f"Deed with two dates: {r['id_mutation']}")
        parcel = r['id_parcelle']
        # A row per local or culture repeats the parcel; keep the reference once per disposition.
        parcels = deed['dispositions'].setdefault(r['numero_disposition'], [])
        if parcel not in parcels:
            parcels.append(parcel)
    kept = []
    for deed in deeds.values():
        all_parcels = {p for ps in deed['dispositions'].values() for p in ps}
        if not all_parcels & ids:
            continue
        dispositions = []
        for number, parcels in sorted(deed['dispositions'].items()):
            inside = sorted(p for p in parcels if p in ids)
            dispositions.append({'number': number, 'parcelIds': inside, 'otherParcels': len(parcels) - len(inside)})
        kept.append({'deedId': deed['deedId'], 'date': deed['date'], 'nature': deed['nature'], 'dispositions': dispositions})
    kept.sort(key=lambda d: (d['date'], d['deedId']))
    touched = {p for d in kept for x in d['dispositions'] for p in x['parcelIds']}
    return {
        'schemaVersion': 1, 'dataset': config['dataset'], 'licence': config['licence'], 'release': config['release'],
        'parentFeatureId': PARENT,
        'coverage': f"{min(d['date'] for d in kept)} to {max(d['date'] for d in kept)}",
        'inputs': {'parcelSnapshotSha256': manifest['sha256'], 'dvf': inputs},
        'note': 'A deed dates a transfer and groups parcels; it names no party and never establishes farming.',
        'counts': {'deeds': len(kept), 'parcels': len(touched)},
        'deeds': kept,
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
