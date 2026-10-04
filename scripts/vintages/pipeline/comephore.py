"""Daily 1 km rain for each village from Météo-France's COMÉPHORE reanalysis.

COMÉPHORE merges radar and rain gauges into an hourly 1 km grid over France
(from 1997). Each month is one ~200 MB tar of hourly GeoTIFFs; this streams the
tar, reads only the pixels under each village's vineyard sample points, and
sums the hours into days. Nothing large touches the disk.

Values are tenths of a millimetre; 65535 is missing. A file's timestamp is the
END of its hour (UTC), so the hour ending 00:00 belongs to the previous day.

    python scripts/vintages/pipeline/comephore.py 2024 [--months 4-10] [--out cache]

Writes <out>/rain_<year>.csv: village, date, rain (mm), hours (how many of the
24 hours had data).
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import tarfile
import time
import urllib.error
import urllib.request
from collections import defaultdict
from pathlib import Path

import numpy as np
import rasterio
from pyproj import CRS, Transformer
from rasterio.io import MemoryFile

import region

ROOT = Path(__file__).resolve().parents[3]
URL = 'https://meteofrance.s3.sbg.io.cloud.ovh.net/data/synchro_ftp/REANALYSES/COMEPHORE/H_COMEPHORE_{year}{month:02d}.tar'
MISSING = 65535


def pixel_index(dataset: rasterio.io.DatasetReader, points: list[dict]) -> dict[str, list[tuple[int, int]]]:
    """Row/column of every vineyard sample point, per village."""
    to_grid = Transformer.from_crs('EPSG:4326', CRS.from_wkt(dataset.crs.to_wkt()), always_xy=True)
    out: dict[str, list[tuple[int, int]]] = {}
    for point in points:
        cells = set()
        for lon, lat in point['samples']:
            x, y = to_grid.transform(lon, lat)
            row, col = dataset.index(x, y)
            if 0 <= row < dataset.height and 0 <= col < dataset.width:
                cells.add((row, col))
        if not cells:
            raise ValueError(f"{point['id']}: no sample point falls on the COMEPHORE grid")
        out[point['id']] = sorted(cells)
    return out


def month(year: int, number: int, points: list[dict], totals: dict, hours: dict) -> None:
    index: dict[str, list[tuple[int, int]]] | None = None
    url = URL.format(year=year, month=number)
    for attempt in range(5):
        try:
            with urllib.request.urlopen(url, timeout=180) as response, tarfile.open(fileobj=response, mode='r|') as archive:
                for member in archive:
                    if not member.name.endswith('_RR.gtif'):
                        continue
                    stamp = dt.datetime.strptime(Path(member.name).name[:10], '%Y%m%d%H')
                    day = (stamp - dt.timedelta(hours=1)).date()
                    data = archive.extractfile(member).read()
                    with MemoryFile(data) as memory, memory.open() as dataset:
                        if index is None:
                            index = pixel_index(dataset, points)
                        grid = dataset.read(1)
                    for village, cells in index.items():
                        values = np.array([grid[r, c] for r, c in cells], dtype=float)
                        values = values[values != MISSING]
                        if values.size:
                            totals[(village, day)] += values.mean() / 10
                            hours[(village, day)] += 1
            return
        except Exception as error:  # noqa: BLE001 - network: retried, then raised
            # An unpublished month is an answer, not a dropped connection.
            if attempt == 4 or (isinstance(error, urllib.error.HTTPError) and error.code == 404):
                raise
            print(f'{year}-{number:02d}: retrying after {error}')
            # A half-read month must not be counted twice.
            for key in [k for k in totals if k[1].year == year and k[1].month == number]:
                del totals[key]
                del hours[key]
            time.sleep(15 * (attempt + 1))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('year', type=int)
    parser.add_argument('--months', default='4-10')
    parser.add_argument('--out', default='scripts/vintages/cache')
    args = parser.parse_args()
    first, last = (int(part) for part in args.months.split('-'))
    points = json.loads((region.config()['data'] / 'points.json').read_text())
    totals: dict = defaultdict(float)
    hours: dict = defaultdict(int)
    today = dt.date.today()
    for number in range(first, last + 1):
        if dt.date(args.year, number, 1) > today:
            break
        try:
            month(args.year, number, points, totals, hours)
            print(f'{args.year}-{number:02d}: read')
        except urllib.error.HTTPError as error:
            # The newest months are published with a lag; a missing one is not an error.
            if error.code == 404:
                print(f'{args.year}-{number:02d}: not published yet')
                continue
            raise
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    with open(out / f'rain_{args.year}.csv', 'w', newline='') as sink:
        writer = csv.writer(sink)
        writer.writerow(['village', 'date', 'rain', 'hours'])
        for (village, day), total in sorted(totals.items()):
            writer.writerow([village, day.isoformat(), round(total, 2), hours[(village, day)]])


if __name__ == '__main__':
    main()
