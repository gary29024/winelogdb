"""Guard research coverage and prevent hypotheses becoming farmer assignments."""
import copy
import json
import unittest

from build_echezeaux_farming_research import ROOT, CURATION, EVIDENCE, HISTORY, MANIFEST, NAMED_AREAS, SALES, build_register
from build_echezeaux_parcel_evidence import build_evidence


class FarmingResearchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
        cls.asset = (ROOT / 'public' / cls.manifest['dataUrl'].lstrip('/')).read_bytes()
        cls.curation = json.loads(CURATION.read_text(encoding='utf-8'))
        cls.history = json.loads(HISTORY.read_text(encoding='utf-8'))
        cls.sales = json.loads(SALES.read_text(encoding='utf-8'))
        cls.named_areas = json.loads(NAMED_AREAS.read_text(encoding='utf-8'))

    def build(self, curation=None, asset=None, history=None, sales=None, named_areas=None):
        return build_register(self.manifest, asset or self.asset, curation or self.curation, history or self.history,
                              sales or self.sales, named_areas or self.named_areas)

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

    def test_a_sale_dates_a_transfer_and_leads_only_through_a_company_co_buyer(self):
        result = self.build()
        rows = {p['reference']: p for p in result['parcels']}
        self.assertEqual(result['counts']['withSaleRecord'], 45)
        # DVF+ reaches back to 2014: D0671 and D0673 left Assurances du Crédit Mutuel Vie in one sale, 24 December 2019.
        self.assertEqual([(s['date'], s['nature']) for s in rows['D 0671']['saleRecords']], [('2019-12-24', 'sale')])
        self.assertEqual(result['counts']['saleLead'], 1)
        # D0146 went in a single-disposition sale with four parcels first recorded to LES CRUOTS in January 2025.
        lead = rows['D 0146']['candidateLeads']
        self.assertEqual([(c['name'], c['basis']) for c in lead], [('LES CRUOTS', 'same-sale-as-company-buyer')])
        self.assertEqual(rows['D 0146']['researchStatus'], 'sale-lead')
        self.assertIsNone(rows['D 0146']['currentFarmer'])
        # Parcels with their own record keep it; exchanges and sales without a company buyer give no lead.
        self.assertFalse(any(c['basis'] == 'same-sale-as-company-buyer' for c in rows['D 0144']['candidateLeads']))
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
        cls.curation = json.loads(CURATION.read_text(encoding='utf-8'))
        cls.history = json.loads(HISTORY.read_text(encoding='utf-8'))
        cls.sales = json.loads(SALES.read_text(encoding='utf-8'))
        cls.named_areas = json.loads(NAMED_AREAS.read_text(encoding='utf-8'))
        cls.register = build_register(cls.manifest, cls.asset, cls.curation, cls.history, cls.sales, cls.named_areas)

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


if __name__ == '__main__':
    unittest.main()
