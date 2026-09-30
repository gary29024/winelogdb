"""Guard the per-cru configs and commune bundles. Standard library only, so CI runs it without GIS packages."""
import copy
import unittest
from pathlib import Path
from unittest import mock

import grand_cru
from build_grand_cru_research import Context
from grand_cru import (APP_DIR, RESEARCH_DIR, ROOT, bundle_ids, bundle_sources, communes, cru_slugs, load_bundle, load_cru,
                       read_json, relative)


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
        # A cru without its own research reads another's evidence, never writes it.
        self.assertNotIn('research', load_cru('grands-echezeaux')[0])
        self.assertEqual(load_cru('grands-echezeaux')[0]['evidenceFrom'], ['echezeaux'])

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

    def test_multi_commune_bundle(self):
        bundle = {'parcels': {'commune': '21150', 'additionalCommunes': [{'commune': '21512', 'cadastreUrl': 'u', 'cadastreSha256': 's'}]}}
        self.assertEqual(communes(bundle), ['21150', '21512'])

    def test_generated_paths_are_repository_relative(self):
        self.assertEqual(relative(ROOT / 'docs/research/echezeaux/curation.json'), 'docs/research/echezeaux/curation.json')


if __name__ == '__main__':
    unittest.main()
