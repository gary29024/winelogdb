# Grands-Échezeaux parcels: Tier 1 research (#377)

Grands-Échezeaux (INAO `inao-denom-645`, 9.07 ha, commune 21267 Flagey-Échezeaux) is the
second cru through the generic pipeline ([rollout playbook](../../grand-cru-parcel-rollout.md)).
It shares the Flagey commune bundle with Échezeaux, so no source was downloaded twice. It is
validated on its own, and its research lives only in this folder.

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
| Parcels with holder or research leads | 17 (14 holder leads, 3 notice parcels) |
| Parcels with no lead | 15 |
| Verified farming links | 0 |
| Raw / gzip payload | Parcels: shared Flagey file, 239,882 / 35,324 bytes (unchanged). Evidence: 14,412 / 2,808 bytes |

Both files load only when "Parcel rights" is switched on. The parcel file is the one already
used for Échezeaux; Grands-Échezeaux adds only its evidence file.

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
- **Holders.** All nine were triaged from the official company search and the estates' own
  pages. Domaine headings in the app come only from those sources: "Registry identity only"
  (Romanée-Conti, Anne Gros, Albert Bichot) or "Estate source" (Mongeard-Mugneret, d'Eugénie).
  SEPV is shown only as a weak lead (shared management with the Drouhin family). The Lamarche
  SCEA and SCI Dom Veuve Paul Modot remain unresolved.

Details, sources and every parcel: [register](register.md) (generated from [curation](curation.json)).

## Limitations

- Private individuals are not in the legal-entity files: 13 parcels (2.06 ha) have no matched
  company record. That does not mean they have no owner.
- Tier 2 (company filings, leases, published holdings and articles) is tracked for every cru in
  #420; Tier 3 (land-registry copies, outreach) is deferred. Farming evidence and any verified
  operator link stay with #364; unresolved named-area and source gaps with #344.
- The Domaine de la Romanée-Conti Grands-Échezeaux page shows its figures only in a browser
  and was not read.
- The cru's edge along Vougeot is uncertain by a few metres: the INAO boundary and the cadastral
  commune line differ there (see the commune audit).
- Notices outside the regional (2019–2026) and departmental (2016–2020) bulletins were not
  searched. Lineage covers 2019–2026; DVF+ runs from January 2014 to November 2025 and names no party.

## Rebuild

```sh
python scripts/download_grand_cru_sources.py --cru grands-echezeaux      # shared Flagey bundle
python scripts/build_grand_cru_commune_audit.py --cru grands-echezeaux
python scripts/build_grand_cru_parcel_named_areas.py --cru grands-echezeaux
python scripts/build_grand_cru_rights_history.py --cru grands-echezeaux
python scripts/build_grand_cru_sale_records.py --cru grands-echezeaux
python scripts/build_grand_cru_research.py --cru grands-echezeaux        # add --check to verify
```
