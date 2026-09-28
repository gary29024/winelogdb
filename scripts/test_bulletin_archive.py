"""Exercise durable acquisition and integrity without contacting a government site."""
import hashlib
import io
import json
import tempfile
import unittest
import urllib.error
from email.utils import formatdate
from pathlib import Path
from unittest.mock import Mock

from bulletin_archive import Archive, Deferred, InvalidPDF, retry_after, writer_lock

PDF = b'%PDF-1.4\npublic test document\n%%EOF\n'
URL = 'https://example.test/archive/one.pdf'
OTHER = 'https://example.test/another/one.pdf'


class Response(io.BytesIO):
    def __init__(self, body=PDF, status=200, headers=None):
        super().__init__(body)
        self.status, self.headers = status, headers or {'Content-Length': str(len(body))}

    def geturl(self):
        return URL


class ArchiveTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.now = 1000.0
        self.open = Mock(return_value=Response())
        self.archive = Archive(self.root, clock=lambda: self.now, opener=self.open)

    def tearDown(self):
        self.archive.close()
        self.tmp.cleanup()

    def advance(self):
        self.now += 10000

    def test_cache_survives_restart_without_network_and_deduplicates(self):
        first = self.archive.fetch_one(URL)
        self.assertEqual(first.read_bytes(), PDF)
        self.archive.close()
        self.archive = Archive(self.root, clock=lambda: self.now, opener=self.open)
        self.assertEqual(self.archive.fetch_one(URL), first)
        self.assertEqual(self.open.call_count, 1)
        self.advance()
        self.open.return_value = Response()
        self.assertEqual(self.archive.fetch_one(OTHER), first)
        self.assertEqual(self.archive.status()['pdfObjects'], 1)
        self.assertEqual(self.archive.status()['coverage'][0]['documents'], 2)

    def test_same_basename_different_urls_never_overwrite(self):
        first = self.archive.fetch_one(URL)
        self.advance()
        self.open.return_value = Response(PDF.replace(b'test', b'other'))
        second = self.archive.fetch_one(OTHER)
        self.assertNotEqual(first, second)
        self.assertEqual(first.read_bytes(), PDF)

    def test_retry_after_persists_and_cools_down_sibling_urls(self):
        self.open.side_effect = urllib.error.HTTPError(URL, 429, 'Too Many Requests', {'Retry-After': '150'}, None)
        self.assertIsNone(self.archive.fetch_one(URL))
        self.archive.close()
        self.archive = Archive(self.root, clock=lambda: self.now, opener=self.open)
        with self.assertRaises(Deferred):
            self.archive.fetch_one(OTHER)
        self.assertEqual(self.open.call_count, 1)
        self.assertEqual(self.archive.document(URL)['state'], 'retry')
        self.assertGreaterEqual(self.archive.due_at(self.archive.document(OTHER)), 1150)
        self.open.side_effect = None
        self.advance()
        self.open.return_value = Response()
        self.assertIsNotNone(self.archive.fetch_one(URL))

    def test_date_retry_after_and_connection_failure_have_durable_cooldown(self):
        self.assertEqual(retry_after(formatdate(1300, usegmt=True), 1000), 300)
        self.assertEqual(retry_after('invalid', 1000), 0)
        self.open.side_effect = ConnectionResetError('connection reset')
        self.assertIsNone(self.archive.fetch_one(URL))
        with self.assertRaises(Deferred):
            self.archive.fetch_one(OTHER)
        self.assertEqual(self.archive.document(URL)['attempts'], 1)

    def partial(self, etag='"v1"'):
        self.open.return_value = Response(PDF[:15], headers={'Content-Length': str(len(PDF)), 'ETag': etag, 'Accept-Ranges': 'bytes'})
        self.assertIsNone(self.archive.fetch_one(URL))
        self.advance()

    def test_validated_resume_appends_only_matching_range(self):
        self.partial()
        self.open.return_value = Response(PDF[15:], 206, {'Content-Length': str(len(PDF)-15), 'ETag': '"v1"',
                                                        'Content-Range': f'bytes 15-{len(PDF)-1}/{len(PDF)}'})
        self.assertEqual(self.archive.fetch_one(URL).read_bytes(), PDF)
        headers = dict(self.open.call_args.args[0].header_items())
        self.assertEqual(headers['Range'], 'bytes=15-')
        self.assertEqual(headers['If-range'], '"v1"')

    def test_ignored_range_replaces_partial_instead_of_appending(self):
        self.partial()
        replacement = PDF.replace(b'public', b'updated')
        self.open.return_value = Response(replacement)
        self.assertEqual(self.archive.fetch_one(URL).read_bytes(), replacement)

    def test_without_strong_validator_partial_is_restarted(self):
        self.partial('W/"v1"')
        self.open.return_value = Response()
        self.assertEqual(self.archive.fetch_one(URL).read_bytes(), PDF)
        self.assertNotIn('Range', dict(self.open.call_args.args[0].header_items()))

    def test_mismatched_range_validator_is_never_committed(self):
        self.partial()
        self.open.return_value = Response(PDF[15:], 206, {'ETag': '"v2"', 'Content-Range': f'bytes 15-{len(PDF)-1}/{len(PDF)}'})
        self.assertIsNone(self.archive.fetch_one(URL))
        self.assertIsNone(self.archive.local_pdf(URL))
        self.assertFalse(list((self.root / 'partials').glob('*.part')))

    def test_http_error_body_does_not_poison_partial(self):
        self.partial()
        part = next((self.root / 'partials').glob('*.part'))
        original = part.read_bytes()
        self.open.side_effect = urllib.error.HTTPError(URL, 503, 'Unavailable', {'Retry-After': '60'}, io.BytesIO(b'<html>Error</html>'))
        self.assertIsNone(self.archive.fetch_one(URL))
        self.assertEqual(part.read_bytes(), original)

    def test_html_success_and_permanent_errors_are_blocked(self):
        self.open.return_value = Response(b'<html>Denied</html>')
        self.assertIsNone(self.archive.fetch_one(URL))
        self.assertEqual(self.archive.document(URL)['state'], 'blocked')
        self.advance()
        with self.assertRaises(Deferred):
            self.archive.fetch_one(URL)
        self.open.side_effect = urllib.error.HTTPError(OTHER, 404, 'Not Found', {}, None)
        self.assertIsNone(self.archive.fetch_one(OTHER))
        self.assertEqual(self.archive.document(OTHER)['state'], 'blocked')

    def test_pinned_source_drift_is_blocked_and_old_copy_is_retained(self):
        expected = hashlib.sha256(PDF).hexdigest()
        self.archive.enqueue([URL], expected={URL: expected})
        original = self.archive.fetch_one(URL)
        self.advance()
        self.open.return_value = Response(PDF.replace(b'test', b'changed'))
        self.assertIsNone(self.archive.fetch_one(URL, refresh=True))
        self.assertEqual(original.read_bytes(), PDF)
        self.assertEqual(self.archive.document(URL)['state'], 'blocked')

    def test_explicit_refresh_304_and_missing_local_file(self):
        self.open.return_value = Response(headers={'ETag': '"v1"'})
        local = self.archive.fetch_one(URL)
        self.advance()
        self.open.side_effect = urllib.error.HTTPError(URL, 304, 'Not Modified', {}, None)
        self.assertEqual(self.archive.fetch_one(URL, refresh=True), local)
        self.assertEqual(dict(self.open.call_args.args[0].header_items())['If-none-match'], '"v1"')
        local.unlink()
        self.assertEqual(self.archive.verify()['missingOrCorrupt'], [URL])
        self.advance()
        self.open.side_effect = None
        self.open.return_value = Response()
        self.assertEqual(self.archive.fetch_one(URL).read_bytes(), PDF)
        self.assertNotIn('If-none-match', dict(self.open.call_args.args[0].header_items()))

    def test_batch_does_not_sleep_through_rate_limit_or_redownload_success(self):
        self.archive.enqueue([URL, OTHER])
        self.open.side_effect = urllib.error.HTTPError(URL, 429, 'Limited', {'Retry-After': '3600'}, None)
        result = self.archive.fetch_batch(limit=100, max_wait=0)
        self.assertEqual(result['attempted'], 1)
        self.assertEqual(self.archive.fetch_batch(limit=100, max_wait=0)['attempted'], 0)

    def test_cooldown_on_one_host_does_not_stop_another_selected_corpus(self):
        other = 'https://other.test/one.pdf'
        self.archive.enqueue([URL], 'cote-dor-2016')
        self.archive.enqueue([other], 'cote-dor-2018')
        self.open.side_effect = [urllib.error.HTTPError(URL, 429, 'Limited', {'Retry-After': '3600'}, None), Response()]
        result = self.archive.fetch_batch(limit=10, max_wait=0, corpus=['cote-dor-2016', 'cote-dor-2018'])
        self.assertEqual(result['attempted'], 2)
        self.assertEqual(self.archive.document(other)['state'], 'downloaded')

    def test_failing_early_url_does_not_starve_unattempted_documents(self):
        first, second = 'https://example.test/a.pdf', 'https://example.test/b.pdf'
        self.archive.enqueue([first, second])
        self.open.side_effect = ConnectionResetError('closed')
        self.archive.fetch_batch(limit=1, max_wait=0)
        self.advance()
        self.open.side_effect = None
        self.open.return_value = Response()
        self.archive.fetch_batch(limit=1, max_wait=0)
        self.assertEqual(self.open.call_args.args[0].full_url, second)
        self.assertEqual(self.archive.document(first)['state'], 'retry')

    def test_captured_manifests_accept_windows_checkout_line_endings(self):
        from pull_cotedor_bulletins import pull
        from unittest.mock import patch
        text = URL + '\n'
        path = self.root / 'links-2020.txt'
        path.write_bytes(text.replace('\n', '\r\n').encode())
        source = self.root / 'sources.json'
        source.write_text(json.dumps({'years': [{'year': 2020, 'url': 'https://example.test/2020',
                                               'manifestFile': path.name, 'manifestSha256': hashlib.sha256(text.encode()).hexdigest(),
                                               'listingSha256': '0'*64, 'pdfCount': 1}]}))
        with patch('pull_cotedor_bulletins.SOURCES', source):
            result = pull(self.archive, {2020}, discover_only=True)
        self.assertEqual(result['years'][0]['discoveredPDFs'], 1)
        self.open.assert_not_called()

    def test_browser_saved_listing_keeps_provenance_and_deduplicates(self):
        source = self.root / 'listing.html'
        source.write_text('<html><a href="/docs/one.pdf">One</a><a href="/docs/one.pdf#page=2">Again</a>'
                          '<a href="/docs/two.PDF?download=1">Two</a><a href="/next">Next</a></html>')
        result = self.archive.discover(source, 'https://example.test/year/2020', 'cote-dor-2020')
        self.assertEqual(result['linksDiscovered'], 2)
        self.assertTrue(Path(result['savedListing']).exists())
        self.assertEqual(self.archive.status()['coverage'][0]['corpus'], 'cote-dor-2020')
        self.assertEqual(self.archive.db.execute('SELECT count(*) FROM discoveries').fetchone()[0], 2)

    def test_listing_failure_shares_cooldown_with_pdf_downloads(self):
        self.open.side_effect = urllib.error.HTTPError(URL, 429, 'Limited', {'Retry-After': '150'}, None)
        result = self.archive.fetch_listing('https://example.test/year/2020', 'cote-dor-2020')
        self.assertIn('error', result)
        with self.assertRaises(Deferred):
            self.archive.fetch_one(URL)
        self.assertEqual(self.archive.status()['listings'][0]['state'], 'retry')

    def test_local_import_checks_pin_and_writers_are_exclusive(self):
        path = self.root / 'seed.pdf'
        path.write_bytes(PDF)
        self.archive.enqueue([URL], expected={URL: '0'*64})
        with self.assertRaises(InvalidPDF):
            self.archive.import_pdf(URL, path)
        with writer_lock(self.root):
            with self.assertRaises(RuntimeError):
                self.archive.import_pdf(OTHER, path)

    def test_offline_scan_reuses_pdf_and_indexes_full_departmental_text(self):
        import scan_bfc_bulletins as scanner
        from test_scan_bfc_bulletins import FakeTools
        from unittest.mock import patch
        source = self.root / 'seed.pdf'
        source.write_bytes(PDF)
        self.archive.import_pdf(URL, source, 'cote-dor-2020')
        tools = FakeTools()
        with patch.object(scanner, 'CACHE', self.root / 'scans'), patch.object(scanner, 'run', tools):
            self.assertEqual(scanner.scan([URL], archive_dir=self.root, offline=True, full_text=True), [])
        self.assertNotIn('curl', tools.calls)
        self.assertEqual(self.archive.status()['searchablePages'], 3)
        result = self.archive.search('ocr text', corpus='cote-dor-2020')
        self.assertEqual(len(result), 3)
        self.assertTrue(all(r['localPdf'] and r['status'] == 'ocr' for r in result))
        self.assertEqual(self.open.call_count, 0)

    def test_page_retry_keeps_successful_extraction_without_repeating_ocr(self):
        import scan_bfc_bulletins as scanner
        from test_scan_bfc_bulletins import FakeTools
        from unittest.mock import patch
        source = self.root / 'seed.pdf'
        source.write_bytes(PDF)
        with patch.object(scanner, 'run', FakeTools()):
            record = scanner.process(URL, source, True, full_text=True)
        record['pageStatus']['2'] = 'failed:tesseract'
        record['failedPages'] = [2]
        tools = FakeTools()
        with patch.object(scanner, 'run', tools):
            result = scanner.process(URL, source, True, previous=record, full_text=True)
        self.assertEqual(result['failedPages'], [])
        self.assertEqual(tools.calls.count('tesseract'), 1)

    def test_five_year_pull_records_blocked_discovery_without_claiming_coverage(self):
        from pull_cotedor_bulletins import pull
        from unittest.mock import patch
        self.open.side_effect = ConnectionResetError('closed connection')
        # A first-time source set has no captured manifests yet.
        source = self.root / 'sources.json'
        source.write_text(json.dumps({'years': [{'year': year, 'url': f'https://example.test/{year}'}
                                               for year in range(2016, 2021)]}))
        with patch('pull_cotedor_bulletins.SOURCES', source):
            result = pull(self.archive, set(range(2016, 2021)), max_wait=0)
        self.assertEqual(len(result['years']), 5)
        self.assertEqual(self.open.call_count, 1)
        self.assertTrue(all(r['downloadedPDFs'] == 0 for r in result['years']))
        self.assertFalse(any(r['listing']['state'] == 'saved' for r in result['years']))
        self.assertTrue((self.root / 'manifests/cote-dor-2016-2020.json').exists())

    def test_captured_manifests_seed_all_five_years_without_refetching_listings(self):
        from pull_cotedor_bulletins import pull
        result = pull(self.archive, set(range(2016, 2021)), discover_only=True)
        self.assertEqual([r['discoveredPDFs'] for r in result['years']], [61, 63, 73, 78, 97])
        self.assertTrue(all(r['listing']['state'] == 'saved-manifest' for r in result['years']))
        self.assertEqual(len(result['years'][2]['unresolvedDownloadLinks']), 5)
        self.open.assert_not_called()

    def test_unattended_runner_records_completion_without_sleeping(self):
        from pull_cotedor_bulletins import run_until_complete
        from unittest.mock import patch
        report = {'years': [{'downloadedPDFs': 1, 'unresolvedDownloadLinks': [], 'listing': {'state': 'saved'}}]}
        with patch('pull_cotedor_bulletins.pull', return_value=report), patch('pull_cotedor_bulletins.time.sleep') as sleep:
            run_until_complete(self.archive, {2020})
        sleep.assert_not_called()
        self.assertEqual(json.loads((self.root / 'run-status.json').read_text())['phase'], 'finished')

    def test_unattended_runner_leaves_work_durable_at_runtime_limit(self):
        from pull_cotedor_bulletins import run_until_complete
        from unittest.mock import patch
        self.archive.enqueue([URL], 'cote-dor-2020')
        def batch(*args, **kwargs):
            self.now += 2
            return {'years': [{'downloadedPDFs': 0, 'unresolvedDownloadLinks': [], 'listing': {'state': 'saved'}}]}
        with patch('pull_cotedor_bulletins.pull', side_effect=batch), patch('pull_cotedor_bulletins.time.sleep') as sleep:
            run_until_complete(self.archive, {2020}, max_runtime=1)
        sleep.assert_not_called()
        self.assertEqual(json.loads((self.root / 'run-status.json').read_text())['phase'], 'paused-runtime-limit')
        self.assertEqual(self.archive.document(URL)['state'], 'pending')

    def test_strict_index_import_and_search_are_offline(self):
        from bulletin_archive import ROOT
        self.archive.import_index(ROOT / 'docs/research/bfc-bulletins')
        rows = self.archive.search('Flagey Echezeaux', limit=2)
        self.assertEqual(len(rows), 2)
        self.assertTrue(all(r['status'] in ('text-layer', 'ocr', 'ocr-no-text-layer') for r in rows))
        self.open.assert_not_called()

    def test_legacy_flag_cannot_hide_invalid_current_schema(self):
        from bulletin_archive import ROOT
        with self.assertRaisesRegex(ValueError, 'original corpus'):
            self.archive.import_index(ROOT / 'docs/research/bfc-bulletins', legacy_search_hints=True)

    def test_empty_listing_is_not_complete_discovery(self):
        self.open.return_value = Response(b'<html><body>Try again later</body></html>')
        self.assertIn('error', self.archive.fetch_listing('https://example.test/year/2020', 'cote-dor-2020'))
        self.assertEqual(self.archive.status()['listings'][0]['state'], 'retry')


if __name__ == '__main__':
    unittest.main()
