# Clos de Vougeot parcels: Tier 1 (#378)

Clos de Vougeot uses INAO `inao-denom-546`, appellation 162, and commune 21716
Vougeot. This is the third cru through the [rollout playbook](../../grand-cru-parcel-rollout.md).
The review uses free public datasets and the existing Côte-d'Or notice indexes.
Reviewed 1 October 2026; target season 2026.

**No parcel has a confirmed current farmer.** A legal right, application receipt,
sale or cadastral predecessor never establishes actual farming.

## Results

| Measure | Value |
| --- | ---: |
| Cadastral parcels | 164; 51.0072 ha of mapped cru overlap |
| Parcels with recorded legal-entity rights (1 January 2025) | 106; 40.5460 ha; 69 legal holders, 110 right records |
| Parcels without matched rights | 58; 10.4612 ha |
| Parcels whose rights changed 2019–2025 | 70; 101 recorded changes |
| Parcels with an authorisation / application or suspension | 7; 4 image-reviewed events; no exact-parcel authorisation |
| Parcels with sale records (DVF) | 22; 12 deeds |
| Parcels with holder or research leads | 7 (7 notice parcels; no holder leads) |
| Parcels with no lead | 157 |
| Verified farming links | 0 |
| Official history to earliest records (#461) | Official DFI validates reachable references from 1989-04-20; all 35 geometry vintages (2017–2026) and 2019–2025 rights imported; notice archive gaps remain explicit |
| Raw / gzip payload | Parcels: 146,858 / 23,637 bytes. Evidence: 187,322 / 14,301 bytes |

A lead is a named candidate in the [register](register.md): a holder lead from
reviewed research, a parcel named in an official notice, or a co-sale lead. A recorded
legal holder alone is not a lead. The seven leads are the parcels named in the four
notices below; the other 157 parcels, including 101 with recorded rights, have no named
candidate. All 69 holder identities are inventoried, but this Tier 1 review establishes
no holder-to-domaine crosswalk, so the app shows legal holders without a domaine
grouping control.

The [#461 historical extension](../grand-cru-history.md) adds official parcel
filiation, every catalogue-listed historical vintage and original-reference evidence.
The [independent audit](../../../scripts/grand-crus/reports/history-rollout-audit.md)
records dated coverage and unresolved notice archive gaps. The cru issue remains
subject to review of its complete Tier 1 delivery.

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
continuity cannot be proved. Sixteen current parcels have an accepted cadastral
predecessor, from seven retired references. Acceptance requires first appearance
in the next pinned vintage and at least 95% of the child inside the retired
polygon. Direct A0032 → A0579/A0580 candidates are rejected because the children
appear later; their accepted immediate predecessor is A0562. Rejected candidates
remain in the output. A split does not transfer a historical right automatically.

[DVF+ records](sale-records.json) use the April 2026 regional release: 12 deeds
name 22 current parcels. The commune's available records span 26 March 2014 to
29 August 2025. Only dates, deed types, references and parcel counts are retained;
prices, addresses and party names are excluded. A deed is no farming evidence.

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

## Limitations and deferred research

Private individuals and other exclusions are absent from the legal-entity files.
The 58 unmatched parcels do not imply ownerless land. The rights snapshot and
latest DVF deed predate the 2026 target season; notice coverage is limited to the
regional and departmental years above. Boundary mismatches remain measurable.

Free company filings, published producer holdings and independent articles are
Tier 2 and were not reviewed for this cru. [The filing inventory](filings.md)
states that scope explicitly. Paid SPF copies and domaine/CVI outreach are Tier
3 and remain deferred. Future operator evidence belongs with #364; an exact
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
python scripts/build_grand_cru_research.py --all --check
```

The parcel rebuild must reproduce SHA-256
`7f159994ad5bb0b169ab4a160f69a3787077e3c96bd8a205764719c8b9ebca3b`.
The representative browser journey uses `WINELOG_E2E_CRU=clos-de-vougeot` with
`playwright.burgundy.config.ts`; the default journey remains Grands-Échezeaux.
