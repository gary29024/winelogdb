# Richebourg parcels: Tier 1 (#379)

Richebourg uses INAO `inao-denom-1083`, appellation 221, and Vosne-Romanée
commune 21714. Reviewed 6 October 2026 for season 2026 under the
[rollout playbook](../../grand-cru-parcel-rollout.md) and
[#461 history method](../grand-cru-history.md). Its shared Vosne bundle also
contains five other crus; this delivery enables only Richebourg.

**No current farmer is verified.** Recorded rights, parcel filiation, deeds and
administrative procedures are distinct evidence, and none establishes farming.

## Results

| Measure | Value |
| --- | ---: |
| Cadastral parcels | 58; 8.030866 ha of measured cru overlap |
| Parcels with recorded legal-entity rights (1 January 2025) | 26; 10 holder identifiers and 28 right records |
| Parcels without matched rights | 32 |
| Rights snapshots: available / imported years and missing releases | 2019–2025 / 2019–2025; no listed release missing; no earlier or 2026 rights file listed at the 6 October recheck |
| Parcels whose rights changed over the imported snapshot range | 15; 2019–2025 |
| Official DFI release and commune coverage | July 2026, complete department 21 member; commune 21714 records validate from 1989-05-05 to 2026-06-29 |
| Earliest / latest reachable official DFI validation date | 1995-09-18 / 2025-05-12 |
| Cadastre vintages: earliest / latest obtained and gaps | 2017-07-06 / 2026-06-01; all 35 listed vintages through the pinned map obtained; September 2026 is outside the pinned geometry range |
| Current parcels with documented predecessors / pre-2019 events | 32 / 11 |
| Distinct DFI documents / analysis lots supporting those parcels | 6 / 13 |
| Inferred-only ancestry / unresolved references or conflicting events | 0 inferred-only current parcels; 0 unresolved DFI events, traversal issues or spatial conflicts; all 58 traces end at a source boundary or unrecorded event |
| Sales and notices: available / imported date ranges and gaps | DVF+ declared 2014-01-01–2025-12-31, complete BFC 2026-1 archive imported; commune observations 2014-01-20–2025-12-17. Notices: partial departmental 2004–2015, departmental 2016–2020 and regional 2019–2026 indexes; archive gaps below |
| Parcels with an authorisation / application or suspension | 0 |
| Parcels with sale records (DVF) | 23; 5 deeds on current references, plus 2 deeds on historical references retained with original scope |
| Parcels with holder or research leads | 0; a recorded legal holder alone is not a lead |
| Parcels with no lead | 58 |
| Verified farming links | 0 |
| Official history to earliest records (#461) | Delivered for per-cru review: recursive DFI to 1995, all pinned geometry vintages and published rights; sale/notice coverage remains source-specific and qualified |
| Raw / gzip payload (parcels, evidence) | Parcels: 77,030 / 12,485 bytes. Evidence: 161,234 / 11,999 bytes |

Measurements use Python 3.12 `gzip.compress(data, mtime=0)`. The parcel download
is the shared 83-parcel Vosne bundle; the Richebourg selection contains 58 of
those parcels. Named-area GeoJSON adds 11,410 / 4,241 bytes raw / gzip when the
village map opens. Rights geometry and evidence load only after Parcel rights is
switched on. The production payload report additionally measures compiled JS.

## Geometry and named areas

The [bundle](../../../scripts/grand-crus/bundles/vosne-romanee.json) pins the
1 June 2026 cadastre, lieux-dits, rights files, licences, URLs and SHA-256 hashes.
Full parcel polygons remain unchanged; overlaps are measured separately in
EPSG:2154. The [commune audit](../../../scripts/grand-crus/reports/richebourg-commune-audit.json)
finds 1.6 m² of the 80,310.6 m² INAO outline without parcel coverage, well below
the default 0.1% limit. Flagey-Échezeaux, Nuits-Saint-Georges and Vougeot have no
contact. Eight own-commune contacts at or below 1 m² are excluded and retained
individually in the [parcel report](../../../scripts/grand-crus/reports/vosne-romanee-parcels.json).
No geometry is repaired, clipped, buffered or filled to pass this audit.

The [BIVB appellation page](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/richebourg,2458,9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9Mzc5Jnw%3D)
lists Les Richebourgs and Les Vérroilles ou Richebourgs. They match the cadastral
names `LES RICHEBOURGS` and `LES VERROILLES OU RICHEBOURGS` using only case and
accent normalization. No additional aliases or producer-holding outlines are
inferred. Their display polygons are exact intersections with INAO, measuring
5.042500 and 2.988512 ha, with all 3 and 5 polygon components retained. The
[named-area audit](../../../scripts/grand-crus/reports/richebourg-named-plots.json)
retains a 0.527 m² gap. This is distinct from the parcel-coverage gap.

The [parcel crosswalk](parcel-named-areas.json) assigns 34 parcels to Les
Richebourgs and 24 to Les Vérroilles ou Richebourgs, each with at least 99.98%
of its full polygon in that lieu-dit at stored precision. These are cadastral
named areas within one official cru. Unrecognised or blended names retain the
whole-cru outline. Selecting a named area retains Richebourg's rights context.

## Rights, history and sales

The [source recheck](source-review.json) pins freshly obtained catalogue bytes,
sizes, hashes and exact UTC retrieval times. It confirms the existing rights
years, latest DFI release/schema and geometry release inventory. The
[shared inventory](../../../scripts/grand-crus/sources/inventory-2026-10-01.json)
retains the raw member identities and original acquisition timestamps; the recheck
does not overwrite them or silently advance the current map date.

All rights join on complete parcel references. The 28 records preserve codes
P (ownership), N (bare ownership) and U (usufruct), including two parcels with
multiple rights. Recorded fiscal areas match the current cadastre's stated areas;
geometric area is measured independently. Private-person rights are absent from
this legal-entity dataset. The provisional identifier `U14149307` remains an
identifier, not a verified SIREN or an inferred person. No holder-to-domaine
crosswalk is established, so domaine grouping stays off. Producer research and
company filings remain Tier 2; paid SPF copies and outreach remain Tier 3.

[Rights history](rights-history.json) preserves six documents and thirteen complete
analysis lots. The earliest is AN0177 → AN0259/AN0260/AN0261 on 18 September 1995;
later subdivisions retain intermediate references and full event paths. The 1995
event predates obtained geometry, so its predecessor has no observed polygon.
The other lots are reconciled with dated geometry. DFI validation dates are not
acquisition, creation or farming dates, and source-boundary terminal reasons do
not imply original ownership. The independent raw-source audit verifies the
complete event sets and retained rights in addition to rebuilding the files.

The older spatial rule remains separately labelled: 31 current parcels have a
next-vintage inferred predecessor; five candidate successors are rejected.
All such current ancestry also has official documentation, so inferred-only
current parcels remain zero. These spatial counts differ from the 32 current
parcels with documented predecessors.

[DVF+](sale-records.json) contains five deeds on 23 current references and two
historical-reference deeds. Two historical context paths remain unassigned;
deed scope is never promoted to individual successor ownership. Only dates,
deed types and references are retained, without prices, addresses or party names.
Available and observed intervals are not proof of uninterrupted records.

## Notices and gaps

The [notice audit](notice-audit.json) and [notice history](notice-history.json)
query all 71 current/reachable references against the three Côte-d'Or corpora.
There are zero reviewed matches and zero unreviewed candidates. The previously
image-reviewed OCR hit `bfc-2022-101:p350` concerns Flagey-Échezeaux references,
not Richebourg: the applicant's Vosne-Romanée address cannot assign the table
to this commune. Other reviewed Vosne references remain unassigned because they
are outside Richebourg's reachable reference set. No OCR-only event is promoted.

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
python scripts/download_grand_cru_sources.py --cru richebourg
python scripts/build_grand_cru_parcels.py --cru richebourg --check
python scripts/build_grand_cru_commune_audit.py --cru richebourg --check
python scripts/build_grand_cru_named_plots.py --cru richebourg
python scripts/build_grand_cru_parcel_named_areas.py --cru richebourg --check
python scripts/build_grand_cru_history_rollout.py --bundle vosne-romanee --check
python scripts/build_grand_cru_research.py --all --check
python scripts/build_grand_cru_app_registry.py --check
python scripts/audit_grand_cru_history_rollout.py --check
npm run build
python scripts/measure_grand_cru_payload.py
```

The named-area builder is deterministic; rebuilding must leave its outputs
unchanged. The browser journey uses `WINELOG_E2E_CRU=richebourg` with
`burgundy-village-map.spec.ts`, without expanding the normal Chromium matrix.
It covers the narrow owner/shared views, keyboard use, unknown rights, multiple
rights, download retry, holder search and producer-scoped manual links. Named-area
regressions also preserve the Échezeaux pilot and whole-cru fallbacks.

The cru issue remains open until this PR passes review and merges; only then are
its acceptance boxes and the Richebourg entry in #461 completed.
