"""Coverage discovery and cache provenance must survive releases, gaps and reruns."""
from pathlib import Path
import tempfile
import unittest
from unittest.mock import MagicMock, patch

import inventory_grand_cru_sources as sources


class SourceInventoryTests(unittest.TestCase):
    def test_downloader_decodes_http_compression_but_preserves_gzip_resources(self):
        import gzip
        from grand_cru import fetch
        raw = b'%PDF official schema'
        response = MagicMock()
        response.__enter__.return_value = response
        response.headers = {'Content-Encoding': 'gzip'}
        response.read.return_value = gzip.compress(raw)
        with patch('grand_cru.urllib.request.urlopen', return_value=response):
            self.assertEqual(fetch('https://publisher/schema.pdf'), raw)
            response.headers = {}
            self.assertEqual(fetch('https://publisher/parcelles.json.gz'), gzip.compress(raw))

    def test_latest_dated_schema_is_discovered_without_a_2025_cutoff(self):
        catalogue = {'attachments': [{'id': f'documents_de_filiation_informatises_descriptif_du_fichier_janvier{year}_pdf', 'url': 'x'}
                                     for year in [2025, 2027]]}
        self.assertEqual(sources.dfi_schema(catalogue)[0], '2027-01')

    def test_absolute_and_relative_intermediate_geometry_vintages_are_all_kept(self):
        html = '<a href="/cadastre/etalab-cadastre/2017-07-06/">a</a><a href="2017-10-12/">b</a>'
        self.assertEqual(sources.geometry_releases(html), ['2017-07-06', '2017-10-12'])

    def test_annual_release_inventory_has_no_2019_or_2025_cutoff(self):
        catalogue = {'attachments': [{'id': f'fichier_des_parcelles_situation_{year}_dpts_01_a_56_zip', 'url': 'x'}
                                      for year in [2018, 2019, 2025, 2027]]}
        self.assertEqual([r['asOf'] for r in sources.rights_releases(catalogue, '21')],
                         ['2018-01-01', '2019-01-01', '2025-01-01', '2027-01-01'])

    def test_yonne_never_uses_the_cote_dor_archive(self):
        self.assertTrue(sources.archive_covers('fichier_des_parcelles_situation_2025_dpts_57_a_976_zip', '89'))
        self.assertFalse(sources.archive_covers('fichier_des_parcelles_situation_2025_dpts_01_a_56_zip', '89'))
        self.assertTrue(sources.archive_covers('documents_de_filiation_informatises_situation_juillet_20266_dept_50_a_dept_976zip', '89', dfi=True))
        self.assertFalse(sources.archive_covers('documents_de_filiation_informatises_situation_juillet_2026_dept2a0_a_dept49zip', '89', dfi=True))
        self.assertTrue(sources.archive_covers('documents_de_filiations_informatises_situation_janvier_2024_dept_590_a_dept_976_zip', '89', dfi=True))

    def test_repeat_import_preserves_exact_original_retrieval_time(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(sources, 'SHARED_DIR', Path(directory)), \
                patch.object(sources, 'fetch_resource', return_value=(b'official bytes', {})) as fetch:
            source = {'id': 'geometry-21267-2017-07-06', 'url': 'https://files.data.gouv.fr/a', 'fileName': 'a.gz'}
            first = sources.acquire(source)
            second = sources.acquire(source)
            self.assertEqual(fetch.call_count, 1)
            self.assertEqual(first['retrievedAt'], second['retrievedAt'])
            self.assertEqual(first['sha256'], second['sha256'])

    def test_failed_url_remains_a_gap_and_is_retried_only_when_requested(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(sources, 'SHARED_DIR', Path(directory)), \
                patch.object(sources, 'fetch_resource', side_effect=OSError('HTTP 404')) as fetch:
            source = {'id': 'missing', 'url': 'https://files.data.gouv.fr/missing.gz', 'fileName': 'missing.gz'}
            first = sources.acquire(source)
            second = sources.acquire(source)
            self.assertEqual(first, second)
            self.assertEqual(first['status'], 'missing')
            self.assertEqual(first['reason'], 'HTTP 404')
            self.assertEqual(fetch.call_count, 1)
            sources.acquire(source, retry_missing=True)
            self.assertEqual(fetch.call_count, 2)

    def test_shared_cache_does_not_silently_reuse_another_source_identity(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(sources, 'SHARED_DIR', Path(directory)), \
                patch.object(sources, 'fetch_resource', return_value=(b'bytes', {})):
            source = {'id': 'a', 'url': 'https://files.data.gouv.fr/a', 'fileName': 'a.gz'}
            sources.acquire(source)
            with self.assertRaisesRegex(ValueError, 'identity collision'):
                sources.acquire({**source, 'url': 'https://files.data.gouv.fr/changed'})


if __name__ == '__main__':
    unittest.main()
