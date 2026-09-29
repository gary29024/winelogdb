"""Departmental extraction must preserve page alignment and regional research."""
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from bulletin_archive import Archive
import index_cotedor_bulletins as indexer

URL = 'https://example.test/2016.pdf'
PDF = b'%PDF-1.4\noriginal\n%%EOF\n'


class DepartmentalIndexTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.archive = Archive(self.root)
        self.source = self.root / 'original.pdf'
        self.source.write_bytes(PDF)
        self.archive.import_pdf(URL, self.source, 'cote-dor-2016')
        self.row = dict(self.archive.document(URL))
        (self.root / 'departmental-scans').mkdir()

    def tearDown(self):
        self.archive.close()
        self.tmp.cleanup()

    def record(self):
        return {'url': URL, 'corpus': 'cote-dor-2016', 'sha256': self.row['sha256'], 'pages': 2,
                'extractionVersion': indexer.VERSION, 'text': {'1': 'A' * 500, '2': 'sparse'},
                'pageStatus': {'1': 'text-layer', '2': 'pending:ocr'}}

    def test_full_text_seeding_preserves_pdf_page_numbers_and_marks_sparse_pages(self):
        results = [SimpleNamespace(returncode=0, stdout='Pages: 2'),
                   SimpleNamespace(returncode=0, stdout='A' * 500 + '\fsparse\f')]
        with patch.object(indexer, 'command', side_effect=results):
            record = indexer.seed_record(self.row, self.source)
        self.assertEqual(record['pageStatus'], {'1': 'text-layer', '2': 'pending:ocr'})
        self.assertEqual(record['text']['2'], 'sparse')

    def test_misaligned_text_is_not_assigned_to_the_wrong_source_pages(self):
        results = [SimpleNamespace(returncode=0, stdout='Pages: 2'),
                   SimpleNamespace(returncode=0, stdout='A' * 500 + '\f')]
        with patch.object(indexer, 'command', side_effect=results):
            record = indexer.seed_record(self.row, self.source)
        self.assertEqual(record['text'], {'1': '', '2': ''})
        self.assertTrue(all(s == 'pending:ocr' for s in record['pageStatus'].values()))
        self.assertIsNotNone(record['textLayerError'])

    def test_resume_only_ocrs_pending_pages_and_keeps_regional_entries(self):
        other = 'https://example.test/regional.pdf'
        self.archive.import_pdf(other, self.source, 'regional-bfc')
        self.archive.index_scan({'url': other, 'sha256': self.row['sha256'], 'text': {'1': 'regional evidence'},
                                 'pageStatus': {'1': 'text-layer'}})
        indexer.save_record(self.archive, self.record())
        with patch.object(indexer, 'seed_record') as seed, \
                patch.object(indexer, 'ocr_page', return_value=('French notice', 'ocr')) as ocr:
            indexer.extract_one(self.root, self.row, 'ocr')
        seed.assert_not_called()
        self.assertEqual(ocr.call_args.args[1:], (2, 'sparse'))
        self.assertEqual(len(self.archive.search('French notice')), 1)
        self.assertEqual(len(self.archive.search('regional evidence')), 1)
        with patch.object(indexer, 'ocr_page') as ocr:
            indexer.extract_one(self.root, self.row, 'ocr')
        ocr.assert_not_called()
        self.assertEqual(self.archive.db.execute('SELECT count(*) FROM pages').fetchone()[0], 3)

    def test_export_counts_pending_pages_and_keeps_unresolved_sources(self):
        indexer.save_record(self.archive, self.record())
        self.archive.enqueue_alternates([{'url': 'https://example.test/share', 'title': 'RAA 4'}],
                                        'cote-dor-2016', 'https://example.test/year')
        summary = indexer.export_index(self.root, self.root / 'index')
        self.assertEqual(summary['documentReferences'], 2)
        self.assertEqual(summary['indexedPages'], 2)
        self.assertEqual(summary['pendingPages'], 1)
        self.assertEqual(summary['completePDFs'], 0)

    def test_candidates_are_unreviewed_pages_with_source_citations_not_invented_farmers(self):
        record = self.record()
        record['text']['2'] = "21-2016-05-02-001 AUTORISATION D'EXPLOITER\nFLAGEY ECHEZEAUX (D184)"
        candidates = indexer.candidate_pages(record, {'21267': 'FLAGEY ECHEZEAUX'})
        self.assertEqual(len(candidates), 1)
        row = candidates[0]
        self.assertEqual(row['url'], URL + '#page=2')
        self.assertEqual(row['reviewStatus'], 'unreviewed')
        self.assertEqual(row['extractionStatus'], 'pending:ocr')
        self.assertNotIn('currentFarmer', row)
        self.assertEqual(row['actIdHints'], ['21-2016-05-02-001'])

    def test_departmental_contents_preserve_sections_ranges_and_repeated_act_sources(self):
        record = self.record()
        record['pages'] = 6
        record['text'] = {str(p): 'content' for p in range(1, 7)}
        record['pageStatus'] = {str(p): 'text-layer' for p in range(1, 7)}
        record['pageStatus']['4'] = 'pending:ocr'
        record['text']['1'] = ("RECUEIL\nSommaire\nDirection Départementale des Territoires\n"
                               "  21-2020-01-02-001 - Autorisation d'exploiter EARL EXEMPLE (1 page) Page 3\n"
                               "Préfecture de la Côte-d'Or\n"
                               "  21-2020-01-02-002 - Délégation de signature (1 page) Page 5\n")
        entries, parsed = indexer.notice_entries(record, {})
        self.assertTrue(parsed)
        self.assertEqual(len(entries), 1)
        self.assertEqual((entries[0]['firstPage'], entries[0]['lastPage']), (3, 4))
        self.assertEqual(entries[0]['pendingPages'], [4])
        self.assertEqual(entries[0]['reviewStatus'], 'unreviewed')
        self.assertTrue(entries[0]['farmStructures'])

    def test_legacy_contents_are_not_mislabelled_as_a_complete_notice_index(self):
        record = self.record()
        record['text']['1'] = "SOMMAIRE\nAutorisation d'exploiter.............2"
        entries, parsed = indexer.notice_entries(record, {})
        self.assertEqual(entries, [])
        self.assertFalse(parsed)

    def test_applicant_hint_requires_an_explicit_notification_title(self):
        self.assertEqual(indexer.applicant_hint("Demande d'autorisation d'exploiterNotification de décisionEARL BLIN"), 'EARL BLIN')
        self.assertIsNone(indexer.applicant_hint('Arrêté relatif aux structures agricoles'))


if __name__ == '__main__':
    unittest.main()
