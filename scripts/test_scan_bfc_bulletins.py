"""Extraction failures must be recorded, retried and recovered, never cached as empty success."""
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

import scan_bfc_bulletins as scanner

URL = 'https://example.test/file/recueil-bfc-2022-001-recueil-des-actes-administratifs-special.pdf'
CONTENTS = ("Sommaire\nDirection départementale des territoires de la Côte-d'Or / Structures\n"
            "  BFC-2022-01-01-00001 - ARC_TEST DOMAINE (1 page)                 Page 2\n")


class FakeTools:
    """Stands in for curl, pdfinfo, pdftotext, pdftoppm and tesseract."""

    def __init__(self, tesseract_ok=True, contents_ok=True):
        self.tesseract_ok, self.contents_ok, self.calls = tesseract_ok, contents_ok, []

    def __call__(self, argv, **kwargs):
        tool = argv[0]
        self.calls.append(tool)
        done = lambda rc=0, out='', err='': SimpleNamespace(returncode=rc, stdout=out, stderr=err)
        if tool == 'curl':
            Path(argv[argv.index('-o') + 1]).write_bytes(b'%PDF fake')
            return done(out='200')
        if tool == 'pdfinfo':
            return done(out='Pages:           3\n')
        if tool == 'pdftotext':
            first, last = int(argv[argv.index('-f') + 1]), int(argv[argv.index('-l') + 1])
            if first != last:
                return done(out=CONTENTS) if self.contents_ok else done(rc=1, err='Syntax Error')
            return done(out=f'layer {first}')
        if tool == 'pdftoppm':
            Path(argv[-1] + '.png').write_bytes(b'png')
            return done()
        if tool == 'tesseract':
            return done(out='OCR TEXT') if self.tesseract_ok else done(rc=1, err='Failed loading language fra')
        raise AssertionError(tool)


class ScanTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.patch = mock.patch.object(scanner, 'CACHE', Path(self.tmp.name))
        self.patch.start()
        self.record = Path(self.tmp.name) / 'records' / 'bfc-2022-001.json'

    def tearDown(self):
        self.patch.stop()
        self.tmp.cleanup()

    def scan(self, tools):
        with mock.patch.object(scanner, 'run', tools):
            return scanner.scan([URL], jobs=1)

    def test_ocr_failure_is_recorded_retried_and_recovered(self):
        self.assertEqual(self.scan(FakeTools(tesseract_ok=False)), ['bfc-2022-001'])
        record = json.loads(self.record.read_text())
        self.assertEqual(record['failedPages'], [2, 3])
        self.assertEqual(record['pageStatus'], {'2': 'failed:tesseract', '3': 'failed:tesseract'})
        self.assertEqual(record['text']['2'], 'layer 2')  # text-layer output survives a failed OCR fallback
        self.assertFalse(scanner.complete(record))
        self.assertTrue((Path(self.tmp.name) / 'pdf' / 'bfc-2022-001.pdf').exists())  # kept for the retry

        tools = FakeTools()
        self.assertEqual(self.scan(tools), [])
        self.assertNotIn('curl', tools.calls)  # the cached, hash-matched PDF is reused
        record = json.loads(self.record.read_text())
        self.assertEqual((record['failedPages'], record['text']['2'], record['pageStatus']['2']), ([], 'OCR TEXT', 'ocr'))

        tools = FakeTools()
        self.scan(tools)
        self.assertEqual(tools.calls, [])  # a complete record is final

    def test_unreadable_contents_falls_back_to_a_full_read(self):
        self.scan(FakeTools(contents_ok=False))
        record = json.loads(self.record.read_text())
        self.assertEqual((record['contentsStatus'], record['fallbackFullScan'], sorted(record['text'])),
                         ('unreadable', True, ['1', '2', '3']))

    def test_each_page_is_extracted_once_when_acts_overlap(self):
        tools = FakeTools()
        with mock.patch.object(scanner, 'contents', return_value=[
                {'section': "Direction départementale des territoires de la Côte-d'Or", 'title': 'A', 'pages': 1, 'page': 1},
                {'section': "Direction départementale des territoires de la Côte-d'Or", 'title': 'B', 'pages': 1, 'page': 2}]):
            self.scan(tools)
        self.assertEqual(tools.calls.count('tesseract'), 3)


class DownloaderTests(unittest.TestCase):
    def test_throttling_honours_retry_after_and_then_succeeds(self):
        responses = iter([('429', 'Retry-After: 120\n'), ('200', '')])
        slept = []

        def fake_run(argv, **kwargs):
            code, headers = next(responses)
            Path(argv[argv.index('-D') + 1]).write_text(headers)
            return SimpleNamespace(returncode=0, stdout=code, stderr='')
        clock = iter(range(0, 10_000, 1))
        downloader = scanner.Downloader(sleep=slept.append, clock=lambda: next(clock), base_delay=1)
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(scanner, 'run', fake_run):
            self.assertIsNone(downloader.fetch(URL, Path(tmp) / 'x.pdf'))
        self.assertTrue(slept and slept[0] >= 118)

    def test_persistent_failure_is_reported_not_raised(self):
        def fake_run(argv, **kwargs):
            return SimpleNamespace(returncode=92, stdout='', stderr='HTTP/2 stream 1 was not closed cleanly: ENHANCE_YOUR_CALM')
        downloader = scanner.Downloader(sleep=lambda s: None, attempts=2, base_delay=0)
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(scanner, 'run', fake_run):
            self.assertIn('throttled after 2 attempts', downloader.fetch(URL, Path(tmp) / 'x.pdf'))


if __name__ == '__main__':
    unittest.main()
