# Grands-Échezeaux parcels: Tier 1 (#377) and Tier 2 (#423)

Grands-Échezeaux (INAO `inao-denom-645`, 9.07 ha, commune 21267 Flagey-Échezeaux) is the
second cru through the generic pipeline ([rollout playbook](../../grand-cru-parcel-rollout.md)).
It shares the pinned Flagey commune bundle with Échezeaux. Tier 2 revisits all nine recorded
holders using free company filings, published holdings and independent research. It is
validated on its own, and its research lives only in this folder. Reviewed 1 October 2026;
target season 2026.

**No parcel has a confirmed current farmer.** Recorded rights, notices, sales and estate pages
are dated evidence for further research, not farming links.

## Results

| Measure | Value |
| --- | ---: |
| Cadastral parcels | 32 (9.07 ha; every parcel wholly inside the cru) |
| Parcels with recorded legal-entity rights (1 January 2025) | 19 (7.01 ha), 9 legal holders |
| Parcels without matched rights | 13 (2.06 ha) |
| Parcels whose rights changed 2019–2025 | 13, with 15 changes: 4 first company records, 7 renames of the same SIREN, 4 identifier changes that cannot be proved continuous |
| Parcels with an authorisation / application or suspension | 3 (D0093 application, 2022; D0615 and D0616 suspended application, 2026) |
| Parcels with sale records (DVF) | 5, in 3 deeds (2015, 2023, 2025) |
| Parcels with exact-reference company filings | 7, in 4 contribution records (1.8024 ha cadastral area) |
| Parcels with holder or research leads | 19 (16 holder leads, 3 notice parcels) |
| Parcels with no lead | 13 |
| Published holdings compared by named area | 17 entries in Les Grands Échezeaux: 15 sized statements, including 1 métayer; 2 historical entries excluded from numeric comparison |
| Verified farming links | 0 |
| Official history to earliest records (#461) | Official DFI validates reachable references from 2019-03-12; all 35 geometry vintages (2017–2026) and 2019–2025 rights imported; notice archive gaps remain explicit |
| Raw / gzip payload | Parcels: 239,882 / 35,324 bytes. Evidence: 81,573 / 12,856 bytes |

Both files load only when "Parcel rights" is switched on. The parcel file is the one already
used for Échezeaux; Grands-Échezeaux adds only its evidence file.

## Named-area comparison

| Named area | Mapped area | Without company records | Published beyond linked company records |
| --- | ---: | ---: | ---: |
| Les Grands Échezeaux | 32 parcels, 9.0704 ha | 13 parcels, 2.0579 ha | 2.1630 ha |

The final column sums positive differences between selected published whole-area holdings
and the **mapped cru-overlap area** of their linked company records. It is a research
comparison, not an estimate of privately owned or planted land. Cadastral legal area and
mapped overlap differ; published statements have different dates, precision and scope. The
sum exceeds the unmatched mapped area by 0.1051 ha, so it cannot reconcile those parcels.
No holding was assigned to a parcel from its area or location.

The [generated census](register.md#named-area-census) lists each statement with its precision,
tenure wording and company comparison. The [curation](curation.json) retains alternative
figures and source IDs: Noëllat 0.30 / 0.38 / 0.40 ha; Villamont 0.16 / 0.43 / approximately
0.5 ha; Drouhin 0.47 / 0.48 ha. Liger-Belair's reported métayage is excluded from the sum
because the owner is already counted. Gros Frère et Sœur's historical 0.3662 ha and the
quoted 2017 Kohut 0.07 ha are retained outside the numeric comparison; no last harvest or
continued current holding is invented.

## What was done

- **Parcels and commune audit.** The pinned Etalab snapshot of 2026-06-01 gives 32 parcels,
  full polygons, with the cru overlap measured separately; no edge contact was left out. The
  [commune audit](../../../scripts/grand-crus/reports/grands-echezeaux-commune-audit.json) confirms
  INAO lists only Flagey (21267) and that Flagey parcels cover the boundary apart from 1.8 m²,
  which no parcel covers (gaps between parcels). Neighbouring communes are measured, never imported. Vosne-Romanée and
  Chambolle-Musigny touch the cru by 0 m². Along the Clos de Vougeot wall, 12 Vougeot parcels
  touch it by 148 m² in all (at most 48 m², 2.15% of any one parcel). That is where the INAO
  line and the cadastral commune line disagree, not Grands-Échezeaux land.
  The shared bundle pins the [Cadastre licence](https://www.data.gouv.fr/datasets/cadastre)
  and [DGFiP rights licence](https://www.data.gouv.fr/datasets/fichiers-des-locaux-et-des-parcelles-des-personnes-morales)
  alongside their source URLs, snapshot dates and hashes.
- **Named areas.** One cadastral lieu-dit, `LES GRANDS ECHEZEAUX`, holds 100% of every parcel
  ([per-parcel file](parcel-named-areas.json)). The [Bourgogne wine board page](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/grands-echezeaux,2458,9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9MzE0Jnw%3D)
  names the same single climat. Since it is the whole cru, no separate named-area layer is
  published and no alias was added; the map keeps the whole-cru outline.
- **Rights.** DGFiP legal-entity file of 1 January 2025, joined by exact reference. Every
  recorded area matches the cadastre; no parcel has more than one holder.
- **Rights history and lineage** ([rights-history.json](rights-history.json)). Files for
  1 January 2019–2024 compared with 2025, and cadastre vintages 2019–2025 with the 2026
  geometry. One lineage passes the #411 rule: D0823 first appears in 2020 inside the retired D0097.
- **Official notices.** Both Côte-d'Or indexes were matched against the commune:
  - Regional bulletins 2019–2026 (#410): 17 notices mention Flagey or Échezeaux. Six were
    already image-reviewed. The other 11 were downloaded (hashes matched the index) and their
    parcel lists read from the page images for this issue. Only the three references above
    are Grands-Échezeaux parcels. Four of the 11 concern Flagey-lès-Auxonne or only an address.
  - Departmental bulletins 2016–2020 (#412): the one Flagey vineyard decision is in section A;
    every Grands-Échezeaux parcel is in section D.
  - Only image-reviewed rows entered the register.
- **Sales** ([sale-records.json](sale-records.json)). DVF+ April 2026 release: dates, deed
  types and references only.
- **Company filings.** Nine free filing indexes and 19 selected corporate PDFs (804 pages)
  were screened by text/OCR; relevant schedules, dates and lease recitals were read from
  page images. Four records name seven current parcels with matching cadastral areas:
  Mongeard GFA D0104/D0105/D0535, SEPV D0103, Anne Gros D0093 and Lamarche SCEA D0615/D0616.
  [Detailed readings](filings.md) link every selected PDF with page anchors, document/deposit
  dates and SHA-256 hashes. General lease powers, required leasing and planned terminations
  remain distinct from an executed lease.
- **Holders.** All nine leads were revisited. SEPV's 1994 vineyard contribution and completed
  capital resolutions strengthen the Drouhin link beyond shared management. Modot's
  statutory abbreviation and office establish a crosswalk to SIREN 778173500; Schenk group
  sources support a Villamont lead, labelled "via group". Its two parcels' recorded area,
  0.434 ha, matches a 2020 guide's 0.43 ha; no lease was found. The Lamarche contribution and
  reported 2022 Liger-Belair métayage are kept separate from the 2026 suspension. The rendered
  Romanée-Conti estate page states 3.5263 ha, resolving the browser access gap. Current estate
  sheets also strengthen Mongeard and Clos Frantin/Bichot. App domaine headings describe
  research context and retain **Research link · farming unverified**.
- **Independent research and holdings.** All seven Grands-Échezeaux vineyard articles linked
  from Winehog's Flagey index were read to their free-access boundary, plus the later
  Liger-Belair preview, a signed Jasper Morris comparison, estate/importer/merchant sources
  and the free Decanter vintage table. The free DRC aerial has no cadastral numbers. The
  Eugénie asset schedule prints literal **D11**, without an area or accepted lineage; it is
  not expanded to D0111. Millot's estate timeline says first harvest in 1986, while Winehog
  tentatively infers 1997; the conflict remains recorded. Old 1855/1892 owner lists are
  explicitly secondary transcriptions, not original-volume verification.

Details, sources and every parcel: [register](register.md) (generated from [curation](curation.json)).

## Limitations

- Private individuals are not in the legal-entity files: 13 parcels (2.06 ha) have no matched
  company record. That does not mean they have no owner.
- This Tier 2 review selects potentially useful filings; it does not read every corporate
  archive. Tier 3 (paid land-registry copies, outreach) remains deferred. Farming evidence
  and any verified operator link stay with #364; unresolved named-area/source gaps with #344.
- No source confirms actual parcel farming in 2026. Anne's bare ownership and retained
  usufruct, the intended old lease end, Lamarche's separate planned termination, SEPV/Modot
  operating leases and the Mongeard GFA tenant remain unresolved. No later outcome of the
  Liger-Belair suspension was found.
- Winehog's subscriber-only parcel details were not accessed. A Drouhin importer PDF returned
  403, and the live Vinous review returned a loading shell; free estate/Decanter sources
  were reviewed instead. Current holding areas for Kohut and Gros Frère et Sœur, and the
  conflicting published figures above, remain unresolved.
- The cru's edge along Vougeot is uncertain by a few metres: the INAO boundary and the cadastral
  commune line differ there (see the commune audit).
- Notices outside the regional (2019–2026) and departmental (2016–2020) bulletins were not
  searched. Lineage covers 2019–2026; DVF+ runs from January 2014 to November 2025 and names no party.

Source URLs, raw-byte hashes, exact UTC retrieval times, document dates and reviewed pages
are recorded in curation. Upload directories and wine vintages do not fill missing document
dates. Original PDFs are linked publicly and not committed. See the register's full access
gap list and the [filing inventory](filings.md) for the next evidence needed.

## Rebuild

```sh
python scripts/download_grand_cru_sources.py --cru grands-echezeaux      # shared Flagey bundle
python scripts/build_grand_cru_commune_audit.py --cru grands-echezeaux
python scripts/build_grand_cru_parcel_named_areas.py --cru grands-echezeaux
python scripts/build_grand_cru_rights_history.py --cru grands-echezeaux
python scripts/build_grand_cru_sale_records.py --cru grands-echezeaux
python scripts/build_grand_cru_research.py --cru grands-echezeaux        # add --check to verify
```
