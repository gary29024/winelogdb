"""Exercise the #411 threshold on geometry, and fallback on multiple generations."""
import unittest

from grand_cru_spatial_lineage import observed_geometry, spatial_candidates, trace_spatial_ancestry

M, I, C, N = ('212670000D' + n for n in ['0001', '0002', '0003', '0004'])


class SpatialLineageTests(unittest.TestCase):
    def test_invalid_source_geometry_is_not_silently_repaired(self):
        from shapely.geometry import Polygon, box
        invalid = Polygon([(0, 0), (2, 2), (2, 0), (0, 2), (0, 0)])
        with self.assertRaisesRegex(ValueError, 'Invalid historical geometry requires source review'):
            observed_geometry(invalid, box(0, 0, 3, 3), M, '2017-07-06')
        self.assertIsNone(observed_geometry(invalid, box(10, 10, 13, 13), M, '2017-07-06'))

    def test_existing_boundary_sliver_and_below_95_percent_are_rejected(self):
        from shapely.geometry import box
        vintages = [('2017-07-06', {M: box(0, 0, 10, 10), N: box(9.8, 0, 19.8, 10)}),
                    ('2017-10-12', {C: box(0, 0, 5, 10), N: box(9.8, 0, 19.8, 10), I: box(5, 0, 11, 10)})]
        candidates = spatial_candidates(vintages, {d: {'21267'} for d, _ in vintages},
                                        cru_shape=box(0, 0, 20, 20), minimum_overlap=1, inside_share=.95)
        by_daughter = {c['daughterId']: c for c in candidates}
        self.assertTrue(by_daughter[C]['accepted'])
        self.assertFalse(by_daughter[N]['accepted'])
        self.assertEqual(by_daughter[N]['reason'], 'successor-already-observed')
        self.assertFalse(by_daughter[I]['accepted'])
        self.assertEqual(by_daughter[I]['reason'], 'below-inside-threshold')

    def test_two_spatial_generations_keep_the_retired_intermediate(self):
        from shapely.geometry import box
        vintages = [('2017-07-06', {M: box(0, 0, 10, 10)}), ('2017-10-12', {I: box(0, 0, 5, 10)}),
                    ('2018-01-02', {C: box(0, 0, 2, 10)})]
        candidates = spatial_candidates(vintages, {d: {'21267'} for d, _ in vintages},
                                        cru_shape=box(0, 0, 20, 20), minimum_overlap=1, inside_share=.95)
        ancestry, conflicts = trace_spatial_ancestry([C], candidates, [])
        self.assertEqual(conflicts, [])
        oldest = next(p for p in ancestry[0]['paths'] if p['referenceId'] == M)
        self.assertEqual(oldest['referencePath'], [C, I, M])
        self.assertEqual(len(oldest['candidatePath']), 2)
        self.assertEqual(oldest['method'], 'spatial-inference')

    def test_official_group_takes_precedence_and_conflict_is_unassigned(self):
        candidates = [{'id': 'spatial', 'motherId': M, 'daughterId': C, 'accepted': True,
                       'lastMotherObservation': '2017-07-06', 'nextObtainedVintage': '2017-10-12'}]
        events = [{'id': 'official', 'motherIds': [I], 'daughterIds': [C]}]
        rows, conflicts = trace_spatial_ancestry([C], candidates, events)
        self.assertEqual(rows[0]['paths'], [])
        self.assertEqual(rows[0]['terminals'][0]['reason'], 'documented-dfi-correspondence-takes-precedence')
        self.assertEqual(conflicts[0]['assignment'], 'unassigned')


if __name__ == '__main__':
    unittest.main()
