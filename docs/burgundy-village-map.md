# Burgundy village maps

Wine details and shared wine details offer **View village map** for mapped
Gevrey-Chambertin, Morey-Saint-Denis, Chambolle-Musigny and Vosne-Romanée wines,
including the Grand Crus of Flagey-Échezeaux. The dialog shows neighbouring cru boundaries, highlights
the wine's matched INAO designation, and supports selection, pan/zoom, a village
overview and returning to the wine. The renderer, the selected village's catalogue
and its geometry load on demand; other village catalogues and boundaries stay unloaded.
The existing Burgundy Atlas link remains available.

## Coverage and meaning

| Village map | Grand Crus | Named Premier Crus | Broad areas | Wine features |
| --- | ---: | ---: | ---: | ---: |
| Gevrey-Chambertin | 9 | 26 | 2 | 37 |
| Morey-Saint-Denis | 5 | 20 | 2 | 27 |
| Chambolle-Musigny | 2 | 24 | 2 | 28 |
| Vosne-Romanée / Flagey-Échezeaux | 8 | 14 | 2 | 24 |

There are 115 distinct wine identities (107 named crus and eight broad areas).
Bonnes-Mares appears in the Morey and Chambolle maps and counts once in the identity registry.

- Gevrey-Chambertin and Brochon commune outlines. Gevrey's village appellation
  includes land in Brochon, so the geometry is not clipped to one commune.
- The Morey and Chambolle maps include both commune outlines.
  Bonnes-Mares (`inao-denom-361`) retains the same complete production boundary,
  identity and Atlas destination in both maps. A Bonnes-Mares wine opens the
  Chambolle map by default; it is also selectable when exploring Morey. This
  default is a navigation choice, not a claim about the bottle's commune of origin.
- The Vosne map includes Vosne-Romanée and Flagey-Échezeaux. Échezeaux and
  Grands-Échezeaux retain separate identities and geometry in Flagey. Les Beaux
  Monts and both broad Vosne areas retain their full extent across both communes.
  Flagey's En Orveaux and Les Rouges resolve under the Vosne-Romanée appellation.
- Boundaries are INAO production areas, not producer ownership or proof that
  a particular bottle comes from one cadastral parcel.
- INAO areas overlap intentionally. Chambertin includes Clos de Bèze;
  Charmes-Chambertin and Mazoyères-Chambertin have the same production geometry
  in this source. These are retained, explained in the selection panel, and
  individually selectable. Do not turn them into disjoint vineyard shapes.
- In the pinned snapshot, Échezeaux overlaps Les Beaux Monts by approximately
  3,962 m², plus small intersections with En Orveaux (1.77 m²) and Les Suchots
  (25.62 m²). The original production geometry remains unchanged for selection,
  outlines and hit testing. A separate `contextGeometry` on those three Premier
  Cru features excludes the overlapping Grand Cru area **only for overview
  colouring**. This avoids stacking tier colours; it is not a new delimitation
  or a claim about entitlement to either designation. Selection notes explain it.
- Named village lieux-dits and individual cadastral parcel lines are not yet
  included. Other Burgundy villages retain their existing external Atlas links.
- The existing reviewed matching rules check geographic/tier conflicts and
  resolve named Premier Crus. A blend or unnamed Premier Cru falls back to its
  broad Premier Cru area, never to an invented single plot.

## Sources and reproduction

Each generated catalogue records source URLs, snapshot dates, SHA-256 hashes,
INAO appellation and denomination IDs, commune IDs, label points, and extents.
Atlas contributes only the existing reviewed identity crosswalk and outbound
links; none of its map geometry or assets is copied.

- [INAO open boundary dataset](https://www.data.gouv.fr/datasets/delimitation-parcellaire-des-aoc-viticoles-de-linao):
  21 September 2026, Licence Ouverte. The published data is informational;
  [INAO's official delimitation plans](https://www.inao.gouv.fr/portail-plans-delimitation)
  remain the authoritative legal documents.
- [Cadastre Etalab](https://cadastre.data.gouv.fr/datasets/cadastre-etalab):
  June 2026 commune outlines, Licence Ouverte 2.0.
- [BIVB Gevrey Grand Crus reference](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/gallery_files/site/321/402/79294/79886.pdf):
  context for overlapping appellation areas.
- [BIVB Morey-Saint-Denis reference](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/gallery_files/site/321/402/79294/79794.pdf):
  the five Grand Crus and twenty Premier Cru climats.
- [BIVB Bonnes-Mares reference](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/bonnes-mares%2C2458%2C9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9MjI0Jnw%3D):
  its production area spans Morey-Saint-Denis and Chambolle-Musigny.
- [INAO Vosne-Romanée reference](https://www.inao.gouv.fr/en/node/663) and
  [BIVB Vosne-Romanée reference](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/gallery_files/site/321/402/57644/57720.pdf):
  two producing communes, eight Grand Crus and fourteen Premier Crus. BIVB uses
  the spelling "Les Petits Monts"; INAO's boundary snapshot and the Atlas registry
  use "Les Petis Monts". The display and reviewed matching alias use the former,
  while source names, IDs and Atlas destinations remain intact.
- [Domaine du Comte Liger-Belair](https://www.liger-belair.fr/nos-climats/)
  explicitly documents "Reignots" and "Raignots" as spelling alternatives.
  The wine matcher accepts "Aux Reignots" for Vosne's "Aux Raignots" entry,
  using the existing village and tier checks, without fuzzy matching.
- [OpenFreeMap](https://openfreemap.org/quick_start/): street-map context, with
  its source attribution retained in MapLibre. Boundaries and selection still
  work if the street-map service is unavailable.

Download the seven distinct source URLs recorded in the four catalogues
(`burgundyVillageMapCatalogue.json`, `moreyVillageMapCatalogue.json`,
`chambolleVillageMapCatalogue.json`, and `vosneVillageMapCatalogue.json`)
into a local temporary directory. Name the
INAO archive `inao-2026-09-21.zip` and the commune files `commune-21295.json.gz`,
`commune-21110.json.gz`, `commune-21442.json.gz`, `commune-21133.json.gz`,
`commune-21714.json.gz`, and `commune-21267.json.gz`. Then:

```sh
python -m pip install -r scripts/burgundy-map-requirements.txt
python scripts/build_burgundy_village_map.py --source-dir .tmp/burgundy-map
```

`scripts/burgundy-villages.json` is the reviewed map configuration: appellation
and denomination IDs, communes, name exceptions, overlap notes and shared-cru
defaults. `nameCrosswalk` maps an INAO name to a different Atlas name;
`displayNames` provides reviewed display spellings or shortens a name where INAO
records alternatives in one string (Chambolle's "Les Feusselottes ou Les Feusselotes"), while
`sourceName` and the Atlas lookup keep the full INAO name. The generator verifies the pinned INAO archive hash, refreshes extracted
members, reprojects INAO EPSG:2154 coordinates to longitude/latitude,
unions records only within the same denomination, checks polygon validity,
and fails on unexpected coverage or an unmatched identity. It retains coordinate
precision and holes; no AI-generated, traced or approximate polygons are used.
Review regenerated files before publishing an update. Source archives and Python
dependencies are not shipped with the app.

The generator also checks that any designation left unfilled is actually covered
by its designated same-tier fill. It validates all villages before writing output.
Reviewed cross-tier `contextExclusions` additionally check tier ordering, remaining
polygon validity and area conservation. Only derived overview geometry is cut;
the full production geometry is preserved alongside it in the same feature.
Shared designations are unioned across all source communes, never clipped to a
village boundary. The original Gevrey GeoJSON remains byte-for-byte unchanged.

The four GeoJSON files under `public/maps/` are approximately 673 KB (Gevrey),
290 KB (Morey), 329 KB (Chambolle), and 396 KB (Vosne/Flagey), uncompressed.
There are no database migrations, research/AI calls, API keys or background Atlas
requests. Only opening the dialog requests geography and the external base map.
The browser's public tile requests contain map locations, not wine records.

## Adding a village

Add reviewed IDs, commune context and exceptions to `scripts/burgundy-villages.json`,
download its pinned commune files, and regenerate. Register the catalogue's dynamic
import in `src/lib/places/loadVillageMapCatalogue.ts`. The generated
`burgundyVillageMapRegistry.json` is the compact wine-to-map index; the detailed
catalogues contain all rendering metadata, source dates and explanatory notes.
No village-specific rendering code is required. Add coverage and matching tests,
including repeated climat names, broad/blended wines and any shared designations.
Inspect source geometry and mobile layouts before publishing.

## Validation

```sh
npx vitest run tests/unit/burgundyVillageMap.test.ts tests/unit/burgundyAtlas.test.ts tests/unit/burgundyAtlasPremierCru.test.ts tests/unit/burgundyAtlasAppellation.test.ts
npx playwright test tests/e2e/burgundy-village-map.spec.ts tests/e2e/burgundy-atlas.spec.ts --project=chromium
npm run build
npm run lint
```

Browser coverage uses the real MapLibre renderer with the street map unavailable,
checking local geometry, selection, owner/shared parity, small-screen layouts,
load-on-demand, retry, Escape and focus restoration. The source import and unit
checks cover all 107 distinct named crus, coverage in Brochon and Flagey, intentional overlap,
identical Bonnes-Mares geometry in both contexts, and village-specific matches for
repeated names such as Les Gruenchers and La Romanée. They distinguish Échezeaux
from Grands-Échezeaux and verify reviewed Vosne spelling aliases and broad-area
fallbacks. Browser tests also exercise delayed successful
base-style loading and verify that opening a village never requests another map's
catalogue or geometry.
Boundary download failures offer an in-dialog retry. A failed catalogue module
offers a page reload, because browsers can cache a failed dynamic import.
