"""DFI regressions, including the two official source-checked pre-2019 examples."""
import unittest

from grand_cru_filiation import full_parcel_id, historical_evidence_paths, parse_dfi, trace_ancestry


def pair(document, mothers, daughters, validation='19900101', lot='00001', commune='267', nature='1', prefix='000'):
    header = f'210;{commune};{prefix};{document:07d};{nature};{validation};XXXXXREDACTEURDUDOCUMENTXXXXXX;XNUMX;{lot};'
    return (header + '1;' + ''.join(p + ';' for p in mothers) + '\n'
            + header + '2;' + ''.join(p + ';' for p in daughters) + '\n').encode()


def parse(data):
    return parse_dfi(data, department_code='210', insee_department='21', as_of='2026-07-01')


def trace(ids, data):
    parsed = parse(data)
    return trace_ancestry(ids, parsed['events'], geometry_as_of='2026-06-01'), parsed


P = lambda printed: full_parcel_id('21', '267', '000', printed)


class OfficialFiliationTests(unittest.TestCase):
    def test_verified_1991_echezeaux_lot(self):
        rows, parsed = trace([P(' D0736'), P(' D0737')], pair(196, [' D0327'], [' D0736', ' D0737'], '19910122'))
        self.assertEqual(parsed['issues'], [])
        self.assertTrue(parsed['events'][0]['traceable'])
        self.assertEqual(parsed['events'][0]['id'], '210:267:000:0000196:00001')
        for row in rows:
            self.assertEqual(row['earliestValidationDate'], '1991-01-22')
            self.assertEqual(row['ancestorIds'], [P(' D0327')])
            self.assertEqual(row['terminals'][0]['reason'], 'source-boundary-or-unrecorded-event')

    def test_verified_1989_vougeot_lot_preserves_outside_daughter(self):
        data = pair(52, [' A0022'], [' A0408', ' A0409', ' A0410'], '19890420', commune='716')
        rows, parsed = trace(['217160000A0408', '217160000A0410'], data)
        self.assertEqual(parsed['events'][0]['daughterIds'], ['217160000A0408', '217160000A0409', '217160000A0410'])
        self.assertEqual(rows[0]['earliestValidationDate'], '1989-04-20')
        self.assertEqual(rows[0]['ancestorIds'], ['217160000A0022'])
        self.assertEqual({r['parcelId'] for r in rows}, {'217160000A0408', '217160000A0410'})

    def test_multiple_generations_keep_retired_intermediate_and_full_path(self):
        data = pair(1, [' D0001'], [' D0002'], '19890101') + pair(2, [' D0002'], [' D0003'], '20010101')
        rows, _ = trace([P(' D0003')], data)
        self.assertEqual(rows[0]['ancestorIds'], [P(' D0001'), P(' D0002')])
        oldest = next(p for p in rows[0]['paths'] if p['referenceId'] == P(' D0001'))
        self.assertEqual(oldest['referencePath'], [P(' D0003'), P(' D0002'), P(' D0001')])
        self.assertEqual(len(oldest['eventPath']), 2)
        self.assertEqual(rows[0]['earliestValidationDate'], '1989-01-01')

    def test_many_to_many_lot_is_one_group_and_evidence_is_unassigned(self):
        data = pair(1, [' D0001', ' D0002'], [' D0003', ' D0004'])
        rows, parsed = trace([P(' D0003')], data)
        self.assertEqual(len(parsed['events']), 1)
        self.assertEqual(parsed['events'][0]['scope'], 'many-to-many-event-group')
        paths = historical_evidence_paths(rows, parsed['events'], P(' D0001'), '1989-01-01')
        self.assertEqual(paths[0]['assignment'], 'unassigned-context')
        self.assertIn('ambiguous-many-to-many-scope', paths[0]['qualifications'])
        self.assertEqual(paths[0]['originalReferenceId'], P(' D0001'))

    def test_merge_keeps_partial_scope_unassigned(self):
        rows, parsed = trace([P(' D0003')], pair(1, [' D0001', ' D0002'], [' D0003']))
        paths = historical_evidence_paths(rows, parsed['events'], P(' D0001'), '1989-01-01')
        self.assertEqual(paths[0]['assignment'], 'unassigned-context')
        self.assertIn('partial-current-parcel-scope', paths[0]['qualifications'])

    def test_date_conflict_does_not_rewrite_original_record(self):
        rows, parsed = trace([P(' D0002')], pair(1, [' D0001'], [' D0002']))
        paths = historical_evidence_paths(rows, parsed['events'], P(' D0001'), '2000-01-01')
        self.assertEqual(paths[0]['assignment'], 'unassigned-context')
        self.assertEqual(paths[0]['originalDate'], '2000-01-01')
        self.assertIn('record-on-or-after-retirement-validation', paths[0]['qualifications'])

    def test_missing_daughter_row_is_kept_for_review(self):
        parsed = parse(pair(1, [' D0001'], [' D0002']).splitlines(keepends=True)[0])
        self.assertEqual(len(parsed['events']), 1)
        self.assertFalse(parsed['events'][0]['traceable'])
        self.assertIn('missing-row-pair', {p['kind'] for p in parsed['issues']})

    def test_missing_mother_row_stops_traversal(self):
        rows, parsed = trace([P(' D0002')], pair(1, [' D0001'], [' D0002']).splitlines(keepends=True)[1])
        self.assertFalse(parsed['events'][0]['traceable'])
        self.assertEqual(rows[0]['terminals'][0]['reason'], 'unresolved-dfi-event')

    def test_malformed_reference_is_not_guessed(self):
        parsed = parse(pair(1, ['D001'], [' D0002']))
        self.assertFalse(parsed['events'][0]['traceable'])
        self.assertEqual(parsed['events'][0]['printedMothers'], ['D001'])
        self.assertIn('malformed-parcel-identity', {p['kind'] for p in parsed['issues']})

    def test_impossible_chronology_stops_at_gap(self):
        data = pair(1, [' D0001'], [' D0002'], '20100101') + pair(2, [' D0002'], [' D0003'], '20010101')
        rows, _ = trace([P(' D0003')], data)
        self.assertIn('impossible-chronology', {t['reason'] for t in rows[0]['terminals']})
        self.assertNotIn(P(' D0001'), rows[0]['ancestorIds'])

    def test_cycle_is_explicit_and_terminates(self):
        data = pair(1, [' D0001'], [' D0002'], '20010101') + pair(2, [' D0002'], [' D0001'], '19900101')
        rows, _ = trace([P(' D0002')], data)
        self.assertIn('cycle', {t['reason'] for t in rows[0]['terminals']})

    def test_conflicting_creation_events_keep_both_qualified_routes(self):
        data = pair(1, [' D0001'], [' D0003']) + pair(2, [' D0002'], [' D0003'])
        rows, parsed = trace([P(' D0003')], data)
        self.assertEqual(len(rows[0]['paths']), 2)
        paths = historical_evidence_paths(rows, parsed['events'], P(' D0001'), '1989-01-01')
        self.assertEqual(paths[0]['assignment'], 'unassigned-context')
        self.assertIn('conflicting-creation-events', paths[0]['qualifications'])

    def test_public_domain_and_non_cadastral_origin_are_explicit(self):
        data = pair(1, [], [' D0002']) + pair(2, [' D0001'], [])
        rows, parsed = trace([P(' D0001'), P(' D0002')], data)
        self.assertEqual(parsed['issues'], [])
        self.assertEqual({e['scope'] for e in parsed['events']}, {'non-cadastral-domain-origin', 'passage-to-public-domain'})
        self.assertIn('current-reference-passed-to-public-domain', {p['kind'] for p in rows[0]['issues']})
        self.assertEqual(rows[1]['terminals'][0]['reason'], 'non-cadastral-domain-origin')

    def test_unknown_change_type_is_not_silently_accepted(self):
        rows, parsed = trace([P(' D0002')], pair(1, [' D0001'], [' D0002'], nature='3'))
        self.assertFalse(parsed['events'][0]['traceable'])
        self.assertEqual(rows[0]['terminals'][0]['reason'], 'unresolved-dfi-event')

    def test_yonne_has_its_own_exact_department_identity(self):
        data = pair(1, ['AB0001'], ['AB0002'], commune='068', prefix='001').replace(b'210;', b'890;')
        parsed = parse_dfi(data, department_code='890', insee_department='89')
        self.assertEqual(parsed['events'][0]['motherIds'], ['89068001AB0001'])
        self.assertEqual(parse(data)['issues'][0]['kind'], 'malformed-event-identity')

    def test_duplicate_identical_event_is_coalesced_but_audited(self):
        data = pair(1, [' D0001'], [' D0002'])
        parsed = parse(data + data)
        self.assertEqual(len(parsed['events']), 1)
        self.assertTrue(parsed['events'][0]['traceable'])
        self.assertEqual(len([p for p in parsed['issues'] if p['kind'] == 'duplicate-identical-row']), 2)

    def test_conflicting_pair_preserves_all_printed_references(self):
        data = pair(1, [' D0001'], [' D0002']) + pair(1, [' D0009'], [' D0002'])
        parsed = parse(data)
        self.assertFalse(parsed['events'][0]['traceable'])
        self.assertEqual(parsed['events'][0]['motherIds'], [P(' D0001'), P(' D0009')])


if __name__ == '__main__':
    unittest.main()
