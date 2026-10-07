# Bâtard-Montrachet parcels: Tier 1 (#402)

Bâtard-Montrachet uses INAO `inao-denom-273`, appellation 130.
Both Chassagne-Montrachet (21150) and Puligny-Montrachet (21512) are imported and audited as one parcel set; no division at the commune line is introduced. Reviewed 7 October 2026 for season 2026 under the
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
| Parcels with holder or research leads | 1; a recorded legal holder alone is not a lead |
| Parcels with no lead | 88 |
| Verified farming links | 0 |
| Official history to earliest records (#461) | Delivered for per-cru review: complete official DFI member queried, earliest reachable validation 1993-12-09, all pinned geometry vintages and published rights; sale/notice coverage remains source-specific and qualified |
| Raw / gzip payload (parcels, evidence) | Parcels: 177,348 / 27,064 bytes. Evidence: 143,227 / 12,427 bytes |

Measurements use Python 3.12 `gzip.compress(data, mtime=0)`. The parcel download
is the shared 201-parcel Montrachet bundle; this cru selects 89 unique parcels.
No named-area asset loads. Parcel geometry and evidence load only after Parcel
rights is enabled; the production payload report checks compiled JS.

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
unchanged valid SIREN. No holder-to-domaine crosswalk is established, so grouping
stays off. Producer/company research remains Tier 2; paid SPF/outreach stays Tier 3.

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
npm run build
python scripts/measure_grand_cru_payload.py
npm test
```

The representative Chromium journey uses `WINELOG_E2E_CRU=batard-montrachet` with
`burgundy-village-map.spec.ts` to check mobile width, keyboard toggling, retry,
unknown rights, holder search, scoped manual producer links, dated evidence and
owner/shared views. The routine browser matrix remains unchanged.
The cru issue and its #461 line are completed only after review and merge.
