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

if __name__ == '__main__':
    unittest.main()
