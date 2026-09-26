# Burgundy regional maps

Reviewed 26 September 2026. This first regional batch maps three geographic
denominations **within Bourgogne AOC**, not three new AOCs or village appellations.
The existing 44 village maps and 33 Grand Cru appellations are unchanged.

| Denomination | INAO appellation / denomination | Producing communes | Allowed still-wine colours |
| --- | --- | ---: | --- |
| Bourgogne Côte d’Or | 138 / 2840 | 40 | Red, white |
| Bourgogne Hautes Côtes de Nuits | 138 / 364 | 19 | Red, white, rosé |
| Bourgogne Hautes Côtes de Beaune | 138 / 363 | 29 | Red, white, rosé |

The official BIVB sheets confirm these counts, colours and regional status:
[Côte d’Or](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/bourgogne-cote-d-or%2C2458%2C9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9Nzc0Jnw%3D),
[Hautes Côtes de Nuits](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/bourgogne-hautes-cotes-de-nuits%2C2458%2C9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9MjUwJnw%3D),
[Hautes Côtes de Beaune](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/bourgogne-hautes-cotes-de-beaune%2C2458%2C9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9MjQ4Jnw%3D).

## Coverage inventory

`scripts/burgundy-regional-map-coverage.json` tracks all seven regional AOCs:
Bourgogne, Bourgogne Aligoté, Bourgogne Mousseux, Bourgogne Passe-tout-grains,
Coteaux Bourguignons, Crémant de Bourgogne and Mâcon. The
[BIVB inventory](https://www.bourgogne-wines.com/professional-access/documents-photos%2C2334%2C9356.html)
also lists 14 Bourgogne geographic denominations and 27 named Mâcon denominations.
Together with the seven broad denominations and Mâcon-Villages, these account for
**49 source denomination IDs: three mapped, 46 pending**. Alternative source names
and colour variants sharing an ID do not increase that count.

All seven broad regional areas, 11 other Bourgogne geographic denominations,
Mâcon-Villages and all 27 named Mâcon denominations remain pending. Mapping three
Bourgogne denominations does not complete the Bourgogne AOC. Chablis Premier Cru
source gaps and other named plots remain tracked separately in
[issue #344](https://github.com/gary29024/winelogdb/issues/344).

## Boundary generation

`scripts/build_burgundy_regional_maps.py` uses the INAO **21 September 2026**
archive and Cadastre Etalab **June 2026** snapshots documented in
[the village map guide](burgundy-village-map.md#sources-and-reproduction).
The archive SHA-256 is
`6f84e0622c2a27d35fc1ad7b39629856bc5038aa38b9d629758c2fb873801d81`.
Every catalogue records the source URLs, dates, hashes and licences. There are
no third-party traced boundaries or extensions of the one-off La Moutonne policy.

Install `scripts/burgundy-map-requirements.txt`, cache the pinned INAO archive as
`.tmp/burgundy-map/inao-2026-09-21.zip`, and download every commune ID in
`scripts/burgundy-regional-maps.json` to `commune-{id}.json.gz` in that directory.
The URL pattern is:

```text
https://cadastre.data.gouv.fr/data/etalab-cadastre/2026-06-01/geojson/communes/{first-two-id-digits}/{id}/cadastre-{id}-communes.json.gz
```

Then run:

```sh
python -B scripts/build_burgundy_regional_maps.py --source-dir .tmp/burgundy-map
```

The builder verifies the full seven-AOC inventory against source names and IDs,
then verifies each pilot's source name, CVI colour codes and complete commune set.
There are 40, 19 and 30 source rows respectively; Hautes Côtes de Beaune includes
two rows for one commune, giving 29 communes. Each pilot has just one source-name
and colour-code variant, so all allowed colours use the same production boundary.
No geometry is clipped to the existing village maps or to a single department.

The archive's exact `.prj` WKT is used for projection. Excluded holes and
disconnected parts are retained. Côte d’Or's valid source
union develops a floating-point self-intersection at a touching ring after
projection near 4.8632224622, 47.0432220468. `make_valid` repairs only this reviewed
denomination; no buffer or simplification is used. For every map, inverse
projection and symmetric difference with the untouched source union must be
below **0.01 m²**. The measured difference for Côte d’Or is **0.00077693 m²**;
both Hautes Côtes maps are below 0.00000001 m². A different invalid denomination
or larger discrepancy fails the build before any output is written.

The published GeoJSON is then snapped to a **0.000001° grid (about 10 cm)** with
GEOS `set_precision`, which keeps topology valid where plain rounding would make
narrow rings cross. At regional and commune zoom this is invisible, and it cuts
the files from 5.1/0.9/1.8 MB to 3.0/0.6/1.2 MB (compressed: 1.9/0.3/0.7 MB to
0.8/0.16/0.33 MB) for Côte d’Or, Hautes Côtes de Nuits and Hautes Côtes de
Beaune. The builder fails unless the snapped area stays within 0.005% of the
source union (measured: +138 m², −224 m² and −4 m², all centimetre edge shifts),
and only sub-2 m² slivers between source parcels may close or disappear. No real
parcel or hole is lost. Stated areas below are computed before snapping.

Areas of 8,491.86 ha, 1,529.80 ha and 3,208.87 ha describe the INAO delimited
production geometry, not the smaller area actually planted or producing wine.

## Identity and display

The three-entry runtime index is separate from the village registry; catalogues
and geometry load only when opening the dialog. Wine matching needs the explicit
designation in the appellation or wine name. Hautes Côtes aliases may omit
“Bourgogne”; “Côte d’Or” alone, a region field or a producer/cuvée alone does not
identify Bourgogne Côte d’Or. Accents, punctuation and AOC/AOP suffixes normalize.
Conflicting countries, regions, appellations, cru tiers, colours and non-still
products withhold the map rather than falling through to a nested village name.
No database classification is added: these wines remain unclassified in the
existing three-tier cru schema.

A region recorded as the **Côte d’Or** département (the wine canonicaliser stores
“cote dor” this way) is compatible with both the Côte de Nuits and the Côte de
Beaune, so village, Premier Cru and Grand Cru wines keep their maps and Atlas
links. It still conflicts with Chablis, the Côte Chalonnaise and the Mâconnais.
See `src/lib/places/burgundyDepartments.ts`.

The map opens at the full production extent with a lower minimum zoom than the
village maps. “Zoom to a commune” frames the source production rows assigned to
that commune; the selected feature always remains the entire denomination.
Commune display names are reviewed against the French government
[geographic API](https://geo.api.gouv.fr/decoupage-administratif/communes), with
the exact department query URLs recorded in the configuration. Commune outlines
come from Cadastre; offline commune labels use representative
points in the INAO production geometry. “Region view” restores the overview and
resets the selector. The UI says “Regional denomination” and explains the broad
scope, including on shared wine pages. No individual producer holding is inferred.

Producer examples covered by regression tests:

- Méo-Camuzet **Étienne Camuzet**, Bourgogne Côte d’Or rouge, on the
  [producer's news page](https://www.meo-camuzet.com/en/actualites).
- Anne Gros **Cuvée Marine**, Hautes Côtes de Nuits blanc, on the
  [producer's wine page](https://www.anne-gros.com/en/products-category/hautes-cotes-de-nuits-blanc-en/).
- Méo-Camuzet **Clos Saint-Philibert**, Hautes Côtes de Nuits, described in
  [Jean-Nicolas Méo's producer presentation](https://www.nicolas-jay.com/wp-content/uploads/2024/01/Domaine-Meo-Camuzet-Who-We-Are-12-25-23.pdf).
- Etienne Sauzet **Jardin du Calvaire**, Hautes Côtes de Beaune blanc, listed by
  [its exclusive importer](https://www.libertywines.co.uk/our-portfolio/ES211-hautes-cotes-de-beaune-blanc-jardin-du-calvaire).

Each maps only with explicit denomination evidence. Bare “Marine”, “Clos
Saint-Philibert” or “Jardin du Calvaire” is not a new geometry or producer override.

## Verification

Unit tests cover regional matching, conflicts, colour rules, separation from
Beaune/Nuits village names, inventory reconciliation, every commune and closed
geometry rings. Browser tests run the real map renderer with the base map offline
on owner/shared pages at 320px and desktop widths, verify all production anchors
fit the initial view, navigate to a commune and back, and check lazy loading and
keyboard focus return. Existing village/Atlas tests remain regression coverage.
