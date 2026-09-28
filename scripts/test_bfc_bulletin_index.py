"""Guard the OCR hints and title parsing used to find notices for other crus."""
import unittest

from build_bfc_bulletin_index import KINDS, applicant, hints

COMMUNES = {'21267': 'FLAGEY-ECHEZEAUX', '21714': 'VOSNE-ROMANEE', '21231': 'DIJON'}


def kind(title):
    return next((k for k, pattern in KINDS if pattern.search(title)), 'other')


class HintTests(unittest.TestCase):
    def test_references_after_commune_names_and_in_area_tables(self):
        text = ("situés sur les communes de VOSNE-ROMANEE (AN259, AN283) et FLAGEY-ECHEZEAUX\n(D184, D558, D774) "
                "exploités antérieurement\n| D665 | 0,1157 |\nBP 53317 - 21033 DIJON Cedex")
        communes, refs = hints(text, COMMUNES)
        self.assertEqual(communes, ['21231', '21267', '21714'])  # addresses are included: hints only
        self.assertEqual(refs, ['AN259', 'AN283', 'D184', 'D558', 'D665', 'D774'])

    def test_accented_and_line_broken_commune_names(self):
        communes, refs = hints('commune de Flagey-Échezeaux (OD663, OD78)', COMMUNES)
        self.assertEqual((communes, refs), (['21267'], ['OD663', 'OD78']))


class TitleTests(unittest.TestCase):
    def test_kinds(self):
        self.assertEqual(kind('BFC-2022-11-24-00025 - ARC_GROS ANNE'), 'receipt-complete-application')
        self.assertEqual(kind('BFC-2022-07-04-00011 - 220704 21 partielle SAS DOMAINE RC LES GRANDES VIGNES-1'),
                         'partial-decision')
        self.assertEqual(kind('BFC-2022-11-18-00065 - 221118 21 ns COUDRAY JJACQUES'), 'not-subject-to-authorisation')
        self.assertEqual(kind('BFC-2026-04-07-00015 - AP susp instruc'), 'suspension')
        self.assertEqual(kind('BFC-2023-01-12-00009 - Autorisation IMPLICITE d\'exploiter - EARL X'), 'implicit-authorisation')

    def test_applicant_strips_filing_codes(self):
        self.assertEqual(applicant('BFC-2022-11-24-00025 - ARC_GROS ANNE', 'BFC-2022-11-24-00025'), 'GROS ANNE')
        self.assertEqual(applicant('BFC-2022-07-04-00011 - 220704 21 partielle SAS DOMAINE RC LES GRANDES VIGNES-1',
                                   'BFC-2022-07-04-00011'), 'SAS DOMAINE RC LES GRANDES VIGNES-1')


if __name__ == '__main__':
    unittest.main()
