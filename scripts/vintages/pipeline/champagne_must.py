"""Refresh Champagne's measured must and harvest starts from the Union des Maisons de Champagne.

The UMC's "Caractéristiques du raisin" page (maisons-champagne.com) publishes, from a Google
Sheet, each year's mean potential alcohol and acidity at harvest per grape (Chardonnay, Pinot
Noir, Meunier; from 1959) and the harvest start date (one for Champagne from 1951, per grape
from 1987). This reads that sheet and writes:

  data/champagne/measured_sugar.csv  the mean must per grape, as sugar (potential alcohol x 16.83,
                                     the factor the page uses to show alcohol), dated to the middle
                                     of the picking fortnight (start + 7 days), for every
                                     sub-region: only Champagne-wide means are published.
  data/champagne/umc_harvest.csv     the harvest start per year and grape, as published (before
                                     1989 the sheet repeats the Champagne-wide start for Chardonnay).
  data/champagne/harvest_dates.csv   each sub-region's start: that of its leading grape (Pinot
                                     Noir, Meunier, Chardonnay; region.py harvest_grape), or the
                                     Champagne-wide start before 1989.

It runs before build.py in the monthly Vintage data Action. If the sheet cannot be read the
files are left unchanged.

    python scripts/vintages/pipeline/champagne_must.py
"""
from __future__ import annotations

import csv
import datetime as dt
import io
import re
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / 'scripts/vintages/data/champagne'
PAGE = 'https://maisons-champagne.com/fr/encyclopedies/vendanges-et-donnees/caracteristiques-du-raisin/'
AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
AREAS = ['montagne-de-reims', 'vallee-de-la-marne', 'cote-des-blancs', 'cote-des-bar']
LEADING = {'montagne-de-reims': 'pinot-noir', 'vallee-de-la-marne': 'meunier', 'cote-des-blancs': 'chardonnay', 'cote-des-bar': 'pinot-noir'}
FIRST_BY_GRAPE = 1989
GRAPES = {'chardonnay': ('chardonnay', 'ch'), 'pinot-noir': ('pinot noir', 'pn'), 'meunier': ('meunier', 'mn')}
SUGAR_PER_DEGREE = 16.83


def fetch(url: str) -> str:
    for attempt in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': AGENT}), timeout=90) as response:
                return response.read().decode('utf-8', 'ignore')
        except OSError:
            time.sleep(min(2 ** attempt, 30))
    raise RuntimeError(f'{url} did not answer')


def tabs() -> list[list[list[str]]]:
    """Every tab of the page's published workbook, as CSV rows."""
    page = fetch(PAGE)
    book = re.search(r'(https://docs\.google\.com/spreadsheets/d/e/[\w-]+)', page)
    if not book:
        raise RuntimeError('no published sheet on the page')
    listing = fetch(book.group(1) + '/pubhtml')
    gids = re.findall(r'gid=(\d+)', listing) or ['0']
    out = []
    for gid in dict.fromkeys(gids):
        out.append(list(csv.reader(io.StringIO(fetch(f'{book.group(1)}/pub?gid={gid}&single=true&output=csv')))))
    return out


def year_of(cell: str) -> int | None:
    try:
        year = int(float(cell))
    except ValueError:
        return None
    return year if 1900 < year < 2100 else None


def number(cell: str) -> float | None:
    try:
        return float(cell.replace(',', '.'))
    except ValueError:
        return None


def day_of(cell: str, year: int) -> dt.date | None:
    """'2021-08-25 00:00:00' or '25/08' or '08-25': the sheet keeps day and month; the year is the row's."""
    m = re.search(r'\d{4}-(\d{2})-(\d{2})', cell) or re.search(r'^(\d{2})-(\d{2})$', cell.strip())
    if m:
        return dt.date(year, int(m.group(1)), int(m.group(2)))
    m = re.search(r'(\d{1,2})/(\d{1,2})', cell)
    return dt.date(year, int(m.group(2)), int(m.group(1))) if m else None


def main() -> None:
    try:
        sheets = tabs()
    except RuntimeError as error:
        print(f'UMC sheet unavailable ({error}); Champagne must data left unchanged.', file=sys.stderr)
        return
    alcohol: dict[tuple[str, int], float] = {}
    starts: dict[tuple[str, int], dt.date] = {}
    for rows in sheets:
        text = ' '.join(' '.join(r) for r in rows[:3]).lower()
        if 'alcool' in text and 'acidit' in text and len(rows) > 2:
            # Per grape: '% alcool' block whose second header row names the grapes (tab 'par cépage').
            names = [c.strip().lower() for c in rows[1]]
            for grape, (label, _) in GRAPES.items():
                if label in names and '% alcool' in rows[0][0 if not rows[0][0] else 0].lower() + ' '.join(rows[0]).lower():
                    col = names.index(label)
                    for r in rows[2:]:
                        year = year_of(r[0]) if r else None
                        value = number(r[col]) if year and len(r) > col else None
                        if year and value and 6 <= value <= 15:
                            alcohol.setdefault((grape, year), value)
        if 'vendanges' in text and len(rows) > 2:
            header = [c.strip().lower() for c in rows[1]] if 'année' in ' '.join(rows[1]).lower() else [c.strip().lower() for c in rows[0]]
            body = rows[2:] if header is not None and 'année' in ' '.join(rows[1]).lower() else rows[1:]
            # The harvest-start columns are the last block: per grape (CH, PN, MN) or one mean.
            cols = {g: max((i for i, c in enumerate(header) if c == short), default=None) for g, (_, short) in GRAPES.items()}
            mean = next((i for i, c in enumerate(header) if 'vendange' in c), None)
            for r in body:
                year = year_of(r[0]) if r else None
                if not year:
                    continue
                for grape, col in cols.items():
                    if col is not None and len(r) > col and (day := day_of(r[col], year)):
                        starts.setdefault((grape, year), day)
                if mean is not None and len(r) > mean and (day := day_of(r[mean], year)):
                    starts.setdefault(('all', year), day)
    if not alcohol or not starts:
        print('UMC sheet did not parse; Champagne must data left unchanged.', file=sys.stderr)
        return
    with open(DATA / 'umc_harvest.csv', 'w', newline='') as out:
        out.write('# Harvest start per year as the Union des Maisons de Champagne publishes it (champagne_must.py):\n'
                  '# grape "all" is the Champagne-wide start (from 1951), the others per grape (from 1987).\n')
        writer = csv.writer(out, lineterminator='\n')
        writer.writerow(['year', 'grape', 'date'])
        for (grape, year), day in sorted(starts.items(), key=lambda kv: (kv[0][1], kv[0][0])):
            writer.writerow([year, grape, day.isoformat()])
    def start_of(grape: str, year: int) -> dt.date | None:
        return (starts.get((grape, year)) if year >= FIRST_BY_GRAPE else None) or starts.get(('all', year))
    with open(DATA / 'harvest_dates.csv', 'w', newline='') as out:
        out.write('# Harvest start per sub-region (champagne_must.py): the Union des Maisons de Champagne\'s start\n'
                  '# for the sub-region\'s leading grape from 1989, the Champagne-wide start before.\n')
        writer = csv.writer(out, lineterminator='\n')
        writer.writerow(['area', 'year', 'date', 'type', 'source'])
        for year in sorted({y for _, y in starts}):
            for area in AREAS:
                if (day := start_of(LEADING[area], year)):
                    writer.writerow([area, year, day.isoformat(), 'reported-start', PAGE])
    rows = []
    for (grape, year), value in sorted(alcohol.items(), key=lambda kv: (kv[0][1], kv[0][0])):
        start = start_of(grape, year)
        if not start:
            continue
        for area in AREAS:
            rows.append([area, grape, year, (start + dt.timedelta(days=7)).isoformat(), round(value * SUGAR_PER_DEGREE, 1), 1])
    with open(DATA / 'measured_sugar.csv', 'w', newline='') as out:
        out.write('# Mean must at harvest for Champagne as a whole, per grape and year (Union des Maisons de\n'
                  '# Champagne, "Caractéristiques du raisin"; champagne_must.py): potential alcohol x 16.83 g/L,\n'
                  '# dated to the middle of the picking fortnight, repeated for each sub-region. plots: 1.\n')
        writer = csv.writer(out, lineterminator='\n')
        writer.writerow(['area', 'grape', 'year', 'date', 'sugar', 'plots'])
        writer.writerows(rows)
    print(f'UMC: {len(alcohol)} grape-years of must, {len(starts)} harvest starts')


if __name__ == '__main__':
    main()
