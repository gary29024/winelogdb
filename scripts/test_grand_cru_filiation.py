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


class UnresolvedDfiRecordTests(unittest.TestCase):
    """Each schema problem stays in the catalogue, blocks traversal and names its kind."""

    def kinds(self, parsed):
        return {issue['kind'] for issue in parsed['issues']}

    def test_interleaved_lots_are_nonconsecutive_and_untraceable(self):
        first, second = pair(1, [' D0001'], [' D0002']).splitlines(True), pair(2, [' D0003'], [' D0004']).splitlines(True)
        rows, parsed = trace([P(' D0002')], first[0] + second[0] + first[1] + second[1])
        self.assertIn('nonconsecutive-row-pair', self.kinds(parsed))
        self.assertTrue(all(not e['traceable'] for e in parsed['events']))
        self.assertEqual(rows[0]['ancestorIds'], [])
        self.assertEqual(rows[0]['terminals'][0]['reason'], 'unresolved-dfi-event')

    def test_invalid_validation_date_is_kept_raw(self):
        _, parsed = trace([P(' D0002')], pair(1, [' D0001'], [' D0002'], '19901340'))
        issue = next(i for i in parsed['issues'] if i['kind'] == 'invalid-validation-date')
        self.assertEqual(issue['rawDate'], '19901340')
        self.assertFalse(parsed['events'][0]['traceable'])

    def test_validation_after_the_source_snapshot_is_not_trusted(self):
        _, parsed = trace([P(' D0002')], pair(1, [' D0001'], [' D0002'], '20270101'))
        issue = next(i for i in parsed['issues'] if i['kind'] == 'validation-after-source-snapshot')
        self.assertEqual((issue['validationDate'], issue['sourceAsOf']), ('2027-01-01', '2026-07-01'))
        self.assertFalse(parsed['events'][0]['traceable'])

    def test_rows_of_one_lot_with_different_dates_conflict(self):
        mother = pair(1, [' D0001'], [' D0002'], '19900101').splitlines(True)[0]
        daughter = pair(1, [' D0001'], [' D0002'], '19900202').splitlines(True)[1]
        rows, parsed = trace([P(' D0002')], mother + daughter)
        self.assertIn('conflicting-event-metadata', self.kinds(parsed))
        self.assertEqual(rows[0]['terminals'][0]['reason'], 'unresolved-dfi-event')

    def test_new_reference_without_any_document_is_a_named_gap(self):
        parsed = parse(b'')
        rows = trace_ancestry([P(' D0009')], parsed['events'], geometry_as_of='2026-06-01',
                              first_seen={P(' D0009'): '2021-02-01'}, earliest_geometry='2017-07-06')
        self.assertEqual(rows[0]['terminals'][0]['reason'], 'missing-document-for-observed-new-reference')
        rows = trace_ancestry([P(' D0009')], parsed['events'], geometry_as_of='2026-06-01',
                              first_seen={P(' D0009'): '2017-07-06'}, earliest_geometry='2017-07-06')
        self.assertEqual(rows[0]['terminals'][0]['reason'], 'source-boundary-or-unrecorded-event')


class CommittedHistoryTests(unittest.TestCase):
    """The committed delivery keeps the source-checked examples (CI has no raw DFI member to rebuild it)."""

    @staticmethod
    def history(slug):
        import json
        from grand_cru import RESEARCH_DIR
        return json.loads((RESEARCH_DIR / slug / 'rights-history.json').read_text(encoding='utf-8'))

    def event(self, history, event_id):
        return next(e for e in history['documentedEvents'] if e['id'] == event_id)

    def parcel(self, history, parcel_id):
        return next(p for p in history['parcels'] if p['parcelId'] == parcel_id)

    def test_committed_1991_echezeaux_lot(self):
        history = self.history('echezeaux')
        event = self.event(history, '210:267:000:0000196:00001')
        self.assertEqual((event['validationDate'], event['motherIds'], event['daughterIds'], event['scope'], event['traceable']),
                         ('1991-01-22', ['212670000D0327'], ['212670000D0736', '212670000D0737'], 'split-event-group', True))
        for daughter in event['daughterIds']:
            ancestry = self.parcel(history, daughter)['documentedAncestry']
            self.assertIn('212670000D0327', ancestry['ancestorIds'])
            self.assertEqual(ancestry['earliestValidationDate'], '1991-01-22')

    def test_committed_1989_vougeot_lot_and_three_generation_chain(self):
        history = self.history('clos-de-vougeot')
        event = self.event(history, '210:716:000:0000052:00001')
        self.assertEqual((event['validationDate'], event['motherIds'], event['daughterIds']),
                         ('1989-04-20', ['217160000A0022'], ['217160000A0408', '217160000A0409', '217160000A0410']))
        # A0567 reaches A0022 through the retired A0409, which the 1989 lot keeps although it is outside the cru.
        parcel = self.parcel(history, '217160000A0567')
        oldest = next(p for p in parcel['documentedAncestry']['paths'] if p['referenceId'] == '217160000A0022')
        self.assertEqual(oldest['referencePath'], ['217160000A0567', '217160000A0409', '217160000A0022'])
        self.assertEqual(oldest['eventPath'], ['210:716:000:0000103:00001', '210:716:000:0000052:00001'])
        self.assertEqual(parcel['earliestSupportedEvent'], {'date': '1989-04-20', 'dateRole': 'dfi-validation'})

    def test_committed_rejected_411_candidates_stay_in_the_audit(self):
        # Successors that first appear later than the next vintage, and slivers, remain rejected and visible.
        def successors(slug, retired):
            row = next(r for r in self.history(slug)['retiredParcels'] if r['parcelId'] == retired)
            return {s['parcelId']: s['accepted'] for s in row['successors']}
        vougeot = successors('clos-de-vougeot', '217160000A0032')
        self.assertEqual((vougeot['217160000A0579'], vougeot['217160000A0580']), (False, False))
        self.assertTrue(vougeot['217160000A0563'])
        self.assertFalse(successors('echezeaux', '212670000D0792')['212670000D0793'])


if __name__ == '__main__':
    unittest.main()
