# Romanée-Saint-Vivant parcels: Tier 1 (#380)

Romanée-Saint-Vivant uses INAO `inao-denom-1085`, appellation 223, and
Vosne-Romanée commune 21714. Reviewed 7 October 2026 for season 2026 under the
[rollout playbook](../../grand-cru-parcel-rollout.md) and
[#461 history method](../grand-cru-history.md). It shares the Vosne bundle with
five other crus; this delivery enables only Romanée-Saint-Vivant.

**No current farmer is verified.** Recorded rights, parcel filiation, deeds and
administrative procedures are distinct evidence, and none establishes farming.

## Results

| Measure | Value |
| --- | ---: |
| Cadastral parcels | 17; 9.442394 ha of measured cru overlap |
| Parcels with recorded legal-entity rights (1 January 2025) | 16; 11 holder identifiers and 17 right records |
| Parcels without matched rights | 1 |
| Rights snapshots: available / imported years and missing releases | 2019–2025 / 2019–2025; no listed release missing; no earlier or 2026 rights file listed at the 7 October recheck |
| Parcels whose rights changed over the imported snapshot range | 10; 2019–2025 |
| Official DFI release and commune coverage | July 2026, complete department 21 member; commune 21714 records validate from 1989-05-05 to 2026-06-29 |
| Earliest / latest reachable official DFI validation date | 1990-01-18 / 2022-05-16 |
| Cadastre vintages: earliest / latest obtained and gaps | 2017-07-06 / 2026-06-01; all 35 listed vintages through the pinned map obtained; September 2026 is outside the pinned geometry range |
| Current parcels with documented predecessors / pre-2019 events | 7 / 3 |
| Distinct DFI documents / analysis lots supporting those parcels | 3 / 3 |
| Inferred-only ancestry / unresolved references or conflicting events | 0 inferred-only current parcels; 0 unresolved DFI events, traversal issues or spatial conflicts; all 17 traces end at a source boundary or unrecorded event |
| Sales and notices: available / imported date ranges and gaps | DVF+ declared 2014-01-01–2025-12-31, complete BFC 2026-1 archive imported; commune observations 2014-01-20–2025-12-17. Notices: partial departmental 2004–2015, departmental 2016–2020 and regional 2019–2026 indexes; archive gaps below |
| Parcels with an authorisation / application or suspension | 0 |
| Parcels with sale records (DVF) | 2; 1 deed on current references, no deed on historical references |
| Parcels with holder or research leads | 0; a recorded legal holder alone is not a lead |
| Parcels with no lead | 17 |
| Verified farming links | 0 |
| Official history to earliest records (#461) | Delivered for per-cru review: recursive DFI to 1990, all pinned geometry vintages and published rights; sale/notice coverage remains source-specific and qualified |
| Raw / gzip payload (parcels, evidence) | Parcels: 77,030 / 12,485 bytes. Evidence: 71,216 / 9,071 bytes |

Measurements use Python 3.12 `gzip.compress(data, mtime=0)`. The parcel download
is the shared 83-parcel Vosne bundle; the Romanée-Saint-Vivant selection contains
17 of those parcels. No named-area GeoJSON is added (see below). Rights geometry
and evidence load only after Parcel rights is switched on. The production payload
report additionally measures compiled JS.

## Geometry and named area

The [bundle](../../../scripts/grand-crus/bundles/vosne-romanee.json) pins the
1 June 2026 cadastre, lieux-dits, rights files, licences, URLs and SHA-256 hashes.
Full parcel polygons remain unchanged; overlaps are measured separately in
EPSG:2154. The [commune audit](../../../scripts/grand-crus/reports/romanee-saint-vivant-commune-audit.json)
finds 2.4 m² of the 94,426.6 m² INAO outline without parcel coverage, well below
the default 0.1% limit; no neighbouring parcel covers it. Flagey-Échezeaux,
Nuits-Saint-Georges and Vougeot have no contact. Twelve own-commune contacts,
each below 0.1 m², are excluded and retained individually in the
[parcel report](../../../scripts/grand-crus/reports/vosne-romanee-parcels.json).
No geometry is repaired, clipped, buffered or filled to pass this audit.

The [BIVB appellation page](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/romanee-saint-vivant,2458,9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9Mzg0Jnw%3D)
lists Romanée-Saint-Vivant as the cru's only climat. The pinned cadastre records it
as `ROMANEE SAINT-VIVANT` in two separate features of the same name; they are
treated as one named area (the builders union same-name features within a commune
and record `sourceFeatures: 2`). Clipped to INAO, it measures 9.442607 ha in three
polygon parts, leaving a 0.54 m² gap. The [named-area audit](../../../scripts/grand-crus/reports/romanee-saint-vivant-named-plots.json)
records these measurements. Because the named area is the whole cru, no duplicate
display layer is published and the map keeps the whole-cru outline, as for
Clos de Vougeot. No aliases or producer-holding outlines are inferred.

The [parcel crosswalk](parcel-named-areas.json) places all 17 parcels entirely in
`ROMANEE SAINT-VIVANT`.

## Rights, history and sales

The [source recheck](source-review.json) pins freshly obtained catalogue bytes,
sizes, hashes and exact UTC retrieval times in a
[bundle snapshot](../../../scripts/grand-crus/sources/catalogues/2026-10-07-vosne-romanee/)
shared by the Vosne Tier 1 reviews. It confirms the existing rights years, latest
DFI release/schema and geometry release inventory. The
[shared inventory](../../../scripts/grand-crus/sources/inventory-2026-10-01.json)
retains the raw member identities and original acquisition timestamps; the recheck
does not overwrite them or silently advance the current map date.

All rights join on complete parcel references, and every recorded fiscal area
matches the current cadastre's stated area; geometric area is measured
independently. The 17 records are all code P (ownership). Parcel AL0001 has two
ownership records from different identifiers. AL0329 has no record in this legal-entity dataset, which omits
private persons; its geometry and history are still shown. The provisional
identifiers `U14149307`, `U21852238` and `U33201044` remain identifiers, not
verified SIRENs or inferred people. No holder-to-domaine crosswalk is established,
so domaine grouping stays off. Producer research and company filings remain
Tier 2; paid SPF copies and outreach remain Tier 3.

[Rights history](rights-history.json) preserves three documents and three complete
analysis lots. The earliest is AL0002 → AL0328/AL0329/AL0330, a *croquis de
conservation* validated on 18 January 1990. It predates obtained geometry, so the
predecessor has no observed polygon. Two survey documents validated on
16 May 2022 split AC0271 → AC0357/AC0358 and AC0273 → AC0359/AC0360; both are
reconciled with the April and July 2022 cadastre releases. Rights recorded on
AC0271 and AC0273 from 2019 to 2022 are kept with their original references as
historical context and are not transferred to the daughters. DFI validation dates
are not acquisition, creation or farming dates, and source-boundary terminal
reasons do not imply original ownership.

The older spatial rule remains separately labelled: four current parcels (the
2022 daughters) have a next-vintage inferred predecessor, and no candidate is
rejected. All of them are also officially documented, so inferred-only current
parcels remain zero.

[DVF+](sale-records.json) contains one 2017 sale covering AC0230 and AC0231 and
one other parcel. No deed matches a historical reference. Only dates,
deed types and references are retained, without prices, addresses or party names.
Available and observed intervals are not proof of uninterrupted records.

## Notices and gaps

The [notice audit](notice-audit.json) and [notice history](notice-history.json)
query all 20 current/reachable references against the three Côte-d'Or corpora.
There are zero reviewed matches, zero unreviewed candidates and no OCR
reference-hint hit in any indexed notice. The three reviewed Vosne-Romanée rows
(AB 100, AN 112 and AN 249) are outside Romanée-Saint-Vivant's reachable reference
set and remain unassigned. No OCR-only event is promoted.

Earlier publications are partial Internet Archive/Common Crawl captures under
their original official URLs. No Côte-d'Or bulletin was obtained for 2007, 2009,
2012 or 2014. Other 2004–2015 years have incomplete coverage; departmental
2021–2026, regional pre-2019 and pre-2004 intervals remain unsearched or outside
the indexed corpus. The absolute earliest notice year remains unresolved. See
the [dated availability audit](../../../scripts/grand-crus/sources/notice-coverage-2026-10-04.json)
and [earlier-bulletin research](../earlier-bulletins/README.md). Access failure or
an unsearched interval is a gap, not absence of history. These shared gaps remain
tracked in #461; unverified operation and unresolved name research stay under
#364 and #344 respectively.

## Reproduce and validate

Use Python 3.12, as CI does, with
`scripts/burgundy-map-requirements.txt`. From the repository root:

```sh
python scripts/download_grand_cru_sources.py --cru romanee-saint-vivant
python scripts/build_grand_cru_parcels.py --cru romanee-saint-vivant --check
python scripts/build_grand_cru_commune_audit.py --cru romanee-saint-vivant --check
python scripts/build_grand_cru_named_plots.py --cru romanee-saint-vivant
python scripts/build_grand_cru_parcel_named_areas.py --cru romanee-saint-vivant --check
python scripts/build_grand_cru_history_rollout.py --bundle vosne-romanee --check
python scripts/build_grand_cru_research.py --all --check
python scripts/build_grand_cru_app_registry.py --check
python scripts/audit_grand_cru_history_rollout.py --check
npm run build
python scripts/measure_grand_cru_payload.py
```

The named-area builder is deterministic; rebuilding must leave its audit report
unchanged. The browser journey uses `WINELOG_E2E_CRU=romanee-saint-vivant` with
`burgundy-village-map.spec.ts`, without expanding the normal Chromium matrix.
It covers the narrow owner/shared views, keyboard use, unknown rights, multiple
rights, download retry, holder search and producer-scoped manual links.

The cru issue remains open until this PR passes review and merges; only then are
its acceptance boxes and the Romanée-Saint-Vivant entry in #461 completed.
