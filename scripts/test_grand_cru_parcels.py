"""Regression cases absent from this pilot's single-right snapshot."""
import unittest
from build_grand_cru_parcels import add_right, parcel_id, record_match


def row(holder='123456789', right='P - Propriétaire', area='500'):
    result = [''] * 24
    result[:7] = ['21', '0', '267', 'FLAGEY ECHEZEAUX', '', 'A', '7']
    result[13], result[17], result[19], result[23] = area, right, holder, 'TEST ENTITY'
    return result


class RightsJoinTests(unittest.TestCase):
    def test_other_bundle_commune_cannot_fill_an_inao_commune_gap(self):
        import gzip
        import json
        from unittest.mock import patch
        from shapely.geometry import box, mapping
        import build_grand_cru_commune_audit as audit
        # Puligny is absent at the cru; Chassagne covers it, but is not an INAO commune.
        boundary = mapping(box(4.75, 46.95, 4.751, 46.951))
        parent = {'id': 'test-cru', 'geometry': boundary, 'properties': {'communes': ['21512']}}
        raw = json.dumps({'features': [parent]}).encode()
        own = gzip.compress(json.dumps({'features': [{'geometry': mapping(box(4.76, 46.96, 4.761, 46.961))}]}).encode())
        neighbour = gzip.compress(json.dumps({'features': [{'geometry': boundary}]}).encode())
        with patch.object(audit, 'village_map', return_value=({}, raw, 'boundary')), \
             patch.object(audit, 'bundle_commune_names', return_value={}), \
             patch.object(audit, 'cadastre_sources', return_value=[('21512', 'own', 'own'), ('21150', 'other', 'other')]), \
             patch.object(audit, 'communes', return_value=['21512', '21150']), \
             patch.object(audit, 'pinned', side_effect=lambda directory, name, digest: own if digest == 'own' else neighbour):
            with self.assertRaisesRegex(ValueError, 'INAO communes leave .* uncovered'):
                audit.build({'slug': 'test', 'parentFeatureId': 'test-cru'}, {}, None)

    def test_cross_commune_coverage_counts_shared_ground_once(self):
        from shapely.geometry import box
        from build_grand_cru_commune_audit import cross_commune_coverage
        result = cross_commune_coverage(box(0, 0, 10, 10), {
            '21150': box(-2, 0, 6, 10), '21512': box(5, 0, 12, 10),
        })
        self.assertEqual(result['coverageByCommuneM2'], {'21150': 60, '21512': 50})
        self.assertEqual(result['crossCommuneOverlaps'], [{'communes': ['21150', '21512'], 'areaM2': 10}])
        self.assertEqual(result['unionCoverageM2'], 100)

    def test_evidence_references_keep_the_actual_cadastral_section(self):
        from build_grand_cru_evidence import short_reference
        self.assertEqual(short_reference('217160000A0523'), 'A0523')
        self.assertEqual(short_reference('21714000AB0016'), 'AB0016')
        self.assertEqual(short_reference('212670000D0665'), 'D0665')
        self.assertEqual(short_reference('217141050A0012'), '105 A0012')  # absorbed-commune prefix

    def test_reviewed_commune_remainder_cannot_follow_changed_sources(self):
        from build_grand_cru_commune_audit import uncovered_area_limit
        from grand_cru import load_cru
        import copy
        cru, bundle = load_cru('clos-de-vougeot')
        review = cru['communeAudit']['reviewedUncoveredArea']
        self.assertEqual(uncovered_area_limit(cru, bundle, review['parentSourceSha256'], 511156.3651), 1084.3)
        with self.assertRaisesRegex(ValueError, 'changed INAO'):
            uncovered_area_limit(cru, bundle, 'changed-boundary', 511156.3651)
        changed = copy.deepcopy(bundle)
        changed['parcels']['cadastreSha256'] = 'changed-cadastre'
        with self.assertRaisesRegex(ValueError, 'changed cadastre'):
            uncovered_area_limit(cru, changed, review['parentSourceSha256'], 511156.3651)
        unreviewed = {key: value for key, value in cru.items() if key != 'communeAudit'}
        self.assertAlmostEqual(uncovered_area_limit(unreviewed, bundle, review['parentSourceSha256'], 511156.3651), 511.1563651)

    def test_climat_parcels_match_the_committed_parcel_and_map_files(self):
        # Stale climat files would show a Corton Les Bressandes wine another snapshot's parcels.
        from build_grand_cru_climats import generate
        generate(check=True)

    def test_climat_edge_grazes_are_not_climat_parcels(self):
        from build_grand_cru_climats import MINIMUM_CRU_SHARE
        from grand_cru import APP_DIR, read_json
        corton = read_json(APP_DIR / 'corton.climats.json')
        bressandes = corton['climats']['inao-denom-2357']['parcels']
        self.assertEqual(len(bressandes), 65)
        self.assertGreater(corton['excludedEdgeContacts'], 0)
        self.assertEqual(MINIMUM_CRU_SHARE, corton['minimumCruShare'])
        # One Chablis parcel lies across Les Clos and Valmur and counts in both, each with its own area.
        chablis = read_json(APP_DIR / 'chablis-grand-cru.climats.json')['climats']
        split = [chablis[id]['parcels']['890680000A0652'][0] for id in ('inao-denom-443', 'inao-denom-445')]
        self.assertGreater(min(split), 500)

    def test_padded_reference(self):
        self.assertEqual(parcel_id(row()), '212670000A0007')
        invalid = row()
        invalid[2] = '268'
        with self.assertRaises(AssertionError):
            parcel_id(invalid)

    def test_multi_commune_bundle_references(self):
        # Puligny/Chassagne crus span two communes: each keeps its own INSEE code, never the first commune's.
        puligny = row()
        puligny[2] = '512'
        self.assertEqual(parcel_id(puligny, ('21150', '21512')), '215120000A0007')
        from build_grand_cru_rights_history import parcel_id as history_id
        self.assertEqual(history_id(puligny), '215120000A0007')
        with self.assertRaises(AssertionError):
            parcel_id(puligny, ('21150',))

    def test_multiple_rights_and_subdivision_deduplication(self):
        props = {'recordedRights': [], 'recordAreasM2': [], 'cadastreAreaM2': 500}
        self.assertEqual(record_match(props), 'unknown')
        add_right(props, row())
        subdivision = row()
        subdivision[14], subdivision[16] = 'B', '100'
        add_right(props, subdivision)
        self.assertEqual(len(props['recordedRights']), 1)
        add_right(props, row(right='N - Nu-propriétaire'))
        add_right(props, row(holder='U12345678', right='U - Usufruitier'))
        self.assertEqual(len(props['recordedRights']), 3)
        self.assertEqual(props['recordedRights'][0]['siren'], '123456789')
        self.assertIsNone(props['recordedRights'][2]['siren'])
        self.assertEqual(record_match(props), 'reference-and-area')
        add_right(props, row(area='501'))
        self.assertEqual(record_match(props), 'area-mismatch')

    def test_unrecognised_identifiers_fail_closed(self):
        props = {'recordedRights': [], 'recordAreasM2': [], 'cadastreAreaM2': 500}
        for holder in ['', '12345678', 'UNKNOWN']:
            with self.assertRaises(AssertionError):
                add_right(props, row(holder=holder))


if __name__ == '__main__':
    unittest.main()
