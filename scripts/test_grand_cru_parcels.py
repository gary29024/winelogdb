"""Regression cases absent from this pilot's single-right snapshot."""
import unittest
from build_grand_cru_parcels import add_right, parcel_id, record_match


def row(holder='123456789', right='P - Propriétaire', area='500'):
    result = [''] * 24
    result[:7] = ['21', '0', '267', 'FLAGEY ECHEZEAUX', '', 'A', '7']
    result[13], result[17], result[19], result[23] = area, right, holder, 'TEST ENTITY'
    return result


class RightsJoinTests(unittest.TestCase):
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
