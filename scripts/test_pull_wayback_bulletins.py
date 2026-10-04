import io
import tempfile
import unittest
import urllib.error
from pathlib import Path

from bulletin_archive import Archive
from pull_wayback_bulletins import ALTERNATES_TRIED, attach_alternates, filename_year, listing_links, pull, report

PDF = b'%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'


class FakeClient:
    def __init__(self, responses):
        self.responses, self.requested = responses, []

    def captures(self, url):
        return []

    def get(self, url):
        self.requested.append(url)
        result = self.responses[url]
        if isinstance(result, Exception):
            raise result
        return result


def sources(pdfs, listing=True):
    entry = {'publicationYear': 2009, 'corpus': 'yonne-2009', 'pdfs': pdfs,
             'listing': {'waybackUrl': 'https://web.archive.org/web/20221204091308id_/https://x/RAA-2009',
                         'captureTimestamp': '20221204091308', 'sha256': 'a' * 64} if listing else None}
    return {'departments': {'89': {'years': [entry], 'undated': {'corpus': 'yonne-undated', 'pdfs': []}}}}


class Parsing(unittest.TestCase):
    def test_filename_years(self):
        self.assertEqual(filename_year('https://x/IMG/pdf/RAA30062004.pdf'), 2004)
        self.assertEqual(filename_year('https://x/IMG/pdf/2010_raa_005.pdf'), 2010)
        self.assertEqual(filename_year('https://x/file/recueil-89-2019-074-recueil-des-actes.pdf'), 2019)
        self.assertIsNone(filename_year('https://x/IMG/pdf/RAA_014-2.pdf'))
        self.assertIsNone(filename_year('https://x/file/recueil%20n%C2%B08.pdf'))

    def test_listing_links_strip_wayback_prefix_and_normalise(self):
        page = ('<a href="/web/20221204091308/https://www.yonne.gouv.fr/content/download/1/2/file/a.pdf">a</a>'
                '<a href="http://www.yonne.gouv.fr:80/content/download/3/4/file/b.pdf#page=2">b</a>'
                '<a href="/Publications/other">x</a><a href="https://example.org/c.pdf">c</a>')
        self.assertEqual(listing_links(page, 'https://www.yonne.gouv.fr/Publications/RAA-2009'), [
            'https://www.yonne.gouv.fr/content/download/1/2/file/a.pdf',
            'https://www.yonne.gouv.fr/content/download/3/4/file/b.pdf'])


class Pull(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.dir.cleanup)

    def test_stores_under_original_url_and_records_gaps(self):
        good, gone, bad = (f'https://www.yonne.gouv.fr/f/{n}.pdf' for n in 'abc')
        snap = 'https://web.archive.org/web/20221204091308id_/'
        client = FakeClient({
            snap + good: ('https://web.archive.org/web/20150101000000id_/' + good, PDF),
            snap + gone: urllib.error.HTTPError(snap + gone, 404, 'Not Found', {}, io.BytesIO()),
            snap + bad: ('https://web.archive.org/x', b'<html>error</html>')})
        data = sources([{'url': u, 'basis': 'archived-listing'} for u in (good, gone, bad)])
        with Archive(Path(self.dir.name)) as archive:
            self.assertEqual(pull(archive, client, data, departments=['89']), 3)
            row = archive.document(good)
            self.assertEqual((row['state'], row['corpus']), ('downloaded', 'yonne-2009'))
            self.assertIn('20150101000000id_', row['final_url'])
            self.assertEqual(archive.document(gone)['state'], 'unavailable')
            self.assertEqual(archive.document(bad)['state'], 'retry')
            result = report(archive, data)['corpora'][0]
            self.assertEqual((result['downloaded'], result['noCapture'], result['pending']), (1, [gone], [bad]))
            # Rerun: downloaded and confirmed-missing captures are not requested again.
            client.requested.clear()
            client.responses[snap + bad] = ('https://web.archive.org/web/1id_/' + bad, PDF)
            pull(archive, client, data, departments=['89'])
            self.assertEqual(client.requested, [snap + bad])

    def test_truncated_capture_falls_back_then_records_gap(self):
        good, bad = 'https://www.cote-dor.gouv.fr/IMG/pdf/RAA_017.pdf', 'https://www.cote-dor.gouv.fr/IMG/pdf/RAA_014-2.pdf'
        cut = PDF[:-8]  # no %%EOF: a crawler truncation
        client = FakeClient({
            'https://web.archive.org/web/2026id_/' + good: ('https://web.archive.org/web/2019id_/' + good, cut),
            'https://web.archive.org/web/2019id_/' + good: ('https://web.archive.org/web/2019id_/' + good, cut),
            'https://web.archive.org/web/2015id_/' + good: ('https://web.archive.org/web/2015id_/' + good, PDF),
            'https://web.archive.org/web/2026id_/' + bad: ('https://web.archive.org/web/2019id_/' + bad, cut),
            'https://web.archive.org/web/2019id_/' + bad: ('https://web.archive.org/web/2019id_/' + bad, cut)})
        client.captures = lambda url: [{'timestamp': '2015'}, {'timestamp': '2019'}] if url == good else [{'timestamp': '2019'}]
        data = sources([{'url': u, 'basis': 'undated-capture'} for u in (good, bad)], listing=False)
        with Archive(Path(self.dir.name)) as archive:
            pull(archive, client, data, departments=['89'])
            self.assertIn('2015id_', archive.document(good)['final_url'])
            row = archive.document(bad)
            self.assertEqual(row['state'], 'unavailable')
            self.assertIn('All 1 captures are incomplete', row['error'])

    def test_alternate_spelling_of_same_document_id(self):
        listed = 'https://www.yonne.gouv.fr/contenu/telechargement/3908/24523/file/Recueil+sp%C3%A9cial+3+juin+2008.pdf'
        mangled = 'https://www.yonne.gouv.fr/contenu/telechargement/3908/24523/file/Recueil+sp%EF%BF%BD%EF%BF%BDcial+3+juin+2008.pdf'
        other = 'https://www.yonne.gouv.fr/contenu/telechargement/1/2/file/x.pdf'
        data = sources([{'url': u, 'basis': 'archived-listing'} for u in (listed, other)])
        attach_alternates(data['departments']['89'], {listed, mangled, 'https://www.yonne.gouv.fr/IMG/x.pdf'})
        self.assertEqual(data['departments']['89']['years'][0]['pdfs'][0]['alternateCaptureUrls'], [mangled])
        self.assertNotIn('alternateCaptureUrls', data['departments']['89']['years'][0]['pdfs'][1])
        snap = 'https://web.archive.org/web/20221204091308id_/'
        gone = lambda u: urllib.error.HTTPError(u, 404, 'Not Found', {}, io.BytesIO())
        client = FakeClient({snap + listed: gone(snap + listed), snap + other: gone(snap + other),
                             'https://web.archive.org/web/2026id_/' + mangled: ('https://web.archive.org/web/2012id_/' + mangled, PDF)})
        with Archive(Path(self.dir.name)) as archive:
            # A row already marked unavailable before alternates were known is retried once.
            archive.enqueue([listed], 'yonne-2009')
            archive.db.execute("UPDATE documents SET state='unavailable',error='No Internet Archive capture of this URL' WHERE url=?", (listed,))
            pull(archive, client, data, departments=['89'])
            row = archive.document(listed)
            self.assertEqual(row['state'], 'downloaded')
            self.assertIn(mangled, row['final_url'])
            self.assertEqual(archive.document(other)['state'], 'unavailable')

    def test_unlisted_pdf_uses_latest_capture(self):
        url = 'https://www.cote-dor.gouv.fr/IMG/pdf/RAA31032005.pdf'
        client = FakeClient({'https://web.archive.org/web/2026id_/' + url: ('https://web.archive.org/web/2006id_/' + url, PDF)})
        with Archive(Path(self.dir.name)) as archive:
            pull(archive, client, sources([{'url': url, 'basis': 'filename-dated-capture'}], listing=False), departments=['89'])
            self.assertEqual(archive.document(url)['state'], 'downloaded')

    def test_explicit_retry_recovers_missing_capture_and_preserves_existing_pdf(self):
        good, missing, still_missing = (f'https://www.yonne.gouv.fr/f/{name}.pdf'
                                       for name in ('good', 'missing', 'still-missing'))
        snap = 'https://web.archive.org/web/20221204091308id_/'
        gone = lambda u: urllib.error.HTTPError(u, 404, 'Not Found', {}, io.BytesIO())
        client = FakeClient({snap + good: (snap + good, PDF),
                             snap + missing: gone(snap + missing),
                             snap + still_missing: gone(snap + still_missing)})
        data = sources([{'url': u, 'basis': 'archived-listing'} for u in (good, missing, still_missing)])
        with Archive(Path(self.dir.name)) as archive:
            pull(archive, client, data, departments=['89'])
            good_sha = archive.document(good)['sha256']
            client.requested.clear()
            client.responses[snap + missing] = (snap + missing, PDF)
            self.assertEqual(pull(archive, client, data, departments=['89'],
                                  retry_unavailable=True, limit=1), 1)
            self.assertEqual(client.requested, [snap + missing])
            self.assertEqual(archive.document(missing)['state'], 'downloaded')
            self.assertEqual(archive.document(still_missing)['state'], 'unavailable')
            self.assertEqual(archive.document(good)['sha256'], good_sha)
            self.assertEqual(archive.db.execute('SELECT count(*) FROM attempts WHERE url=?',
                                               (missing,)).fetchone()[0], 2)

    def test_retry_preserves_exact_cdx_timestamp_and_original_http_url(self):
        url = 'https://www.cote-dor.gouv.fr/IMG/pdf/RAA_020.pdf'
        nearest = 'https://web.archive.org/web/2026id_/' + url
        original = 'http://www.cote-dor.gouv.fr:80/IMG/pdf/RAA_020.pdf'
        exact = 'https://web.archive.org/web/20191114172218id_/' + original
        client = FakeClient({nearest: urllib.error.HTTPError(nearest, 404, 'Not Found', {}, io.BytesIO()),
                             exact: (exact, PDF)})
        client.captures = lambda u: [{'timestamp': '20191114172218', 'original': original}]
        with Archive(Path(self.dir.name)) as archive:
            archive.enqueue([url], 'cote-dor-undated')
            archive.db.execute("UPDATE documents SET state='unavailable' WHERE url=?", (url,))
            pull(archive, client, sources([{'url': url, 'basis': 'undated-capture'}], listing=False),
                 departments=['89'], retry_unavailable=True)
            self.assertEqual(client.requested, [nearest, exact])
            self.assertEqual(archive.document(url)['final_url'], exact)
            self.assertEqual(archive.document(url)['state'], 'downloaded')

    def test_report_counts_duplicate_inventory_urls_once(self):
        url = 'https://www.yonne.gouv.fr/f/duplicate.pdf'
        item = {'url': url, 'basis': 'archived-listing'}
        with Archive(Path(self.dir.name)) as archive:
            archive.enqueue([url], 'yonne-2009')
            archive.db.execute("UPDATE documents SET state='unavailable' WHERE url=?", (url,))
            row = report(archive, sources([item, item]))['corpora'][0]
            self.assertEqual(row['listedPDFs'], 1)
            self.assertEqual(row['duplicateInventoryEntries'], 1)
            self.assertEqual(row['noCapture'], [url])


if __name__ == '__main__':
    unittest.main()
