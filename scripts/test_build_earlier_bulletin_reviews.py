import unittest

from build_earlier_bulletin_reviews import build, expand, parse_table

COMMUNES = {'Chablis': '89068', 'Chablis Fyé': '89068', 'La Chapelle Vaupeilteigne': '89081'}
PAGE = '\n'.join([
    '          Commune                Section            N°                          Lieu-dit                  Surface',
    'Chablis                      A                            137 Envers de Vaudésirs                             0.216',
    'La Chapelle Vaupeilteigne ZD                                    62 Vau Pulan                              0.526',
    'Chablis Fyé                  R                            982 La Prêle (2)',
    'Chablis Fyé                  R                            981 La Prêle',
    '                                                                                                               0.08',
    '                             C                           1465 Adroit de Vaulardy                             0.1392',
    'Chablis                      A2                           555 Côte de Valmur                                     0.2',
    '                                                                                                    1.1612',
    "(1) seules les parties de ces parcelles situées à plus de 50 m du cours d'eau",
])


class ReferenceExpansion(unittest.TestCase):
    def test_shared_section_and_unusual_tokens_stay_as_printed(self):
        rows = expand({'printedReferences': 'AD 14, 34j, 38; AL 43; A 248, 1365/1366'})
        self.assertEqual(rows, [('AD 14', 'AD0014'), ('AD 34j', None), ('AD 38', 'AD0038'),
                                ('AL 43', 'AL0043'), ('A 248', 'A0248'), ('A 1365/1366', None)])

    def test_reference_without_section_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'without a section'):
            expand({'printedReferences': '12, 13'})


class AnnexTable(unittest.TestCase):
    def table(self, rows=6, total=1.1612):
        return {'pages': [1], 'communes': COMMUNES, 'expectedRows': rows, 'printedTotalHa': total}

    def test_rows_reproduce_the_printed_total_without_copying_a_merged_cell(self):
        rows, shared = parse_table(self.table(), {1: PAGE})
        self.assertEqual(shared, [0.08])
        self.assertEqual([r['printedReference'] for r in rows], ['A 137', 'ZD 62', 'R 982', 'R 981', 'C 1465', 'A2 555'])
        self.assertEqual(rows[1]['communeCode'], '89081')  # long name fills its column
        self.assertIsNone(rows[2]['printedRowAreaHa'])      # merged cell is not copied onto the row
        self.assertIsNone(rows[4]['communeCode'])           # blank commune cell is not inferred
        self.assertIsNone(rows[5]['reference'])             # section A2 is not normalised
        self.assertEqual(rows[0]['lieuDit'], 'Envers de Vaudésirs')

    def test_mismatch_with_the_image_read_total_or_count_fails(self):
        with self.assertRaisesRegex(ValueError, 'image-read'):
            parse_table(self.table(total=1.2), {1: PAGE})
        with self.assertRaisesRegex(ValueError, 'image-read'):
            parse_table(self.table(rows=7), {1: PAGE})

    def test_an_unmapped_commune_row_cannot_pass_unnoticed(self):
        # The row is not attributed to another commune; the image-read total then fails.
        with self.assertRaisesRegex(ValueError, 'Parsed 5 rows'):
            parse_table({**self.table(), 'communes': {'Chablis': '89068', 'Chablis Fyé': '89068'}}, {1: PAGE})


class CommittedReviews(unittest.TestCase):
    def test_committed_departments_rebuild(self):
        for department in ('cote-dor', 'yonne'):
            with self.subTest(department=department):
                result = build(department)
                self.assertTrue(result['parcels'])
                self.assertFalse(any(row['currentFarmerVerified'] for row in result['parcels']))
                for row in result['parcels']:
                    if row['documentDate'] is not None:
                        self.assertLessEqual(row['documentDate'], row['publicationDate'])


if __name__ == '__main__':
    unittest.main()
