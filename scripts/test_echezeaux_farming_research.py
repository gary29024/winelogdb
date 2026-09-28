"""Guard research coverage and prevent hypotheses becoming farmer assignments."""
import copy
import json
import unittest

from build_echezeaux_farming_research import ROOT, CURATION, HISTORY, MANIFEST, build_register


class FarmingResearchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
        cls.asset = (ROOT / 'public' / cls.manifest['dataUrl'].lstrip('/')).read_bytes()
        cls.curation = json.loads(CURATION.read_text(encoding='utf-8'))
        cls.history = json.loads(HISTORY.read_text(encoding='utf-8'))

    def build(self, curation=None, asset=None, history=None):
        return build_register(self.manifest, asset or self.asset, curation or self.curation, history or self.history)

    def test_pinned_population_and_no_invented_farmers(self):
        result = self.build()
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
            self.build(asset=self.asset + b' ')

    def test_missing_holder_cannot_silently_lose_research(self):
        curation = copy.deepcopy(self.curation)
        curation['holders'].pop()
        with self.assertRaisesRegex(ValueError, 'every and only recorded holder'):
            self.build(curation)

    def test_unsupported_confirmation_is_rejected(self):
        curation = copy.deepcopy(self.curation)
        curation['holders'][0]['parcelOperationConfirmed'] = True
        with self.assertRaisesRegex(ValueError, 'cannot publish confirmed operation'):
            self.build(curation)
        curation = copy.deepcopy(self.curation)
        curation['exactParcelEvents'][0]['currentFarmer'] = 'Anne Gros'
        with self.assertRaisesRegex(ValueError, 'cannot establish current farming'):
            self.build(curation)

    def test_no_orphan_evidence_or_wrong_cru_reference(self):
        curation = copy.deepcopy(self.curation)
        curation['holders'][0]['sourceIds'] = ['nonexistent-source']
        with self.assertRaisesRegex(ValueError, 'Unknown holder source'):
            self.build(curation)
        curation = copy.deepcopy(self.curation)
        curation['exactParcelEvents'][0]['parcelIds'].append('212670000D0093')
        with self.assertRaisesRegex(ValueError, 'outside research cru'):
            self.build(curation)


    def test_rights_history_is_dated_context_not_farming(self):
        rows = {p['reference']: p for p in self.build()['parcels']}
        lamarche = rows['D 0168']['rightsChanges']
        self.assertEqual([c['kind'] for c in lamarche], ['record-appeared', 'same-holder-renamed'])
        self.assertEqual(lamarche[1]['before'], ['FONCIER VITI DOM FRANCOIS LAMARCHE'])
        self.assertEqual(rows['D 0898']['predecessorIds'], ['212670000D0143'])
        self.assertEqual(rows['D 0673']['rightsChanges'][-1]['after'], ['BOUCHON POURPRE'])
        self.assertTrue(all(p['currentFarmer'] is None for p in rows.values()))

    def test_history_must_match_snapshot_and_cannot_assign_farmers(self):
        history = copy.deepcopy(self.history)
        history['inputs']['parcelSnapshotSha256'] = '0' * 64
        with self.assertRaisesRegex(ValueError, 'another snapshot'):
            self.build(history=history)
        history = copy.deepcopy(self.history)
        history['parcels'].pop()
        with self.assertRaisesRegex(ValueError, 'every and only mapped parcel'):
            self.build(history=history)
        curation = copy.deepcopy(self.curation)
        curation['historyFindings'][0]['currentFarmer'] = 'Nicole Lamarche'
        with self.assertRaisesRegex(ValueError, 'cannot establish current farming'):
            self.build(curation)
        curation = copy.deepcopy(self.curation)
        curation['historyFindings'][0]['parcelIds'] = ['212670000D0093']
        with self.assertRaisesRegex(ValueError, 'outside research cru'):
            self.build(curation)


if __name__ == '__main__':
    unittest.main()
