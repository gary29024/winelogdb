"""Turn the cached daily weather into the files the Vintages page reads.

Inputs (from points.py, safran.py, comephore.py):
  scripts/vintages/data/villages.json, points.json
  scripts/vintages/data/harvest_dates.csv   official harvest starts (optional rows)
  <cache>/safran_<year>.csv, <cache>/rain_<year>.csv

Output: public/data/vintages/burgundy/index.json and <village>.json, in the
shape of src/features/vintages/types.ts. The page derives every reading from
these measurements; nothing here decides wording.

Models
------
Temperature: SAFRAN's 8 km cells, inverse-distance weighted, corrected from the
cells' mean ground to the vineyard's own elevation at 0.65 °C per 100 m.

Sugar (Grapevine Sugar Ripeness model, Parker et al. 2020, Agric. For. Meteorol.
290:107902): 200 g/L is reached when the sum of daily mean temperature above
0 °C from 1 April reaches F*. F* for Pinot noir (2840) and Chardonnay (2890) is
read from Fig. 3 of van Leeuwen et al. 2019 (Agronomy 9:514), which plots the
published values. Other sugar levels are extrapolated at 0.118 g/L per °C·day,
the rate implied by that paper's own harvest offsets (+5 days ≈ +10 g/L,
+15 days ≈ +30 g/L at ~17 °C), flattening above 215 g/L.

Véraison: heat sum above 10 °C from 1 January (Duchêne/van Leeuwen et al.
2008, Heat requirements for grapevine varieties, VIIth Int. Terroir Congress):
Pinot noir 1014, Chardonnay 1068.

Harvest: the official start date where harvest_dates.csv has one; otherwise an
estimate - the day Pinot noir reaches the sugar level whose 1991–2018 mean date
at Beaune equals the observed 1988–2018 mean start, 15 September (Labbé et al.
2019, Clim. Past 15:1485) - marked "estimated".

    python scripts/vintages/pipeline/build.py [--cache scripts/vintages/cache]
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import math
from collections import defaultdict
from pathlib import Path
from statistics import mean

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / 'scripts/vintages/data'
OUT = ROOT / 'public/data/vintages/burgundy'

BASELINE = (1991, 2020)
RAIN_FROM = 1997            # COMÉPHORE starts in 1997
FIRST_SEASON = 1997
LAPSE = 0.0065              # °C per metre
GRAPES = {
    'pinot-noir': {'sugar200': 2840.0, 'veraison': 1014.0},
    'chardonnay': {'sugar200': 2890.0, 'veraison': 1068.0},
}
SUGAR_SLOPE = 0.118         # g/L per °C·day near ripeness
CURVE_START, CURVE_STEP, CURVE_POINTS = (8, 1), 5, 15
BEAUNE_MEAN_HARVEST_DOY = 258   # 15 September, Labbé et al. 2019, 1988–2018
AREAS = ['chablis-auxerrois', 'cote-de-nuits', 'hautes-cotes', 'cote-de-beaune', 'cote-chalonnaise', 'maconnais']


def days(year: int, start: tuple[int, int], end: tuple[int, int]):
    day = dt.date(year, *start)
    stop = dt.date(year, *end)
    while day <= stop:
        yield day
        day += dt.timedelta(days=1)


def load_weather(cache: Path, points: list[dict]):
    """Per village: {date: {t, tmin, tmax, ssi, rain_safran}} at vineyard elevation, and COMÉPHORE rain."""
    cells = {(c['x'], c['y']) for p in points for c in p['cells']}
    raw: dict[tuple[int, int], dict[dt.date, list[float]]] = {cell: {} for cell in cells}
    for path in sorted(cache.glob('safran_*.csv')):
        with open(path) as source:
            for row in csv.DictReader(source):
                key = (int(row['x']), int(row['y']))
                if key in raw:
                    date = dt.datetime.strptime(row['date'], '%Y%m%d').date()
                    raw[key][date] = [float(row['t']), float(row['tmin']), float(row['tmax']), float(row['ssi']), float(row['rain'])]
    weather: dict[str, dict[dt.date, dict[str, float]]] = {}
    for point in points:
        dates = set.intersection(*(set(raw[(c['x'], c['y'])]) for c in point['cells']))
        series = {}
        for date in dates:
            values = [0.0] * 5
            for cell in point['cells']:
                shift = LAPSE * (cell['elevation'] - point['vineyardElevation'])
                v = raw[(cell['x'], cell['y'])][date]
                for i, value in enumerate([v[0] + shift, v[1] + shift, v[2] + shift, v[3], v[4]]):
                    values[i] += value * cell['weight']
            series[date] = dict(zip(['t', 'tmin', 'tmax', 'ssi', 'rain_safran'], values))
        weather[point['id']] = series
    rain: dict[str, dict[dt.date, tuple[float, int]]] = defaultdict(dict)
    for path in sorted(cache.glob('rain_*.csv')):
        with open(path) as source:
            for row in csv.DictReader(source):
                rain[row['village']][dt.date.fromisoformat(row['date'])] = (float(row['rain']), int(row['hours']))
    return weather, rain


def rain_on(village: str, date: dt.date, weather, rain) -> float | None:
    """COMÉPHORE where the day is (nearly) complete; SAFRAN's rain where it is not yet published."""
    value = rain[village].get(date)
    if value and value[1] >= 20:
        return value[0] * 24 / value[1]
    day = weather[village].get(date)
    return day['rain_safran'] if day else None


def sugar_from_heat(heat: float, f200: float) -> float:
    linear = 200 + SUGAR_SLOPE * (heat - f200)
    return linear if linear <= 215 else 215 + 30 * (1 - math.exp(-(linear - 215) / 30))


def heat_sum(series, year: int, start: tuple[int, int], base: float, until: dt.date, normal_t) -> list[tuple[dt.date, float]]:
    """Cumulative degree days from `start`; days not yet in the record use the village's normal temperature."""
    total, out = 0.0, []
    for day in days(year, start, (until.month, until.day)):
        t = series[day]['t'] if day in series else normal_t(day)
        total += max(0.0, t - base)
        out.append((day, total))
    return out


def first_day(cumulative: list[tuple[dt.date, float]], target: float) -> dt.date | None:
    return next((day for day, value in cumulative if value >= target), None)


def season_weather(village: str, year: int, weather, rain) -> dict | None:
    series = weather[village]
    growing = [series.get(d) for d in days(year, (4, 1), (9, 30))]
    if any(day is None for day in growing):
        return None
    rains = [rain_on(village, d, weather, rain) for d in days(year, (4, 1), (9, 30))]
    sep = [rain_on(village, d, weather, rain) for d in days(year, (9, 1), (9, 30))]
    return {
        'gdd': round(sum(max(0.0, d['t'] - 10) for d in growing)),
        'rainAprSep': round(sum(r for r in rains if r is not None)),
        'augNights': round(mean(series[d]['tmin'] for d in days(year, (8, 1), (8, 31))), 1),
        'frostDays': sum(1 for d in days(year, (4, 1), (5, 15)) if series[d]['tmin'] <= 0),
        'heatDays': sum(1 for d in growing if d['tmax'] >= 30),
        'sepRain': round(sum(r for r in sep if r is not None)),
    }


def grape_season(village: str, year: int, grape: str, weather, rain, harvest_start: dt.date | None, normal_t) -> dict:
    series = weather[village]
    params = GRAPES[grape]
    curve_end = dt.date(year, *CURVE_START) + dt.timedelta(days=CURVE_STEP * (CURVE_POINTS - 1))
    veraison_heat = heat_sum(series, year, (1, 1), 10.0, dt.date(year, 10, 31), normal_t)
    veraison = first_day(veraison_heat, params['veraison']) or dt.date(year, 8, 31)
    sugar_heat = dict(heat_sum(series, year, (4, 1), 0.0, curve_end, normal_t))
    values = [round(sugar_from_heat(sugar_heat[dt.date(year, *CURVE_START) + dt.timedelta(days=CURVE_STEP * i)], params['sugar200']), 1)
              for i in range(CURVE_POINTS)]
    end = (harvest_start + dt.timedelta(days=7)) if harvest_start else veraison + dt.timedelta(days=45)
    span = [d for d in days(year, (veraison.month, veraison.day), (end.month, end.day)) if d in series]
    rains = [rain_on(village, d, weather, rain) for d in span]
    return {
        'veraison': veraison.isoformat(),
        'sugar': {'start': f'{CURVE_START[0]:02d}-{CURVE_START[1]:02d}', 'step': CURVE_STEP, 'values': values},
        'ripening': {
            'meanTemp': round(mean(series[d]['t'] for d in span), 1) if span else 0,
            'coolNights': round(sum(1 for d in span if series[d]['tmin'] < 13) / len(span), 2) if span else 0,
            'heatStressDays': sum(1 for d in span if series[d]['tmax'] >= 35),
            'rain': round(sum(r for r in rains if r is not None)),
            'radiation': round(sum(series[d]['ssi'] for d in span) * .01),
        },
    }


def doy_to_mmdd(doy: float, year: int = 2001) -> str:
    return (dt.date(year, 1, 1) + dt.timedelta(days=round(doy) - 1)).strftime('%m-%d')


def percentile(values: list[float], q: float) -> float:
    ordered = sorted(values)
    k = (len(ordered) - 1) * q
    low, high = math.floor(k), math.ceil(k)
    return ordered[low] + (ordered[high] - ordered[low]) * (k - low)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', default='scripts/vintages/cache')
    args = parser.parse_args()
    villages = json.loads((DATA / 'villages.json').read_text())
    points = json.loads((DATA / 'points.json').read_text())
    weather, rain = load_weather(ROOT / args.cache, points)
    area_of = {v['id']: v['area'] for v in villages}
    last_year = max(d.year for series in weather.values() for d in series)
    years = [y for y in range(BASELINE[0], last_year + 1)
             if all(dt.date(y, 9, 30) in weather[p['id']] for p in points)]

    # Normal daily temperature per village, to fill days not yet in the record.
    climatology: dict[str, dict[tuple[int, int], float]] = {}
    for village, series in weather.items():
        sums: dict[tuple[int, int], list[float]] = defaultdict(list)
        for day, values in series.items():
            if BASELINE[0] <= day.year <= BASELINE[1]:
                sums[(day.month, day.day)].append(values['t'])
        climatology[village] = {key: mean(v) for key, v in sums.items()}
    normal_t = {v: (lambda day, c=climatology[v]: c.get((day.month, day.day), c.get((day.month, min(day.day, 28)), 10.0))) for v in weather}

    # --- Harvest: official where known, estimated from Pinot noir sugar otherwise.
    official: dict[tuple[str, int], tuple[dt.date, str]] = {}
    harvest_file = DATA / 'harvest_dates.csv'
    if harvest_file.exists():
        with open(harvest_file) as source:
            for row in csv.DictReader(row for row in source if not row.startswith('#')):
                official[(row['area'], int(row['year']))] = (dt.date.fromisoformat(row['date']), row.get('source', ''))

    def pinot_day(village: str, year: int, sugar: float) -> dt.date | None:
        heat = heat_sum(weather[village], year, (4, 1), 0.0, dt.date(year, 10, 31), normal_t[village])
        target = GRAPES['pinot-noir']['sugar200'] + (sugar - 200) / SUGAR_SLOPE
        return first_day(heat, target)

    calibration_years = [y for y in years if y <= 2018]
    low, high = 170.0, 230.0
    for _ in range(30):
        middle = (low + high) / 2
        doys = [pinot_day('beaune', y, middle).timetuple().tm_yday for y in calibration_years]
        low, high = (middle, high) if mean(doys) < BEAUNE_MEAN_HARVEST_DOY else (low, middle)
    harvest_sugar = (low + high) / 2
    print(f'Estimated harvest starts when Pinot noir reaches {harvest_sugar:.1f} g/L (calibrated on Beaune {calibration_years[0]}–{calibration_years[-1]})')

    harvest: dict[str, dict] = {}
    starts: dict[tuple[str, int], dt.date] = {}
    for area in AREAS:
        members = [p['id'] for p in points if area_of[p['id']] == area]
        entry_years = {}
        for year in years:
            if (area, year) in official:
                date, _ = official[(area, year)]
                entry_years[str(year)] = {'date': date.isoformat(), 'source': 'official'}
            else:
                doys = sorted(pinot_day(v, year, harvest_sugar).timetuple().tm_yday for v in members)
                date = dt.date(year, 1, 1) + dt.timedelta(days=doys[len(doys) // 2] - 1)
                entry_years[str(year)] = {'date': date.isoformat(), 'source': 'estimated'}
            starts[(area, year)] = dt.date.fromisoformat(entry_years[str(year)]['date'])
        typical = mean(starts[(area, y)].timetuple().tm_yday for y in years if BASELINE[0] <= y <= BASELINE[1])
        harvest[area] = {'typical': doy_to_mmdd(typical), 'years': {y: e for y, e in entry_years.items() if int(y) >= FIRST_SEASON}}

    # --- Villages.
    OUT.mkdir(parents=True, exist_ok=True)
    written = []
    for point in points:
        village, area = point['id'], area_of[point['id']]
        seasons, grapes_by_year = {}, {}
        for year in years:
            weather_year = season_weather(village, year, weather, rain)
            if weather_year is None:
                continue
            seasons[year] = weather_year
            grapes_by_year[year] = {g: grape_season(village, year, g, weather, rain, starts.get((area, year)), normal_t[village]) for g in GRAPES}
        base = [y for y in seasons if BASELINE[0] <= y <= BASELINE[1]]
        base_rain = [y for y in base if y >= RAIN_FROM]
        normal = {
            'gdd': round(mean(seasons[y]['gdd'] for y in base)),
            'rainAprSep': round(mean(seasons[y]['rainAprSep'] for y in base_rain)),
            'augNights': round(mean(seasons[y]['augNights'] for y in base), 1),
            'frostDays': round(mean(seasons[y]['frostDays'] for y in base), 1),
            'heatDays': round(mean(seasons[y]['heatDays'] for y in base)),
            'sepRain': round(mean(seasons[y]['sepRain'] for y in base_rain)),
            'grapes': {},
        }
        for grape in GRAPES:
            curves = [grapes_by_year[y][grape]['sugar']['values'] for y in base]
            columns = list(zip(*curves))
            ripening = [grapes_by_year[y][grape]['ripening'] for y in base]
            ripening_rain = [grapes_by_year[y][grape]['ripening']['rain'] for y in base_rain]
            normal['grapes'][grape] = {
                'veraison': doy_to_mmdd(mean(dt.date.fromisoformat(grapes_by_year[y][grape]['veraison']).timetuple().tm_yday for y in base)),
                'sugar': {'start': f'{CURVE_START[0]:02d}-{CURVE_START[1]:02d}', 'step': CURVE_STEP, 'values': [round(mean(c), 1) for c in columns]},
                'sugarLow': [round(percentile(list(c), .1), 1) for c in columns],
                'sugarHigh': [round(percentile(list(c), .9), 1) for c in columns],
                'ripening': {
                    'meanTemp': round(mean(r['meanTemp'] for r in ripening), 1),
                    'coolNights': round(mean(r['coolNights'] for r in ripening), 2),
                    'heatStressDays': round(mean(r['heatStressDays'] for r in ripening), 1),
                    'rain': round(mean(ripening_rain)),
                    'radiation': round(mean(r['radiation'] for r in ripening)),
                },
            }
        data = {'normal': normal, 'years': {str(y): {**seasons[y], 'grapes': grapes_by_year[y]} for y in seasons if y >= FIRST_SEASON}}
        (OUT / f'{village}.json').write_text(json.dumps(data, separators=(',', ':')))
        written.append(village)

    index = {
        'region': 'burgundy',
        'generatedAt': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'),
        'sample': False,
        'baseline': {'from': BASELINE[0], 'to': BASELINE[1], 'rainFrom': RAIN_FROM},
        'sources': [
            {'label': 'Rain', 'detail': 'Météo-France COMÉPHORE radar–gauge reanalysis, 1 km, hourly (Licence Ouverte Etalab 2.0). Days not yet published use SAFRAN.'},
            {'label': 'Temperature and sunshine', 'detail': 'Météo-France SAFRAN (SIM2) daily reanalysis, 8 km, corrected to each village’s vineyard elevation from IGN RGE ALTI.'},
            {'label': 'Sugar', 'detail': 'Grapevine Sugar Ripeness model (Parker et al., 2020): 200 g/L at a temperature sum from 1 April of 2840 (Pinot Noir) and 2890 (Chardonnay).'},
            {'label': 'Véraison', 'detail': 'Heat sum above 10 °C from 1 January of 1014 (Pinot Noir) and 1068 (Chardonnay), after van Leeuwen et al. (2008).'},
            {'label': 'Harvest', 'detail': f'Official start where published; otherwise estimated as the day Pinot Noir reaches {harvest_sugar:.0f} g/L, calibrated on Beaune’s recorded 1988–2018 average start of 15 September (Labbé et al., 2019).'},
        ],
        'harvest': harvest,
        'villages': written,
    }
    (OUT / 'index.json').write_text(json.dumps(index, separators=(',', ':')))
    print(f'Wrote {len(written)} villages, seasons {FIRST_SEASON}–{years[-1]}')


if __name__ == '__main__':
    main()
