"""Fetch every year the build needs that is not already cached.

Past years never change once Météo-France has published them, so a cached file
is kept; the current and previous year are always fetched again, because new
days and months are still arriving.

    python scripts/vintages/pipeline/fetch.py [--cache scripts/vintages/cache]
"""
from __future__ import annotations

import argparse
import datetime as dt
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
SAFRAN_FROM, RAIN_FROM = 1991, 1997


def run(args: list[str]) -> None:
    subprocess.run([sys.executable, *args], check=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', default='scripts/vintages/cache')
    args = parser.parse_args()
    cache = Path(args.cache)
    cache.mkdir(parents=True, exist_ok=True)
    this_year = dt.date.today().year
    fresh = {this_year, this_year - 1}
    for year in range(SAFRAN_FROM, this_year + 1):
        if year in fresh or not (cache / f'safran_{year}.csv').exists():
            run([str(HERE / 'safran.py'), str(year), '--out', str(cache)])
    rain_years = [y for y in range(RAIN_FROM, this_year + 1) if y in fresh or not (cache / f'rain_{y}.csv').exists()]
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(lambda y: run([str(HERE / 'comephore.py'), str(y), '--out', str(cache)]), rain_years))


if __name__ == '__main__':
    main()
