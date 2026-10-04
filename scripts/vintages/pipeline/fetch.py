"""Fetch every year the build needs that is not already cached.

Past years never change once Météo-France has published them, so a cached file
is kept; the current and previous year are always fetched again, because new
days and months are still arriving. A cached file that misses a village (or a
SAFRAN cell) added since, or the humidity column, is fetched again.

    python scripts/vintages/pipeline/fetch.py [--cache scripts/vintages/cache]
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import region

HERE = Path(__file__).resolve().parent
SAFRAN_FROM, RAIN_FROM = 1958, 1997


def covers(path: Path, key, wanted: set[str], need: set[str] = frozenset()) -> bool:
    """Whether a cached file has every needed column and every wanted key (key(row) per row)."""
    if not path.exists():
        return False
    with open(path) as source:
        reader = csv.DictReader(source)
        if not need <= set(reader.fieldnames or []):
            return False
        return wanted <= {key(row) for row in reader}


def run(args: list[str]) -> None:
    subprocess.run([sys.executable, *args], check=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', default=str(region.config()['cache']))
    args = parser.parse_args()
    cache = Path(args.cache)
    cache.mkdir(parents=True, exist_ok=True)
    this_year = dt.date.today().year
    fresh = {this_year, this_year - 1}
    points = json.loads((region.config()['data'] / 'points.json').read_text())
    cells = {f"{c['x']} {c['y']}" for p in points for c in p['cells']}
    villages = {p['id'] for p in points}

    # Humidity is read only where a region's model uses it (Bordeaux: noble rot in Sauternes).
    need = {'hu'} if region.config().get('humidity') else set()
    for year in range(SAFRAN_FROM, this_year + 1):
        if year in fresh or not covers(cache / f'safran_{year}.csv', lambda row: f"{row['x']} {row['y']}", cells, need):
            run([str(HERE / 'safran.py'), str(year), '--out', str(cache)])
    rain_years = [y for y in range(RAIN_FROM, this_year + 1) if y in fresh or not covers(cache / f'rain_{y}.csv', lambda row: row['village'], villages)]
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(lambda y: run([str(HERE / 'comephore.py'), str(y), '--out', str(cache)]), rain_years))


if __name__ == '__main__':
    main()
