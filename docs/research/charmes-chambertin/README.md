# Charmes-Chambertin parcels: Tier 1 (#395)

Charmes-Chambertin uses INAO `inao-denom-477`, appellation 153,
and Gevrey-Chambertin commune 21295. Reviewed 7 October 2026 for season 2026
under the [rollout playbook](../../grand-cru-parcel-rollout.md) and
[#461 history method](../grand-cru-history.md).

**No current farmer is verified.** Recorded rights, parcel filiation, deeds and
administrative procedures are separate evidence; none establishes current farming.

## Results

| Measure | Value |
| --- | ---: |
| Cadastral parcels | 157; 30.800193 ha of measured cru overlap |
| Parcels with recorded legal-entity rights (1 January 2025) | 83; 40 holder identifiers |
| Parcels without matched rights | 74 |
| Rights snapshots: available / imported years and missing releases | 2019–2025 / 2019–2025; no listed release missing; no earlier or 2026 rights file listed at the 7 October recheck |
| Parcels whose rights changed over the imported snapshot range | 65; name changes and unprovable identifier changes are distinguished from holder changes |
| Official DFI release and commune coverage | July 2026, complete department 21 member; commune 21295 records validate from 1989-04-12 to 2026-06-22 |
| Earliest / latest reachable official DFI validation date | 1990-11-05 / 2025-06-02 |
| Cadastre vintages: earliest / latest obtained and gaps | 2017-07-06 / 2026-06-01; all 35 listed vintages through the pinned map obtained; September 2026 is outside the pinned geometry range |
| Current parcels with documented predecessors / pre-2019 events | 27 / 12 |
| Distinct DFI documents / analysis lots supporting those parcels | 11 / 13 |
| Inferred-only ancestry / unresolved references or conflicting events | 0 inferred-only current parcels; 0 unresolved DFI events, traversal issues or spatial conflicts; 157 traces end at a source boundary or unrecorded event |
| Sales and notices: available / imported date ranges and gaps | DVF+ declared 2014-01-01–2025-12-31, complete BFC 2026-1 archive imported; commune observations 2014-01-14–2025-12-15. Notices: partial departmental 2004–2015, departmental 2016–2020 and regional 2019–2026 indexes; gaps below |
| Parcels with an authorisation / application or suspension | 0 |
| Parcels with sale records (DVF) | 18; 12 deeds on current references; 0 historical-reference deeds |
| Parcels with holder or research leads | 0; a recorded legal holder alone is not a lead |
| Parcels with no lead | 157 |
| Verified farming links | 0 |
| Official history to earliest records (#461) | Delivered for per-cru review: complete official DFI member queried, earliest reachable validation 1990-11-05, all pinned geometry vintages and published rights; sale/notice coverage remains source-specific and qualified |
| Raw / gzip payload (parcels, evidence) | Parcels: 420,894 / 62,023 bytes. Evidence: 166,115 / 13,687 bytes |

Measurements use Python 3.12 `gzip.compress(data, mtime=0)`. The parcel download
is the shared 442-parcel Gevrey bundle; this cru selects 157 of those parcels.
No selectable named-area GeoJSON is added.
Parcel geometry and evidence load only after Parcel rights is switched on;
the production payload report also checks compiled JS.

## Geometry and named areas

The [bundle](../../../scripts/grand-crus/bundles/gevrey-chambertin.json) pins the June 2026 cadastre and lieux-dits. The unchanged INAO feature covers 30.938381 ha. The [commune audit](../../../scripts/grand-crus/reports/charmes-chambertin-commune-audit.json) and [boundary review](boundary-review.json) retain 1,381.874287 m² uncovered (0.4467%), above the default tolerance. All 23 components touch the boundary; enlarged views of the largest components show strips along outer edges and inset paths between parcel blocks. Neither neighbouring commune covers the gaps. A source-hash-pinned **1,381.9 m² cap** records this reviewed remainder; it does not repair, buffer or fill geometry. No parcel contact is excluded below the import threshold.

The [BIVB page](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/charmes-chambertin,2458,9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9Mjc0Jnw%3D) lists Aux Charmes and Charmes and states that Charmes-Chambertin and Mazoyères-Chambertin have the same defined production area. Their pinned INAO features select the same 157 cadastral parcels, but retain distinct feature IDs. **Membership is measured from each INAO feature, never from an alternative label.** The shared Gevrey regression checks both memberships and wine identities.

The [named-area audit](../../../scripts/grand-crus/reports/charmes-chambertin-named-plots.json) retains exact cadastral names: `AUX CHARMES` (12.305273 ha inside INAO) and `MAZOYERES OU CHARMES` (18.620410 ha), leaving 0.012697 ha outside those areas. These cadastral spellings are not new appellation aliases. **`namedPlots.displayLayer` is false**, so a broad Charmes wine keeps the whole official feature.

The [parcel crosswalk](parcel-named-areas.json) has 69 AUX CHARMES, 78 MAZOYERES OU CHARMES and ten CHAMPS-CHENYS parcels. The latter retain unresolved climat crosswalks for edge contacts. Every full parcel lies at least 90% in one lieu-dit; none lacks a polygon, so `parcelsWithoutLieuDit` is empty.

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

[Rights history](rights-history.json) documents predecessors for 27 current parcels, including 12 with pre-2019 events, across 11 DFI documents and 13 analysis lots. Reachable validations run from 5 November 1990 to 2 June 2025; the obtained commune source starts in 1989. Fifteen current parcels have accepted spatial predecessor candidates, a separate inference from documented filiation.

All mother/daughter sets and original validation dates are retained. The
15 accepted spatial lineage candidates remain separately labelled inference;
0 candidates are rejected. No current parcel has inference-only ancestry.
Source-boundary termination is not a parcel creation date, and filiation never
backdates rights or transfers an operator automatically.

[DVF+](sale-records.json) retains 12 deeds on 18 current parcel references and no historical-reference deed.
Available and observed intervals do not prove continuity. Any retained deeds
carry dates and references without prices, addresses or parties.

## Notice review and gaps

The [notice audit](notice-audit.json) queries 170 current and reachable historical references. Two previously image-reviewed rows on BN0040 and BN0075 preserve the **23 April 2010 refusal** of the Hospices de Beaune application (RAA n° 22, 1 June 2010, page 49). The notice names EARL Confuron-Cotetidot as operator then; its 0.393 ha total covers both printed references and is not apportioned. A refusal establishes neither an authorisation nor current operation. The original 2 October page-image review and PDF hash remain in [notice history](notice-history.json).

A new page-image review of BFC 2021-006 page 44 rejects the OCR `BN58` candidate: the printed reference is **BI158 under Marsannay-la-Côte**, and Gevrey's seven printed references contain no BN parcel. The exact rejected hint and reason are pinned in curation with the PDF hash and reviewed page. This clears the pending candidate without manufacturing an event. Two other raw suffix hits occur outside Gevrey and remain unassigned search context. No pending candidate or verified farmer remains; source coverage gaps below still apply.

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
python scripts/download_grand_cru_sources.py --cru charmes-chambertin
python scripts/build_grand_cru_parcels.py --cru charmes-chambertin --check
python scripts/build_grand_cru_commune_audit.py --cru charmes-chambertin --check
python scripts/build_grand_cru_named_plots.py --cru charmes-chambertin
python scripts/build_grand_cru_parcel_named_areas.py --cru charmes-chambertin --check
python scripts/build_grand_cru_history_rollout.py --bundle gevrey-chambertin --check
python scripts/build_grand_cru_research.py --all --check
python scripts/build_grand_cru_app_registry.py --check
python scripts/audit_grand_cru_history_rollout.py --check
npm run build
python scripts/measure_grand_cru_payload.py
npm test
```

The representative Chromium journey uses `WINELOG_E2E_CRU=charmes-chambertin`
with `burgundy-village-map.spec.ts`. It covers mobile width, keyboard toggling,
download retry, unknown rights, holder search, producer-scoped manual links and
owner/shared wine views without expanding the standard Chromium matrix.

The cru issue and its #461 line are completed only after review and merge.
