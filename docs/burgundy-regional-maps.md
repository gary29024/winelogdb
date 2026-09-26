# Burgundy regional maps

Reviewed 27 September 2026. Maps cover all fourteen geographic denominations
within Bourgogne AOC in the pinned source, plus fourteen within Mâcon AOC.
These remain regional denominations, not new AOCs or village appellations.
The existing 44 village maps and 33 Grand Cru appellations are unchanged.

| Denomination | INAO appellation / denomination | Producing communes | Allowed still-wine colours |
| --- | --- | ---: | --- |
| Bourgogne Côte d’Or | 138 / 2840 | 40 | Red, white |
| Bourgogne Hautes Côtes de Nuits | 138 / 364 | 19 | Red, white, rosé |
| Bourgogne Hautes Côtes de Beaune | 138 / 363 | 29 | Red, white, rosé |
| Bourgogne Côte Chalonnaise | 138 / 365 | 44 | Red, white, rosé |
| Bourgogne Côtes du Couchois | 138 / 1586 | 6 | Red only |
| Bourgogne Côtes d’Auxerre | 138 / 366 | 5 | Red, white, rosé |
| Bourgogne Chitry | 138 / 367 | 1 | Red, white, rosé |
| Bourgogne Coulanges-la-Vineuse | 138 / 368 | 7 | Red, white, rosé |
| Bourgogne Épineuil | 138 / 369 | 1 | Red, rosé |
| Bourgogne Côte Saint-Jacques | 138 / 374 | 1 | Red, white, rosé (including vin gris) |
| Bourgogne Tonnerre | 138 / 1751 | 6 | White only |
| Bourgogne La Chapelle Notre-Dame | 138 / 371 | 1 | Red, white, rosé |
| Bourgogne Le Chapitre | 138 / 372 | 1 | Red, white, rosé |
| Bourgogne Montrecul | 138 / 373 | 1 | Red, white, rosé |
| Mâcon Charnay-lès-Mâcon | 583 / 1721 | 1 | Red, white, rosé |
| Mâcon Davayé | 583 / 1723 | 1 | Red, white, rosé |
| Mâcon Fuissé | 583 / 2069 | 1 | White only |
| Mâcon Loché | 583 / 2070 | 1 | White only |
| Mâcon Solutré-Pouilly | 583 / 2072 | 1 | White only |
| Mâcon Vergisson | 583 / 1736 | 1 | White only |
| Mâcon Vinzelles | 583 / 2074 | 1 | White only |
| Mâcon Bussières | 583 / 1717 | 1 | Red, white, rosé; overview only |
| Mâcon Chaintré | 583 / 1719 | 3 | Red, white, rosé; overview only |
| Mâcon La Roche-Vineuse | 583 / 1725 | 3 | Red, white, rosé; overview only |
| Mâcon Milly-Lamartine | 583 / 1729 | 4 | Red, white, rosé; overview only |
| Mâcon Pierreclos | 583 / 1731 | 1 | Red, white, rosé; overview only |
| Mâcon Prissé | 583 / 1732 | 1 | Red, white, rosé; overview only |
| Mâcon Serrières | 583 / 1735 | 1 | Red, rosé |

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
**49 source denomination IDs: twenty-eight mapped, 21 pending**. Alternative source names
and colour variants sharing an ID do not increase that count.

All seven broad regional areas, Mâcon-Villages and 13 named Mâcon denominations
remain pending. Completing the fourteen Bourgogne geographic denominations does
not complete the broad Bourgogne AOC boundary. Chablis Premier Cru
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

The twenty-eight-entry runtime index is separate from the village registry; catalogues
and geometry load only when opening the dialog. Wine matching needs the explicit
designation in the appellation or wine name. Hautes Côtes aliases may omit
“Bourgogne”, as may the complete names “Côtes du Couchois” and “Côtes d’Auxerre”. “Côte d’Or” or “Côte
Chalonnaise” alone, a region field or a producer/cuvée alone does not identify its
regional designation. Accents, punctuation and AOC/AOP suffixes normalize.
Conflicting countries, regions, appellations, cru tiers, colours and non-still
products withhold the map rather than falling through to a nested village name.
Recorded colour and style must agree with one another, as well as the label.
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
For denominations in one commune, the dialog names that commune and omits the
redundant selector. It still opens on the production boundary, including the
small Côte Saint-Jacques hillside, rather than the entire administrative commune.

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

## Yonne source review

The third regional batch adds six denominations from the same pinned INAO
snapshot: 21 rows across 20 distinct communes (Épineuil also belongs to Tonnerre).
Each denomination has one source-name/CVI variant. Red/white/rosé share geometry
where those colours are allowed; the Épineuil and Tonnerre areas remain distinct.

| Denomination | Source CVI | Source communes | Delimited area (ha) |
| --- | --- | --- | ---: |
| Côtes d’Auxerre | `1B316, 1R316, 1S316` | Augy, Auxerre, Quenne, Saint-Bris-le-Vineux, Vincelottes | 1,307.49 |
| Chitry | `1B321, 1R321, 1S321` | Chitry | 301.17 |
| Coulanges-la-Vineuse | `1B356, 1R356, 1S356` | Charentenay, Coulanges-la-Vineuse, Escolives-Sainte-Camille, Jussy, Migé, Mouffy, Val-de-Mercy | 707.78 |
| Épineuil | `1R357, 1S357` | Épineuil | 383.47 |
| Côte Saint-Jacques | `1B355, 1R355, 1S355` | Joigny | 13.29 |
| Tonnerre | `1B375` | Dannemoine, Épineuil, Junay, Molosmes, Tonnerre, Vézinnes | 838.14 |

These are delimited production areas, not planted acreage. The BIVB sources
confirm the colour rules and regional status:
[Côtes d’Auxerre](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/gallery_files/site/321/402/79294/79316.pdf),
[Chitry](https://www.vins-bourgogne.fr/nos-vins-nos-terroirs/la-bourgogne-et-ses-appellations/gallery_files/site/321/402/57486/57510.pdf),
[Coulanges-la-Vineuse](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/bourgogne-coulanges-la-vineuse%2C2458%2C9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9MjQxJnw%3D),
[Épineuil](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/gallery_files/site/321/402/79294/79345.pdf),
[Côte Saint-Jacques](https://www.bourgogne-wines.com/our-wines-our-terroir/bourgogne-and-its-appellations/gallery_files/site/321/402/57644/57656.pdf),
and [Tonnerre](https://www.vins-bourgogne.fr/vins-et-terroirs/la-bourgogne-et-ses-appellations/bourgogne-tonnerre%2C2377%2C9170.html?args=Y29tcF9pZD0yMjA1JmFjdGlvbj12aWV3RmljaGUmaWQ9NDExJnw%3D).

### Côtes d’Auxerre commune discrepancy

Some promotional lists still give seven names, including Vaux and
Champs-sur-Yonne, even when their introductory text says five. The BIVB sheet
linked above says five; the [2023 approved specification, section IV.1.b](https://info.agriculture.gouv.fr/boagri/document_administratif-8ef8ee69-ebd9-41ce-b171-0c93f2b1b6f7/telechargement)
lists Augy, Auxerre, Quenne, Saint-Bris-le-Vineux and Vincelottes, matching all
five commune IDs in the September 2026 geometry. The map retains every source
polygon attributed to those IDs. It does not add a Champs-sur-Yonne polygon or
infer an extra production area from a promotional list or administrative border.
The commune names use the government Yonne query recorded in configuration.

### Precision and reproduction

Côte Saint-Jacques's small production area fails the normal six-decimal area
gate: −16.567 m², or −0.012462%. The configured seven-decimal grid reduces that
to **−1.236 m² (−0.000930%)**, with no lost production part or closed hole.
The other five maps pass at six decimals. Their net area differences are
**+101.487, −38.446, +70.654, +14.385 and +21.892 m²** for Côtes d’Auxerre,
Chitry, Coulanges-la-Vineuse, Épineuil and Tonnerre respectively. The largest
flagged closing hole is 0.7034 m² (Coulanges); no production part disappears.
All retain the unchanged 0.005% area and sub-2 m² hole/part gates. The separate
pre-snap projection round-trip differences are all below 0.000103 m².

All **23 generated regional files** reproduce byte-for-byte with the pinned
dependencies; the ten map/catalogue files from the first two batches remain
unchanged. Serialized production geometry was independently compared with the
source union projected and snapped at each configured grid. New files are
297/33/255/75/20/197 kB (gzip 84/10/71/21/6/57 kB), in the table's order.
Catalogues and boundaries still load on demand.

### Producer and identity checks

- [Goisot's Demeter certification listing](https://www.demeter.fr/adherents/s-c-e-v-jean-hugues-et-guilhem-goisot/)
  identifies the white Côtes d’Auxerre **Gondonne**. The
  [BIVB producer catalogue](https://www.vins-bourgogne.fr/accueil/bivb-a-votre-service/gallery_files/site/289/14602.pdf)
  also records red **Corps de Garde**.
- [Olivier Morin](https://olivier-morin.fr/) lists Chitry **Olympe** in white
  and **Vau du Puits** in red, separately from his Aligoté and Crémant.
- [Domaine du Clos du Roi](https://www.closduroi.com/le-domaine/) lists Coulanges
  **Chanvan** in red and **Charly** in white. The producer's Clos du Roi name
  must not select a similarly named Premier or Grand Cru.
- [Dominique Gruhier](https://domainedominiquegruhier.com/produit/bourgogne-epineuil-ame-des-dannots-2023)
  supplies the **L’Âme des Dannots** Épineuil example.
- [Alain Vignot](https://domaine-alain-vignot.com/) supplies Côte Saint-Jacques
  **Les Ronces**, **Vin Gris**, and a white blend that also includes Pinot Gris.
  Explicit `gris`/`vin gris` colour or style is treated as rosé only for this
  denomination. Appellation suffixes `Gris`/`Vin Gris` and label text `Vin Gris`
  participate in colour checks; the grape name `Pinot Gris` alone does not.
- [Famille Moutard](https://mag.famillemoutard.com/2-cuvees-parcellaires-en-bourgogne/)
  supplies Tonnerre **Vaumorillon**. The named cuvée remains at denomination scope.

Every example needs explicit denomination evidence. A bare producer, cuvée,
region, or `Tonnerre` in a wine name cannot select these maps. Chablis Montée de
Tonnerre and Gevrey Clos Saint-Jacques retain their existing identities. Wines
with contradictory colour/style, a cru classification, a different département,
or a second appellation withhold the regional map. No new producer illustration
or inner plot is added; the La Moutonne exception remains exclusive to that wine.

## La Chapelle Notre-Dame, Le Chapitre and Montrecul source review

The fourth regional batch completes the fourteen Bourgogne geographic
denominations in the pinned snapshot. These three small areas each have one
source row, one producing commune and a shared red/white/rosé production boundary.
The source codes retain all allowed colours even when a producer currently
offers only red wine. The areas below measure delimited land, not planted acreage.

| Denomination | Source CVI | Commune | Delimited area (ha) |
| --- | --- | --- | ---: |
| La Chapelle Notre-Dame (371) | `1B309 04, 1R309 04, 1S309 04` | Ladoix-Serrigny (21606) | 4.45 |
| Le Chapitre (372) | `1B309 05, 1R309 05, 1S309 05` | Chenôve (21166) | 5.03 |
| Montrecul (373) | `1B309 06, 1R309 06, 1S309 06` | Dijon (21231) | 15.99 |

The [BIVB La Chapelle Notre-Dame page](https://www.vins-bourgogne.fr/vins-et-terroirs/la-bourgogne-et-ses-appellations/bourgogne-la-chapelle-notre-dame%2C2377%2C9170.html?args=Y29tcF9pZD0yMjA1JmFjdGlvbj12aWV3RmljaGUmaWQ9NDA2Jnw%3D)
confirms Ladoix-Serrigny and the three colours. The
[BIVB Montrecul sheet](https://www.vins-bourgogne.fr/nos-vins-nos-terroirs/la-bourgogne-et-ses-appellations/gallery_files/site/321/402/57486/71027.pdf)
likewise covers Dijon and the three colours. INAO's full source name is
**Bourgogne Montrecul ou Montre-Cul ou En Montre-Cul**. These spellings, plus
BIVB's **Bourgogne En Montrecul**, resolve to the same denomination, not separate
plots. La Chapelle Notre-Dame accepts Côte de Beaune context; the other two accept
Côte de Nuits. All three accept the Côte d’Or département.

Montrecul (and its spellings) and La Chapelle Notre-Dame are site names unique to
their denominations, so an explicit plain Bourgogne appellation with that site
as the wine name (appellation “Bourgogne”, wine “Montre-Cul”) also opens the
map. Le Chapitre is excluded because the name is also a Marsannay wine and
the Clos du Chapitre premier crus; it needs the full “Bourgogne Le Chapitre”.

### Le Chapitre appellation transition

INAO still publishes the Bourgogne Le Chapitre denomination and its boundary
in the pinned snapshot; see also its [red product entry](https://inao.gouv.fr/produit/bourgogne-le-chapitre-rouge-24535).
[Jean Fournier's producer account](https://domaine-fournier.com/vins/bourgogne-le-chapitre-rouge/)
describes **Bourgogne Le Chapitre Vieilles Vignes** through 2018, then **Marsannay
Le Chapitre** from 2019 after reclassification, with young vines from Seloncourt
also contributing. That modern cuvée must not inherit the older regional outline.

The wine's explicit appellation controls the map. Bourgogne Le Chapitre opens
denomination 372 with a visible transition note; Marsannay Le Chapitre keeps the
existing broad Marsannay colour area because individual village lieux-dits lack
separate geometry. Vintage alone does not choose an appellation. Conflicting
Marsannay/Bourgogne Le Chapitre evidence withholds the map. No producer holding,
modern Le Chapitre outline or vintage boundary is inferred.

### Precision and reproduction

La Chapelle Notre-Dame and Montrecul pass the normal **0.000001° grid**:
net area changes are **−0.752 m² (−0.001688%)** and **−4.288 m² (−0.002682%)**.
Le Chapitre fails that grid's existing area gate at **+2.857 m² (+0.005683%)**.
Its reviewed **0.0000001° grid** reduces this to **−0.555 m² (−0.001105%)** and
retains the small hole that would otherwise close. At their configured precision,
all three retain every production part and excluded hole. The **0.005% area**
and **sub-2 m² hole/part** gates are unchanged. Separate pre-snap projection
round-trip differences are below **0.0000012 m²**; no validity repair is needed.

All **29 generated regional files** reproduce byte-for-byte with the pinned
dependencies. The **22 map/catalogue files** from earlier batches remain unchanged.
An independent audit compares the serialized production geometry exactly with
the source union projected using the archive's `.prj` and snapped at each
configured grid. New GeoJSON files are **21/14/41 kB** (gzip **6.2/4.2/12.0 kB**),
in the table's order, and still load on demand. Each dialog opens on its small
production area and names the single commune without a redundant selector.

### Producer and identity checks

- [Jean-Pierre Maldant's own shop](https://boutique.jeanpierre-maldant.fr/28-tous-les-vins)
  lists **Bourgogne « la chapelle Notre Dame »** alongside distinct Ladoix,
  Aloxe-Corton and Corton wines. Only the explicit regional name selects 371.
- Jean Fournier's old and new Le Chapitre labels exercise the transition above
  on both owner and shared wine pages.
- [Derey Frères](https://www.dereyf.com/fr/nos-vins/rouges) lists **Montre Cul**
  in Dijon. Its stated holding is smaller than the whole INAO denomination;
  the producer's boundary or acreage does not replace that production area.

Bare cuvée names, producer names and geography never infer these designations.
Montrecul aliases need the Bourgogne prefix. Ladoix, Chapelle-Chambertin and
Aloxe-Corton's Clos du Chapitre retain their distinct identities. Regression
tests also cover allowed colours, inconsistent colour/style, cru tiers, second
appellations, wrong départements, geometry, lazy loading and mobile/desktop views.

## Southern Mâcon source review

The first Mâcon batch adds seven geographic denominations of **Mâcon AOC (583)**.
It uses eight INAO source rows across seven current communes. Each map has one
production feature: no named cuvée or producer holding is drawn separately.

| Denomination | INAO ID | Current commune | Allowed colours | Delimited area (ha) |
| --- | ---: | --- | --- | ---: |
| Charnay-lès-Mâcon | 1721 | Charnay-lès-Mâcon (71105) | Red, white, rosé | 271.09 |
| Davayé | 1723 | Davayé (71169) | Red, white, rosé | 240.84 |
| Fuissé | 2069 | Fuissé (71210) | White | 342.09 |
| Loché | 2070 | Mâcon (71270) | White | 86.69 |
| Solutré-Pouilly | 2072 | Solutré-Pouilly (71526) | White | 292.96 |
| Vergisson | 1736 | Vergisson (71567) | White | 218.95 |
| Vinzelles | 2074 | Vinzelles (71583) | White | 60.01 |

The BIVB sheets corroborate the colours and producing places:
[Charnay-lès-Mâcon](https://www.vins-bourgogne.fr/nos-vins-nos-terroirs/la-bourgogne-et-ses-appellations/gallery_files/site/321/402/57486/65740.pdf),
[Davayé](https://www.vins-bourgogne.fr/vins-et-terroirs/la-bourgogne-et-ses-appellations/gallery_files/site/321/402/57486/65742.pdf),
[Fuissé](https://www.vins-bourgogne.fr/nos-vins-nos-terroirs/la-bourgogne-et-ses-appellations/gallery_files/site/321/402/57486/65743.pdf),
[Loché](https://www.vins-bourgogne.fr/nos-vins-nos-terroirs/la-bourgogne-et-ses-appellations/gallery_files/site/321/402/57486/65746.pdf),
[Solutré-Pouilly](https://www.vins-bourgogne.fr/nos-vins-nos-terroirs/la-bourgogne-et-ses-appellations/gallery_files/site/321/402/57486/65756.pdf),
[Vergisson](https://www.vins-bourgogne.fr/nos-vins-nos-terroirs/la-bourgogne-et-ses-appellations/gallery_files/site/321/402/57486/65758.pdf),
and [Vinzelles](https://www.vins-bourgogne.fr/nos-vins-nos-terroirs/la-bourgogne-et-ses-appellations/gallery_files/site/321/402/57486/65760.pdf).
The table measures the full source production geometry, not planted acreage.
It retains overlapping eligibility with higher appellations; it does not subtract
Pouilly-Fuissé or Saint-Véran land to imitate a promotional map's disjoint colours.
Loché's administrative outline is the current Mâcon commune, with an explicit
note and initial zoom on the much smaller Loché production area.

### Source names, CVI codes and precision

Fuissé's `Mâcon Fuissé` and `Mâcon Fuissé - blanc exclusif` rows have identical
geometry and identical white CVI codes (`1B370 34, 1B370 35`). Configuration
records the second label in `equivalentSourceNames`. The builder checks exact
topological equality per producing commune before accepting such a duplicate.
Its combined area stays 342.09 ha, with one denomination and one map feature.
This mechanism cannot silently combine different colour boundaries. Chaintré and three further `rouge exclusif` source sectors are now reviewed
separately in the western Mâcon batch below; they are not duplicate boundaries.

Each denomination's complete CVI string is pinned in configuration. Two `B`
codes still describe one allowed colour; the colour check now compares the set
of encoded colours while retaining the exact CVI-string check. All new source
and projected unions are valid without repair. The separate pre-snap inverse
projection symmetric differences are below **0.000035 m²**.

All seven pass the existing **0.000001° grid**, **0.005% area** and **sub-2 m²
hole/part** gates. In table order, net source-area changes after snapping are
**−1.339, −6.984, −59.866, +13.953, +11.476, +53.036 and +6.187 m²** (at most
0.002423%). The largest flagged closing hole is **0.8673 m²**, at Loché;
Davayé loses one **0.0062 m²** sliver. These remain below the existing limits;
no threshold is relaxed.

All **43 generated regional files** reproduce byte-for-byte with the pinned
dependencies; the **28 previously merged map/catalogue files** remain unchanged.
An independent audit matches every serialized production feature exactly to the
official source union projected with the archive's `.prj` and snapped at its
configured grid. The seven new GeoJSON files total **766 kB / 202 kB gzip**.
They and their catalogues remain lazy-loaded.

### Split labels and producer checks

Following the label feedback on #354, `baseAppellations` scopes a split name to
its own AOC: **Mâcon + Fuissé** or **Mâcon Blanc + Loché** can select a map.
A bare commune name, a producer, reference-only evidence, or **Bourgogne +
Fuissé** cannot infer a Mâcon denomination. Mâcon-Villages remains a distinct
pending designation. Complete competing appellations are checked before a site
name is stripped, so **Mâcon + Pouilly-Fuissé** cannot become Mâcon Fuissé by
removing the word Fuissé. Colour words on both sides of a split label must agree,
even when no colour or style is recorded. Cru, region and product guards remain.

A split site name must also stand on its own. Mâcon villages recur in estate,
co-operative and landmark names, so a village after *de/du/des*, *Château*,
*Domaine*, *Cave(s)*, *Cellier*, *Maison*, *Clos* or *Roche* (**Château-Fuissé**,
**Domaine de Fuissé**, **Cave de Charnay**, **Roche de Solutré**) is not treated
as the denomination; **Mâcon + Fuissé Vieilles Vignes** still selects the map.

- [Les Orfèvres du Vin's brochure](https://www.orfevresduvin.com/img/cms/Acces-rapide/Brochure%20A4%20V2.pdf)
  supplies **Mâcon Charnay Blanc / Rouge**, supporting the shortened Charnay alias.
- [Robert-Denogent's importer sheet](https://kermitlynch.com/files/DOMAINE%20ROBERT-DENOGENT.pdf)
  supplies **Mâcon-Fuissé Les Tâches** and **Mâcon-Solutré Clos des Bertillonnes**,
  supporting the shortened Solutré alias as well as full Solutré-Pouilly.
- [Marcel Couturier](https://domainemarcelcouturier.com/nos-vins/) lists
  **Mâcon-Loché Les Longues Terres**, separately from its Pouilly-Loché range.
  Its **Mâcon Aux Scellés** does not become Mâcon Loché from producer context.
- [La Soufrandière](https://www.bretbrothers.com/histoire.php) supplies
  **Mâcon-Vinzelles Le Clos de Grand-Père**. The named holding retains the whole
  denomination highlight; no approximate producer outline is introduced.

Unit tests cover all seven maps, split/full labels, shortened spellings, colours,
the duplicate source identity and nearby Pouilly village identities. Browser
tests exercise all seven on owner/shared pages in the exhaustive map matrix,
with a Mâcon overview and split-label journey also in the normal smoke suite.
This southern batch brought regional progress to **21/49**, including **7/27 named Mâcon denominations**.


## Western Mâcon source review

Reviewed 27 September 2026. Seven further denominations bring the mapped inventory
to **28/49**, including **14/27 named Mâcon denominations**. This counts denomination
overviews, not complete colour-specific boundaries or individual vineyards.

| Denomination | Producing communes | Overview (ha) | Published red-only sector (ha) |
| --- | --- | ---: | ---: |
| Bussières | Bussières | 213.45 | — |
| Chaintré | Chaintré, Chânes, Crêches-sur-Saône | 296.38 | 9.58 |
| La Roche-Vineuse | Chevagny-les-Chevrières, Hurigny, La Roche-Vineuse | 863.08 | 70.75 |
| Milly-Lamartine | Berzé-la-Ville, Berzé-le-Châtel, Milly-Lamartine, Sologny | 769.03 | 40.82 |
| Pierreclos | Pierreclos | 132.19 | — |
| Prissé | Prissé | 628.64 | 94.46 |
| Serrières | Serrières | 424.25 | — |

The pinned INAO rows and their complete CVI strings are checked against the
configuration. The [Mâcon specification, sections III and IV](https://www.vins-bourgogne.fr/nos-vins-nos-terroirs/la-bourgogne-et-ses-appellations/gallery_files/site/321/19990/20236.pdf)
supports these commune lists and allowed colours. BIVB also confirms
[Milly-Lamartine's four communes](https://www.vins-bourgogne.fr/vins-et-terroirs/la-bourgogne-et-ses-appellations/gallery_files/site/321/402/77490/77692.pdf),
[Chaintré's three colours](https://www.vins-bourgogne.fr/vins-et-terroirs/la-bourgogne-et-ses-appellations/gallery_files/site/321/402/77490/77680.pdf)
and [Serrières' red/rosé restriction](https://www.vins-bourgogne.fr/vins-et-terroirs/la-bourgogne-et-ses-appellations/gallery_files/site/321/402/77490/77698.pdf).
Areas above are source geometry measurements, not planted acreage.

### Colour scope and remaining verification

Four denomination IDs include a separate source name ending `rouge exclusif`.
These are retained as selectable **red-only sectors**, not silently treated as
equivalent source labels. Chaintré's sector is in Crêches-sur-Saône;
La Roche-Vineuse's covers all three producing communes; Milly-Lamartine's covers
Berzé-la-Ville and Milly-Lamartine; Prissé's is in Prissé. Each sector is checked
against its exact source name and commune set and stays within the combined
denomination overview. It does not represent the full area for red wine, and
neither recorded colour nor label text automatically selects it.

All six new three-colour denominations explicitly show **denomination overview**
scope. A white wine may open this geographic context, but the dialog does not
claim the highlight is its white-wine production area. Area exploration has
separate scope text and a return-to-wine control; commune navigation changes
the viewport without changing the selected area. Serrières continues to reject
white wines, even if its name appears in a label or split appellation.

[INAO's 2017 delimitation report, PDF page 57 / printed page 46](https://extranet.inao.gouv.fr/fichier/CNAOV-2017-417-CoteauxBourguignonsBourgogne.pdf)
describes the relation between named white Mâcon and Mâcon-Villages areas and
the wider red/rosé system. That general explanation is insufficient to establish
a current geometry crosswalk: the September 2026 layers do not consistently
coincide. For example, Bussières' denomination overview is 213.45 ha versus
146.13 ha for Mâcon-Villages in the same commune. Milly-Lamartine's overview
minus its red-only sector is 728.21 ha versus 569.54 ha for Mâcon-Villages in its
four communes. Conversely, Prissé's subtraction exactly equals that layer.
White-only Solutré-Pouilly, Vergisson and Vinzelles from the previous batch also
fail a blanket equality check. Therefore **no Mâcon-Villages substitution or
derived white/rosé area is published**. Reconcile current deposited plans with
these source layers before claiming complete colour-specific coverage. The
regional inventory's mapped status must not be read as completion of that work.

### Geometry, labels and validation

All eleven new production features (seven overviews and four sectors) are valid
without repair. Their pre-snap inverse-projection symmetric differences are
below **0.000057 m²**. The normal **0.000001°** coordinate grid passes the
existing 0.005% net-area and sub-2 m² hole/part gates except for Chaintré's small
red-only sector. Chaintré uses the reviewed **0.0000001°** grid for both features;
its sector changes net area by +0.4282 m² (0.000447%). No threshold is relaxed.
Across this batch the maximum absolute post-snap net-area change is 73.570 m²,
the largest flagged closing hole is 0.2512 m², and no disconnected part is lost.

All **57 generated regional files** reproduce byte-for-byte; all **42 prior
map/catalogue files** are unchanged. Independent comparisons match each new
serialized production feature exactly to its source union, projected using the
archive's `.prj` and snapped at its configured grid. The seven GeoJSON files
total **1,209,290 bytes / 325,395 bytes gzip**, loaded only when their map opens.

The estate-name guard from #357 is retained and exercised with all seven new
sites. Reviewed producer examples include [Merlin's La Roche-Vineuse Les Cras
and Vieilles Vignes](https://merlin-vins.com/fr/) and
[Lapalus' Mâcon-Pierreclos](https://vinslapalus.com/nos-vins/). These names select
the denomination overview; the cuvée name and producer never create a plot.
Tests cover all seven names, accent/hyphen variants, split Mâcon labels,
colour/style conflicts, producer/reference-only evidence and competing AOCs.
Browser coverage includes owner/shared pages, lazy loading, 320-pixel layouts,
desktop views, commune zoom, sector exploration and return-to-wine behaviour.
