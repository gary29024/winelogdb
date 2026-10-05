"""Refresh data/bordeaux/measured_sugar.csv from the Bordeaux Raisins maturity network.

Bordeaux Raisins (bordeauxraisins.fr, ISVV / Université de Bordeaux with the CIVB) samples
Merlot and Cabernet Sauvignon on seven reference plots each week from véraison and publishes
each plot's must sugar (g/L) in a Google Sheet per year, one tab per sampling date. This reads
the year's per-plot articles, follows them to that sheet, and averages the plots per bank,
grape and day:

  plots 1-2 Médoc and 3 Graves -> left-bank;  plots 5-6 Libournais -> right-bank.
  Plot 4 (Entre-Deux-Mers) and plot 7 (Blaye-Bourg) lie outside the communes the page covers.

It runs before build.py in the monthly Vintage data Action (current and previous year), and
replaces only the years it read. 2017 and 2025 have no per-plot sheet on the site (its 2017
section lists the 2018 articles; the 2025 page now carries 2026), so those years stay without
measurements. If the site cannot be read the file is left unchanged.

    python scripts/vintages/pipeline/bordeaux_raisins.py [--years 2025 2026]
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import html
import io
import re
import sys
import time
import urllib.error
import urllib.request
from collections import defaultdict
from pathlib import Path
from statistics import mean

ROOT = Path(__file__).resolve().parents[3]
FILE = ROOT / 'scripts/vintages/data/bordeaux/measured_sugar.csv'
SITE = 'https://www.bordeauxraisins.fr'
AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
PLOT_AREA = {1: 'left-bank', 2: 'left-bank', 3: 'left-bank', 5: 'right-bank', 6: 'right-bank'}
HEADER = """# Must sugar measured by the Bordeaux Raisins maturity network (bordeauxraisins.fr, ISVV /
# Université de Bordeaux with the CIVB): reference plots sampled weekly from véraison. One row
# per bank, grape and sampling date, the mean over that bank's plots sampled that day (left bank:
# Médoc 1-2 and Graves 3; right bank: Libournais 5-6). Refreshed by bordeaux_raisins.py in the
# monthly Vintage data Action. sugar: g/L. plots: how many plots the mean covers.
"""
FIELDS = ['area', 'grape', 'year', 'date', 'sugar', 'plots']


def fetch(url: str) -> str:
    """The page's text; '' when the page does not exist. Anything else is retried, then raised."""
    for attempt in range(6):
        try:
            request = urllib.request.Request(url, headers={'User-Agent': AGENT})
            with urllib.request.urlopen(request, timeout=60) as response:
                return response.read().decode('utf-8', 'ignore')
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return ''
            time.sleep(min(2 ** attempt, 30))
        except OSError:
            time.sleep(min(2 ** attempt, 30))
    raise RuntimeError(f'{url} did not answer')


def workbooks(year: int) -> set[str]:
    """The published sheet(s) behind a year's per-plot articles. Most years list them under
    suivi-par-parcelles-<year>; 2015 sits in the undated suivi-par-parcelles section, and 2018's
    articles live at the site root (indice-de-maturite-par-parcelle-semaine-du-DD-MM-2018)."""
    articles = set()
    for section in (f'suivi-par-parcelles-{year}', 'suivi-par-parcelles'):
        listing = fetch(f'{SITE}/{section}.html')
        pages = {''} | set(re.findall(rf'href="/{section}\.html(\?start=\d+)"', listing))
        for page in pages:
            text = listing if not page else fetch(f'{SITE}/{section}.html{page}')
            articles |= {a for a in re.findall(r'href="(/[^"#]*indice-de-maturite[^"#]*\.html)"', text)
                         if a.startswith(f'/suivi-par-parcelles-{year}/') or a.endswith(f'-{year}.html')}
    books = set()
    for article in sorted(articles):
        for url in re.findall(r'(https://docs\.google\.com/spreadsheets/d/[^"\s]+)', fetch(SITE + article)):
            books.add(re.sub(r'/pub(html)?.*$', '', html.unescape(url)))
    return books


def tab_date(name: str, year: int) -> dt.date | None:
    match = re.search(r'(\d{1,2})[/.-](\d{1,2})', name)
    return dt.date(year, int(match.group(2)), int(match.group(1))) if match else None


def grape_of(label: str) -> str | None:
    label = label.lower()
    if 'merlot' in label:
        return 'merlot'
    if 'cabernet' in label and 'franc' not in label:
        return 'cabernet-sauvignon'
    return None


def plot_rows(text: str) -> list[tuple[int, str, float]]:
    """(plot, grape, sugar) from one tab: plots listed under a grape heading or named with it."""
    rows = list(csv.reader(io.StringIO(text)))
    header = next((r for r in rows if any('sucre' in c.lower() for c in r)), None)
    if header is None:
        return []
    column = next(i for i, c in enumerate(header) if 'sucre' in c.lower())
    # The potential-alcohol column printed beside the sugar (TAP, at 17.5 or 16.83 g/L per % vol)
    # catches a mistyped sugar: 2015's 308.3 g/L sits beside 11.9 % (about 208 g/L).
    tap = next(((i, float(m.group(1).replace(',', '.'))) for i, c in enumerate(header)
                if 'tap' in c.lower() and (m := re.search(r'(1[67][,.]\d+)', c))), None)
    out, grape = [], None
    for row in rows:
        label = ' '.join(row[:2])
        heading = grape_of(label)
        plot = re.search(r'(?:parcelle|^p)\s*(\d)', label.strip(), re.I)
        if heading and not plot:
            grape = heading
            continue
        if plot and len(row) > column:
            value = row[column].strip().replace(',', '.')
            try:
                sugar = float(value)
            except ValueError:
                continue
            if tap and len(row) > tap[0]:
                try:
                    if abs(sugar / tap[1] - float(row[tap[0]].strip().replace(',', '.'))) > 1:
                        continue
                except ValueError:
                    pass
            if 100 <= sugar <= 330:
                out.append((int(plot.group(1)), heading or grape, sugar))
    return [r for r in out if r[1]]


def year_samples(year: int) -> list[tuple[str, str, int, str, float]]:
    out = []
    for book in workbooks(year):
        tabs = re.findall(r'items\.push\(\{name: "([^"]+)", pageUrl: "[^"]*gid=(\d+)', fetch(book + '/pubhtml'))
        for name, gid in tabs:
            day = tab_date(name.replace('\\/', '/'), year)
            if day is None:
                continue
            for plot, grape, sugar in plot_rows(fetch(f'{book}/pub?gid={gid}&single=true&output=csv')):
                if plot in PLOT_AREA:
                    out.append((PLOT_AREA[plot], grape, year, day.isoformat(), sugar))
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    this_year = dt.date.today().year
    parser.add_argument('--years', type=int, nargs='+', default=[this_year - 1, this_year])
    years = parser.parse_args().years
    try:
        fetched = {y: year_samples(y) for y in years}
    except RuntimeError as error:
        print(f'Bordeaux Raisins unavailable ({error}); measured_sugar.csv left unchanged.', file=sys.stderr)
        return
    read = [y for y, rows in fetched.items() if rows]
    by_day: dict[tuple[str, str, int, str], list[float]] = defaultdict(list)
    for rows in fetched.values():
        for area, grape, year, day, sugar in rows:
            by_day[(area, grape, year, day)].append(sugar)
    kept = []
    if FILE.exists():
        with open(FILE) as source:
            kept = [r for r in csv.DictReader(line for line in source if not line.startswith('#')) if int(r['year']) not in read]
    fresh = [{'area': a, 'grape': g, 'year': str(y), 'date': d, 'sugar': f'{round(mean(v), 1)}', 'plots': str(len(v))}
             for (a, g, y, d), v in by_day.items()]
    rows = sorted(kept + fresh, key=lambda r: (r['area'], r['grape'], int(r['year']), r['date']))
    with open(FILE, 'w', newline='') as out:
        out.write(HEADER)
        writer = csv.DictWriter(out, fieldnames=FIELDS, lineterminator='\n')
        writer.writeheader()
        writer.writerows(rows)
    print(f'Bordeaux Raisins: {len(fresh)} sampling days read for {", ".join(map(str, read)) or "no year"}'
          f'{"; nothing published as a sheet for " + ", ".join(str(y) for y in years if y not in read) if len(read) < len(years) else ""}')


if __name__ == '__main__':
    main()
