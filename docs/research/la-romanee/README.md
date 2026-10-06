# La Romanée parcels: Tier 1 (#382)

La Romanée uses INAO `inao-denom-655`, appellation 190, and Vosne-Romanée
commune 21714. Reviewed 7 October 2026 for season 2026 under the
[rollout playbook](../../grand-cru-parcel-rollout.md) and
[#461 history method](../grand-cru-history.md). It shares the Vosne bundle with
five other crus; this delivery enables only La Romanée.

**No current farmer is verified.** Recorded rights, parcel filiation, deeds and
administrative procedures are distinct evidence, and none establishes farming.

## Results

| Measure | Value |
| --- | ---: |
| Cadastral parcels | 1; 0.841545 ha of measured cru overlap |
| Parcels with recorded legal-entity rights (1 January 2025) | 1; 1 holder identifier and 1 right record |
| Parcels without matched rights | 0 |
| Rights snapshots: available / imported years and missing releases | 2019–2025 / 2019–2025; no listed release missing; no earlier or 2026 rights file listed at the 7 October recheck |
| Parcels whose rights changed over the imported snapshot range | 1; an identifier-format change between 2019 and 2020 with the same recorded name and right code |
| Official DFI release and commune coverage | July 2026, complete department 21 member; commune 21714 records validate from 1989-05-05 to 2026-06-29 |
| Earliest / latest reachable official DFI validation date | None: no DFI event reaches the current parcel |
| Cadastre vintages: earliest / latest obtained and gaps | 2017-07-06 / 2026-06-01; all 35 listed vintages through the pinned map obtained; September 2026 is outside the pinned geometry range |
| Current parcels with documented predecessors / pre-2019 events | 0 / 0 |
| Distinct DFI documents / analysis lots supporting those parcels | 0 / 0 |
| Inferred-only ancestry / unresolved references or conflicting events | 0 inferred-only current parcels; 0 unresolved DFI events, traversal issues or spatial conflicts; the trace ends at a source boundary or unrecorded event |
| Sales and notices: available / imported date ranges and gaps | DVF+ declared 2014-01-01–2025-12-31, complete BFC 2026-1 archive imported; commune observations 2014-01-20–2025-12-17. Notices: partial departmental 2004–2015, departmental 2016–2020 and regional 2019–2026 indexes; archive gaps below |
| Parcels with an authorisation / application or suspension | 0 |
| Parcels with sale records (DVF) | 0; no deed on the current reference |
| Parcels with holder or research leads | 0; a recorded legal holder alone is not a lead |
| Parcels with no lead | 1 |
| Verified farming links | 0 |
| Official history to earliest records (#461) | Delivered for per-cru review: the complete DFI member contains no event for AN0074, so tracing stops at the source boundary; all pinned geometry vintages and published rights; sale/notice coverage remains source-specific and qualified |
| Raw / gzip payload (parcels, evidence) | Parcels: 77,030 / 12,485 bytes. Evidence: 41,349 / 6,861 bytes |

Measurements use Python 3.12 `gzip.compress(data, mtime=0)`. The parcel download
is the shared 83-parcel Vosne bundle; the La Romanée selection contains 1 of
those parcels. No named-area GeoJSON is added (see below). Rights geometry and
evidence load only after Parcel rights is switched on. The production payload
report additionally measures compiled JS.

## Geometry and named area

The [bundle](../../../scripts/grand-crus/bundles/vosne-romanee.json) pins the
1 June 2026 cadastre, lieux-dits, rights files, licences, URLs and SHA-256 hashes.
The single parcel, AN0074, keeps its full polygon; its overlap is measured
separately in EPSG:2154. The [commune audit](../../../scripts/grand-crus/reports/la-romanee-commune-audit.json)
finds 0.2 m² of the 8,415.7 m² INAO outline without parcel coverage, well below
the default 0.1% limit; no neighbouring parcel covers it. Flagey-Échezeaux,
Nuits-Saint-Georges and Vougeot have no contact. Three own-commune contacts, each
below 0.1 m², are excluded and retained individually in the
[parcel report](../../../scripts/grand-crus/reports/vosne-romanee-parcels.json).
No geometry is repaired, clipped, buffered or filled to pass this audit.

The [BIVB appellation page](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/romanee-la,2458,9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9MzIxJnw%3D)
lists La Romanée as the cru's only climat, and the pinned cadastre records
`LA ROMANEE`. Clipped to INAO, it measures 0.841561 ha in one polygon, leaving a
0.10 m² gap; the cadastral lieu-dit extends about 212 m² beyond the INAO line,
which is not added. The [named-area audit](../../../scripts/grand-crus/reports/la-romanee-named-plots.json)
records these measurements. Because the named area is the whole cru, no duplicate
display layer is published and the map keeps the whole-cru outline. No aliases or
producer-holding outlines are inferred. The [parcel crosswalk](parcel-named-areas.json)
places AN0074 entirely in `LA ROMANEE`.

## Rights, history and sales

The [source recheck](source-review.json) uses the shared
[7 October Vosne snapshot](../../../scripts/grand-crus/sources/catalogues/2026-10-07-vosne-romanee/),
pinning catalogue bytes, sizes, hashes and exact UTC retrieval times, plus the
cru's own BIVB page hash. It confirms the existing rights years, latest DFI
release/schema and geometry release inventory. The
[shared inventory](../../../scripts/grand-crus/sources/inventory-2026-10-01.json)
retains the raw member identities and original acquisition timestamps.

AN0074 joins on its complete reference with a matching fiscal area. Every
snapshot from 2019 to 2025 records one code P (ownership) right under the same
recorded name. The 2019 file gives only a MAJIC code (`PBCLPZ`); from 2020 the
record carries the provisional identifier `U14132333`. Because the two
identifiers cannot be proved equal, the change is kept as an unprovable
identifier change rather than merged. `U14132333` remains an identifier, not a
verified SIREN. A recorded owner does not establish who farms the vineyard, and
no monopoly or operator claim is inferred from the holder's name. No
holder-to-domaine crosswalk is established, so domaine grouping stays off.
Producer research and company filings remain Tier 2; paid SPF copies and outreach
remain Tier 3.

[Rights history](rights-history.json) finds no DFI event for AN0074 in the
complete July 2026 department member, whose commune records start on
5 May 1989. The parcel is observed in every geometry vintage from 6 July 2017, and
its trace stops at a source boundary. That first observation is not a creation
date. No spatial next-vintage candidate is accepted or rejected.

[DVF+](sale-records.json) has no deed on AN0074. Available and observed intervals
are not proof of uninterrupted records.

## Notices and gaps

The [notice audit](notice-audit.json) and [notice history](notice-history.json)
query the single current reference against the three Côte-d'Or corpora. There
are zero reviewed matches, zero unreviewed candidates and no OCR reference-hint
hit in any indexed notice. The three reviewed Vosne-Romanée rows (AB 100, AN 112
and AN 249) are outside La Romanée's reachable reference set and remain
unassigned. No OCR-only event is promoted.

Earlier publications are partial Internet Archive/Common Crawl captures under
their original official URLs. No Côte-d'Or bulletin was obtained for 2007, 2009,
2012 or 2014. Other 2004–2015 years have incomplete coverage; departmental
2021–2026, regional pre-2019 and pre-2004 intervals remain unsearched or outside
the indexed corpus. See the [dated availability audit](../../../scripts/grand-crus/sources/notice-coverage-2026-10-04.json)
and [earlier-bulletin research](../earlier-bulletins/README.md). Access failure or
an unsearched interval is a gap, not absence of history. These shared gaps remain
tracked in #461; unverified operation and unresolved name research stay under
#364 and #344 respectively.

## Reproduce and validate

Use Python 3.12, as CI does, with
`scripts/burgundy-map-requirements.txt`. From the repository root:

```sh
python scripts/download_grand_cru_sources.py --cru la-romanee
python scripts/build_grand_cru_parcels.py --cru la-romanee --check
python scripts/build_grand_cru_commune_audit.py --cru la-romanee --check
python scripts/build_grand_cru_named_plots.py --cru la-romanee
python scripts/build_grand_cru_parcel_named_areas.py --cru la-romanee --check
python scripts/build_grand_cru_history_rollout.py --bundle vosne-romanee --check
python scripts/build_grand_cru_research.py --all --check
python scripts/build_grand_cru_app_registry.py --check
python scripts/audit_grand_cru_history_rollout.py --check
npm run build
python scripts/measure_grand_cru_payload.py
```

The browser journey uses `WINELOG_E2E_CRU=la-romanee` with
`burgundy-village-map.spec.ts`, without expanding the normal Chromium matrix.

The cru issue remains open until this PR passes review and merges; only then are
its acceptance boxes and the La Romanée entry in #461 completed.
