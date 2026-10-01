"""Configure the audited 33-cru historical extension, preserving existing research.

New crus start at inventory depth: no producer leads or named-area crosswalks are
invented. Shared commune bundles use the exact current INAO features and source
inventory. Repeat runs validate existing cru identities and reuse pinned inputs.
"""
import argparse
import copy
import shutil
import zlib

from grand_cru import (BUNDLE_DIR, CONFIG_DIR, SOURCE_ROOT, bundle_ids, load_bundle, read_json, require)
from inventory_grand_cru_sources import pin_bundles, save_json

SLUGS = [
    'echezeaux', 'grands-echezeaux', 'clos-de-vougeot', 'richebourg', 'romanee-saint-vivant',
    'romanee-conti', 'la-romanee', 'la-tache', 'la-grande-rue', 'musigny', 'bonnes-mares',
    'clos-de-tart', 'clos-des-lambrays', 'clos-saint-denis', 'clos-de-la-roche', 'chambertin',
    'chambertin-clos-de-beze', 'chapelle-chambertin', 'griotte-chambertin', 'charmes-chambertin',
    'mazoyeres-chambertin', 'latricieres-chambertin', 'mazis-chambertin', 'ruchottes-chambertin',
    'montrachet', 'chevalier-montrachet', 'batard-montrachet', 'bienvenues-batard-montrachet',
    'criots-batard-montrachet', 'corton', 'corton-charlemagne', 'charlemagne', 'chablis-grand-cru',
]
GROUPS = {'vosne-romanee': range(379, 385), 'chambolle-morey': range(385, 391),
          'gevrey-chambertin': range(391, 400), 'montrachet': range(400, 405),
          'corton': range(405, 408), 'chablis': range(408, 409)}


def configure(stamp):
    path = CONFIG_DIR / f'sources/inventory-{stamp}.json'
    inventory = read_json(path)
    targets = read_json(CONFIG_DIR / 'rollout/history-targets.json')['targets']
    require({t['issue'] for t in targets} == set(range(376, 409)), 'Incomplete issue inventory')
    sources = {s['id']: s for s in inventory['sources']}
    baseline = load_bundle('vougeot')
    schema = sources['rights-schema-2025']
    require(schema['status'] == 'obtained', 'Current rights schema not obtained')
    shared = SOURCE_ROOT / 'shared'
    for bundle_id, issues in GROUPS.items():
        selected = sorted((t for t in targets if t['issue'] in issues), key=lambda t: t['issue'])
        codes = sorted({c for t in selected for c in t['communeCodes']})
        departments = {c[:2] for c in codes}
        require(len(departments) == 1, 'Current rights member must cover the bundle department')
        department = next(iter(departments))
        rights = max((s for s in sources.values() if s['kind'] == 'rights' and s['department'] == department),
                     key=lambda s: s['asOf'])
        require(rights['status'] == 'obtained', 'Latest current rights member not obtained')
        maps = list(dict.fromkeys(m for t in selected for m in t['villageMaps']))
        pins = []
        lieux = {}
        for code in codes:
            date = inventory['available']['geometry'][code]['pinnedCurrentGeometry']
            geometry = sources[f'geometry-{code}-{date}']
            dit = sources[f'lieux-dits-{code}-{date}']
            require(geometry['status'] == dit['status'] == 'obtained', 'Missing current commune source')
            pins.append({'commune': code, 'cadastreUrl': geometry['url'], 'cadastreSha256': geometry['sha256']})
            shutil.copyfile(shared / geometry['fileName'], shared / f'parcelles-{code}.json.gz')
            lieux[code] = {'url': dit['url'], 'sha256': dit['sha256']}
        parcels = copy.deepcopy(baseline['parcels'])
        parcels.update(pins[0])
        parcels.update({'additionalCommunes': pins[1:], 'rightsAsOf': rights['asOf'],
                        'rightsReleaseChecked': stamp, 'rightsUrl': rights['url'], 'rightsMember': rights['member'],
                        'rightsMemberSha256': rights['sha256'],
                        'rightsMemberCrc32': zlib.crc32((shared / rights['fileName']).read_bytes()),
                        'schemaUrl': schema['url'], 'schemaSha256': schema['sha256'],
                        'parentFeatureIds': [t['parentFeatureId'] for t in selected], 'domaineLinks': []})
        bundle = {'id': bundle_id, 'name': bundle_id.replace('-', ' ').title(),
                  'note': 'Shared official-history inputs for #461. Named-area and producer research require their own Tier 1/Tier 2 review.',
                  'crus': [SLUGS[t['issue'] - 376] for t in selected], 'villageMap': maps[0],
                  'additionalVillageMaps': maps[1:], 'assetName': f'{bundle_id}-parcels', 'parcels': parcels,
                  'lieuxDits': lieux, 'rightsHistory': {'successorInsideShare': 0.95, 'rights': [], 'cadastre': []},
                  'saleRecords': copy.deepcopy(baseline['saleRecords'])}
        bundle_path = BUNDLE_DIR / f'{bundle_id}.json'
        if not bundle_path.exists():
            save_json(bundle_path, bundle)
        else:
            existing = read_json(bundle_path)
            require(existing['crus'] == bundle['crus'] and existing['parcels']['parentFeatureIds'] == parcels['parentFeatureIds'],
                    f'Review existing bundle scope: {bundle_id}')
        for target in selected:
            slug = SLUGS[target['issue'] - 376]
            cru_path = CONFIG_DIR / f'{slug}.json'
            if cru_path.exists():
                require(read_json(cru_path)['parentFeatureId'] == target['parentFeatureId'], 'Existing INAO identity differs')
                continue
            save_json(cru_path, {'slug': slug, 'name': target['name'], 'parentFeatureId': target['parentFeatureId'],
                                'appellationId': target['appellationId'], 'issue': target['issue'], 'tier': 1,
                                'bundle': bundle_id, 'villageMaps': target['villageMaps'],
                                'rightsHistoryPurpose': f"Official filiation, dated legal-entity rights and original-reference evidence for {target['name']} (#461). None establishes current farming.",
                                'evidenceFrom': [slug], 'research': {'delivery': 'historical-extension',
                                                                   'methodDoc': 'docs/research/grand-cru-history.md',
                                                                   'namedAreas': 'unreviewed', 'producerResearch': 'unreviewed'}})
    pin_bundles([load_bundle(b) for b in bundle_ids()], inventory, path)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stamp', default='2026-10-01')
    configure(parser.parse_args().stamp)
