"""Refresh data/bivb_sugar.csv from the BIVB maturity network (maturite.bivb.com).

Runs before build.py in the monthly Vintage data Action, so measured must sugar
arrives without a manual step. It downloads every Côte d'Or plot's samples for
the current and previous year (or the years given), averages them per area,
grape and day, and replaces those years' rows. Other years are kept as they are.
If the site cannot be reached the file is left unchanged.

    python scripts/vintages/pipeline/bivb.py [--years 2025 2026]
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import csv
import datetime as dt
import json
import sys
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path
from statistics import mean

ROOT = Path(__file__).resolve().parents[3]
FILE = ROOT / 'scripts/vintages/data/bivb_sugar.csv'
SITE = 'https://maturite.bivb.com'
HEADER = """# Must sugar measured by the BIVB's maturity-monitoring network (reference and ODG plots),
# published at maturite.bivb.com: one row per area, grape and sampling date, the mean over the
# plots sampled that day. build.py anchors each season's modelled sugar curve on these.
# Refreshed by bivb.py in the monthly Vintage data Action. sugar: g/L. plots: how many plots the mean covers.
"""
FIELDS = ['area', 'grape', 'year', 'date', 'sugar', 'plots']
GRAPES = {'PN': 'pinot-noir', 'CH': 'chardonnay'}
# Plots by commune. Arrière-côte and outlying plots (Nolay, Massingy, Bligny...) are left out:
# they ripen apart from the villages the page shows.
COTE_DE_NUITS = {'Couchey', 'Marsannay la Côte', 'Marsanay la Côte', 'Morey St Denis', 'Premeaux Prissey', 'Vosne Romanée'}
COTE_DE_BEAUNE = {'Auxey Duresses', 'Chassagne Montrachet', 'Meursault', 'Pernand Vergelesses', 'Pommard', 'Puligny Montrachet',
                  'Saint Romain', 'Santenay', 'Savigny les Beaune', 'Beaune', 'Volnay', 'Aloxe Corton'}
HAUTES_COTES = {'HCB', 'HCN', 'MAG1', 'NAN', 'N-CHC1'}
OUTLYING = {'CRM', 'NOL', 'MAS', 'BLI'}


def area_of(plot: dict) -> str | None:
    if plot['syN_CODE'] in HAUTES_COTES:
        return 'hautes-cotes'
    if plot['syN_CODE'] in OUTLYING:
        return None
    if plot['c_COMMUNE'] in COTE_DE_NUITS:
        return 'cote-de-nuits'
    if plot['c_COMMUNE'] in COTE_DE_BEAUNE:
        return 'cote-de-beaune'
    return None


def fetch(path: str, form: dict | None = None):
    data = urllib.parse.urlencode(form).encode() if form else None
    for attempt in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(SITE + path, data=data), timeout=60) as response:
                return json.load(response)
        except (OSError, ValueError):
            time.sleep(2 ** attempt)
    raise RuntimeError(f'{SITE}{path} did not answer')


def samples(plot: dict, year: int) -> list[tuple[str, str, int, str, float]]:
    area, grape = area_of(plot), GRAPES.get(plot['ceP_CODE'])
    rows = fetch('/Analyse/Read_Historique_Chart', {'codeParcelle': plot['paR_CODE'], 'annee': year})
    out = []
    for row in rows:
        if row.get('ANA_SUCRE') is None:
            continue
        # Dates are stored as UTC midnight-minus-two-hours; the local day is the next one.
        day = (dt.datetime.fromisoformat(row['ANA_DATE'].replace('Z', '+00:00')) + dt.timedelta(hours=2)).date()
        out.append((area, grape, year, day.isoformat(), float(row['ANA_SUCRE'])))
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    this_year = dt.date.today().year
    parser.add_argument('--years', type=int, nargs='+', default=[this_year - 1, this_year])
    years = parser.parse_args().years
    try:
        plots = [p for p in fetch('/Parcelle/GetParcelles')
                 if p['deP_LIB'] == "Côte d'Or" and area_of(p) and p['ceP_CODE'] in GRAPES]
        with cf.ThreadPoolExecutor(8) as pool:
            fetched = [s for batch in pool.map(lambda job: samples(*job), [(p, y) for p in plots for y in years]) for s in batch]
    except RuntimeError as error:
        print(f'BIVB maturity site unavailable ({error}); bivb_sugar.csv left unchanged.', file=sys.stderr)
        return

    by_day: dict[tuple[str, str, int, str], list[float]] = defaultdict(list)
    for area, grape, year, day, sugar in fetched:
        by_day[(area, grape, year, day)].append(sugar)
    with open(FILE) as source:
        kept = [row for row in csv.DictReader(line for line in source if not line.startswith('#')) if int(row['year']) not in years]
    fresh = [{'area': a, 'grape': g, 'year': str(y), 'date': d, 'sugar': f'{round(mean(v), 1)}', 'plots': str(len(v))}
             for (a, g, y, d), v in by_day.items()]
    rows = sorted(kept + fresh, key=lambda r: (r['area'], r['grape'], int(r['year']), r['date']))
    with open(FILE, 'w', newline='') as out:
        out.write(HEADER)
        writer = csv.DictWriter(out, fieldnames=FIELDS, lineterminator='\n')
        writer.writeheader()
        writer.writerows(rows)
    print(f'BIVB sugar: {len(plots)} plots, {len(fresh)} sampling days for {", ".join(map(str, years))}')


if __name__ == '__main__':
    main()
