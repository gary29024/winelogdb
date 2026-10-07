# Clos Saint-Denis parcels: Tier 1 (#389)

Clos Saint-Denis uses INAO `inao-denom-548`, appellation 164, and
Morey-Saint-Denis commune 21442. Reviewed 7 October 2026 for season 2026 under the
[rollout playbook](../../grand-cru-parcel-rollout.md) and
[#461 history method](../grand-cru-history.md). Its shared Chambolle-Morey bundle
also contains five other crus; this delivery enables only Clos Saint-Denis.

**No current farmer is verified.** Recorded rights, parcel filiation, deeds and
administrative procedures are distinct evidence, and none establishes farming.

## Results

| Measure | Value |
| --- | ---: |
| Cadastral parcels | 49; 6.603122 ha of measured cru overlap |
| Parcels with recorded legal-entity rights (1 January 2025) | 33; 11 holder identifiers and 35 right records |
| Parcels without matched rights | 16 |
| Rights snapshots: available / imported years and missing releases | 2019–2025 / 2019–2025; no listed release missing; no earlier or 2026 rights file listed at the 7 October recheck |
| Parcels whose rights changed over the imported snapshot range | 23; 2019–2025 |
| Official DFI release and commune coverage | July 2026, complete department 21 member; commune 21442 records validate from 1989-04-14 to 2026-03-23 |
| Earliest / latest reachable official DFI validation date | 1989-04-14 / 1995-12-05 |
| Cadastre vintages: earliest / latest obtained and gaps | 2017-07-06 / 2026-06-01; all 35 listed vintages through the pinned map obtained; September 2026 is outside the pinned geometry range |
| Current parcels with documented predecessors / pre-2019 events | 14 / 14 |
| Distinct DFI documents / analysis lots supporting those parcels | 5 / 11 |
| Inferred-only ancestry / unresolved references or conflicting events | 0 inferred-only current parcels; 0 unresolved DFI events, traversal issues or spatial conflicts; every trace ends at a source boundary or unrecorded event |
| Sales and notices: available / imported date ranges and gaps | DVF+ declared 2014-01-01–2025-12-31, complete BFC 2026-1 archive imported; commune observations 2014-02-14–2025-12-17. Notices: partial departmental 2004–2015, departmental 2016–2020 and regional 2019–2026 indexes; archive gaps below |
| Parcels with an authorisation / application or suspension | 0 |
| Parcels with sale records (DVF) | 1; 1 deed on a current reference |
| Parcels with holder or research leads | 0; a recorded legal holder alone is not a lead |
| Parcels with no lead | 49 |
| Verified farming links | 0 |
| Official history to earliest records (#461) | Delivered for per-cru review: recursive DFI to 1989, all pinned geometry vintages and published rights; sale/notice coverage remains source-specific and qualified |
| Raw / gzip payload (parcels, evidence) | Parcels: 346,184 / 54,353 bytes. Evidence: 85,838 / 9,945 bytes |

Measurements use Python 3.12 `gzip.compress(data, mtime=0)`. The parcel download
is the shared 378-parcel Chambolle-Morey bundle; the Clos Saint-Denis selection
contains 49 of those parcels. Named-area GeoJSON adds 14,729 / 4,657 bytes raw /
gzip when the village map opens. Rights geometry and evidence load only after
Parcel rights is switched on. The production payload report additionally measures
compiled JS.

## Geometry and named areas

The [bundle](../../../scripts/grand-crus/bundles/chambolle-morey.json) pins the
1 June 2026 cadastre and lieux-dits for Chambolle-Musigny and Morey-Saint-Denis,
the rights files, licences, URLs and SHA-256 hashes, and audit-only
Flagey-Échezeaux, Gevrey-Chambertin and Vougeot parcels. Full parcel polygons
remain unchanged; overlaps are measured separately in EPSG:2154.

The [commune audit](../../../scripts/grand-crus/reports/clos-saint-denis-commune-audit.json)
finds 197.6 m² (0.30%) of the 66,228.9 m² INAO outline without parcel coverage,
above the default 0.1% limit. The outline has three separate parts; the remainder
is fifteen narrow strips with mean widths of 0.19–1.28 m along their edges, and
13.7 m² lies between parcels inside the outline. It is not a missing INAO commune,
and no neighbouring commune's parcels touch the cru. The reviewed cap in the
[cru config](../../../scripts/grand-crus/clos-saint-denis.json) allows less than
0.1 m² above this measurement and is tied to the exact INAO and cadastre hashes,
so a changed source fails until it is reviewed again. No own-commune contact is
excluded. No geometry is repaired, clipped, buffered or filled to pass this audit.

The [BIVB appellation page](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/clos-saint-denis,2458,9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9Mjg5Jnw%3D)
lists Calouère, Clos Saint-Denis, Les Chaffots and Maison Brûlée. They match the
cadastral `CALOUERE`, `CLOS SAINT-DENIS`, `LES CHAFFOTS` and `MAISON BRULEE` using
only case, accent and hyphen normalization; no aliases or producer-holding
outlines are inferred. Their display polygons are exact intersections with INAO,
measuring 1.291922, 2.151786, 1.365648 and 1.808949 ha, with all 6, 1, 4 and 2
polygon components retained. Only a third of the cadastral Les Chaffots lies
inside the cru; the rest is outside it and is not shown. The
[named-area audit](../../../scripts/grand-crus/reports/clos-saint-denis-named-plots.json)
reports 0.005603 ha unmapped.

The pinned lieux-dits `CALOUERE` and `MAISON BRULEE` overlap each other by
10.205 m² inside the cru. Both outlines are kept exactly as published; the config
records the reviewed pair with a 10.3 m² cap, and the audit reports the
measurement. Neither area is clipped to resolve it.

One climat shares the cru's name. A wine label naming only Clos Saint-Denis keeps
the whole-cru outline: that area is selected on the map, not inferred from the
label. The other three are selected only by their exact names. The Échezeaux
pilot's own `Clos Saint-Denis` named area is a different place inside Échezeaux
and is unaffected.

The [parcel crosswalk](parcel-named-areas.json) assigns 3 parcels to Calouère,
13 to Clos Saint-Denis, 20 to Les Chaffots and 12 to Maison Brûlée, each wholly
inside that lieu-dit at stored precision. One parcel, AB0455, touches the cru by
48.3 m² and lies in `LES GENAVRIERES`. It remains a Clos Saint-Denis parcel for
rights and history, but the config lists that name as a neighbouring lieu-dit,
not a Clos Saint-Denis climat.

## Rights, history and sales

The [source recheck](source-review.json) pins freshly obtained catalogue bytes,
sizes, hashes and exact UTC retrieval times. It reuses the bundle's 7 October
catalogue snapshot: the rights, DFI and geometry bytes are identical to the
Vosne-Romanée recheck that day, and the DVF catalogue differs only in
data.gouv.fr's re-analysis timestamps for one resource. The
[shared inventory](../../../scripts/grand-crus/sources/inventory-2026-10-01.json)
retains the raw member identities and original acquisition timestamps.

All rights join on complete parcel references. The 35 records preserve codes
P (ownership), N (bare ownership) and U (usufruct), including two parcels, AB0475
and AB0476, with split bare ownership and usufruct. Recorded fiscal areas match
the current cadastre's stated areas for all 33 matched parcels. Private-person
rights are absent from this legal-entity dataset. Three provisional `U…`
identifiers remain identifiers, not verified SIRENs or inferred persons. No
holder-to-domaine crosswalk is established, so domaine grouping stays off.
Producer research and company filings remain Tier 2; paid SPF copies and outreach
remain Tier 3.

[Rights history](rights-history.json) preserves five documents and eleven complete
analysis lots. On 14 April 1989 seven merger lots combined 2 to 11 references each
into today's AB0455, AB0470–AB0473, AB0475 and AB0476; three 1990 divisions and a 1995 merger
complete the set. Every complete merge set is kept. These events predate obtained
geometry, so their predecessors have no observed polygon. DFI validation dates are
not acquisition, creation or farming dates, and source-boundary terminal reasons
do not imply original ownership. No spatial predecessor candidate exists in the
geometry vintages.

[DVF+](sale-records.json) contains one sale deed, on 25 June 2021, for AP0019.
Only dates, deed types and references are retained, without prices, addresses or
party names.

## Notices and gaps

The [notice audit](notice-audit.json) and [notice history](notice-history.json)
query all 89 current/reachable references, including the 1989 merger references,
against the three Côte-d'Or corpora. There are zero reviewed matches and zero
unreviewed candidates. Four raw OCR reference-hint hits are in notices that never
name Morey-Saint-Denis; they are recorded in the audit but not assigned.

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
python scripts/download_grand_cru_sources.py --cru clos-saint-denis
python scripts/build_grand_cru_parcels.py --cru clos-saint-denis --check
python scripts/build_grand_cru_commune_audit.py --cru clos-saint-denis --check
python scripts/build_grand_cru_named_plots.py --cru clos-saint-denis
python scripts/build_grand_cru_parcel_named_areas.py --cru clos-saint-denis --check
python scripts/build_grand_cru_history_rollout.py --bundle chambolle-morey --check
python scripts/build_grand_cru_research.py --all --check
python scripts/build_grand_cru_app_registry.py --check
python scripts/audit_grand_cru_history_rollout.py --check
npm run build
python scripts/measure_grand_cru_payload.py
```

The named-area builder is deterministic; rebuilding must leave its outputs
unchanged. The browser journey uses `WINELOG_E2E_CRU=clos-saint-denis` with
`burgundy-village-map.spec.ts`, without expanding the normal Chromium matrix.
