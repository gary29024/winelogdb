"""Guard how rights changes are labelled: names never prove identity, a SIREN does."""
import unittest

from build_echezeaux_rights_history import classify

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


if __name__ == '__main__':
    unittest.main()
