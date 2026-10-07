"""Independent committed-data contracts for every #461 delivery, including Yonne."""
import json
import unittest

from build_grand_cru_notice_history import build, indexed_event_notice
from build_grand_cru_research import Context, build_register, outputs
from build_grand_cru_evidence import build_evidence

from grand_cru import (APP_DIR, CONFIG_DIR, ROOT, cru_slugs, in_cru, load_cru, load_manifest,
                       parcel_asset, read_json, research_path, resolve_curation, sha256)


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


class ChablisTier1Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cru, cls.bundle = load_cru('chablis-grand-cru')
        cls.history = read_json(research_path(cls.cru, 'rights-history.json'))
        cls.curation = resolve_curation(read_json(research_path(cls.cru, 'curation.json')), cls.cru['slug'])
        cls.notices = build(cls.cru, cls.bundle, cls.history)

    def test_curated_rows_do_not_duplicate_the_37_yonne_matches(self):
        self.assertEqual(len(self.notices['reviewedMatches']), 37)
        self.assertEqual(self.notices['unreviewedCandidates'], [])
        self.assertEqual({n['indexId'] for n in self.notices['reviewedMatches']}, {'departmental-yonne-archive'})
        event = self.curation['exactParcelEvents'][0]
        source = next(s for s in self.curation['sources'] if s['id'] == event['sourceId'])
        for change in [{'documentDate': '2012-05-17'}, {'parcelIds': ['890680000A0001']},
                       {'indexedNotice': {**event['indexedNotice'], 'noticeId': 'wrong-notice'}}]:
            with self.subTest(change=change), self.assertRaises(ValueError):
                indexed_event_notice({**event, **change}, source, self.notices['reviewedMatches'])
        with self.assertRaisesRegex(ValueError, 'PDF hash'):
            indexed_event_notice(event, {**source, 'sha256': '0' * 64}, self.notices['reviewedMatches'])

    def test_treatment_requester_is_never_an_operator_candidate_and_original_rows_survive(self):
        manifest = load_manifest(self.bundle)
        asset = parcel_asset(manifest)
        register = build_register(manifest, asset, self.curation, self.history,
                                 read_json(research_path(self.cru, 'sale-records.json')),
                                 read_json(research_path(self.cru, 'parcel-named-areas.json')),
                                 Context(self.cru, self.bundle), self.notices)
        evidence = build_evidence(register, self.curation, self.history, json.loads(asset)['features'])
        self.assertEqual(register['counts']['historicalAuthorisation'], 17)
        context = Context(self.cru, self.bundle)
        report = outputs(context)[0][context.report]
        self.assertIn('417 parcels have no named candidate', report)
        self.assertIn('400 remain without a research lead', report)
        self.assertTrue(all(not r['candidateLeads'] and r['currentFarmer'] is None for r in register['parcels']))
        for event in self.curation['exactParcelEvents']:
            parcel = event['parcelIds'][0]
            items = [i for i in evidence['parcels'][parcel] if event['sourceId'] in i['sources']]
            self.assertEqual(len(items), 1)
            item = items[0]
            self.assertEqual(item['label'], 'Aerial-spraying derogation')
            self.assertEqual(item['originalScope'], 'printed-notice-reference-and-area')
            original = next(n['originalRecord'] for n in self.notices['reviewedMatches']
                            if n['originalRecord']['noticeId'] == event['sourceId'] and n['matchedReferenceIds'] == [parcel])
            self.assertEqual(item['originalNoticeRecord'], original)
        # A former treated reference is context only; no treatment or farmer is transferred through its split.
        for parcel in ['890680000A0828', '890680000A0829', '890680000A0841', '890680000A0842']:
            items = [i for i in evidence['parcels'][parcel] if i.get('originalNoticeRecord')]
            self.assertTrue(items)
            self.assertTrue(all(i['kind'] == 'notice' for i in items))
            self.assertTrue(all(p['assignment'] == 'unassigned-context' for i in items for p in i['contextPaths']))


if __name__ == '__main__':
    unittest.main()
