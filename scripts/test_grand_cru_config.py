"""Guard the per-cru configs and commune bundles. Standard library only, so CI runs it without GIS packages."""
import copy
import json
import unittest
from pathlib import Path
from unittest import mock

import grand_cru
from build_grand_cru_research import Context
from grand_cru import (APP_DIR, REPORT_DIR, RESEARCH_DIR, ROOT, bundle_commune_names, bundle_ids, bundle_parent_features, bundle_sources,
                       bundle_village_maps, communes, cru_slugs, load_bundle, load_cru, read_json, relative, village_map)


class ConfigTests(unittest.TestCase):
    def test_every_cru_and_bundle_agree(self):
        self.assertIn('echezeaux', cru_slugs())
        self.assertIn('grands-echezeaux', cru_slugs())
        for bundle_id in bundle_ids():
            bundle = load_bundle(bundle_id)
            parents = sorted(load_cru(slug)[0]['parentFeatureId'] for slug in bundle['crus'])
            self.assertEqual(parents, sorted(bundle['parcels']['parentFeatureIds']), bundle_id)
            self.assertEqual(len(communes(bundle)), len(set(communes(bundle))))
            self.assertEqual(set(bundle['lieuxDits']), set(communes(bundle)))
            parents_by_id, _ = bundle_parent_features(bundle)
            for slug in bundle['crus']:
                cru, _ = load_cru(slug)
                for map_id in cru['villageMaps']:
                    catalogue, canonical, _ = grand_cru._village_map(map_id)
                    self.assertIn(cru['parentFeatureId'], {f['id'] for f in json.loads(canonical)['features']}, map_id)
                self.assertIn(cru['parentFeatureId'], parents_by_id)
        ids = [load_cru(slug)[0]['parentFeatureId'] for slug in cru_slugs()]
        self.assertEqual(len(ids), len(set(ids)), 'One config per INAO feature')

    def test_shared_bundle_means_one_download(self):
        echezeaux, grands = load_cru('echezeaux')[1], load_cru('grands-echezeaux')[1]
        self.assertEqual(echezeaux['id'], grands['id'])
        names = [name for name, _, _ in bundle_sources(echezeaux)]
        self.assertEqual(names, [name for name, _, _ in bundle_sources(grands)])
        self.assertEqual(len(names), len(set(names)))
        self.assertEqual(len([n for n in names if n.startswith('lieux-dits-')]), 1)

    def test_research_stays_in_the_cru_folder(self):
        for slug in cru_slugs():
            cru, bundle = load_cru(slug)
            if 'research' not in cru:
                continue
            context = Context(cru, bundle)
            for path in (context.curation, context.output, context.report, context.history, context.sales, context.named_areas):
                self.assertEqual(path.parent, RESEARCH_DIR / slug, relative(path))
            self.assertEqual(context.evidence, APP_DIR / f'{slug}.evidence.json')
            # Once a cru has its own research, its panel reads only that research.
            self.assertEqual(cru['evidenceFrom'], [slug])

    def test_mismatched_configs_fail(self):
        cru, bundle = copy.deepcopy(load_cru('grands-echezeaux'))
        with mock.patch.object(grand_cru, 'read_json', side_effect=lambda path: {**cru, 'tier': 4}
                               if Path(path).name == 'grands-echezeaux.json' else read_json(path)):
            with self.assertRaisesRegex(ValueError, 'tier'):
                load_cru('grands-echezeaux')
        with mock.patch.object(grand_cru, 'load_bundle', return_value={**bundle, 'crus': ['echezeaux']}):
            with self.assertRaisesRegex(ValueError, 'not listed in bundle'):
                load_cru('grands-echezeaux')
        with self.assertRaisesRegex(ValueError, 'Unknown cru'):
            load_cru('clos-de-vougeot-typo')
        with mock.patch.object(grand_cru, 'read_json', side_effect=lambda path: {**cru, 'villageMaps': ['puligny-montrachet']}
                               if Path(path).name == 'grands-echezeaux.json' else read_json(path)):
            with self.assertRaisesRegex(ValueError, 'village map absent'):
                load_cru('grands-echezeaux')

    def test_only_inao_communes_are_imported(self):
        for bundle_id in bundle_ids():
            bundle = load_bundle(bundle_id)
            manifest = read_json(APP_DIR / f'{bundle_id}.manifest.json')
            parents, _ = bundle_parent_features(bundle)
            inao = {id: set(f['properties']['communes']) for id, f in parents.items()}
            features = json.loads((ROOT / ('public' + manifest['dataUrl'])).read_text(encoding='utf-8'))['features']
            for f in features:
                for o in f['properties']['overlaps']:
                    self.assertIn(f['properties']['commune'], inao[o['parentFeatureId']], f['id'])
        audit = read_json(ROOT / 'scripts/grand-crus/reports/grands-echezeaux-commune-audit.json')
        vougeot = next(n for n in audit['neighbours'] if n['commune'] == '21716')
        self.assertEqual(vougeot['contactsOverMinimumOverlap'], 11)  # measured, never imported
        self.assertLess(vougeot['maxParcelPercent'], 5)

    def test_multi_commune_bundle(self):
        bundle = {'parcels': {'commune': '21150', 'additionalCommunes': [{'commune': '21512', 'cadastreUrl': 'u', 'cadastreSha256': 's'}]}}
        self.assertEqual(communes(bundle), ['21150', '21512'])

    def test_bundle_can_use_both_maps_of_a_cross_commune_cru(self):
        bundle = {'id': 'puligny-chassagne-example', 'villageMap': 'puligny-montrachet',
                  'additionalVillageMaps': ['chassagne-montrachet'],
                  'parcels': {'parentFeatureIds': ['inao-denom-273', 'inao-denom-927',
                                                  'inao-denom-351', 'inao-denom-564']}}
        self.assertEqual(bundle_village_maps(bundle), ['puligny-montrachet', 'chassagne-montrachet'])
        parents, hashes = bundle_parent_features(bundle)
        self.assertEqual(set(parents), set(bundle['parcels']['parentFeatureIds']))
        self.assertEqual(set(hashes), set(bundle_village_maps(bundle)))
        self.assertEqual(bundle_commune_names(bundle)['21150'], 'Chassagne-Montrachet')
        self.assertEqual(bundle_commune_names(bundle)['21512'], 'Puligny-Montrachet')
        catalogue, _, _ = village_map(bundle, 'inao-denom-564')
        self.assertEqual(catalogue['id'], 'chassagne-montrachet')
        catalogue, _, _ = village_map(bundle, 'inao-denom-927')
        self.assertEqual(catalogue['id'], 'puligny-montrachet')

    def test_source_licences_are_pinned_in_bundle_and_manifest(self):
        for bundle_id in bundle_ids():
            bundle = load_bundle(bundle_id)
            manifest = read_json(APP_DIR / f'{bundle_id}.manifest.json')
            report = read_json(REPORT_DIR / f'{bundle_id}-parcels.json')
            self.assertEqual(report['sources'], bundle['parcels'])
            for key in ('cadastreLicence', 'rightsLicence'):
                self.assertIn('Licence Ouverte', bundle['parcels'][key])
                self.assertEqual(manifest[key], bundle['parcels'][key])
                self.assertTrue(bundle['parcels'][key + 'Url'].startswith('https://www.data.gouv.fr/datasets/'))
                self.assertEqual(manifest[key + 'Url'], bundle['parcels'][key + 'Url'])
                self.assertEqual(report[key], manifest[key])
                self.assertEqual(report[key + 'Url'], manifest[key + 'Url'])

    def test_generated_paths_are_repository_relative(self):
        self.assertEqual(relative(ROOT / 'docs/research/echezeaux/curation.json'), 'docs/research/echezeaux/curation.json')


if __name__ == '__main__':
    unittest.main()
