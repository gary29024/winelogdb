# Chevalier-Montrachet parcels: Tier 1 (#401)

Chevalier-Montrachet uses INAO `inao-denom-539`, appellation 157.
Only Puligny-Montrachet (21512) is imported for this cru; Chassagne-Montrachet (21150) is a neighbour despite sharing the bundle. Reviewed 7 October 2026 for season 2026 under the
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
| Parcels with holder or research leads | 0; a recorded legal holder alone is not a lead |
| Parcels with no lead | 44 |
| Verified farming links | 0 |
| Official history to earliest records (#461) | Delivered for per-cru review: complete official DFI member queried, earliest reachable validation 1989-09-22, all pinned geometry vintages and published rights; sale/notice coverage remains source-specific and qualified |
| Raw / gzip payload (parcels, evidence) | Parcels: 177,348 / 27,064 bytes. Evidence: 112,754 / 10,693 bytes |

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
unchanged valid SIREN. No holder-to-domaine crosswalk is established, so grouping
stays off. Producer/company research remains Tier 2; paid SPF/outreach stays Tier 3.

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

## Reproduce and validate

Use Python 3.12 with `scripts/burgundy-map-requirements.txt`:

```sh
python scripts/download_grand_cru_sources.py --cru chevalier-montrachet
python scripts/build_grand_cru_parcels.py --cru chevalier-montrachet --check
python scripts/build_grand_cru_commune_audit.py --cru chevalier-montrachet --check
python scripts/build_grand_cru_named_plots.py --cru chevalier-montrachet
python scripts/build_grand_cru_parcel_named_areas.py --cru chevalier-montrachet --check
python scripts/build_grand_cru_history_rollout.py --bundle montrachet --check
python scripts/build_grand_cru_research.py --all --check
python scripts/build_grand_cru_app_registry.py --check
python scripts/audit_grand_cru_history_rollout.py --check
npm run build
python scripts/measure_grand_cru_payload.py
npm test
```

The representative Chromium journey uses `WINELOG_E2E_CRU=chevalier-montrachet` with
`burgundy-village-map.spec.ts` to check mobile width, keyboard toggling, retry,
unknown rights, holder search, scoped manual producer links, dated evidence and
owner/shared views. The routine browser matrix remains unchanged.
The cru issue and its #461 line are completed only after review and merge.
