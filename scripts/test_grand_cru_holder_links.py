"""Guard the shared holder-to-domaine table: sourced links, known holders, no farming claims."""
import copy
import json
import unittest

from build_grand_cru_evidence import build_evidence
from build_grand_cru_holder_links import curations, generate, recorded_holders, validate
from build_grand_cru_research import Context, load_inputs
from build_grand_cru_research import build_register as build_cru_register
from grand_cru import HOLDER_LINKS, ROOT, load_cru, read_json, resolve_curation


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
            for link in entry.get('links', []):
                self.assertNotRegex(link['basis'] + link['domaine'], r'(?i)\bfarms\b|farmed by')
            for search in entry.get('searches', []):
                self.assertNotRegex(search.get('note', ''), r'(?i)\bfarms\b|farmed by')

    def test_partner_company_needs_a_company_record_and_searches_are_checked(self):
        def estate_only(t):
            link = self.link(t, '953306917')
            t['sources'].append({**next(s for s in t['sources'] if s['id'] == 'villamont-legal'), 'id': 'estate-only'})
            link['sourceIds'] = ['estate-only']
        self.assertEqual(self.link(self.table, '953306917')['relation'], 'partner-company')
        with self.assertRaisesRegex(ValueError, 'company record, filing or legal notice'):
            self.check(estate_only)
        with self.assertRaisesRegex(ValueError, 'unknown search field'):
            self.check(lambda t: t['holders']['212100101']['searches'][0].update(farmer='x'))
        with self.assertRaisesRegex(ValueError, 'search notes must not claim farming'):
            self.check(lambda t: t['holders']['212100101']['searches'][0].update(note='The commune farms it.'))
        with self.assertRaisesRegex(ValueError, 'records the search that found none'):
            self.check(lambda t: t['holders']['212100101'].update(searches=[]))

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
        # Corton-Charlemagne shares Corton's parcels but has not adopted the table yet.
        cc = read_json(Context(*load_cru('corton-charlemagne')).curation)
        self.assertNotEqual(cc.get('holderLinks'), 'shared')
        self.assertIn('328186416', self.table['holders'])  # Bonneau du Martray: linked, and a Corton-Charlemagne holder
        self.assertTrue(all(h['candidateNames'] == [] for h in self.holders(cc, 'corton-charlemagne').values()))
        adopted = self.holders({**cc, 'holderLinks': 'shared'}, 'corton-charlemagne')
        self.assertEqual(adopted['328186416']['candidateNames'], ['Domaine Bonneau du Martray'])
        corton = self.holders(read_json(Context(*load_cru('corton')).curation), 'corton')
        self.assertEqual(corton['200047827']['candidateNames'], ['Domaine des Hospices de Beaune'])
        # Bichot's Clos Frantin label is limited to the Vosne/Flagey crus.
        self.assertEqual(corton['036380046']['candidateNames'], [])
        # A filing lease applies only in the crus whose parcels it names.
        self.assertEqual(corton['U22282316']['candidateNames'], ['Domaine d’Ardhuy'])

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


class CortonGroupingTests(unittest.TestCase):
    """Corton adopts the table: one applicable link groups, everything else keeps its legal name, nothing claims farming."""

    @classmethod
    def setUpClass(cls):
        context = Context(*load_cru('corton'))
        i = load_inputs(context)
        cls.curation = i['curation']
        cls.register = build_cru_register(i['manifest'], i['asset'], i['curation'], i['history'], i['sales'], i['named_areas'],
                                          context, i['notice_records'])
        cls.evidence = build_evidence(cls.register, i['curation'], i['history'], json.loads(i['asset'])['features'])

    def test_grouping_only_for_linked_holders(self):
        linked = {h['holderId'] for h in self.curation['holders'] if len(h['candidateNames']) == 1}
        self.assertEqual(set(self.evidence['holderDomains']), linked)
        unlinked = {h['holderId'] for h in self.curation['holders'] if not h['candidateNames']}
        self.assertTrue(unlinked)
        self.assertEqual({h['basis'] for h in self.curation['holders'] if h['holderId'] in unlinked}, {'unresolved'})
        for hid in unlinked:
            rows = [r for r in self.register['parcels'] if hid in r['holderResearchIds']]
            self.assertTrue(rows, hid)  # an unlinked holder's parcels and rights stay listed
            self.assertTrue(all(any(x['holderId'] == hid for x in r['recordedRights']) for r in rows))
        # A lessor link is a lead with its own basis, never an estate heading.
        self.assertEqual(self.evidence['holderDomains']['U21852238']['basis'], 'filing-tenant-relationship')
        self.assertTrue(any(not r['recordedRights'] and r['researchStatus'] == 'unresolved' for r in self.register['parcels']))

    def test_wording_never_claims_farming(self):
        self.assertEqual(self.register['counts']['currentFarmerConfirmed'], 0)
        self.assertTrue(all(r['currentFarmer'] is None for r in self.register['parcels']))
        # The builder's own disclaimer ("None states who farms a parcel today") is the only farming wording allowed.
        self.assertTrue(self.evidence['note'].startswith('Dated records per parcel. None states who farms'))
        text = json.dumps({k: v for k, v in self.evidence.items() if k != 'note'}, ensure_ascii=False)
        self.assertNotRegex(text, r'(?i)\bfarms\b|farmed by|is farming|currently farming')

    def test_leases_succession_and_office_matches_never_group(self):
        presentation = (ROOT / 'src/lib/places/parcelPresentation.ts').read_text(encoding='utf-8')
        headings = presentation[presentation.index('const headingLabels'):presentation.index('const leadLabels')]
        table = read_json(HOLDER_LINKS)
        relations = {}
        for hid, domain in self.evidence['holderDomains'].items():
            links = [l for l in table['holders'][hid]['links'] if 'corton' in l.get('crus', ['corton']) and l['reviewStatus'] != 'retired']
            relations[hid] = {l['relation'] for l in links}
            grouped = f"'{domain['basis']}'" in headings
            if relations[hid] & {'lessor-per-filing', 'reported-tenancy', 'succession', 'shared-office'}:
                self.assertFalse(grouped, hid)
            if 'management' in relations[hid] and grouped:
                self.assertEqual(domain['basis'], 'group-company-record', hid)  # a group company record, never management alone
        self.assertEqual(relations['408975357'], {'succession'})
        self.assertEqual(relations['U21852238'], {'lessor-per-filing'})


class ClosDeVougeotTests(unittest.TestCase):
    """The first Tier 2 cru on the shared table: links stay research links and unlinked holders stay visible."""

    @classmethod
    def setUpClass(cls):
        from build_grand_cru_research import outputs
        cls.context = Context(*load_cru('clos-de-vougeot'))
        cls.files, cls.register = outputs(cls.context)
        cls.evidence = json.loads(cls.files[cls.context.evidence])
        cls.curation = read_json(cls.context.curation)
        cls.table = read_json(HOLDER_LINKS)

    def test_grouping_only_for_linked_holders(self):
        rows = {h['holderId']: h for h in self.curation['holders']}
        self.assertEqual(self.curation['holderLinks'], 'shared')
        for hid in self.evidence['holderDomains']:
            entry = self.table['holders'][hid]
            self.assertTrue(any(l['reviewStatus'] != 'retired' and 'clos-de-vougeot' in l.get('crus', ['clos-de-vougeot'])
                                for l in entry['links']), hid)
        # Searched without a link, or ambiguous provisional identifiers: no domaine heading.
        for hid in ('318520137', 'U21966062', 'U18180763', 'U18180059', 'U22312052', 'U21837853', '222100018', 'U22314167'):
            self.assertIn(hid, rows)
            self.assertNotIn(hid, self.evidence['holderDomains'])

    def test_unlinked_and_unknown_holders_stay_visible(self):
        parcels = self.register['parcels']
        self.assertEqual(sum(not p['recordedRights'] for p in parcels), 58)
        holders = {r['holderId'] for p in parcels for r in p['recordedRights']}
        self.assertEqual(len(holders), 69)
        self.assertTrue({'318520137', 'U18180763', '222100018'} <= holders)

    def test_leases_and_name_only_matches_never_group(self):
        presentation = (ROOT / 'src/lib/places/parcelPresentation.ts').read_text(encoding='utf-8')
        headings = presentation[presentation.index('const headingLabels'):presentation.index('const leadLabels')]
        for hid, domain in self.evidence['holderDomains'].items():
            links = [l for l in self.table['holders'][hid]['links'] if 'clos-de-vougeot' in l.get('crus', ['clos-de-vougeot'])]
            if any(l['relation'] in {'lessor-per-filing', 'reported-tenancy'} for l in links):
                self.assertIn(domain['basis'], {'filing-tenant-relationship', 'filing-lease-mandate'}, hid)
                self.assertNotIn(f"'{domain['basis']}'", headings)
            if domain['basis'] == 'name-and-seat-crosswalk':
                self.assertTrue(all(l['reviewStatus'] == 'provisional' for l in links), hid)
                self.assertNotIn("'name-and-seat-crosswalk'", headings)

    def test_wording_never_claims_farming(self):
        self.assertEqual(self.register['counts']['currentFarmerConfirmed'], 0)
        texts = [d['note'] + d['name'] for d in self.evidence['holderDomains'].values()]
        texts += [i.get('note', '') for items in self.evidence['parcels'].values() for i in items]
        for text in texts:
            self.assertNotRegex(text, r'(?i)farms|farmed by|is farming')
        self.assertTrue(all(p['currentFarmer'] is None for p in self.register['parcels']))

    def test_cru_scoped_link_leaves_other_crus_unchanged(self):
        echezeaux = resolve_curation(read_json(Context(*load_cru('echezeaux')).curation), 'echezeaux', self.table)
        bichot = next(h for h in echezeaux['holders'] if h['holderId'] == '036380046')
        self.assertEqual(bichot['candidateNames'], ['Domaine du Clos Frantin / Albert Bichot'])
        self.assertNotIn('caviste-clos-frantin-vougeot', bichot['sourceIds'])


class RichebourgTests(unittest.TestCase):
    """Exact filings, uncertain identities and unnamed reports must keep different meanings."""

    @classmethod
    def setUpClass(cls):
        from build_grand_cru_research import outputs
        cls.context = Context(*load_cru('richebourg'))
        cls.files, cls.register = outputs(cls.context)
        cls.evidence = json.loads(cls.files[cls.context.evidence])
        cls.curation = read_json(cls.context.curation)
        cls.table = read_json(HOLDER_LINKS)
        cls.resolved = resolve_curation(cls.curation, 'richebourg', cls.table)

    def test_all_ten_holders_are_researched_without_inventing_a_grivot_link(self):
        self.assertEqual(self.context.cru['tier'], 2)
        self.assertEqual(self.curation['holderLinks'], 'shared')
        self.assertEqual(len(self.curation['holders']), 10)
        for h in self.curation['holders']:
            self.assertNotIn('candidateNames', h)
            self.assertLessEqual(len(h['finding']), 330)
            entry = self.table['holders'][h['holderId']]
            self.assertTrue(entry['searches'])
            self.assertGreater(entry['effort']['filingsScreened'], 0)
        self.assertEqual(self.table['holders']['318506367']['links'], [])
        self.assertNotIn('318506367', self.evidence['holderDomains'])
        self.assertEqual(len(self.evidence['holderDomains']), 9)

    def test_weak_identities_and_tenancy_cannot_be_domaine_headings(self):
        expected = {'448502708': 'management-only-lead', '885114322': 'filing-tenant-relationship',
                    'U14149307': 'name-and-seat-crosswalk'}
        presentation = (ROOT / 'src/lib/places/parcelPresentation.ts').read_text(encoding='utf-8')
        headings = presentation[presentation.index('const headingLabels'):presentation.index('const leadLabels')]
        for hid, basis in expected.items():
            self.assertEqual(self.evidence['holderDomains'][hid]['basis'], basis)
            self.assertNotIn(f"'{basis}'", headings)
        self.assertEqual(self.table['holders']['U14149307']['links'][0]['reviewStatus'], 'provisional')
        af = self.table['holders']['885114322']['links'][0]
        self.assertEqual((af['crus'], af['leaseStatus']), (['richebourg'], 'recited'))

    def test_only_exact_current_filing_references_receive_evidence(self):
        rows = {p['parcelId']: p for p in self.register['parcels']}
        exact = set()
        sources = {s['id']: s for s in self.resolved['sources']}
        for f in self.curation['parcelFilings']:
            exact.update(f['parcelAreasM2'])
            self.assertEqual(f['documentDate'], sources[f['sourceId']]['documentDate'])
            for pid in f['parcelAreasM2']:
                self.assertIn(f['holderId'], {r['holderId'] for r in rows[pid]['recordedRights']})
        self.assertEqual(len(exact), 18)
        self.assertEqual(len(self.curation['parcelFilings']), 5)
        for n in (53, 57, 61, 65, 168, 247, 248, 290, 291):
            self.assertNotIn(f'21714000AN{n:04}', exact)
        self.assertEqual(self.register['counts']['withParcelFiling'], 18)

    def test_historical_lease_dates_and_consolidated_tenancy_stay_qualified(self):
        filings = {f['id']: f for f in self.curation['parcelFilings']}
        meo = filings['ric-meo-1980-annex']
        self.assertEqual(meo['documentDate'], '2016-12-29')
        self.assertEqual(meo['leaseEvidence'][0]['effectiveFrom'], '1961-11-11')
        self.assertEqual(meo['leaseEvidence'][0]['tenants'], ['an individual'])
        anne = filings['ric-anne-gros-2019']['leaseEvidence']
        self.assertEqual(anne[1]['parcelIds'], ['21714000AN0180', '21714000AN0238'])
        self.assertIn('consolidates ownership and tenancy', anne[1]['limitation'])
        af = filings['ric-af-gros-2020']['leaseEvidence'][0]
        self.assertEqual((af['tenantSiren'], af['signedDate'], af['effectiveFrom']),
                         ('383967346', '2018-06-12', '2017-11-11'))
        self.assertTrue(all(l['kind'] == 'existing-lease-recital'
                            for f in filings.values() for l in f['leaseEvidence']))

    def test_unnamed_2025_report_and_census_never_create_a_candidate(self):
        reports = [r for r in self.curation['externalResearch'] if r['sourceIds'] == ['ric-winehog-new-owner']]
        self.assertEqual({p for r in reports for p in r['parcelIds']},
                         {f'21714000AN{n:04}' for n in (292, 293, 294, 295)})
        self.assertTrue(all(r['producer'] is None and r['currentFarmer'] is None for r in reports))
        for row in self.register['parcels']:
            if row['parcelId'] in {p for r in reports for p in r['parcelIds']}:
                # Candidates come only from references printed for the retired parcels, never the unnamed report.
                self.assertTrue(all(c['basis'].endswith(('on predecessor AN0170', 'on predecessor AN0172'))
                                    for c in row['candidateLeads']))
        self.assertEqual(len(self.curation['producerHoldings']), 11)
        self.assertTrue(all('parcelIds' not in h for h in self.curation['producerHoldings']))
        af_holding = next(h for h in self.curation['producerHoldings'] if h['id'] == 'ric-af-gros')
        self.assertEqual(af_holding['ownerHolderIds'], [])  # The GFA's 0.1281 ha is not the whole published 0.60 ha.
        self.assertEqual(sum(not p['recordedRights'] for p in self.register['parcels']), 32)

    def test_liger_belair_lease_reaches_split_parcels_only_through_lineage(self):
        lease = next(r for r in self.curation['externalResearch'] if r['id'] == 'ric-tlb-metayage-2005')
        self.assertEqual((lease['basis'], lease['parcelIds'], lease['currentFarmer']),
                         ('filing-named-cadastral-reference', [], None))
        self.assertEqual(lease['predecessorReferences'],
                         {'21714000AN0170': ['21714000AN0292', '21714000AN0293'],
                          '21714000AN0172': ['21714000AN0294', '21714000AN0295']})
        self.assertIn('end of 2022', lease['finding'])  # The lease term and the 2025 sale stay stated.
        self.assertIn('3 April 2025 sale', lease['finding'])
        rows = {p['parcelId']: p for p in self.register['parcels']}
        for n, former in ((292, 'AN0170'), (293, 'AN0170'), (294, 'AN0172'), (295, 'AN0172')):
            row = rows[f'21714000AN{n:04}']
            self.assertEqual((row['researchStatus'], row['recordedRights'], row['currentFarmer']), ('holder-lead', [], None))
            self.assertEqual([(c['name'], c['basis']) for c in row['candidateLeads']],
                             [('Domaine Thibault Liger-Belair', f'filing-named-cadastral-reference on predecessor {former}'),
                              ('Domaine Thibault Liger-Belair', f'critic-named-cadastral-reference on predecessor {former}')])
            items = [i for i in self.evidence['parcels'][row['parcelId']] if i['kind'] == 'research' and i.get('via') == former]
            self.assertEqual(len(items), 2)
            self.assertTrue(all(i['originalReferenceId'] == f'21714000{former}' for i in items))
        sources = {s['id']: s for s in self.resolved['sources']}
        deed = sources['ric-tlb-lease-contribution-2015']
        self.assertEqual((deed['documentDate'], deed['filingDate'], deed['screenedPages']), ('2015-12-30', '2017-05-17', deed['pageCount']))
        for printed in ('353575103', '44 a 13 ca', '7 a 92 ca'):
            self.assertIn(printed, deed['finding'])
        self.assertNotIn('ric-tlb-lease-contribution-2015', {sid for h in self.curation['holders'] for sid in h['sourceIds']})

    def test_critic_cadastre_numbers_name_candidates_without_company_links(self):
        rows = {p['parcelId']: p for p in self.register['parcels']}
        grivot = rows['21714000AN0247']
        self.assertEqual((grivot['researchStatus'], [(c['name'], c['basis']) for c in grivot['candidateLeads']]),
                         ('holder-lead', [('Domaine Jean Grivot', 'critic-named-cadastral-reference')]))
        self.assertEqual(self.table['holders']['318506367']['links'], [])  # A critic article is not a company crosswalk.
        self.assertNotIn('318506367', self.evidence['holderDomains'])
        named = {r['id']: r for r in self.curation['externalResearch'] if r['basis'] == 'critic-named-cadastral-reference'}
        self.assertEqual((named['ric-wh-mongeard-248']['parcelIds'], named['ric-wh-leroy-57-61']['parcelIds']),
                         (['21714000AN0248'], ['21714000AN0057', '21714000AN0061']))
        self.assertTrue(all(r['currentFarmer'] is None for r in named.values()))
        # Leroy's printed "69" (0.0922 ha) is kept as printed, never corrected to AN168 by area.
        printed = [u for u in self.curation['unmatchedPrintedReferences'] if u['sourceId'] == 'ric-winehog-leroy']
        self.assertEqual([u['parcelIds'] for u in printed], [[]])
        self.assertEqual([c['basis'] for c in rows['21714000AN0168']['candidateLeads']], ['name-and-seat-crosswalk'])
        self.assertEqual(self.table['holders']['U14149307']['links'][0]['reviewStatus'], 'provisional')
        sources = {s['id']: s for s in self.resolved['sources']}
        for sid in ('ric-winehog-grivot', 'ric-winehog-mongeard', 'ric-winehog-leroy', 'ric-winehog-meo'):
            self.assertRegex(sources[sid]['sha256'], r'^[0-9a-f]{64}$')
            self.assertTrue(sources[sid]['documentDate'] and sources[sid]['otherDocumentDates'])

    def test_every_screened_filing_has_provenance_and_all_page_screening(self):
        sources = {s['id']: s for s in self.resolved['sources']}
        used = {sid for h in self.curation['holders'] for sid in h['sourceIds']}
        filings = [sources[sid] for sid in used if sources[sid]['type'] == 'company-filing']
        self.assertEqual(len(filings), 36)
        self.assertEqual(sum(s['pageCount'] for s in filings), 1454)
        for source in filings:
            self.assertEqual(source['screenedPages'], source['pageCount'])
            self.assertRegex(source['sha256'], r'^[0-9a-f]{64}$')
            self.assertTrue(source['documentDate'] and source['retrievedAt'] and source['reviewedPages'])
            self.assertIn('filingDate', source)

    def test_farming_and_other_cru_links_do_not_change(self):
        self.assertEqual(self.register['counts']['currentFarmerConfirmed'], 0)
        self.assertTrue(all(p['currentFarmer'] is None for p in self.register['parcels']))
        self.assertEqual((self.register['counts']['holderLead'], self.register['counts']['unresolved']), (30, 28))
        echezeaux = resolve_curation(read_json(Context(*load_cru('echezeaux')).curation), 'echezeaux', self.table)
        bichot = next(h for h in echezeaux['holders'] if h['holderId'] == '036380046')
        self.assertNotIn('ric-bichot-richebourg-sheet', bichot['sourceIds'])
        for d in self.evidence['holderDomains'].values():
            self.assertNotRegex(d['name'] + d['note'], r'(?i)\bfarms\b|farmed by|is farming')


class MusignyTier2Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.table = read_json(HOLDER_LINKS)
        cls.curation = read_json(ROOT / 'docs/research/musigny/curation.json')
        cls.register = read_json(ROOT / 'docs/research/musigny/register.json')
        cls.evidence = read_json(ROOT / 'src/lib/places/grandCruParcels/musigny.evidence.json')

    def test_all_holders_are_researched_without_name_only_crosswalks(self):
        self.assertEqual(self.curation['holderLinks'], 'shared')
        self.assertEqual(len(self.curation['holders']), 16)
        for row in self.curation['holders']:
            entry = self.table['holders'][row['holderId']]
            self.assertTrue(entry.get('links') or entry.get('searches'))
            self.assertFalse(row['parcelOperationConfirmed'])
        for hid in ('794244434', '491471041', 'U18181478', 'U21200736', 'U23906784'):
            self.assertEqual(self.table['holders'][hid]['links'], [])
            self.assertNotIn(hid, self.evidence['holderDomains'])
        for hid in ('U18181478', 'U21200736', 'U23906784'):
            self.assertNotIn('identity', self.table['holders'][hid])

    def test_sepv_crosswalk_and_exact_individual_areas(self):
        entry = self.table['holders']['U21401984']
        self.assertEqual(entry['identity']['companySiren'], '393095955')
        self.assertEqual(entry['links'][0]['relation'], 'parent-group')
        filing = next(f for f in self.curation['parcelFilings'] if f['id'] == 'mus-sepv-1994')
        self.assertEqual(filing['parcelAreasM2'], {'21133000AN0040': 180, '21133000AN0057': 210,
                                                 '21133000AN0060': 850, '21133000AN0061': 5480})
        self.assertEqual(filing['documentDate'], '1994-12-20')
        self.assertEqual(filing['supportingSourceIds'], ['cm-sepv-1994-approval'])

    def test_edge_parcel_filing_preserves_premier_cru_description(self):
        entry = self.table['holders']['U21388794']
        self.assertEqual(entry['identity']['companySiren'], '424223410')
        self.assertEqual(entry['links'], [])
        filing = next(f for f in self.curation['parcelFilings'] if f['id'] == 'mus-perrot-minot-1999')
        self.assertEqual(filing['parcelAreasM2'], {'21133000AN0064': 4736})
        self.assertIn('premier cru', filing['finding'])
        row = next(p for p in self.register['parcels'] if p['parcelId'] == '21133000AN0064')
        self.assertEqual(row['cruOverlapM2'], 6.5163)
        self.assertEqual(row['candidateLeads'], [])

    def test_management_and_unnumbered_mandates_stay_limited(self):
        link = self.table['holders']['814197737']['links'][0]
        self.assertEqual(link['relation'], 'management')
        self.assertEqual(self.evidence['holderDomains']['814197737']['basis'], 'management-only-lead')
        exact = {pid for f in self.curation['parcelFilings'] for pid in f['parcelAreasM2']}
        self.assertNotIn('21133000AN0045', exact)
        self.assertNotIn('21133000AN0046', exact)
        self.assertTrue(all(not f['leaseEvidence'] for f in self.curation['parcelFilings']))
        self.assertEqual(self.table['holders']['381505338']['links'][0]['relation'], 'subsidiary')

    def test_census_and_unmatched_claims_never_allocate_parcels(self):
        self.assertEqual(len(self.curation['producerHoldings']), 10)
        self.assertTrue(all('parcelIds' not in h for h in self.curation['producerHoldings']))
        self.assertEqual(len(self.curation['unmatchedPrintedReferences']), 6)
        self.assertTrue(all(not r['parcelIds'] and r['currentFarmer'] is None
                            for r in self.curation['unmatchedPrintedReferences']))
        rows = {p['parcelId']: p for p in self.register['parcels']}
        for n in (17, 22, 23, 24, 35, 42, 55):
            self.assertEqual(rows[f'21133000AN{n:04d}']['candidateLeads'], [])
        self.assertEqual((self.register['counts']['holderLead'], self.register['counts']['unresolved'],
                          self.register['counts']['withParcelFiling'], self.register['counts']['currentFarmerConfirmed']),
                         (24, 27, 5, 0))

    def test_number_and_area_matches_do_not_create_company_rights(self):
        rows = {p['parcelId']: p for p in self.register['parcels']}
        for n, name in ((34, 'Domaine de la Vougeraie'), (41, 'Domaine de la Vougeraie'),
                        (43, 'Maison Louis Jadot')):
            row = rows[f'21133000AN{n:04d}']
            self.assertEqual(row['recordedRights'], [])
            self.assertEqual([(x['name'], x['basis']) for x in row['candidateLeads']],
                             [(name, 'critic-named-cadastral-reference')])
        self.assertEqual(self.table['holders']['U21200736']['links'], [])
        self.assertTrue(any(x['name'] == 'Domaine Leroy' for x in rows['21133000AN0058']['candidateLeads']))
        self.assertTrue(all(p['currentFarmer'] is None for p in self.register['parcels']))
        sources = [s for s in self.curation['sources'] if 'winehog' in s['id']]
        self.assertEqual(len(sources), 14)
        full = next(s for s in sources if s['id'] == 'mus-winehog-faiveley-acquisition-archive')
        self.assertEqual(full['sha256'], 'dca8fca45149733a1f80ac2172777b2c6811b408348630382afd5e4193ed4ae6')
        self.assertIn('cannot establish', full['finding'])
        self.assertFalse(any('remains unsupplied' in g for g in self.curation['accessGaps']))
        for s in sources:
            self.assertRegex(s['sha256'], r'^[0-9a-f]{64}$')
            self.assertTrue(s['documentDate'] and s['bytes'] and s['retrievalNote'])

    def test_prieur_reference_reaches_successors_only_through_dfi(self):
        r = next(r for r in self.curation['externalResearch'] if r['id'] == 'mus-wh-prieur-15')
        self.assertEqual(r['parcelIds'], [])
        self.assertEqual(r['predecessorReferences'], {'21133000AN0015': ['21133000AN0077', '21133000AN0078']})
        for n in (77, 78):
            items = [i for i in self.evidence['parcels'][f'21133000AN{n:04d}']
                     if i['kind'] == 'research' and i.get('via') == 'AN0015']
            self.assertEqual(len(items), 1)
            self.assertEqual(items[0]['originalReferenceId'], '21133000AN0015')

    def test_new_selected_filings_have_complete_byte_and_page_provenance(self):
        ids = {sid for row in self.curation['holders'] for sid in row['sourceIds']}
        filings = [s for s in self.table['sources'] if s['id'].startswith('cm-')
                   and s['id'] in ids and s['type'] == 'company-filing']
        self.assertEqual((len(filings), sum(s['pageCount'] for s in filings)), (24, 586))
        for source in filings:
            self.assertEqual(source['screenedPages'], source['pageCount'])
            self.assertRegex(source['sha256'], r'^[0-9a-f]{64}$')
            self.assertTrue(source['bytes'] and source['documentDate'] and source['reviewedPages'])
            self.assertIn('filingDate', source)


class BonnesMaresTier2Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.table = read_json(HOLDER_LINKS)
        cls.curation = read_json(ROOT / 'docs/research/bonnes-mares/curation.json')
        cls.register = read_json(ROOT / 'docs/research/bonnes-mares/register.json')
        cls.evidence = read_json(ROOT / 'src/lib/places/grandCruParcels/bonnes-mares.evidence.json')

    def test_holder_coverage_preserves_unresolved_provisional_identities(self):
        self.assertEqual(self.curation['holderLinks'], 'shared')
        self.assertEqual(len(self.curation['holders']), 30)
        for row in self.curation['holders']:
            entry = self.table['holders'][row['holderId']]
            self.assertTrue(entry.get('links') or entry.get('searches'))
            self.assertFalse(row['parcelOperationConfirmed'])
        for hid in ('U21117863', 'U21373997', 'U21197768', 'U21119406', 'U21119549'):
            entry = self.table['holders'][hid]
            self.assertNotIn('identity', entry)
            self.assertEqual(entry['links'], [])
            self.assertNotIn(hid, self.evidence['holderDomains'])
        self.assertEqual(self.table['holders']['322396185']['links'][0]['reviewStatus'], 'provisional')

    def test_exact_filings_and_crosswalks_do_not_infer_producers(self):
        filings = {f['id']: f for f in self.curation['parcelFilings']}
        self.assertEqual(len(filings), 8)
        self.assertEqual(sum(len(f['parcelAreasM2']) for f in filings.values()), 17)
        for hid, siren in (('U21966026', '483678264'), ('U21459182', '398367029'),
                           ('U21586080', '444144190'), ('U21155571', '377495288'), ('U18178981', '686042409')):
            self.assertEqual(self.table['holders'][hid]['identity']['companySiren'], siren)
        for hid in ('U21966026', 'U21459182', 'U21155571', '326418761', '383339470', '429825250'):
            self.assertEqual(self.table['holders'][hid]['links'], [])
        self.assertEqual(filings['bm-grands-vins']['parcelAreasM2'],
                         {'21133000AB0134': 485, '21442000AR0066': 9235,
                          '21442000AR0067': 1246, '21442000AR0068': 955})
        self.assertIn('Chambolle-Musigny', filings['bm-bart-clair']['finding'])
        self.assertIn('usufruct', filings['bm-bussiere']['finding'])
        self.assertIn('fractional', filings['bm-lignier']['finding'])

    def test_historical_tenancy_and_mandates_remain_qualified(self):
        link = self.table['holders']['U21586080']['links'][0]
        self.assertEqual((link['relation'], link['leaseStatus'], link['crus']),
                         ('lessor-per-filing', 'recited', ['bonnes-mares']))
        self.assertEqual(self.evidence['holderDomains']['U21586080']['basis'], 'filing-tenant-relationship')
        self.assertEqual(self.table['holders']['343567632']['links'][0]['relation'], 'reported-tenancy')
        ext = next(x for x in self.curation['externalResearch'] if x['id'] == 'bm-bachus-mandate-304')
        self.assertEqual(ext['parcelIds'], ['21133000AB0304'])
        self.assertEqual(ext['basis'], 'filing-named-cadastral-reference')
        self.assertIn('mandate', ext['appNote'])
        exact = {pid for f in self.curation['parcelFilings'] for pid in f['parcelAreasM2']}
        self.assertTrue(exact.isdisjoint({'21133000AB0304', '21133000AB0437', '21133000AB0438',
                                         '21133000AB0439', '21133000AB0440'}))

    def test_critic_matches_require_individual_number_and_area(self):
        ext = {x['id']: x for x in self.curation['externalResearch']}
        self.assertEqual(ext['bm-wh-arlaud']['parcelIds'], ['21133000AB0076', '21133000AB0121'])
        self.assertEqual(ext['bm-wh-groffier']['parcelIds'], ['21133000AB0266'])
        self.assertEqual(len(self.curation['unmatchedPrintedReferences']), 10)
        self.assertTrue(all(not r['parcelIds'] and r['currentFarmer'] is None
                            for r in self.curation['unmatchedPrintedReferences']))
        self.assertEqual(len(self.curation['producerHoldings']), 11)
        self.assertTrue(all('parcelIds' not in h for h in self.curation['producerHoldings']))
        arlaud = next(h for h in self.curation['producerHoldings'] if h['id'] == 'bm-arlaud')
        self.assertEqual((arlaud['publishedAreaHa'], arlaud['otherPublishedAreas'][0]['areaHa']), (.2131, .2081))
        self.assertEqual(self.register['counts']['unresolved'], 84)
        self.assertEqual(self.register['counts']['currentFarmerConfirmed'], 0)
        self.assertTrue(all(p['currentFarmer'] is None for p in self.register['parcels']))

    def test_mommessin_crosswalk_uses_property_schedule_and_name_history(self):
        entry = self.table['holders']['U18178981']
        self.assertEqual(entry['identity']['companySiren'], '686042409')
        self.assertEqual(entry['links'][0]['relation'], 'owner-company')
        filing = next(f for f in self.curation['parcelFilings'] if f['id'] == 'bm-clos-tart-2018')
        self.assertEqual(filing['parcelAreasM2'], {'21442000AR0064': 2780})
        self.assertIn('shares, not this parcel', filing['finding'])
        row = next(p for p in self.register['parcels'] if p['parcelId'] == '21442000AR0064')
        self.assertEqual(row['cruOverlapM2'], 319.7561)
        self.assertIsNone(row['currentFarmer'])

    def test_supplied_archives_preserve_area_rejections_and_documented_ancestry(self):
        ext = {x['id']: x for x in self.curation['externalResearch']}
        direct = [ext['bm-wh-' + name] for name in ('dujac', 'roumier', 'bertheau', 'auvenay')]
        self.assertEqual(sum(len(x['parcelIds']) for x in direct), 14)
        self.assertNotIn('21133000AB0367', ext['bm-wh-roumier']['parcelIds'])
        retired = ext['bm-wh-roumier-467']
        self.assertEqual(retired['parcelIds'], [])
        self.assertEqual(retired['predecessorReferences'],
                         {'21133000AB0467': ['21133000AB0481', '21133000AB0482']})
        for n in (481, 482):
            items = [x for x in self.evidence['parcels'][f'21133000AB{n:04d}']
                     if x['kind'] == 'research' and x.get('via') == 'AB0467']
            self.assertEqual(len(items), 1)
            self.assertEqual(items[0]['originalReferenceId'], '21133000AB0467')
        self.assertNotIn('bm-wh-mugnier', ext)
        self.assertNotIn('bm-wh-vogue', ext)
        roumier = next(h for h in self.curation['producerHoldings'] if h['id'] == 'bm-roumier')
        self.assertTrue({1.3878, 1.3868}.issubset({x['areaHa'] for x in roumier['otherPublishedAreas']}))
        sources = {s['id']: s for s in self.curation['sources']}
        self.assertEqual(sources['bm-winehog-roumier']['documentDate'], '2018-05-06')
        self.assertEqual(sources['bm-winehog-roumier']['otherDocumentDates'][0]['date'], '2023-03-07')
        self.assertFalse(any('remain unsupplied' in g for g in self.curation['accessGaps']))

    def test_selected_filings_have_complete_screening_and_byte_provenance(self):
        sources = [s for s in self.table['sources'] if s['id'].startswith('bm-') and s['type'] == 'company-filing']
        self.assertEqual((len(sources), sum(s['pageCount'] for s in sources)), (46, 1788))
        for source in sources:
            self.assertEqual(source['screenedPages'], source['pageCount'])
            self.assertRegex(source['sha256'], r'^[0-9a-f]{64}$')
            self.assertTrue(source['bytes'] and source['documentDate'] and source['reviewedPages'])
            self.assertIn('filingDate', source)
        archives = [s for s in self.curation['sources'] if 'winehog' in s['id']]
        self.assertEqual(len(archives), 10)
        self.assertTrue(all(s['bytes'] and s['sha256'] and s['retrievalNote'] for s in archives))


class ClosDeTartTier2Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.table = read_json(HOLDER_LINKS)
        cls.curation = read_json(ROOT / 'docs/research/clos-de-tart/curation.json')
        cls.register = read_json(ROOT / 'docs/research/clos-de-tart/register.json')
        cls.evidence = read_json(ROOT / 'src/lib/places/grandCruParcels/clos-de-tart.evidence.json')

    def test_company_links_keep_unlinked_gfa_and_edge_contacts_distinct(self):
        self.assertEqual(set(self.evidence['holderDomains']), {'U18178981', '330763426', '432273274'})
        self.assertEqual(self.table['holders']['U18178981']['identity']['companySiren'], '686042409')
        self.assertEqual(self.table['holders']['U21388794']['identity']['companySiren'], '424223410')
        for hid in ('420933681', 'U21388794'):
            self.assertEqual(self.table['holders'][hid]['links'], [])
            self.assertTrue(self.table['holders'][hid]['searches'])
        for pid in ('21442000AR0070', '21442000AR0072', '21442000AR0147'):
            row = next(p for p in self.register['parcels'] if p['parcelId'] == pid)
            self.assertLess(row['cruOverlapM2'], 21)
            self.assertIsNone(row['currentFarmer'])

    def test_exact_schedules_preserve_transaction_and_classification_limits(self):
        filings = {f['id']: f for f in self.curation['parcelFilings']}
        self.assertEqual(filings['ct-clos-tart-2018']['parcelAreasM2'],
                         {'21442000AR0060': 72548, '21442000AR0064': 2780,
                          '21442000AR0148': 1596, '21442000AR0149': 29})
        self.assertIn('shares, not these parcels', filings['ct-clos-tart-2018']['finding'])
        self.assertEqual(filings['ct-perrot-gfa-1999']['parcelAreasM2'], {'21442000AR0146': 1537})
        self.assertIn('AOC Morey-Saint-Denis', filings['ct-perrot-gfa-1999']['finding'])
        self.assertTrue(all(not f['leaseEvidence'] for f in filings.values()))
        self.assertEqual(self.register['counts']['withParcelFiling'], 5)

    def test_critic_census_does_not_invent_successors_or_current_farming(self):
        self.assertEqual(self.curation['externalResearch'][0]['parcelIds'],
                         ['21442000AR0060', '21442000AR0064'])
        self.assertEqual(len(self.curation['unmatchedPrintedReferences']), 2)
        self.assertTrue(all(not r['parcelIds'] for r in self.curation['unmatchedPrintedReferences']))
        census = self.curation['producerHoldings'][0]
        self.assertEqual((census['namedAreas'], census['publishedAreaHa']), (['CLOS DE TART'], 7.53))
        self.assertNotIn('parcelIds', census)
        self.assertEqual((self.register['counts']['holderLead'], self.register['counts']['unresolved']), (7, 10))
        self.assertEqual(self.register['counts']['currentFarmerConfirmed'], 0)
        self.assertTrue(all(p['currentFarmer'] is None for p in self.register['parcels']))

    def test_new_selection_is_fully_screened_and_shared_effort_is_reused(self):
        sources = [s for s in self.table['sources'] if s['id'].startswith('ct-') and s['type'] == 'company-filing']
        self.assertEqual((len(sources), sum(s['pageCount'] for s in sources)), (4, 48))
        for source in sources:
            self.assertEqual(source['screenedPages'], source['pageCount'])
            self.assertRegex(source['sha256'], r'^[0-9a-f]{64}$')
            self.assertTrue(source['bytes'] and source['documentDate'] and source['reviewedPages'])
        self.assertEqual(self.table['holders']['U18178981']['effort']['pagesRead'], 471)
        self.assertEqual(self.table['holders']['U21388794']['effort']['pagesRead'], 133)


class ClosDesLambraysTier2Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.table = read_json(HOLDER_LINKS)
        cls.curation = read_json(ROOT / 'docs/research/clos-des-lambrays/curation.json')
        cls.register = read_json(ROOT / 'docs/research/clos-des-lambrays/register.json')
        cls.evidence = read_json(ROOT / 'src/lib/places/grandCruParcels/clos-des-lambrays.evidence.json')

    def test_merme_conversion_is_identity_only_and_sci_candidate_stays_unresolved(self):
        self.assertEqual(set(self.evidence['holderDomains']), {'410725691'})
        merme = self.table['holders']['U21078600']
        self.assertEqual(merme['identity']['companySiren'], '778237206')
        self.assertIn('cl-merme-1997', merme['identity']['sourceIds'])
        self.assertEqual(merme['links'], [])
        sci = self.table['holders']['U21465754']
        self.assertNotIn('identity', sci)
        self.assertEqual(sci['links'], [])
        self.assertTrue(sci['searches'])

    def test_missing_annex_is_not_exact_property_or_operation_evidence(self):
        self.assertEqual(self.curation['parcelFilings'], [])
        self.assertEqual(self.curation['externalResearch'], [])
        source = next(s for s in self.table['sources'] if s['id'] == 'cl-lambrays-2014')
        self.assertIn('Annex 6', source['finding'])
        self.assertIn('not present', source['finding'])
        self.assertEqual(self.register['counts']['withParcelFiling'], 0)
        self.assertEqual(self.register['counts']['currentFarmerConfirmed'], 0)
        self.assertTrue(all(p['currentFarmer'] is None for p in self.register['parcels']))

    def test_census_and_unmatched_critic_references_do_not_allocate_parcels(self):
        self.assertEqual(len(self.curation['unmatchedPrintedReferences']), 3)
        self.assertTrue(all(not x['parcelIds'] for x in self.curation['unmatchedPrintedReferences']))
        census = {h['id']: h for h in self.curation['producerHoldings']}
        self.assertEqual(census['cl-lambrays']['publishedAreaHa'], 8.66)
        self.assertEqual(census['cl-taupenot-merme']['publishedAreaHa'], .042)
        self.assertTrue(all('parcelIds' not in h for h in census.values()))
        self.assertEqual((self.register['counts']['holderLead'], self.register['counts']['historicalApplication'],
                          self.register['counts']['unresolved']), (1, 7, 14))

    def test_complete_selection_preserves_operating_and_deposit_dates(self):
        sources = [s for s in self.table['sources'] if s['id'].startswith('cl-') and s['type'] == 'company-filing']
        self.assertEqual((len(sources), sum(s['pageCount'] for s in sources)), (10, 148))
        for source in sources:
            self.assertEqual(source['screenedPages'], source['pageCount'])
            self.assertRegex(source['sha256'], r'^[0-9a-f]{64}$')
            self.assertTrue(source['bytes'] and source['reviewedPages'])
        dated = {s['id']: s for s in sources}
        self.assertEqual((dated['cl-lambrays-1996']['documentDate'], dated['cl-lambrays-1996']['filingDate']),
                         ('1996-12-11', '1997-01-31'))
        self.assertEqual((dated['cl-sci-candidate-2018']['documentDate'], dated['cl-sci-candidate-2018']['filingDate']),
                         ('2018-05-26', '2019-05-29'))


class ClosSaintDenisTier2Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.table = read_json(HOLDER_LINKS)
        cls.curation = read_json(ROOT / 'docs/research/clos-saint-denis/curation.json')
        cls.register = read_json(ROOT / 'docs/research/clos-saint-denis/register.json')
        cls.evidence = read_json(ROOT / 'src/lib/places/grandCruParcels/clos-saint-denis.evidence.json')

    def test_company_identity_and_historical_tenants_do_not_collapse_holders(self):
        self.assertEqual(set(self.evidence['holderDomains']),
                         {'037180015', '322396185', '323824649', '417882644', 'U21586080'})
        self.assertEqual(self.table['holders']['U21940937']['identity']['companySiren'], '501519938')
        for hid in ['U21940937', '439629254', '383521408', '893542001', 'U21585571']:
            self.assertEqual(self.table['holders'][hid]['links'], [])
        self.assertNotIn('identity', self.table['holders']['U21585571'])
        arlaud = self.table['holders']['U21586080']['links']
        self.assertEqual(next(x for x in arlaud if x['id'].endswith('/arlaud-lease'))['crus'], ['bonnes-mares'])
        self.assertEqual(next(x for x in arlaud if x['id'].endswith('/arlaud-lease-saint-denis'))['crus'], ['clos-saint-denis'])
        for pid in ['21442000AB0475', '21442000AB0476']:
            parcel = next(p for p in self.register['parcels'] if p['parcelId'] == pid)
            self.assertEqual({r['holderId'] for r in parcel['recordedRights']}, {'383521408', '417882644'})

    def test_plantation_contribution_and_expired_leases_stay_historical(self):
        filings = {f['id']: f for f in self.curation['parcelFilings']}
        magnien = filings['csd-magnien-plantations-1998']
        self.assertEqual(magnien['parcelAreasM2'], {'21442000AB0472': 5144})
        self.assertEqual(magnien['documentDate'], '1998-12-18')
        self.assertIn('excludes the underlying land', magnien['finding'])
        self.assertIn('310 m2', magnien['finding'])
        self.assertEqual(filings['csd-saint-loup-2001']['leaseEvidence'][0]['recitedEnd'], '2019-09-30')
        self.assertEqual(filings['csd-saint-roch-2007']['leaseEvidence'][0]['recitedEnd'], '2022-12-31')
        self.assertEqual((len(filings), self.register['counts']['withParcelFiling']), (6, 16))
        self.assertEqual(self.register['counts']['currentFarmerConfirmed'], 0)
        self.assertTrue(all(p['currentFarmer'] is None for p in self.register['parcels']))

    def test_old_reference_uses_dfi_and_critic_area_mismatch_is_not_forced(self):
        ext = {x['id']: x for x in self.curation['externalResearch']}
        old = ext['csd-lignier-former-ap26']
        self.assertEqual(old['parcelIds'], [])
        self.assertEqual(old['predecessorReferences'],
                         {'21442000AP0026': ['21442000AP0232', '21442000AP0233']})
        self.assertNotIn('producer', old)
        for pid in ['21442000AP0232', '21442000AP0233']:
            parcel = next(p for p in self.register['parcels'] if p['parcelId'] == pid)
            self.assertIn(old['id'], parcel['externalResearchIds'])
        self.assertEqual(ext['csd-wh-clf']['parcelIds'], ['21442000AB0405'])
        self.assertIn('492', self.curation['unmatchedPrintedReferences'][0]['limitation'])
        self.assertEqual(len(self.curation['producerHoldings']), 12)
        self.assertTrue(all('parcelIds' not in h for h in self.curation['producerHoldings']))
        self.assertEqual((self.register['counts']['holderLead'], self.register['counts']['unresolved']), (17, 32))

    def test_final_archives_do_not_invent_rights_or_confirm_expansion(self):
        ext = {x['id']: x for x in self.curation['externalResearch']}
        self.assertEqual(ext['csd-wh-dujac']['printedAreasM2'],
                         {'AB409': 10062, 'AB410': 700, 'AB248': 2727, 'AB253': 850})
        self.assertEqual(ext['csd-wh-arlaud']['printedAreasM2'], {'AB305': 1264, 'AB306': 504})
        parcel = next(p for p in self.register['parcels'] if p['parcelId'] == '21442000AB0410')
        self.assertEqual(parcel['recordedRights'], [])
        self.assertEqual([(x['name'], x['basis']) for x in parcel['candidateLeads']],
                         [('Domaine Dujac', 'critic-named-cadastral-reference')])
        self.assertFalse(any('21442000AB0433' in x['parcelIds'] for x in ext.values()))
        rejected = [x for x in self.curation['unmatchedPrintedReferences']
                    if x['sourceId'] == 'csd-winehog-overview']
        self.assertEqual(len(rejected), 2)
        self.assertTrue(all(not x['parcelIds'] and x['currentFarmer'] is None for x in rejected))
        self.assertIn('unconfirmed', rejected[0]['limitation'])
        sources = {x['id']: x for x in self.curation['sources']}
        self.assertEqual(sources['csd-winehog-arlaud']['documentDate'], '2024-09-24')
        self.assertIn('map labelled 2017', sources['csd-winehog-arlaud']['finding'])
        self.assertFalse(any(x.startswith('Unsupplied paywalled') for x in self.curation['accessGaps']))

    def test_new_screening_and_reused_bundled_deed_are_not_double_counted(self):
        sources = {s['id']: s for s in self.table['sources']}
        selected = [s for sid, s in sources.items()
                    if sid.startswith('csd-') and s['type'] == 'company-filing' and sid != 'csd-lignier-1990']
        self.assertEqual((len(selected), sum(s['pageCount'] for s in selected)), (21, 718))
        self.assertTrue(all(s['screenedPages'] == s['pageCount'] for s in selected))
        self.assertEqual(sources['csd-lignier-1990']['sha256'], sources['bm-lignier-1976']['sha256'])
        self.assertEqual(sources['csd-lignier-1990']['documentDate'], '1990-12-21')
        self.assertEqual(sources['csd-magnien-contribution-1998']['filingDate'], '2005-03-24')
        self.assertEqual(sources['csd-magnien-2024']['documentDate'], '2024-01-15')
        self.assertIsNone(sources['csd-magnien-2024']['filingDate'])
        self.assertEqual(self.table['holders']['U21585571']['effort']['filingsScreened'], 0)


class ClosDeLaRocheTier2Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.table = read_json(HOLDER_LINKS)
        cls.curation = read_json(ROOT / 'docs/research/clos-de-la-roche/curation.json')
        cls.register = read_json(ROOT / 'docs/research/clos-de-la-roche/register.json')
        cls.evidence = read_json(ROOT / 'src/lib/places/grandCruParcels/clos-de-la-roche.evidence.json')

    def test_identity_crosswalks_do_not_collapse_same_name_companies(self):
        holders = self.table['holders']
        for hid, sir in [('U21367129', '445342603'), ('U14137560', '477891048'),
                         ('U21979030', '420812018')]:
            self.assertEqual(holders[hid]['identity']['companySiren'], sir)
        for hid in ['U13482493', 'U21934169']:
            self.assertNotIn('identity', holders[hid])
            self.assertEqual(holders[hid]['links'], [])
        for hid in ['819859885', '519906606', '427469572', '401807748',
                    'U21367129', 'U21979030', '383521408', '439629254']:
            self.assertEqual(holders[hid]['links'], [])
        self.assertEqual(set(self.evidence['holderDomains']),
                         {'307017962', '322396185', '351648266', '411381908', '417882644',
                          '480400407', '515520385', '531940583', 'U14137560', 'U21586080'})
        for hid in ['411381908', 'U14137560']:
            self.assertEqual(holders[hid]['links'][0]['crus'], ['clos-de-la-roche'])
        arlaud = holders['U21586080']['links']
        self.assertEqual({tuple(x['crus']) for x in arlaud},
                         {('bonnes-mares',), ('clos-saint-denis',), ('clos-de-la-roche',)})

    def test_historical_cvi_and_partial_leases_never_become_current_operation(self):
        filings = {f['id']: f for f in self.curation['parcelFilings']}
        feuillet = filings['cr-feuillet-2006']
        self.assertEqual(feuillet['leaseEvidence'][0]['recitedEnd'], '2006-01-11')
        self.assertIn('23 June 2004', feuillet['finding'])
        self.assertEqual(feuillet['parcelAreasM2'], {'21442000AB0230': 968, '21442000AB0505': 3133})
        peirazeau = filings['cr-peirazeau-2011']['leaseEvidence']
        self.assertEqual(peirazeau[0]['partialParcelAreasM2']['21442000AB0047'], 2590)
        self.assertEqual(peirazeau[1]['partialParcelAreasM2']['21442000AB0047'], 638)
        self.assertNotIn('parcelAreasM2', peirazeau[0])
        self.assertIn('excludes the underlying land', filings['cr-magnien-plantations-1998']['finding'])
        self.assertIn('half indivisible interest', filings['cr-saint-loup-2001']['finding'])
        self.assertEqual(self.register['counts']['currentFarmerConfirmed'], 0)
        self.assertTrue(all(p['currentFarmer'] is None for p in self.register['parcels']))
        self.assertEqual((len(filings), self.register['counts']['withParcelFiling']), (12, 39))

    def test_critic_portions_and_area_discrepancies_are_not_forced(self):
        filings = {f['id']: f for f in self.curation['parcelFilings']}
        self.assertEqual(filings['cr-lignier-michelot-1995']['parcelAreasM2'], {'21442000AB0061': 732})
        ext = {e['id']: e for e in self.curation['externalResearch']}
        self.assertNotIn('21442000AB0461', ext['cr-wh-ponsot']['parcelIds'])
        self.assertEqual(filings['cr-ponsot-gfa-2007']['parcelAreasM2']['21442000AB0461'], 27614)
        self.assertEqual(len(ext['cr-wh-ponsot']['parcelIds']), 9)
        self.assertEqual(ext['cr-wh-leroy']['producer'], 'Domaine Leroy')
        self.assertEqual(len(ext['cr-wh-dujac']['parcelIds']), 9)
        self.assertEqual(sum(ext['cr-wh-dujac']['printedAreasM2'].values()), 19472)
        dujac = [h for h in self.curation['producerHoldings'] if h['id'].startswith('cr-dujac-')]
        self.assertEqual(len(dujac), 5)
        self.assertAlmostEqual(sum(h['publishedAreaHa'] for h in dujac), 1.9472)
        self.assertTrue(all(not h['producerHolderIds'] and not h['ownerHolderIds'] for h in dujac))
        self.assertEqual(self.evidence['holderDomains']['515520385']['name'], 'Maison Leroy')
        for pid in ['21442000AB0550', '21442000AB0551']:
            parcel = next(p for p in self.register['parcels'] if p['parcelId'] == pid)
            self.assertEqual(parcel['recordedRights'], [])
            self.assertIn('cr-wh-rousseau', parcel['externalResearchIds'])
        self.assertEqual(len(self.curation['unmatchedPrintedReferences']), 5)
        self.assertEqual(len(self.curation['producerHoldings']), 14)
        self.assertTrue(all('parcelIds' not in h for h in self.curation['producerHoldings']))
        self.assertEqual((self.register['counts']['holderLead'], self.register['counts']['unresolved']), (36, 76))

    def test_lignier_subset_and_overview_do_not_allocate_parcels(self):
        holdings = {h['id']: h for h in self.curation['producerHoldings']}
        self.assertEqual(holdings['cr-hubert-lignier-monts']['publishedAreaHa'], .62)
        self.assertEqual(holdings['cr-hubert-lignier-fremieres']['publishedAreaHa'], .28)
        self.assertIn('subset', holdings['cr-hubert-lignier-monts']['finding'])
        self.assertTrue(all(not h['producerHolderIds'] and not h['ownerHolderIds']
                            for h in holdings.values() if h['id'].startswith('cr-hubert-lignier')))
        self.assertFalse(any('lignier' in x['id'] or 'overview' in x['id']
                             for x in self.curation['externalResearch']))
        self.assertEqual(len([s for s in self.curation['sources'] if s['id'].startswith('cr-winehog-')]), 6)
        gaps = [g for g in self.curation['accessGaps'] if g.startswith('Unsupplied paywalled')]
        self.assertEqual(gaps, [])

    def test_rejected_document_counts_only_as_screening_effort(self):
        sources = {s['id']: s for s in self.table['sources']}
        selected = [s for sid, s in sources.items() if sid.startswith('cr-') and s['type'] == 'company-filing']
        self.assertEqual((len(selected), sum(s['pageCount'] for s in selected)), (36, 1390))
        self.assertTrue(all(s['screenedPages'] == s['pageCount'] for s in selected))
        rejected = sources['cr-peirazeau-index-mismatch']
        self.assertEqual(rejected['pageCount'], 16)
        self.assertIn('ADH', rejected['finding'])
        self.assertNotIn(rejected['id'], {f['sourceId'] for f in self.curation['parcelFilings']})
        self.assertEqual(self.table['holders']['U21367129']['effort']['filingsScreened'], 4)
        self.assertEqual(self.table['holders']['U13482493']['effort']['filingsScreened'], 0)


class RomaneeSaintVivantTests(unittest.TestCase):
    """Exact filings, lineage-only references and a shared-area coincidence keep different meanings."""

    @classmethod
    def setUpClass(cls):
        from build_grand_cru_research import outputs
        cls.context = Context(*load_cru('romanee-saint-vivant'))
        cls.files, cls.register = outputs(cls.context)
        cls.evidence = json.loads(cls.files[cls.context.evidence])
        cls.curation = read_json(cls.context.curation)
        cls.table = read_json(HOLDER_LINKS)
        cls.resolved = resolve_curation(cls.curation, 'romanee-saint-vivant', cls.table)

    def test_all_eleven_holders_are_researched_without_a_nicholem_link(self):
        self.assertEqual(self.context.cru['tier'], 2)
        self.assertEqual(self.curation['holderLinks'], 'shared')
        self.assertEqual(len(self.curation['holders']), 11)
        for h in self.curation['holders']:
            self.assertNotIn('candidateNames', h)
            self.assertLessEqual(len(h['finding']), 330)
            entry = self.table['holders'][h['holderId']]
            self.assertTrue(any(s['at'] == '2026-10-08' for s in entry['searches']))
            self.assertIn('effort', entry)
        nicholem = self.table['holders']['484070800']
        self.assertEqual((nicholem.get('links', []), nicholem['searches'][-1]['outcome']), ([], 'no-link-found'))
        self.assertNotIn('484070800', self.evidence['holderDomains'])
        self.assertEqual(len(self.evidence['holderDomains']), 10)

    def test_new_relations_rest_on_company_records_and_stay_qualified(self):
        arlot = self.table['holders']['322235748']['links'][0]
        self.assertEqual((arlot['relation'], arlot['reviewStatus']), ('common-ownership', 'reviewed'))
        sources = {s['id']: s for s in self.table['sources']}
        self.assertTrue({'registry', 'company-filing'} <= {sources[s]['type'] for s in arlot['sourceIds']})
        cathiard = self.table['holders']['405387101']['links'][0]
        self.assertEqual((cathiard['relation'], cathiard['reviewStatus']), ('family-holding', 'provisional'))
        self.assertIn('No filing names a tenant', cathiard['basis'])
        confuron = self.table['holders']['U33201044']
        self.assertEqual(confuron['links'][0]['crus'], ['clos-de-vougeot', 'romanee-saint-vivant'])
        self.assertIn('AC 298', confuron['identity']['limitation'])
        # Lease and name-and-seat rows remain leads under the legal holder.
        for hid, basis in {'931134381': 'filing-tenant-relationship', 'U21852238': 'filing-tenant-relationship',
                           'U33201044': 'filing-tenant-relationship', 'U14149307': 'name-and-seat-crosswalk'}.items():
            self.assertEqual(self.evidence['holderDomains'][hid]['basis'], basis)
        self.assertEqual(self.table['holders']['U14149307']['links'][0]['reviewStatus'], 'provisional')

    def test_only_exact_current_references_are_parcel_filings(self):
        rows = {p['parcelId']: p for p in self.register['parcels']}
        sources = {s['id']: s for s in self.resolved['sources']}
        exact = set()
        for f in self.curation['parcelFilings']:
            exact.update(f['parcelAreasM2'])
            self.assertEqual(f['documentDate'], sources[f['sourceId']]['documentDate'])
            for pid, area in f['parcelAreasM2'].items():
                self.assertIn(f['holderId'], {r['holderId'] for r in rows[pid]['recordedRights']})
        self.assertEqual(exact, {'21714000AC0298', '21714000AC0300', '21714000AL0326', '21714000AL0330', '21714000AL0001'})
        # AL 1 is held jointly: each company's own filing names its undivided share.
        self.assertEqual(sorted(f['holderId'] for f in self.curation['parcelFilings'] if '21714000AL0001' in f['parcelAreasM2']),
                         ['528291362', 'U21852238'])
        self.assertEqual(self.register['counts']['withParcelFiling'], 5)

    def test_retired_hudelot_references_reach_the_2022_daughters_only_through_lineage(self):
        lineage = next(x for x in self.curation['externalResearch'] if x['id'] == 'rsv-hudelot-2001-ac271-273')
        self.assertEqual((lineage['basis'], lineage['parcelIds'], lineage['producer']), ('filing-named-cadastral-reference', [], None))
        rows = {p['parcelId']: p for p in self.register['parcels']}
        for n, former in ((357, 'AC0271'), (358, 'AC0271'), (359, 'AC0273'), (360, 'AC0273')):
            pid = f'21714000AC0{n}'
            self.assertEqual(rows[pid]['parcelFilingIds'], [])
            items = [i for i in self.evidence['parcels'][pid] if i['kind'] == 'research' and i.get('via') == former]
            self.assertEqual(len(items), 1)

    def test_a_former_owners_schedule_stays_research_not_a_filing(self):
        # Marey-Monge's statutes print today's AC230/231 areas, but it is not the recorded holder.
        former = next(x for x in self.curation['externalResearch'] if x['id'] == 'rsv-marey-monge-ac230-231')
        self.assertEqual((former['basis'], former['parcelIds']),
                         ('filing-named-cadastral-reference', ['21714000AC0230', '21714000AC0231']))
        self.assertNotIn('predecessorReferences', former)
        rows = {p['parcelId']: p for p in self.register['parcels']}
        for pid in former['parcelIds']:
            self.assertEqual(rows[pid]['parcelFilingIds'], [])
            self.assertEqual(rows[pid]['externalResearchIds'], ['rsv-marey-monge-ac230-231'])
            self.assertEqual({r['holderId'] for r in rows[pid]['recordedRights']}, {'778269407'})

    def test_equal_published_area_never_assigns_al325_or_al329(self):
        rows = {p['parcelId']: p for p in self.register['parcels']}
        # AL325's only lead is the critic's printed plot number: neither the equal published area nor a company link.
        self.assertEqual([(lead['name'], lead['basis']) for lead in rows['21714000AL0325']['candidateLeads']],
                         [('Domaine Dujac', 'critic-named-cadastral-reference')])
        self.assertEqual(rows['21714000AL0329']['researchStatus'], 'unresolved')
        dujac = next(h for h in self.curation['producerHoldings'] if h['id'] == 'rsv-dujac')
        self.assertEqual((dujac['publishedAreaHa'], dujac['producerHolderIds']), (0.1656, []))
        self.assertTrue(all('parcelIds' not in h for h in self.curation['producerHoldings']))
        self.assertEqual((self.register['counts']['parcels'] - self.register['counts']['unresolved'],
                          self.register['counts']['unresolved']), (16, 1))

    def test_winehog_numbers_count_when_number_and_rounded_area_match(self):
        articles = [s for s in self.curation['sources'] if s['type'] == 'critic-research']
        self.assertEqual(len(articles), 13)
        for s in articles:
            self.assertRegex(s['sha256'], r'^[0-9a-f]{64}$')
            self.assertTrue(s['url'].startswith('https://winehog.org/') and s['documentDate'] and s['bytes'])
        critic = [x for x in self.curation['externalResearch'] if x['basis'] == 'critic-named-cadastral-reference']
        self.assertEqual(sorted(p for x in critic for p in x['parcelIds']),
                         ['21714000AC0298', '21714000AC0300', '21714000AL0001', '21714000AL0325', '21714000AL0326',
                          '21714000AL0327'])
        # Dujac's 325 (0.170 ha) and Confuron's 300/298 (0.4982 ha) differ from the cadastre only by rounding.
        rounded = {x['id'] for x in critic if 'rounding' in x['finding'] or 'rounded' in x['finding']}
        self.assertEqual(rounded, {'rsv-wh-dujac-325', 'rsv-wh-confuron-298-300'})
        self.assertEqual(self.curation['unmatchedPrintedReferences'], [])
        self.assertFalse(any('not supplied' in g for g in self.curation['accessGaps']))

    def test_screened_filings_have_provenance_and_farming_stays_unverified(self):
        sources = {s['id']: s for s in self.resolved['sources']}
        own = [s for s in self.curation['sources'] if s['type'] == 'company-filing']
        self.assertTrue(own)
        for source in own:
            self.assertEqual(source['screenedPages'], source['pageCount'])
            self.assertRegex(source['sha256'], r'^[0-9a-f]{64}$')
            self.assertTrue(source['documentDate'] and source['retrievedAt'] and source['reviewedPages'])
            self.assertIn('filingDate', source)
        self.assertEqual(self.register['counts']['currentFarmerConfirmed'], 0)
        self.assertTrue(all(p['currentFarmer'] is None for p in self.register['parcels']))
        for d in self.evidence['holderDomains'].values():
            self.assertNotRegex(d['name'] + d['note'], r'(?i)\bfarms\b|farmed by|is farming')
        self.assertIn('Romanée-Saint-Vivant review', sources['heritiers-confuron-statutes-2024']['finding'])


class RomaneeContiTests(unittest.TestCase):
    """The DRC's 1974 schedule is exact only where the printed reference and area are today's."""

    @classmethod
    def setUpClass(cls):
        from build_grand_cru_research import outputs
        cls.context = Context(*load_cru('romanee-conti'))
        cls.files, cls.register = outputs(cls.context)
        cls.evidence = json.loads(cls.files[cls.context.evidence])
        cls.curation = read_json(cls.context.curation)
        cls.table = read_json(HOLDER_LINKS)

    def test_supplied_winehog_articles_print_no_romanee_conti_reference(self):
        articles = [s for s in self.curation['sources'] if s['type'] == 'critic-research']
        self.assertEqual(len(articles), 2)
        for s in articles:
            self.assertRegex(s['sha256'], r'^[0-9a-f]{64}$')
        self.assertFalse(any(x['basis'] == 'critic-named-cadastral-reference' for x in self.curation['externalResearch']))
        self.assertEqual(self.curation['unmatchedPrintedReferences'], [])
        self.assertFalse(any('not supplied' in g for g in self.curation['accessGaps']))

    def test_the_one_holder_is_researched_through_the_shared_link(self):
        self.assertEqual((self.context.cru['tier'], self.curation['holderLinks']), (2, 'shared'))
        self.assertEqual([h['holderId'] for h in self.curation['holders']], ['778269407'])
        entry = self.table['holders']['778269407']
        self.assertTrue(any(s['at'] == '2026-10-08' and 'Romanée-Conti estate publications' in s['where'] for s in entry['searches']))
        # Each later DRC pass replaces the effort note and keeps the prior pass's totals in it.
        self.assertIn('effort', entry)
        self.assertEqual(self.evidence['holderDomains']['778269407']['basis'], 'company-identity')
        self.assertEqual((self.register['counts']['holderLead'], self.register['counts']['unresolved']), (2, 0))

    def test_an72_is_exact_and_an258_inherits_only_through_the_1994_croquis(self):
        rows = {p['parcelId']: p for p in self.register['parcels']}
        self.assertEqual(rows['21714000AN0072']['parcelFilingIds'], ['rc-drc-1974'])
        self.assertEqual(rows['21714000AN0258']['parcelFilingIds'], [])
        lineage = next(x for x in self.curation['externalResearch'] if x['id'] == 'rc-drc-1974-an73')
        self.assertEqual((lineage['parcelIds'], lineage['predecessorReferences']), ([], {'21714000AN0073': ['21714000AN0258']}))
        items = [i for i in self.evidence['parcels']['21714000AN0258'] if i['kind'] == 'research' and i.get('via') == 'AN0073']
        self.assertEqual(len(items), 1)
        self.assertEqual(self.register['counts']['withParcelFiling'], 1)

    def test_the_published_total_stays_census_and_farming_unverified(self):
        holding = self.curation['producerHoldings'][0]
        self.assertEqual((holding['publishedAreaHa'], holding['namedAreas']), (1.814, ['LA ROMANEE CONTI']))
        self.assertNotIn('parcelIds', holding)
        self.assertEqual(self.register['counts']['currentFarmerConfirmed'], 0)
        for d in self.evidence['holderDomains'].values():
            self.assertNotRegex(d['name'] + d['note'], r'(?i)\bfarms\b|farmed by|is farming')


class LaRomaneeTests(unittest.TestCase):
    """A provisional rights identifier, its company and a dated lease recital stay separate from farming."""

    @classmethod
    def setUpClass(cls):
        from build_grand_cru_research import outputs
        cls.context = Context(*load_cru('la-romanee'))
        cls.files, cls.register = outputs(cls.context)
        cls.evidence = json.loads(cls.files[cls.context.evidence])
        cls.curation = read_json(cls.context.curation)
        cls.table = read_json(HOLDER_LINKS)
        cls.sources = {s['id']: s for s in cls.table['sources']}

    def test_supplied_winehog_articles_print_no_la_romanee_reference(self):
        articles = [s for s in self.curation['sources'] if s['type'] == 'critic-research']
        self.assertEqual(len(articles), 4)
        for s in articles:
            self.assertRegex(s['sha256'], r'^[0-9a-f]{64}$')
        self.assertFalse(any(x['basis'] == 'critic-named-cadastral-reference' for x in self.curation['externalResearch']))
        self.assertEqual(self.curation['unmatchedPrintedReferences'], [])
        self.assertFalse(any('not supplied' in g for g in self.curation['accessGaps']))

    def test_the_identifier_is_matched_to_its_company_by_filings(self):
        entry = self.table['holders']['U14132333']
        self.assertEqual(entry['identity']['companySiren'], '408280667')
        self.assertTrue({'registry', 'company-filing'} <= {self.sources[s]['type'] for s in entry['identity']['sourceIds']})
        self.assertIn('keeps the provisional identifier', entry['identity']['limitation'])
        # The rights file itself is not rewritten.
        self.assertEqual([r['holderId'] for r in self.register['parcels'][0]['recordedRights']], ['U14132333'])

    def test_the_family_link_is_reviewed_but_not_farming(self):
        link = self.table['holders']['U14132333']['links'][0]
        self.assertEqual((link['relation'], link['reviewStatus'], link['domaine']),
                         ('family-holding', 'reviewed', 'Domaine du Comte Liger-Belair'))
        self.assertIn('chateau-vosne-2021', link['sourceIds'])
        self.assertEqual(self.evidence['holderDomains']['U14132333']['basis'], 'family-company-record')
        self.assertEqual((self.register['counts']['holderLead'], self.register['counts']['currentFarmerConfirmed']), (1, 0))
        self.assertTrue(all(p['currentFarmer'] is None for p in self.register['parcels']))

    def test_both_filings_name_an74_with_its_exact_area(self):
        filings = {f['id']: f for f in self.curation['parcelFilings']}
        self.assertEqual(set(filings), {'lr-chateau-1967', 'lr-chateau-2021'})
        for f in filings.values():
            self.assertEqual((f['holderId'], f['companySiren'], f['parcelAreasM2']), ('U14132333', '408280667', {'21714000AN0074': 8452}))
        kinds = [l['kind'] for l in filings['lr-chateau-2021']['leaseEvidence']]
        self.assertEqual(kinds, ['existing-lease-recital', 'mise-a-disposition-declaration'])
        disposal = filings['lr-chateau-2021']['leaseEvidence'][1]
        self.assertEqual((disposal['beneficiarySiren'], disposal['declaredOn']), ('429010846', '2021-04-14'))
        self.assertIn('#364', disposal['limitation'])
        self.assertEqual(self.register['counts']['withParcelFiling'], 1)

    def test_the_published_area_stays_census(self):
        holding = self.curation['producerHoldings'][0]
        self.assertEqual((holding['publishedAreaHa'], holding['producerHolderIds'], holding['ownerHolderIds']), (0.8452, [], []))
        self.assertNotIn('parcelIds', holding)


class LaTacheTests(unittest.TestCase):
    """Both La Tâche parcels are named exactly in the DRC's 1974 schedule; the estate total stays census."""

    @classmethod
    def setUpClass(cls):
        from build_grand_cru_research import outputs
        cls.context = Context(*load_cru('la-tache'))
        cls.files, cls.register = outputs(cls.context)
        cls.evidence = json.loads(cls.files[cls.context.evidence])
        cls.curation = read_json(cls.context.curation)
        cls.table = read_json(HOLDER_LINKS)

    def test_supplied_winehog_articles_print_no_la_tache_reference(self):
        articles = [s for s in self.curation['sources'] if s['type'] == 'critic-research']
        self.assertEqual(len(articles), 4)
        for s in articles:
            self.assertRegex(s['sha256'], r'^[0-9a-f]{64}$')
        self.assertFalse(any(x['basis'] == 'critic-named-cadastral-reference' for x in self.curation['externalResearch']))
        self.assertEqual(self.curation['unmatchedPrintedReferences'], [])
        self.assertFalse(any('not supplied' in g for g in self.curation['accessGaps']))

    def test_both_parcels_have_the_1974_filing_and_the_shared_link(self):
        self.assertEqual((self.context.cru['tier'], self.curation['holderLinks']), (2, 'shared'))
        [filing] = self.curation['parcelFilings']
        self.assertEqual(filing['parcelAreasM2'], {'21714000AM0009': 46275, '21714000AM0016': 14345})
        self.assertEqual(filing['documentDate'], '1974-12-21')
        rows = {p['parcelId']: p for p in self.register['parcels']}
        self.assertTrue(all(r['parcelFilingIds'] == ['lt-drc-1974'] for r in rows.values()))
        self.assertEqual(self.evidence['holderDomains']['778269407']['basis'], 'company-identity')
        entry = self.table['holders']['778269407']
        self.assertTrue(any('La Tâche estate publications' in s['where'] for s in entry['searches']))

    def test_the_estate_total_is_census_and_farming_stays_unverified(self):
        [holding] = self.curation['producerHoldings']
        self.assertEqual((holding['publishedAreaHa'], sorted(holding['namedAreas'])), (6.062, ['LA TACHE', 'LES GAUDICHOTS OU LA TACHE']))
        self.assertEqual(self.curation['externalResearch'], [])
        self.assertEqual((self.register['counts']['holderLead'], self.register['counts']['currentFarmerConfirmed']), (2, 0))


class LaGrandeRueTests(unittest.TestCase):
    """Historical lease matches remain distinct from the company link and current farming."""

    @classmethod
    def setUpClass(cls):
        from build_grand_cru_research import outputs
        cls.context = Context(*load_cru('la-grande-rue'))
        cls.files, cls.register = outputs(cls.context)
        cls.evidence = json.loads(cls.files[cls.context.evidence])
        cls.curation = read_json(cls.context.curation)
        cls.table = read_json(HOLDER_LINKS)

    def test_supplied_winehog_articles_print_no_la_grande_rue_reference(self):
        articles = [s for s in self.curation['sources'] if s['type'] == 'critic-research']
        self.assertEqual(len(articles), 2)
        for s in articles:
            self.assertRegex(s['sha256'], r'^[0-9a-f]{64}$')
        self.assertFalse(any(x['basis'] == 'critic-named-cadastral-reference' for x in self.curation['externalResearch']))
        self.assertEqual(self.curation['unmatchedPrintedReferences'], [])
        self.assertFalse(any('not supplied' in g for g in self.curation['accessGaps']))

    def test_exact_lease_schedule_keeps_the_company_link_and_farming_separate(self):
        self.assertEqual((self.context.cru['tier'], self.curation['holderLinks']), (2, 'shared'))
        link = self.table['holders']['397738634']['links'][0]
        self.assertEqual((link['relation'], link['reviewStatus']), ('owner-company', 'reviewed'))
        self.assertEqual(self.evidence['holderDomains']['397738634']['basis'], 'company-identity')
        self.assertEqual(self.curation['externalResearch'], [])
        [filing] = self.curation['parcelFilings']
        self.assertEqual(filing['parcelAreasM2'], {
            '21714000AM0001': 14207, '21714000AM0002': 2096, '21714000AM0008': 222})
        self.assertEqual((filing['holderId'], filing['companySiren']), ('397738634', '397738634'))
        self.assertEqual(filing['documentDate'], '2010-10-05')
        lease, disposal = filing['leaseEvidence']
        self.assertEqual((lease['signedDates'], lease['endsOn']), (['2001-11-29'], '2018-12-31'))
        self.assertEqual(disposal['beneficiarySiren'], '353336068')
        self.assertEqual((self.register['counts']['holderLead'], self.register['counts']['withParcelFiling']), (3, 3))
        self.assertIn('effort', self.table['holders']['397738634'])

    def test_the_archived_estate_area_stays_census_and_farming_unverified(self):
        [holding] = self.curation['producerHoldings']
        self.assertEqual((holding['publishedAreaHa'], holding['precision'], holding['namedAreas']), (1.65, 'are', ['LA GRANDE RUE']))
        self.assertNotIn('parcelIds', holding)
        self.assertEqual(self.register['counts']['currentFarmerConfirmed'], 0)
        self.assertTrue(all(p['currentFarmer'] is None for p in self.register['parcels']))




class MontrachetTierTwoTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from build_grand_cru_research import outputs
        cls.context = Context(*load_cru('montrachet'))
        cls.files, cls.register = outputs(cls.context)
        cls.curation = read_json(cls.context.curation)
        cls.table = read_json(HOLDER_LINKS)
        cls.evidence = json.loads(cls.files[cls.context.evidence])

    def test_thenard_historical_aggregate_does_not_become_a_current_parcel_or_identity(self):
        source = next(s for s in self.table['sources'] if s['id'] == 'mt-pappers-thenard-1920')
        self.assertEqual((source['documentDate'], source['filingDate']), ('1920-01-03', '2002-10-17'))
        self.assertEqual((source['pageCount'], source['screenedPages']), (55, 55))
        holding = next(h for h in self.curation['producerHoldings'] if h['id'] == 'mt-thenard-1920-historical')
        self.assertIsNone(holding['publishedAreaHa'])
        self.assertEqual(holding['otherPublishedAreas'][0]['publishedAreaHa'], 1.7976)
        self.assertEqual(holding['producerHolderIds'] + holding['ownerHolderIds'], [])
        self.assertNotIn('parcelIds', holding)
        census = [h for a in self.register['namedAreaCensus'] for h in a['holdings']
                  if h['holdingId'] == holding['id']]
        self.assertTrue(census)
        self.assertTrue(all(h['beyondCompanyRecordsM2'] is None for h in census))
        printed = next(x for x in self.curation['unmatchedPrintedReferences'] if x['sourceId'] == source['id'])
        self.assertEqual(printed['parcelIds'], [])
        self.assertIn('list ordinal', printed['limitation'])
        self.assertFalse(self.table['holders']['U21850980'].get('identity'))
        self.assertEqual(self.table['holders']['U21850980']['effort']['pagesRead'], 31)
        for row in self.register['parcels']:
            if row['parcelId'] in ('21150000AE0032', '21150000AE0034'):
                self.assertEqual(row['parcelFilingIds'], [])
                self.assertIsNone(row['currentFarmer'])

    def test_all_holders_have_searches_without_invented_company_links(self):
        self.assertEqual(len(self.curation['holders']), 15)
        self.assertEqual(self.curation['holderLinks'], 'shared')
        for holder in self.curation['holders']:
            self.assertTrue(self.table['holders'][holder['holderId']]['searches'])
            self.assertFalse(holder['parcelOperationConfirmed'])
        for hid in ('212101505', 'U21850980'):
            self.assertFalse(self.table['holders'][hid].get('links'))
            self.assertNotIn(hid, self.evidence['holderDomains'])
        self.assertNotIn('identity', self.table['holders']['U21850980'])
        self.assertEqual(self.table['holders']['U18179542']['identity']['companySiren'], '443494075')
        self.assertEqual(self.register['counts']['currentFarmerConfirmed'], 0)

    def test_original_colin_references_reach_daughters_only_through_dfi(self):
        research = next(x for x in self.curation['externalResearch'] if x['id'] == 'mt-colin-retired-2003')
        self.assertEqual(research['parcelIds'], [])
        self.assertEqual(set(research['predecessorReferences']),
                         {f'21150000AE{n:04}' for n in (27, 28, 161, 162)})
        daughters = {p for ps in research['predecessorReferences'].values() for p in ps}
        self.assertEqual(daughters, {f'21150000AE{n:04}' for n in range(208, 221)})
        for row in self.register['parcels']:
            if row['parcelId'] in daughters:
                self.assertIn(research['id'], row['externalResearchIds'])
                self.assertEqual(row['parcelFilingIds'], [])
                self.assertIsNone(row['currentFarmer'])
        link = self.table['holders']['U18179061']['links'][0]
        self.assertEqual((link['relation'], link['leaseStatus'], link['crus']),
                         ('lessor-per-filing', 'recited', ['montrachet']))

    def test_exact_filings_require_current_holder_and_individual_area(self):
        expected = {'21150000AE0030': 2090, '21150000AE0031': 3419,
                    '21150000AE0033': 3773, '21150000AE0129': 1670,
                    '21150000AE0134': 821, '21512000AH0064': 20625}
        actual = {p: a for f in self.curation['parcelFilings'] for p, a in f['parcelAreasM2'].items()}
        self.assertEqual(actual, expected)
        opale = next(x for x in self.curation['externalResearch'] if x['id'] == 'mt-opale-ah151-2006')
        self.assertEqual(opale['parcelIds'], ['21512000AH0151'])
        self.assertIsNone(opale['producer'])
        self.assertNotIn('21512000AH0151', actual)
        rows = {p['parcelId']: p for p in self.register['parcels']}
        for f in self.curation['parcelFilings']:
            for p in f['parcelAreasM2']:
                self.assertIn(f['holderId'], {r['holderId'] for r in rows[p]['recordedRights']})

    def test_opale_retired_reference_uses_documented_lineage(self):
        record = next(x for x in self.curation['externalResearch'] if x['id'] == 'mt-opale-ah150-2006')
        self.assertEqual(record['parcelIds'], [])
        self.assertEqual(record['predecessorReferences'], {'21512000AH0150': ['21512000AH0182']})
        row = next(p for p in self.register['parcels'] if p['parcelId'] == '21512000AH0182')
        self.assertIn(record['id'], row['externalResearchIds'])
        self.assertEqual(row['parcelFilingIds'], [])
        self.assertIsNone(row['currentFarmer'])

    def test_supplied_winehog_preserves_area_conflicts_and_unnumbered_holdings(self):
        records = [x for x in self.curation['externalResearch'] if x['id'].startswith('mt-winehog-')]
        direct = {p for x in records for p in x['parcelIds']}
        self.assertEqual(direct, {'21512000AH0067', '21512000AH0066', '21150000AE0031',
                                  '21150000AE0129', '21150000AE0130', '21150000AE0025', '21150000AE0029',
                                  '21150000AE0024', '21150000AE0173'})
        for pid in ('21150000AE0030', '21150000AE0037', '21150000AE0134'):
            self.assertNotIn(pid, direct)
        colin = next(x for x in records if x['id'].endswith('-colin'))
        self.assertEqual(colin['parcelIds'], [])
        self.assertEqual(set(colin['predecessorReferences']),
                         {'21150000AE0027', '21150000AE0028', '21150000AE0161', '21150000AE0162'})
        unmatched = self.curation['unmatchedPrintedReferences']
        self.assertTrue(any('0.2009' in x['printedReference'] for x in unmatched))
        self.assertTrue(all(not x['parcelIds'] for x in unmatched))
        self.assertEqual(len([x for x in self.curation['sources'] if x['id'].startswith('mt-winehog-')]), 9)

    def test_individual_and_company_tenants_remain_distinct(self):
        fs = {f['id']: f for f in self.curation['parcelFilings']}
        self.assertEqual(fs['mt-laguiche-2002']['leaseEvidence'][0]['tenants'], ['An individual (Laguiche family)'])
        lease = fs['mt-leflaive-gfa-2009']['leaseEvidence'][0]
        self.assertEqual((lease['tenants'], lease['effectiveFrom'], lease['effectiveTo']),
                         (['Domaine Leflaive (778245316)'], '2009-07-04', '2033-11-11'))
        self.assertEqual(self.table['holders']['519806384']['links'][0]['crus'], ['montrachet'])
        for h in self.curation['producerHoldings']:
            self.assertNotIn('parcelIds', h)
        self.assertTrue(all(p['currentFarmer'] is None for p in self.register['parcels']))

    def test_printed_group_totals_name_parcels_only_when_today_sums_exactly(self):
        groups = {x['id']: x for x in self.curation['externalResearch']
                  if x.get('areaEvidence', {}).get('kind') == 'printed-group-total'}
        self.assertEqual({k: v['parcelIds'] for k, v in groups.items()}, {
            'mt-group-leflaive-chevalier': ['21512000AH0077', '21512000AH0131', '21512000AH0149'],
            'mt-group-bouchard-chevalier': ['21512000AH0011']})
        for item in groups.values():
            group = item['areaEvidence']['groupParcelAreasM2']
            self.assertEqual(sum(group.values()), item['areaEvidence']['printedTotalM2'])
            self.assertTrue(set(item['parcelIds']) <= set(group))
            self.assertIsNone(item['currentFarmer'])
        # Puligny 118-121 prints 0.8 ha against 7,998 m² today: a rounded total names no parcel.
        self.assertTrue(any(x['printedReference'].startswith('Puligny 118/119/120/121')
                            for x in self.curation['unmatchedPrintedReferences']))
        rows = {p['parcelId']: p for p in self.register['parcels']}
        for n in (118, 119, 120, 121):
            self.assertEqual(rows[f'21512000AH{n:04}']['researchStatus'], 'unresolved')

    def test_laguiche_reaches_drouhin_only_as_a_provisional_reported_tenancy(self):
        links = self.table['holders']['U18179542']['links']
        self.assertEqual([(x['domaine'], x['relation'], x['crus'], x['reviewStatus']) for x in links],
                         [('Maison Joseph Drouhin', 'reported-tenancy', ['montrachet'], 'provisional')])
        holder = next(h for h in self.curation['holders'] if h['holderId'] == 'U18179542')
        self.assertEqual(holder['basis'], 'reported-operator-relationship')
        self.assertFalse(holder['parcelOperationConfirmed'])
        lease = next(f for f in self.curation['parcelFilings'] if f['id'] == 'mt-laguiche-2002')['leaseEvidence'][0]
        self.assertNotIn('Drouhin', ' '.join(lease['tenants']))
        row = next(p for p in self.register['parcels'] if p['parcelId'] == '21512000AH0064')
        self.assertEqual(row['researchStatus'], 'holder-lead')
        self.assertIsNone(row['currentFarmer'])

    def test_lafon_recited_lease_covers_all_gfa_parcels_without_a_schedule(self):
        links = {x['relation']: x for x in self.table['holders']['778232892']['links']}
        lease = links['lessor-per-filing']
        self.assertEqual((lease['domaine'], lease['leaseStatus'], lease['crus']),
                         ('Domaine des Comtes Lafon', 'recited', ['montrachet']))
        self.assertIn('succession', links)
        # Two links to the same domaine remain one candidate and one domaine heading.
        self.assertEqual(self.evidence['holderDomains']['778232892']['name'], 'Domaine des Comtes Lafon')
        row = next(p for p in self.register['parcels'] if p['parcelId'] == '21150000AE0037')
        self.assertEqual([c['name'] for c in row['candidateLeads']], ['Domaine des Comtes Lafon'])
        self.assertEqual((row['parcelFilingIds'], row['currentFarmer']), ([], None))

    def test_map_readings_stay_labelled_by_how_they_were_matched(self):
        research = {x['id']: x for x in self.curation['externalResearch']}
        lamy = research['mt-winehog-32708-lamy-pillot']
        self.assertEqual((lamy['basis'], lamy['printedReferences'], lamy['parcelAreasM2']),
                         ('critic-named-cadastral-reference', ['AE24'], {'21150000AE0024': 542}))
        # The guide's 5 a 42 ca en métayage corroborates the number; the domaine is a sharecropper, not the owner.
        self.assertEqual(lamy['sourceIds'], ['mt-winehog-32708', 'census-mt-lamy-pillot-hachette'])
        census = {h['id']: h for h in self.curation['producerHoldings'] if h['id'].startswith('mt-census-')}
        self.assertEqual(census['mt-census-domaine-lamy-pillot']['relation'], 'metayer')
        fleurot = research['mt-winehog-29563-fleurot']
        self.assertEqual((fleurot['basis'], fleurot['printedReferences'], fleurot['parcelAreasM2']),
                         ('critic-attribution-area-reconstructed', [], {'21150000AE0173': 405}))
        self.assertFalse(any('34/24' in x['printedReference'] or 'Chassagne 34' in x['printedReference']
                             for x in self.curation['unmatchedPrintedReferences']))
        supplied = [s for s in self.curation['sources'] if s.get('suppliedImages')]
        self.assertTrue(supplied)
        for source in supplied:
            for image in source['suppliedImages']:
                self.assertRegex(image['sha256'], r'^[0-9a-f]{64}$')


class ChevalierTierTwoTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from build_grand_cru_research import outputs
        cls.context = Context(*load_cru('chevalier-montrachet'))
        cls.files, cls.register = outputs(cls.context)
        cls.curation = read_json(cls.context.curation)
        cls.table = read_json(HOLDER_LINKS)

    def test_supplied_violland_enclosure_and_auvenay_cash_increase_add_no_parcel_links(self):
        sources = {s['id']: s for s in self.table['sources']}
        violland = sources['ch-pappers-violland-1996']
        self.assertEqual((violland['documentDate'], violland['filingDate']), ('1996-10-08', '1996-11-06'))
        self.assertIn('349583500', violland['finding'])
        self.assertIn('515420305', violland['finding'])
        self.assertFalse(self.table['holders']['349583500'].get('links'))
        self.assertEqual(self.table['holders']['349583500']['effort']['pagesRead'], 30)
        auvenay = sources['ch-pappers-auvenay-2012']
        self.assertEqual((auvenay['documentDate'], auvenay['filingDate']), ('2012-10-29', '2013-01-14'))
        self.assertEqual((auvenay['pageCount'], auvenay['screenedPages']), (31, 31))
        self.assertEqual(self.table['holders']['778252445']['effort']['pagesRead'], 113)
        ids = {violland['id'], auvenay['id']}
        self.assertFalse(any(f['sourceId'] in ids for f in self.curation['parcelFilings']))
        self.assertEqual(self.register['counts']['withParcelFiling'], 3)
        self.assertEqual(self.register['counts']['currentFarmerConfirmed'], 0)

    def test_every_holder_is_reviewed_without_name_based_company_links(self):
        self.assertEqual(len(self.curation['holders']), 16)
        for h in self.curation['holders']:
            self.assertTrue(self.table['holders'][h['holderId']]['searches'])
            self.assertFalse(h['parcelOperationConfirmed'])
        for hid in ('349583500', '212105126', '752059824'):
            self.assertFalse(self.table['holders'][hid].get('links'))
        self.assertEqual(self.table['holders']['U21845345']['identity']['companySiren'], '778233098')

    def test_montille_partners_reach_montille_only_through_shared_management(self):
        links = self.table['holders']['751811472']['links']
        self.assertEqual([(x['domaine'], x['relation'], x['reviewStatus']) for x in links],
                         [('Domaine de Montille', 'management', 'reviewed')])
        sources = {s['id']: s for s in self.table['sources']}
        self.assertTrue(all(sources[s]['type'] == 'registry' for s in links[0]['sourceIds']))
        holder = next(h for h in self.curation['holders'] if h['holderId'] == '751811472')
        self.assertEqual(holder['basis'], 'management-only-lead')
        row = next(p for p in self.register['parcels'] if p['parcelId'] == '21512000AH0169')
        self.assertEqual((row['researchStatus'], row['parcelFilingIds'], row['currentFarmer']), ('holder-lead', [], None))
        self.assertEqual(self.register['counts']['currentFarmerConfirmed'], 0)

    def test_exact_schedules_keep_prieur_number_mismatch_unmatched(self):
        actual = {p: a for f in self.curation['parcelFilings'] for p, a in f['parcelAreasM2'].items()}
        self.assertEqual(actual, {'21512000AH0008': 724, '21512000AH0092': 2538, '21512000AH0093': 2537})
        row = next(x for x in self.curation['unmatchedPrintedReferences'] if 'AH3' in x['printedReference'])
        self.assertEqual(row['parcelIds'], [])
        current = next(p for p in self.register['parcels'] if p['parcelId'] == '21512000AH0123')
        self.assertEqual(current['parcelFilingIds'], [])
        self.assertNotIn('21512000AH0003', current['documentedAncestry']['ancestorIds'])

    def test_opale_history_reaches_both_daughters_without_transferring_a_tenant(self):
        x = next(x for x in self.curation['externalResearch'] if x['id'] == 'ch-opale-ah150-2006')
        self.assertEqual(x['parcelIds'], [])
        self.assertEqual(x['predecessorReferences'], {'21512000AH0150': ['21512000AH0182', '21512000AH0183']})
        for pid in x['predecessorReferences']['21512000AH0150']:
            row = next(p for p in self.register['parcels'] if p['parcelId'] == pid)
            self.assertIn(x['id'], row['externalResearchIds'])
            self.assertEqual(row['parcelFilingIds'], [])
            self.assertIsNone(row['currentFarmer'])
        prior = next(x for x in self.curation['externalResearch'] if x['id'] == 'ch-opale-ah151-2006')
        self.assertIsNone(prior['producer'])

    def test_latour_recitals_and_estate_census_do_not_verify_current_operation(self):
        filings = [f for f in self.curation['parcelFilings'] if f['holderId'] in ('427468962', '427468988')]
        self.assertEqual(len(filings), 2)
        for f in filings:
            lease = f['leaseEvidence'][0]
            self.assertEqual(lease['kind'], 'existing-lease-recital')
            self.assertEqual(lease['effectiveTo'], '2026-11-10')
            self.assertIn('Société Civile Domaine Louis Latour (778159715)', lease['tenants'])
        for h in self.curation['producerHoldings']:
            self.assertNotIn('parcelIds', h)
        self.assertTrue(all(p['currentFarmer'] is None for p in self.register['parcels']))

    def test_winehog_aggregate_totals_name_parcels_only_through_exact_group_sums(self):
        items = [x for x in self.curation['externalResearch'] if x['id'].startswith('ch-winehog-')]
        self.assertEqual({p for x in items for p in x['parcelIds']}, {'21512000AH0068', '21512000AH0126'})
        self.assertFalse(any('2.3295' in x['printedReference'] or '1.8273' in x['printedReference']
                             for x in self.curation['unmatchedPrintedReferences']))
        groups = {x['id']: x for x in self.curation['externalResearch']
                  if x.get('areaEvidence', {}).get('kind') == 'printed-group-total'}
        self.assertEqual(sorted(groups), ['ch-group-bouchard-chevalier', 'ch-group-chartron-chevalier',
                                          'ch-group-leflaive-chevalier'])
        for item in groups.values():
            evidence = item['areaEvidence']
            self.assertEqual(sum(evidence['groupParcelAreasM2'].values()), evidence['printedTotalM2'])
            self.assertEqual(set(item['parcelIds']), set(evidence['groupParcelAreasM2']))
            self.assertIsNone(item['currentFarmer'])
        self.assertEqual(groups['ch-group-leflaive-chevalier']['areaEvidence']['printedTotalM2'], 18273)
        self.assertEqual(groups['ch-group-bouchard-chevalier']['areaEvidence']['printedTotalM2'], 23295)
        # Chartron's numbers come from Winehog and its total from the estate's own table; both are cited.
        chartron = groups['ch-group-chartron-chevalier']
        self.assertEqual((chartron['areaEvidence']['referencesSourceId'], chartron['areaEvidence']['totalSourceId']),
                         ('ch-winehog-36080', 'ch-chartron-surfaces-2021'))
        self.assertEqual(chartron['parcelAreasM2'], {'21512000AH0140': 2778, '21512000AH0141': 2753})
        self.assertFalse(any('Chartron' in x['printedReference'] for x in self.curation['unmatchedPrintedReferences']))
        self.assertEqual(len([x for x in self.curation['producerHoldings'] if x['id'] == 'ch-winehog-holding-leflaive']), 1)
        self.assertEqual(self.register['counts']['currentFarmerConfirmed'], 0)



class BatardTierTwoTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from build_grand_cru_research import outputs
        cls.context = Context(*load_cru('batard-montrachet'))
        cls.files, cls.register = outputs(cls.context)
        cls.curation = read_json(cls.context.curation)
        cls.table = read_json(HOLDER_LINKS)

    def test_supplied_jouard_duplicate_does_not_inflate_sources_or_fill_omitted_schedules(self):
        matches = [s for s in self.table['sources']
                   if s.get('sha256') == '7cf26cb31dff554458446c6a450aefe88ddee46d4776b19877e4931b1c2481e1']
        self.assertEqual([s['id'] for s in matches], ['bat-filing-403784614-11'])
        self.assertEqual(self.table['holders']['403784614']['effort']['filingsScreened'], 6)
        self.assertEqual(self.table['holders']['403784614']['effort']['pagesRead'], 137)
        for row in self.register['parcels']:
            if row['parcelId'] in ('21150000AE0040', '21150000AE0052'):
                self.assertEqual(row['parcelFilingIds'], [])
                self.assertIsNone(row['currentFarmer'])

    def test_holder_links_keep_control_and_identity_distinct_from_operation(self):
        self.assertEqual(len(self.curation['holders']), 28)
        for h in self.curation['holders']:
            self.assertTrue(self.table['holders'][h['holderId']]['searches'])
            self.assertFalse(h['parcelOperationConfirmed'])
        for hid in ('349583500', '490242302', '429705551', '411738669', '832401855', '889363610'):
            self.assertFalse(self.table['holders'][hid].get('links'))
        self.assertEqual(self.table['holders']['442440095']['links'][0]['relation'], 'common-ownership')
        self.assertEqual(self.table['holders']['384800736']['links'][0]['domaine'], 'Maison Morey-Blanc')
        self.assertEqual(self.table['holders']['U29945686']['identity']['companySiren'], '382485027')
        self.assertEqual(self.register['counts']['currentFarmerConfirmed'], 0)

    def test_exact_schedules_retain_whole_area_and_limited_property_interests(self):
        actual = {p: a for f in self.curation['parcelFilings'] for p, a in f['parcelAreasM2'].items()}
        self.assertEqual(actual, {'21150000AE0046': 1746, '21512000AI0137': 916,
            '21512000AI0138': 917, '21150000AE0038': 2433, '21150000AE0071': 886,
            '21150000AE0157': 1304, '21512000AI0001': 3968,
            '21512000AI0121': 1675, '21512000AI0002': 1377})
        fs = {f['holderId']: f for f in self.curation['parcelFilings']}
        self.assertIn('purchase mandate', fs['832401855']['appNote'])
        self.assertIn('55.25%', fs['310370077']['appNote'])
        self.assertIn('bare soil', fs['429240302']['appNote'])
        self.assertEqual(fs['442440095']['leaseEvidence'][0]['effectiveTo'], '2022-09-15')
        for f in self.curation['parcelFilings']:
            for pid in f['parcelAreasM2']:
                row = next(p for p in self.register['parcels'] if p['parcelId'] == pid)
                self.assertIn(f['holderId'], {r['holderId'] for r in row['recordedRights']})

    def test_retired_bavard_reference_reaches_ai170_only_through_dfi(self):
        x = next(x for x in self.curation['externalResearch'] if x['id'] == 'bat-bavard-ai124')
        self.assertEqual(x['parcelIds'], [])
        self.assertEqual(x['predecessorReferences'], {'21512000AI0124': ['21512000AI0170']})
        row = next(p for p in self.register['parcels'] if p['parcelId'] == '21512000AI0170')
        self.assertIn(x['id'], row['externalResearchIds'])
        self.assertEqual(row['parcelFilingIds'], [])
        self.assertIsNone(row['currentFarmer'])
        prieur = next(x for x in self.curation['externalResearch'] if x['id'] == 'bat-prieur-brunet-ae57')
        self.assertEqual(prieur['parcelIds'], ['21150000AE0057'])
        self.assertNotIn('21150000AE0057', {p for f in self.curation['parcelFilings'] for p in f['parcelAreasM2']})

    def test_winehog_requires_both_number_and_individual_area(self):
        items = [x for x in self.curation['externalResearch']
                 if x['id'].startswith('bat-winehog-') and x['basis'] == 'critic-named-cadastral-reference']
        self.assertEqual({p: a for x in items for p, a in x['parcelAreasM2'].items()},
            {'21150000AE0046': 1746, '21150000AE0175': 1303, '21512000AI0144': 3508})
        self.assertTrue(all(not x['parcelIds'] for x in self.curation['unmatchedPrintedReferences']))
        self.assertEqual(len(self.curation['producerHoldings']), 22)
        self.assertTrue(all('parcelIds' not in h for h in self.curation['producerHoldings']))
        self.assertTrue(all(p['currentFarmer'] is None for p in self.register['parcels']))

    def test_coffinet_duvernay_is_matched_by_stated_side_and_exact_area_only(self):
        x = next(x for x in self.curation['externalResearch'] if x['id'] == 'bat-winehog-41492-coffinet-duvernay')
        self.assertEqual((x['basis'], x['printedReferences'], x['parcelAreasM2']),
                         ('critic-attribution-area-reconstructed', [], {'21150000AE0176': 1304}))
        rows = {p['parcelId']: p for p in self.register['parcels']}
        self.assertEqual(rows['21150000AE0176']['recordedRights'], [])
        self.assertEqual(rows['21150000AE0176']['researchStatus'], 'holder-lead')
        # The equal-area southern neighbour keeps its own filing and is not reassigned.
        self.assertNotIn(x['id'], rows['21150000AE0157']['externalResearchIds'])
        self.assertFalse(any('Coffinet-Duvernay' in u['printedReference'] for u in self.curation['unmatchedPrintedReferences']))

    def test_bienvenues_group_totals_reach_batard_edge_parcels(self):
        groups = {x['id']: x for x in self.curation['externalResearch']
                  if x.get('areaEvidence', {}).get('kind') == 'printed-group-total'}
        self.assertEqual({k: v['parcelIds'] for k, v in groups.items()},
                         {'bat-group-ramonet-bienvenues': ['21512000AI0017'],
                          'bat-group-leflaive-bienvenues': ['21512000AI0111']})
        for item in groups.values():
            self.assertEqual(sum(item['areaEvidence']['groupParcelAreasM2'].values()), item['areaEvidence']['printedTotalM2'])
        # Leflaive's 1.158 ha counts only as an owner-accepted dropped final zero (1.1580 ha).
        self.assertTrue(groups['bat-group-leflaive-bienvenues']['areaEvidence']['trailingZeroDropped'])
        self.assertNotIn('trailingZeroDropped', groups['bat-group-ramonet-bienvenues']['areaEvidence'])
        self.assertEqual((self.register['counts']['parcels'] - self.register['counts']['unresolved'],
                          self.register['counts']['unresolved']), (32, 57))



class BienvenuesTierTwoTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from build_grand_cru_research import outputs
        cls.context = Context(*load_cru('bienvenues-batard-montrachet'))
        cls.files, cls.register = outputs(cls.context)
        cls.curation = read_json(cls.context.curation)
        cls.table = read_json(HOLDER_LINKS)

    def test_bbm_individual_tenants_do_not_create_a_producer_company_link(self):
        bbm = self.table['holders']['391949849']
        self.assertFalse(bbm.get('links'))
        self.assertEqual(bbm['effort']['filingsScreened'], 4)
        self.assertEqual(bbm['effort']['pagesRead'], 141)
        self.assertFalse(self.table['holders']['349583500'].get('links'))
        f = next(x for x in self.curation['parcelFilings'] if x['holderId'] == '391949849')
        self.assertEqual(f['parcelAreasM2'], {'21512000AI0130': 1844})
        lease, mandate = f['leaseEvidence']
        self.assertEqual(lease['tenants'], ['Franck Guillemard (individual)', 'Corinne Clerc (individual)'])
        self.assertEqual(lease['effectiveTo'], '2011-10-31')
        self.assertEqual(mandate['kind'], 'replacement-lease-mandate')
        self.assertEqual(mandate['tenants'], [])

    def test_boundary_parcels_keep_whole_cadastral_areas_and_recorded_holders(self):
        actual = {p: a for f in self.curation['parcelFilings'] for p, a in f['parcelAreasM2'].items()}
        self.assertEqual(actual, {'21512000AI0001': 3968, '21512000AI0137': 916,
            '21512000AI0138': 917, '21512000AI0121': 1675, '21512000AI0122': 1320,
            '21512000AI0002': 1377, '21512000AI0026': 1162, '21512000AI0130': 1844})
        rows = {p['parcelId']: p for p in self.register['parcels']}
        for f in self.curation['parcelFilings']:
            for pid in f['parcelAreasM2']:
                self.assertIn(f['holderId'], {r['holderId'] for r in rows[pid]['recordedRights']})
        self.assertLess(rows['21512000AI0001']['cruOverlapM2'], actual['21512000AI0001'])
        self.assertEqual(self.table['holders']['U29945686']['identity']['companySiren'], '382485027')
        self.assertTrue(all(p['currentFarmer'] is None for p in rows.values()))

    def test_group_totals_name_parcels_only_when_exact_and_old_numbering_stays_unmatched(self):
        current = [x for x in self.curation['externalResearch'] if x['id'].startswith('bien-winehog-')]
        self.assertEqual({p: a for x in current for p, a in x['parcelAreasM2'].items()}, {'21512000AI0019': 5057})
        groups = {x['id']: x for x in self.curation['externalResearch']
                  if x.get('areaEvidence', {}).get('kind') == 'printed-group-total'}
        self.assertEqual({k: sorted(v['parcelIds']) for k, v in groups.items()}, {
            'bien-group-ramonet-bienvenues': ['21512000AI0017', '21512000AI0123'],
            'bien-group-leflaive-bienvenues': [f'21512000AI{n:04}' for n in (108, 110, 111, 139, 140, 141)]})
        for item in groups.values():
            self.assertEqual(sum(item['areaEvidence']['groupParcelAreasM2'].values()), item['areaEvidence']['printedTotalM2'])
            self.assertIsNone(item['currentFarmer'])
        # Leflaive's 1.158 ha counts only as an owner-accepted dropped final zero (1.1580 ha).
        self.assertTrue(groups['bien-group-leflaive-bienvenues']['areaEvidence']['trailingZeroDropped'])
        unmatched = self.curation['unmatchedPrintedReferences']
        self.assertEqual(len(unmatched), 1)
        self.assertTrue(all(not x['parcelIds'] for x in unmatched))
        self.assertIn('1839/1861', unmatched[0]['printedReference'])
        self.assertEqual(len(self.curation['producerHoldings']), 8)
        self.assertEqual((self.register['counts']['parcels'] - self.register['counts']['unresolved'],
                          self.register['counts']['unresolved']), (19, 19))
        self.assertTrue(all('parcelIds' not in x for x in self.curation['producerHoldings']))
        self.assertEqual(self.register['counts']['currentFarmerConfirmed'], 0)


class CriotsTierTwoTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from build_grand_cru_research import outputs
        cls.context = Context(*load_cru('criots-batard-montrachet'))
        cls.files, cls.register = outputs(cls.context)
        cls.curation = read_json(cls.context.curation)
        cls.table = read_json(HOLDER_LINKS)

    def test_partner_company_is_distinct_from_holder_and_provisional_identity(self):
        holders = self.table['holders']
        self.assertEqual(holders['419971130']['links'][0]['relation'], 'owner-company')
        partner = holders['778249052']['links'][0]
        self.assertEqual(partner['domaine'], 'Maison Prosper Maufoux')
        self.assertEqual(partner['relation'], 'partner-company')
        self.assertIn('cri-filing-778249052-1', partner['sourceIds'])
        self.assertIn('cri-legal-prosper', partner['sourceIds'])
        for hid in ('324396639', 'U21930118'):
            self.assertFalse(holders[hid].get('links'))
            self.assertFalse(holders[hid].get('identity'))
            self.assertTrue(holders[hid]['searches'])
        # The separately established company must not identify the provisional holder by name.
        self.assertTrue(holders['778252445']['links'])
        self.assertEqual(holders['U21930118']['effort']['pagesRead'], 113)
        self.assertEqual(self.register['counts']['currentFarmerConfirmed'], 0)

    def test_stock_and_other_section_references_do_not_create_parcel_filings(self):
        self.assertEqual(self.curation['parcelFilings'], [])
        # Only the owner-approved exact group total is research; stock and other-section references never are.
        self.assertEqual([x['id'] for x in self.curation['externalResearch']], ['cri-group-auvenay-criots'])
        for row in self.register['parcels']:
            self.assertEqual(row['parcelFilingIds'], [])
            self.assertIsNone(row['currentFarmer'])
        sources = {s['id']: s for s in self.table['sources']}
        self.assertIn('wine stocks', sources['cri-filing-419971130-13']['finding'])
        self.assertIn('AP91', sources['cri-filing-419971130-13']['finding'])
        self.assertEqual(sources['cri-filing-419971130-15']['documentDate'], '2023-07-25')
        self.assertIsNone(sources['cri-filing-419971130-15']['filingDate'])
        self.assertEqual(sources['cri-filing-324396639-5']['documentDate'], '1990-11-26')
        self.assertEqual(sources['cri-filing-324396639-5']['filingDate'], '2026-03-18')

    def test_exact_group_total_names_auvenay_parcels_and_census_never_allocates(self):
        unmatched = self.curation['unmatchedPrintedReferences']
        self.assertEqual(len(unmatched), 1)
        self.assertTrue(all(not x['parcelIds'] for x in unmatched))
        self.assertFalse(any('0.0637' in x['printedReference'] for x in unmatched))
        group = next(x for x in self.curation['externalResearch'] if x['id'] == 'cri-group-auvenay-criots')
        self.assertEqual(group['parcelAreasM2'], {'21150000AE0092': 370, '21150000AE0093': 267})
        self.assertEqual(group['areaEvidence']['printedTotalM2'], 637)
        # A critic's group total is not a company-record crosswalk for the provisional identifier.
        self.assertFalse(self.table['holders']['U21930118'].get('identity'))
        holdings = self.curation['producerHoldings']
        self.assertEqual({x['publishedAreaHa'] for x in holdings}, {0.0637, 0.05, 0.6, 0.21, 0.3313})
        self.assertTrue(all('parcelIds' not in x for x in holdings))
        self.assertTrue(all(not x['ownerHolderIds'] for x in holdings))
        auvenay = next(x for x in holdings if x['id'] == 'cri-winehog-auvenay-holding')
        self.assertEqual(auvenay['producerHolderIds'], [])
        self.assertEqual(self.register['counts']['holderLead'], 4)
        self.assertEqual(self.register['counts']['unresolved'], 7)
        for text in (str(self.curation), str(self.table['holders']['324396639'])):
            self.assertNotIn('Guerrand', text)


if __name__ == '__main__':
    unittest.main()
