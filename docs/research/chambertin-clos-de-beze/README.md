# Chambertin-Clos de Bèze parcels: Tier 1 (#392)

Chambertin-Clos de Bèze uses INAO `inao-denom-448`, appellation 149, and
Gevrey-Chambertin commune 21295. Reviewed 7 October 2026 for season 2026 under
the [rollout playbook](../../grand-cru-parcel-rollout.md) and
[#461 history method](../grand-cru-history.md).

**No current farmer is verified.** Recorded rights, parcel filiation, deeds and
administrative procedures are separate evidence; none establishes current farming.

## Results

| Measure | Value |
| --- | ---: |
| Cadastral parcels | 56; 15.334882 ha of measured cru overlap |
| Parcels with recorded legal-entity rights (1 January 2025) | 39; 21 holder identifiers |
| Parcels without matched rights | 17 |
| Rights snapshots: available / imported years and missing releases | 2019–2025 / 2019–2025; no listed release missing; no earlier or 2026 rights file listed at the 7 October recheck |
| Parcels whose rights changed over the imported snapshot range | 27; name changes and unprovable identifier changes are distinguished from holder changes |
| Official DFI release and commune coverage | July 2026, complete department 21 member; commune 21295 records validate from 1989-04-12 to 2026-06-22 |
| Earliest / latest reachable official DFI validation date | 1989-04-17 / 2024-11-04 |
| Cadastre vintages: earliest / latest obtained and gaps | 2017-07-06 / 2026-06-01; all 35 listed vintages through the pinned map obtained; September 2026 is outside the pinned geometry range |
| Current parcels with documented predecessors / pre-2019 events | 11 / 9 |
| Distinct DFI documents / analysis lots supporting those parcels | 6 / 6 |
| Inferred-only ancestry / unresolved references or conflicting events | 0 inferred-only current parcels; 0 unresolved DFI events, traversal issues or spatial conflicts; 56 traces end at a source boundary or unrecorded event |
| Sales and notices: available / imported date ranges and gaps | DVF+ declared 2014-01-01–2025-12-31, complete BFC 2026-1 archive imported; commune observations 2014-01-14–2025-12-15. Notices: partial departmental 2004–2015, departmental 2016–2020 and regional 2019–2026 indexes; gaps below |
| Parcels with an authorisation / application or suspension | 0 |
| Parcels with sale records (DVF) | 2; one deed, no historical-reference deed |
| Parcels with holder or research leads | 0; a recorded legal holder alone is not a lead |
| Parcels with no lead | 56 |
| Verified farming links | 0 |
| Official history to earliest records (#461) | Delivered for per-cru review: recursive DFI to 1989, all pinned geometry vintages and published rights; sale/notice coverage remains source-specific and qualified |
| Raw / gzip payload (parcels, evidence) | Parcels: 420,894 / 62,023 bytes. Evidence: 78,555 / 9,553 bytes |

Measurements use Python 3.12 `gzip.compress(data, mtime=0)`. The parcel download
is the shared 442-parcel Gevrey bundle; this cru selects 56 of those parcels.
No named-area GeoJSON is added. Geometry and evidence load only after Parcel
rights is switched on; the production payload report also checks compiled JS.

## Geometry and named areas

The [bundle](../../../scripts/grand-crus/bundles/gevrey-chambertin.json) pins the
1 June 2026 cadastre, lieux-dits, rights files, licences, URLs and hashes. The
official Clos de Bèze feature covers 15.347623 ha. It remains separate from the
broader INAO Chambertin feature that overlaps it. A parcel belongs to each
feature through its measured geometry, never through a wine-label alias.

The [commune audit](../../../scripts/grand-crus/reports/chambertin-clos-de-beze-commune-audit.json)
finds 127.0 m² uncovered, below the default 0.1% limit. Brochon and
Morey-Saint-Denis have no parcel contact. Two own-commune contacts below the
1 m² import threshold are retained in the
[parcel report](../../../scripts/grand-crus/reports/gevrey-chambertin-parcels.json).
Full cadastral parcels remain unchanged; measured cru overlap is separate.
No geometry is filled, buffered or repaired to pass the audit.

The [BIVB appellation page](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/chambertin-clos-de-beze,2458,9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9MjY1Jnw%3D)
names Clos-de-Bèze. The cadastral `CLOS DE BEZE` polygon intersects this INAO
feature by 15.302802 ha. The
[named-area audit](../../../scripts/grand-crus/reports/chambertin-clos-de-beze-named-plots.json)
retains the remaining 0.044821 ha without extending the named area.

**`namedPlots.displayLayer` is false.** The whole-cru name retains the official
outline, including references that name the audited cadastral area. No label
aliases or producer holdings are added.

The [parcel crosswalk](parcel-named-areas.json) assigns 47 parcels to
`CLOS DE BEZE`. Nine other full parcels have small INAO edge overlaps while
lying mostly in `BEL-AIR` (5) or `LES MAZIS-HAUTS` (4). Their exact cadastral
names remain unresolved climat crosswalks under #344. Every parcel has at
least 90% in one lieu-dit; none touches no lieu-dit polygon, so
`parcelsWithoutLieuDit` is empty.

## Rights, history and sales

The [source recheck](source-review.json) pins the
[7 October Gevrey catalogue snapshot](../../../scripts/grand-crus/sources/catalogues/2026-10-07-gevrey-chambertin/)
with acquisition and sanitized-snapshot hashes, sizes and UTC retrieval times.
The BIVB HTML has its embedded Google API key redacted. The `redaction` metadata
retains the original hash/size and transformation; `sha256`/`size` pin the
sanitized file. All other source bytes, including names and whitespace, are
preserved. [The redactor](../../../scripts/redact_grand_cru_html.py) reproduces
this transformation without executing the HTML. The recheck reconfirms available
rights years, latest DFI release/schema, geometry inventory and DVF release.
The [shared inventory](../../../scripts/grand-crus/sources/inventory-2026-10-01.json)
retains original department members and acquisition provenance.

Exact full-reference joins preserve all holders and right codes. Missing
legal-entity records do not establish private ownership or absence of an owner.
Company continuity requires an unchanged valid SIREN; provisional identifier
changes remain unprovable. No holder-to-domaine crosswalk is established, so
domaine grouping stays off. Producer and company filings remain Tier 2; paid
SPF copies and outreach remain Tier 3.

[Rights history](rights-history.json) traces 11 current parcels through
documented predecessors, nine with pre-2019 events. The earliest event splits
BO0080 into BO0121 and BO0122 on 17 April 1989. All six analysis lots retain
their complete mother/daughter sets and original validation dates. Two accepted
next-vintage spatial relationships remain separately labelled inference; no
current parcel has inference-only ancestry, and no spatial candidate is
rejected. Source-boundary termination is not a parcel creation date, and
filiation never backdates rights or transfers an operator automatically.

[DVF+](sale-records.json) retains one deed on two current references and no
historical-reference deeds. Dates and references are retained without prices,
addresses or parties. Available and observed intervals do not prove continuity.

## Notice review and gaps

The [notice audit](notice-audit.json) and [notice history](notice-history.json)
query all 62 current and reachable historical references against the three
Côte-d'Or corpora. There is no reviewed match or pending search candidate for
this cru. The raw OCR suffix hit `BO0122` in `bfc-2021-052:p17` mentions communes
21187, 21231 and 21600, not Gevrey-Chambertin. It remains unassigned search
context; a matching suffix does not establish parcel identity.

Earlier publications are partial Internet Archive/Common Crawl captures under
their official URLs. No Côte-d'Or bulletin was obtained for 2007, 2009, 2012 or
2014. Other 2004–2015 years have incomplete coverage; departmental 2021–2026,
regional pre-2019 and pre-2004 intervals remain unsearched or outside the corpus.
See the [availability audit](../../../scripts/grand-crus/sources/notice-coverage-2026-10-04.json)
and [earlier-bulletin research](../earlier-bulletins/README.md). These shared gaps
remain under #461; unverified operation remains under #364. Access failure or an
unsearched interval is a gap, not absence of history.

## Reproduce and validate

Use Python 3.12 with `scripts/burgundy-map-requirements.txt`:

```sh
python scripts/download_grand_cru_sources.py --cru chambertin-clos-de-beze
python scripts/build_grand_cru_parcels.py --cru chambertin-clos-de-beze --check
python scripts/build_grand_cru_commune_audit.py --cru chambertin-clos-de-beze --check
python scripts/build_grand_cru_named_plots.py --cru chambertin-clos-de-beze
python scripts/build_grand_cru_parcel_named_areas.py --cru chambertin-clos-de-beze --check
python scripts/build_grand_cru_history_rollout.py --bundle gevrey-chambertin --check
python scripts/build_grand_cru_research.py --all --check
python scripts/build_grand_cru_app_registry.py --check
python scripts/audit_grand_cru_history_rollout.py --check
npm run build
python scripts/measure_grand_cru_payload.py
npm test
```

The representative Chromium journey uses `WINELOG_E2E_CRU=chambertin-clos-de-beze`
with `burgundy-village-map.spec.ts`. It covers mobile width, keyboard toggling,
download retry, unknown rights, holder search, producer-scoped manual links and
owner/shared wine views without expanding the standard Chromium matrix.

The cru issue and its #461 line are completed only after review and merge.
