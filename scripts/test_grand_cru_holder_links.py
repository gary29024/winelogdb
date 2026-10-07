"""Guard the shared holder-to-domaine table: sourced links, known holders, no farming claims."""
import copy
import json
import unittest

from build_grand_cru_evidence import build_evidence
from build_grand_cru_holder_links import curations, generate, recorded_holders, validate
from build_grand_cru_research import Context, load_inputs
from build_grand_cru_research import build_register as build_cru_register
from grand_cru import HOLDER_LINKS, load_cru, read_json, resolve_curation


class HolderLinkTableTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.table = read_json(HOLDER_LINKS)
        cls.recorded, _ = recorded_holders()
        cls.curations = curations()

    def check(self, change):
        table = copy.deepcopy(self.table)
        change(table)
        validate(table, self.recorded, self.curations)

    def link(self, table, holder_id):
        return table['holders'][holder_id]['links'][0]

    def test_committed_table_and_report_are_current(self):
        generate(check=True)

    def test_every_link_is_sourced(self):
        with self.assertRaisesRegex(ValueError, 'every link needs known sources'):
            self.check(lambda t: self.link(t, '778269407').update(sourceIds=[]))
        with self.assertRaisesRegex(ValueError, 'every link needs known sources'):
            self.check(lambda t: self.link(t, '778269407').update(sourceIds=['nonexistent']))

    def test_every_identifier_is_a_recorded_holder(self):
        def add(t):
            t['holders']['999999999'] = copy.deepcopy(t['holders']['778269407'])
            self.link(t, '999999999')['id'] = '999999999/x'
        with self.assertRaisesRegex(ValueError, 'stale entry'):
            self.check(add)
        with self.assertRaisesRegex(ValueError, 'SIREN or provisional'):
            self.check(lambda t: t['holders'].update({'DRC': t['holders']['778269407']}))

    def test_provisional_identifiers_need_explicit_identity(self):
        with self.assertRaisesRegex(ValueError, 'needs an identity crosswalk'):
            self.check(lambda t: t['holders']['U32852627'].pop('identity'))
        with self.assertRaisesRegex(ValueError, 'invalid identity crosswalk'):
            self.check(lambda t: t['holders']['U18178008']['identity'].update(companySiren='77817350'))
        with self.assertRaisesRegex(ValueError, 'unknown crosswalk source'):
            self.check(lambda t: t['holders']['U18178008']['identity'].update(sourceIds=['nonexistent']))

    def test_family_holdings_need_a_company_record(self):
        def estate_only(t):
            link = self.link(t, '322396185')
            t['sources'].append({**next(s for s in t['sources'] if s['id'] == 'villamont-legal'), 'id': 'estate-only'})
            link['sourceIds'] = ['estate-only']
        with self.assertRaisesRegex(ValueError, 'company record, filing or legal notice'):
            self.check(estate_only)

    def test_leases_are_scoped_and_filed(self):
        with self.assertRaisesRegex(ValueError, 'limited to named crus'):
            self.check(lambda t: self.link(t, '798977476').pop('crus'))
        with self.assertRaisesRegex(ValueError, 'lease status and the filing'):
            self.check(lambda t: self.link(t, '798977476').update(sourceIds=['rne-798977476']))
        with self.assertRaisesRegex(ValueError, 'crus where the holder has recorded rights'):
            self.check(lambda t: self.link(t, '798977476').update(crus=['musigny']))

    def test_wording_never_claims_farming(self):
        with self.assertRaisesRegex(ValueError, 'must not claim farming'):
            self.check(lambda t: self.link(t, '778269407').update(basis='The domaine farms these parcels.'))
        for entry in self.table['holders'].values():
            for link in entry['links']:
                self.assertNotRegex(link['basis'] + link['domaine'], r'(?i)\bfarms\b|farmed by')

    def test_no_stale_or_duplicated_sources(self):
        with self.assertRaisesRegex(ValueError, 'Stale shared sources'):
            self.check(lambda t: t['sources'].append({**t['sources'][0], 'id': 'unused-source'}))
        with self.assertRaisesRegex(ValueError, 'unique across the table and every curation'):
            self.check(lambda t: t['sources'].append({**t['sources'][0], 'id': 'dvf-sales'}))
        with self.assertRaisesRegex(ValueError, 'retired link, and only one, needs its reason'):
            self.check(lambda t: self.link(t, '778269407').update(reviewStatus='retired'))


class ResolutionTests(unittest.TestCase):
    """How a cru draws candidates from the table, and what the app then groups."""

    @classmethod
    def setUpClass(cls):
        cls.table = read_json(HOLDER_LINKS)
        cls.echezeaux = read_json(Context(*load_cru('echezeaux')).curation)

    def holders(self, curation, slug, table=None):
        return {h['holderId']: h for h in resolve_curation(curation, slug, table or self.table)['holders']}

    def test_only_adopting_crus_take_links(self):
        corton = read_json(Context(*load_cru('corton')).curation)
        self.assertNotEqual(corton.get('holderLinks'), 'shared')
        self.assertIn('200047827', self.table['holders'])  # Hospices: linked, and a Corton holder
        self.assertTrue(all(h['candidateNames'] == [] for h in self.holders(corton, 'corton').values()))
        adopted = self.holders({**corton, 'holderLinks': 'shared'}, 'corton')
        self.assertEqual(adopted['200047827']['candidateNames'], ['Domaine des Hospices de Beaune'])
        # Bichot's Clos Frantin label is limited to the Vosne/Flagey crus.
        self.assertEqual(adopted['036380046']['candidateNames'], [])

    def test_inline_candidates_are_rejected(self):
        curation = copy.deepcopy(self.echezeaux)
        curation['holders'][0]['candidateNames'] = ['Anyone']
        with self.assertRaisesRegex(ValueError, 'belong in docs/research/holders/holder-links.json'):
            resolve_curation(curation, 'echezeaux', self.table)

    def test_cru_basis_and_sources_are_kept(self):
        resolved = self.holders(self.echezeaux, 'echezeaux')['036380046']
        original = next(h for h in self.echezeaux['holders'] if h['holderId'] == '036380046')
        self.assertEqual(resolved['basis'], original['basis'])
        self.assertEqual(resolved['sourceIds'][:len(original['sourceIds'])], original['sourceIds'])
        self.assertIn('register-bichot', resolved['sourceIds'])


class GroupingTests(unittest.TestCase):
    """Grouping only for linked holders; unlinked holders stay visible; nothing claims farming."""

    @classmethod
    def setUpClass(cls):
        cls.context = Context(*load_cru('echezeaux'))
        cls.inputs = load_inputs(cls.context)
        cls.table = read_json(HOLDER_LINKS)
        cls.raw = read_json(cls.context.curation)

    def evidence(self, table):
        curation = resolve_curation(self.raw, 'echezeaux', table)
        i = self.inputs
        register = build_cru_register(i['manifest'], i['asset'], curation, i['history'], i['sales'], i['named_areas'],
                                      self.context, i['notice_records'])
        return register, build_evidence(register, curation, i['history'], json.loads(i['asset'])['features'])

    def test_retired_and_ambiguous_links_do_not_group(self):
        table = copy.deepcopy(self.table)
        table['holders']['778269407']['links'][0].update(reviewStatus='retired', retiredReason='Test')
        second = {**table['holders']['775567928']['links'][0], 'id': '775567928/other', 'domaine': 'Another producer'}
        table['holders']['775567928']['links'].append(second)
        register, evidence = self.evidence(table)
        self.assertNotIn('778269407', evidence['holderDomains'])
        self.assertNotIn('775567928', evidence['holderDomains'])  # two candidates: listed as leads, never grouped
        self.assertIn('322396185', evidence['holderDomains'])
        rows = [r for r in register['parcels'] if '778269407' in r['holderResearchIds']]
        self.assertTrue(rows)  # the unlinked holder's parcels and recorded rights stay in the register
        self.assertTrue(all(any(x['holderId'] == '778269407' for x in r['recordedRights']) for r in rows))

    def test_unknown_holders_stay_visible(self):
        register, evidence = self.evidence(self.table)
        unlinked = {h['holderId'] for h in self.raw['holders']} - evidence['holderDomains'].keys()
        self.assertTrue(unlinked)
        for hid in unlinked:
            self.assertTrue(any(hid in r['holderResearchIds'] for r in register['parcels']))
        self.assertTrue(any(not r['recordedRights'] for r in register['parcels']))

    def test_domaine_headings_never_claim_farming(self):
        _, evidence = self.evidence(self.table)
        for domain in evidence['holderDomains'].values():
            self.assertNotIn('currentFarmer', domain)
            self.assertNotRegex(domain['name'] + domain['basis'], r'(?i)\bfarms\b|farmed by')


if __name__ == '__main__':
    unittest.main()
