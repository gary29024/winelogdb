# Musigny parcels: Tier 1 (#385)

Musigny uses INAO `inao-denom-973`, appellation 211, and Chambolle-Musigny
commune 21133. Reviewed 7 October 2026 for season 2026 under the
[rollout playbook](../../grand-cru-parcel-rollout.md) and
[#461 history method](../grand-cru-history.md). Its shared Chambolle-Morey bundle
also contains five Morey-Saint-Denis and Chambolle-Musigny crus; this delivery
enables only Musigny.

**No current farmer is verified.** Recorded rights, parcel filiation, deeds and
administrative procedures are distinct evidence, and none establishes farming.

## Results

| Measure | Value |
| --- | ---: |
| Cadastral parcels | 51; 10.829003 ha of measured cru overlap |
| Parcels with recorded legal-entity rights (1 January 2025) | 30; 16 holder identifiers and 31 right records |
| Parcels without matched rights | 21 |
| Rights snapshots: available / imported years and missing releases | 2019–2025 / 2019–2025; no listed release missing; no earlier or 2026 rights file listed at the 7 October recheck |
| Parcels whose rights changed over the imported snapshot range | 22; 2019–2025 |
| Official DFI release and commune coverage | July 2026, complete department 21 member; commune 21133 records validate from 1989-04-12 to 2025-05-12 |
| Earliest / latest reachable official DFI validation date | 1994-02-15 / 2024-07-15 |
| Cadastre vintages: earliest / latest obtained and gaps | 2017-07-06 / 2026-06-01; all 35 listed vintages through the pinned map obtained; September 2026 is outside the pinned geometry range |
| Current parcels with documented predecessors / pre-2019 events | 7 / 3 |
| Distinct DFI documents / analysis lots supporting those parcels | 6 / 7 |
| Inferred-only ancestry / unresolved references or conflicting events | 0 inferred-only current parcels; 0 unresolved DFI events, traversal issues or spatial conflicts; all 51 traces end at a source boundary or unrecorded event |
| Sales and notices: available / imported date ranges and gaps | DVF+ declared 2014-01-01–2025-12-31, complete BFC 2026-1 archive imported; commune observations 2014-03-31–2025-12-29. Notices: partial departmental 2004–2015, departmental 2016–2020 and regional 2019–2026 indexes; archive gaps below |
| Parcels with an authorisation / application or suspension | 0 |
| Parcels with sale records (DVF) | 6; 4 deeds on current references, none on historical references |
| Parcels with holder or research leads | 0; a recorded legal holder alone is not a lead |
| Parcels with no lead | 51 |
| Verified farming links | 0 |
| Official history to earliest records (#461) | Delivered for per-cru review: recursive DFI to 1994, all pinned geometry vintages and published rights; sale/notice coverage remains source-specific and qualified |
| Raw / gzip payload (parcels, evidence) | Parcels: 346,184 / 54,353 bytes. Evidence: 81,124 / 9,947 bytes |

Measurements use Python 3.12 `gzip.compress(data, mtime=0)`. The parcel download
is the shared 378-parcel Chambolle-Morey bundle; the Musigny selection contains 51
of those parcels. Named-area GeoJSON adds 7,969 / 3,108 bytes raw / gzip when the
village map opens. Rights geometry and evidence load only after Parcel rights is
switched on. The production payload report additionally measures compiled JS.

## Geometry and named areas

The [bundle](../../../scripts/grand-crus/bundles/chambolle-morey.json) pins the
1 June 2026 cadastre and lieux-dits for Chambolle-Musigny and Morey-Saint-Denis,
the rights files, licences, URLs and SHA-256 hashes. This delivery adds the
1 June 2026 Flagey-Échezeaux, Gevrey-Chambertin and Vougeot parcels as audit-only
neighbours. Full parcel polygons remain unchanged; overlaps are measured
separately in EPSG:2154.

The [commune audit](../../../scripts/grand-crus/reports/musigny-commune-audit.json)
finds 491.6 m² (0.45%) of the 108,781.7 m² INAO outline without parcel coverage,
above the default 0.1% limit. The outline has five separate parts, and every piece
of the remainder lies along their edges: ten narrow strips with mean widths of
0.13–1.09 m between the official line and the nearest cadastral parcels. None is
a missing INAO commune. Neighbouring Vougeot parcels cover 1.7 m² of it and touch
the cru by 54.2 m² in all; Flagey-Échezeaux and Gevrey-Chambertin have no contact.
The reviewed cap in the [cru config](../../../scripts/grand-crus/musigny.json)
allows less than 0.1 m² above this measurement and is tied to the exact INAO and
cadastre hashes, so a changed source fails until it is reviewed again. One
own-commune contact below 0.01 m² is excluded and retained in the
[parcel report](../../../scripts/grand-crus/reports/chambolle-morey-parcels.json).
No geometry is repaired, clipped, buffered or filled to pass this audit.

The [BIVB appellation page](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/musigny,2458,9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9MzYwJnw%3D)
lists La Combe d'Orveau, Les Musigny and Les Petits Musigny. The last two match
the cadastral names `LES MUSIGNY` and `LES PETITS MUSIGNY` using only case and
accent normalization; no aliases or producer-holding outlines are inferred.
Their display polygons are exact intersections with INAO, measuring 5.894061 and
4.193348 ha, each with all three polygon components retained.

La Combe d'Orveau has no crosswalk. No pinned lieu-dit covers the cru's 0.77 ha
south-western part, and the cadastral `COMBE D'ORVEAU` lieu-dit lies about 477 m
outside the cru. That part keeps the whole-cru outline. The
[named-area audit](../../../scripts/grand-crus/reports/musigny-named-plots.json)
reports 0.790756 ha unmapped in all, the south-western part plus edge slivers.

The [parcel crosswalk](parcel-named-areas.json) assigns 32 parcels to Les Musigny
and 1 to Les Petits Musigny, each wholly inside that lieu-dit at stored precision.
Seven parcels in the south-western part touch no lieu-dit, keep no name and are
listed in the config's `parcelsWithoutLieuDit`.
Eleven parcels only touch the cru edge, by 2.8–123.0 m² each, and lie wholly in
the neighbouring lieux-dits `LA TAUPE`, `LES AMOUREUSES`, `LES ARGILLERES` and
`LES BORNIQUES`. They remain Musigny parcels for rights and history, but the
config lists those names as neighbouring lieux-dits, not Musigny climats, and the
build fails if one of them holds a parcel mostly inside the cru. Unrecognised or
blended names retain the whole-cru outline. Selecting a named area retains
Musigny's rights context.

## Rights, history and sales

The [source recheck](source-review.json) pins freshly obtained catalogue bytes,
sizes, hashes and exact UTC retrieval times. The rights, DFI and geometry
catalogue bytes are identical to the 7 October Vosne-Romanée recheck; the DVF
catalogue differs only in data.gouv.fr's re-analysis timestamps for one resource,
and the BFC DVF+ 2026-1 release remains the latest listed. The
[shared inventory](../../../scripts/grand-crus/sources/inventory-2026-10-01.json)
retains the raw member identities and original acquisition timestamps; the
recheck does not overwrite them or silently advance the current map date.

All rights join on complete parcel references. The 31 records preserve codes
P (ownership) and N (bare ownership), including one parcel with two rights.
Recorded fiscal areas match the current cadastre's stated areas for all 30 matched
parcels; geometric area is measured independently. Private-person rights are
absent from this legal-entity dataset. Five provisional `U…` identifiers remain
identifiers, not verified SIRENs or inferred persons. No holder-to-domaine
crosswalk is established, so domaine grouping stays off. Producer research and
company filings remain Tier 2; paid SPF copies and outreach remain Tier 3.

[Rights history](rights-history.json) preserves six documents and seven complete
analysis lots. The earliest is AN0016 → AN0070/AN0071 on 15 February 1994; the
commune-owned A0301 descends from A0139 through 1995, 2023 and 2024 divisions,
with every intermediate reference kept. The pre-2017 events predate obtained
geometry, so their predecessors have no observed polygon; later lots are
reconciled with dated geometry. DFI validation dates are not acquisition,
creation or farming dates, and source-boundary terminal reasons do not imply
original ownership. The independent raw-source audit verifies the complete event
sets and retained rights in addition to rebuilding the files.

The older spatial rule remains separately labelled: five current parcels have a
next-vintage inferred predecessor; one candidate successor is rejected. All such
current ancestry also has official documentation, so inferred-only current
parcels remain zero. These spatial counts differ from the seven current parcels
with documented predecessors.

[DVF+](sale-records.json) contains four deeds (three sales and one exchange) on
six current references, and none on historical references. Only dates, deed types
and references are retained, without prices, addresses or party names. Available
and observed intervals are not proof of uninterrupted records.

## Notices and gaps

The [notice audit](notice-audit.json) and [notice history](notice-history.json)
query all 58 current/reachable references against the three Côte-d'Or corpora.
There are zero reviewed matches and zero unreviewed candidates. The one index
candidate, `bfc-2021-146:p36`, was read from its page image (page 37): an
application receipt for EARL Domaine Philippe Girard, dossier 2021-122, printing
Chambolle-Musigny A139. DFI retired A0139 on 9 November 1995, so the 2021
reference is not joined to its descendant A0301, and the OCR's AN37 is printed
under Savigny-lès-Beaune. The [curation](curation.json) records both references
as rejected. Six other raw OCR reference-hint hits are in notices that never
name Chambolle-Musigny; they are recorded in the audit but not assigned. No
OCR-only event is promoted.

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
python scripts/download_grand_cru_sources.py --cru musigny
python scripts/build_grand_cru_parcels.py --cru musigny --check
python scripts/build_grand_cru_commune_audit.py --cru musigny --check
python scripts/build_grand_cru_named_plots.py --cru musigny
python scripts/build_grand_cru_parcel_named_areas.py --cru musigny --check
python scripts/build_grand_cru_history_rollout.py --bundle chambolle-morey --check
python scripts/build_grand_cru_research.py --all --check
python scripts/build_grand_cru_app_registry.py --check
python scripts/audit_grand_cru_history_rollout.py --check
npm run build
python scripts/measure_grand_cru_payload.py
```

The named-area builder is deterministic; rebuilding must leave its outputs
unchanged. The browser journey uses `WINELOG_E2E_CRU=musigny` with
`burgundy-village-map.spec.ts`, without expanding the normal Chromium matrix.
