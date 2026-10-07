# Corton-Charlemagne parcels: Tier 1 (#406)

Corton-Charlemagne uses INAO `inao-denom-550`, appellation 166, across
Aloxe-Corton (21010), Ladoix-Serrigny (21480) and Pernand-Vergelesses (21606).
Reviewed 7 October 2026 for season 2026 under the
[rollout playbook](../../grand-cru-parcel-rollout.md) and
[#461 history method](../grand-cru-history.md). It appears on all three village
maps. Its shared Corton bundle also contains Corton and Charlemagne, whose
official outlines overlap it; this delivery enables only Corton-Charlemagne.

**No current farmer is verified.** Recorded rights, parcel filiation, deeds and
administrative procedures are distinct evidence, and none establishes farming.

## Results

| Measure | Value |
| --- | ---: |
| Cadastral parcels | 339; 71.606918 ha of measured cru overlap (160 in Aloxe-Corton, 133 in Ladoix-Serrigny, 46 in Pernand-Vergelesses) |
| Parcels with recorded legal-entity rights (1 January 2025) | 168; 68 holder identifiers and 176 right records |
| Parcels without matched rights | 171 |
| Rights snapshots: available / imported years and missing releases | 2019–2025 / 2019–2025; no listed release missing; no earlier or 2026 rights file listed at the 7 October recheck |
| Parcels whose rights changed over the imported snapshot range | 95; 2019–2025 |
| Official DFI release and commune coverage | July 2026, complete department 21 member; records validate in 21010 from 1989-04-12, in 21480 from 1989-06-28 and in 21606 from 1989-04-12, all to 2026-06-29 |
| Earliest / latest reachable official DFI validation date | 1990-01-10 / 2026-03-16 |
| Cadastre vintages: earliest / latest obtained and gaps | 2017-07-06 / 2026-06-01 for all three communes; all 35 listed vintages of each through the pinned map obtained; September 2026 is outside the pinned geometry range |
| Current parcels with documented predecessors / pre-2019 events | 96 / 65 |
| Distinct DFI documents / analysis lots supporting those parcels | 49 / 64 |
| Inferred-only ancestry / unresolved references or conflicting events | 0 inferred-only current parcels; 0 unresolved DFI events, traversal issues or spatial conflicts; one trace starts in the non-cadastral public domain and every other ends at a source boundary or unrecorded event |
| Sales and notices: available / imported date ranges and gaps | DVF+ declared 2014-01-01–2025-12-31, complete BFC 2026-1 archive imported; commune observations 2014-01-07–2025-12-22. Notices: partial departmental 2004–2015, departmental 2016–2020 and regional 2019–2026 indexes; archive gaps below |
| Parcels with an authorisation / application or suspension | 0 |
| Parcels with sale records (DVF) | 40; 23 deeds on current references, plus 1 deed on a historical reference retained with original scope |
| Parcels with holder or research leads | 0; a recorded legal holder alone is not a lead |
| Parcels with no lead | 339 |
| Verified farming links | 0 |
| Official history to earliest records (#461) | Delivered for per-cru review: recursive DFI to 1990, all pinned geometry vintages of the three communes and published rights; sale/notice coverage remains source-specific and qualified |
| Raw / gzip payload (parcels, evidence) | Parcels: 704,334 / 103,159 bytes. Evidence: 415,630 / 23,450 bytes |

Measurements use Python 3.12 `gzip.compress(data, mtime=0)`. The parcel download
is the shared 728-parcel Corton bundle; the Corton-Charlemagne selection contains
339 of those parcels. Corton-Charlemagne adds no named-area GeoJSON. Rights
geometry and evidence load only after Parcel rights is switched on. The
production payload report additionally measures compiled JS.

## Geometry and named areas

The [bundle](../../../scripts/grand-crus/bundles/corton.json) pins the
1 June 2026 cadastre and lieux-dits for the three communes, the rights files,
licences, URLs and SHA-256 hashes, and audit-only Chorey-lès-Beaune, Corgoloin,
Échevronne, Magny-lès-Villers and Savigny-lès-Beaune parcels. All three INAO
communes are imported as one parcel set. Full parcel polygons remain unchanged;
overlaps are measured separately in EPSG:2154.

The [commune audit](../../../scripts/grand-crus/reports/corton-charlemagne-commune-audit.json)
finds 4,001.3 m² (0.56%) of the 719,103.9 m² INAO outline without parcel
coverage, above the default 0.1% limit. The outline has 8 separate parts and
largely shares Corton's edges; the remainder is 39 narrow strips, with mean widths
of 0.22–1.22 m for those of at least 1 m², and 105.1 m² lies between parcels
inside the outline. It is not a missing INAO commune, and no neighbouring
commune's parcels touch the cru. The reviewed cap in the
[cru config](../../../scripts/grand-crus/corton-charlemagne.json) allows less than
0.1 m² above this measurement and is tied to the exact INAO and cadastre hashes.
Eight own-commune contacts at or below 0.9 m² are excluded and retained in the
[parcel report](../../../scripts/grand-crus/reports/corton-parcels.json).
No geometry is repaired, clipped, buffered or filled to pass this audit.

The [BIVB appellation page](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/corton-charlemagne,2458,9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9MjcyJnw%3D)
lists eight climats: Basses Mourottes, En Charlemagne, Hautes Mourottes, Le
Charlemagne, Le Corton, Les Languettes, Les Pougets and Les Renardes. All match
cadastral lieux-dits using only case, accent and hyphen normalization. The same
hill already shows Corton's official INAO climat outlines, so, as for Corton,
**this cadastral audit publishes no layer** and the map keeps the whole-cru
outline. The
[named-area audit](../../../scripts/grand-crus/reports/corton-charlemagne-named-plots.json)
maps 68.862639 of 71.910393 ha. Most of the 3.047754 ha unmapped is in
Pernand-Vergelesses, recorded as `LE ROGNET ET CORTON`, which the wine-board list
does not name for Corton-Charlemagne; it is listed as unresolved. The cadastral
`EN CHARLEMAGNE` and `LE CHARLEMAGNE` overlap by 83.365 m² along the commune line
and are kept as published under a reviewed 83.4 m² cap.

The [parcel crosswalk](parcel-named-areas.json) assigns 313 parcels to the eight
climats, each wholly inside that lieu-dit at stored precision. Sixteen parcels
lie in `LE ROGNET ET CORTON` and keep that cadastral name without a crosswalk. Ten
parcels lying less than 3% inside the cru sit in `BOIS DE CORTON`,
`BOIS DE NAGET`, `EN CHAGNIARDS` or `LES CARRIERES`, declared as neighbouring
lieux-dits.

## Rights, history and sales

The [source recheck](source-review.json) pins freshly obtained catalogue bytes,
sizes, hashes and exact UTC retrieval times. It reuses the bundle's 7 October
catalogue snapshot: the rights, DFI and geometry bytes are identical to the
Chambolle-Morey recheck that day, and the DVF catalogue differs only in
data.gouv.fr's re-analysis timestamps for one resource. The
[shared inventory](../../../scripts/grand-crus/sources/inventory-2026-10-01.json)
retains the raw member identities and original acquisition timestamps.

All rights join on complete parcel references. The 176 records preserve codes
P (ownership), U (usufruct) and N (bare ownership), including 8 parcels with more
than one right. Recorded fiscal areas match the current cadastre's stated areas
for all 168 matched parcels. Private-person rights are absent from this
legal-entity dataset. Six provisional `U…` identifiers remain identifiers, not
verified SIRENs or inferred persons. No holder-to-domaine crosswalk is
established, so domaine grouping stays off. Producer research and company filings
remain Tier 2; paid SPF copies and outreach remain Tier 3.

[Rights history](rights-history.json) preserves 49 documents and 64 complete
analysis lots, from 10 January 1990 to 16 March 2026. Every intermediate reference
and complete merge set is kept; one trace starts in the non-cadastral public
domain (C0103). Events before 2017 predate obtained geometry; later lots are
reconciled with dated geometry. DFI validation dates are not acquisition, creation
or farming dates, and source-boundary terminal reasons do not imply original
ownership. The independent raw-source audit verifies the complete event sets and
retained rights.

The older spatial rule remains separately labelled: 34 current parcels have a
next-vintage inferred predecessor; 22 candidate successors are rejected. All such
current ancestry also has official documentation, so inferred-only current
parcels remain zero.

[DVF+](sale-records.json) contains 23 deeds (22 sales and 1 exchange) on 40
current references, and one 2017 sale on a historical reference kept with its
original scope. Only dates, deed types and references are retained, without
prices, addresses or party names.

## Notices and gaps

The [notice audit](notice-audit.json) and [notice history](notice-history.json)
query all 424 current/reachable references against the three Côte-d'Or corpora.
The one index candidate, `bfc-2021-146:p36`, was read from its page image
(page 37) and rejected: the EARL Domaine Philippe Girard receipt prints A139 under
Chambolle-Musigny, not Aloxe-Corton. The [curation](curation.json) records the
reference with its reason. No exact Corton-Charlemagne notice event is supported.

The independent raw OCR sweep found 115 reference-hint hits across all indexed
notices. Two more of them name a bundle commune and were read from their page
images: `bfc-2020-072:p58` (page 59), the SCEA Domaine Michel Gayot et Fils
receipt for dossier 2019-173, prints Pernand-Vergelesses A1, B1, C1, D1, E1, F1,
G1, H1 and I1; `bfc-2022-059:p48` (page 49), the EARL de Chenove receipt for
dossier 2021-179, prints Pernand-Vergelesses C and AC references and Savigny-lès-
Beaune D references. None of them is reachable from this cru. The other hits never
name a bundle commune; all are recorded in the audit but not assigned.

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
python scripts/download_grand_cru_sources.py --cru corton-charlemagne
python scripts/build_grand_cru_parcels.py --cru corton-charlemagne --check
python scripts/build_grand_cru_commune_audit.py --cru corton-charlemagne --check
python scripts/build_grand_cru_named_plots.py --cru corton-charlemagne
python scripts/build_grand_cru_parcel_named_areas.py --cru corton-charlemagne --check
python scripts/build_grand_cru_history_rollout.py --bundle corton --check
python scripts/build_grand_cru_research.py --all --check
python scripts/build_grand_cru_app_registry.py --check
python scripts/audit_grand_cru_history_rollout.py --check
npm run build
python scripts/measure_grand_cru_payload.py
```

The browser journey uses `WINELOG_E2E_CRU=corton-charlemagne` with
`burgundy-village-map.spec.ts`, without expanding the normal Chromium matrix.
