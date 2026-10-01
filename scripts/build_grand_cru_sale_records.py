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
from functools import lru_cache

from grand_cru import (SOURCE_ROOT, in_cru, load_cru, load_manifest, official_inventory, official_sources, parcel_asset, pinned, require, research_path,
                       read_json, source_dir, write_or_check)
from grand_cru_filiation import historical_evidence_paths

NATURES = {'Vente': 'sale', 'Echange': 'exchange', 'Adjudication': 'auction'}


def parcel_list(value):
    return [p.strip() for p in value.strip('{}').split(',') if p.strip()]


@lru_cache(maxsize=1)
def dvf_rows(directory, file_name, digest, member, queried_communes):
    """Read the regional release once, keeping only relevant, non-personal fields."""
    data = pinned(directory, file_name, digest)
    csv.field_size_limit(min(sys.maxsize, 2**31 - 1))
    selected, earliest, latest = [], None, None
    allowed = set(queried_communes)
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        rows = csv.DictReader(io.TextIOWrapper(archive.open(member), encoding='utf-8'), delimiter='|')
        columns = {'l_codinsee', 'l_idpar', 'idmutinvar', 'datemut', 'libnatmut', 'nbdispo'}
        require(columns <= set(rows.fieldnames), 'Review changed DVF+ schema')
        for row in rows:
            date = row['datemut']
            earliest = min(earliest, date) if earliest else date
            latest = max(latest, date) if latest else date
            if allowed & set(parcel_list(row['l_codinsee'])):
                selected.append({k: row[k] for k in columns})
    return selected, [earliest, latest] if earliest else None


def build(cru, bundle, manifest, directory):
    config, parent = bundle['saleRecords'], cru['parentFeatureId']
    ids = {f['properties']['id'] for f in json.loads(parcel_asset(manifest))['features'] if in_cru(f, parent)}
    allowed = {p[:5] for p in ids}
    history = read_json(research_path(cru, 'rights-history.json'))
    ancestry = [r['documentedAncestry'] for r in history['parcels'] if 'documentedAncestry' in r]
    historical_ids = {p for row in ancestry for p in row['ancestorIds']} - ids
    inventory = official_inventory(bundle)
    queried_communes = tuple(sorted(set(inventory['available']['geometry']) | allowed)) if inventory else tuple(sorted(allowed))
    shared = SOURCE_ROOT / 'shared'
    cache_dir = shared if (shared / config['fileName']).exists() else directory
    rows, dataset_range = dvf_rows(str(cache_dir), config['fileName'], config['sha256'], config['member'], queried_communes)
    deeds, historical_deeds, seen, commune_dates = [], [], set(), []
    for r in rows:
            if not allowed & set(parcel_list(r['l_codinsee'])):
                continue
            commune_dates.append(r['datemut'])
            parcels = set(parcel_list(r['l_idpar']))
            inside, historical = sorted(parcels & ids), sorted(parcels & historical_ids)
            if not inside and not historical:
                continue
            require(r['idmutinvar'] not in seen, f"Duplicate deed {r['idmutinvar']}")
            seen.add(r['idmutinvar'])
            # DVF+ merges dispositions. All printed references remain in the
            # original scope; no individual direction or party is inferred.
            base = {'deedId': r['idmutinvar'], 'date': r['datemut'], 'nature': NATURES.get(r['libnatmut'], 'other'),
                    'dispositions': int(r['nbdispo'])}
            if inside:
                deeds.append({**base, 'parcelIds': inside, 'otherParcels': len(parcels) - len(inside)})
            if historical:
                paths = [path for reference in historical for path in historical_evidence_paths(
                    ancestry, history['documentedEvents'], reference, r['datemut'])]
                historical_deeds.append({**base, 'dateRole': 'deed-date', 'originalParcelIds': sorted(parcels),
                                         'matchedHistoricalReferenceIds': historical, 'originalScope': 'complete-deed-parcel-group',
                                         'contextPaths': paths,
                                         'limitation': 'Historical-reference context only. Ambiguous and partial routes stay unassigned; no sale, party or operator is transferred to a current parcel.'})
    deeds.sort(key=lambda d: (d['date'], d['deedId']))
    historical_deeds.sort(key=lambda d: (d['date'], d['deedId']))
    return {
        'schemaVersion': 3, 'dataset': config['dataset'], 'licence': config['licence'], 'release': config['release'],
        'parentFeatureId': parent,
        'coverage': f'{min(commune_dates)} to {max(commune_dates)}' if commune_dates else 'No commune records matched in the obtained release',
        'sourceCoverage': {'release': config['release'], 'availableStart': config.get('availableStart'),
                           'availableRange': config.get('availableRange'),
                           'provenance': official_sources(bundle, 'sales'),
                           'observedDatasetRange': dataset_range,
                           'observedCommuneRange': [min(commune_dates), max(commune_dates)] if commune_dates else None,
                           'historicalReferencesQueried': sorted(historical_ids),
                           'earlierOfficialRecordsAudit': config.get('earlierOfficialRecordsAudit', 'pending-publisher-coverage-audit'),
                           'limitation': 'Observed deed ranges are not uninterrupted coverage or creation dates. Sales do not reach back to the oldest DFI event.'},
        'inputs': {'parcelSnapshotSha256': manifest['sha256'], 'dvfPlus': {k: config[k] for k in ('url', 'fileName', 'member', 'sha256')}},
        'note': ('A deed dates a transfer and groups parcels; it names no party and never establishes farming. '
                 'Parcel references are those printed at the deed date.'),
        'counts': {'deeds': len(deeds), 'parcels': len({p for d in deeds for p in d['parcelIds']}),
                   'historicalReferenceDeeds': len(historical_deeds),
                   'unassignedHistoricalContextPaths': sum(p['assignment'] == 'unassigned-context'
                                                          for d in historical_deeds for p in d['contextPaths'])},
        'deeds': deeds, 'historicalDeeds': historical_deeds,
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
