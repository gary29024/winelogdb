# Clos de la Roche parcels: Tier 2 (#436)

Clos de la Roche uses INAO `inao-denom-544`, appellation 160, and
Morey-Saint-Denis commune 21442. Tier 1 reviewed 7 October; Tier 2 reviewed 9 October 2026 for season 2026 under the
[rollout playbook](../../grand-cru-parcel-rollout.md) and
[#461 history method](../grand-cru-history.md). Its shared Chambolle-Morey bundle
also contains five other crus; this delivery advances Clos de la Roche to Tier 2.

**No current farmer is verified.** Recorded rights, parcel filiation, deeds and
administrative procedures are distinct evidence, and none establishes farming.

## Results

| Measure | Value |
| --- | ---: |
| Cadastral parcels | 112; 16.831349 ha of measured cru overlap |
| Parcels with recorded legal-entity rights (1 January 2025) | 73; 22 holder identifiers and 75 right records |
| Parcels without matched rights | 39 |
| Rights snapshots: available / imported years and missing releases | 2019–2025 / 2019–2025; no listed release missing; no earlier or 2026 rights file listed at the 7 October recheck |
| Parcels whose rights changed over the imported snapshot range | 29; 2019–2025 |
| Official DFI release and commune coverage | July 2026, complete department 21 member; commune 21442 records validate from 1989-04-14 to 2026-03-23 |
| Earliest / latest reachable official DFI validation date | 1989-04-14 / 2025-03-03 |
| Cadastre vintages: earliest / latest obtained and gaps | 2017-07-06 / 2026-06-01; all 35 listed vintages through the pinned map obtained; September 2026 is outside the pinned geometry range |
| Current parcels with documented predecessors / pre-2019 events | 34 / 28 |
| Distinct DFI documents / analysis lots supporting those parcels | 8 / 25 |
| Inferred-only ancestry / unresolved references or conflicting events | 0 inferred-only current parcels; 0 unresolved DFI events, traversal issues or spatial conflicts; every trace ends at a source boundary or unrecorded event |
| Sales and notices: available / imported date ranges and gaps | DVF+ declared 2014-01-01–2025-12-31, complete BFC 2026-1 archive imported; commune observations 2014-02-14–2025-12-17. Notices: partial departmental 2004–2015, departmental 2016–2020 and regional 2019–2026 indexes; archive gaps below |
| Parcels with an authorisation / application or suspension | 0 |
| Parcels with sale records (DVF) | 2; 3 deeds on current references, none on historical references |
| Parcels with holder or research leads | 36; Tier 1 had 0 |
| Parcels with no lead | 76 |
| Verified farming links | 0 |
| Official history to earliest records (#461) | Delivered for per-cru review: recursive DFI to 1989, all pinned geometry vintages and published rights; sale/notice coverage remains source-specific and qualified |
| Raw / gzip payload (parcels, evidence) | Parcels: 346,184 / 54,353 bytes. Evidence: 189,119 / 19,068 bytes |

Measurements use Python 3.12 `gzip.compress(data, mtime=0)`. The parcel download
is the shared 378-parcel Chambolle-Morey bundle; the Clos de la Roche selection
contains 112 of those parcels. Named-area GeoJSON adds 19,845 / 6,488 bytes raw /
gzip when the village map opens. Rights geometry and evidence load only after
Parcel rights is switched on. The production payload report additionally measures
compiled JS.

## Geometry and named areas

The [bundle](../../../scripts/grand-crus/bundles/chambolle-morey.json) pins the
1 June 2026 cadastre and lieux-dits for Chambolle-Musigny and Morey-Saint-Denis,
the rights files, licences, URLs and SHA-256 hashes, and audit-only
Flagey-Échezeaux, Gevrey-Chambertin and Vougeot parcels. Full parcel polygons
remain unchanged; overlaps are measured separately in EPSG:2154.

The [commune audit](../../../scripts/grand-crus/reports/clos-de-la-roche-commune-audit.json)
finds 673.6 m² (0.40%) of the 168,988.5 m² INAO outline without parcel coverage,
above the default 0.1% limit. It is twelve narrow strips, with mean widths of
0.07–1.29 m, all along the outline edge. On the northern side the official line
runs past the Morey-Saint-Denis cadastre: four Gevrey-Chambertin parcels touch the
cru by 769.7 m² in all (at most 22.6% of one parcel) and cover 456.6 m² of the
remainder; 217.0 m² is covered by no audited parcel. Gevrey-Chambertin is not an
INAO commune of this cru, so those parcels are measured and never imported. The
reviewed cap in the [cru config](../../../scripts/grand-crus/clos-de-la-roche.json)
allows less than 0.1 m² above this measurement and is tied to the exact INAO and
cadastre hashes, so a changed source fails until it is reviewed again. Three
own-commune contacts at or below 0.8 m² are excluded and retained in the
[parcel report](../../../scripts/grand-crus/reports/chambolle-morey-parcels.json).
No geometry is repaired, clipped, buffered or filled to pass this audit.

The [BIVB appellation page](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/clos-de-la-roche,2458,9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9MjgyJnw%3D)
lists Clos de la Roche, Les Chabiots, Les Fremières, Les Froichots, Les
Genavrières, Les Mochamps and Monts Luisants. All seven match the cadastral names
in Morey-Saint-Denis using only case, accent and hyphen normalization; no aliases
or producer-holding outlines are inferred. Chambolle-Musigny has its own
`LES CHABIOTS` and `LES FREMIERES`, so those two plots are restricted to
Morey-Saint-Denis. The display polygons are exact intersections with INAO,
measuring 4.548243, 2.117693, 2.273002, 0.643214, 0.879809, 2.551223 and
3.755923 ha, with every polygon component retained. Only part of the cadastral
Les Genavrières and Monts Luisants lies inside the cru. The
[named-area audit](../../../scripts/grand-crus/reports/clos-de-la-roche-named-plots.json)
reports 0.129741 ha unmapped.

One climat shares the cru's name. A wine label naming only Clos de la Roche keeps
the whole-cru outline: that area is selected on the map, not inferred from the
label. The other six are selected only by their exact names.

The [parcel crosswalk](parcel-named-areas.json) assigns 108 parcels to the seven
climats (42 Monts Luisants, 19 Clos de la Roche, 13 Les Chabiots, 11 Les
Fremières, 11 Les Mochamps, 8 Les Genavrières and 4 Les Froichots), each with at
least 99.99% of its polygon in that lieu-dit. Three parcels lie in the cadastral
`LES CHAFFOTS`, an official Clos Saint-Denis climat: AB0419 is 86% inside Clos de
la Roche (and 10% in Clos Saint-Denis), while AB0418 and AB0474 only touch the
edge. That name has no crosswalk to a Clos de la Roche climat, so it is listed as
unresolved. The edge parcel AP0043 touches the cru by 11.4 m² and lies in
`LE VILLAGE`, declared as a neighbouring lieu-dit.

## Rights, history and sales

The [source recheck](source-review.json) pins freshly obtained catalogue bytes,
sizes, hashes and exact UTC retrieval times. It reuses the bundle's 7 October
catalogue snapshot: the rights, DFI and geometry bytes are identical to the
Vosne-Romanée recheck that day, and the DVF catalogue differs only in
data.gouv.fr's re-analysis timestamps for one resource. The
[shared inventory](../../../scripts/grand-crus/sources/inventory-2026-10-01.json)
retains the raw member identities and original acquisition timestamps.

All rights join on complete parcel references. The 75 records preserve codes
P (ownership), N (bare ownership) and U (usufruct), including two parcels, AB0418
and AB0474, with split bare ownership and usufruct. Recorded fiscal areas match
the current cadastre's stated areas for all 73 matched parcels. Private-person
rights are absent from this legal-entity dataset. Six provisional `U…`
identifiers remain the recorded keys. Four have reviewed company-record identity
crosswalks (including the reused Arlaud identity); Hospices and Lecheneaut remain
unresolved. Ten holders have applicable research links, enabling domaine grouping.
Paid SPF copies and present-season confirmation remain Tier 3.

[Rights history](rights-history.json) preserves eight documents and 25 complete
analysis lots. Fifteen merger lots on 14 April 1989 combined 2 to 12 references
each; later divisions run from 1996 to 3 March 2025, when AB0355 became
AB0567/AB0568. AB0465 is both a 1989 merger result and a 1996 predecessor, and
AB0458's 1989 merger was divided again in 2023; every intermediate reference and
complete merge set is kept. Events before 2017 predate obtained geometry, so their
predecessors have no observed polygon; later lots are reconciled with dated
geometry. DFI validation dates are not acquisition, creation or farming dates, and
source-boundary terminal reasons do not imply original ownership. The independent
raw-source audit verifies the complete event sets and retained rights.

The older spatial rule remains separately labelled: eight current parcels have a
next-vintage inferred predecessor, with no rejected candidate. All also have
official documentation, so inferred-only current parcels remain zero.

[DVF+](sale-records.json) contains three sale deeds on two current references:
AB0407 on 28 September 2017 and 27 July 2021, and the edge parcel AP0043 on
10 January 2024. Only dates, deed types and references are retained, without
prices, addresses or party names.

## Notices and gaps

The [notice audit](notice-audit.json) and [notice history](notice-history.json)
query all 174 current/reachable references, including the 1989 merger references,
against the three Côte-d'Or corpora. There are zero reviewed matches and zero
unreviewed candidates. The independent raw OCR sweep found 15 hint hits; only
`bfc-2020-081:p168` and `p173` name Morey-Saint-Denis. Both are 3 September 2020
authorisations, for SAS Amont and SCEV Magnien Michel et Fils, and their page
images (pages 170 and 175) print AB237 among Chambolle-Musigny parcels ceded by
M. Funes Daniel, not Morey-Saint-Denis. Neither reaches Clos de la Roche, and the
others never name Morey-Saint-Denis; all are recorded but not assigned.

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

## Tier 2 holder and source review

All **22 recorded holders** now have Tier 2 rows using the [shared holder table](../holders/holder-links.json).
Thirteen new holder entries are added and nine earlier entries/effort records are reused. Ten applicable
links cover **33 parcels**: nine reviewed research links and the existing provisional Dujac family-company
lead. Three more parcels receive critic leads, raising the union from **0 to 36**, with **76 unresolved**.
Company identities, historical lessor relationships and dated producer attributions do not confirm current operation.

The bounded new selection is **36 PDFs / 1390 pages**, all OCR-screened with RapidOCR and DirectML at
150 dpi. It includes 35 relevant candidate-company PDFs / 1374 pages and **one rejected 16-page file**:
the Peirazeau formation link actually opens SCI ADH Sevigne. Nine holders reuse **29 PDFs / 984 pages**
of prior research without recounting that effort. The [filing log](filings.md) lists each document, deed and
deposit date, page anchors, original-byte hashes and holder outcomes. Raw PDFs, OCR and archives stay outside Git.

Twelve exact filing entries cover **39 current parcels**, requiring the current reference, individual area
and recorded holder together. Historical transaction scope is retained: Saint Loup contributes half an
indivisible interest in AB460; the Magnien business contribution transfers plantations and **excludes land**;
Lignier schedules include fractional interests and AB419 as land. Peirazeau's two individual leases divide
AB47 and AB50 into portions, so no entire parcel is assigned to either tenant. Lignier-Michelot AB381 is
printed at 1172 m² versus the current 1173 m² and fails the exact-area test.

Three U-id crosswalks are supported by filed identities and exact schedules: Boutieres **445342603**,
Marchand-Virely **477891048**, and Feuillet **420812018**. The different same-name Boutieres 418034823
and Feuillet 382058188 companies remain distinct. Hospices and Lecheneaut U-ids remain unresolved.
No producer is inferred from the Lignier, Peirazeau, Magnien or Feuillet personal names and officers.
Marchand's deed explicitly names EARL Domaine Marchand Freres; its official legal notice and government
register independently establish the tenant company's identity. Its 1999 lease remains a historical recital.

The 2006 Feuillet deed contains an official **23 June 2004 CVI** naming Truchot Martin Jacky against
AB230 (968 m²) and AB505 (3133 m²). It also explicitly terminates the 1998 Truchot lease on **11 January 2006**;
a successor lease is only proposed and its tenant is unnamed. After the explicit #364 pause, the user approved
retaining this as historical research with **zero verified farming**. No later Duband or Feuillet operator is
assigned. The 2024 GFA statutes retain the old contribution schedule and cannot refresh that historical evidence.

Malauro recites a 2014 lease to Laurent Lignier individually. Boutieres' 2022 donation recites a 2018 lease
to Frederic Magnien and a 2022 rent amendment, distinct from old Michel Magnien leases. Saint Loup's recital
ends in 2019. Ponsot's explicit 2007 lease clause names the operating company, while a 2018 tax recital
inconsistently names the GFA as tenant; that conflict and missing originals/renewals remain visible.

Three supplied Winehog articles provide **15 matching individual references** and **seven named-area census
rows**. Ponsot's 3960 m² portion of AB461 is excluded from whole-parcel matches (the full parcel is 27614 m²),
but retained in the reported named-area total. Rousseau AB550/551 gain critic research without inventing
legal-entity rights. Domaine Leroy's critic attribution stays separate from the recorded Maison Leroy company
link. Some lazy-loaded producer maps are absent; all accepted numbers and areas come from explicit article text.
The overview, Hubert Lignier and Dujac articles remain unsupplied paywall gaps. Public articles are accessed directly.

Former Magnien AB162/500/502 have no documented ancestry or accepted successor into the current selection
and remain unmatched. No geometry, rights or shared generator is changed. Original instruments, unresolved
identities, paid SPF copies and present-season confirmation remain open gaps. **Verified farming remains zero.**

## Reproduce and validate

Use Python 3.12, as CI does, with
`scripts/burgundy-map-requirements.txt`. From the repository root:

```sh
python scripts/download_grand_cru_sources.py --cru clos-de-la-roche
python scripts/build_grand_cru_parcels.py --cru clos-de-la-roche --check
python scripts/build_grand_cru_commune_audit.py --cru clos-de-la-roche --check
python scripts/build_grand_cru_named_plots.py --cru clos-de-la-roche
python scripts/build_grand_cru_parcel_named_areas.py --cru clos-de-la-roche --check
python scripts/build_grand_cru_history_rollout.py --bundle chambolle-morey --check
python scripts/build_grand_cru_research.py --all --check
python scripts/build_grand_cru_app_registry.py --check
python scripts/audit_grand_cru_history_rollout.py --check
npm run build
python scripts/measure_grand_cru_payload.py
```

The named-area builder is deterministic; rebuilding must leave its outputs
unchanged. The browser journey uses `WINELOG_E2E_CRU=clos-de-la-roche` with
`burgundy-village-map.spec.ts`, without expanding the normal Chromium matrix.
