# Chevalier-Montrachet parcels: Tier 2 (#447)

Chevalier-Montrachet uses INAO `inao-denom-539`, appellation 157.
Only Puligny-Montrachet (21512) is imported for this cru; Chassagne-Montrachet (21150) is a neighbour despite sharing the bundle. Tier 1 reviewed 7 October 2026; Tier 2 reviewed 9 October 2026 for season 2026 under the
[rollout playbook](../../grand-cru-parcel-rollout.md) and [#461 history method](../grand-cru-history.md).

**No current farmer is verified.** Recorded rights, filiation, deeds and
administrative procedures remain distinct evidence; none establishes current farming.

## Results

| Measure | Value |
| --- | ---: |
| Cadastral parcels | 44; 7.583812 ha of measured cru overlap |
| Parcels with recorded legal-entity rights (1 January 2025) | 30; 16 holder identifiers |
| Parcels without matched rights | 14 |
| Rights snapshots: available / imported years and missing releases | 2019–2025 / 2019–2025; no listed release missing; no earlier or 2026 rights file listed at the 7 October recheck |
| Parcels whose rights changed over the imported snapshot range | 14; names and unprovable identifiers distinguished from holder changes |
| Official DFI release and commune coverage | July 2026, complete department 21 member; 21512 validations 1989-04-17–2026-06-29 |
| Earliest / latest reachable official DFI validation date | 1989-09-22 / 2020-03-16 |
| Cadastre vintages: earliest / latest obtained and gaps | 2017-07-06 / 2026-06-01; all 35 listed vintages per INAO commune through the pinned map obtained; September 2026 is outside the pinned geometry range |
| Current parcels with documented predecessors / pre-2019 events | 21 / 19 |
| Distinct DFI documents / analysis lots supporting those parcels | 13 / 13 |
| Inferred-only ancestry / unresolved references or conflicting events | 0 inferred-only current parcels; 0 unresolved DFI events, traversal issues or spatial conflicts; 79 terminal references reach a source boundary or unrecorded event |
| Sales and notices: available / imported date ranges and gaps | DVF+ declared 2014-01-01–2025-12-31, complete BFC 2026-1 archive imported; bundle observations 2014-01-03 to 2025-12-17. Notices: partial departmental 2004–2015, departmental 2016–2020 and regional 2019–2026 indexes; gaps below |
| Parcels with an authorisation / application or suspension | 0 |
| Parcels with sale records (DVF) | 1; 1 current-reference deeds, 0 historical-reference deeds |
| Parcels with holder or research leads | 34; supported shared holder links and dated secondary research, distinct from current operation |
| Parcels with no lead | 10 |
| Verified farming links | 0 |
| Official history to earliest records (#461) | Delivered for per-cru review: complete official DFI member queried, earliest reachable validation 1989-09-22, all pinned geometry vintages and published rights; sale/notice coverage remains source-specific and qualified |
| Raw / gzip payload (parcels, evidence) | Parcels: 177,348 / 27,064 bytes. Evidence: 159,330 / 17,425 bytes |

Measurements use Python 3.12 `gzip.compress(data, mtime=0)`. The parcel download
is the shared 201-parcel Montrachet bundle; this cru selects 44 unique parcels.
No named-area asset loads. Parcel geometry and evidence load only after Parcel
rights is enabled; the production payload report checks compiled JS.

## Geometry and named areas

The [bundle](../../../scripts/grand-crus/bundles/montrachet.json) pins June 2026 parcels and lieux-dits in both villages, plus Saint-Aubin for the neighbouring-commune audit. The [commune audit](../../../scripts/grand-crus/reports/chevalier-montrachet-commune-audit.json) measures coverage against Puligny only: 75,838.134628 m² of the 75,974.064844 m² INAO feature. Chassagne's two parcels contact 12.3 m² inside INAO, covering 7.7 m² of the Puligny remainder; they are excluded from this cru's 44-parcel set. Saint-Aubin has no contact. One own-commune contact below the 1 m² import threshold remains excluded.

The [boundary review](boundary-review.json) records 135.930216 m² uncovered by Puligny (0.178917%), bounded by a source-hash-specific 136.0 m² cap. All three components touch the INAO boundary: 122.831005 m² along the northern edge of the main cadastral block, 7.885774 m² at the southwest edge and 5.213436 m² at the eastern edge. All were visually reviewed. Counting Chassagne as imported coverage would incorrectly reduce this remainder to 128.215301 m²; the shared audit now treats other bundle communes as neighbours. Existing Chambolle/Morey audits were regenerated to state the same scope, without changing their covered areas or geometry. No boundary is filled, clipped, buffered or simplified.

The [BIVB reference](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/chevalier-montrachet,2458,9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9Mjc4Jnw%3D) supports the appellation and commune scope.
Cadastral names are reviewed as constituents, without declaring separate official
climats or producer holdings. The [named-area audit](../../../scripts/grand-crus/reports/chevalier-montrachet-named-plots.json) measures CHEVALIER MONTRACHET (7.298100 ha inside INAO, two parts) and LE CAILLERET (0.252318 ha, three parts). `displayLayer` stays false because the cru name itself identifies one constituent while other lieux-dits also lie inside the cru. White-wine regressions keep the whole INAO outline.

The [parcel crosswalk](parcel-named-areas.json) records 38 CHEVALIER MONTRACHET, 4 LE CAILLERET, 1 MONT RACHET and 1 MONTRACHET parcels. The last two are unresolved edge context: only 0.3145% and 0.1736% of their full parcel geometry lies inside the cru. LE CAILLERET includes three parcels over 94% inside INAO and one edge parcel. No producer-specific crosswalk is inferred. Every parcel touches a lieu-dit polygon; `parcelsWithoutLieuDit` is empty. EN REMILLY in Chassagne contacts the INAO edge but contributes no parcel to this Puligny-only cru.

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
unchanged valid SIREN. The shared holder table supplies reviewed company relationships or explicit no-link searches for every holder. Research grouping is enabled; current operation remains unverified. Paid SPF/outreach stays Tier 3.

[Rights history](rights-history.json) preserves complete mother/daughter sets,
original validation dates and full ancestry paths. There are
6 accepted multi-vintage spatial candidates and
0 rejected candidates; 6
next-vintage successors satisfy the separate #411 rule. They remain spatial
inference, distinct from documented DFI. No current parcel has inference-only
ancestry. A source boundary is not a creation date; filiation never backdates
rights or automatically transfers an operator.

[Sale records](sale-records.json) retain dates and original references without
prices, addresses or parties. Observed source ranges do not prove continuity or
extend back to the oldest DFI event.

## Notice review and gaps

The [notice audit](notice-audit.json) queries all 72 current and reachable historical references against the three Côte-d'Or corpora. There are no reviewed matches or pending page-image candidates. Five raw OCR suffix hits lack Puligny-Montrachet and remain unassigned search context, not parcel evidence. No administrative event or current farmer is inferred.

Earlier publications are partial Internet Archive/Common Crawl captures under
official URLs. No Côte-d'Or bulletin was obtained for 2007, 2009, 2012 or 2014.
Other 2004–2015 years remain incomplete; departmental 2021–2026, regional
pre-2019 and pre-2004 intervals remain unsearched or outside the corpus.
See the [availability audit](../../../scripts/grand-crus/sources/notice-coverage-2026-10-04.json)
and [earlier-bulletin research](../earlier-bulletins/README.md). These shared gaps
remain under #461; unverified operation remains under #364. Access failure or
an unsearched interval is a gap, not absence of history.

## Tier 1 to Tier 2

| Measure | Tier 1 | Tier 2 |
| --- | ---: | ---: |
| Research leads | 0 | 34 |
| Unresolved parcels | 44 | 10 |
| Reviewed holder links applicable to the cru | 0 | 13 |
| Parcels with exact company filings | 0 | 3 |
| Current farmers verified | 0 | 0 |

[The filing inventory](filings.md) records 11 new distinct company filings / 152 pages, complete 150 dpi RapidOCR/DirectML screening, reused shared effort, acquisition hashes, exact-match limits and eight supplied and hashed Winehog copies. Prieur AH8 and the Latour GFAs’ AH92/93 match reference, individual area and recorded holder. Opale’s retired AH150 reaches AH182/AH183 only through official DFI; its former AH151 holding remains historical context. Printed Prieur AH3 is not silently corrected to equal-area AH123.

Five official estate holdings remain a whole-cru named-area census. No parcel is assigned to a producer by a marketing map, a name, a shared manager or a similar area. Three holder identifiers remain explicit no-link searches: Louis Violland, the municipality and GFV Le Chevalier de Puligny-Montrachet. SCI Montille et Partners has a management link since 10 October (below).

## Holder research effort

| Recorded holder | Shared effort reused | New filings / pages | Finding |
| --- | ---: | ---: | --- |
| MAISON BOUCHARD PERE ET FILS (`515420255`) | 7 / 166 | 0 / 0 | Reuses the reviewed Bouchard corporate-group link and the five-filings / 146-page Montrachet screening. No exact Chevalier parcel schedule accepted in this bounded corpus; the 2026 business contribution excludes vineyard property. |
| SOC CIV DOMAINE HERITIERS LOUIS JADOT (`312990021`) | 5 / 86 | 0 / 0 | Reuses the reviewed Domaine des Héritiers Louis Jadot company identity and the prior five-filings / 86-page search. No new exact Chevalier schedule is asserted, and the bottling house is not substituted for this holder company. |
| SOC CIV AGRIC  DOMAINE DE LA VOUGERAIE (`330713074`) | 3 / 26 | 0 / 0 | Reuses the reviewed Vougeraie brand/company identity from its legal notice and the prior three-filings / 26-page search. No new exact Chevalier schedule is asserted; the co-recorded Louis Violland identifier remains independently unresolved. |
| DOMAINE LOUIS VIOLLAND (`349583500`) | 2 / 30 | 0 / 0 | Reuses the prior two-filings / 30-page no-link search. Corporate officers with the role Autre do not establish a defined Vougeraie relationship. Co-recorded rights are not a company identity or operator crosswalk. |
| DOMAINE DE LA POUSSE D'OR (`480400407`) | 5 / 76 | 0 / 0 | Reuses the reviewed Domaine de la Pousse d’Or company link and the four-filings / 91-page Montrachet screening. Opale’s former AH150/151 ownership is retained separately and does not establish Pousse tenancy or present operation. |
| DOMAINE LEFLAIVE (`778245316`) | 4 / 111 | 0 / 0 | Reuses the reviewed Domaine Leflaive company identity and the four-filings / 111-page Montrachet screening. No exact AH77/AH148 schedule accepted. The company is distinct from the Leflaive GFA and a corporate identity does not establish present operation. |
| SC DOM JACQUES PRIEUR (`U21845345`) | 4 / 97 | 0 / 0 | The reused Jacques Prieur statutes print current AH8 (724 m²), matching the recorded holder and cadastral area; the registry and estate legal notice identify company 778233098. Printed AH3 (641 m²) remains unmatched: equal area does not identify AH123, whose documented predecessor is H123. Current farming remains unverified. |
| COMMUNE DE PULIGNY-MONTRACHET (`212105126`) | — | 0 / 0 | The official registry identifies the Commune de Puligny-Montrachet as a municipal authority. No producer company relationship or parcel-specific lease is established. |
| SCE DOMAINE OPALE (`408395309`) | 5 / 89 | 0 / 0 | Reuses the reviewed Opale-to-Olivier Leflaive Frères company-control link. The 2006 contribution prints retired AH150 (981 m²), reaching AH182/AH183 only through the official 2019 split. AH151 (1058 m²) is now recorded to Pousse d’Or. These are external historical contexts, not exact filings of today’s holders. |
| DOMAINE HEITZ LOCHARDET (`420474645`) | 5 / 147 | 0 / 0 | Reuses the reviewed Domaine Heitz-Lochardet company link and the five-filings / 147-page Montrachet screening. No exact AH16 schedule accepted; the reviewed 2021 land contribution concerns other communes. |
| DU DOMAINE BELGRAND LATOUR (`427468962`) | 4 / 116 | 0 / 0 | Reuses the reviewed GFA Belgrand-Latour link and prior effort. Its existing cited statutes print AH92 (2538 m²), and recite the 6 December 2001 lease to Société Civile Domaine Louis Latour from 11 November 2001 to 10 November 2026. Original lease and current performance remain unreviewed. |
| DOMAINE MARCHAL LATOUR (`427468988`) | 4 / 167 | 0 / 0 | Reuses the reviewed GFA Marchal-Latour link and prior effort. Its existing cited statutes print AH93 (2537 m²), and recite the 7 December 2001 lease to Société Civile Domaine Louis Latour from 11 November 2001 to 10 November 2026. Original lease and current performance remain unreviewed. |
| DOMAINE DE MONTILLE (`483134516`) | 6 / 104 | 0 / 0 | Reuses the reviewed Domaine de Montille company identity and the prior six-filings / 104-page search. The distinct SCI Montille et Partners and GFV Le Chevalier de Puligny identifiers are not merged into this company by name or shared management. |
| SCI MONTILLE ET PARTNERS (`751811472`) | — | 2 / 47 | Two filings / 47 pages identify SCI Montille et Partners and its capital held predominantly by Bourgogne Investissement. The formation authorises a SAFER substitution under a BPCE Domaine promise, without an individual vineyard schedule or a named operating-company tenant. On 10 October the register officers support a reviewed management link to Domaine de Montille: E.M. Conseil manages the SCI and presides both Domaine de Montille and Bourgogne Investissement. Management is not a lease, and no exact AH169 filing is accepted. |
| LE CHEVALIER DE PULIGNY-MONTRACHET (`752059824`) | — | 9 / 105 | Nine filings / 105 pages identify the GFV and describe long-term leases to unnamed SCEA companies. The governance clauses and individual founder do not identify a tenant company. The formation mandate concerns a BPCE/SAFER transaction without an individual AH171 schedule. No producer link or exact current-parcel filing is accepted. |
| SCE DU DOMAINE D AUVENAY (`778252445`) | 3 / 113 | 0 / 0 | Reuses the reviewed Domaine d’Auvenay company identity and the prior three-filings / 113-page Bonnes-Mares search. No new exact AH126 schedule or current farming claim is asserted. |

## Parallel run and stack

This cru follows Montrachet #446 and its PR targets `codex/446-montrachet-tier2`. Retarget only when the base is merged by a reviewer; neither PR is merged by this task. The Claude branches are untouched. Existing shared links, identities and effort are preserved; only sources and search records are added. At this boundary `origin/main` remains `0be65811`, so no main merge was needed.

## Reproduce and validate

Use Python 3.12 with `scripts/burgundy-map-requirements.txt`:

```sh
py -3.12 scripts/download_grand_cru_sources.py --cru chevalier-montrachet
py -3.12 scripts/build_grand_cru_parcels.py --cru chevalier-montrachet --check
py -3.12 scripts/build_grand_cru_commune_audit.py --cru chevalier-montrachet --check
py -3.12 scripts/build_grand_cru_named_plots.py --cru chevalier-montrachet
py -3.12 scripts/build_grand_cru_parcel_named_areas.py --cru chevalier-montrachet --check
py -3.12 scripts/build_grand_cru_history_rollout.py --bundle montrachet --check
py -3.12 scripts/build_grand_cru_research.py --all --check
py -3.12 scripts/build_grand_cru_holder_links.py --check
py -3.12 scripts/build_grand_cru_app_registry.py --check
py -3.12 scripts/audit_grand_cru_history_rollout.py --check
bun run lint
bun run typecheck
bun run build
py -3.12 scripts/measure_grand_cru_payload.py
bun run test
```

The representative Chromium journey uses `WINELOG_E2E_CRU=chevalier-montrachet` with
`burgundy-village-map.spec.ts` to check mobile width, keyboard toggling, retry,
unknown rights, holder search, scoped manual producer links, dated evidence and
owner/shared views. The routine browser matrix remains unchanged.
Run the full CI Python unittest list from `scripts/`, full Vitest, and the Burgundy Playwright configuration with `WINELOG_E2E_CRU=chevalier-montrachet`. Record the known Windows locale and Corton rounding failures without changing them. No issue is closed or PR merged by this delivery.

### Supplied Winehog review

All eight requested Chevalier Winehog articles were supplied as MHTML and reviewed. 11 referenced image occurrences (9 distinct URLs) were not embedded; the owner supplied 8 of the 9 on 10 October, leaving one d’Auvenay image unreviewed. The Leflaive pair repeats one account. AH68 and AH126 have matching individual numbers and areas. The Leflaive and Bouchard aggregates now name their parcels under the exact group-total rule (below); historical numbering remains unmatched. The two current matches are secondary historical research. Six additional named-area census entries preserve the published scope and dates. Raw archives are not committed.

## Owner decisions applied: 10 October 2026

The owner reviewed the Montrachet stack on 10 October 2026. Two decisions add five
Chevalier parcels with leads (27 to 32); the Chartron reading below adds two more. Current farming stays unverified everywhere.

- **Printed group totals.** A source that prints several current numbers with one
  total area now names each parcel when today’s cadastral areas add up to that total
  exactly, to the square metre. The research build checks the sum.
  - Leflaive: AH77, AH131, AH132, AH147, AH148 and AH149, printed as 1.8273 ha, add
    up to exactly 18,273 m². AH131, AH132, AH147 and AH149 gain their first lead.
  - Bouchard: AH1, AH5, AH6, AH9, AH10, AH11, AH12, AH13, AH14 and AH122, printed as
    2.3295 ha, add up to exactly 23,295 m², including the partly road parcels 10 and 12.
    These parcels already had Bouchard holder leads.
- **SCI Montille et Partners.** The register names E.M. Conseil, president of SAS
  Domaine de Montille, as the SCI’s manager and fully liable partner. Its other partner,
  Bourgogne Investissement, is also presided by E.M. Conseil. This supports a reviewed
  `management` link to Domaine de Montille. The app shows it as a lead for AH169, not a
  domaine heading. Management is not a lease.
- **Supplied images.** The owner supplied 8 of the 9 missing images (`photos.zip`). They
  are hashed on their sources. They confirm the Leflaive and Bouchard readings and
  outline Chartron’s AH140 and AH141.
- **Chartron: two sources combined (for owner review).** Winehog names Chartron’s
  Clos des Chevaliers as AH140 and AH141 without areas. The estate’s own 2021 area table
  gives the monopole as 55 a 31 ca without numbers. Today’s areas, 2,778 and 2,753 m²,
  add up exactly to 5,531 m², so both parcels are named. The entry records which source
  gives the numbers and which the total. This extends the rule to two sources, adding
  two more parcels (32 to 34). It is a separate commit so it can be reverted alone.

## Supplemental Pappers review: 10 October 2026

Supplemental Pappers review on 10 October 2026 adds two distinct PDFs / 37 pages: 13 new PDFs / 189 pages including the original Chevalier pass. Violland has a conflicting-company enclosure; Auvenay is debt conversion without a qualifying land schedule. Existing links, identities and original effort are preserved.

Key findings and source hashes are in the [supplemental filing review](filings.md#supplemental-pappers-review-10-october-2026). Exact parcel coverage, supported holder links and verified farming counts do not change.
