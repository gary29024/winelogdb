# Vintages data

The Vintages page reads static files from `public/data/vintages/<region>/`:

- `index.json` — region metadata, the typical and yearly harvest start for each area, and the data sources (`VintageIndex` in `src/features/vintages/types.ts`).
- `<village>.json` — one village's normal and every season (`VillageData`).

The files hold **measurements only** (degree days, millimetres, dates, sugar curves). Every reading on the page is derived from them in `src/features/vintages/model.ts`.

## What is checked in today

`build_sample_dataset.ts` writes a **sample** with invented values in the real shape, so the screens can be reviewed. `index.json` says `"sample": true` and the page shows a "Sample data" badge.

```sh
bun scripts/vintages/build_village_points.ts   # village sampling points from the INAO maps
bun scripts/vintages/build_sample_dataset.ts   # the sample files
```

## The real pipeline (next)

A GitHub Action will replace the sample with real data for Burgundy:

| Measure | Source | Resolution |
| --- | --- | --- |
| Rain | Météo-France COMÉPHORE (radar + gauges), checked against rain gauges | 1 km, daily |
| Temperature | Météo-France SAFRAN, corrected for each village's elevation | 8 km, daily |
| Harvest start | Official start date per area; a modelled date marked `estimated` where none is published | per area |
| Sugar and véraison | Grapevine Sugar Ripeness and Flowering-Véraison models (Parker et al.) run on the daily temperatures | per village |

Other regions will use Open-Meteo where no national high-resolution record exists.
