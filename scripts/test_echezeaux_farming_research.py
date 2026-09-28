"""Guard research coverage and prevent hypotheses becoming farmer assignments."""
import copy
import json
import unittest

from build_echezeaux_farming_research import ROOT, CURATION, MANIFEST, build_register


class FarmingResearchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
        cls.asset = (ROOT / 'public' / cls.manifest['dataUrl'].lstrip('/')).read_bytes()
        cls.curation = json.loads(CURATION.read_text(encoding='utf-8'))

    def test_pinned_population_and_no_invented_farmers(self):
        result = build_register(self.manifest, self.asset, self.curation)
        self.assertEqual(result['counts']['parcels'], 276)
        self.assertEqual(result['counts']['withRecordedRights'], 119)
        self.assertEqual(result['counts']['withoutMatchedRights'], 157)
        self.assertEqual(result['counts']['recordedHolders'], 36)
        rows = {p['parcelId']: p for p in result['parcels']}
        self.assertNotIn('212670000D0093', rows)  # Grands-Échezeaux is outside this register.
        self.assertEqual(rows['212670000D0177']['researchStatus'], 'historical-application')
        self.assertEqual(rows['212670000D0178']['researchStatus'], 'historical-application')
        self.assertTrue(all(p['currentFarmer'] is None and p['verifiedAsOf'] is None for p in rows.values()))
        self.assertEqual(sum(p['researchDepth'] == 'inventory-only' for p in rows.values()), 155)

    def test_snapshot_drift_fails_before_join(self):
        with self.assertRaisesRegex(ValueError, 'snapshot hash'):
            build_register(self.manifest, self.asset + b' ', self.curation)

    def test_missing_holder_cannot_silently_lose_research(self):
        curation = copy.deepcopy(self.curation)
        curation['holders'].pop()
        with self.assertRaisesRegex(ValueError, 'every and only recorded holder'):
            build_register(self.manifest, self.asset, curation)

    def test_unsupported_confirmation_is_rejected(self):
        curation = copy.deepcopy(self.curation)
        curation['holders'][0]['parcelOperationConfirmed'] = True
        with self.assertRaisesRegex(ValueError, 'cannot publish confirmed operation'):
            build_register(self.manifest, self.asset, curation)
        curation = copy.deepcopy(self.curation)
        curation['exactParcelEvents'][0]['currentFarmer'] = 'Anne Gros'
        with self.assertRaisesRegex(ValueError, 'cannot establish current farming'):
            build_register(self.manifest, self.asset, curation)

    def test_no_orphan_evidence_or_wrong_cru_reference(self):
        curation = copy.deepcopy(self.curation)
        curation['holders'][0]['sourceIds'] = ['nonexistent-source']
        with self.assertRaisesRegex(ValueError, 'Unknown holder source'):
            build_register(self.manifest, self.asset, curation)
        curation = copy.deepcopy(self.curation)
        curation['exactParcelEvents'][0]['parcelIds'].append('212670000D0093')
        with self.assertRaisesRegex(ValueError, 'outside research cru'):
            build_register(self.manifest, self.asset, curation)


if __name__ == '__main__':
    unittest.main()
