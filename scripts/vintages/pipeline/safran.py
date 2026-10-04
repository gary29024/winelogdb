"""Daily SAFRAN temperature, sunshine and rain for the cells around each village.

Streams one year of Météo-France's SIM2 daily reanalysis (8 km, all of France,
~140 MB compressed) and keeps only the cells listed in points.json, so nothing
large is ever written to disk.

    python scripts/vintages/pipeline/safran.py 2024 [--out cache]

Writes <out>/safran_<year>.csv: cell x, cell y, date, rain (mm), mean, min and
max temperature (°C), visible radiation (J/cm²).
"""
from __future__ import annotations

import argparse
import csv
import gzip
import json
import time
import urllib.request
from pathlib import Path

import region

ROOT = Path(__file__).resolve().parents[3]
URL = 'https://meteofrance.s3.sbg.io.cloud.ovh.net/data/REF_CC/SIM/QUOT_SIM2_{year}.csv.gz'
FIELDS = ['PRELIQ', 'T', 'TINF_H', 'TSUP_H', 'SSI']


def wanted_cells() -> set[tuple[str, str]]:
    points = json.loads((region.config()['data'] / 'points.json').read_text())
    return {(str(c['x']), str(c['y'])) for p in points for c in p['cells']}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('year', type=int)
    parser.add_argument('--out', default='scripts/vintages/cache')
    args = parser.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    cells = wanted_cells()
    target = out / f'safran_{args.year}.csv'
    for attempt in range(5):
        try:
            rows = 0
            with urllib.request.urlopen(URL.format(year=args.year), timeout=120) as response, \
                    gzip.open(response, 'rt', encoding='latin-1') as source, \
                    open(target, 'w', newline='') as sink:
                reader = csv.reader(source, delimiter=';')
                header = next(reader)
                index = {name: header.index(name) for name in ['LAMBX', 'LAMBY', 'DATE', *FIELDS]}
                writer = csv.writer(sink)
                writer.writerow(['x', 'y', 'date', 'rain', 't', 'tmin', 'tmax', 'ssi'])
                for row in reader:
                    if (row[index['LAMBX']], row[index['LAMBY']]) in cells:
                        writer.writerow([row[index['LAMBX']], row[index['LAMBY']], row[index['DATE']],
                                         *(row[index[name]] for name in FIELDS)])
                        rows += 1
            print(f'{args.year}: {rows} cell-days kept')
            return
        except Exception as error:  # noqa: BLE001 - network: retried, then raised
            if attempt == 4:
                raise
            print(f'{args.year}: retrying after {error}')
            time.sleep(10 * (attempt + 1))


if __name__ == '__main__':
    main()
