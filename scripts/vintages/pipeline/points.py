"""Where each village's weather is read, and how high its vines sit.

For every village in scripts/vintages/data/villages.json this writes
scripts/vintages/data/points.json with:

- up to 25 sample points spread over the village appellation's vineyard
  (from the INAO boundary already in public/maps), with their IGN elevation;
- the four nearest SAFRAN 8 km cells, their inverse-distance weights and each
  cell's mean ground elevation (25 IGN samples across the cell).

The difference between the vineyard and its cells drives the temperature
correction in build.py: SAFRAN describes the cell's average ground, the vines
sit on the slope above or below it.

    python scripts/vintages/pipeline/points.py
"""
from __future__ import annotations

import csv
import io
import json
import math
import time
import urllib.parse
import urllib.request
from pathlib import Path

from shapely.geometry import Point, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / 'scripts/vintages/data'
SAFRAN_GRID = 'https://meteofrance.s3.sbg.io.cloud.ovh.net/data/REF_CC/SIM/coordonnees_grille_safran_lambert-2-etendu.csv'
IGN = 'https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json'
SAMPLES = 25


def fetch(url: str, attempts: int = 5) -> bytes:
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(url, timeout=60) as response:
                return response.read()
        except Exception:  # noqa: BLE001 - retried, then raised
            if attempt == attempts - 1:
                raise
            time.sleep(2 ** attempt)
    raise RuntimeError('unreachable')


def elevations(points: list[tuple[float, float]]) -> list[float]:
    """IGN RGE ALTI elevations (metres) for (lon, lat) pairs, in batches."""
    out: list[float] = []
    for start in range(0, len(points), 100):
        batch = points[start:start + 100]
        query = urllib.parse.urlencode({
            'lon': '|'.join(f'{lon:.5f}' for lon, _ in batch),
            'lat': '|'.join(f'{lat:.5f}' for _, lat in batch),
            'resource': 'ign_rge_alti_wld',
            'zonly': 'true',
        })
        body = json.loads(fetch(f'{IGN}?{query}'))
        out.extend(float(z) for z in body['elevations'])
    # -99999 marks "no data" (outside France); never expected on a vineyard.
    if any(z < -1000 for z in out):
        raise ValueError('IGN returned no elevation for a sample point')
    return out


def vineyard_samples(map_file: str) -> list[tuple[float, float]]:
    """Up to SAMPLES points on a regular grid inside the village appellation."""
    features = json.loads((ROOT / map_file).read_text())['features']
    chosen = [f for f in features if f['properties'].get('tier') == 'village'] or \
        [f for f in features if f['properties'].get('tier') == 'regional']
    area = unary_union([shape(chosen[0]['geometry'])])
    minx, miny, maxx, maxy = area.bounds
    for steps in range(5, 40):
        grid = [(minx + (i + .5) * (maxx - minx) / steps, miny + (j + .5) * (maxy - miny) / steps)
                for i in range(steps) for j in range(steps)]
        inside = [p for p in grid if area.contains(Point(p))]
        if len(inside) >= SAMPLES:
            step = len(inside) / SAMPLES
            return [inside[int(k * step)] for k in range(SAMPLES)]
    point = area.representative_point()
    return [(point.x, point.y)]


def safran_grid() -> list[dict]:
    text = fetch(SAFRAN_GRID).decode('latin-1')
    rows = list(csv.reader(io.StringIO(text), delimiter=';'))[1:]
    return [{'x': int(r[0]), 'y': int(r[1]), 'lat': float(r[2].replace(',', '.')), 'lon': float(r[3].replace(',', '.'))}
            for r in rows if len(r) >= 4]


def km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    dy = (lat2 - lat1) * 111.2
    dx = (lon2 - lon1) * 111.2 * math.cos(math.radians((lat1 + lat2) / 2))
    return math.hypot(dx, dy)


def main() -> None:
    villages = json.loads((DATA / 'villages.json').read_text())
    grid = safran_grid()
    cell_elevation: dict[tuple[int, int], float] = {}
    out = []
    for village in villages:
        samples = vineyard_samples(village['map'])
        heights = elevations(samples)
        nearest = sorted(grid, key=lambda c: km(village['lat'], village['lon'], c['lat'], c['lon']))[:4]
        weights = [1 / max(km(village['lat'], village['lon'], c['lat'], c['lon']), .5) ** 2 for c in nearest]
        total = sum(weights)
        cells = []
        for cell, weight in zip(nearest, weights):
            key = (cell['x'], cell['y'])
            if key not in cell_elevation:
                # 5 x 5 samples across the 8 km cell, centred on its grid point.
                pts = [(cell['lon'] + dx * 3.2 / (111.2 * math.cos(math.radians(cell['lat']))), cell['lat'] + dy * 3.2 / 111.2)
                       for dx in (-1, -.5, 0, .5, 1) for dy in (-1, -.5, 0, .5, 1)]
                cell_elevation[key] = sum(elevations(pts)) / len(pts)
            cells.append({'x': cell['x'], 'y': cell['y'], 'weight': round(weight / total, 4), 'elevation': round(cell_elevation[key], 1)})
        heights_sorted = sorted(heights)
        out.append({
            'id': village['id'],
            'area': village['area'],
            'samples': [[round(lon, 5), round(lat, 5)] for lon, lat in samples],
            'vineyardElevation': round(heights_sorted[len(heights_sorted) // 2], 1),
            'cells': cells,
        })
        print(f"{village['id']}: vines {out[-1]['vineyardElevation']} m, cells "
              f"{sum(c['elevation'] * c['weight'] for c in cells):.0f} m")
    (DATA / 'points.json').write_text(json.dumps(out, indent=1) + '\n')


if __name__ == '__main__':
    main()
