# Montrachet parcels: Tier 2 (#446)

Montrachet uses INAO `inao-denom-927`, appellation 207, and both Chassagne-Montrachet
(21150) and Puligny-Montrachet (21512). Tier 1 reviewed 7 October 2026; Tier 2 reviewed 9 October 2026 for season 2026
under the [rollout playbook](../../grand-cru-parcel-rollout.md) and
[#461 history method](../grand-cru-history.md).

**No current farmer is verified.** Rights, filiation, deeds and administrative
procedures remain distinct evidence; none establishes current farming.

## Results

| Measure | Value |
| --- | ---: |
| Cadastral parcels | 47; 7.964746 ha of measured cru overlap |
| Parcels with recorded legal-entity rights (1 January 2025) | 33; 15 holder identifiers |
| Parcels without matched rights | 14 |
| Rights snapshots: available / imported years and missing releases | 2019–2025 / 2019–2025; no listed release missing; no earlier or 2026 rights file listed at the 7 October recheck |
| Parcels whose rights changed over the imported snapshot range | 24; names and unprovable identifier changes distinguished from holder changes |
| Official DFI release and commune coverage | July 2026 complete department 21 member; 21150 validations 1989-04-12–2026-06-15; 21512 validations 1989-04-17–2026-06-29 |
| Earliest / latest reachable official DFI validation date | 1994-06-28 / 2023-02-27 |
| Cadastre vintages: earliest / latest obtained and gaps | 2017-07-06 / 2026-06-01; all 35 listed vintages for each commune through the pinned map obtained (70 files); September 2026 lies outside the pinned geometry range |
| Current parcels with documented predecessors / pre-2019 events | 20 / 6 |
| Distinct DFI documents / analysis lots supporting those parcels | 7 / 10 |
| Inferred-only ancestry / unresolved references or conflicting events | 0 inferred-only current parcels; 0 unresolved DFI events, traversal issues or spatial conflicts; 64 terminal references reach a source boundary or unrecorded event |
| Sales and notices: available / imported date ranges and gaps | DVF+ declared 2014-01-01–2025-12-31, complete BFC 2026-1 archive imported; bundle observations 2014-01-03–2025-12-17. Notices: partial departmental 2004–2015, departmental 2016–2020 and regional 2019–2026 indexes; gaps below |
| Parcels with an authorisation / application or suspension | 0; one reviewed match withheld because its act date is unresolved |
| Parcels with sale records (DVF) | 1; 1 current-reference deed, 0 historical-reference deeds |
| Parcels with holder or research leads | 32; supported holder links and dated secondary research, with historical-reference context kept distinct |
| Parcels with no lead | 15; includes AH64, whose exact company filing identifies no supported producer link |
| Verified farming links | 0 |
| Official history to earliest records (#461) | Delivered for per-cru review: complete official DFI member queried, earliest reachable validation 1994-06-28, all pinned geometry vintages and published rights; sale/notice coverage remains source-specific and qualified |
| Raw / gzip payload (parcels, evidence) | Parcels: 177,348 / 27,064 bytes. Evidence: 210,813 / 18,787 bytes |

Measurements use Python 3.12 `gzip.compress(data, mtime=0)`. The parcel download
is the shared 201-parcel Montrachet bundle; this cru selects 47 unique parcels.
No named-area asset is loaded. Parcel geometry and evidence load only when
Parcel rights is enabled. The production payload report checks compiled JS.

## Tier 1 to Tier 2

| Measure | Tier 1 | Tier 2 |
| --- | ---: | ---: |
| Parcels / recorded holders | 47 / 15 | 47 / 15 |
| Parcels with holder or research leads | 0 | 32 |
| Parcels with no lead | 47 | 15 |
| Applicable reviewed holder links | 0 | 12 |
| Parcels with exact company filings | 0 | 6 |
| Verified farming links | 0 | 0 |

The [filing review](filings.md) records 50 distinct filings and 1,360 pages screened.
Every holder has a dated search record in the [shared table](../holders/holder-links.json).
The Bouchard, Pousse d’Or and DRC links retain their earlier definitions and effort;
this pass only adds source and search evidence. Shared holders will reuse this work
in the later Montrachet-bundle PRs.

Four exact filing entries cover AE30/31/33/129/134 and AH64. Colin’s 13 current
references receive historical context through documented DFI ancestry; no current
reference is substituted into its 2003 deed. Opale’s former AH151 ownership is
external research because today’s recorded holder differs. Five estate publications and five supplied Winehog accounts
supply named-area census totals. Seven current references have matching Winehog
numbers and individual areas; retired Colin references use official DFI ancestry. Legal holder, individual tenant, company
relationship and bottler remain distinct.

Thenard’s provisional identifier has no accepted company-record crosswalk. The
Laguiche crosswalk is established, but its lease names Jean de Laguiche personally,
so no Drouhin tenant link is asserted. The municipal holder has no producer link.
INPI/Pappers returned 403; one latest Leflaive PDF returned 408. Winehog subscriber
copies were supplied on 9 October: all six are hashed and reviewed. Six maps were
not embedded in the historical expansion article. Unnumbered Leflaive/Lafon areas,
Prieur’s conflicting area and the article’s 34/24 discrepancy remain unmatched. The selected filings are a bounded review, not an exhaustive
history, and no evidence establishes present-day farming.

The parallel Claude batch is left untouched. No shared existing link was rewritten;
future main changes will be merged only at the next cru boundary.

## Geometry and named areas

The [bundle](../../../scripts/grand-crus/bundles/montrachet.json) pins the June
2026 cadastre and lieux-dits for both communes. Full cadastral polygons remain
unchanged. The INAO boundary is identical in both village map contexts, and
there is one cru parcel set across the commune line.

The [commune audit](../../../scripts/grand-crus/reports/montrachet-commune-audit.json)
measures 39,621.559257 m² of Chassagne and 40,026.421854 m² of Puligny cadastral
coverage inside INAO. Their 10.594752 m² shared area is counted once in the
79,637.386359 m² union. Coverage measurement does not crop parcel geometry.
One own-commune contact below the 1 m² import threshold remains in the bundle
parcel report, not in the mapped parcel set.

The [boundary review](boundary-review.json) records 243.347030 m² uncovered,
0.304638% of INAO. All five components touch the INAO boundary: the largest
follows the north edge, two follow the southwest boundary, one is a narrow gap
at the commune line (enclosing-rectangle width 0.596 m), and one is a 0.107 m²
eastern edge sliver. The source-bound 243.4 m² cap allows less than 0.053 m²
above this measurement. No geometry is added, buffered, filled or simplified.

The [BIVB page](https://www.vins-bourgogne.fr/vins-et-terroirs/la-bourgogne-et-ses-appellations/montrachet,2377,9170.html?args=Y29tcF9pZD0yMjA1JmFjdGlvbj12aWV3RmljaGUmaWQ9MzU1Jnw%3D)
lists Montrachet as a white Grand Cru in both communes. Cadastral
`LE MONTRACHET` (Chassagne) and `MONTRACHET` (Puligny) are audited as constituent
areas, without claiming separate official climats or producer holdings.
Because the cru's own name also names a smaller constituent, `displayLayer`
stays false. Broad wines and reference names retain the complete INAO feature;
white-wine regressions cover that fallback without changing red-cru matching.

The [named-area audit](../../../scripts/grand-crus/reports/montrachet-named-plots.json)
measures 3.954705 ha and 3.985025 ha respectively. Their original outlines
overlap by 10.592858 m² at the commune line; both are kept under a reviewed
10.6 m² cap. These measurements intersect in WGS84 and then project, while
the commune audit intersects projected full parcels in EPSG:2154.

The [parcel crosswalk](parcel-named-areas.json) records 29 `LE MONTRACHET`,
7 `MONTRACHET`, 10 `CHEVALIER MONTRACHET` and 1 `DENT DE CHIEN` parcels.
The latter two names remain unresolved edge-contact context. No parcel lacks
a lieu-dit polygon, so `parcelsWithoutLieuDit` is empty. `LE CAILLERET` also
touches the INAO outline, but no mapped Montrachet parcel has it as its largest
lieu-dit share; no crosswalk is invented.

## Sources, rights, history and sales

The [source recheck](source-review.json) pins the
[7 October catalogue snapshots](../../../scripts/grand-crus/sources/catalogues/2026-10-07-montrachet/)
with URLs, acquisition hashes, sizes and exact UTC retrieval times. Embedded
Google API keys in the BIVB HTML are redacted with
[the shared byte-preserving redactor](../../../scripts/redact_grand_cru_html.py);
metadata retains original and sanitized hashes and sizes. The recheck confirms
rights 2019–2025, the July 2026 DFI release, January 2025 schema, geometry
inventory and DVF release. The [shared inventory](../../../scripts/grand-crus/sources/inventory-2026-10-01.json)
retains original member identities, licences and download provenance.

Exact reference joins retain all holders and right codes. Missing legal-entity
records never hide geometry and do not establish absence of an owner. Company
continuity requires an unchanged valid SIREN. The shared holder table supplies reviewed company links for 12 holders.
Domaine grouping remains a research aid, with farming unverified. Paid SPF
copies and outreach remain Tier 3.

[Rights history](rights-history.json) traces 20 current parcels to documented
predecessors, including 6 with pre-2019 events, across 7 DFI documents and
10 analysis lots. Earliest/latest reachable validations are 28 June 1994 and
27 February 2023. Complete mother/daughter sets, original dates, partial scope
and paths remain intact. The 17 accepted multi-vintage spatial candidates
(15 next-vintage successors under the #411 rule) stay labelled inference;
0 candidates are rejected and no current parcel has inference-only ancestry.
A source boundary is not a creation date; filiation does not backdate rights
or transfer an operator. [DVF+](sale-records.json) retains one deed on one
current reference, with dates/references only and no price, address or parties.

## Notice review and gaps

The [notice audit](notice-audit.json) queries all 66 current and reachable
historical references against the three Côte-d'Or corpora. One prior
page-image-reviewed match names `AE 172` in RAA n° 4, published 31 January 2013.
The printed decision date is 3 December 2013, after publication. The original
print is preserved, the act date remains null, and direct assignment is
withheld as `notice-act-date-unresolved`. Neither a corrected date nor current
operation is inferred. The 0.4056 ha total covers six references in two communes
and is not assigned to this parcel. There are no pending candidates. Four raw
OCR suffix hits lack either cru commune and remain unassigned search context.

Earlier publications are partial Internet Archive/Common Crawl captures under
official URLs. No Côte-d'Or bulletin was obtained for 2007, 2009, 2012 or 2014.
Other 2004–2015 years remain incomplete; departmental 2021–2026, regional
pre-2019 and pre-2004 intervals remain unsearched or outside the corpus.
See the [availability audit](../../../scripts/grand-crus/sources/notice-coverage-2026-10-04.json)
and [earlier-bulletin research](../earlier-bulletins/README.md). These shared gaps
remain under #461; unverified operation remains under #364. Access failure or
an unsearched interval is a gap, not absence of history.

Opale’s retired AH150 (981 m²) reaches AH182 through the official 21 March 2019 DFI split into AH182 and AH183. Only AH182 lies in this cru. This is external historical context; the deed does not print the current reference.

## Reproduce and validate

Use Python 3.12 with `scripts/burgundy-map-requirements.txt`:

```sh
py -3.12 scripts/download_grand_cru_sources.py --cru montrachet
py -3.12 scripts/build_grand_cru_parcels.py --cru montrachet --check
py -3.12 scripts/build_grand_cru_commune_audit.py --cru montrachet --check
py -3.12 scripts/build_grand_cru_named_plots.py --cru montrachet
py -3.12 scripts/build_grand_cru_parcel_named_areas.py --cru montrachet --check
py -3.12 scripts/build_grand_cru_history_rollout.py --bundle montrachet --check
py -3.12 scripts/build_grand_cru_holder_links.py --check
py -3.12 scripts/build_grand_cru_research.py --all --check
py -3.12 scripts/build_grand_cru_app_registry.py --check
py -3.12 scripts/audit_grand_cru_history_rollout.py --check
bun run build
py -3.12 scripts/measure_grand_cru_payload.py
bun run test
```

The representative Chromium journey uses `WINELOG_E2E_CRU=montrachet` with
`burgundy-village-map.spec.ts`. It covers mobile width, keyboard toggling,
download retry, unknown rights, holder search, scoped manual producer links,
and owner/shared views without expanding the routine browser matrix.

This Tier 2 PR remains open and unmerged; it does not close the cru issue or #420.

## Supplemental Pappers review: 10 October 2026

Supplemental Pappers review on 10 October 2026 adds one distinct Thenard PDF / 55 pages: 51 distinct PDFs / 1415 pages including the original pass. The 1920 1.7976 ha aggregate remains historical and unallocated; item 43 is not a parcel number. Existing links, identities and original effort are preserved.

Key findings and source hashes are in the [supplemental filing review](filings.md#supplemental-pappers-review-10-october-2026). Exact parcel coverage, supported holder links and verified farming counts do not change.
