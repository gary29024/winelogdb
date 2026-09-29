import copy
import gzip
import json
import unittest

from validate_cotedor_reviews import DEFAULT, validate, validate_data


class DepartmentalReviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        def read(path):
            return json.loads(path.read_text(encoding='utf8'))
        cls.review = read(DEFAULT / 'reviewed-parcels.json')
        cls.audit = read(DEFAULT / 'review-audit.json')
        cls.context = read(DEFAULT / 'reviewed-context.json')
        raw = read(DEFAULT / 'index/notices.json')
        cls.indexed = {n['id']: n for n in (raw['notices'] if isinstance(raw, dict) else raw)}
        cls.pages = {}
        with gzip.open(DEFAULT / 'index/page-text.jsonl.gz', 'rt', encoding='utf8') as stream:
            for line in stream:
                p = json.loads(line)
                cls.pages[(p['url'], p['page'])] = p
        cls.communes = read(DEFAULT.parent / 'bfc-bulletins/cote-dor-communes.json')['communes']

    def check(self, review):
        return validate_data(review, self.audit, self.context, self.pages, self.indexed, self.communes)

    def test_committed_data_and_catalog(self):
        summary = validate()
        self.assertEqual(summary['parcelEvidenceRows'], 186)
        self.assertEqual(summary['distinctPrintedParcels'], 184)

    def test_competing_approvals_are_preserved(self):
        rows = [p for p in self.review['parcels'] if p['communeCode'] == '21405']
        self.assertEqual({p['applicant'] for p in rows}, {'EARL DURY MILLOT', 'GAEC DU MEIX GUILLOT'})
        self.assertEqual(len(rows), 4)
        self.assertTrue(all(p['documentDate'] == '2015-12-09' for p in rows))
        self.check(self.review)

    def test_rejects_notice_area_copied_to_each_parcel(self):
        changed = copy.deepcopy(self.review)
        changed['parcels'][0]['areaHa'] = 16.1082
        with self.assertRaisesRegex(ValueError, 'allocated to multiple'):
            self.check(changed)

    def test_rejects_plausible_but_wrong_commune(self):
        changed = copy.deepcopy(self.review)
        changed['parcels'][0]['communeCode'] = '21714'
        with self.assertRaisesRegex(ValueError, 'commune/code mismatch'):
            self.check(changed)

    def test_rejects_unarchived_evidence_page(self):
        changed = copy.deepcopy(self.review)
        changed['sources'][0]['noticePages'].append(99999)
        with self.assertRaisesRegex(ValueError, 'missing from archive'):
            self.check(changed)

    def test_rejects_source_drift(self):
        changed = copy.deepcopy(self.review)
        changed['sources'][0]['sha256'] = '0' * 64
        with self.assertRaisesRegex(ValueError, 'hash mismatch'):
            self.check(changed)

    def test_rejects_current_farmer_promotion(self):
        changed = copy.deepcopy(self.review)
        changed['sources'][0]['currentFarmerVerified'] = True
        with self.assertRaisesRegex(ValueError, 'cannot verify current farmer'):
            self.check(changed)


if __name__ == '__main__':
    unittest.main()
