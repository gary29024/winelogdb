"""Initialize inventory-depth research for new historical-extension crus only.

Existing curation and reviewed named areas are preserved. The placeholder named
area is a review status, not a climat claim or a fabricated cadastral name.
"""
from grand_cru import (communes, cru_slugs, in_cru, load_cru, load_manifest, parcel_asset,
                       read_json, research_path)
from inventory_grand_cru_sources import save_json
import json


def main():
    for slug in cru_slugs():
        cru, bundle = load_cru(slug)
        if cru.get('research', {}).get('delivery') != 'historical-extension':
            continue
        manifest = load_manifest(bundle)
        features = [f for f in json.loads(parcel_asset(manifest))['features'] if in_cru(f, cru['parentFeatureId'])]
        holder_ids = sorted({r['holderId'] for f in features for r in f['properties']['recordedRights']})
        config = bundle['parcels']
        curation_path = research_path(cru, 'curation.json')
        if not curation_path.exists():
            save_json(curation_path, {
                'schemaVersion': 1, 'reviewedAt': '2026-10-01', 'targetSeason': '2026',
                'parentFeatureId': cru['parentFeatureId'], 'status': 'historical-extension-inventory',
                'scope': f"All {len(features)} mapped {cru['name']} parcels and {len(holder_ids)} current legal-entity right-holder identifiers inventoried for #461. Named-area crosswalks, producer research and individual company investigations remain unreviewed. No current farmer is verified.",
                'sources': [
                    {'id': 'dgfip-current', 'title': f"DGFiP department {config['commune'][:2]} legal-entity rights, {config['rightsAsOf']}",
                     'url': config['rightsUrl'], 'type': 'registry-dataset', 'documentDate': config['rightsAsOf'],
                     'access': 'read', 'finding': 'Exact current references and every holder/right code retained. Rights are not farming.'},
                    {'id': 'dgfip-history', 'title': 'DGFiP available annual legal-entity rights',
                     'url': config['rightsLicenceUrl'], 'type': 'registry-dataset', 'documentDate': None,
                     'access': 'read', 'finding': 'Pinned annual source members and original-reference dates are in rights-history.json and the shared inventory.'},
                    {'id': 'cadastre-history', 'title': 'Etalab available commune geometry vintages',
                     'url': 'https://files.data.gouv.fr/cadastre/etalab-cadastre/', 'type': 'geometry', 'documentDate': None,
                     'access': 'read', 'finding': 'Full current geometry is preserved. Earlier observations support separately labelled spatial inference.'},
                    {'id': 'dvf-sales', 'title': 'Cerema DVF+ open-data, Bourgogne-Franche-Comté',
                     'url': 'https://www.data.gouv.fr/datasets/dvf-open-data', 'type': 'registry-dataset',
                     'documentDate': None, 'access': 'read', 'finding': 'Dated deed references, without prices or parties. Coverage is audited independently of DFI.'},
                ],
                'holders': [{'holderId': hid, 'basis': 'identity-only',
                             'sourceIds': ['dgfip-current'], 'parcelOperationConfirmed': False,
                             'finding': 'Recorded legal-entity identifier and right codes retained. No independently reviewed domaine or operator crosswalk; identity alone does not establish farming.'}
                            for hid in holder_ids],
                'historyFindings': [], 'exactParcelEvents': [], 'externalResearch': [], 'parcelFilings': [],
                'producerHoldings': [], 'historicalOwnerLists': [],
                'accessGaps': ['Named-area/climat crosswalks are unreviewed; this delivery preserves the exact whole-cru INAO feature.',
                               'Producer and company-filing investigations remain Tier 2. Paid SPF copies and outreach remain Tier 3.',
                               'Source boundaries, failed notice downloads and unsearched intervals are reported in the history coverage; none means no historical record.',
                               'Current farming remains unconfirmed for every parcel.'],
            })
        named = research_path(cru, 'parcel-named-areas.json')
        if not named.exists():
            save_json(named, {'schemaVersion': 1, 'parentFeatureId': cru['parentFeatureId'],
                              'inputs': {'parcelSnapshotSha256': manifest['sha256']},
                              'reviewStatus': 'named-area-crosswalk-unreviewed',
                              'limitation': 'The label below is a review status only. It does not assign a cadastral lieu-dit, official climat, vineyard subdivision or producer holding.',
                              'parcels': {f['id']: {'sourceName': None, 'name': 'Named area unreviewed',
                                                     'basis': 'review-status-only'} for f in features}})


if __name__ == '__main__':
    main()
