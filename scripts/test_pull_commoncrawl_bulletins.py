import gzip
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock

import pull_commoncrawl_bulletins as cc
from bulletin_archive import Archive
from test_bulletin_archive import PDF, Response


class Matching(unittest.TestCase):
    def test_listed_url_or_same_document_id_only(self):
        listed = 'https://www.yonne.gouv.fr/contenu/telechargement/3908/24523/file/Recueil+sp%C3%A9cial+3+juin+2008.pdf'
        generic = 'https://www.yonne.gouv.fr/contenu/telechargement/3578/22923/file/recueil%20n%C2%B05.pdf'
        records = [
            {'url': 'http://yonne.gouv.fr/content/download/3908/24523/file/Recueil%20sp%EF%BF%BD%EF%BF%BDcial.pdf'},  # same ID
            {'url': 'http://www.yonne.gouv.fr/content/download/9856/59623/file/recueil%20n%C2%B05.pdf'},  # same name, other year
            {'url': 'https://www.yonne.gouv.fr/contenu/telechargement/3578/22923/file/recueil n°5.pdf'},  # listed URL, decoded
        ]
        found = cc.matches([listed, generic], records)
        self.assertEqual(found[listed], [records[0]])
        self.assertEqual(found[generic], [records[2]])

    def test_identical_ids_from_another_publisher_do_not_match(self):
        listed = 'https://www.yonne.gouv.fr/content/download/3908/24523/file/notice.pdf'
        unrelated = {'url': 'https://www.cote-dor.gouv.fr/content/download/3908/24523/file/notice.pdf'}
        self.assertEqual(cc.matches([listed], [unrelated]), {})

    def test_all_listed_aliases_of_one_publisher_record_are_retained(self):
        urls = ['https://www.yonne.gouv.fr/content/download/3908/24523/file/notice.pdf',
                'https://www.yonne.gouv.fr/contenu/telechargement/3908/24523/file/notice-2.pdf']
        record = {'url': urls[0]}
        self.assertEqual(cc.matches(urls, [record]), {url: [record] for url in urls})


class RangeRequest(unittest.TestCase):
    def test_full_response_is_not_read_as_a_ranged_warc_record(self):
        response = Response()
        with mock.patch.object(cc.urllib.request, 'urlopen', return_value=response), \
             mock.patch.object(response, 'read') as read, mock.patch.object(cc.time, 'sleep'):
            with self.assertRaises(ValueError):
                cc.request(cc.DATA + 'test.warc.gz', 10, 14)
        read.assert_not_called()

    def test_server_range_must_match_requested_offsets(self):
        with mock.patch.object(cc.urllib.request, 'urlopen',
                               return_value=Response(b'abcde', 206, {'Content-Range': 'bytes 10-14/100'})):
            self.assertEqual(cc.request(cc.DATA + 'test.warc.gz', 10, 14), b'abcde')


class Recovery(unittest.TestCase):
    def test_fresh_archive_resume_and_lost_object_recovery(self):
        url = 'https://www.yonne.gouv.fr/content/download/3908/24523/file/notice.pdf'
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            sources = root / 'sources.json'
            sources.write_text(json.dumps({'departments': {'89': {
                'years': [{'corpus': 'yonne-2008', 'pdfs': [{'url': url}]}],
                'undated': {'corpus': 'yonne-undated', 'pdfs': []}}}}), encoding='utf-8')
            scan = root / 'scan.jsonl'
            scan.write_text(json.dumps({'url': url, 'timestamp': '20200101000000',
                'filename': 'test.warc.gz', 'offset': '10', 'length': '100', 'crawl': 'CC-MAIN-2020-01'}) + '\n', encoding='utf-8')
            with Archive(root / 'archive') as archive, mock.patch.object(cc, 'SOURCES', sources), \
                 mock.patch.object(cc, 'warc_body', return_value=(200, {'WARC-Record-ID': 'test-id'}, PDF)) as fetch:
                self.assertEqual(cc.recover(archive, scan), 1)
                self.assertEqual(archive.document(url)['corpus'], 'yonne-2008')
                self.assertEqual(cc.recover(archive, scan), 0)
                fetch.assert_called_once()
                archive.local_pdf(url).unlink()
                self.assertEqual(cc.recover(archive, scan), 1)
                self.assertEqual(fetch.call_count, 2)


class WarcRecord(unittest.TestCase):
    def test_body_and_record_id_are_read_from_one_ranged_record(self):
        record = (b'WARC/1.0\r\nWARC-Type: response\r\nWARC-Record-ID: <urn:uuid:1>\r\n\r\n'
                  b'HTTP/1.1 200 OK\r\nContent-Type: application/pdf\r\n\r\n%PDF-1.4 body %%EOF')
        with mock.patch.object(cc, 'request', return_value=gzip.compress(record)) as get:
            status, headers, body = cc.warc_body({'filename': 'crawl-data/x.warc.gz', 'offset': '10', 'length': '5'})
        get.assert_called_once_with(cc.DATA + 'crawl-data/x.warc.gz', 10, 14)
        self.assertEqual((status, headers['WARC-Record-ID'], body), (200, '<urn:uuid:1>', b'%PDF-1.4 body %%EOF'))


if __name__ == '__main__':
    unittest.main()
