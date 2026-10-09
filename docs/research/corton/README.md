# Corton parcels: Tier 1 (#405) and Tier 2 (#451)

Corton uses INAO `inao-denom-549`, appellation 165, across Aloxe-Corton (21010),
Pernand-Vergelesses (21480) and Ladoix-Serrigny (21606). Reviewed 7 October 2026
for season 2026 under the [rollout playbook](../../grand-cru-parcel-rollout.md)
and [#461 history method](../grand-cru-history.md). It appears on all three
village maps. Its shared Corton bundle also contains Corton-Charlemagne and
Charlemagne, whose official outlines overlap Corton's; this delivery enables only
Corton. Tier 2 revisits all 112 recorded holders through the
[shared holder table](../holders/holder-links.json), free company filings,
published holdings and independent research; see [Tier 2](#tier-2-holders-filings-and-published-holdings).

**No current farmer is verified.** Recorded rights, parcel filiation, deeds and
administrative procedures are distinct evidence, and none establishes farming.

## Results

| Measure | Value |
| --- | ---: |
| Cadastral parcels | 728; 159.823708 ha of measured cru overlap (448 in Aloxe-Corton, 133 in Pernand-Vergelesses, 147 in Ladoix-Serrigny) |
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
| Parcels with an authorisation / application or suspension | 3; one page-reviewed 2021 application receipt |
| Parcels with sale records (DVF) | 107; 43 deeds on current references, plus 1 deed on a historical reference retained with original scope |
| Parcels with holder or research leads | 267: 262 holder or research leads, 3 parcels named in the reviewed notice and 2 co-sale leads from DVF deeds. A recorded legal holder alone is not a lead |
| Parcels with no lead | 461 |
| Parcels with exact-reference company filings | 82, in 26 filing rows from 25 filings of 25 companies; 13 rows recite a lease, tenancy or lease mandate |
| Published holdings compared by named area | 35 statements from 18 producers in 15 named areas: 27 sized for one named area, 5 unsized, 3 spread over several named areas |
| Verified farming links | 0 |
| Official history to earliest records (#461) | Delivered for per-cru review: recursive DFI to 1989, all pinned geometry vintages of the three communes and published rights; sale/notice coverage remains source-specific and qualified |
| Raw / gzip payload (parcels, evidence) | Parcels: 704,334 / 103,159 bytes. Evidence: 1,002,200 / 67,432 bytes |

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
Pernand-Vergelesses has its own. The village maps already show Corton's climats as
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
remain identifiers, not inferred persons; Tier 2 gives seven of them a sourced
SIREN crosswalk and keeps the provisional identifier. Holder-to-domaine links
come from the shared holder table (below); paid SPF copies and outreach remain
Tier 3.

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
Both index candidates were read from their page images:

- `bfc-2021-146:p36` (page 37), the EARL Domaine Philippe Girard receipt, prints
  A139 under Chambolle-Musigny, not Aloxe-Corton. The [curation](curation.json)
  records the rejected reference with its reason.
- `bfc-2022-044:p18` (page 19), the Thibaut Marion receipt for dossier 2021-180,
  prints Ladoix-Serrigny AK159, AK164 and AK36 (0.6457 ha), names CPEF à Beaune
  as previous operator and was complete on 4 November 2021. All three are current
  Corton parcels. The curation records one historical-application event on them;
  the receipt does not authorise cultivation, and no outcome or actual operation
  is established.

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

## Tier 2: holders, filings and published holdings

Tier 2 follows the playbook's [shared holder research](../../grand-cru-parcel-rollout.md#shared-holder-research).
The [curation](curation.json) sets `"holderLinks": "shared"`: its holder rows keep only the cru's
own basis, finding and sources, and domaine names come from the
[shared table](../holders/holder-links.json). The [holder report](../holders/holders.md) lists every
link with its relation, sources and effort.

**Holders.** All 112 recorded holders were taken in order of parcels held. Six were already in the
table and were not searched again; Capitain-Gagnerot's link gained its own legal notice, which gives
its SIREN. The other 106 were looked up in the official company register and the free filing index
of entreprises.lefigaro.fr, and their founding, contribution, merger and latest-statute filings were
OCR-screened. Each now has a link or a `searches` record with what was found, plus its `effort`
(filings screened and pages). Eight of them were also researched for Clos de Vougeot (#424), whose
entries reached the table first and are kept. Two of those give Corton links this search had not
found: the Grenelle GFA, through a 2004 partition deed reciting a long-term lease of all its land to
SCEV Château Genot-Boulanger, and Leroy SA (Maison Leroy). One was corrected with new evidence: after
its 2026 contribution, the holder recorded as Maison Bouchard Père et Fils is the parent company of
Bouchard Père et Fils, so its relation is now parent group.

- 64 holders have a link that applies to Corton: 53 reviewed and 11 provisional. Relations are
  owner company (27), lessor per filing (11), family holding (9), brand identity (5), subsidiary (3),
  management (2), succession (2), common ownership (2), parent group, shared office and partner
  company (1 each). They reach 259 of the 387 parcels with recorded rights.
- 48 holders have no applicable link. They include the communes and public syndicates, investment
  GFVs, family land companies whose filings name no tenant or let to a person rather than a company,
  and companies tied to a domaine only by a similar name. The Bichot SA and SCI Les Climats links
  from earlier crus are limited to those crus and do not apply here.
- Seven provisional `U…` identifiers have sourced crosswalks: five through founding schedules whose
  references and areas match (Corton-Grancey, Les Chagnots, Ravaut, Clavelier, Saint Vincent Corton
  Les Maréchaudes), Gille through its original company name, and SHVCC by identical name and commune
  only. Five remain without a SIREN; SCI des Domaines Dupray's name matches a separately recorded
  SIREN in this cru, and no crosswalk is recorded.
- A new `partner-company` relation records a domaine company that is a recorded partner of the
  holder (Domaine de Montille in SCEA Corton Clos du Roi).
- App headings: 50 linked holders group under 44 domaine headings, from company records, estate
  sources or brand identity. The 11 lease and mandate rows, the two successions and the shared-office
  match stay leads under the holder's legal name.

**Filings.** [Filing readings](filings.md) cover 349 filings of 105 companies (about 8,400 pages)
and every cited schedule, with deed and deposit dates, pages, page-image checks and SHA-256. 26 rows
from 25 filings name 82 current parcels with today's references and cadastral areas; 13 recite a
lease, tenancy or mandate:

- Four Latour family land companies recite leases of all their land to the Société Civile Domaine
  Louis Latour: the Corton-Grancey GFA's 1966 lease, renewed in 2013 to 31 October 2031, and the
  Belgrand-, Marchal- and Rolland-Latour GFAs' 2001 leases to 10 November 2026. Vignoble Latour and
  Latour Immeubles are 99.99% subsidiaries of Maison Louis Latour, which contributed its one-third
  shares and the Aloxe-Corton cellar (Les Perrières B 28) in 2011.
- Les Chagnots recites a 1970 lease of Renardes C 29 and C 50 to the company now registered as
  Domaine d'Ardhuy, renewed to 2010; a nine-year renewal from 2019 was authorised in 2020.
- SAS du Domaine Rapet Père et Fils declares itself tenant in place of the Vincent Rapet GFA's land;
  the Beaumonts GFA recites leases to S.A.R.L. Domaine Maillard Père et Fils ending 2008 and 2014;
  Mémoire de Vignes defines an 18-year lease to SCEA du Domaine Poisot-Piguet from July 2024.
- Domaine de Montille contributed Clos du Roi D 132 to SCEA Corton Clos du Roi in 2023, keeping
  D 133; S2V (Domaine Jean Fery et Fils) holds 99 of SCI Les Combottes' 100 shares; after a 2026
  partial asset contribution, the holder recorded as Maison Bouchard Père et Fils (now Vignoble des
  Cabottes) holds almost all shares of the new Bouchard Père et Fils company.
- Leases to individuals (Sordoillet to Maurice Chapuis, Gros Faiveley, Chapuis GFV, Saint Vincent
  Corton Les Maréchaudes, the L'Empereur mandate) are recorded with the filing but give no domaine
  link, except a provisional one where the person is the namesake of the domaine company.

The free filing index lists two Latour filings under each other's company; each was attributed by
the company named in the document. Printed references without a current match stay as printed
(D 91, D 97 and I 141 of the Corton-Grancey schedule, in `unmatchedPrintedReferences`).

**Independent research.** The 16 Corton and Corton-Charlemagne articles indexed on
[Winehog](https://winehog.org/vineyards/corton-vineyard-articles/) were read to their free-access
boundary. With estate figures, they give 13 research entries, 10 of them on 18 parcels.

- Winehog names Louis Latour's La Vigne au Saint plots 50 and 51 (1.9762 ha) and Domaine des Croix's
  Le Charlemagne plots 19 and 45; both pairs match current parcels by number and area.
- Its Bouchard article names Le Corton plots 8 and 9. C 0008 and C 0009 were merged and re-divided
  by official DFI events in 2024–2025 into today's C 0124 and C 0125, so the reference reaches them
  only through documented lineage. The research builder now accepts documented DFI ancestry, as
  well as accepted spatial successors, for printed predecessor references.
- Area-only matches (Domaine des Croix's Grèves and Vigne au Saint, Méo-Camuzet's Vigne au Saint)
  and estate figures equal to cadastral areas (Chandon de Briailles' Clos du Roi and Maréchaudes,
  Vougeraie's Clos du Roi, Mallard's Renardes, Roumier's Corton-Charlemagne) are labelled as matches,
  not parcel claims. Chanterêves' grape purchase from En Charlemagne no. 168 creates no lead.

## Named-area comparison

The [generated census](register.md#named-area-census) compares, per cadastral lieu-dit, land without
a company record with the Corton holdings producers publish there: 35 statements from 18 producers
in 15 named areas, 27 of them sized for a single named area. Without company records: 341 parcels,
60.60 ha of mapped overlap. Published holdings exceed linked company records by 5.63 ha in all,
mostly in Le Clos du Roi (1.55 ha), Les Pougets (1.05 ha) and Les Renardes (1.02 ha). It is an area
comparison, not an assignment: published figures have different dates, precision and tenure, and
include leased land.

- Exact agreement: Chandon de Briailles' red Bressandes (1.4535 ha) plus the Bressandes share of its
  white Corton equal its company's recorded Bressandes area; its Clos du Roi and Maréchaudes parcel
  areas equal four recorded parcels.
- Producers with no linked company record here are compared in full: Michel Gaunoux's 0.63 ha of
  Renardes (Winehog), Château de Meursault's 18.20 ares worked in Vergennes, and Domaine de la
  Romanée-Conti's 2.2746 ha taken en fermage from Domaine Prince Florent de Mérode in 2008 (Clos du
  Roi, Bressandes, Renardes; spread over three named areas, so not split).
- The Hospices de Beaune name six Corton cuvées by climat without areas; Faiveley's 2 ha 76 a 52 ca
  Clos des Cortons Faiveley names no lieu-dit and is left out of the census.

## Limitations, access gaps and unresolved leads

- **No current farmer is verified.** No filing reviewed is a signed current lease plus evidence of
  actual operation; lease recitals in statutes and mandates do not meet the #364 gate.
- Recited leases have lapsed on their stated terms for the Beaumonts (2008, 2014), Gille (2013) and
  Sordoillet (2020) land, and the three 2001 Latour GFA leases end on 10 November 2026; renewals are
  not filed.
- Bouchard's 2026 contribution does not itemise which vineyards moved; the 1 January 2025 rights
  file predates it, as it predates the Remoissenet (2022), Belin-Naigeon (2024) and Maurice Chapuis
  (2025) mergers it still records.
- Provisional links to check: Rapet (Robert Rapet GFA), Ravaut GFA, Pavelot GFA, Tollot-Beaut GFA,
  Clavelier GFV, Gille GFV, Roumier (Clos de la Bussière), Comte Senard, Méo-Camuzet (Corton
  Investissement's shared office), Sordoillet/Chapuis and the Esprit 20 lease mandate.
- Unresolved holders worth a further look: SC Dom Hippolyte Thevenot (10 parcels, 1.98 ha, no SIREN
  found), SCI Royland (shares Pousse d'Or's office; no filing names its Clos du Roi parcels), SCI des
  Bressandes, GFA Dom Emile Voarick, SCEV Domaine Frey (Château Corton-André until 2015), the Parc
  Valmy investor companies (HBM Vignobles, HBM II, Remus Vignobles, Saint Vincent La Vigne au Saint)
  and Château de Meursault's similarly named management company.
- Access gaps: Winehog's subscriber-only parcel details; estate pages for Domaine Parent (HTTP 429),
  Château Corton C, Pavelot, Tollot-Beaut, Chevalier and Dublère; Bouchard's Le Corton page (HTTP
  500). Fourteen operating-company filings without contribution or merger content were not screened,
  and the screening is not an exhaustive reading of every company archive.
- Corton-Charlemagne and Charlemagne share these parcels; their curations do not use the shared
  table yet, so these links reach them only when their own Tier 2 adopts it.

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
python scripts/build_grand_cru_holder_links.py --check
python scripts/build_grand_cru_research.py --all --check
python scripts/build_grand_cru_app_registry.py --check
python scripts/build_grand_cru_climats.py --check
python scripts/audit_grand_cru_history_rollout.py --check
npm run build
python scripts/measure_grand_cru_payload.py
```

The named-area builder is deterministic; rebuilding must leave its outputs
unchanged. The browser journey uses `WINELOG_E2E_CRU=corton` with
`burgundy-village-map.spec.ts`, without expanding the normal Chromium matrix.
