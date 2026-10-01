"""Acquire shared current lieux-dits/schema and the complete regional DVF+ release.

Complements the dated official-history inventory without duplicating department
members. Exact retrieval times belong to downloaded bytes, never legacy copies.
"""
import argparse

from grand_cru import CONFIG_DIR, load_bundle, read_json
from inventory_grand_cru_sources import acquire, save_json


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stamp', default='2026-10-01')
    parser.add_argument('--retry-missing', action='store_true')
    args = parser.parse_args()
    path = CONFIG_DIR / f'sources/inventory-{args.stamp}.json'
    inventory = read_json(path)
    sources = []
    for commune, coverage in inventory['available']['geometry'].items():
        date = coverage['pinnedCurrentGeometry']
        sources.append({'id': f'lieux-dits-{commune}-{date}', 'kind': 'lieux-dits', 'commune': commune,
                        'asOf': date, 'sourceReleaseDate': date, 'schemaVersion': 'etalab-geojson',
                        'url': f'https://files.data.gouv.fr/cadastre/etalab-cadastre/{date}/geojson/communes/{commune[:2]}/{commune}/cadastre-{commune}-lieux_dits.json.gz',
                        'fileName': f'lieux-dits-{commune}.json.gz',
                        'licence': 'Licence Ouverte / Open Licence', 'licenceUrl': 'https://www.data.gouv.fr/datasets/cadastre'})
    baseline = load_bundle('vougeot')
    config = baseline['parcels']
    sources.append({'id': 'rights-schema-2025', 'kind': 'rights-schema', 'schemaVersion': '2025',
                    'url': config['schemaUrl'], 'fileName': 'dgfip-2025-description.odt',
                    'sourceReleaseDate': None, 'asOf': None, 'licence': config['rightsLicence'],
                    'licenceUrl': config['rightsLicenceUrl']})
    sales = baseline['saleRecords']
    sources.append({'id': 'sales-bfc-2026-1', 'kind': 'sales', 'region': 'Bourgogne-Franche-Comté',
                    'url': sales['url'], 'fileName': sales['fileName'],
                    'schemaVersion': 'DVF+ open data 2026-1', 'sourceReleaseDate': None, 'asOf': None,
                    'releaseLabel': '2026-1', 'archiveMember': sales['member'],
                    'catalogueUrl': 'https://datafoncier.cerema.fr/donnees/autres-donnees-foncieres/dvfplus-open-data',
                    'licence': 'Licence Ouverte / Open Licence 2.0',
                    'licenceUrl': 'https://www.data.gouv.fr/datasets/dvf-open-data'})
    previous = {s['id']: s for s in inventory['sources']}
    for source in sources:
        obtained = acquire(source, retry_missing=args.retry_missing)
        previous[source['id']] = obtained
    inventory['sources'] = sorted(previous.values(), key=lambda s: s['id'])
    inventory['counts'] = {state: sum(s['status'] == state for s in inventory['sources']) for state in ('obtained', 'missing')}
    save_json(path, inventory)
    print(inventory['counts'])


if __name__ == '__main__':
    main()
