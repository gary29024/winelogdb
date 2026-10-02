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


def clamp(score: float) -> float:
    return min(max(score, 1.0), 5.0)


def main() -> None:
    index = json.loads((OUT / 'index.json').read_text())
    villages = json.loads((DATA / 'villages.json').read_text())
    area_of = {v['id']: v['area'] for v in villages}
    consensus: dict[tuple[str, int], float] = {}
    sources: set[str] = set()
    with open(DATA / 'critic_consensus.csv') as source:
        for row in csv.DictReader(line for line in source if not line.startswith('#')):
            consensus[(row['colour'], int(row['year']))] = float(row['rating'])
            sources.update(s for s in row['sources'].split('|') if s)

    files = {v: json.loads((OUT / f'{v}.json').read_text()) for v in index['villages']}

    def season_inputs(village: str, year: str, grape: str) -> dict[str, float]:
        area = area_of[village]
        start = dt.date.fromisoformat(index['harvest'][area]['years'][year]['date'])
        events = index.get('events', {}).get(area, {}).get(year, [])
        return inputs(files[village], year, grape, start, events, GRAPES[grape][1])

    quality: dict = {'labels': LABELS, 'modernFrom': MODERN, 'sources': sorted(sources), 'grapes': {}}
    for grape, (colour, _, names) in GRAPES.items():
        fit_villages = [v for v in files if area_of[v] in FIT_AREAS]
        years = sorted(int(y) for y in files[fit_villages[0]]['years'] if (colour, int(y)) in consensus)
        # The Côte d'Or season: each input averaged over its villages.
        rows = [{k: st.mean(season_inputs(v, str(y), grape)[k] for v in fit_villages) for k in names} for y in years]
        target = [consensus[(colour, y)] for y in years]

        held_out = []
        for i in range(len(years)):
            model = fit(rows[:i] + rows[i + 1:], target[:i] + target[i + 1:], names)
            held_out.append(predict(model, rows[i]))

        def stats(sel: list[int]) -> dict:
            p, t = [held_out[i] for i in sel], [target[i] for i in sel]
            guess = [abs(st.mean(target[j] for j in range(len(years)) if j != i) - target[i]) for i in sel]
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
        model = fit(rows, target, names)
        validation = {'before': stats(old), 'since': stats(new), 'all': stats(list(range(len(years))))}
        quality['grapes'][grape] = {'colour': colour, 'weights': {k: round(w, 3) for k, w in model.items()}, 'validation': validation}
        print(f"{grape}: weights {quality['grapes'][grape]['weights']}")
        for label, s in validation.items():
            print(f"  {label}: {s}")

        # Reasons are measured from the average fitted season, so they say how this year differed.
        typical = {k: st.mean(row[k] for row in rows) for k in names}
        spread = {'before': validation['before']['spread'], 'since': validation['since']['spread']}
        held = dict(zip(years, held_out))
        for village, data in files.items():
            for year, season in data['years'].items():
                y = int(year)
                row = season_inputs(village, year, grape)
                # Fitted years use their held-out prediction plus this village's difference from the Côte d'Or.
                if y in held and area_of[village] in FIT_AREAS:
                    cote = {k: st.mean(season_inputs(v, year, grape)[k] for v in fit_villages) for k in names}
                    score = held[y] + predict(model, row) - predict(model, cote)
                else:
                    score = predict(model, row)
                width = spread['since' if y >= MODERN else 'before']
                contributions = sorted(((model[k] * (row[k] - typical[k]), k) for k in model if k not in ('intercept', 'practice')),
                                       key=lambda c: -abs(c[0]))
                drivers = [{'id': k, 'effect': 'helps' if c > 0 else 'hurts'} for c, k in contributions[:3] if abs(c) >= 0.15]
                season['grapes'][grape]['outlook'] = {
                    'score': round(clamp(score), 2),
                    'low': round(clamp(score - width), 2),
                    'high': round(clamp(score + width), 2),
                    'drivers': drivers,
                }

    for village, data in files.items():
        (OUT / f'{village}.json').write_text(json.dumps(data, separators=(',', ':')))
    index['quality'] = quality
    (OUT / 'index.json').write_text(json.dumps(index, separators=(',', ':')))
    print(f'Wrote outlooks for {len(files)} villages')


if __name__ == '__main__':
    main()
