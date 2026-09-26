# Burgundy regional maps

Reviewed 26 September 2026. Five geographic denominations are now mapped
**within Bourgogne AOC**, not five new AOCs or village appellations.
The existing 44 village maps and 33 Grand Cru appellations are unchanged.

| Denomination | INAO appellation / denomination | Producing communes | Allowed still-wine colours |
| --- | --- | ---: | --- |
| Bourgogne Côte d’Or | 138 / 2840 | 40 | Red, white |
| Bourgogne Hautes Côtes de Nuits | 138 / 364 | 19 | Red, white, rosé |
| Bourgogne Hautes Côtes de Beaune | 138 / 363 | 29 | Red, white, rosé |
| Bourgogne Côte Chalonnaise | 138 / 365 | 44 | Red, white, rosé |
| Bourgogne Côtes du Couchois | 138 / 1586 | 6 | Red only |

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
**49 source denomination IDs: five mapped, 44 pending**. Alternative source names
and colour variants sharing an ID do not increase that count.

All seven broad regional areas, nine other Bourgogne geographic denominations,
Mâcon-Villages and all 27 named Mâcon denominations remain pending. Mapping five
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
then verifies each mapped denomination's source name, CVI colour codes and complete commune set.
The first three maps use 40, 19 and 30 source rows respectively; Hautes Côtes de Beaune includes
two rows for one commune, giving 29 communes. Côte Chalonnaise uses 44 rows and
Couchois six, one per commune. Each has just one source-name
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

The published GeoJSON normally snaps to a **0.000001° grid (about 10 cm)** with
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

The five-entry runtime index is separate from the village registry; catalogues
and geometry load only when opening the dialog. Wine matching needs the explicit
designation in the appellation or wine name. Hautes Côtes aliases may omit
“Bourgogne”, as may the complete name “Côtes du Couchois”. “Côte d’Or” or “Côte
Chalonnaise” alone, a region field or a producer/cuvée alone does not identify its
regional designation. Accents, punctuation and AOC/AOP suffixes normalize.
Conflicting countries, regions, appellations, cru tiers, colours and non-still
products withhold the map rather than falling through to a nested village name.
No database classification is added: these wines remain unclassified in the
existing three-tier cru schema.

A region recorded as the **Côte d’Or** département (the wine canonicaliser stores
“cote dor” this way) is compatible with both the Côte de Nuits and the Côte de
Beaune, so village, Premier Cru and Grand Cru wines keep their maps and Atlas
links. It still conflicts with Chablis, the Côte Chalonnaise and the Mâconnais.
Likewise **Saône-et-Loire** covers the Côte Chalonnaise, the Mâconnais and
Maranges, and **Yonne** covers Chablis and the Grand Auxerrois villages (Irancy,
Saint-Bris, Vézelay). A département never matches appellations outside it.
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

The source-environment rebuild reproduces all seven files merged in PR #350
byte-for-byte, including Claude's six-decimal geometry, with the pinned dependency
versions. Those three map datasets remain unchanged in the second regional batch.

Unit tests cover regional matching, conflicts, colour rules, separation from
Beaune/Nuits village names, inventory reconciliation, every commune and closed
geometry rings. Browser tests run the real map renderer with the base map offline
on owner/shared pages at 320px and desktop widths, verify all production anchors
fit the initial view, navigate to a commune and back, and check lazy loading and
keyboard focus return. Existing village/Atlas tests remain regression coverage.

## Côte Chalonnaise and Couchois source review

The [BIVB Côte Chalonnaise sheet](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/gallery_files/site/321/402/57644/57654.pdf)
confirms red, white and rosé wines across 44 communes. INAO denomination **365**
has 44 source rows, all with CVI codes `1B315, 1R315, 1S315`. The whole regional
boundary is preserved, including the source area in Remigny; it is neither
clipped to existing village maps nor inferred from the larger commune outlines.
Its source area is **5,838.03 ha**, the delimited area rather than planted acreage.

The [BIVB Couchois page](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/bourgogne-cotes-du-couchois,2458,9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9MjQwJnw%3D)
and [INAO commune list](https://www.inao.gouv.fr/node/38303/printable/print) agree
on Couches, Dracy-lès-Couches, Saint-Jean-de-Trézy, Saint-Maurice-lès-Couches,
Saint-Pierre-de-Varennes and Saint-Sernin-du-Plain. Denomination **1586** has six
rows and the red-only code `1R362`; its full source area is **940.21 ha**.
The growers' [proposal for white wine recognition](https://www.cotesducouchois.com/demande-aoc-vins-blancs-bourgogne/)
does not supply an approved white designation or boundary. Explicit white/rosé
colour, style or label wording must therefore withhold this map. BIVB groups
Couchois under the Côte Chalonnaise wine region; both new maps also accept the
recorded département Saône-et-Loire. Neither accepts Côte d’Or.

### Precision and retained exclusions

Côte Chalonnaise fails the existing six-decimal hole gate: a **2.118226 m²**
excluded hole would close, alongside some smaller slivers. Its production feature
therefore uses the reviewed **0.0000001° grid (about 1 cm)** in configuration.
The maximum flagged hole is then **0.3063 m²**, no production part disappears,
and net area changes by **−7.286 m²**. Couchois passes the normal six-decimal grid,
with a maximum flagged hole of **0.3260 m²**, no disappeared production parts
and net area change **+88.936 m²**. Both retain the same strict **0.005% area**
and **sub-2 m² hole/part** gates. Commune outlines retain six decimals.
The pre-snap projection round-trip check remains separate from these published
precision checks. No safety threshold is raised to make a map pass.

### Producer label checks

- [Château de Chamilly](https://www.chateaudechamilly.com/les-vins/bourgogne-cote-chalonnaise/?lang=en):
  Bourgogne Côte Chalonnaise rouge.
- [Vignerons de Buxy](https://www.vigneronsdebuxy.fr/wp-content/uploads/2020/11/Bourgogne-Cote-Chalonnaise-Chardonnay-Buissonnier.pdf):
  Bourgogne Côte Chalonnaise Chardonnay **Buissonnier**, a white wine.
- [Domaine Lacour](https://domaine-lacour.fr/nos-vins/bourgogne-cotes-du-couchois-sous-le-clos/):
  Bourgogne Côtes-du-Couchois **Sous le Clos**, from Dracy-lès-Couches and
  Saint-Sernin-du-Plain, with the lieux-dits Promets / Sous le Clos. Its
  **Cuvée Amphore** also appears in the producer's wine list.
- [Château de Couches](https://www.chateaudecouches.com/fr_FR/oenotourisme):
  **Clos Marguerite – À la Folie** is the Couchois Pinot Noir; the same range
  includes Aligoté and white wines, so the producer or Clos Marguerite name alone
  cannot identify denomination 1586.

These labels select the whole denomination only when explicit appellation
evidence agrees. No parcel or producer-specific outline is added. The five
village appellations in the Côte Chalonnaise retain their existing maps; region
text alone never converts a Rully, Mercurey, Givry, Montagny or Bouzeron into
the regional denomination.
