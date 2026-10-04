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

Véraison: Grapevine Flowering Véraison model (Parker et al. 2013, Agric. For.
Meteorol. 180:249, Table 2): daily mean temperature above 0 °C from 1 March,
Pinot noir 2511, Chardonnay 2547.

Véraison temperature: the vineyard-elevation SAFRAN temperatures run cooler
than the weather stations the GFV model was fitted on. PHENOLOGY_OFFSET is
added to the daily mean in the véraison heat sum only. It was fitted on BIVB
mid-flowering dates only (Côte d'Or, 66 observations 1997-2025: bias 0, mean
error 3.9 days) and checked on BIVB mid-véraison dates it never saw (20
observations 2016-2025: bias -0.2 days, mean error 4.3 days; without it +7.8).
The sugar model gets no fixed offset. Instead anchor_sugar_curves() shifts each
season's curve to the sugar the BIVB measured (data/bivb_sugar.csv): on average
the model is close, but it reads low in hot, dry years (2020 Côte de Nuits
Pinot noir: about 50 g/L) because temperature alone misses berries
concentrating in drought.

Harvest: the recorded start where harvest_dates.csv has one (official ban or
opening, or a reported start); otherwise an estimate - the day Pinot noir
reaches the sugar level the area's recorded starts were picked at (median), or,
with too few records, the level whose 1991–2018 mean date at Beaune equals the
observed 1988–2018 mean start of 15 September (Labbé et al. 2019, Clim. Past
15:1485). Estimates are marked "estimated".

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

import numpy as np

import region

ROOT = Path(__file__).resolve().parents[3]
REGION = region.config()
DATA = REGION['data']
OUT = REGION['out']

BASELINE = (1991, 2020)
RAIN_FROM = 1997            # COMÉPHORE starts in 1997
FIRST_SEASON = 1959        # SAFRAN starts on 1 August 1958, so 1959 is the first whole season
LAPSE = 0.0065              # °C per metre
GRAPES = REGION['grapes']
PHENOLOGY_OFFSET = 1.1      # °C added to daily means in the véraison heat sum; see the docstring
SUGAR_SLOPE = 0.118         # g/L per °C·day near ripeness
# The measured-sugar shift builds up over this many days after véraison.
SUGAR_RAMP_DAYS = 20
SUGAR_GAP_FIT: dict[str, list[float]] = {}
CURVE_START, CURVE_STEP, CURVE_POINTS = (7, 15), 5, 22  # 15 July to 28 October: early véraison and late harvests (1965: to 25 October) stay on the curve
AREAS = REGION['areas']
# Villages read for noble rot (Sauternes and Barsac): those in the region's noble_rot_areas.
NOBLE_ROT_VILLAGES: set[str] = set()


def days(year: int, start: tuple[int, int], end: tuple[int, int]):
    day = dt.date(year, *start)
    stop = dt.date(year, *end)
    while day <= stop:
        yield day
        day += dt.timedelta(days=1)


def load_weather(cache: Path, points: list[dict]):
    """Per village: {date: {t, tmin, tmax, ssi, rain_safran, hu}} at vineyard elevation, and COMÉPHORE rain.
    hu (mean relative humidity, %) is NaN where a cached year predates it."""
    cells = {(c['x'], c['y']) for p in points for c in p['cells']}
    raw: dict[tuple[int, int], dict[dt.date, list[float]]] = {cell: {} for cell in cells}
    for path in sorted(cache.glob('safran_*.csv')):
        with open(path) as source:
            for row in csv.DictReader(source):
                key = (int(row['x']), int(row['y']))
                if key in raw:
                    date = dt.datetime.strptime(row['date'], '%Y%m%d').date()
                    raw[key][date] = [float(row['t']), float(row['tmin']), float(row['tmax']), float(row['ssi']), float(row['rain']),
                                      float(row.get('hu') or 'nan')]
    weather: dict[str, dict[dt.date, dict[str, float]]] = {}
    for point in points:
        dates = set.intersection(*(set(raw[(c['x'], c['y'])]) for c in point['cells']))
        series = {}
        for date in dates:
            values = [0.0] * 6
            for cell in point['cells']:
                shift = LAPSE * (cell['elevation'] - point['vineyardElevation'])
                v = raw[(cell['x'], cell['y'])][date]
                for i, value in enumerate([v[0] + shift, v[1] + shift, v[2] + shift, v[3], v[4], v[5]]):
                    values[i] += value * cell['weight']
            series[date] = dict(zip(['t', 'tmin', 'tmax', 'ssi', 'rain_safran', 'hu'], values))
        weather[point['id']] = series
    rain: dict[str, dict[dt.date, tuple[float, int]]] = defaultdict(dict)
    for path in sorted(cache.glob('rain_*.csv')):
        with open(path) as source:
            for row in csv.DictReader(source):
                rain[row['village']][dt.date.fromisoformat(row['date'])] = (float(row['rain']), int(row['hours']))
    return weather, rain


# Per village: COMÉPHORE ÷ SAFRAN rain over the years both cover. SAFRAN's 8 km
# rain is multiplied by it before 1997 (and for days COMÉPHORE has not yet
# published), so the vineyard's 1 km rain and its long record share one scale.
RAIN_SCALE: dict[str, float] = {}


def radar_rain(village: str, date: dt.date, rain) -> float | None:
    value = rain[village].get(date)
    return value[0] * 24 / value[1] if value and value[1] >= 20 else None


def rain_on(village: str, date: dt.date, weather, rain) -> float | None:
    """COMÉPHORE where the day is (nearly) complete; scaled SAFRAN rain otherwise."""
    radar = radar_rain(village, date, rain)
    if radar is not None:
        return radar
    day = weather[village].get(date)
    return day['rain_safran'] * RAIN_SCALE.get(village, 1.0) if day else None


def sugar_from_heat(heat: float, f200: float) -> float:
    linear = 200 + SUGAR_SLOPE * (heat - f200)
    return linear if linear <= 215 else 215 + 30 * (1 - math.exp(-(linear - 215) / 30))


def heat_sum(series, year: int, start: tuple[int, int], base: float, until: dt.date, normal_t, offset: float = 0.0) -> list[tuple[dt.date, float]]:
    """Cumulative degree days from `start`; days not yet in the record use the village's normal temperature."""
    total, out = 0.0, []
    for day in days(year, start, (until.month, until.day)):
        t = series[day]['t'] if day in series else normal_t(day)
        total += max(0.0, t + offset - base)
        out.append((day, total))
    return out


def first_day(cumulative: list[tuple[dt.date, float]], target: float) -> dt.date | None:
    return next((day for day, value in cumulative if value >= target), None)


def botrytis_infection(t: float, hu: float) -> float:
    """How favourable one day is for Botrytis to spread from berry to berry (0-1): the daily term
    of González-Domínguez et al. 2015 (PLoS ONE 10:e0140444, eq. 10) for fully susceptible ripe
    berries, from the day's mean temperature (°C) and mean relative humidity (%)."""
    teq = min(max(t / 30, 0.0), 1.0)
    warmth = (7.75 * teq ** 2.14 * (1 - teq)) ** 0.469 if 0 < teq < 1 else 0.0
    return min(warmth, 1.0) / (1 + math.exp(35.36 - 40.26 * hu / 100))


def noble_rot(village: str, year: int, weather, rain, harvest_start: dt.date) -> dict | None:
    """Sauternes' picking season, from the area's harvest start to 31 October, read for the
    alternation noble rot needs (Fournier et al. 2013; the Sauternes cahier des charges:
    "alternance d'humidité nocturne et de ventilation diurne"):
      nobleRotDays - dry days (under 1 mm, mean humidity under 80 %) that follow, within 5 days,
                     a day favourable to Botrytis (botrytis_infection 0.5 or more): the fungus has
                     set in and the berries then dry and concentrate;
      greyRotDays  - rain days (2 mm or more at a mean of 10 °C or more), when grey rot spreads.
    The thresholds were set before the outlook was tested and not tuned on it."""
    series = weather[village]
    span = [d for d in days(year, (harvest_start.month, harvest_start.day), (10, 31)) if d in series]
    if not span or any(math.isnan(series[d]['hu']) for d in span):
        return None
    rains = {d: rain_on(village, d, weather, rain) or 0.0 for d in span}
    favourable = [d for d in span if botrytis_infection(series[d]['t'], series[d]['hu']) >= 0.5]
    noble = sum(1 for d in span if rains[d] < 1 and series[d]['hu'] < 80
                and any(0 < (d - f).days <= 5 for f in favourable))
    grey = sum(1 for d in span if rains[d] >= 2 and series[d]['t'] >= 10)
    return {'nobleRotDays': noble, 'greyRotDays': grey, 'botrytisDays': len(favourable)}


def season_weather(village: str, year: int, weather, rain, harvest_start: dt.date | None = None) -> dict | None:
    series = weather[village]
    growing = [series.get(d) for d in days(year, (4, 1), (9, 30))]
    if any(day is None for day in growing):
        return None
    rains = [rain_on(village, d, weather, rain) for d in days(year, (4, 1), (9, 30))]
    sep = [rain_on(village, d, weather, rain) for d in days(year, (9, 1), (9, 30))]
    # Rain that swells berries and spreads rot at harvest: the week before the area's
    # harvest start and the picking fortnight from it.
    picking = [harvest_start + dt.timedelta(days=i) for i in range(-7, 14)] if harvest_start else []
    picking_rain = [rain_on(village, d, weather, rain) for d in picking if d in series]
    return {
        'gdd': round(sum(max(0.0, d['t'] - 10) for d in growing)),
        'rainAprSep': round(sum(r for r in rains if r is not None)),
        # Which record the season's rain mostly came from.
        'rainSource': '1km' if sum(1 for d in days(year, (4, 1), (9, 30)) if radar_rain(village, d, rain) is None) <= 10 else '8km',
        'augNights': round(mean(series[d]['tmin'] for d in days(year, (8, 1), (8, 31))), 1),
        'frostDays': sum(1 for d in days(year, (4, 1), (5, 15)) if series[d]['tmin'] <= 0),
        'heatDays': sum(1 for d in growing if d['tmax'] >= 30),
        'sepRain': round(sum(r for r in sep if r is not None)),
        **({'harvestRain': round(sum(r for r in picking_rain if r is not None))} if len(picking_rain) == len(picking) and picking else {}),
        **((noble_rot(village, year, weather, rain, harvest_start) or {}) if harvest_start and village in NOBLE_ROT_VILLAGES else {}),
    }


def grape_season(village: str, year: int, grape: str, weather, rain, harvest_start: dt.date | None, normal_t) -> dict:
    series = weather[village]
    params = GRAPES[grape]
    curve_end = dt.date(year, *CURVE_START) + dt.timedelta(days=CURVE_STEP * (CURVE_POINTS - 1))
    veraison_heat = heat_sum(series, year, (3, 1), 0.0, dt.date(year, 10, 31), normal_t, PHENOLOGY_OFFSET)
    veraison = first_day(veraison_heat, params['veraison']) or dt.date(year, 8, 31)
    sugar_heat = dict(heat_sum(series, year, (4, 1), 0.0, curve_end, normal_t))
    values = [round(sugar_from_heat(sugar_heat[dt.date(year, *CURVE_START) + dt.timedelta(days=CURVE_STEP * i)], params['sugar200']), 1)
              for i in range(CURVE_POINTS)]
    end = (harvest_start + dt.timedelta(days=7)) if harvest_start else veraison + dt.timedelta(days=45)
    span = [d for d in days(year, (veraison.month, veraison.day), (end.month, end.day)) if d in series]
    rains = [rain_on(village, d, weather, rain) for d in span]
    # Rain over this grape's own picking: the week before its harvest start and the fortnight from it.
    picking = [harvest_start + dt.timedelta(days=i) for i in range(-7, 14)] if harvest_start else []
    picking_rain = [rain_on(village, d, weather, rain) for d in picking if d in series]
    return {
        'veraison': veraison.isoformat(),
        'sugar': {'start': f'{CURVE_START[0]:02d}-{CURVE_START[1]:02d}', 'step': CURVE_STEP, 'values': values},
        'ripening': {
            'meanTemp': round(mean(series[d]['t'] for d in span), 1) if span else 0,
            'coolNights': round(sum(1 for d in span if series[d]['tmin'] < 13) / len(span), 2) if span else 0,
            'heatStressDays': sum(1 for d in span if series[d]['tmax'] >= 35),
            'rain': round(sum(r for r in rains if r is not None)),
            # Days grey rot can spread: at least 2 mm of rain on a day averaging 10 °C or more
            # (Botrytis infects from about 10 °C; a 12 °C cut missed half of cold, rotten 1965's rain days).
            'wetDays': sum(1 for d, r in zip(span, rains) if r is not None and r >= 2 and series[d]['t'] >= 10),
            # Daily mean, so a short ripening is not read as a dull one.
            'radiation': round(mean(series[d]['ssi'] for d in span) * .01, 1) if span else 0,
            **({'harvestRain': round(sum(r for r in picking_rain if r is not None))} if picking and len(picking_rain) == len(picking) else {}),
        },
    }


def sugar_ceiling(sugar: float) -> float:
    """Musts seldom pass 260 g/L (fewer than 1 in 1,000 BIVB Côte d'Or samples), so shifted curves level off."""
    return sugar if sugar <= 235 else 235 + 40 * (1 - math.exp(-(sugar - 235) / 40))


def curve_day(year: int, i: int) -> dt.date:
    return dt.date(year, *CURVE_START) + dt.timedelta(days=CURVE_STEP * i)


def curve_sugar(values: list[float], year: int, day: dt.date) -> float:
    position = (day - curve_day(year, 0)).days / CURVE_STEP
    i = min(max(int(position), 0), len(values) - 2)
    return values[i] + (values[i + 1] - values[i]) * min(max(position - i, 0.0), 1.0)


def anchor_sugar_curves(built: dict[str, tuple[dict, dict]], area_of: dict[str, str]) -> None:
    """Shift each season's modelled sugar curve to the sugar the BIVB measured.

    The temperature-only sugar model misses berries concentrating in drought: in
    2020 Côte de Nuits Pinot noir measured about 50 g/L above it. Where
    data/bivb_sugar.csv has samples for an area, grape and year taken at least
    SUGAR_RAMP_DAYS after véraison, the curve is shifted by their mean gap (the
    shift grows from nothing at véraison to the full gap SUGAR_RAMP_DAYS later).
    Elsewhere (other areas, years before 1988) the gap is estimated from the
    season's warmth and rain and the year (held at 1988 for earlier seasons),
    fitted on the measured seasons and tested on each one left out.
    """
    samples: dict[tuple[str, str, int], list[tuple[dt.date, float, int]]] = defaultdict(list)
    sugar_file = DATA / REGION.get('measured_sugar', 'bivb_sugar.csv')
    if not sugar_file.exists():
        return   # no measured sugar for this region yet: the curves stay as modelled
    with open(sugar_file) as source:
        for row in csv.DictReader(line for line in source if not line.startswith('#')):
            samples[(row['area'], row['grape'], int(row['year']))].append(
                (dt.date.fromisoformat(row['date']), float(row['sugar']), int(row['plots'])))
    members: dict[str, list[str]] = defaultdict(list)
    for village in built:
        members[area_of[village]].append(village)

    def season_mean(area: str, year: int, key: str) -> float | None:
        values = [built[v][0][year][key] for v in members[area] if year in built[v][0]]
        return mean(values) if values else None

    first_measured = min(year for _, _, year in samples)

    def climate(area: str, year: int) -> tuple[float, float, float] | None:
        base = [y for y in range(BASELINE[0], BASELINE[1] + 1) if season_mean(area, y, 'gdd') is not None]
        gdd, rain_total = season_mean(area, year, 'gdd'), season_mean(area, year, 'rainAprSep')
        if gdd is None or not base:
            return None
        normal_gdd = mean(season_mean(area, y, 'gdd') for y in base)
        normal_rain = mean(season_mean(area, y, 'rainAprSep') for y in base)
        # The gap also drifts upward with time (plant material, picking choices); before the
        # first measured year it is held at that year's level rather than extrapolated.
        weather = ((gdd - normal_gdd) / normal_gdd * 100, (rain_total - normal_rain) / normal_rain * 100)
        if not REGION.get('sugar_gap_drift', True):
            return weather   # too short a measured record to tell a drift from chance
        return (*weather, (max(year, first_measured) - 2000) / 10)

    measured: dict[tuple[str, str, int], float] = {}
    for (area, grape, year), rows in samples.items():
        villages = [v for v in members[area] if year in built[v][1]]
        if not villages:
            continue
        veraison = mean(dt.date.fromisoformat(built[v][1][year][grape]['veraison']).toordinal() for v in villages)
        gaps, weights = [], []
        for day, sugar, plots in rows:
            if day.toordinal() < veraison + SUGAR_RAMP_DAYS:
                continue
            model = mean(curve_sugar(built[v][1][year][grape]['sugar']['values'], year, day) for v in villages)
            gaps.append((sugar - model) * plots)
            weights.append(plots)
        if sum(weights) >= 3:
            measured[(area, grape, year)] = sum(gaps) / sum(weights)

    stand_in: dict[str, list[str]] = REGION.get('sugar_stand_in', {})
    applied: dict[tuple[str, str, int], tuple[float, str]] = {}

    def shift(grape: str, village: str, year: int, gap: float, source: str) -> None:
        season = built[village][1][year][grape]
        veraison = dt.date.fromisoformat(season['veraison'])
        season['sugar']['values'] = [
            round(sugar_ceiling(value + gap * min(max((curve_day(year, i) - veraison).days / SUGAR_RAMP_DAYS, 0.0), 1.0)), 1)
            for i, value in enumerate(season['sugar']['values'])]
        season['sugarSource'] = source

    for grape in GRAPES:
        if grape in stand_in or not any(g == grape for _, g, _ in measured):
            continue   # not sampled (Bordeaux whites): the curve stays as modelled
        fit_rows = [(climate(a, y), gap) for (a, g, y), gap in measured.items() if g == grape and climate(a, y)]
        x = np.array([[1.0, *features] for features, _ in fit_rows])
        target = np.array([gap for _, gap in fit_rows])
        coef, *_ = np.linalg.lstsq(x, target, rcond=None)
        held = []
        for i in range(len(target)):
            keep = np.arange(len(target)) != i
            c, *_ = np.linalg.lstsq(x[keep], target[keep], rcond=None)
            held.append(abs(target[i] - x[i] @ c))
        SUGAR_GAP_FIT[grape] = [float(c) for c in coef]
        # A gap the weather does not explain that drifts with time would bias the years before 1988.
        years_fit = [y for (a, g, y), _ in measured.items() if g == grape and climate(a, y)]
        drift = np.corrcoef(years_fit, target - x @ coef)[0, 1]
        print(f'{grape} sugar: {sum(1 for k in measured if k[1] == grape)} measured seasons; '
              f'mean gap {mean(target):+.1f} g/L; model alone misses by {mean(abs(target)):.1f}, '
              f'weather estimate by {mean(held):.1f} (held out); left-over gap vs year r={drift:.2f}')

        for village, (_, grapes_by_year) in built.items():
            area = area_of[village]
            for year, grapes in grapes_by_year.items():
                if grape not in grapes:
                    continue
                gap = measured.get((area, grape, year))
                source = 'measured'
                if gap is None:
                    features = climate(area, year)
                    gap = float(coef @ [1.0, *features]) if features else 0.0
                    source = 'weather'
                applied[(area, grape, year)] = (gap, source)
                shift(grape, village, year, gap, source)

    # A grape the network does not sample (Bordeaux: Cabernet Franc) takes the mean shift of the
    # grapes it ripens between; measured only when both of theirs were.
    for grape, others in stand_in.items():
        for village, (_, grapes_by_year) in built.items():
            area = area_of[village]
            for year, grapes in grapes_by_year.items():
                if grape not in grapes:
                    continue
                parts = [applied[(area, o, year)] for o in others]
                shift(grape, village, year, mean(g for g, _ in parts),
                      'measured' if all(src == 'measured' for _, src in parts) else 'weather')


def blend_season(parts: list[tuple[float, dict]]) -> dict:
    """One season of a blend: each grape's reading weighted by its share of the planting."""
    def weighted(read) -> float:
        return sum(w * read(season) for w, season in parts)
    veraison_day = weighted(lambda s: dt.date.fromisoformat(s['veraison']).toordinal())
    first = parts[0][1]
    ripening = {key: round(weighted(lambda s, k=key: s['ripening'][k]), 2 if key == 'coolNights' else 1)
                for key in first['ripening'] if all(key in s['ripening'] for _, s in parts)}
    ripening['heatStressDays'] = round(ripening['heatStressDays'])
    ripening['rain'] = round(ripening['rain'])
    if 'harvestRain' in ripening:
        ripening['harvestRain'] = round(ripening['harvestRain'])
    blend = {
        'veraison': dt.date.fromordinal(round(veraison_day)).isoformat(),
        'sugar': {**first['sugar'], 'values': [round(sum(w * s['sugar']['values'][i] for w, s in parts), 1)
                                               for i in range(len(first['sugar']['values']))]},
        'ripening': ripening,
    }
    sources = {s.get('sugarSource') for _, s in parts}
    if len(sources) == 1 and None not in sources:
        blend['sugarSource'] = sources.pop()
    return blend


def add_blends(built: dict[str, tuple[dict, dict]]) -> None:
    """Add each blend a place has a planted mix for (region.py blends: red 'blend', 'blend-white', 'blend-sweet')."""
    for village, (_, grapes_by_year) in built.items():
        for blend, mix in REGION['blends'].get(village, {}).items():
            shares = {g: w for g, w in mix.items() if g in GRAPES and w > 0}
            total = sum(shares.values())
            for grapes in grapes_by_year.values():
                grapes[blend] = blend_season([(w / total, grapes[g]) for g, w in shares.items()])


def vineyard_events() -> dict:
    """Frost and hail a source dates (data/vineyard_events.csv): an 8 km grid cannot see either."""
    events: dict[str, dict[str, list]] = {}
    path = DATA / 'vineyard_events.csv'
    if not path.exists():
        return events
    with open(path) as source:
        for row in csv.DictReader(line for line in source if not line.startswith('#')):
            entry = {'date': row['date'], 'type': row['type'], 'source': row['source']}
            if row.get('villages'):
                entry['villages'] = row['villages']
            events.setdefault(row['area'], {}).setdefault(row['year'], []).append(entry)
    return events


def doy_to_mmdd(doy: float, year: int = 2001) -> str:
    return (dt.date(year, 1, 1) + dt.timedelta(days=round(doy) - 1)).strftime('%m-%d')


def percentile(values: list[float], q: float) -> float:
    ordered = sorted(values)
    k = (len(ordered) - 1) * q
    low, high = math.floor(k), math.ceil(k)
    return ordered[low] + (ordered[high] - ordered[low]) * (k - low)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', default=str(REGION['cache']))
    args = parser.parse_args()
    villages = json.loads((DATA / 'villages.json').read_text())
    points = json.loads((DATA / 'points.json').read_text())
    weather, rain = load_weather(ROOT / args.cache, points)
    area_of = {v['id']: v['area'] for v in villages}
    NOBLE_ROT_VILLAGES.update(v for v, a in area_of.items() if a in REGION.get('noble_rot_areas', ()))
    for point in points:
        village = point['id']
        radar_total = grid_total = 0.0
        for date, value in weather[village].items():
            if 4 <= date.month <= 9 and date.year >= RAIN_FROM:
                radar = radar_rain(village, date, rain)
                if radar is not None:
                    radar_total += radar
                    grid_total += value['rain_safran']
        RAIN_SCALE[village] = radar_total / grid_total if grid_total else 1.0
    print('Rain scale (1 km ÷ 8 km), range', f"{min(RAIN_SCALE.values()):.2f}–{max(RAIN_SCALE.values()):.2f}")
    last_year = max(d.year for series in weather.values() for d in series)
    years = [y for y in range(FIRST_SEASON, last_year + 1)
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

    # --- Harvest: recorded where known, estimated from Pinot noir sugar otherwise.
    # harvest_dates.csv rows: area,year,date,type,source. "official-ban" and
    # "official-opening" are official; "reported-start" is a recorded start a
    # source reports without an official ban behind it.
    recorded: dict[tuple[str, int], tuple[dt.date, str]] = {}
    harvest_file = DATA / 'harvest_dates.csv'
    if harvest_file.exists():
        with open(harvest_file) as source:
            for row in csv.DictReader(row for row in source if not row.startswith('#')):
                kind = 'reported' if row.get('type') == 'reported-start' else 'official'
                recorded[(row['area'], int(row['year']))] = (dt.date.fromisoformat(row['date']), kind)

    # Each area's harvest is read from its own grape (region.py harvest_grape), over the
    # villages that grow it on that area's dates.
    def area_members(area: str) -> list[str]:
        grape = region.harvest_grape(area)
        return [p['id'] for p in points if grape in region.village_grapes(p['id']) and region.grape_area(area_of[p['id']], grape) == area]

    def pinot_heat(village: str, year: int):
        return heat_sum(weather[village], year, (4, 1), 0.0, dt.date(year, 10, 31), normal_t[village])

    def pinot_day(village: str, year: int, sugar: float, area: str) -> dt.date:
        target = GRAPES[region.harvest_grape(area)]['sugar200'] + (sugar - 200) / SUGAR_SLOPE
        # In the coldest seasons (Chablis 1972) the target is never reached: picking
        # still happened, so the estimate stops at the end of October.
        return first_day(pinot_heat(village, year), target) or dt.date(year, 10, 31)

    def pinot_sugar_on(village: str, year: int, date: dt.date, area: str) -> float:
        heat = dict(pinot_heat(village, year))
        return 200 + SUGAR_SLOPE * (heat[date] - GRAPES[region.harvest_grape(area)]['sugar200'])

    # Fallback: the sugar level at which the calibration village's 1991-2018 mean
    # estimated start equals its recorded long-run mean (Burgundy: Beaune, Labbé et al. 2019).
    beaune_sugar = 200.0
    if REGION['calibration']:
        calibration_village, calibration_doy = REGION['calibration']
        calibration_years = [y for y in years if BASELINE[0] <= y <= 2018]
        low, high = 170.0, 230.0
        for _ in range(30):
            middle = (low + high) / 2
            doys = [pinot_day(calibration_village, y, middle, area_of[calibration_village]).timetuple().tm_yday for y in calibration_years]
            low, high = (middle, high) if mean(doys) < calibration_doy else (low, middle)
        beaune_sugar = (low + high) / 2

    # Better, where dates are recorded: the sugar each area actually picked at,
    # read from its own recorded starts (median, so one odd year cannot move it).
    def median(values: list[float]) -> float:
        ordered = sorted(values)
        return ordered[len(ordered) // 2] if len(ordered) % 2 else (ordered[len(ordered) // 2 - 1] + ordered[len(ordered) // 2]) / 2

    picked_at: dict[str, list[float]] = defaultdict(list)
    picked_by_year: dict[str, dict[int, float]] = defaultdict(dict)
    for (area, year), (date, _) in recorded.items():
        members = area_members(area)
        if year in years and members:
            picked_by_year[area][year] = median([pinot_sugar_on(v, year, date, area) for v in members])
            picked_at[area].append(picked_by_year[area][year])
    everywhere = [value for values in picked_at.values() for value in values]
    harvest_sugar = {area: median(picked_at[area]) if len(picked_at[area]) >= 3
                     else median(everywhere) if len(everywhere) >= 5 else beaune_sugar for area in AREAS}
    for area in AREAS:
        print(f'{area}: {len(picked_at[area])} recorded starts; estimates use {harvest_sugar[area]:.1f} g/L')

    # Where growers have come to pick riper (Bordeaux: about 211 g/L of modelled Merlot sugar at
    # recorded starts before 2000, 220 since), an estimate reads the level recorded within
    # REGION['harvest_sugar_window'] years of its season, when at least five such starts exist.
    window = REGION.get('harvest_sugar_window')

    def sugar_for(area: str, year: int, leave_out: int | None = None) -> float:
        if window:
            near = [v for y, v in picked_by_year[area].items() if abs(y - year) <= window and y != leave_out]
            if len(near) >= 5:
                return median(near)
        if leave_out is not None and leave_out in picked_by_year[area]:
            rest = [v for y, v in picked_by_year[area].items() if y != leave_out]
            if len(rest) >= 3:
                return median(rest)
        return harvest_sugar[area]


    def area_doy(area: str, year: int, sugar: float) -> int:
        doys = sorted(pinot_day(v, year, sugar, area).timetuple().tm_yday for v in area_members(area))
        return doys[len(doys) // 2]

    def doy(date: dt.date) -> int:
        return date.timetuple().tm_yday

    # A second estimate for years when the Côte de Beaune start is recorded: that
    # date, plus the gap the weather predicts between the two areas at the same
    # sugar, plus the area's usual extra gap. In cold autumns sugar barely moves,
    # so a small difference in picking sugar turns into weeks; this avoids that.
    # Each area keeps whichever estimate was closer to its own recorded starts.
    for area in AREAS:
        held = [abs(doy(recorded[(area, y)][0]) - area_doy(area, y, sugar_for(area, y, leave_out=y if window else None))) for y in picked_by_year[area]]
        if held:
            print(f'{area}: estimates miss recorded starts by {mean(held):.1f} days ({"each year left out" if window else "in sample"})')
    anchor_area = REGION['anchor_area']
    anchor_sugar = harvest_sugar[anchor_area]

    def model_gap(area: str, year: int) -> int:
        return area_doy(area, year, anchor_sugar) - area_doy(anchor_area, year, anchor_sugar)

    anchor_bias: dict[str, float] = {}
    for area in AREAS:
        # Anchoring compares two areas at the same sugar, which only means the same thing for the same grape.
        if area == anchor_area or region.harvest_grape(area) != region.harvest_grape(anchor_area):
            continue
        both = [y for y in years if (area, y) in recorded and (anchor_area, y) in recorded]
        residual = {y: doy(recorded[(area, y)][0]) - doy(recorded[(anchor_area, y)][0]) - model_gap(area, y) for y in both}
        if not both:
            continue
        own_error, anchored_error = [], []
        for y in both:
            others = [value for other, value in residual.items() if other != y]
            actual = doy(recorded[(area, y)][0])
            own_error.append(abs(actual - area_doy(area, y, sugar_for(area, y, leave_out=y if window else None))))
            anchored_error.append(abs(actual - (doy(recorded[(anchor_area, y)][0]) + model_gap(area, y) + (median(others) if others else 0))))
        method = 'own sugar'
        if len(both) < 3 or mean(anchored_error) <= mean(own_error):
            anchor_bias[area] = median(list(residual.values()))
            method = f'{anchor_area} date'
        print(f'{area}: estimates from {method} (mean error {mean(own_error):.1f} own sugar, {mean(anchored_error):.1f} anchored, {len(both)} years)')

    harvest: dict[str, dict] = {}
    starts: dict[tuple[str, int], dt.date] = {}
    for area in AREAS:
        entry_years = {}
        for year in years:
            if (area, year) in recorded:
                date, kind = recorded[(area, year)]
                entry_years[str(year)] = {'date': date.isoformat(), 'source': kind}
            else:
                if area in anchor_bias and (anchor_area, year) in recorded:
                    day = doy(recorded[(anchor_area, year)][0]) + model_gap(area, year) + round(anchor_bias[area])
                else:
                    day = area_doy(area, year, sugar_for(area, year))
                date = dt.date(year, 1, 1) + dt.timedelta(days=day - 1)
                entry_years[str(year)] = {'date': date.isoformat(), 'source': 'estimated'}
            starts[(area, year)] = dt.date.fromisoformat(entry_years[str(year)]['date'])
        typical = mean(starts[(area, y)].timetuple().tm_yday for y in years if BASELINE[0] <= y <= BASELINE[1])
        harvest[area] = {'typical': doy_to_mmdd(typical), 'years': {y: e for y, e in entry_years.items() if int(y) >= FIRST_SEASON}}

    # --- Villages: the modelled seasons first, then the sugar curves anchored on measurements.
    OUT.mkdir(parents=True, exist_ok=True)
    written = []
    built: dict[str, tuple[dict, dict]] = {}
    for point in points:
        village, area = point['id'], area_of[point['id']]
        seasons, grapes_by_year = {}, {}
        for year in years:
            weather_year = season_weather(village, year, weather, rain, starts.get((area, year)))
            if weather_year is None:
                continue
            seasons[year] = weather_year
            grapes_by_year[year] = {g: grape_season(village, year, g, weather, rain, starts.get((region.grape_area(area, g), year)), normal_t[village])
                                    for g in region.village_grapes(village) if g in GRAPES}
        built[village] = (seasons, grapes_by_year)
    anchor_sugar_curves(built, area_of)
    add_blends(built)

    for point in points:
        village = point['id']
        seasons, grapes_by_year = built[village]
        base = [y for y in seasons if BASELINE[0] <= y <= BASELINE[1]]
        base_rain = [y for y in base if y >= RAIN_FROM]
        normal = {
            'gdd': round(mean(seasons[y]['gdd'] for y in base)),
            'rainAprSep': round(mean(seasons[y]['rainAprSep'] for y in base_rain)),
            'augNights': round(mean(seasons[y]['augNights'] for y in base), 1),
            'frostDays': round(mean(seasons[y]['frostDays'] for y in base), 1),
            'heatDays': round(mean(seasons[y]['heatDays'] for y in base)),
            'sepRain': round(mean(seasons[y]['sepRain'] for y in base_rain)),
            'harvestRain': round(mean(seasons[y]['harvestRain'] for y in base_rain if 'harvestRain' in seasons[y])),
            **{key: round(mean(seasons[y][key] for y in base if key in seasons[y]), 1)
               for key in ('nobleRotDays', 'greyRotDays', 'botrytisDays') if any(key in seasons[y] for y in base)},
            'grapes': {},
        }
        for grape in grapes_by_year[base[0]]:
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
                    'wetDays': round(mean(grapes_by_year[y][grape]['ripening']['wetDays'] for y in base_rain), 1),
                    'radiation': round(mean(r['radiation'] for r in ripening), 1),
                    'harvestRain': round(mean([grapes_by_year[y][grape]['ripening']['harvestRain'] for y in base_rain
                                               if 'harvestRain' in grapes_by_year[y][grape]['ripening']] or [0])),
                },
            }
        data = {'normal': normal, 'years': {str(y): {**seasons[y], 'grapes': grapes_by_year[y]} for y in seasons if y >= FIRST_SEASON}}
        (OUT / f'{village}.json').write_text(json.dumps(data, separators=(',', ':')))
        written.append(village)

    index = {
        'region': region.name(),
        'generatedAt': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'),
        'sample': False,
        'baseline': {'from': BASELINE[0], 'to': BASELINE[1], 'rainFrom': RAIN_FROM},
        'sources': [
            {'label': 'Rain', 'detail': 'Météo-France COMÉPHORE radar–gauge reanalysis, 1 km, hourly (Licence Ouverte Etalab 2.0). Days not yet published use SAFRAN.'},
            {'label': 'Temperature and sunshine', 'detail': 'Météo-France SAFRAN (SIM2) daily reanalysis, 8 km, corrected to each village’s vineyard elevation from IGN RGE ALTI.'},
            *REGION['sources'],
        ],
        'harvest': harvest,
        'events': vineyard_events(),
        **({'blends': REGION['blends']} if REGION['blends'] else {}),
        # Where a colour keeps its own harvest dates (Pessac-Léognan whites: 'dry-white').
        **({'colourAreas': REGION['colour_areas']} if REGION.get('colour_areas') else {}),
        'villages': written,
    }
    (OUT / 'index.json').write_text(json.dumps(index, separators=(',', ':')))
    print(f'Wrote {len(written)} villages, seasons {FIRST_SEASON}–{years[-1]}')


if __name__ == '__main__':
    main()
