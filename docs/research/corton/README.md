# Corton parcels: Tier 1 (#405)

Corton uses INAO `inao-denom-549`, appellation 165, across Aloxe-Corton (21010),
Ladoix-Serrigny (21480) and Pernand-Vergelesses (21606). Reviewed 7 October 2026
for season 2026 under the [rollout playbook](../../grand-cru-parcel-rollout.md)
and [#461 history method](../grand-cru-history.md). It appears on all three
village maps. Its shared Corton bundle also contains Corton-Charlemagne and
Charlemagne, whose official outlines overlap Corton's; this delivery enables only
Corton.

**No current farmer is verified.** Recorded rights, parcel filiation, deeds and
administrative procedures are distinct evidence, and none establishes farming.

## Results

| Measure | Value |
| --- | ---: |
| Cadastral parcels | 728; 159.823708 ha of measured cru overlap (448 in Aloxe-Corton, 133 in Ladoix-Serrigny, 147 in Pernand-Vergelesses) |
| Parcels with recorded legal-entity rights (1 January 2025) | 387; 112 holder identifiers and 404 right records |
| Parcels without matched rights | 341 |
| Rights snapshots: available / imported years and missing releases | 2019–2025 / 2019–2025; no listed release missing; no earlier or 2026 rights file listed at the 7 October recheck |
| Parcels whose rights changed over the imported snapshot range | 264; 2019–2025 |
| Official DFI release and commune coverage | July 2026, complete department 21 member; records validate in 21010 from 1989-04-12, in 21480 from 1989-06-28 and in 21606 from 1989-04-12, all to 2026-06-29 |
| Earliest / latest reachable official DFI validation date | 1989-04-12 / 2026-06-01 |
| Cadastre vintages: earliest / latest obtained and gaps | 2017-07-06 / 2026-06-01 for all three communes; all 35 listed vintages of each through the pinned map obtained; September 2026 is outside the pinned geometry range |
| Current parcels with documented predecessors / pre-2019 events | 239 / 177 |
| Distinct DFI documents / analysis lots supporting those parcels | 99 / 138 |
| Inferred-only ancestry / unresolved references or conflicting events | 0 inferred-only current parcels; 0 unresolved DFI events, traversal issues or spatial conflicts; one trace starts in the non-cadastral public domain and every other ends at a source boundary or unrecorded event |
| Sales and notices: available / imported date ranges and gaps | DVF+ declared 2014-01-01–2025-12-31, complete BFC 2026-1 archive imported; commune observations 2014-01-07–2025-12-22. Notices: partial departmental 2004–2015, departmental 2016–2020 and regional 2019–2026 indexes; archive gaps below |
| Parcels with an authorisation / application or suspension | 0 |
| Parcels with sale records (DVF) | 107; 43 deeds on current references, plus 1 deed on a historical reference retained with original scope |
| Parcels with holder or research leads | 2; co-sale leads from DVF deeds. A recorded legal holder alone is not a lead |
| Parcels with no lead | 726 |
| Verified farming links | 0 |
| Official history to earliest records (#461) | Delivered for per-cru review: recursive DFI to 1989, all pinned geometry vintages of the three communes and published rights; sale/notice coverage remains source-specific and qualified |
| Raw / gzip payload (parcels, evidence) | Parcels: 704,334 / 103,159 bytes. Evidence: 797,666 / 38,163 bytes |

Measurements use Python 3.12 `gzip.compress(data, mtime=0)`. The parcel download
is the shared 728-parcel Corton bundle; Corton's selection is every parcel in it,
because every Corton-Charlemagne and Charlemagne parcel also overlaps Corton. Corton adds no
named-area GeoJSON. Rights geometry and evidence load only after Parcel rights is
switched on. The production payload report additionally measures compiled JS.

## Geometry and named areas

The [bundle](../../../scripts/grand-crus/bundles/corton.json) pins the
1 June 2026 cadastre and lieux-dits for the three communes, the rights files,
licences, URLs and SHA-256 hashes. This delivery adds the 1 June 2026
Chorey-lès-Beaune, Corgoloin, Échevronne, Magny-lès-Villers and
Savigny-lès-Beaune parcels as audit-only neighbours. All three INAO communes are
imported as one parcel set, never split at a commune line. Full parcel polygons
remain unchanged; overlaps are measured separately in EPSG:2154.

The [commune audit](../../../scripts/grand-crus/reports/corton-commune-audit.json)
finds 8,251.3 m² (0.51%) of the 1,605,519.6 m² INAO outline without parcel
coverage, above the default 0.1% limit. The outline has 18 separate parts on the
hill; the remainder is 68 narrow strips, with mean widths of 0.07–1.22 m for those
of at least 1 m², between the official line and the nearest cadastral parcels, and
105.1 m² lies between parcels inside the outline. It is not a missing INAO
commune, and no neighbouring commune's parcels touch the cru. The reviewed cap in
the [cru config](../../../scripts/grand-crus/corton.json) allows less than 0.1 m²
above this measurement and is tied to the exact INAO and cadastre hashes, so a
changed source fails until it is reviewed again. Four own-commune contacts at or
below 0.3 m² are excluded and retained in the
[parcel report](../../../scripts/grand-crus/reports/corton-parcels.json).
No geometry is repaired, clipped, buffered or filled to pass this audit.

The [BIVB appellation page](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/corton,2458,9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9MjkyJnw%3D)
lists 25 Corton climats. All 25 match cadastral lieux-dits using only case, accent
and hyphen normalization; `LES COMBES` is restricted to Aloxe-Corton because
Ladoix-Serrigny has its own. The village maps already show Corton's climats as
official INAO denominations, such as Corton Les Bressandes (`inao-denom-2357`),
and wine labels already resolve to them. **This cadastral audit therefore
publishes no second layer**: the named areas are audited and crosswalked, and the
maps keep the official outlines. The
[named-area audit](../../../scripts/grand-crus/reports/corton-named-plots.json)
maps 159.067338 of 160.551957 ha. The INAO and wine-board lists differ: INAO also
publishes Clos des Meix, La Toppe au Vert and Les Carrières, while the wine board
also names Les Chaumes et la Voierosse, Les Meix, Le Charlemagne and
En Charlemagne.

The cadastral lieux-dits overlap twice inside the cru along commune lines:
`EN CHARLEMAGNE` and `LE CHARLEMAGNE` by 83.365 m², and `LE ROGNET ET CORTON` and
`LES RENARDES` by 0.137 m². Both outlines are kept as published under reviewed
caps of 83.4 and 0.2 m²; neither is clipped.

The [parcel crosswalk](parcel-named-areas.json) assigns 694 parcels to the 25
climats, each with at least 99.96% of its polygon in that lieu-dit. The rest are
listed, not guessed:

- `LES CARRIERES` (11 parcels) and `LA TOPPE AU VERT` (3) are INAO Corton
  denominations that the wine-board list omits; they get no crosswalk.
- `LE VILLAGE` (6) holds parcel I0038, 53% inside the cru, and is not a climat.
- Ten parcels lying less than 4% inside the cru sit in `BOIS DE CORTON`,
  `BOIS DE NAGET`, `EN CHAGNIARDS` or `LES PETITES LOLIERES`, declared as
  neighbouring lieux-dits.
- Four Aloxe-Corton N-section parcels touch no lieu-dit, including N0012, 97%
  inside the cru; they are listed in `parcelsWithoutLieuDit`.

## Rights, history and sales

The [source recheck](source-review.json) pins freshly obtained catalogue bytes,
sizes, hashes and exact UTC retrieval times. The rights, DFI and geometry
catalogue bytes are identical to the 7 October Chambolle-Morey recheck; the DVF
catalogue differs only in data.gouv.fr's re-analysis timestamps for one resource,
and the BFC DVF+ 2026-1 release remains the latest listed. The
[shared inventory](../../../scripts/grand-crus/sources/inventory-2026-10-01.json)
retains the raw member identities and original acquisition timestamps.

All rights join on complete parcel references. The 404 records preserve codes
P (ownership), U (usufruct), N (bare ownership) and R (building lessee), including
17 parcels with more than one right. Recorded fiscal areas match the current
cadastre's stated areas for all 387 matched parcels. Private-person rights are
absent from this legal-entity dataset. Thirteen provisional `U…` identifiers
remain identifiers, not verified SIRENs or inferred persons. No holder-to-domaine
crosswalk is established, so domaine grouping stays off. Producer research and
company filings remain Tier 2; paid SPF copies and outreach remain Tier 3.

[Rights history](rights-history.json) preserves 99 documents and 138 complete
analysis lots, from 12 April 1989 to 1 June 2026. Every intermediate reference
and complete merge set is kept; one trace starts in the non-cadastral public
domain (C0103). Events before 2017 predate obtained geometry, so their
predecessors have no observed polygon; later lots are reconciled with dated
geometry. DFI validation dates are not acquisition, creation or farming dates, and
source-boundary terminal reasons do not imply original ownership. The independent
raw-source audit verifies the complete event sets and retained rights.

The older spatial rule remains separately labelled: 87 current parcels have a
next-vintage inferred predecessor; 24 candidate successors are rejected. All such
current ancestry also has official documentation, so inferred-only current
parcels remain zero. These spatial counts differ from the 239 current parcels with
documented predecessors.

[DVF+](sale-records.json) contains 43 deeds (41 sales and 2 exchanges) on 107
current references, and one 2017 sale on a historical reference kept with its
original scope. Only dates, deed types and references are retained, without
prices, addresses or party names. Available and observed intervals are not proof
of uninterrupted records.

## Notices and gaps

The [notice audit](notice-audit.json) and [notice history](notice-history.json)
query all 900 current/reachable references against the three Côte-d'Or corpora.
Both index candidates were read from their page images and rejected; the
[curation](curation.json) records each reference with its reason:

- `bfc-2021-146:p36` (page 37), the EARL Domaine Philippe Girard receipt, prints
  A139 under Chambolle-Musigny, not Aloxe-Corton.
- `bfc-2022-044:p18` (page 19), the Thibaut Marion receipt for dossier 2021-180,
  prints AK159, AK164 and AK36 under Ladoix-Serrigny only. The index had matched
  the same numbers in Pernand-Vergelesses, and none of the Ladoix references is
  reachable from Corton.

No exact Corton notice event is supported.

The independent raw OCR sweep found 158 reference-hint hits across all indexed
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
python scripts/download_grand_cru_sources.py --cru corton
python scripts/build_grand_cru_parcels.py --cru corton --check
python scripts/build_grand_cru_commune_audit.py --cru corton --check
python scripts/build_grand_cru_named_plots.py --cru corton
python scripts/build_grand_cru_parcel_named_areas.py --cru corton --check
python scripts/build_grand_cru_history_rollout.py --bundle corton --check
python scripts/build_grand_cru_research.py --all --check
python scripts/build_grand_cru_app_registry.py --check
python scripts/audit_grand_cru_history_rollout.py --check
npm run build
python scripts/measure_grand_cru_payload.py
```

The named-area builder is deterministic; rebuilding must leave its outputs
unchanged. The browser journey uses `WINELOG_E2E_CRU=corton` with
`burgundy-village-map.spec.ts`, without expanding the normal Chromium matrix.
