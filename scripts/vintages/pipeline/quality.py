"""Quality outlook: what each season's weather points to, on the critics' scale.

Runs after build.py. It reads the built village files and
scripts/vintages/data/critic_consensus.csv (one consensus rating per year and
colour, averaged over several critics; see that file's header), and writes:

  index.json      'quality': the fitted weights, how they were tested, and sources
  <village>.json  years[y].grapes[g].outlook: {score, low, high, drivers}

How the model stays honest:
  - Every input is a measurement the page already shows (ripeness margin over
    the appellation minimum, season warmth, heat stress, wet ripening days,
    rain at harvest, recorded hail). Which way each one may push quality is
    fixed here by agronomy (SIGNS); the critics only set how much. A weight that
    comes out the wrong way round is dropped, never flipped.
  - 'practice' stands for better vineyard and cellar work (sorting, picking
    dates): 0 before 1975 rising to 1 by 2000. It may only raise quality.
  - From 1991 the weather's swing is scaled towards the modern average by the
    factor modern years support (fitted inside each held-out fit, so the test
    stays fair): growers now soften what the weather does.
  - Warmth helps only up to a cap: past it, a hotter season earns no more
    (vines stop gaining, and the hottest years were not rated better). The cap
    is picked from WARMTH_CAPS by held-out error, and picked again inside every
    held-out fit, so the test never sees the year it predicts.
  - Every year's outlook is reported from a fit that left that year out, and
    the error of those held-out predictions sets the range shown, separately
    for seasons before 1991 and from 1991.

    python scripts/vintages/pipeline/quality.py
"""
from __future__ import annotations

import csv
import datetime as dt
import json
import math
import statistics as st
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / 'scripts/vintages/data'
OUT = ROOT / 'public/data/vintages/burgundy'

GRAPES = {
    # grape: (critics' colour, appellation minimum sugar g/L, inputs)
    'pinot-noir': ('red', 180, ['ripeness', 'warmth', 'heat', 'wet', 'harvestRain', 'hail', 'practice']),
    'chardonnay': ('white', 178, ['ripeness', 'warmth', 'heat', 'wet', 'harvestRain', 'acidity', 'hail', 'practice']),
}
SIGNS = {'ripeness': 1, 'warmth': 1, 'heat': -1, 'wet': -1, 'harvestRain': -1, 'acidity': 1, 'hail': -1, 'practice': 1}
# The critics' ratings these villages answer to: they rate the Côte d'Or as a whole.
FIT_AREAS = {'cote-de-nuits', 'cote-de-beaune'}
MODERN = 1991
# Candidate warmth caps, in the warmth input's steps of 10% more heat than normal; None = no cap.
WARMTH_CAPS = [None, 0.5, 1.0, 1.5]
LABELS = ['Poor', 'Mixed', 'Good', 'Very good', 'Excellent']   # 1-5 on the consensus scale


def sugar_on(curve: dict, year: int, day: dt.date) -> float:
    month, d = map(int, curve['start'].split('-'))
    position = (day - dt.date(year, month, d)).days / curve['step']
    values = curve['values']
    if position <= 0:
        return values[0]
    if position >= len(values) - 1:
        return values[-1]
    i = int(position)
    return values[i] + (values[i + 1] - values[i]) * (position - i)


def inputs(village: dict, year: str, grape: str, harvest_start: dt.date, events: list, min_sugar: float) -> dict[str, float]:
    """One season's inputs, each scaled so one unit is a meaningful step."""
    season, normal = village['years'][year], village['normal']
    g, ng = season['grapes'][grape], normal['grapes'][grape]
    ripening, normal_ripening = g['ripening'], ng['ripening']
    y = int(year)
    picking = st.mean(sugar_on(g['sugar'], y, harvest_start + dt.timedelta(days=k)) for k in (0, 7, 14))
    return {
        'ripeness': (picking - min_sugar) / 20,                                         # per 20 g/L (~1.2% alcohol) above the minimum
        'warmth': (season['gdd'] - normal['gdd']) / normal['gdd'] * 10,                 # per 10% more heat over the season
        'heat': ripening['heatStressDays'] - normal_ripening['heatStressDays'],         # per extra day at 35 °C or more
        'wet': (ripening.get('wetDays', 0) - normal_ripening.get('wetDays', 0)) / 3,    # per 3 extra wet ripening days
        'harvestRain': ((season.get('harvestRain') or 0) - (normal.get('harvestRain') or 0)) / 30,  # per 30 mm at harvest
        'acidity': -(ripening['meanTemp'] - normal_ripening['meanTemp']),               # per °C cooler while ripening
        'hail': 1.0 if any(e['type'] == 'hail' for e in events) else 0.0,
        'practice': min(max((y - 1975) / 25, 0.0), 1.0),
    }


def fit(rows: list[dict], target: list[float], names: list[str]) -> dict[str, float]:
    """Least squares with each weight held to its agronomic sign: a wrong-way weight is dropped."""
    active = list(names)
    while True:
        a = np.array([[1.0] + [r[k] for k in active] for r in rows])
        b, *_ = np.linalg.lstsq(a, np.array(target), rcond=None)
        wrong = [k for k, w in zip(active, b[1:]) if w * SIGNS[k] < 0]
        if not wrong:
            return {'intercept': float(b[0]), **{k: float(w) for k, w in zip(active, b[1:])}}
        active.remove(wrong[0])


def predict(model: dict[str, float], row: dict[str, float]) -> float:
    return model['intercept'] + sum(w * row[k] for k, w in model.items() if k != 'intercept')


def capped(row: dict[str, float], cap: float | None) -> dict[str, float]:
    return row if cap is None else {**row, 'warmth': min(row['warmth'], cap)}


def clamp(score: float) -> float:
    return min(max(score, 1.0), 5.0)


def main() -> None:
    index = json.loads((OUT / 'index.json').read_text())
    villages = json.loads((DATA / 'villages.json').read_text())
    area_of = {v['id']: v['area'] for v in villages}
    consensus: dict[tuple[str, int], float] = {}
    counts: dict[tuple[str, int], int] = {}
    sources: set[str] = set()
    with open(DATA / 'critic_consensus.csv') as source:
        for row in csv.DictReader(line for line in source if not line.startswith('#')):
            if int(row['n_sources']) < 2:
                continue   # one critic is not a consensus
            consensus[(row['colour'], int(row['year']))] = float(row['rating'])
            counts[(row['colour'], int(row['year']))] = int(row['n_sources'])
            sources.update(s for s in row['sources'].split('|') if s)

    files = {v: json.loads((OUT / f'{v}.json').read_text()) for v in index['villages']}

    def season_inputs(village: str, year: str, grape: str) -> dict[str, float]:
        area = area_of[village]
        start = dt.date.fromisoformat(index['harvest'][area]['years'][year]['date'])
        events = index.get('events', {}).get(area, {}).get(year, [])
        return inputs(files[village], year, grape, start, events, GRAPES[grape][1])

    quality: dict = {'labels': LABELS, 'modernFrom': MODERN, 'sources': sorted(sources), 'grapes': {},
                     # The consensus itself, shown beside the outlook: rating and how many critics.
                     'consensus': {c: {str(y): [round(r, 2), counts[(c, y)]] for (cc, y), r in consensus.items() if cc == c} for c in ('red', 'white')}}
    for grape, (colour, _, names) in GRAPES.items():
        fit_villages = [v for v in files if area_of[v] in FIT_AREAS]
        years = sorted(int(y) for y in files[fit_villages[0]]['years'] if (colour, int(y)) in consensus)
        # The Côte d'Or season: each input averaged over its villages.
        rows = [{k: st.mean(season_inputs(v, str(y), grape)[k] for v in fit_villages) for k in names} for y in years]
        target = [consensus[(colour, y)] for y in years]

        def modern_scale(model: dict, sel: list[int], cap: float | None) -> tuple[float, float, float]:
            """Weather moves modern ratings less than it moved older ones: shrink its swing
            towards the modern average by the factor those years support (0-1)."""
            preds = [predict(model, capped(rows[j], cap)) for j in sel]
            mean_t, mean_p = st.mean(target[j] for j in sel), st.mean(preds)
            spread_p = sum((p - mean_p) ** 2 for p in preds)
            k = sum((p - mean_p) * (target[j] - mean_t) for p, j in zip(preds, sel)) / spread_p if spread_p else 0.0
            return mean_t, mean_p, min(max(k, 0.0), 1.0)

        def predict_held_out(cap: float | None, i: int, train: list[int]) -> float:
            model = fit([capped(rows[j], cap) for j in train], [target[j] for j in train], names)
            p = predict(model, capped(rows[i], cap))
            if years[i] >= MODERN:
                mean_t, mean_p, k = modern_scale(model, [j for j in train if years[j] >= MODERN], cap)
                p = mean_t + k * (p - mean_p)
            return p

        def choose_cap(sel: list[int]) -> float | None:
            """The warmth cap with the lowest held-out error over these years; no cap on a tie."""
            def error(cap: float | None) -> float:
                return st.mean(abs(predict_held_out(cap, i, [j for j in sel if j != i]) - target[i]) for i in sel)
            return min(WARMTH_CAPS, key=lambda cap: (round(error(cap), 6), cap is not None))

        held_out = []
        for i in range(len(years)):
            train = [j for j in range(len(years)) if j != i]
            held_out.append(predict_held_out(choose_cap(train), i, train))

        def stats(sel: list[int]) -> dict:
            p, t = [held_out[i] for i in sel], [target[i] for i in sel]
            # The fair comparison: guess the average of the same period's other years.
            guess = [abs(st.mean(target[j] for j in sel if j != i) - target[i]) for i in sel]
            errors = [abs(a - b) for a, b in zip(p, t)]
            return {
                'years': len(sel),
                'correlation': round(st.correlation(p, t), 2) if len(sel) > 2 and st.pstdev(p) and st.pstdev(t) else None,
                'error': round(st.mean(errors), 2),
                'errorIfAverage': round(st.mean(guess), 2),
                'withinOneStep': round(sum(e <= 1 for e in errors) / len(errors), 2),
                'spread': round(math.sqrt(st.mean((a - b) ** 2 for a, b in zip(p, t))), 2),
            }

        old = [i for i, y in enumerate(years) if y < MODERN]
        new = [i for i, y in enumerate(years) if y >= MODERN]
        cap = choose_cap(list(range(len(years))))
        model = fit([capped(r, cap) for r in rows], target, names)
        modern = modern_scale(model, new, cap)
        validation = {'before': stats(old), 'since': stats(new), 'all': stats(list(range(len(years))))}
        quality['grapes'][grape] = {'colour': colour, 'weights': {k: round(w, 3) for k, w in model.items()},
                                    'modernScale': round(modern[2], 2), 'warmthCap': cap, 'validation': validation}
        print(f"{grape}: warmth cap {cap}, weights {quality['grapes'][grape]['weights']}")
        for label, s in validation.items():
            print(f"  {label}: {s}")

        # Reasons are measured from the average fitted season, so they say how this year differed.
        typical = {k: st.mean(capped(row, cap)[k] for row in rows) for k in names}
        spread = {'before': validation['before']['spread'], 'since': validation['since']['spread']}
        held = dict(zip(years, held_out))
        # The outlook is only tested inside the range of seasons it was fitted on. A season
        # beyond it (2026: 44% more heat than normal) is read at the edge of that range and
        # flagged, rather than extrapolated along a straight line.
        tested = {name: (min(vals), max(vals)) for name in names
                  for vals in [[season_inputs(v, str(y), grape)[name] for v in fit_villages for y in years]]}

        def bounded(row: dict[str, float]) -> tuple[dict[str, float], list[str]]:
            out, beyond = dict(row), []
            for name, (lo, hi) in tested.items():
                if name == 'practice':
                    continue
                out[name] = min(max(row[name], lo), hi)
                # Flagged only when more than one input step past the range (10% more heat,
                # 20 g/L, 3 wet days, 30 mm...); a hair past the edge is not a new kind of season.
                if row[name] > hi + 1 or row[name] < lo - 1:
                    beyond.append(name)
            return out, beyond
        for village, data in files.items():
            for year, season in data['years'].items():
                y = int(year)
                row, beyond = bounded(season_inputs(village, year, grape))
                row = capped(row, cap)
                # Fitted years use their held-out prediction plus this village's difference from the Côte d'Or.
                k = modern[2] if y >= MODERN else 1.0
                if y in held and area_of[village] in FIT_AREAS:
                    cote = capped(bounded({k_: st.mean(season_inputs(v, year, grape)[k_] for v in fit_villages) for k_ in names})[0], cap)
                    score = held[y] + k * (predict(model, row) - predict(model, cote))
                elif y >= MODERN:
                    score = modern[0] + k * (predict(model, row) - modern[1])
                else:
                    score = predict(model, row)
                width = spread['since' if y >= MODERN else 'before']
                contributions = sorted(((k * model[name] * (row[name] - typical[name]), name) for name in model if name not in ('intercept', 'practice')),
                                       key=lambda c: -abs(c[0]))
                drivers = [{'id': name, 'effect': 'helps' if c > 0 else 'hurts'} for c, name in contributions[:3] if abs(c) >= 0.15]
                season['grapes'][grape]['outlook'] = {
                    'score': round(clamp(score), 2),
                    'low': round(clamp(score - width), 2),
                    'high': round(clamp(score + width), 2),
                    'drivers': drivers,
                    **({'beyondTested': beyond} if beyond else {}),
                }

    for village, data in files.items():
        (OUT / f'{village}.json').write_text(json.dumps(data, separators=(',', ':')))
    index['quality'] = quality
    (OUT / 'index.json').write_text(json.dumps(index, separators=(',', ':')))
    print(f'Wrote outlooks for {len(files)} villages')


if __name__ == '__main__':
    main()
