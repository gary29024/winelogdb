"""Guard the per-cru configs and commune bundles. Standard library only, so CI runs it without GIS packages."""
import copy
import json
import unittest
from pathlib import Path
from unittest import mock

import grand_cru
from build_grand_cru_research import Context
from grand_cru import (APP_DIR, app_cru_slugs, REPORT_DIR, RESEARCH_DIR, ROOT, bundle_commune_names, cadastre_sources, commune_audit_path,
                       named_plot_report_path, bundle_ids, bundle_parent_features, bundle_sources,
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
        for slug, split in (('echezeaux', (8.2, 1.4, 6.8)), ('grands-echezeaux', (1.8, 0.0, 1.8))):
            report = read_json(REPORT_DIR / f'{slug}-commune-audit.json')
            parts = report['notCoveredByBundleParcels']
            # Area outside the bundle's parcels is split, never all called gaps between parcels.
            self.assertEqual((report['notCoveredByBundleParcelsM2'], parts['coveredByNeighbourParcelsM2'],
                              parts['coveredByNoParcelM2']), split)
        echezeaux = {n['commune']: n for n in read_json(ROOT / 'scripts/grand-crus/reports/echezeaux-commune-audit.json')['neighbours']}
        self.assertEqual((echezeaux['21714']['contactsOverMinimumOverlap'], echezeaux['21133']['contactsOverMinimumOverlap']), (3, 3))

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

    def test_committed_commune_audits_match_pinned_sources(self):
        # CI has no GIS packages or source downloads, so it cannot rerun the audit. It can prove the committed report
        # was built from today's pins and stays within its limit, and that a reviewed remainder names those pins.
        for slug in cru_slugs():
            cru, bundle = load_cru(slug)
            path = commune_audit_path(cru)
            if not path.exists():
                # #461 supplies historical evidence before the remaining per-cru Tier 1 reviews. Until its commune-edge
                # audit is committed, a cru keeps its unreviewed work explicit and stays off the app's maps.
                self.assertEqual(cru.get('research', {}).get('delivery'), 'historical-extension',
                                 f'{slug}: commit build_grand_cru_commune_audit.py output')
                self.assertEqual(cru['research']['namedAreas'], 'unreviewed', slug)
                self.assertEqual(cru['research']['producerResearch'], 'unreviewed', slug)
                self.assertNotIn(slug, app_cru_slugs(), f'{slug}: hidden from the app until its commune audit passes')
                continue
            report = read_json(path)
            pins = {insee: digest for insee, _, digest in cadastre_sources(bundle)}
            self.assertEqual({c['commune']: c['sha256'] for c in report['bundleCommunes']}, pins, f'{slug}: stale commune audit')
            review = cru.get('communeAudit', {}).get('reviewedUncoveredArea')
            self.assertEqual(report.get('reviewedUncoveredArea'), review, f'{slug}: rerun the commune audit after review')
            if review:
                _, _, parent_hash = village_map(bundle, cru['parentFeatureId'])
                self.assertEqual(review['parentSourceSha256'], parent_hash, f'{slug}: INAO boundary changed since review')
                self.assertEqual(review['cadastreSha256ByCommune'], pins, f'{slug}: cadastre changed since review')
                self.assertTrue(review['note'].strip() and review['reviewedAt'])
                limit = review['maximumAreaM2']
            else:
                limit = report['boundaryAreaM2'] * 0.001  # MAX_UNCOVERED_SHARE in build_grand_cru_commune_audit.py
            self.assertLessEqual(report['notCoveredByBundleParcelsM2'], limit, slug)

    def test_named_areas_are_audited_even_without_a_display_layer(self):
        for slug in cru_slugs():
            cru, bundle = load_cru(slug)
            if 'namedPlots' not in cru:
                continue
            path = named_plot_report_path(cru)
            self.assertTrue(path.exists(), f'{slug}: commit build_grand_cru_named_plots.py output')
            report = read_json(path)
            # A display-layer report names one snapshot as `source`; multi-commune and audit-only reports list `sources`.
            used = {s['commune']: s['sha256'] for s in report['sources']} if 'sources' in report else {communes(bundle)[0]: report['source']['sha256']}
            self.assertEqual(used, {c: bundle['lieuxDits'][c]['sha256'] for c in communes(bundle)}, f'{slug}: stale named-area audit')
            self.assertEqual(report['parentSourceSha256'], village_map(bundle, cru['parentFeatureId'])[2], f'{slug}: INAO boundary changed')

    def test_generated_research_json_has_one_line_per_record(self):
        from grand_cru import record_json
        value = {'schemaVersion': 1, 'parcels': [{'id': 'A1', 'é': 1.5}, {'id': 'A2'}], 'byId': {'A1': {'x': [1]}}, 'counts': {'n': 2}}
        text = record_json(value)
        self.assertEqual(json.loads(text), value)
        self.assertIn('\n{"id":"A2"}\n', text)
        self.assertIn('\n"A1":{"x":[1]}\n', text)
        # Every committed generated research file stays in this format (builders write it with record_json).
        for name in ('rights-history', 'register', 'sale-records', 'notice-history', 'parcel-named-areas'):
            for path in sorted(RESEARCH_DIR.glob(f'*/{name}.json')):
                content = path.read_text(encoding='utf-8')
                self.assertEqual(content, record_json(json.loads(content)), relative(path))

    def test_generated_paths_are_repository_relative(self):
        self.assertEqual(relative(ROOT / 'docs/research/echezeaux/curation.json'), 'docs/research/echezeaux/curation.json')


if __name__ == '__main__':
    unittest.main()
