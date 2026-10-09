"""Earlier departmental acquisition must preserve gaps and host cooldowns."""
import http.client
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock

from bulletin_archive import Archive
from pull_grand_cru_notice_bulletins import pull, targets
from test_bulletin_archive import PDF, Response


class EarlierNoticeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.now = 1000.0
        self.opener = Mock(side_effect=http.client.RemoteDisconnected('Remote end closed connection without response'))
        self.archive = Archive(Path(self.tmp.name), clock=lambda: self.now, opener=self.opener)

    def tearDown(self):
        self.archive.close()
        self.tmp.cleanup()

    def test_requested_ranges_are_independent_and_annual_paths_are_not_obtained(self):
        selected = targets(['89', '21'])
        self.assertEqual([t['publicationYear'] for t in selected if t['department'] == '21'], list(range(2004, 2016)))
        self.assertEqual([t['publicationYear'] for t in selected if t['department'] == '89'], list(range(2008, 2027)))
        self.assertTrue(all('not an obtained' in t['urlBasis'] for t in selected))

    def test_connection_failure_defers_sibling_years_without_claiming_downloads(self):
        result = pull(self.archive, max_wait=0)
        self.assertEqual(self.opener.call_count, 2)  # one listing attempt per host
        self.assertEqual(result['summary']['unobtainedListings'], 31)
        self.assertEqual(result['summary']['downloadedPDFs'], 0)
        self.assertEqual(result['summary']['pdfAttemptsThisRun'], 0)
        self.assertEqual(result['summary']['knownPDFs'], 2)
        self.assertEqual(len(result['listingRequestsThisRun']), 2)
        self.assertTrue(all(r['attemptedAt'].endswith('Z') for r in result['listingRequestsThisRun']))
        self.assertTrue(all(r['state'] == 'retry' for r in result['listingRequestsThisRun']))
        deferred = [y for y in result['years'] if y['listing']['attempts'] == 0]
        self.assertEqual(len(deferred), 29)
        self.assertTrue(all(y['listing']['deferredReasonThisRun'] for y in deferred))
        again = pull(self.archive, max_wait=0)
        self.assertEqual(self.opener.call_count, 2)
        self.assertEqual(again['summary']['listingRequestsThisRun'], 0)
        self.now += 10000
        later = pull(self.archive, max_wait=0)
        self.assertEqual(self.opener.call_count, 4)
        self.assertEqual({r['corpus'] for r in later['listingRequestsThisRun']}, {'cote-dor-2005', 'yonne-2009'})

    def test_yonne_never_downloads_or_reports_cotedor_sources(self):
        result = pull(self.archive, ['89'], max_wait=0)
        self.assertEqual(self.opener.call_count, 1)
        self.assertEqual(result['summary']['requestedPublicationYears'], 19)
        self.assertEqual(result['summary']['knownPDFs'], 1)
        self.assertTrue(all(y['corpus'].startswith('yonne-') for y in result['years']))
        self.assertTrue(all('yonne.gouv.fr' in d['url'] for y in result['years'] for d in y['documents']))

    def test_saved_listings_reuse_pdf_hashes_and_do_not_imply_extraction_or_review(self):
        selected = targets(['89'])
        for target in selected:
            url = target['url'] + '/bulletin.pdf'
            html = self.archive.root / f'{target["publicationYear"]}.html'
            html.write_text(f'<html><a href="{url}">PDF</a></html>', encoding='utf-8')
            self.archive.discover(html, target['url'], target['corpus'])
        self.opener.side_effect = None
        self.opener.return_value = Response(PDF)
        result = pull(self.archive, ['89'], limit=1, min_interval=0, max_wait=0)
        self.assertEqual(result['summary']['savedListings'], 19)
        self.assertEqual(result['summary']['downloadedPDFs'], 1)
        self.assertEqual(result['summary']['extractedPages'], 0)
        doc = next(d for y in result['years'] for d in y['documents'] if d['state'] == 'downloaded')
        self.assertRegex(doc['sha256'], r'^[0-9a-f]{64}$')
        self.assertEqual(doc['bytes'], len(PDF))
        self.assertTrue(doc['retrievedAt'].endswith('Z'))
        self.assertTrue((self.archive.root / doc['archiveObject']).is_file())
        self.assertIsNone(doc['sourceReleaseDate'])
        self.assertIsNone(doc['licence'])
        self.assertIn('do not constitute page-image review', result['limitation'])

    def test_invalid_selection_and_unbounded_wait_are_rejected_before_network(self):
        for departments in ([], ['71']):
            with self.assertRaises(ValueError):
                pull(self.archive, departments)
        with self.assertRaises(ValueError):
            pull(self.archive, max_wait=61)
        self.opener.assert_not_called()


if __name__ == '__main__':
    unittest.main()
