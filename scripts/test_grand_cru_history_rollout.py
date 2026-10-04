"""Independent committed-data contracts for every #461 delivery, including Yonne."""
import json
import unittest

from grand_cru import (APP_DIR, CONFIG_DIR, ROOT, cru_slugs, in_cru, load_cru, load_manifest,
                       parcel_asset, read_json, research_path, sha256)


class HistoryRolloutTests(unittest.TestCase):
    def test_all_33_exact_inao_identities_have_complete_current_parcel_history(self):
        targets = read_json(CONFIG_DIR / 'rollout/history-targets.json')['targets']
        configs = {load_cru(s)[0]['issue']: load_cru(s)[0] for s in cru_slugs()}
        self.assertEqual(set(configs), set(range(376, 409)))
        for target in targets:
            cru, bundle = load_cru(configs[target['issue']]['slug'])
            self.assertEqual(cru['parentFeatureId'], target['parentFeatureId'])
            manifest = load_manifest(bundle)
            ids = {f['id'] for f in json.loads(parcel_asset(manifest))['features'] if in_cru(f, cru['parentFeatureId'])}
            history = read_json(research_path(cru, 'rights-history.json'))
            register = read_json(research_path(cru, 'register.json'))
            evidence = read_json(APP_DIR / f"{cru['slug']}.evidence.json")
            self.assertEqual({r['parcelId'] for r in history['parcels']}, ids, cru['slug'])
            self.assertEqual({r['parcelId'] for r in register['parcels']}, ids, cru['slug'])
            self.assertEqual(set(evidence['tracing']), ids, cru['slug'])
            self.assertEqual(register['counts']['currentFarmerConfirmed'], 0)
            self.assertTrue(all(r['currentFarmer'] is None and r['verifiedAsOf'] is None for r in register['parcels']))
            self.assertEqual(history['coverage']['rightsImported'], [f'{y}-01-01' for y in range(2019, 2026)])
            self.assertTrue(register['historyCoverage']['sales']['earlierOfficialRecordsAudit'])
            self.assertTrue(register['historyCoverage']['notices']['availabilityAudit'])
            for row in history['parcels']:
                self.assertTrue(row['documentedAncestry']['terminals'], row['parcelId'])
                self.assertIn(row['earliestSupportedEvent']['dateRole'], ['dfi-validation', 'first-observed-cadastral-release'])
                for path in row['documentedAncestry']['paths']:
                    self.assertEqual(path['referencePath'][0], row['parcelId'])
                    self.assertEqual(path['referencePath'][-1], path['referenceId'])
                    self.assertEqual(len(path['eventPath']) + 1, len(path['referencePath']))

    def test_chablis_has_yonne_source_metadata_and_explicit_notice_gaps(self):
        cru, _ = load_cru('chablis-grand-cru')
        register = read_json(research_path(cru, 'register.json'))
        coverage = register['historyCoverage']
        self.assertEqual([s['departmentCode'] for s in coverage['dfiSources']], ['890'])
        self.assertEqual(set(coverage['rightsAvailable']), {'89'})
        self.assertEqual(set(coverage['geometry']), {'89068'})
        # Only Yonne's own (archived, partial) index applies; Côte-d'Or indexes never do.
        self.assertEqual(coverage['notices']['missingDepartmentIndexes'], [])
        self.assertEqual(set(coverage['notices']['availabilityAudit']['departments']), {'89'})
        self.assertEqual([i['id'] for i in coverage['notices']['indexes']], ['departmental-yonne-archive'])
        self.assertTrue(coverage['notices']['availabilityAudit']['departments']['89']['unsearchedIntervals'])
        notices = read_json(research_path(cru, 'notice-history.json'))
        self.assertEqual({m['indexId'] for m in notices['reviewedMatches']}, {'departmental-yonne-archive'})
        self.assertEqual({m['originalRecord']['status'] for m in notices['reviewedMatches']}, {'derogation-granted'})
        self.assertTrue(all(m['currentFarmer'] is None for m in notices['reviewedMatches']))
        self.assertEqual(coverage['earliestReachableDfiValidationDate'], '1991-03-22')

    def test_sources_have_exact_raw_provenance_and_preserve_failed_urls(self):
        inventory = read_json(CONFIG_DIR / 'sources/inventory-2026-10-01.json')
        for source in inventory['sources']:
            self.assertTrue(source['url'].startswith('https://'))
            if source['status'] == 'obtained':
                self.assertRegex(source['sha256'], r'^[0-9a-f]{64}$')
                self.assertGreater(source['size'], 0)
                self.assertRegex(source['retrievedAt'], r'^2026-10-01T\d\d:\d\d:\d\dZ$')
            else:
                self.assertTrue(source['reason'])
                self.assertTrue(source['attemptedAt'])
        self.assertEqual({s['department'] for s in inventory['sources'] if s['kind'] == 'dfi'}, {'21', '89'})
        geometry = [s for s in inventory['sources'] if s['kind'] == 'geometry']
        self.assertEqual(len(geometry), 420)
        self.assertEqual(len({s['fileName'] for s in geometry}), 420)
        self.assertEqual({s['date'] for s in geometry}, set(inventory['available']['geometry']['89068']['dates']))


if __name__ == '__main__':
    unittest.main()
