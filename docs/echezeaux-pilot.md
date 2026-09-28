# Échezeaux named areas and cadastral parcels

This pilot advances #344 and #364 without closing either issue. It adds two
independent layers to the existing Vosne-Romanée / Flagey-Échezeaux map. The
official INAO features, wine identities and other village maps remain unchanged.

## What the map shows

| Layer | Coverage | Meaning |
| --- | --- | --- |
| Named areas | Ten cadastral lieux-dits within Échezeaux | Reviewed cadastral names, intersected with the INAO Échezeaux boundary |
| Parcels | 276 overlapping Échezeaux; 32 overlapping Grands-Échezeaux | Full, unchanged cadastral parcel geometry with separately measured cru overlap |
| Recorded rights | 138 parcels with a published legal-entity record; 170 without a match | DGFiP rights as of 1 January 2025, joined by exact cadastral reference |
| Farming domaines | Zero verified; zero proposed | No parcel-level operator relationship has yet met the evidence requirement |

The [BIVB appellation page](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/echezeaux,2458,9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9MzA2Jnw%3D)
lists eleven historical names, including **Les Beaux Monts Bas**, rather than
the “Hauts” originally listed in #344. The cadastral geometry is a named-area
display aid, not proof of an identical historical climat perimeter. For example,
the cadastral En Orveaux area clipped to Échezeaux measures about 8.01 ha; it must
not be represented as a surveyed historical climat or producer holding.

**Les Poulaillères remains unresolved.** The cadastral source says `LES POULA`;
no reviewed name crosswalk establishes equivalence. Its wine labels retain the
whole Échezeaux highlight. No proximity matching or gap filling is used.

Exact reviewed aliases select a named area only inside a proven Échezeaux wine
identity. Mixed names and ambiguous fields retain the parent cru. The Vosne
Premier Cru En Orveaux and Morey Grand Cru Clos Saint-Denis keep their existing
identities. Producer names alone never select holdings.

## Sources and transformations

- Cadastre Etalab commune `21267`, snapshot **2026-06-01**, `lieux_dits` and
  `parcelles` GeoJSON, Licence Ouverte 2.0.
- DGFiP *Fichiers des locaux et des parcelles des personnes morales*, rights
  snapshot **2025-01-01**, archive departments 01–56, member `PM_25_NB_210.csv`.
  The official catalogue was checked on 2026-09-28; 2025 was its latest listed
  release. The current 2025 ODT schema has 24 semicolon-separated columns.
- The existing canonical Vosne map supplies INAO features `565` and `645`.
  Both builders verify its committed source hash before using it.
- Exact URLs, SHA-256 checksums, dates and the ZIP member CRC are committed in
  `scripts/echezeaux-named-plots.json` and `scripts/echezeaux-parcels.json`.

Named areas are intersected in WGS84, retaining all polygon parts and holes.
No coordinate rounding, simplification, snapping or positive-area sliver removal
is applied. EPSG:2154 diagnostics check validity, containment and non-overlap.

Parcel geometry is copied unchanged. EPSG:2154 intersections measure overlap;
an overlap **greater than 1 m²** admits a parcel. All smaller positive contacts
are listed separately in `echezeaux-parcel-report.json`. This threshold suppresses
tiny edge contacts and is not a legal assertion about a parcel's inclusion in
the appellation. The cadastral recorded area and computed geometry area are
different quantities; the UI explicitly labels each.

The rights join zero-pads commune prefix, section and parcel number. It compares
the source's recorded parcel area against the cadastral `contenance`: this
snapshot has no mismatches. A matching reference and area establishes a join,
not continued ownership or unchanged geometry between 2025 and 2026. The report
lists commune rights references absent from the current geometry for refresh
review; it does not presume a particular split or merger.

Duplicate fiscal subdivisions are removed, but distinct right holders and
right codes are retained. `P`, `N` and `U`, for example, remain distinct rights
(ownership, bare ownership and usufruct). Original labels are preserved.
Identifiers beginning with `U` are DGFiP substitute identifiers, **not SIRENs**.
Missing published rights do not establish an ownerless parcel. Private persons,
sole traders and some single-member companies are outside this publication.

An operator link requires a reviewed stable producer ID, the reviewed spellings
of the producer field it applies to (`producerNames`), an effective date and
parcel-specific evidence. Producer records are per-user, so the map joins a
wine to a link by its producer field, as `burgundyProducerLocations` does. A
legal entity's name or SIREN alone does not prove who farms that land. Proposed
links never take the verified style or wording. No such links are populated in
this pilot; researching them remains in #364.

## Parcel rights panel

The **Parcel rights** switch sits directly under the vineyard card. Its keys
join the map's single legend, using the map's existing vocabulary:

| Mark | Meaning |
| --- | --- |
| Fine ink outline | Parcel with matched published legal-entity rights |
| Grey hatching | No matched rights record (not proof of no owner) |
| Deep ochre fill | Parcels of the right holder chosen from the list; others dim |
| Crimson fill | This wine's producer, **verified** link only |
| Dashed crimson outline | **Possible** match by name only, off by default |
| Ink outline with white casing | Selected parcel |

A share bar and a ranked right-holder list (overlap area and parcel count) replace the
holder and parcel dropdowns; a cadastral-reference finder remains for keyboard
use. The rights snapshot date and selected parcel's right types remain visible;
identifiers and additional source details sit behind *Record details* and *About
this data*. Each parcel counts once per holder even with multiple right codes;
areas measure parcel coverage, not ownership shares. Every selected operator
link displays its own status, effective date and evidence, independently of
the holder filter. Selecting a parcel or holder animates to it, capped at zoom 17, and
does not animate when reduced motion is requested.

**Possible matches** are an explicit, opt-in reading aid. They appear only when
the wine has a producer field and every distinctive word of it (ignoring legal
forms and words such as *domaine*, *fils* or *GFA*) occurs in a published
right holder's name, with at least two such words or one of six letters or more. They
are labelled “Possible match · name only”, are never shown as the operator, and
never alter the bottle's map identity. Possible-match counts include only
unverified parcels; another verified parcel held by the same entity does not
verify the rest. Producer names alone never establish holdings or named areas.

## Loading and size

The ten-name identity index participates in wine matching. Catalogue metadata
and geometry load only when the map opens. Parcel geometry and rights load only
after **Parcel rights** is switched on; failed parcel downloads have their own
retry and do not remove the cru map.

| Additional asset | Uncompressed bytes | Gzip-equivalent bytes |
| --- | ---: | ---: |
| Named areas | 37,133 | 12,207 |
| Parcels and rights | 239,882 | 35,324 |

These are reproducible payload measurements, not a claim about production
Content-Encoding. General caching and production performance work stays in
the #363 backlog. Size checks cap the gzip equivalents at 15 KB and 45 KB.

## Reproduce and refresh

Run from the repository root with Node and Python plus the pinned GIS packages:

```sh
python -m pip install -r scripts/burgundy-map-requirements.txt
node scripts/download_echezeaux_sources.mjs .tmp/echezeaux-sources
python scripts/test_echezeaux_parcels.py
python scripts/build_echezeaux_named_plots.py --source-dir .tmp/echezeaux-sources
python scripts/build_echezeaux_parcels.py --source-dir .tmp/echezeaux-sources
npx vitest run tests/unit/echezeauxPilot.test.ts tests/unit/burgundyVillageMap.test.ts
```

The downloader requests only Côte-d'Or's ZIP member using HTTP ranges, verifies
the pinned content hash, and writes fixed local filenames. It does not extract
archive paths or download the entire multi-department archive. Changed inputs
fail closed and require source review before hashes are updated.

On refresh, compare IDs, areas, geometry and every holder/right tuple against
the previous report. Review missing, split and merged references explicitly;
do not carry operator links to new IDs automatically. Review the eleven-name
crosswalk independently of geometric coverage. Re-run tests, inspect desktop
and narrow-screen maps, and review the new content hashes and payload budget.

Remaining work: verify Les Poulaillères; obtain parcel-specific operator
evidence and SIREN-to-producer mappings; expand to other Burgundy appellations.
The Chablis Premier Cru source-data and benchmark requirements in #344 remain
separate and unchanged.
