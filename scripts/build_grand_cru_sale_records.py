"""Dated sale and exchange deeds for a cru's mapped parcels, from open DVF+ data.

Cerema's DVF+ open-data restructures the DGFiP DVF files by deed and keeps every year
since 2014, where the data.gouv.fr files keep only the last five. A deed tells when a
parcel changed hands and which parcels went with it; it never names a buyer, seller or
farmer. Prices and addresses are dropped so the output cannot help re-identify private parties.

  python scripts/build_grand_cru_sale_records.py --cru echezeaux
  python scripts/build_grand_cru_sale_records.py --cru echezeaux --check

The regional archive is pinned in the commune bundle and fetched once by
download_grand_cru_sources.py. Only the standard library is required.
"""
import argparse
import csv
import io
import json
import sys
import zipfile

from grand_cru import (communes, in_cru, load_cru, load_manifest, parcel_asset, pinned, require, research_path,
                       source_dir, write_or_check)

NATURES = {'Vente': 'sale', 'Echange': 'exchange', 'Adjudication': 'auction'}


def parcel_list(value):
    return [p.strip() for p in value.strip('{}').split(',') if p.strip()]


def build(cru, bundle, manifest, directory):
    config, parent = bundle['saleRecords'], cru['parentFeatureId']
    ids = {f['properties']['id'] for f in json.loads(parcel_asset(manifest))['features'] if in_cru(f, parent)}
    allowed = set(communes(bundle))
    data = pinned(directory, config['fileName'], config['sha256'])
    # Python <3.13 uses a 32-bit C long on Windows; large deed lists still fit this portable limit.
    csv.field_size_limit(min(sys.maxsize, 2**31 - 1))
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        rows = list(csv.DictReader(io.TextIOWrapper(archive.open(config['member']), encoding='utf-8'), delimiter='|'))
    deeds, seen = [], set()
    for r in rows:
        if not allowed & set(parcel_list(r['l_codinsee'])):
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
    commune_dates = [r['datemut'] for r in rows if allowed & set(parcel_list(r['l_codinsee']))]
    return {
        'schemaVersion': 2, 'dataset': config['dataset'], 'licence': config['licence'], 'release': config['release'],
        'parentFeatureId': parent,
        'coverage': f'{min(commune_dates)} to {max(commune_dates)}',
        'inputs': {'parcelSnapshotSha256': manifest['sha256'], 'dvfPlus': {k: config[k] for k in ('url', 'fileName', 'sha256')}},
        'note': ('A deed dates a transfer and groups parcels; it names no party and never establishes farming. '
                 'Parcel references are those printed at the deed date.'),
        'counts': {'deeds': len(deeds), 'parcels': len({p for d in deeds for p in d['parcelIds']})},
        'deeds': deeds,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--cru', required=True)
    parser.add_argument('--source-dir')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    cru, bundle = load_cru(args.cru)
    require('saleRecords' in bundle, f'{bundle["id"]}: DVF+ archive not pinned yet')
    result = build(cru, bundle, load_manifest(bundle), source_dir(bundle, args.source_dir))
    write_or_check(research_path(cru, 'sale-records.json'), json.dumps(result, ensure_ascii=False, indent=1) + '\n', args.check)
    print(json.dumps(result['counts']))


if __name__ == '__main__':
    main()
