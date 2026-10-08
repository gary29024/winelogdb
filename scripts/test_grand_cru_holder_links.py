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
        self.assertEqual((rows['21714000AL0325']['researchStatus'], rows['21714000AL0329']['researchStatus']),
                         ('unresolved', 'unresolved'))
        dujac = next(h for h in self.curation['producerHoldings'] if h['id'] == 'rsv-dujac')
        self.assertEqual((dujac['publishedAreaHa'], dujac['producerHolderIds']), (0.1656, []))
        self.assertTrue(all('parcelIds' not in h for h in self.curation['producerHoldings']))
        self.assertEqual((self.register['counts']['parcels'] - self.register['counts']['unresolved'],
                          self.register['counts']['unresolved']), (15, 2))

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

    def test_the_one_holder_is_researched_through_the_shared_link(self):
        self.assertEqual((self.context.cru['tier'], self.curation['holderLinks']), (2, 'shared'))
        self.assertEqual([h['holderId'] for h in self.curation['holders']], ['778269407'])
        entry = self.table['holders']['778269407']
        self.assertTrue(any(s['at'] == '2026-10-08' and 'Romanée-Conti estate publications' in s['where'] for s in entry['searches']))
        self.assertIn('Romanée-Conti #427', entry['effort']['note'])
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


if __name__ == '__main__':
    unittest.main()
