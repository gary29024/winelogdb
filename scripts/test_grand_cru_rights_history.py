"""Guard how rights changes are labelled: names never prove identity, a SIREN does."""
import json
import unittest

from build_grand_cru_rights_history import classify
from grand_cru import load_cru, research_path

OUTPUT = research_path(load_cru('echezeaux')[0], 'rights-history.json')

A = {'siren': '303514681', 'majic': None, 'name': 'DOMAINE MONGEARD MUGNERET', 'rightCode': 'P'}


class ClassifyTests(unittest.TestCase):
    def test_first_record_distinguishes_existing_from_new_reference(self):
        self.assertEqual(classify([], [A], True), 'record-appeared')
        self.assertEqual(classify([], [A], False), 'new-parcel-reference')
        self.assertEqual(classify([A], [], True), 'record-disappeared')

    def test_same_siren_is_a_rename_or_right_change(self):
        self.assertEqual(classify([A], [{**A, 'name': 'GFA MONGEARD'}], True), 'same-holder-renamed')
        self.assertEqual(classify([A], [{**A, 'rightCode': 'U'}], True), 'right-type-changed')

    def test_without_an_earlier_siren_identity_is_unprovable(self):
        provisional = {'siren': 'U18856436', 'majic': None, 'name': 'ASSURANCES DU CREDIT MUTUEL VIE', 'rightCode': 'P'}
        majic_only = {**provisional, 'siren': None, 'majic': 'PBCGRJ'}
        self.assertEqual(classify([provisional], [A], True), 'unprovable-identifier-change')
        self.assertEqual(classify([majic_only], [provisional], True), 'unprovable-identifier-change')

    def test_different_sirens_are_a_holder_change_even_with_similar_names(self):
        self.assertEqual(classify([A], [{**A, 'siren': '880909346'}], True), 'holder-changed')


class LineageTests(unittest.TestCase):
    """Uses the committed history, so it runs without the raw cadastre inputs."""

    @classmethod
    def setUpClass(cls):
        history = json.loads(OUTPUT.read_text(encoding='utf-8'))
        cls.retired = {p['parcelId']: {s['parcelId'][-4:]: s for s in p['successors']} for p in history['retiredParcels']}
        cls.rows = {r['parcelId']: r for r in history['parcels']}

    def test_boundary_sliver_to_an_existing_parcel_is_not_succession(self):
        sliver = self.retired['212670000D0792']['0793']
        self.assertEqual((sliver['sharedAreaM2'], sliver['successorFirstSeen'], sliver['accepted']), (1.9, '2019-01-01', False))
        self.assertEqual(self.rows['212670000D0793']['predecessorIds'], [])
        self.assertTrue(self.retired['212670000D0792']['0826']['accepted'])

    def test_later_split_is_attributed_to_the_intermediate_parent(self):
        self.assertFalse(self.retired['212670000D0708']['0905']['accepted'])
        self.assertTrue(self.retired['212670000D0873']['0905']['accepted'])
        self.assertEqual(self.rows['212670000D0905']['predecessorIds'], ['212670000D0873'])


if __name__ == '__main__':
    unittest.main()
