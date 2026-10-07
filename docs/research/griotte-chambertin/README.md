# Griotte-Chambertin parcels: Tier 1 (#394)

Griotte-Chambertin uses INAO `inao-denom-646`, appellation 185,
and Gevrey-Chambertin commune 21295. Reviewed 7 October 2026 for season 2026
under the [rollout playbook](../../grand-cru-parcel-rollout.md) and
[#461 history method](../grand-cru-history.md).

**No current farmer is verified.** Recorded rights, parcel filiation, deeds and
administrative procedures are separate evidence; none establishes current farming.

## Results

| Measure | Value |
| --- | ---: |
| Cadastral parcels | 20; 2.711635 ha of measured cru overlap |
| Parcels with recorded legal-entity rights (1 January 2025) | 16; 8 holder identifiers |
| Parcels without matched rights | 4 |
| Rights snapshots: available / imported years and missing releases | 2019–2025 / 2019–2025; no listed release missing; no earlier or 2026 rights file listed at the 7 October recheck |
| Parcels whose rights changed over the imported snapshot range | 13; name changes and unprovable identifier changes are distinguished from holder changes |
| Official DFI release and commune coverage | July 2026, complete department 21 member; commune 21295 records validate from 1989-04-12 to 2026-06-22 |
| Earliest / latest reachable official DFI validation date | 2023-12-18 / 2025-06-02 |
| Cadastre vintages: earliest / latest obtained and gaps | 2017-07-06 / 2026-06-01; all 35 listed vintages through the pinned map obtained; September 2026 is outside the pinned geometry range |
| Current parcels with documented predecessors / pre-2019 events | 5 / 0 |
| Distinct DFI documents / analysis lots supporting those parcels | 3 / 3 |
| Inferred-only ancestry / unresolved references or conflicting events | 0 inferred-only current parcels; 0 unresolved DFI events, traversal issues or spatial conflicts; 20 traces end at a source boundary or unrecorded event |
| Sales and notices: available / imported date ranges and gaps | DVF+ declared 2014-01-01–2025-12-31, complete BFC 2026-1 archive imported; commune observations 2014-01-14–2025-12-15. Notices: partial departmental 2004–2015, departmental 2016–2020 and regional 2019–2026 indexes; gaps below |
| Parcels with an authorisation / application or suspension | 0 |
| Parcels with sale records (DVF) | 0; 0 deeds on current references; 0 historical-reference deeds |
| Parcels with holder or research leads | 0; a recorded legal holder alone is not a lead |
| Parcels with no lead | 20 |
| Verified farming links | 0 |
| Official history to earliest records (#461) | Delivered for per-cru review: complete official DFI member queried, earliest reachable validation 2023-12-18, all pinned geometry vintages and published rights; sale/notice coverage remains source-specific and qualified |
| Raw / gzip payload (parcels, evidence) | Parcels: 420,894 / 62,023 bytes. Evidence: 81,003 / 9,258 bytes |

Measurements use Python 3.12 `gzip.compress(data, mtime=0)`. The parcel download
is the shared 442-parcel Gevrey bundle; this cru selects 20 of those parcels.
No named-area GeoJSON is added.
Parcel geometry and evidence load only after Parcel rights is switched on;
the production payload report also checks compiled JS.

## Geometry and named areas

The [bundle](../../../scripts/grand-crus/bundles/gevrey-chambertin.json) pins the
1 June 2026 cadastre, lieux-dits, rights files, licences, URLs and hashes. The
unchanged official INAO feature covers 2.713036 ha. Full cadastral parcels
remain intact; measured cru overlap is separate from their full area.

The [commune audit](../../../scripts/grand-crus/reports/griotte-chambertin-commune-audit.json)
finds 14.0 m² uncovered (0.0517%), within the default 0.1% limit. Brochon and
Morey-Saint-Denis have no parcel contact; no own-commune contact falls below
the import threshold. No geometry is filled, buffered or repaired.

The [BIVB appellation page](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/griotte-chambertin,2458,9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9MzE1Jnw%3D)
lists En Griotte. Its exact cadastral polygon intersects the INAO boundary by
2.685753 ha; the [named-area audit](../../../scripts/grand-crus/reports/griotte-chambertin-named-plots.json)
retains 0.027284 ha outside that area. **`namedPlots.displayLayer` is false**:
the single whole-cru climat keeps the official outline, including references
that name `EN GRIOTTE`. No producer holdings or label aliases are added.

The [parcel crosswalk](parcel-named-areas.json) assigns 17 parcels to
`EN GRIOTTE`. Three other full parcels lie mostly in `EN LA CHAPELLE` (2) or
`AUX ETELOIS` (1) and have only edge overlaps with this cru. Their exact
cadastral names remain unresolved climat crosswalks under #344. Every parcel
has at least 90% in one lieu-dit; none touches no lieu-dit polygon, so
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

[Rights history](rights-history.json) traces five current parcels through
documented predecessors in three documents and three analysis lots. Its
earliest reachable validation is 18 December 2023, although the complete
obtained commune source begins in 1989. No reachable pre-2019 DFI event
was found. Spatial lineage counts relationships across vintages rather than
distinct current parcels.

All mother/daughter sets and original validation dates are retained. The
6 accepted spatial lineage candidates remain separately labelled inference;
0 candidates are rejected. No current parcel has inference-only ancestry.
Source-boundary termination is not a parcel creation date, and filiation never
backdates rights or transfers an operator automatically.

[DVF+](sale-records.json) finds no deed on the current or reachable historical references over the obtained release range.
Available and observed intervals do not prove continuity. Any retained deeds
carry dates and references without prices, addresses or parties.

## Notice review and gaps

The [notice audit](notice-audit.json) and [notice history](notice-history.json)
query all 23 current and reachable historical references against the three
Côte-d'Or corpora. There is no reviewed match, pending candidate or raw OCR
reference-suffix hit. No notice event or current farmer is inferred.

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
python scripts/download_grand_cru_sources.py --cru griotte-chambertin
python scripts/build_grand_cru_parcels.py --cru griotte-chambertin --check
python scripts/build_grand_cru_commune_audit.py --cru griotte-chambertin --check
python scripts/build_grand_cru_named_plots.py --cru griotte-chambertin
python scripts/build_grand_cru_parcel_named_areas.py --cru griotte-chambertin --check
python scripts/build_grand_cru_history_rollout.py --bundle gevrey-chambertin --check
python scripts/build_grand_cru_research.py --all --check
python scripts/build_grand_cru_app_registry.py --check
python scripts/audit_grand_cru_history_rollout.py --check
npm run build
python scripts/measure_grand_cru_payload.py
npm test
```

The representative Chromium journey uses `WINELOG_E2E_CRU=griotte-chambertin`
with `burgundy-village-map.spec.ts`. It covers mobile width, keyboard toggling,
download retry, unknown rights, holder search, producer-scoped manual links and
owner/shared wine views without expanding the standard Chromium matrix.

The cru issue and its #461 line are completed only after review and merge.
