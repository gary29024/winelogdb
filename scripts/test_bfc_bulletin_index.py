"""Guard the OCR hints and title parsing used to find notices for other crus."""
import copy
import json
import tempfile
import unittest
from pathlib import Path

from build_bfc_bulletin_index import KINDS, applicant, build, check, hints, write_outputs

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


URLS = ['https://example.test/recueil-bfc-2022-001-recueil-des-actes-administratifs.pdf',
        'https://example.test/recueil-bfc-2022-002-recueil-des-actes-administratifs.pdf',
        'https://example.test/recueil-bfc-2022-003-recueil-des-actes-administratifs.pdf']
ENTRY = {'section': "Direction départementale des territoires de la Côte-d'Or / Structures",
         'title': 'BFC-2022-04-04-00033 - SARL DOMAINE MICHEL GROS', 'pages': 1, 'page': 2}


def record(url, entries, text, status, failed=()):
    return {'schemaVersion': 2, 'url': url, 'sha256': '0' * 64, 'pages': 4, 'contentsStatus': 'read',
            'tocEntries': 3, 'coteDorEntries': entries, 'fallbackFullScan': False, 'failedPages': list(failed),
            'text': text, 'pageStatus': status}


class CheckTests(unittest.TestCase):
    """--check must catch missing coverage, missing page text and mis-cited acts, offline."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.out, cache = root / 'out', root / 'cache'
        (cache / 'records').mkdir(parents=True)
        self.out.mkdir()
        (self.out / 'links-2022.txt').write_text('\n'.join(URLS) + '\n')
        # A blank separator page (2) is valid; it is extracted, just empty.
        (cache / 'records' / 'bfc-2022-001.json').write_text(json.dumps(record(
            URLS[0], [ENTRY], {'2': '', '3': 'FLAGEY-ECHEZEAUX (D184)', '4': ''},
            {'2': 'ocr', '3': 'ocr', '4': 'text-layer'})))
        (cache / 'records' / 'bfc-2022-002.json').write_text(json.dumps(record(URLS[1], [], {}, {})))
        # bfc-2022-003 has no record: it must be reported, not dropped.
        self.coverage, self.notices, self.texts = build(URLS, cache, {'21267': 'FLAGEY-ECHEZEAUX'})
        write_outputs(self.out, self.coverage, self.notices, self.texts)
        self.reviewed = {'statuses': {'application-received': ''}, 'parcels': [{
            'noticeId': 'bfc-2022-001:p2', 'actId': 'BFC-2022-04-04-00033', 'documentDate': '2022-04-04',
            'communeCode': '21267', 'printedReference': 'D184', 'reference': 'D0184', 'status': 'application-received',
            'reviewedAt': '2026-09-28', 'reviewMethod': 'image'}]}

    def tearDown(self):
        self.tmp.cleanup()

    def check(self, reviewed=None):
        return check(self.out, {'21267': 'FLAGEY-ECHEZEAUX'}, reviewed or self.reviewed)

    def test_valid_index_passes_and_unscanned_bulletins_are_reported(self):
        self.assertEqual(len(self.check()), 1)
        status = {c['bulletin']: c['status'] for c in self.coverage}
        self.assertEqual(status['bfc-2022-003'], 'not-scanned')

    def test_missing_coverage_file(self):
        (self.out / 'coverage.json').unlink()
        with self.assertRaisesRegex(ValueError, 'coverage.json is missing'):
            self.check()

    def test_bulletin_dropped_from_coverage(self):
        write_outputs(self.out, self.coverage[:-1], self.notices, self.texts)
        with self.assertRaisesRegex(ValueError, 'Coverage does not match the link lists'):
            self.check()

    def test_emptied_notice_pages(self):
        texts = copy.deepcopy(self.texts)
        texts[0]['pages'] = {}
        write_outputs(self.out, self.coverage, self.notices, texts)
        with self.assertRaisesRegex(ValueError, 'page text or status missing'):
            self.check()

    def test_undeclared_failed_page(self):
        texts = copy.deepcopy(self.texts)
        texts[0]['pageStatus']['3'] = 'failed:tesseract'
        write_outputs(self.out, self.coverage, self.notices, texts)
        with self.assertRaisesRegex(ValueError, 'failed pages not declared'):
            self.check()

    def test_reviewed_row_citing_another_act(self):
        reviewed = copy.deepcopy(self.reviewed)
        reviewed['parcels'][0]['actId'] = 'BFC-2026-04-07-00015'
        with self.assertRaisesRegex(ValueError, 'act or date differs'):
            self.check(reviewed)

    def test_tampered_summary(self):
        doc = json.loads((self.out / 'coverage.json').read_text())
        doc['summary']['coteDorNotices'] += 1
        (self.out / 'coverage.json').write_text(json.dumps(doc))
        with self.assertRaisesRegex(ValueError, 'summary does not match'):
            self.check()

    def test_record_without_page_status_must_be_rescanned(self):
        cache = Path(self.tmp.name) / 'cache'
        legacy = json.loads((cache / 'records' / 'bfc-2022-001.json').read_text())
        del legacy['pageStatus'], legacy['schemaVersion']
        (cache / 'records' / 'bfc-2022-001.json').write_text(json.dumps(legacy))
        with self.assertRaisesRegex(ValueError, 'rescan it'):
            build(URLS, cache, {'21267': 'FLAGEY-ECHEZEAUX'})


if __name__ == '__main__':
    unittest.main()
