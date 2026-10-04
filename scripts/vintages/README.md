# Vintages data

The Vintages page reads static files from `public/data/vintages/<region>/`:

- `index.json` — region metadata, the typical and yearly harvest start for each area, and the data sources (`VintageIndex` in `src/features/vintages/types.ts`).
- `<village>.json` — one village's normal and every season (`VillageData`).

The files hold **measurements only** (degree days, millimetres, dates, sugar curves). Every reading on the page is derived from them in `src/features/vintages/model.ts`.

## Sources

| Measure | Source | Resolution |
| --- | --- | --- |
| Rain | Météo-France COMÉPHORE radar–gauge reanalysis, read at 25 points across each village's vineyard | 1 km, hourly, from 1997 |
| Temperature, sunshine | Météo-France SAFRAN (SIM2) daily reanalysis, four nearest cells, corrected to the vineyard's IGN elevation at 0.65 °C / 100 m | 8 km, daily, from August 1958 (whole seasons from 1959) |
| Sugar | Grapevine Sugar Ripeness model (Parker et al., 2020): 200 g/L at a temperature sum from 1 April of 2840 (Pinot Noir) / 2890 (Chardonnay) | per village |
| Véraison | Heat sum above 10 °C from 1 January of 1014 (Pinot Noir) / 1068 (Chardonnay) | per village |
| Harvest start | `data/harvest_dates.csv` where an official date is recorded; otherwise estimated and marked so | per area |

All Météo-France data is published under the Licence Ouverte (Etalab 2.0).

## Running it

```sh
pip install -r scripts/vintages/pipeline/requirements.txt
python scripts/vintages/pipeline/points.py    # once, or when villages change: sample points, elevations, SAFRAN cells
python scripts/vintages/pipeline/fetch.py     # downloads only what is missing (~40 min the first time)
python scripts/vintages/pipeline/build.py     # writes public/data/vintages/burgundy/
python scripts/vintages/pipeline/quality.py   # adds each season's quality outlook
```

The **Vintage data** GitHub Action runs `fetch.py` and `build.py` on the 6th of each month, keeps the downloaded history in the Actions cache, and commits any change. It can also be started by hand from the Actions tab.

## Official harvest dates

Add a row to `data/harvest_dates.csv` for each area and year with the source that states the date. That year then shows as official, and the page can say how much earlier or later than full ripeness picking began.

The Côte de Beaune rows for 1958–2018 are the observed Beaune series of Labbé et al. (2019), one consistent record for the whole period. Years without a row are estimated: either from the sugar level the area usually picks at, or from that year's Côte de Beaune date plus the gap the weather predicts between the two areas. `build.py` uses whichever was closer to the area's own recorded dates, and prints the comparison.

## Measured sugar

`data/bivb_sugar.csv` holds the must sugar the BIVB maturity network measured (maturite.bivb.com, reference and ODG plots): one row per area, grape and sampling date, averaged over the plots sampled that day. It covers the Côte de Nuits, Côte de Beaune and Hautes-Côtes from 1988.

`build.py` shifts each season's modelled sugar curve to these samples. The temperature-only model is close on average but reads low in hot, dry years (2020 Côte de Nuits Pinot noir: about 50 g/L), because it cannot see berries concentrating in drought. Seasons without samples (other areas, years before 1988) get a shift estimated from the season's warmth, rain and year. That estimate is fitted on the measured seasons, and the year is held at 1988 for earlier seasons. Its held-out error is about 10 g/L, against 14 for the model alone. Each grape season records `sugarSource: measured | weather`.

The file is not refreshed by the monthly Action. Add the new season's samples by hand after harvest, then re-run `build.py` and `quality.py`.

## Village list

`build_village_points.ts` writes both the app's village list (`src/features/vintages/burgundyVillages.ts`) and `data/villages.json` from the INAO boundaries in `public/maps`. Run it with `bun`, then re-run `points.py`.

`build_sample_dataset.ts` writes invented data in the same shape, for working on the screens without the pipeline.

## Quality outlook

`quality.py` turns each season's measurements into what they point to on the critics' 1–5 scale (Poor to Excellent). The measurements are ripeness over the appellation minimum, season warmth, heat stress, wet ripening days, harvest rain, recorded hail and, for Chardonnay, ripening warmth for acidity.
- Agronomy fixes which way each measurement may push quality. The critics' consensus only sets how much.
- Warmth helps only up to a cap (Pinot Noir +5%, Chardonnay +15% more heat than normal at the last run). A hotter season earns no more. The cap is chosen by held-out error, and chosen again inside each held-out fit.
- Every reported figure comes from a fit that left that year out.
- From 1991 each outlook is centred on the modern seasons' own average rating, and the weather's swing is scaled by what those years support, because growers now soften what the weather does. Better farming is measured this way rather than given an assumed shape (a 1975–2000 ramp was tried and made held-out results worse).
- The app reports the held-out error beside the error of simply guessing that era's average. Since 1991 the weather beats that guess only narrowly, and the page says so.
- Once a season is complete (1 November) and not yet rated, its Côte d'Or outlook is written to `data/outlook_record.csv` and never changed afterwards. Compared with critics' ratings as they appear, these rows are the one test no modelling choice has seen. The 2025 rows were recorded on 3 October 2026; the model has not used any 2025 ratings.

The consensus (`data/critic_consensus.csv`) comes from `consensus.py`. It averages several critics' published vintage ratings, each critic on its own scale and weighted by how well it agrees with the others. The individual ratings are not kept in the repository. To refresh it, run `consensus.py` on a new ratings table, then `quality.py`.
