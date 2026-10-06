"""A printed notice reference needs a unique commune/prefix match and dated scope."""
import json
from pathlib import Path
import tempfile
import unittest

from build_grand_cru_notice_history import load_availability, match_printed_reference, normalized_reference, query_reviewed
from grand_cru_filiation import parse_dfi, trace_ancestry
from test_grand_cru_filiation import pair


class NoticeHistoryTests(unittest.TestCase):
    def test_already_reviewed_notices_are_not_pending_review(self):
        # Michel Gros (bfc-2022-101:p350) was image-reviewed; it must not also be listed as an unreviewed candidate.
        root = Path(__file__).resolve().parents[1]
        history = json.loads((root / 'docs/research/echezeaux/notice-history.json').read_text(encoding='utf-8'))
        reviewed = {m['originalRecord'].get('noticeId') for m in history['reviewedMatches']}
        self.assertIn('bfc-2022-101:p350', reviewed)
        self.assertIn('bfc-2022-101:p350', history['coverage']['searchMatchesAlreadyReviewed'])
        self.assertFalse({c['noticeId'] for c in history['unreviewedCandidates']} & reviewed)
        self.assertEqual(history['coverage']['unreviewedSearchCandidates'], len(history['unreviewedCandidates']))

    def test_dated_retry_preserves_unsearched_years_and_requires_its_report_hash(self):
        audit = load_availability()
        self.assertEqual(audit['checkedAt'], '2026-10-04')
        self.assertEqual(set(audit['departments']), {'21', '89'})
        for department in audit['departments'].values():
            retry = department['acquisitionRetry']
            self.assertEqual(retry['downloadedPDFs'], 0)
            self.assertEqual(retry['imageReviewedPages'], 0)
            self.assertTrue(department['unsearchedIntervals'])
        # The live retry obtained nothing; Yonne's index comes only from archived captures.
        self.assertEqual([r['corpus'] for r in audit['departments']['89']['obtainedIndexRanges']], ['departmental-yonne-archive'])
        for department in audit['departments'].values():
            archive = department['archiveAcquisition']
            self.assertTrue(any(year['noCapture'] for year in archive['publicationYears']))
            self.assertIn('Internet Archive', archive['source'])
        changed_retry = json.loads(json.dumps(audit))
        changed_retry['departments']['21']['archiveRetry']['sha256'] = '0' * 64
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'changed-retry.json'
            path.write_text(json.dumps(changed_retry), encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'acquisition report hash changed'):
                load_availability(path)
        changed = json.loads(json.dumps(audit))
        changed['departments']['21']['archiveAcquisition']['sha256'] = '0' * 64
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'changed-archive.json'
            path.write_text(json.dumps(changed), encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'acquisition report hash changed'):
                load_availability(path)
        audit['departments']['89']['acquisitionRetry']['sha256'] = '0' * 64
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'changed-audit.json'
            path.write_text(json.dumps(audit), encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'acquisition report hash changed'):
                load_availability(path)

    def test_normalization_preserves_section_identity_and_rejects_other_text(self):
        self.assertEqual(normalized_reference(' D 327'), '0D0327')
        self.assertEqual(normalized_reference('AB0001'), 'AB0001')
        self.assertIsNone(normalized_reference('Article D 327'))

    def test_prefix_and_commune_are_not_guessed(self):
        reachable = {'212670000D0327', '212670010D0327', '217160000D0327'}
        self.assertEqual(match_printed_reference('21267', 'D327', reachable), ['212670000D0327', '212670010D0327'])
        self.assertEqual(match_printed_reference(None, 'D327', reachable), [])

    def test_old_notice_keeps_date_reference_and_full_ancestor_path(self):
        parsed = parse_dfi(pair(196, [' D0327'], [' D0736', ' D0737'], '19910122'), department_code='210', insee_department='21')
        ancestry = trace_ancestry(['212670000D0736'], parsed['events'], geometry_as_of='2026-06-01')
        record = {'communeCode': '21267', 'reference': 'D0327', 'printedReference': 'D 327',
                  'documentDate': '1990-03-01', 'areaHa': 0.01, 'status': 'application-received'}
        result = query_reviewed(record, {'212670000D0327', '212670000D0736'}, {'212670000D0736'}, ancestry, parsed['events'])
        self.assertEqual(result['originalDate'], '1990-03-01')
        self.assertEqual(result['originalPrintedReference'], 'D 327')
        self.assertEqual(result['originalRecord']['areaHa'], 0.01)
        self.assertEqual(result['directCurrentParcelIds'], [])
        self.assertEqual(result['contextPaths'][0]['referencePath'], ['212670000D0736', '212670000D0327'])
        self.assertIsNone(result['currentFarmer'])
        self.assertEqual(result['contextPaths'][0]['assignment'], 'unassigned-context')

    def test_unresolved_act_date_withholds_direct_and_ancestor_assignment(self):
        # RAA n° 4 of 31 January 2013 prints a decision dated "3 décembre 2013": no chronology check is possible.
        parsed = parse_dfi(pair(196, [' D0327'], [' D0736', ' D0737'], '19910122'), department_code='210', insee_department='21')
        ancestry = trace_ancestry(['212670000D0736'], parsed['events'], geometry_as_of='2026-06-01')
        current = {'communeCode': '21267', 'reference': 'D0736', 'printedReference': 'D 736', 'documentDate': None}
        result = query_reviewed(current, {'212670000D0736'}, {'212670000D0736'}, ancestry, parsed['events'])
        self.assertEqual(result['directCurrentParcelIds'], [])
        self.assertEqual(result['directMatchWithheld'], 'notice-act-date-unresolved')
        former = {**current, 'reference': 'D0327', 'printedReference': 'D 327'}
        result = query_reviewed(former, {'212670000D0327', '212670000D0736'}, {'212670000D0736'}, ancestry, parsed['events'])
        self.assertEqual({p['assignment'] for p in result['contextPaths']}, {'unassigned-context'})
        self.assertIn('notice-act-date-unresolved', result['contextPaths'][0]['qualifications'])
        self.assertNotIn('directMatchWithheld', result)

    def test_collective_commune_table_does_not_assign_a_current_parcel(self):
        record = {'communeCode': '21267', 'reference': 'D0665', 'printedReference': 'D665',
                  'documentDate': '2022-07-04', 'noticeId': 'bfc-2022-084:p171'}
        result = query_reviewed(record, {'212670000D0665'}, {'212670000D0665'}, [], [])
        self.assertEqual(result['directCurrentParcelIds'], [])
        self.assertEqual(result['referenceMatch'], 'printed-row-commune-not-assigned')


if __name__ == '__main__':
    unittest.main()
