# Burgundy village map pilot

Wine details and shared wine details offer **View village map** for mapped
Gevrey-Chambertin wines. The dialog shows neighbouring cru boundaries, highlights
the wine's matched INAO designation, and supports selection, pan/zoom, a village
overview and returning to the wine. Both the renderer and geometry load on demand.
The existing Burgundy Atlas link remains available.

## Coverage and meaning

- Nine Grand Cru designations, 26 named Premier Cru climats, the broad Premier
  Cru area, and the village appellation area: 37 wine features.
- Gevrey-Chambertin and Brochon commune outlines. Gevrey's village appellation
  includes land in Brochon, so the geometry is not clipped to one commune.
- Boundaries are INAO production areas, not producer ownership or proof that
  a particular bottle comes from one cadastral parcel.
- INAO areas overlap intentionally. Chambertin includes Clos de Bèze;
  Charmes-Chambertin and Mazoyères-Chambertin have the same production geometry
  in this source. These are retained, explained in the selection panel, and
  individually selectable. Do not turn them into disjoint vineyard shapes.
- Named village lieux-dits and individual cadastral parcel lines are not yet
  included. Other Burgundy villages retain their existing external Atlas links.
- The existing reviewed matching rules check geographic/tier conflicts and
  resolve named Premier Crus. A blend or unnamed Premier Cru falls back to its
  broad Premier Cru area, never to an invented single plot.

## Sources and reproduction

The generated catalogue records source URLs, snapshot dates, SHA-256 hashes,
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
- [OpenFreeMap](https://openfreemap.org/quick_start/): street-map context, with
  its source attribution retained in MapLibre. Boundaries and selection still
  work if the street-map service is unavailable.

Download the three exact URLs in `burgundyVillageMapCatalogue.json` into a local
temporary directory. Name the INAO archive `inao-2026-09-21.zip` and the commune
files `commune-21295.json.gz` and `commune-21110.json.gz`. Then:

```sh
python -m pip install -r scripts/burgundy-map-requirements.txt
python scripts/build_burgundy_village_map.py --source-dir .tmp/burgundy-map
```

The generator reprojects INAO EPSG:2154 coordinates to longitude/latitude,
unions records only within the same denomination, checks polygon validity,
and fails on unexpected coverage or an unmatched identity. It retains coordinate
precision and holes; no AI-generated, traced or approximate polygons are used.
Review regenerated files before publishing an update. Source archives and Python
dependencies are not shipped with the app.

`public/maps/gevrey-chambertin.2026-09-21.geojson` is about 673 KB uncompressed.
There are no database migrations, research/AI calls, API keys or background Atlas
requests. Only opening the dialog requests geography and the external base map.
The browser's public tile requests contain map locations, not wine records.

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
checks cover all 35 named crus, coverage in Brochon and intentional overlap.
