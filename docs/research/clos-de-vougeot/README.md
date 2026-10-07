# Clos de Vougeot parcels: Tier 1 (#378) and Tier 2 (#424)

Clos de Vougeot uses INAO `inao-denom-546`, appellation 162, and commune 21716
Vougeot. This is the third cru through the [rollout playbook](../../grand-cru-parcel-rollout.md).
Tier 1 uses free public datasets and the existing Côte-d'Or notice indexes. Tier 2 researches
all 69 recorded holders through the [shared holder-to-domaine table](../holders/holders.md),
free company filings, published holdings and independent research. Tier 1 reviewed
1 October 2026; Tier 2 reviewed 7 October 2026; target season 2026.

**No parcel has a confirmed current farmer.** A legal right, application receipt,
sale or cadastral predecessor never establishes actual farming.

## Results

| Measure | Value |
| --- | ---: |
| Cadastral parcels | 164; 51.0072 ha of mapped cru overlap |
| Parcels with recorded legal-entity rights (1 January 2025) | 106; 40.5460 ha; 69 legal holders, 110 right records |
| Parcels without matched rights | 58; 10.4612 ha |
| Rights snapshots: available / imported years and missing releases | 7 / 7 (1 January 2019–2025); no listed release missing; no 2026 file listed on 1 October 2026 |
| Parcels whose rights changed 2019–2025 | 70; 101 recorded changes |
| Official DFI release and commune coverage | July 2026 department 21 member (schema 2025-01), complete for 21716 Vougeot |
| Earliest / latest reachable official DFI validation date | 20 April 1989 / 12 May 2025 |
| Cadastre vintages: earliest / latest obtained and gaps | 35 Etalab vintages, 6 July 2017 – 1 June 2026 (pinned current); none missing; 1 September 2026 is after the pinned geometry |
| Current parcels with documented predecessors / pre-2019 events | 68 / 58 |
| Distinct DFI documents / analysis lots supporting those parcels | 34 / 36 |
| Inferred-only ancestry / unresolved references or conflicting events | 0 / 0; all 19 next-vintage successors are also DFI-documented; 4 rejected candidates retained; 1 dated geometry discrepancy |
| Sales and notices: available / imported date ranges and gaps | DVF+ 2014–2025 available and imported (deeds 26 March 2014 – 29 August 2025); notices: regional 2019–2026, departmental 2016–2020 and archived Côte-d'Or 2004–2015 captures; 2007, 2009, 2012, 2014 and before 2004 not obtained |
| Parcels with an authorisation / application or suspension | 7; 4 image-reviewed events; no exact-parcel authorisation |
| Parcels with sale records (DVF) | 22; 12 deeds |
| Parcels with exact-reference company filings | 32, in 22 filings (14.0232 ha cadastral area) |
| Parcels with holder or research leads | 96 (89 holder or independent-research leads, including 8 parcels without a company record; 7 notice parcels) |
| Parcels with no lead | 68 |
| Published holdings compared by named area | 8 statements in Clos de Vougeot; 0.82 ha published beyond linked company records |
| Verified farming links | 0 |
| Official history to earliest records (#461) | Delivered: official DFI ancestry from 20 April 1989, all 35 geometry vintages (2017–2026) and 2019–2025 rights; notice archive gaps remain explicit |
| Raw / gzip payload | Parcels: 146,858 / 23,637 bytes. Evidence: 299,708 / 31,599 bytes |

A lead is a named candidate in the [register](register.md): a holder lead from
reviewed research, a parcel named in an official notice or independent research, or a
co-sale lead. A recorded legal holder alone is not a lead. Tier 2 links 49 of the
69 holders to a domaine or producer through the shared table, so the app now offers the
domaine grouping control. Grouping applies only to company-record links; lease, mandate,
management and name-only links stay listed as leads under the legal holder. The other
69 parcels, mostly without a company record, have no named candidate.

The [#461 historical extension](../grand-cru-history.md) adds official parcel
filiation, every catalogue-listed historical vintage and original-reference evidence.
The [independent audit](../../../scripts/grand-crus/reports/history-rollout-audit.md)
records dated coverage and unresolved notice archive gaps. This cru's review of
that delivery is in [Official history](#official-history-461) below.

Both geometry and evidence load only after switching on Parcel rights.

## Geometry and named areas

The [bundle](../../../scripts/grand-crus/bundles/vougeot.json) pins the Etalab
cadastre and lieux-dits dated 1 June 2026, every rights vintage, licence labels,
public URLs and SHA-256 hashes. Only parcels from INAO's commune, Vougeot, enter
the map. All full polygons remain intact; cru overlap is measured separately in
EPSG:2154. Eleven parcels are less than 99% inside the cru. No own-commune edge
contact was omitted by the 1 m² minimum.

The [commune audit](../../../scripts/grand-crus/reports/clos-de-vougeot-commune-audit.json)
measures 51.1156 ha of INAO boundary and 1,084.218934 m² without Vougeot parcel
coverage (0.2121%). Geometry inspection found narrow strips
along the northern and western edges. Flagey-Échezeaux's parcels touch the cru by
87.3 m² in total; three contacts exceed 1 m² and none exceeds 1.432% of its own
polygon. Only 2.734058 m² of the uncovered area is covered by those neighbouring
parcels; 1,081.484876 m² is covered by no audited parcel. Chambolle-Musigny and
Vosne-Romanée have no contact. Neighbouring parcels are measured, never imported.

The default audit permits 0.1% uncovered area. The reviewed remainder here uses
an explicit absolute cap of 1,084.3 m² tied to the exact INAO and cadastre hashes,
review date and explanation in the cru config. Changed sources fail this check.
No clipping, buffering, snapping or filling repairs the parcel geometry.

The cadastre records one whole-cru lieu-dit, `CLOS DE VOUGEOT`, covering at least
99.99% of each selected parcel's full polygon at the output's rounded precision. Its exact intersection with INAO
is [audited](../../../scripts/grand-crus/reports/clos-de-vougeot-named-plots.json):
51.1143 ha, with 13.4224 m² of the INAO outline unrepresented. This is separate
from the parcel-coverage gap. The official wine-board climat list names Clos de
Vougeot as one climat. No duplicate named-area display layer or additional alias
is published. Historical subdivisions and producer holdings have no reviewed
cadastral crosswalk; the app retains the whole-cru outline. The
[per-parcel named areas](parcel-named-areas.json) retain the cadastral name.

## Rights, history and sales

The current DGFiP snapshot is explicitly dated 1 January 2025. The live official
release catalogue was checked on 1 October 2026 and exposed no 2026 parcel file.
The join uses complete cadastral references and retains every holder and right
code: B, E, N, P, R and U. Every matched recorded area agrees with the cadastral
area. A0025, A0026, A0539 and A0548 each have two different right records; no
ownership share or operating relationship is inferred.

[Rights history](rights-history.json) compares the 2019–2024 legal-entity files
with 2025: five holder changes, four new references, 15 record appearances, one
right-type change, 29 same-SIREN name changes and 47 identifier changes whose
continuity cannot be proved. Across all 35 cadastre vintages, 19 current parcels
have an accepted cadastral predecessor, from nine retired references. Acceptance
requires first appearance in the next pinned vintage and at least 95% of the child
inside the retired polygon. Direct A0032 → A0579/A0580 and A0400 → A0577/A0578
candidates are rejected because the children appear later; their accepted immediate
predecessors are A0562 and A0543. Rejected candidates remain in the output. A split
does not transfer a historical right automatically.

[DVF+ records](sale-records.json) use the April 2026 regional release: 12 deeds
name 22 current parcels. The commune's available records span 26 March 2014 to
29 August 2025. Only dates, deed types, references and parcel counts are retained;
prices, addresses and party names are excluded. A deed is no farming evidence.

## Official history (#461)

Reviewed 6 October 2026 against the shared [history method](../grand-cru-history.md).
[Rights history](rights-history.json) pins the July 2026 department 21 DFI member
(`dfiano-dep210-01072026.txt`, 36,175,805 bytes, retrieved 1 October 2026), its
January 2025 schema, every listed 1 January rights file (2019–2025) and all 35
Etalab vintages for Vougeot, each with URL, licence, size, hash and retrieval time.
The DFI member is complete for the commune: its events run from 20 April 1989 to
12 May 2025, and both ends are reachable from today's parcels.

- **Documented filiation.** 68 of the 164 current parcels have documented
  predecessors, 58 of them through an event validated before 2019. They rest on
  34 DFI documents and 36 analysis lots (33 splits, 2 one-to-one, 1 merge;
  15 surveys, 14 digital surveys, 7 conservation sketches). Paths reach two
  generations at most: 68 single-event and 24 two-event routes. Complete mother
  and daughter sets are kept; 90 routes are qualified because the former parcel
  also produced other daughters, and 4 cover only part of a current parcel.
- **Where tracing stops.** Every one of the 166 terminal references ends at the
  source boundary or an unrecorded event; there are no parse issues, cycles,
  chronology problems or unresolved events. The other 96 parcels have no DFI
  event; their earliest supported date is the first obtained cadastre, 6 July 2017,
  which is not a creation date.
- **Spatial inference.** All 19 accepted next-vintage successors are also
  documented by DFI, so no parcel's ancestry rests on inference alone. The four
  rejected candidates remain labelled.
- **Geometry against DFI.** 27 events predate the earliest geometry; nine fall
  between obtained vintages. One disagrees in date: A0557 and A0558 appear in the
  1 October 2020 cadastre, before event `0000100` (A0046) was validated on
  26 October 2020. The discrepancy is published, not corrected. A validation date
  dates the record, not the survey.
- **Historical references.** Former A0069 has 2023–2025 legal-entity rights and a
  25 November 2021 sale; former A0409 has 2019–2022 rights. They are shown on
  their successors as historical context with the original date, reference and
  path, never as current rights.
- **Notices.** All seven reviewed matches (2022–2026) are on current references;
  no earlier notice names a reachable former reference. The one search candidate,
  bulletin bfc-2024-008 pages 82–84, was checked on the page images: page 83 is
  the Lambrays receipt for A37 already reviewed below, page 82 is its cover sheet
  and page 84 starts an unrelated Nièvre act. It is reported as already reviewed,
  not as a second event.

Older DFI events date parcel changes, not earlier holders: no rights file exists
before 2019, and none of these records establishes farming.

## Official notices

The [notice audit](notice-audit.json) records searches and reviewed pages against
both existing indexes. Regional 2019–2026 commune matches and a broader Vougeot
text search yielded seven occurrences; all 17 relevant pages were image-reviewed,
with PDF hashes checked against the index. Four events explicitly assign current
Vougeot references:

| Date | Applicant | Printed Vougeot references | Evidence |
| --- | --- | --- | --- |
| 30 June 2022 | AF Gros | A523, A524 | Application receipt; completion-date field blank |
| 8 September 2023 | Domaine des Lambrays | A37 | Application receipt; complete 21 August 2023 |
| 14 November 2024 | Domaine d'Eugénie | A440 | Application receipt; complete 25 October 2024 |
| 7 April 2026 | Domaine du Comte Liger-Belair | A1, A30, A31 | Instruction suspended for eight months from publication |

Dates above belong to the act, not the bulletin's upload directory. Previous
operators are shown only as names printed in the notice. None of these events
confirms current cultivation or a later outcome.

RC Les Grandes Vignes' partial authorisation of 4 July 2022 occurs twice. Article
2 lists four communes collectively without assigning individual rows to them.
Its literal `A469` and the other printed references remain unresolved; a matching
area is insufficient to assign A469 to Vougeot. The repeat publication is not a
second independent event. Henri Rebourseau's 18 November 2025 company-control
authorisation names Vougeot but no cadastral reference; it remains context only.

Departmental 2016–2020 full-text screening found 118 Vougeot page matches, mostly
administration, roads and water. The farm-structures classifier's one relevant
hint was checked on the page image: the 2017 decision concerns the wastewater
station. No exact parcel event enters the register from that index. Five
unresolved alternate Nextcloud links remain an access limitation of the shared
archive. Source URLs, dates, hashes, reviewed page numbers and decisions are in
[curation](curation.json); original PDFs are not committed.

## Tier 2 (#424)

Reviewed 7 October 2026. Holder research now lives in the
[shared holder-to-domaine table](../holders/holders.md); this cru adopts it
(`"holderLinks": "shared"` in [curation](curation.json)). Each link names its company
relation and sources and is shown as **Research link · farming unverified**.

- **Holders.** All 69 recorded holders were researched: 49 now have an applicable
  link (44 reviewed, 5 provisional) and the rest record the search that found
  none. Free register records were read for every company holder and for related
  companies; 180 free filings (5,187 pages) from 48 companies were screened by
  embedded text or OCR, and cited schedules were checked against the text and page images.
- **Provisional identifiers.** Exact filing schedules crosswalk four `U…` identifiers
  to a SIREN (Domaine Jacques Prieur, Les Héritiers Confuron, GFA du Clos de(s) V and
  GFA Méo Camuzet Parents); three more (GFA Dom Lamarche, SCI Dom Leroy and GFV
  Domaine Chantal Ropiteau) match only by name and seat, so their links stay
  provisional or absent. Ambiguous names (GFA Barrière, SA ASB, GFA Bachus 21 and
  Maison Lejay-Lagoutte) stay unlinked. An undated owner map reproduced in 2016 was
  checked but not used: the current rights file and later filings supersede it.
- **Exact references.** 22 filings name 32 current parcels with matching
  cadastral areas. Leases are kept apart by status: executed (Les Héritiers Confuron to
  the SCE du Domaine Jean-Jacques Confuron, 2024; the GFA du Domaine Tortochot's
  published 50-year lease of all its land from 1986 to Domaine Tortochot; the two
  Saint-Vincent GFVs' published leases of A516 from 2005 and A517 from 2006 to 2032,
  both to an individual vigneron, whose death a 2018 deed records), recited as in
  force (Coquard-Loison-Fleurot to 2037; the GFA de Châteauneuf's métayage to Domaine
  Leroy since 1959; Château de la Tour's 1993–2019 métayage to Domaine Labet
  Déchelette; Château Genot-Boulanger for all of the GFA de la Grenelle's land, whose
  1995 statutes show A433 let to an individual until 2012; the GFA Domaine Xavier
  Liger-Belair's métayage leases, tenants unnamed) and mandated (Misset Chéron and Saint Martin to Domaine
  Misset Chéron, now Domaine du Couvent; Méo Camuzet Parents to the Méo-Camuzet GFA;
  Les Vendanges du Clos to an individual vigneron). The GFA Famille Jean Dufouleur's
  2015 statutes contribute A3 free of any lease, the GFV Raphet's 2011 statutes
  contribute A412 without naming a lease, and Domaine du Château de Marsannay's 1998
  meeting authorised contributing A264 to another company, though the rights file
  still records Marsannay. Two more deeds name current references
  without qualifying as exact-reference filings: the Guillon GFA's 2021 deed recites a
  2011 lease of A242 to SAS Domaine Jean-Michel Guillon but prints no area, and a 1997
  Méo family deed lists A7, A11, A24 and A61 before their current holder existed.
  Deed and filing dates are separate.
- **Independent research.** Winehog names A372 (Domaine André Chopin, free article),
  A34 (Mugneret-Gibourg) and the eight Gros Frère et Sœur plots in the Musigni section
  (premium articles supplied by the repository owner; facts only). A 1994 deed of
  the société civile du Domaine Joseph Drouhin reproduces its 1940s lease of section A
  no. 40, 62 ares, today's area of A40; that reference predates later cadastral
  revisions and the lease ran to 1951. A372, A40 and the Gros plots have no company
  record.
- **Published holdings.** 8 statements are compared in the
  [named-area census](register.md#named-area-census). Only Jadot (about 2.5 ha) and
  Faiveley (1.2669 ha) exceed their linked company records, by 0.39 and 0.42 ha. Areas
  are never assigned to parcels.

**Verified farming links remain zero.** No reviewed filing combines a current
parcel-specific executed lease with evidence of actual operation (#364). Access gaps
and unresolved leads are listed in the [register](register.md#remaining-evidence-and-access-gaps).

## Limitations and deferred research

Private individuals and other exclusions are absent from the legal-entity files.
The 58 unmatched parcels do not imply ownerless land. The rights snapshot and
latest DVF deed predate the 2026 target season; notice coverage is limited to the
regional and departmental years above. Boundary mismatches remain measurable.

Tier 2 (above) covers free company filings, published holdings and independent
research; [the filing inventory](filings.md) lists every filing used. Paid SPF
copies and domaine/CVI outreach are Tier 3 and remain deferred. Future operator evidence belongs with #364; an exact
subdivision crosswalk belongs with #344. Manual app links retain
**Manual link · unverified** and are scoped to the wine's producer.

## Rebuild and verify

Install the geometry dependencies in `scripts/burgundy-map-requirements.txt`
(Shapely 2.1.2, pyproj 3.7.2 and pyshp 2.3.1). Source downloads are cached outside
Git in `.tmp/grand-cru-sources/vougeot/`.

```sh
python scripts/download_grand_cru_sources.py --cru clos-de-vougeot
python scripts/build_grand_cru_parcels.py --cru clos-de-vougeot
python scripts/build_grand_cru_commune_audit.py --cru clos-de-vougeot --check
python scripts/build_grand_cru_named_plots.py --cru clos-de-vougeot
python scripts/build_grand_cru_parcel_named_areas.py --cru clos-de-vougeot --check
python scripts/build_grand_cru_rights_history.py --cru clos-de-vougeot --check
python scripts/build_grand_cru_sale_records.py --cru clos-de-vougeot --check
python scripts/build_grand_cru_notice_history.py --cru clos-de-vougeot --check
python scripts/build_grand_cru_research.py --all --check
python scripts/build_grand_cru_history_rollout.py --check   # Python 3.12
```

The parcel rebuild must reproduce SHA-256
`7f159994ad5bb0b169ab4a160f69a3787077e3c96bd8a205764719c8b9ebca3b`.
The representative browser journey uses `WINELOG_E2E_CRU=clos-de-vougeot` with
`playwright.burgundy.config.ts`; the default journey remains Grands-Échezeaux.
