"""Guard research coverage and prevent hypotheses becoming farmer assignments."""
import copy
import json
import unittest

from build_grand_cru_evidence import build_evidence
from build_grand_cru_research import Context, build_register as build_cru_register
from grand_cru import HOLDER_LINKS, ROOT, load_cru, manifest_path, read_json, resolve_curation

CONTEXT = Context(*load_cru('echezeaux'))
CURATION, EVIDENCE, HISTORY, SALES, NAMED_AREAS = (CONTEXT.curation, CONTEXT.evidence, CONTEXT.history, CONTEXT.sales,
                                                   CONTEXT.named_areas)
MANIFEST = manifest_path(CONTEXT.bundle)


def build_register(*inputs, notice_records=None):
    return build_cru_register(*inputs, CONTEXT, notice_records)


class FarmingResearchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
        cls.asset = (ROOT / 'public' / cls.manifest['dataUrl'].lstrip('/')).read_bytes()
        # Domaine candidates come from the shared holder table, as the builder reads them.
        cls.curation = resolve_curation(json.loads(CURATION.read_text(encoding='utf-8')), 'echezeaux')
        cls.history = json.loads(HISTORY.read_text(encoding='utf-8'))
        cls.sales = json.loads(SALES.read_text(encoding='utf-8'))
        cls.named_areas = json.loads(NAMED_AREAS.read_text(encoding='utf-8'))

    def build(self, curation=None, asset=None, history=None, sales=None, named_areas=None):
        return build_register(self.manifest, asset or self.asset, curation or self.curation, history or self.history,
                              sales or self.sales, named_areas or self.named_areas)

    def test_domaine_headings_keep_research_sources_and_never_confirm_farming(self):
        result = self.build()
        evidence = build_evidence(result, self.curation, self.history, json.loads(self.asset)['features'])
        expected = {h['holderId']: h for h in self.curation['holders'] if len(h['candidateNames']) == 1}
        self.assertEqual(set(evidence['holderDomains']), set(expected))
        for hid, context in evidence['holderDomains'].items():
            self.assertEqual(context['name'], expected[hid]['candidateNames'][0])
            self.assertEqual(context['sources'], expected[hid]['sourceIds'])
            self.assertTrue(set(context['sources']) <= evidence['sources'].keys())
            self.assertNotIn('currentFarmer', context)
            self.assertNotIn('verified', context)
        self.assertEqual(result['counts']['currentFarmerConfirmed'], 0)
        self.assertEqual(result['counts']['unresolved'], 127)

    def test_pinned_population_and_no_invented_farmers(self):
        result = self.build()
        self.assertEqual(result['counts']['parcels'], 276)
        self.assertEqual(result['counts']['withRecordedRights'], 119)
        self.assertEqual(result['counts']['withoutMatchedRights'], 157)
        self.assertEqual(result['counts']['recordedHolders'], 36)
        rows = {p['parcelId']: p for p in result['parcels']}
        self.assertNotIn('212670000D0093', rows)  # Grands-Échezeaux is outside this register.
        self.assertEqual(rows['212670000D0177']['researchStatus'], 'historical-application')
        self.assertEqual(rows['212670000D0178']['researchStatus'], 'historical-application')
        self.assertTrue(all(p['currentFarmer'] is None and p['verifiedAsOf'] is None for p in rows.values()))
        self.assertEqual(sum(p['researchDepth'] == 'inventory-only' for p in rows.values()), 109)

    def test_snapshot_drift_fails_before_join(self):
        with self.assertRaisesRegex(ValueError, 'snapshot hash'):
            self.build(asset=self.asset + b' ')

    def test_refusal_keeps_the_negative_decision_and_never_authorises_farming(self):
        curation = copy.deepcopy(self.curation)
        event = curation['exactParcelEvents'][0]
        event.update(kind='refused-application', outcome='refused', appNote='Application refused; current farming unconfirmed.')
        result = self.build(curation)
        evidence = build_evidence(result, curation, self.history, json.loads(self.asset)['features'])
        for parcel_id in event['parcelIds']:
            row = next(p for p in result['parcels'] if p['parcelId'] == parcel_id)
            self.assertIsNone(row['currentFarmer'])
            self.assertNotEqual(row['researchStatus'], 'historical-authorisation')
            self.assertIn('this application was refused', row['nextEvidenceNeeded'])
            items = [i for i in evidence['parcels'][parcel_id] if event['sourceId'] in i['sources']]
            self.assertTrue(any(i['kind'] == 'notice' and i.get('label') == 'Application refused' for i in items))
            self.assertFalse(any(i['kind'] == 'authorisation' for i in items))

    def test_missing_holder_cannot_silently_lose_research(self):
        curation = copy.deepcopy(self.curation)
        curation['holders'].pop()
        with self.assertRaisesRegex(ValueError, 'every and only recorded holder'):
            self.build(curation)

    def test_unsupported_confirmation_is_rejected(self):
        curation = copy.deepcopy(self.curation)
        curation['holders'][0]['parcelOperationConfirmed'] = True
        with self.assertRaisesRegex(ValueError, 'cannot publish confirmed operation'):
            self.build(curation)
        curation = copy.deepcopy(self.curation)
        curation['exactParcelEvents'][0]['currentFarmer'] = 'Anne Gros'
        with self.assertRaisesRegex(ValueError, 'cannot establish current farming'):
            self.build(curation)

    def test_no_orphan_evidence_or_wrong_cru_reference(self):
        curation = copy.deepcopy(self.curation)
        curation['holders'][0]['sourceIds'] = ['nonexistent-source']
        with self.assertRaisesRegex(ValueError, 'Unknown holder source'):
            self.build(curation)
        curation = copy.deepcopy(self.curation)
        curation['exactParcelEvents'][0]['parcelIds'].append('212670000D0093')
        with self.assertRaisesRegex(ValueError, 'outside research cru'):
            self.build(curation)


    def test_rights_history_is_dated_context_not_farming(self):
        rows = {p['reference']: p for p in self.build()['parcels']}
        lamarche = rows['D 0168']['rightsChanges']
        self.assertEqual([c['kind'] for c in lamarche], ['record-appeared', 'same-holder-renamed'])
        self.assertEqual(lamarche[1]['before'], ['FONCIER VITI DOM FRANCOIS LAMARCHE'])
        self.assertEqual(rows['D 0898']['predecessorIds'], ['212670000D0143'])
        self.assertEqual(rows['D 0673']['rightsChanges'][-1]['after'], ['BOUCHON POURPRE'])
        self.assertTrue(all(p['currentFarmer'] is None for p in rows.values()))

    def test_history_must_match_snapshot_and_cannot_assign_farmers(self):
        history = copy.deepcopy(self.history)
        history['inputs']['parcelSnapshotSha256'] = '0' * 64
        with self.assertRaisesRegex(ValueError, 'another snapshot'):
            self.build(history=history)
        history = copy.deepcopy(self.history)
        history['parcels'].pop()
        with self.assertRaisesRegex(ValueError, 'every and only mapped parcel'):
            self.build(history=history)
        curation = copy.deepcopy(self.curation)
        curation['historyFindings'][0]['currentFarmer'] = 'Nicole Lamarche'
        with self.assertRaisesRegex(ValueError, 'cannot establish current farming'):
            self.build(curation)
        curation = copy.deepcopy(self.curation)
        curation['historyFindings'][0]['parcelIds'] = ['212670000D0093']
        with self.assertRaisesRegex(ValueError, 'outside research cru'):
            self.build(curation)


    def test_administrative_events_reach_split_parcels_only_through_lineage(self):
        rows = {p['reference']: p for p in self.build()['parcels']}
        self.assertEqual(rows['D 0665']['researchStatus'], 'historical-authorisation')
        self.assertEqual(rows['D 0667']['researchStatus'], 'holder-lead')  # same holder, not in the decision
        self.assertEqual(rows['D 0831']['candidateLeads'][0]['basis'], 'historical-application on predecessor D0774')
        curation = copy.deepcopy(self.curation)
        event = next(e for e in curation['exactParcelEvents'] if 'predecessorReferences' in e)
        event['predecessorReferences'] = {'212670000D0774': ['212670000D0832']}  # a successor of D0775 instead
        with self.assertRaisesRegex(ValueError, 'Event predecessor reference without matching cadastral lineage'):
            self.build(curation)

    def test_external_research_is_cited_and_never_a_farmer(self):
        rows = {p['reference']: p for p in self.build()['parcels']}
        self.assertIn('wh-d0510', rows['D 0510']['externalResearchIds'])
        # Winehog's retired D0792 reaches today's parcels only through recorded lineage.
        self.assertIn('wh-grivot', rows['D 0826']['externalResearchIds'])
        # Conflicting sources stay side by side; neither becomes the farmer.
        self.assertEqual({c['name'] for c in rows['D 0677']['candidateLeads']},
                         {'Domaine David Duband', 'Domaine Arnoux-Lachaux'})
        self.assertIsNone(rows['D 0510']['currentFarmer'])
        curation = copy.deepcopy(self.curation)
        curation['externalResearch'][0]['currentFarmer'] = 'Hospices de Beaune'
        with self.assertRaisesRegex(ValueError, 'cannot establish current farming'):
            self.build(curation)
        # Inherited references are labelled and must follow accepted lineage, not a spatial sliver.
        self.assertEqual(rows['D 0826']['candidateLeads'][0]['basis'],
                         'critic-named-cadastral-reference on predecessor D0792')
        self.assertFalse(any('Grivot' in c['name'] or 'predecessor' in c['basis'] for c in rows['D 0793']['candidateLeads']))
        curation = copy.deepcopy(self.curation)
        grivot = next(x for x in curation['externalResearch'] if x['id'] == 'wh-grivot')
        grivot['predecessorReferences']['212670000D0792'].append('212670000D0793')
        with self.assertRaisesRegex(ValueError, 'External research predecessor reference without matching cadastral lineage'):
            self.build(curation)
        curation = copy.deepcopy(self.curation)
        curation['externalResearch'][0]['sourceIds'] = []
        with self.assertRaisesRegex(ValueError, 'Unknown external research source'):
            self.build(curation)

    def test_a_sale_lead_names_a_later_holder_without_asserting_a_buyer(self):
        result = self.build()
        rows = {p['reference']: p for p in result['parcels']}
        self.assertEqual(result['counts']['withSaleRecord'], 45)
        # DVF+ reaches back to 2014: D0671 and D0673 left Assurances du Crédit Mutuel Vie in one sale, 24 December 2019.
        self.assertEqual([(s['date'], s['nature']) for s in rows['D 0671']['saleRecords']], [('2019-12-24', 'sale')])
        self.assertEqual(result['counts']['saleLead'], 1)
        # D0146 went in a single-disposition sale with four parcels first recorded to LES CRUOTS in January 2025.
        lead = rows['D 0146']['candidateLeads']
        self.assertEqual([(c['name'], c['basis']) for c in lead], [('LES CRUOTS', 'co-sale-with-later-company-holder')])
        self.assertIn('not necessarily the buyer', rows['D 0146']['nextEvidenceNeeded'])
        self.assertEqual(rows['D 0146']['parcelFilingIds'], [])
        self.assertEqual(rows['D 0146']['researchStatus'], 'sale-lead')
        self.assertIsNone(rows['D 0146']['currentFarmer'])
        # Parcels with their own record keep it; exchanges and sales without a later company holder give no lead.
        self.assertFalse(any(c['basis'] == 'co-sale-with-later-company-holder' for c in rows['D 0144']['candidateLeads']))
        self.assertEqual(rows['D 0835']['candidateLeads'], [])
        self.assertEqual(rows['D 0835']['saleRecords'][0]['nature'], 'exchange')
        # A sale with several dispositions may split parcels between buyers: no lead.
        curation_sales = copy.deepcopy(self.sales)
        next(d for d in curation_sales['deeds'] if '212670000D0146' in d['parcelIds'])['dispositions'] = 2
        split = {p['reference']: p for p in self.build(sales=curation_sales)['parcels']}
        self.assertEqual(split['D 0146']['candidateLeads'], [])
        self.assertEqual(rows['D 0301']['researchStatus'], 'unresolved')
        self.assertEqual(rows['D 0301']['researchDepth'], 'sale-record-reviewed')

    def test_sale_records_must_match_snapshot_and_cru(self):
        sales = copy.deepcopy(self.sales)
        sales['inputs']['parcelSnapshotSha256'] = '0' * 64
        with self.assertRaisesRegex(ValueError, 'another snapshot'):
            self.build(sales=sales)
        sales = copy.deepcopy(self.sales)
        sales['deeds'][0]['parcelIds'].append('212670000D0093')
        with self.assertRaisesRegex(ValueError, 'Sale record outside research cru'):
            self.build(sales=sales)
        # Prices and addresses are never kept.
        self.assertTrue(all(set(d) == {'deedId', 'date', 'nature', 'dispositions', 'parcelIds', 'otherParcels'}
                            for d in self.sales['deeds']))

    def test_census_compares_areas_and_never_places_holdings_on_parcels(self):
        result = self.build()
        census = {a['sourceName']: a for a in result['namedAreaCensus']}
        self.assertEqual(sum(a['withoutCompanyRecord'] for a in census.values()), 157)
        self.assertIsNone(census['LES POULA']['name'])  # no reviewed crosswalk to Les Poulaillères
        orveaux = {e['holdingId']: e for e in census['EN ORVEAUX']['holdings']}
        self.assertEqual(orveaux['clerget']['beyondCompanyRecordsM2'], 10900 - orveaux['clerget']['recordedToProducerM2'])
        self.assertIsNone(orveaux['cacheux']['beyondCompanyRecordsM2'])  # spread over two named areas
        vigot = next(e for e in census['LES ROUGES DU BAS']['holdings'] if e['holdingId'] == 'vigot')
        self.assertIsNone(vigot['beyondCompanyRecordsM2'])  # a métayer farms land already recorded to its owner
        self.assertTrue(all(p['candidateLeads'] == [] for p in result['parcels']
                            if p['namedArea'] == 'EN ORVEAUX' and p['researchStatus'] == 'unresolved'))
        curation = copy.deepcopy(self.curation)
        curation['producerHoldings'][0]['parcelIds'] = ['212670000D0362']
        with self.assertRaisesRegex(ValueError, 'cannot name parcels'):
            self.build(curation)
        curation = copy.deepcopy(self.curation)
        curation['producerHoldings'][0]['namedAreas'] = ['LES POULAILLERES']
        with self.assertRaisesRegex(ValueError, 'unknown named area'):
            self.build(curation)

    def test_exact_area_match_names_the_farmer_as_research_only(self):
        rows = {p['reference']: p for p in self.build()['parcels']}
        self.assertIn('gm-d0362', rows['D 0362']['externalResearchIds'])
        self.assertIn(('Domaine Gérard Mugneret (métayer)', 'estate-area-exact-match'),
                      {(c['name'], c['basis']) for c in rows['D 0362']['candidateLeads']})
        self.assertIsNone(rows['D 0362']['currentFarmer'])
        self.assertIn('vigot-d0195', rows['D 0195']['externalResearchIds'])
        vigot = next(x for x in self.curation['externalResearch'] if x['id'] == 'vigot-d0195')
        self.assertEqual(vigot['basis'], 'estate-area-near-match')

    def test_corporate_connections_are_leads_never_farmers(self):
        rows = {p['reference']: p for p in self.build()['parcels']}
        expected = {'D 0650': ('Domaine Méo-Camuzet', 'registered-office-match'),
                    'D 0313': ("Domaine de la Pousse d'Or", 'management-and-estate-context')}
        for ref, lead in expected.items():
            self.assertIn(lead,
                          {(c['name'], c['basis']) for c in rows[ref]['candidateLeads']})
            self.assertIsNone(rows[ref]['currentFarmer'])
        # A 1998 guide area equals the Drouhin land company's four parcels exactly; still research, not farming.
        self.assertIn(('Domaine Joseph Drouhin', 'critic-attribution-area-reconstructed'),
                      {(c['name'], c['basis']) for c in rows['D 0633']['candidateLeads']})
        # Companies with no domaine link found stay without a candidate.
        for ref in ('D 0813', 'D 0814', 'D 0898'):
            self.assertEqual(rows[ref]['candidateLeads'], [])

    def test_filings_preserve_dates_roles_and_partial_scope_without_confirming_farmers(self):
        result = self.build()
        rows = {p['reference']: p for p in result['parcels']}
        self.assertEqual(result['counts']['withParcelFiling'], 28)
        for ref in ('D 0144', 'D 0128', 'D 0316'):
            self.assertEqual(rows[ref]['researchDepth'], 'parcel-filing-reviewed')
            self.assertIsNone(rows[ref]['currentFarmer'])
        filings = {f['id']: f for f in self.curation['parcelFilings']}
        cruots = filings['les-cruots-2024']
        self.assertEqual(cruots['acquisitionRecital']['date'], '2024-03-14')
        self.assertEqual(cruots['leaseEvidence'][1]['operatorPermission']['siren'], '809967854')
        self.assertNotIn('212670000D0146', cruots['parcelAreasM2'])
        orveaux = filings['orveaux-2024']
        self.assertEqual((sum(orveaux['parcelAreasM2'].values()), orveaux['plantableAndPlantedAreaM2'],
                          sum(orveaux['leaseEvidence'][0]['parcelAreasM2'].values())), (5263, 4147, 4550))
        self.assertEqual(orveaux['leaseEvidence'][0]['tenants'], ['Laurent Jousset-Drouhin'])
        self.assertEqual(filings['forey-2024']['leaseEvidence'][1]['kind'], 'lease-mandate')
        curation = copy.deepcopy(self.curation)
        curation['parcelFilings'][1]['leaseEvidence'][0]['parcelAreasM2']['212670000D0316'] = 827
        with self.assertRaisesRegex(ValueError, 'Lease area exceeds'):
            self.build(curation)
        curation = copy.deepcopy(self.curation)
        curation['parcelFilings'][0]['currentFarmer'] = 'Rouget'
        with self.assertRaisesRegex(ValueError, 'cannot establish current farming'):
            self.build(curation)

    def test_coudray_and_hor_deeds_keep_historical_dates_and_exact_lease_scope(self):
        result = self.build()
        rows = {p['reference']: p for p in result['parcels']}
        sources = {s['id']: s for s in self.curation['sources']}
        self.assertEqual(sources['coudray']['documentDate'], '2004-06-26')
        self.assertEqual(sources['coudray']['statutesUpdatedDate'], '2024-09-05')
        self.assertEqual(sources['coudray']['filingLabelDate'], '2024-11-15')
        for ref in ('D 0635', 'D 0714', 'D 0719'):
            self.assertEqual(rows[ref]['parcelFilingIds'], ['coudray-2004'])
            self.assertIn('Domaine Coudray-Bizot', {c['name'] for c in rows[ref]['candidateLeads']})
            self.assertIsNone(rows[ref]['currentFarmer'])
        self.assertIn('Domaine du Château de Marsannay',
                      {c['name'] for c in rows['D 0815']['candidateLeads']})
        self.assertIsNone(rows['D 0815']['currentFarmer'])
        for ref in ('D 0813', 'D 0814'):
            self.assertEqual(rows[ref]['parcelFilingIds'], [])
            self.assertEqual(rows[ref]['candidateLeads'], [])
        evidence = build_evidence(result, self.curation, self.history,
                                  json.loads(self.asset)['features'])
        for pid, date in [('212670000D0635', '2004-06-26'), ('212670000D0815', '2021-06-30')]:
            filing = next(x for x in evidence['parcels'][pid] if x['kind'] == 'filing')
            self.assertEqual(filing['date'], date)
        # The primary deed date must not overwrite the observed annual-record interval.
        change = next(x for x in rows['D 0815']['rightsChanges']
                      if 'SCI LES CLIMATS' in x['after'])
        self.assertEqual((change['from'], change['to']), ('2022-01-01', '2023-01-01'))

    def test_bouchy_recital_keeps_tenant_scope_and_suspended_application_separate(self):
        result = self.build()
        rows = {p['reference']: p for p in result['parcels']}
        filing = next(f for f in self.curation['parcelFilings'] if f['id'] == 'bouchy-tardy-2019')
        lease = filing['leaseEvidence'][0]
        self.assertEqual(sum(filing['parcelAreasM2'].values()), 3476)
        self.assertEqual(lease['tenants'], ['Jean Tardy'])
        identity = filing['operatorIdentityEvidence']
        self.assertEqual((identity['siren'], identity['conversionDate']), ('429171382', '2024-07-25'))
        self.assertNotIn('tenantSiren', lease)  # Company identity cannot replace the personal tenant.
        self.assertEqual(lease['signedDate'], '2001-10-19')  # Separate Tardy 2000 lease is not imported.
        self.assertEqual(lease['recitedEnd'], '2026-10-18')  # 2035 belongs to the Nuits lease.
        self.assertNotIn('212670000D0673', filing['parcelAreasM2'])
        evidence = build_evidence(result, self.curation, self.history, json.loads(self.asset)['features'])
        for ref in ('0628', '0764', '0765', '0766', '0767'):
            row = rows[f'D {ref}']
            self.assertIsNone(row['currentFarmer'])
            items = evidence['parcels'][f'212670000D{ref}']
            item = next(i for i in items if i['kind'] == 'filing')
            self.assertEqual(item['date'], '2019-08-05')  # Neither the lease start nor 2020 filing.
            self.assertTrue(any(i['kind'] == 'suspended' for i in items))
            self.assertFalse(any(i['kind'] == 'authorisation' for i in items))
        # The 2026-labelled corporate records cannot become parcel-specific farming events.
        for ref in ('0313', '0295', '0296', '0297', '0298', '0299', '0673'):
            self.assertEqual(rows[f'D {ref}']['parcelFilingIds'], [])

    def test_bouchy_1995_mandate_completes_the_historical_five_parcel_scope_without_proving_execution(self):
        result = self.build()
        rows = {p['reference']: p for p in result['parcels']}
        filings = {f['id']: f for f in self.curation['parcelFilings']}
        old = filings['bouchy-mondange-expansion-1995']
        later = filings['bouchy-tardy-2019']
        self.assertEqual(set(old['parcelAreasM2']), {
            '212670000D0628', '212670000D0765', '212670000D0767'
        })
        self.assertEqual(old['areaEvidence']['recitedTotalM2'], 2216)
        self.assertEqual(old['leaseEvidence'][0]['tenants'], ['Bernard Mondange'])
        self.assertEqual(old['leaseEvidence'][0]['kind'], 'lease-mandate')
        self.assertEqual(sum(old['parcelAreasM2'].values()) + 1260, sum(later['parcelAreasM2'].values()))
        evidence = build_evidence(result, self.curation, self.history, json.loads(self.asset)['features'])
        for ref in ('0628', '0765', '0767'):
            row = rows[f'D {ref}']
            self.assertIn('bouchy-mondange-expansion-1995', row['parcelFilingIds'])
            items = [i for i in evidence['parcels'][f'212670000D{ref}'] if i['kind'] == 'filing']
            self.assertEqual([i['date'] for i in items[:2]], ['2019-08-05', '1995-09-15'])
            self.assertIsNone(row['currentFarmer'])

    def test_clerget_d0796_deed_and_fusion_establish_ownership_chain_not_current_farming(self):
        result = self.build()
        rows = {p['reference']: p for p in result['parcels']}
        filings = {f['id']: f for f in self.curation['parcelFilings']}
        filing = filings['clerget-d0796-2002']
        self.assertEqual(filing['parcelAreasM2'], {'212670000D0796': 2319})
        self.assertEqual(filing['filingCompanySiren'], '430384354')
        self.assertEqual(filing['holderId'], '431340140')
        self.assertEqual(filing['successorEvidence']['toSiren'], '431340140')
        self.assertEqual(filing['successorEvidence']['effectiveDate'], '2023-12-11')
        row = rows['D 0796']
        self.assertIn('clerget-d0796-2002', row['parcelFilingIds'])
        self.assertEqual(row['researchDepth'], 'parcel-filing-reviewed')
        self.assertIsNone(row['currentFarmer'])
        evidence = build_evidence(result, self.curation, self.history, json.loads(self.asset)['features'])
        items = evidence['parcels']['212670000D0796']
        filing_item = next(i for i in items if i['kind'] == 'filing')
        self.assertEqual(filing_item['date'], '2002-01-18')
        self.assertTrue(any(i['kind'] == 'ownership' and i['date'] == '2024-01-01' for i in items))
        self.assertFalse(any(i['kind'] == 'authorisation' for i in items))

    def test_clerget_completion_source_is_cited_without_redating_the_deed(self):
        sid = 'clerget-merger-completion-2023'
        filing = next(f for f in self.curation['parcelFilings'] if f['id'] == 'clerget-d0796-2002')
        source = next(s for s in self.curation['sources'] if s['id'] == sid)
        self.assertEqual(source['documentDate'], '2023-12-11')
        self.assertEqual(source['filingLabelDate'], '2023-12-15')
        self.assertEqual(source['pageCount'], 39)
        self.assertEqual(sum(s.get('sha256') == source['sha256'] for s in self.curation['sources']), 1)
        self.assertEqual(filing['successorEvidence']['sourceId'], sid)
        self.assertEqual(filing['successorEvidence']['completionDate'], '2023-12-11')
        result = self.build()
        self.assertEqual(result['counts']['unresolved'], 127)
        self.assertEqual(result['counts']['withParcelFiling'], 28)
        evidence = build_evidence(result, self.curation, self.history, json.loads(self.asset)['features'])
        item = next(i for i in evidence['parcels']['212670000D0796'] if i['kind'] == 'filing')
        self.assertEqual(item['date'], '2002-01-18')
        self.assertEqual(item['sources'], ['clerget-gfv-apport-2002', sid, 'dgfip-history'])
        self.assertTrue(all(p['currentFarmer'] is None for p in result['parcels']))

    def test_unknown_supporting_filing_source_is_rejected(self):
        curation = copy.deepcopy(self.curation)
        filing = next(f for f in curation['parcelFilings'] if f['id'] == 'clerget-d0796-2002')
        filing['supportingSourceIds'] = ['not-a-source']
        with self.assertRaisesRegex(ValueError, 'Unknown supporting filing source'):
            self.build(curation)

    def test_founding_mandates_keep_named_and_unnamed_tenants_distinct(self):
        result = self.build()
        evidence = build_evidence(result, self.curation, self.history, json.loads(self.asset)['features'])
        filings = {f['id']: f for f in self.curation['parcelFilings']}
        grands = filings['grands-crus-mandate-1997']
        bonnes = filings['bonnes-pentes-mandate-1999']
        self.assertEqual(grands['leaseEvidence'][0]['tenants'], [])
        self.assertEqual(sum(grands['parcelAreasM2'].values()), 4389)
        self.assertEqual(bonnes['leaseEvidence'][0]['tenantSiren'], '394495493')
        for filing, date in [(grands, '1997-08-12'), (bonnes, '1999-07-05')]:
            self.assertEqual(filing['leaseEvidence'][0]['kind'], 'lease-mandate')
            for pid in filing['parcelAreasM2']:
                item = next(i for i in evidence['parcels'][pid] if i['kind'] == 'filing')
                self.assertEqual(item['date'], date)
                self.assertIn('authorizes', item['note'])
                self.assertFalse(any(i['kind'] == 'authorisation' for i in evidence['parcels'][pid]))
        lead = next(i for i in evidence['parcels']['212670000D0645'] if i['kind'] == 'lead')
        self.assertEqual(lead['label'], 'Named in a lease mandate')

    def test_aggregate_deed_area_cannot_be_presented_as_individual_recited_areas(self):
        curation = copy.deepcopy(self.curation)
        filing = next(f for f in curation['parcelFilings'] if f['id'] == 'bonnes-pentes-mandate-1999')
        self.assertNotIn('parcelAreasM2', filing['leaseEvidence'][0])
        self.assertEqual(filing['areaEvidence']['individualAreasSource'], 'pinned-cadastral-snapshot')
        filing['areaEvidence']['recitedTotalM2'] = 3411
        with self.assertRaisesRegex(ValueError, 'Aggregate filing area differs'):
            self.build(curation)
        filing['areaEvidence']['recitedTotalM2'] = 3410
        filing['leaseEvidence'][0]['parcelIds'].append('212670000D0650')
        with self.assertRaisesRegex(ValueError, 'Lease outside filing'):
            self.build(curation)

    def test_hor_account_area_is_not_doubled_or_promoted_to_a_parcel_lease(self):
        source = next(s for s in self.curation['sources'] if s['id'] == 'hor-accounts')
        self.assertEqual(source['assetAreaEvidence']['areaM2'], 3417)
        self.assertEqual(len(source['assetAreaEvidence']['assetCategories']), 2)
        self.assertFalse(source['assetAreaEvidence']['parcelReferencesStated'])
        for row in self.build()['parcels']:
            if row['reference'] in ('D 0813', 'D 0814'):
                self.assertEqual(row['candidateLeads'], [])
                self.assertEqual(row['parcelFilingIds'], [])
                self.assertIn('hor-asset-area-2024', row['historyFindingIds'])
                self.assertIsNone(row['currentFarmer'])

    def test_disputed_location_is_excluded_even_when_only_one_alternative_is_listed(self):
        curation = copy.deepcopy(self.curation)
        holding = next(h for h in curation['producerHoldings'] if h['id'] == 'af-gros')
        for areas in [['LES CHAMPS TRAVERSINS', 'LES LOÄCHAUSSES'], ['LES CHAMPS TRAVERSINS']]:
            holding['namedAreas'] = areas
            census = {a['sourceName']: a for a in self.build(curation)['namedAreaCensus']}
            for area in areas:
                entry = next(h for h in census[area]['holdings'] if h['holdingId'] == 'af-gros')
                self.assertIsNone(entry['beyondCompanyRecordsM2'])
                self.assertEqual(entry['sharedWith'], [])
            self.assertEqual(census['LES CHAMPS TRAVERSINS']['publishedBeyondCompanyRecordsM2'], 2546)

    def test_public_sources_add_research_but_never_a_farmer(self):
        rows = {p['reference']: p for p in self.build()['parcels']}
        # A 2007 court ruling names D 152 with its exact area; the pseudonymised family stays unnamed.
        self.assertIn('court-d0152', rows['D 0152']['externalResearchIds'])
        self.assertEqual(rows['D 0152']['candidateLeads'], [])
        # Liger-Belair's exact Cruots area equals D0793 + D0795; a lead, not a farmer.
        for ref in ('D 0793', 'D 0795'):
            self.assertIn(('Domaine du Comte Liger-Belair', 'estate-area-exact-match'),
                          {(c['name'], c['basis']) for c in rows[ref]['candidateLeads']})
            self.assertIsNone(rows[ref]['currentFarmer'])
        curation = copy.deepcopy(self.curation)
        curation['historicalOwnerLists'][0]['namedArea'] = 'LES POULAILLERES'
        with self.assertRaisesRegex(ValueError, 'Unknown named area'):
            self.build(curation)


class ParcelEvidenceTests(unittest.TestCase):
    """The app file must stay a list of dated records, never a farmer assignment."""

    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
        cls.asset = (ROOT / 'public' / cls.manifest['dataUrl'].lstrip('/')).read_bytes()
        cls.features = json.loads(cls.asset)['features']
        cls.curation = resolve_curation(json.loads(CURATION.read_text(encoding='utf-8')), 'echezeaux')
        cls.history = json.loads(HISTORY.read_text(encoding='utf-8'))
        cls.sales = json.loads(SALES.read_text(encoding='utf-8'))
        cls.named_areas = json.loads(NAMED_AREAS.read_text(encoding='utf-8'))
        cls.register = build_register(cls.manifest, cls.asset, cls.curation, cls.history, cls.sales, cls.named_areas,
                                      notice_records=json.loads(CONTEXT.notices.read_text(encoding='utf-8')))

    def build(self, curation=None):
        return build_evidence(self.register, curation or self.curation, self.history, self.features)

    def test_committed_file_is_current_and_makes_no_farmer_claim(self):
        built = self.build()
        self.assertEqual(json.loads(EVIDENCE.read_text(encoding='utf-8')), built)
        self.assertNotIn('currentFarmer', json.dumps(built))
        for items in built['parcels'].values():
            for item in items:
                self.assertTrue(set(item['sources']) <= built['sources'].keys())
                self.assertLessEqual(len(item.get('note', '')), 330)

    def test_notices_reach_parcels_of_both_crus_and_split_parcels_only_by_lineage(self):
        parcels = self.build()['parcels']
        kinds = lambda ref: {i['kind'] for i in parcels.get(f'212670000D{ref}', [])}
        self.assertIn('authorisation', kinds('0665'))
        self.assertIn('application', kinds('0093'))  # Grands-Échezeaux, named in the Anne Gros notice
        self.assertIn('suspended', kinds('0615'))
        self.assertTrue(any(i.get('via') == 'D0792' for i in parcels['212670000D0826']))
        # D0793 touched retired D0792 by only 1.9 m², so it is not a successor and inherits nothing from it.
        self.assertFalse(any(i.get('via') == 'D0792' for i in parcels.get('212670000D0793', [])))

    def test_a_record_without_a_short_app_note_is_rejected(self):
        curation = copy.deepcopy(self.curation)
        del curation['exactParcelEvents'][1]['appNote']
        with self.assertRaisesRegex(ValueError, 'needs a short appNote'):
            self.build(curation)
        curation = copy.deepcopy(self.curation)
        curation['externalResearch'][0]['appNote'] = 'x' * 400
        with self.assertRaisesRegex(ValueError, 'needs a short appNote'):
            self.build(curation)

    def test_other_cru_parcels_must_exist_and_stay_outside_the_register(self):
        curation = copy.deepcopy(self.curation)
        curation['exactParcelEvents'][0]['otherCruParcelIds'] = ['212670000D9999']
        with self.assertRaisesRegex(ValueError, 'Unknown other-cru parcel'):
            self.build(curation)

    def test_research_date_comes_only_from_the_selected_source(self):
        parcels = self.build()['parcels']
        drouhin = next(i for i in parcels['212670000D0316'] if i['kind'] == 'research')
        self.assertIsNone(drouhin['date'])  # 1998 vintage / 2001 guide, not a 2024 BODACC notice.
        millot = next(i for i in parcels['212670000D0798'] if i['kind'] == 'research')
        self.assertEqual(millot['date'], '2019-01-04')  # Named references are from the newer article.
        vigot = next(i for i in parcels['212670000D0195'] if i['kind'] == 'research')
        self.assertEqual(vigot['date'], '2006-11-17')
        self.assertEqual(vigot['label'], 'Near-area reconstruction')

    def test_filings_use_deed_dates_and_parcel_specific_lease_scope(self):
        parcels = self.build()['parcels']
        item = next(i for i in parcels['212670000D0316'] if i['kind'] == 'filing')
        self.assertEqual(item['date'], '2024-02-09')
        self.assertIn('726 m² of this 826 m² parcel', item['note'])
        whole = next(i for i in parcels['212670000D0636'] if i['kind'] == 'filing')
        self.assertIn('753 m² (this whole cadastral parcel)', whole['note'])
        self.assertFalse(any(i['kind'] == 'filing' for i in parcels['212670000D0146']))



class ResultsTableTests(unittest.TestCase):
    """Playbook section 5: each cru README's standard table is checked against its register."""

    def table_check(self, edit):
        from build_grand_cru_research import check_results_table, outputs
        cru, bundle = load_cru('clos-de-vougeot')
        context = Context(cru, bundle)
        files, register = outputs(context)
        text = edit((ROOT / cru['research']['methodDoc']).read_text(encoding='utf-8'))
        check_results_table(context, register['counts'], files[context.evidence], text)

    def test_committed_table_matches(self):
        self.table_check(lambda text: text)

    def test_a_legal_holder_is_not_a_lead(self):
        # 106 parcels have recorded rights, but a legal holder alone is not a lead.
        with self.assertRaisesRegex(ValueError, 'must start with 96,'):
            self.table_check(lambda text: text.replace('| Parcels with holder or research leads | 96', '| Parcels with holder or research leads | 106'))
        with self.assertRaisesRegex(ValueError, 'must start with 68'):
            self.table_check(lambda text: text.replace('| Parcels with no lead | 68', '| Parcels with no lead | 58'))

    def test_history_row_and_measured_payload_are_required(self):
        with self.assertRaisesRegex(ValueError, 'Official history to earliest records'):
            self.table_check(lambda text: '\n'.join(line for line in text.splitlines() if 'Official history' not in line))
        with self.assertRaisesRegex(ValueError, 'payload row must give the evidence file'):
            self.table_check(lambda text: '\n'.join(line.split('Evidence:')[0] + 'Evidence: 1 / 1 bytes |'
                                                   if line.startswith('| Raw / gzip payload') else line
                                                   for line in text.splitlines()))

if __name__ == '__main__':
    unittest.main()


class GrandsEchezeauxTests(unittest.TestCase):
    """The second cru through the generic pipeline: its own research, no farmer claims."""

    @classmethod
    def setUpClass(cls):
        from build_grand_cru_research import outputs
        cls.context = Context(*load_cru('grands-echezeaux'))
        cls.files, cls.register = outputs(cls.context)
        cls.evidence = json.loads(cls.files[cls.context.evidence])
        cls.curation = resolve_curation(json.loads(cls.context.curation.read_text(encoding='utf-8')), 'grands-echezeaux')

    def test_pinned_population_and_no_invented_farmers(self):
        counts = self.register['counts']
        self.assertEqual((counts['parcels'], counts['recordedHolders'], counts['withRecordedRights']), (32, 9, 19))
        self.assertEqual(counts['currentFarmerConfirmed'], 0)
        self.assertTrue(all(p['currentFarmer'] is None for p in self.register['parcels']))
        self.assertNotIn('currentFarmer', json.dumps(self.evidence))

    def test_notices_reach_only_their_exact_parcels(self):
        kinds = lambda ref: {i['kind'] for i in self.evidence['parcels'].get(f'212670000D{ref}', [])}
        self.assertIn('application', kinds('0093'))
        self.assertEqual({'suspended'}, kinds('0615') & {'suspended', 'application', 'authorisation'})
        self.assertEqual(kinds('0089'), set())  # no company record, no notice, no sale

    def test_research_stays_in_its_own_folder(self):
        for path in self.files:
            self.assertTrue(path == self.context.evidence or path.parent.name == 'grands-echezeaux', path)
        self.assertTrue(self.register['inputs']['curation'].startswith('docs/research/grands-echezeaux/'))

    def test_strengthened_leads_keep_their_evidence_limits(self):
        drouhin = self.evidence['holderDomains']['393095955']
        self.assertEqual(drouhin['basis'], 'management-and-estate-context')
        self.assertIn('sepv-apports-1994', drouhin['sources'])
        lamarche = self.evidence['holderDomains']['538257932']
        self.assertEqual(lamarche['basis'], 'reported-operator-relationship')
        self.assertIn('raa-2026-067', lamarche['sources'])  # reported tenancy does not erase suspension
        modot = next(h for h in self.curation['holders'] if h['holderId'] == 'U18178008')
        self.assertEqual(read_json(HOLDER_LINKS)['holders']['U18178008']['identity']['companySiren'], '778173500')
        self.assertFalse(modot['parcelOperationConfirmed'])
        self.assertNotIn('778173500', self.evidence['holderDomains'])  # do not rewrite the provisional rights ID

    def test_filings_keep_deed_dates_and_unmatched_printed_references(self):
        filings = {f['id']: f for f in self.curation['parcelFilings']}
        expected = {f'212670000D{n:04}' for n in [93, 103, 104, 105, 535, 615, 616]}
        self.assertEqual({p for f in filings.values() for p in f['parcelAreasM2']}, expected)
        self.assertEqual(self.register['counts']['withParcelFiling'], 7)
        sepv = filings['sepv-robert-contribution']
        self.assertEqual((sepv['documentDate'], sepv['filingDate']), ('1994-12-30', '1995-02-13'))
        self.assertEqual(sepv['parcelAreasM2']['212670000D0103'], 4740)
        printed = self.curation['unmatchedPrintedReferences'][0]
        self.assertEqual((printed['printedReference'], printed['parcelIds']), ('D11', []))
        self.assertNotIn('212670000D0111', expected)
        self.assertFalse(any(i['kind'] == 'filing' for i in self.evidence['parcels']['212670000D0111']))

    def test_printed_references_are_validated(self):
        # Identity crosswalks are validated with the shared holder table (test_grand_cru_holder_links).
        from build_grand_cru_research import load_inputs
        inputs = load_inputs(self.context)

        def build(curation):
            return build_cru_register(inputs['manifest'], inputs['asset'], curation, inputs['history'],
                                      inputs['sales'], inputs['named_areas'], self.context)
        curation = copy.deepcopy(self.curation)
        curation['unmatchedPrintedReferences'][0]['parcelIds'] = ['212670000D0111']
        with self.assertRaisesRegex(ValueError, 'cannot name current parcels'):
            build(curation)

    def test_reported_metayage_and_old_holdings_do_not_double_count(self):
        census = {h['holdingId']: h for h in self.register['namedAreaCensus'][0]['holdings']}
        self.assertEqual(census['liger-ge']['relation'], 'metayer')
        self.assertIsNone(census['liger-ge']['beyondCompanyRecordsM2'])
        for hid in ['kohut-ge', 'gros-frere-historical-ge']:
            self.assertIsNone(census[hid]['publishedAreaHa'])
            self.assertIsNone(census[hid]['beyondCompanyRecordsM2'])
            self.assertIsNone(census[hid]['endedSeason'])  # an intended lease end is not an actual last harvest
