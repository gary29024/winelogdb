# Bâtard-Montrachet parcels: Tier 2 (#448)

Bâtard-Montrachet uses INAO `inao-denom-273`, appellation 130.
Both Chassagne-Montrachet (21150) and Puligny-Montrachet (21512) are imported and audited as one parcel set; no division at the commune line is introduced. Tier 1 reviewed 7 October 2026; Tier 2 reviewed 10 October 2026 for season 2026 under the
[rollout playbook](../../grand-cru-parcel-rollout.md) and [#461 history method](../grand-cru-history.md).

**No current farmer is verified.** Recorded rights, filiation, deeds and
administrative procedures remain distinct evidence; none establishes current farming.

## Results

| Measure | Value |
| --- | ---: |
| Cadastral parcels | 89; 11.804698 ha of measured cru overlap |
| Parcels with recorded legal-entity rights (1 January 2025) | 35; 28 holder identifiers |
| Parcels without matched rights | 54 |
| Rights snapshots: available / imported years and missing releases | 2019–2025 / 2019–2025; no listed release missing; no earlier or 2026 rights file listed at the 7 October recheck |
| Parcels whose rights changed over the imported snapshot range | 22; names and unprovable identifiers distinguished from holder changes |
| Official DFI release and commune coverage | July 2026, complete department 21 member; 21150 validations 1989-04-12–2026-06-15; 21512 validations 1989-04-17–2026-06-29 |
| Earliest / latest reachable official DFI validation date | 1993-12-09 / 2026-03-12 |
| Cadastre vintages: earliest / latest obtained and gaps | 2017-07-06 / 2026-06-01; all 35 listed vintages per INAO commune through the pinned map obtained; September 2026 is outside the pinned geometry range |
| Current parcels with documented predecessors / pre-2019 events | 33 / 24 |
| Distinct DFI documents / analysis lots supporting those parcels | 15 / 15 |
| Inferred-only ancestry / unresolved references or conflicting events | 0 inferred-only current parcels; 0 unresolved DFI events, traversal issues or spatial conflicts; 90 terminal references reach a source boundary or unrecorded event |
| Sales and notices: available / imported date ranges and gaps | DVF+ declared 2014-01-01–2025-12-31, complete BFC 2026-1 archive imported; bundle observations 2014-01-03 to 2025-12-17. Notices: partial departmental 2004–2015, departmental 2016–2020 and regional 2019–2026 indexes; gaps below |
| Parcels with an authorisation / application or suspension | 1 |
| Parcels with sale records (DVF) | 15; 11 current-reference deeds, 0 historical-reference deeds |
| Parcels with holder or research leads | 29; 28 holder-lead parcels plus the retained application lead |
| Parcels with no lead | 60 |
| Verified farming links | 0 |
| Official history to earliest records (#461) | Delivered for per-cru review: complete official DFI member queried, earliest reachable validation 1993-12-09, all pinned geometry vintages and published rights; sale/notice coverage remains source-specific and qualified |
| Raw / gzip payload (parcels, evidence) | Parcels: 177,348 / 27,064 bytes. Evidence: 193,535 / 22,387 bytes |

Measurements use Python 3.12 `gzip.compress(data, mtime=0)`. The parcel download
is the shared 201-parcel Montrachet bundle; this cru selects 89 unique parcels.
No named-area asset loads. Parcel geometry and evidence load only after Parcel
rights is enabled; the production payload report checks compiled JS.

## Tier 1 to Tier 2

| Measure | Tier 1 | Tier 2 |
| --- | ---: | ---: |
| Parcels with research leads | 1 | 29 |
| Unresolved parcels | 88 | 60 |
| Reviewed holder links applicable to the cru | 0 | 22 |
| Parcels with exact company filings | 0 | 9 |
| Current farmers verified | 0 | 0 |

[The filing inventory](filings.md) records 68 new distinct company PDFs / 1936 screened pages, prior shared effort, acquisition hashes and the three supplied Winehog archives. Exact evidence retains the purchase-mandate, bare-interest and historical-lease qualifications. Sauzet's U identifier is crosswalked through company records. Bavard AI124 reaches AI170 only through official DFI and remains historical-only. All 28 holders are reviewed; six remain without a producer link.

| Recorded holder | Shared effort reused | New filings / pages | Finding |
| --- | ---: | ---: | --- |
| HOSPICES CIVILS DE BEAUNE (`200047827`) | 0 / 0 | 0 / 0 | Reuses the existing shared company link and search effort (0 filings / 0 screened pages). No new company relationship or current farming assertion. |
| SCE CHATEAU DE MALTROYE (`302265186`) | — | 4 / 81 | Matching 2024 statutes and registry establish Château de la Maltroye (302265186). No AE48 schedule in the bounded OCR corpus. The 2021 filing concerns Holding Cournut shares, not a land conveyance. The 2009 document cover prints distinct SIREN 500363619 despite appearing in this index: screened but not used for holder identity or exact parcel evidence. |
| DOMAINE BACHELET-RAMONET (`310370077`) | — | 4 / 168 | The 13 June 2024 deed contributes a 55.25% undivided bare-ownership interest in Puligny AI1, whole parcel 3968 m², to 310370077. The exact company/reference/whole-area match supports a filing entry. The lease is only recited (2000–2018 original term and a permission for company use); no current actual-operation conclusion. A May 2026 merger document is explicitly a project and cannot alone prove completed succession. The deed’s INAO prose swaps the appellation labels of AI1 and AL83; retain that inconsistency without changing geometry. Separately acquired 20 May 2026 statutes of 429240302 recite the merger approved 19 May 2026; keep that successor evidence distinct from the unchanged 2025 rights. |
| SCE MOREY COFFINET (`319015269`) | — | 4 / 161 | Company filings identify SCE Michel Morey-Coffinet (319015269), distinct from the separate trading company. Share contributions to Holding du Clos St Jean and family share donations do not supply an AE175 cadastral schedule. The estate 0.13 ha Bâtard holding remains named-area census only. |
| SOC CIV AGRIC  DOMAINE DE LA VOUGERAIE (`330713074`) | 3 / 26 | 0 / 0 | Reuses the existing shared company link and search effort (3 filings / 26 screened pages). No new company relationship or current farming assertion. |
| DOMAINE RAMONET (`333145183`) | — | 3 / 64 | Official registry and matching statutes establish Domaine Ramonet (333145183). The selected merger and capital/statute filings give no exact AI125 schedule. Family corporate partners remain corporate context, not proof of parcel operation. |
| DOMAINE LOUIS VIOLLAND (`349583500`) | 2 / 30 | 0 / 0 | Reuses the existing two-filings / 30-page no-link search. Co-recorded Vougeraie usufruct and individual corporate officers do not establish this company’s producer relationship. |
| MOREY-BLANC (`384800736`) | — | 4 / 133 | The official estate legal notice explicitly distinguishes Maison Morey-Blanc (384800736) from Domaine Pierre Morey (398077834). Matching company filings support the Maison identity, not substitution of Pierre Morey as holder. No exact AI154 schedule found in the complete OCR corpus. |
| DOMAINE VINCENT ET FRANCOIS JOUARD (`403784614`) | — | 6 / 137 | Official registry, statutes and estate legal notice identify Domaine Vincent et François Jouard (403784614). The 2023 capital contribution states real-estate contributions but the acquired authentic extract omits the individual schedules (pages 6–9; page 6 visually verified). No exact AE40/AE52 match is supported. The 1996 formation recites prior métayage without a cadastral schedule. Neither recital nor corporate identity establishes current farming. |
| SCE DOMAINE OPALE (`408395309`) | 5 / 89 | 0 / 0 | 23 June 2006 contribution conveys two half interests in each whole parcel. Individual complete areas 916 and 917 m² match the current Opale rights. No current operation claimed. Existing Opale-to-Olivier Leflaive Frères control link is reused unchanged. |
| HERITIERS ROUX COLIN (`411738669`) | — | 3 / 92 | The original 31 January 1997 GFA contribution names Chassagne AE71 at 886 m², matching current recorded rights and full cadastral area. Later 2019 and 2026 copies retain the same text with horizontal reproduction marks; the clean original is used for the historical contribution. Private family partners and a general obligation to lease do not identify a producer or current operator. |
| DOMAINE BACHELET MESNIL (`429240302`) | — | 2 / 103 | The original 2 June 1977 contribution prints Puligny AI121 at 1675 m² and Bienvenues AI122 at 1320 m². Current 2025 Bachelet-Mesnil rights match AI121. The 20 May 2026 statutes explicitly recite absorption of 310370077 approved 19 May, transformation to SAS, and the name Domaine Bachelet-Ramonet Père et Fils. This establishes legal-company continuity without replacing the 2025 rights snapshot or asserting current operation. The 1977 deed specifies that the contribution of vineyard land concerns bare soil, with the plants reserved by contributors; preserve that scope. |
| COOMBE CASTLE FINE WINES LTD (`429705551`) | — | 2 / 20 | French registry identifies a foreign legal entity; the French public index supplies no filings. Two UK candidate-company accounts (01916348), approved 16 March 2026 and 10 March 2025, describe an unspecified freehold vineyard and Wardsend Limited’s 90% shareholding, but print no AE54, individual area, French SIREN crosswalk, named parcel lease or producer-company control. B Leroux’s director role is not a producer crosswalk. No domaine link or exact parcel filing is accepted. |
| GUILLAUME BOILLOT (`440840049`) | — | 4 / 72 | The same 440840049 company is renamed from Guillaume Boillot to Henri Boillot in the 2025 statutes/official registry. Its current statutes retain contributions of Maison Henri Boillot shares in 2007 and 2010, supporting a family-holding link to that named Maison, not substitution of a separate Domaine company or an operator assignment. No AI15 schedule found; the existing 2019 refusal remains unchanged. |
| KBMFI (`442440095`) | — | 5 / 235 | KBMFI retains current AE38 (2433 m²). The November 2022 withdrawal preserves that parcel while other property leaves the company; the filing recites the prior leases ending effective 15 September 2022. ROMEFI is KBMFI’s sole shareholder in the December 2022 decisions and is a corporate managing partner of Domaine Bonneau du Martray (328186416) in the official registry. This supports common ownership, not an operator or tenancy link. |
| DOMAINE BAVARD JEAN PAUL (`484661939`) | — | 4 / 102 | Company statutes establish Domaine Bavard Jean Paul (484661939), wholly held by JLM (852211770) since 2022. The signed 26 August 2019 share transfer explicitly describes AI124 among parcels then operated by the company. It does not print an individual cadastral area and is not an exact current AI170 filing. AI124 reaches AI170 through documented DFI event 210:512:000:0000478:00001, validated 21 June 2021. After the user resumed the Tier 2 review, this remains dated historical context only; no verified current farming is asserted. |
| DOMAINE GB (`490242302`) | — | 5 / 150 | Domaine GB, formerly Domaine Alex Gambal, is wholly held by Cote d’Or Vineyards (851404954) in the 28 December 2023 statutes. The 2022 withdrawal names properties outside Bâtard; its Vougeraie métayage recital concerns those withdrawn properties, not AE65/AE177. The 2006 formation’s 18-year métayage concerns Volnay. No current producer crosswalk or exact Bâtard schedule accepted in this bounded corpus. |
| LES PETITS FILS DE PIERRE PONNELLE (`515620193`) | 2 / 33 | 0 / 0 | Reuses the existing shared company link and search effort (2 filings / 33 screened pages). No new company relationship or current farming assertion. |
| SA MAISON JOSEPH DROUHIN (`515620417`) | — | 4 / 68 | Official registry and four filings establish the Maison Joseph Drouhin company (515620417). Selected statutes and capital/object changes do not print an exact AE137/AE138 schedule. Company identity is not current operation. |
| H2O (`751761933`) | 4 / 59 | 0 / 0 | Reuses the existing shared company link and search effort (4 filings / 59 screened pages). No new company relationship or current farming assertion. |
| CONSORTIUM VITICOLE VINICOLE BOURGOGNE (`775567928`) | 2 / 30 | 0 / 0 | Reuses the existing shared company link and search effort (2 filings / 30 screened pages). No new company relationship or current farming assertion. |
| DOMAINE LEFLAIVE (`778245316`) | 4 / 111 | 0 / 0 | Reuses the existing shared company link and search effort (4 filings / 111 screened pages). No new company relationship or current farming assertion. |
| SCE DU DOMAINE D AUVENAY (`778252445`) | 3 / 113 | 0 / 0 | Reuses the existing shared company link and search effort (3 filings / 113 screened pages). No new company relationship or current farming assertion. |
| DOMAINE PRIEUR-BRUNET (`778253781`) | — | 4 / 110 | The 2022 decision renames the same company Domaine Prieur-Brunet. The 2017 share sale to HVB recites a 23 December 2015 lease including Chassagne AE57, without its individual area. Retain original-reference external research, not an exact filing. SAFER describes tenancy as of that transaction; neither a complete executed lease nor current actual cultivation is established. The 1964 contribution in the older bundle includes Bâtard wine stocks, not a Bâtard land schedule. |
| DOMAINE DE LA ROMANEE CONTI (`778269407`) | 7 / 548 | 0 / 0 | 1974 filing schedule matches current AE46 and 1746 m². Historical company property only. Existing DRC link and prior effort are reused unchanged. |
| HECATE (`832401855`) | — | 2 / 18 | Formation identifies Hécate and authorizes purchase of Chassagne AE157 for 13a04ca. Exact reference and full area agree with the current bare-right holder. This is a purchase mandate, not the executed acquisition or an operating lease; Axam 2 and Eaque corporate partners do not establish a producer crosswalk. |
| LES BATARD MONTRACHET (`889363610`) | — | 2 / 34 | Les Batard Montrachet company statutes and registry establish the legal entity and its financial-advisory shareholder. No AE160 land schedule or independently supported producer crosswalk in the acquired corpus. The company name is not a domaine identification. |
| ETIENNE SAUZET (`U29945686`) | — | 6 / 188 | The merger annex prints Puligny AI2 at 1377 m² (and Bienvenues AI26 at 1162 m²) as land contributed by 319864328 to 382485027. The 3 August 2018 resolutions explicitly approve and complete the merger; the 2019 resolutions rename the surviving company Domaine Etienne Sauzet while transferring the trading business to separate 842745762. Together with the official registry and exact cadastral match this supports a reviewed U29945686-to-382485027 crosswalk, not a SIREN correction in the rights file. |

## Geometry and named areas

The [commune audit](../../../scripts/grand-crus/reports/batard-montrachet-commune-audit.json) measures 57,822.904291 m² covered by Chassagne and 60,224.074035 m² by Puligny, with 4.116028 m² of shared ground counted once. The union covers 118,042.862298 m² of the 118,554.712179 m² INAO boundary. Saint-Aubin is pinned as a neighbour and has no contact. No own-commune contact below the import threshold is omitted.

The [boundary review](boundary-review.json) measures 511.849881 m² uncovered (0.431741%), with a source-hash-specific 511.9 m² cap. All seven components were visually reviewed: six narrow boundary strips/wedges, including a 48.896868 m² gap at the commune line, and one 1.514982 m² interior strip whose enclosing rectangle is 0.143 m wide. No source geometry is clipped, buffered, filled or simplified.

The [BIVB reference](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/batard-montrachet,2458,9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9MjE2Jnw%3D) supports the appellation and commune scope.
Cadastral names are reviewed as constituents, without declaring separate official
climats or producer holdings. The [named-area report](../../../scripts/grand-crus/reports/batard-montrachet-named-plots.json) audits the original BATARD MONTRACHET (Chassagne, 5.798427 ha inside INAO) and BATARD-MONTRACHET (Puligny, 6.037562 ha) spellings. These are the same cru name on both sides of the commune line, not separate official climats. Their published polygons overlap by 4.144941 m², bounded by the reviewed 4.2 m² cap, and retain the original Puligny hole.

The [parcel crosswalk](parcel-named-areas.json) records 55 Chassagne and 31 Puligny parcels under those spellings, plus three edge parcels in BIENVENUES BATARD-MONTRACHET. The latter remains neighbouring context; every parcel touches a lieu-dit polygon. Because the cru name also identifies a smaller constituent while another lieu-dit contacts the cru, `displayLayer` remains false. White-wine tests preserve the full INAO outline and no producer-specific crosswalk is inferred.

## Sources, rights, history and sales

The [source recheck](source-review.json) pins the
[7 October Montrachet catalogue snapshots](../../../scripts/grand-crus/sources/catalogues/2026-10-07-montrachet/)
with URLs, acquisition hashes, sizes and exact UTC retrieval times. The BIVB
HTML has its embedded Google API key redacted using the shared byte-preserving
redactor; metadata retains original and sanitized hashes and sizes. The recheck
confirms rights 2019–2025, the July 2026 DFI release, January 2025 schema,
geometry inventory and DVF release. The [shared inventory](../../../scripts/grand-crus/sources/inventory-2026-10-01.json)
retains original archive/member identities, licence labels and download provenance.

Exact full-reference joins preserve all holders/right codes and never suppress
geometry for unknown rights. Missing legal-entity records do not establish
private ownership or absence of an owner. Company continuity requires an
unchanged valid SIREN. Reviewed holder-to-domaine crosswalks enable research grouping. Company identity,
property evidence and dated tenancy remain distinct from farming. Paid SPF/outreach stays Tier 3.

[Rights history](rights-history.json) preserves complete mother/daughter sets,
original validation dates and full ancestry paths. There are
9 accepted multi-vintage spatial candidates and
0 rejected candidates; 9
next-vintage successors satisfy the separate #411 rule. They remain spatial
inference, distinct from documented DFI. No current parcel has inference-only
ancestry. A source boundary is not a creation date; filiation never backdates
rights or automatically transfers an operator.

[Sale records](sale-records.json) retain dates and original references without
prices, addresses or parties. Observed source ranges do not prove continuity or
extend back to the oldest DFI event.

## Notice review and gaps

The [notice audit](notice-audit.json) queries all 105 current/reachable references. Page-image review of BFC-2019-013 pages 44–49 confirms a 7 February 2019 refusal for S.C. Guillaume BOILLOT, including Puligny AI15. Article 1 prints 0.3223 ha for AI15; its 1.4727 ha four-parcel total is not assigned to AI15. The application was filed 12 October 2018 and completed 18 November 2018. The previous operator named in the decision is dated context, not a current farmer. The app explicitly labels the decision “Application refused”; no later appeal outcome is established.

The already-reviewed earlier notice for Chassagne AE135 remains unassigned: its printed 3 December 2013 date follows its 31 January 2013 bulletin. No corrected date or individual share of its multi-parcel area is guessed. The audit counts that earlier match plus the curated refusal, with no pending candidates. Five other OCR suffix hits lack either cru commune and remain unassigned search context.

Earlier publications are partial Internet Archive/Common Crawl captures under
official URLs. No Côte-d'Or bulletin was obtained for 2007, 2009, 2012 or 2014.
Other 2004–2015 years remain incomplete; departmental 2021–2026, regional
pre-2019 and pre-2004 intervals remain unsearched or outside the corpus.
See the [availability audit](../../../scripts/grand-crus/sources/notice-coverage-2026-10-04.json)
and [earlier-bulletin research](../earlier-bulletins/README.md). These shared gaps
remain under #461; unverified operation remains under #364. Access failure or
an unsearched interval is a gap, not absence of history.

## Reproduce and validate

Use Python 3.12 with `scripts/burgundy-map-requirements.txt`:

```sh
python scripts/download_grand_cru_sources.py --cru batard-montrachet
python scripts/build_grand_cru_parcels.py --cru batard-montrachet --check
python scripts/build_grand_cru_commune_audit.py --cru batard-montrachet --check
python scripts/build_grand_cru_named_plots.py --cru batard-montrachet
python scripts/build_grand_cru_parcel_named_areas.py --cru batard-montrachet --check
python scripts/build_grand_cru_history_rollout.py --bundle montrachet --check
python scripts/build_grand_cru_research.py --all --check
python scripts/build_grand_cru_app_registry.py --check
python scripts/audit_grand_cru_history_rollout.py --check
bun run build
python scripts/measure_grand_cru_payload.py
bun run test
```

The representative Chromium journey uses `WINELOG_E2E_CRU=batard-montrachet` with
`burgundy-village-map.spec.ts` to check mobile width, keyboard toggling, retry,
unknown rights, holder search, scoped manual producer links, dated evidence and
owner/shared views. The routine browser matrix remains unchanged.
The cru issue and its #461 line are completed only after review and merge.

## Supplemental Pappers review: 10 October 2026

Supplemental Pappers review on 10 October 2026 reuses the two new Chevalier sources (37 pages) and confirms the supplied Jouard file is byte-identical to the existing 21-page extract. Batard remains 68 new distinct PDFs / 1936 pages; the duplicate and reused sources are not counted again. Missing Jouard schedules and the Violland company mismatch remain explicit gaps.

Key findings and source hashes are in the [supplemental filing review](filings.md#supplemental-pappers-review-10-october-2026). Exact parcel coverage, supported holder links and verified farming counts do not change.
