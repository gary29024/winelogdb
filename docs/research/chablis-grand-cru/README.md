# Chablis Grand Cru parcels: Tier 1 (#408)

Chablis Grand Cru uses INAO `inao-denom-439`, appellation 147, in Chablis
(89068), Yonne. Reviewed 7 October 2026 for season 2026 under the
[rollout playbook](../../grand-cru-parcel-rollout.md) and
[#461 history method](../grand-cru-history.md). Parcel rights and evidence are
enabled on the Chablis map after the commune audit.

**No current farmer is verified.** Recorded legal-entity rights, filiation,
deeds and treatment derogations are separate evidence. Soufflet Vigne requested
aerial-spraying derogations; those decisions identify no owner or operator.

## Results

| Measure | Value |
| --- | ---: |
| Cadastral parcels | 417; 106.651025 ha of measured cru overlap, all in Chablis |
| Parcels with recorded legal-entity rights (1 January 2025) | 296; 43 holder identifiers and 297 right records |
| Parcels without matched rights | 121 |
| Rights snapshots: available / imported years and missing releases | 2019–2025 / 2019–2025; no listed release missing; no earlier or 2026 rights release at the 7 October recheck |
| Parcels whose rights changed over the imported snapshot range | 163; 2019–2025 |
| Official DFI release and commune coverage | July 2026, complete Yonne member; Chablis validations span 1988-04-29–2026-06-22 |
| Earliest / latest reachable official DFI validation date | 1991-03-22 / 2024-11-19 |
| Cadastre vintages: earliest / latest obtained and gaps | 2017-07-06 / 2026-06-01; all 35 listed vintages through the pinned map; September 2026 is outside this range |
| Current parcels with documented predecessors / pre-2019 events | 102 / 83 |
| Distinct DFI documents / analysis lots supporting those parcels | 35 / 58 |
| Inferred-only ancestry / unresolved references or conflicting events | 0 inferred-only current parcels; 0 unresolved DFI events, traversal issues or spatial conflicts; all traces end at a source boundary or unrecorded event |
| Sales and notices: available / imported date ranges and gaps | DVF+ declares 2014-01-01–2025-12-31; complete BFC 2026-1 archive imported, Chablis observations 2014-01-08–2025-12-19. Partial Yonne archive 2008–2026; matched acts 2012-05-16 and 2013-05-22; notice gaps below |
| Parcels with an authorisation / application or suspension | 17; treatment derogations only, not permission to operate a farm |
| Parcels with sale records (DVF) | 22; 11 deeds on current references, no matched historical-reference deed |
| Parcels with holder or research leads | 17; exact-reference treatment notices count as research leads under the standard table convention; no named operator candidate is inferred |
| Parcels with no lead | 400 |
| Verified farming links | 0 |
| Official history to earliest records (#461) | Delivered for per-cru review: recursive DFI to 1991, all pinned Chablis geometry vintages and published rights; source-specific sales and notice limits remain explicit |
| Raw / gzip payload (parcels, evidence) | Parcels: 366,499 / 53,055 bytes. Evidence: 416,346 / 25,853 bytes |

Payloads use Python 3.12 `gzip.compress(data, mtime=0)`. Both parcels and evidence
load only when Parcel rights is enabled. There is no new named-area GeoJSON.
The production payload report also measures compiled JavaScript and checks that
history remains outside the initial and map static imports.

## Geometry and names

The [bundle](../../../scripts/grand-crus/bundles/chablis.json) pins unchanged
1 June 2026 parcels and lieux-dits, URLs, licences and SHA-256 hashes. Commune
identities and adjacency were checked through the official geo.api.gouv.fr
department 89 contour API; the [identity review](../../../scripts/grand-crus/sources/catalogues/2026-10-07-chablis/communes.json)
preserves the returned names and codes. The nine actual neighbours are Beine
(89034), La Chapelle-Vaupelteigne (89081), Chichée (89104), Collan (89112),
Courgis (89123), Fleys (89168), Fontenay-près-Chablis (89175), Maligny (89242)
and Préhy (89315). Their pinned parcels are audit-only and never imported.

The [commune audit](../../../scripts/grand-crus/reports/chablis-grand-cru-commune-audit.json)
measures 15.1414 m² uncovered out of 1,066,528.4275 m² (0.00142%), below the
0.1% threshold. The remainder consists of tiny boundary mismatches, with only
0.0259 m² between parcels inside the outline; all nine neighbours have zero
contact area. No reviewed cap is needed. Nineteen own-commune contacts at or
below the 1 m² inclusion threshold remain excluded in the parcel report.
Full parcel polygons are retained; none is clipped, buffered or filled.

BIVB's [Chablis Grand Cru page](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/chablis-grand-cru,2458,9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9MjYyJnw%3D)
names seven climats, already represented by INAO features 440–446. The
[named-area audit](../../../scripts/grand-crus/reports/chablis-grand-cru-named-plots.json)
and [parcel crosswalk](parcel-named-areas.json) therefore use `displayLayer: false`.
These cadastral name correspondences do not replace the official climat outlines:

| Official climat / INAO feature | Reviewed cadastral name | Mapped parcels |
| --- | --- | ---: |
| Blanchot / 440 | COTE DE BLANCHOT | 66 |
| Bougros / 441 | LES BOUGUEROTS | 46 |
| Grenouilles / 442 | LES GRENOUILLES | 41 |
| Les Clos / 443 | LES CLOS | 104 |
| Les Preuses / 444 | LES PREUSES | 42 |
| Valmur / 445 | CÔTE DE VALMUR | 9 |
| Vaudésir / 446 | LES VAUDESIRS | 35 |

The crosswalk covers 343 parcels; every parcel has a dominant cadastral name
covering at least 99.82% of its polygon. Four additional names account for the
remaining 74 parcels and stay unresolved as climat aliases:

- `ENVERS DE VALMUR`: 29 parcels; crosses official Valmur (56,720.636 m²)
  and Les Clos (22,655.233 m²).
- `ENVERS DES VAUDESIRS`: 40 parcels; crosses Vaudésir (52,700.950 m²)
  and Grenouilles (263.739 m²).
- `LES QUATRE CHEMINS`: four parcels, 8,815.472 m² in Les Preuses.
- `SUR LES CLOS`: one parcel, 242.705 m² in Les Clos.

There are no unnamed parcels or cadastral overlaps above the audit tolerance.
La Moutonne is not an eighth climat and has no matching cadastral name in this
snapshot. It is recorded as unresolved with `sourceCandidate: null`; its existing
[producer-based approximate illustration](../../la-moutonne-approximation.md)
is preserved without assigning a holder, parcel or operator. Wine labels continue
to resolve to the seven official INAO features.

## Rights, history and sales

The [fresh catalogue review](source-review.json) is restricted to department 89
and pins retrieval times, sizes and hashes in the
[7 October snapshots](../../../scripts/grand-crus/sources/catalogues/2026-10-07-chablis/).
It confirms rights releases 2019–2025, July 2026 DFI with the January 2025 schema,
and 36 listed geometry dates, of which 35 are through the pinned map date.
The publisher's DFI attachment identifier spells the year `20266`; the release
and Yonne member are July 2026. The sales listing still advertises `avril_2026`
(DVF+ 2026-1). Cached Yonne source members were reused, with their original
identities retained in the shared inventory.

The 297 current right records match full cadastral references. One parcel has
multiple rights, and all 296 matched parcels agree on the published fiscal area.
Private-person rights are absent from this legal-entity dataset. Holder identifiers
remain identifiers, without inferred people or domaines; domaine grouping is off.
Producer research and company filings remain Tier 2, and paid SPF records or
outreach remain Tier 3.

[Rights history](rights-history.json) keeps all 35 reachable DFI documents and
58 analysis lots, including intermediate references and complete event groups.
The 102 current parcels with documented ancestors differ from the 19 with
next-vintage spatial predecessors. All inferred current ancestry also has
documentation; no spatial inference is promoted into an official event.
DFI validation dates are not acquisition, creation or farming dates. Events
before the first obtained geometry have no observed predecessor polygon.
The source-boundary terminal reason does not identify an original owner.

[Sale records](sale-records.json) retain dates, deed types and references for
11 deeds on 22 current parcels, without prices, addresses or parties. No historical
reference matched a deed. Observed date ranges do not prove uninterrupted
coverage, and no co-sale operator lead is established.

## Yonne notices and limitations

The [page audit](notice-audit.json) records hashes, URLs, pages and decisions for
all 59 reviewed page images. It includes every Chablis candidate page, all 26
distinct pages containing literal `89068` (29 occurrences including duplicates),
and the three raw commune hits with parcel-like hints. The underlying Yonne
index contains 1,261 obtained PDFs and 38,760 indexed pages. No Côte-d'Or index
or notice date is used.

[Notice history](notice-history.json) retains the baseline **37 reviewed matches
and zero pending candidates**. Thirty-three directly printed current-reference
rows become [exact events](curation.json) on 17 parcels:

- DDT/SEEP/2012/0018, 16 May 2012, pages 3–6: 16 current references and
  three retired references; treatment derogation through 15 August 2012.
- DDT/SEEP/2013/0011, 22 May 2013, PDF pages 128–131: 17 current references
  and one retired reference; treatment derogation through 19 August 2013.

The curated events explicitly link to canonical index rows, validated against
their reference, act date and PDF hash. They do not add another 33 matches.
The app retains each original printed row, area, footnotes and scope. Footnote
(1) restricts treatment to portions more than 50 m from watercourses; printed
treatment areas are not cadastral areas. Neither actual treatment nor farming
is established. Soufflet Vigne is kept out of the operator candidate list.
Retired A11, A23 and A101 remain unassigned context through their DFI paths;
the derogation is not transferred onto their successors.

The raw `UR3` hints are zoning labels on Auxerre (89024) planning maps in
DDT/SAAT/2018/0045, not Chablis cadastral references. Pages 44–54 were reviewed;
the rejection is recorded with its reason and repeated URL copies use `repeatOf`
in the audit. `Route de Chablis` is an Auxerre road. The other literal-code pages
contain commune lists, administrative tables or a school identifier substring,
without Grand Cru parcel events.

Commune-only decisions concerning Bernard Lecuiller, GAEC du domaine du Colombier,
Richard Rottiers/SCEA Domaine des Malandes and EARL Patrice print no parcel
references. They cannot be assigned to this cru. The page image corrects the
earlier Rottiers text-screen: Chablis is explicitly one of the land communes.
William Fèvre's Chablis address concerns land in Viviers (89482), and the
Blanchot street-address hit likewise provides no parcel evidence. The separate
DDT/SEEP/2013/0012 order mentions an unpublished annex; no rows are invented.

Coverage remains partial. The [4 October acquisition audit](../../../scripts/grand-crus/sources/notice-coverage-2026-10-04.json)
records 1,229 listed Yonne PDFs unavailable or unusable, no obtained archive
listings for 2024–2026 (only filename-dated captures), and unsearched pre-2008 departmental and Yonne regional
intervals. Archive holes and unpublished annexes are not negative findings.
The reviewed treatment dates do not extend notice coverage back to the 1991 DFI
event. A dated parcel-specific operator record is still needed for every parcel.

## Reproduction and checks

Use Python 3.12 with `scripts/burgundy-map-requirements.txt` and the shared source
cache. Build the Chablis commune audit, named plots and parcel named-area crosswalk,
then `build_grand_cru_history_rollout.py --bundle chablis`, the app registry and
history audit. The standard research check validates this table against the
built register and Python 3.12 payload sizes.

Validation covers research `--all --check`, registry/history audit and Chablis
bundle checks, commune/named-area/parcel checks, Python regressions, targeted
Vitest including `chablisGrandCruParcels.test.ts`, lint and production build.
Chromium runs the configured parcel journey with
`WINELOG_E2E_CRU=chablis-grand-cru` and the Chablis map journeys with
`WINELOG_E2E_EXHAUSTIVE_MAPS=1`. The final check is the full
`build_grand_cru_history_rollout.py --check` across all bundles.
