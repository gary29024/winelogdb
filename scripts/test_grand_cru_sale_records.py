"""Deed groups keep original references and ambiguous historical scope."""
import csv
import io
import json
import unittest
from unittest.mock import patch
import zipfile

import build_grand_cru_sale_records as sales
from grand_cru_filiation import parse_dfi, trace_ancestry
from test_grand_cru_filiation import pair


class HistoricalSaleTests(unittest.TestCase):
    def test_many_to_many_deed_context_keeps_complete_original_group_and_date(self):
        roots = ['212670000D0736']
        events = parse_dfi(pair(196, [' D0327', ' D0328'], [' D0736', ' D0737'], '20190122'),
                           department_code='210', insee_department='21')['events']
        ancestry = trace_ancestry(roots, events, geometry_as_of='2026-06-01')
        history = {'parcels': [{'documentedAncestry': a} for a in ancestry], 'documentedEvents': events}
        asset = json.dumps({'features': [{'properties': {'id': roots[0], 'overlaps': [{'parentFeatureId': 'cru'}]}}]}).encode()
        csv_data = io.StringIO()
        writer = csv.DictWriter(csv_data, fieldnames=['l_codinsee', 'l_idpar', 'idmutinvar', 'datemut', 'libnatmut', 'nbdispo'], delimiter='|')
        writer.writeheader()
        writer.writerow({'l_codinsee': '{21267,21714}', 'l_idpar': '{212670000D0327,21714000AB0001}',
                         'idmutinvar': 'original-deed', 'datemut': '2017-03-01', 'libnatmut': 'Echange', 'nbdispo': '2'})
        writer.writerow({'l_codinsee': '{21267}', 'l_idpar': '{212670000D0736}',
                         'idmutinvar': 'current-deed', 'datemut': '2024-02-03', 'libnatmut': 'Vente', 'nbdispo': '1'})
        archive = io.BytesIO()
        with zipfile.ZipFile(archive, 'w') as z:
            z.writestr('deeds.csv', csv_data.getvalue())
        config = {'fileName': 'fixture.zip', 'member': 'deeds.csv', 'sha256': 'fixture', 'url': 'https://example.test',
                  'dataset': 'DVF+', 'licence': 'Open Licence', 'release': 'fixture'}
        with patch.object(sales, 'parcel_asset', return_value=asset), patch.object(sales, 'read_json', return_value=history), \
                patch.object(sales, 'pinned', return_value=archive.getvalue()):
            result = sales.build({'slug': 'fixture', 'parentFeatureId': 'cru'}, {'saleRecords': config}, {'sha256': 'asset'}, '.')
        self.assertEqual(result['deeds'][0]['parcelIds'], roots)
        deed = result['historicalDeeds'][0]
        self.assertEqual(deed['date'], '2017-03-01')
        self.assertEqual(deed['dateRole'], 'deed-date')
        self.assertEqual(deed['originalParcelIds'], ['212670000D0327', '21714000AB0001'])
        self.assertEqual(deed['nature'], 'exchange')
        self.assertEqual(deed['dispositions'], 2)
        self.assertEqual(deed['contextPaths'][0]['assignment'], 'unassigned-context')
        self.assertEqual(deed['contextPaths'][0]['referencePath'], ['212670000D0736', '212670000D0327'])
        self.assertNotIn('buyer', deed)
        self.assertNotIn('price', deed)


if __name__ == '__main__':
    unittest.main()
