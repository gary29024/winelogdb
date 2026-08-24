#!/usr/bin/env python3
"""Rasterise a coarse world map into the static tables used by the Passport map.

The Passport draws a dot-matrix world: one dot per cell of an equirectangular
grid that covers land. Doing that in the browser would mean shipping polygon
data, so the grid and the country anchor points are baked here instead and
committed as `src/features/journey/worldMapData.ts`.

Input is Natural Earth 1:110m (public domain), downloaded once into a scratch
directory:

  ne_110m_land.geojson             -> the land mask
  ne_110m_admin_0_countries.geojson -> one anchor point per country

Usage: python3 scripts/generate_world_map.py <geojson-dir> [output.ts]
"""
from __future__ import annotations

import json
import sys
import unicodedata
from pathlib import Path

# Equirectangular window. Antarctica is cropped: it adds a featureless band
# across the bottom of every frame and no wine comes from it.
LAT_TOP = 80.0
LAT_BOTTOM = -56.0
CELL = 4.0
COLUMNS = int(360 / CELL)
ROWS = int((LAT_TOP - LAT_BOTTOM) / CELL)
# Each cell is sampled on a 3x3 subgrid; a cell is land if any sample lands on
# land. Slightly fattening coastlines keeps thin countries (Italy, Japan, New
# Zealand, Chile) legible at this resolution.
SUBSAMPLES = 3

# Natural Earth centroids sit in the geographic middle of a country, which for
# the large ones is nowhere near the vineyards. Anchor those by hand.
ANCHOR_OVERRIDES = {
    'United States of America': (38.5, -121.0),   # Napa / Central Valley
    'Canada': (43.2, -79.4),                       # Niagara Peninsula
    'Australia': (-34.5, 138.9),                   # Barossa
    'China': (38.5, 105.9),                        # Ningxia
    'Brazil': (-29.2, -51.5),                      # Serra Gaucha
    'Russia': (44.9, 37.8),                        # Krasnodar
    'India': (19.9, 73.8),                         # Nashik
    'Mexico': (32.0, -116.6),                      # Valle de Guadalupe
    'Argentina': (-33.0, -68.8),                   # Mendoza
    'Chile': (-34.3, -71.0),                       # Colchagua
    'South Africa': (-33.9, 18.9),                 # Stellenbosch
    'Spain': (41.7, -2.8),                         # Ribera del Duero
    'Portugal': (41.1, -7.8),                      # Douro
    'France': (46.9, 2.9),
    'Italy': (43.4, 11.6),                         # Tuscany
    'Germany': (49.9, 8.0),                        # Rheingau
    'Austria': (48.3, 15.7),                       # Wachau
    'New Zealand': (-41.5, 173.9),                 # Marlborough
    'Greece': (38.4, 22.7),
    'Hungary': (48.1, 21.4),                       # Tokaj
}

# Names the journal is likely to hold that are not Natural Earth's spelling.
ALIASES = {
    'usa': 'United States of America',
    'us': 'United States of America',
    'united states': 'United States of America',
    'america': 'United States of America',
    'uk': 'United Kingdom',
    'great britain': 'United Kingdom',
    'england': 'United Kingdom',
    'scotland': 'United Kingdom',
    'wales': 'United Kingdom',
    'czech republic': 'Czechia',
    'holland': 'Netherlands',
    'republic of korea': 'South Korea',
    'korea': 'South Korea',
    'macedonia': 'North Macedonia',
    'burma': 'Myanmar',
    'ivory coast': "Côte d'Ivoire",
    'swaziland': 'eSwatini',
    'turkiye': 'Turkey',
    'republic of moldova': 'Moldova',
    'russian federation': 'Russia',
    'bosnia': 'Bosnia and Herzegovina',
}


def normalise(value: str) -> str:
    stripped = unicodedata.normalize('NFD', value)
    stripped = ''.join(ch for ch in stripped if unicodedata.category(ch) != 'Mn')
    cleaned = ''.join(ch if ch.isalnum() else ' ' for ch in stripped.lower())
    return ' '.join(cleaned.split())


def polygons(geometry: dict) -> list[list[list[list[float]]]]:
    if geometry['type'] == 'Polygon':
        return [geometry['coordinates']]
    if geometry['type'] == 'MultiPolygon':
        return geometry['coordinates']
    return []


def in_ring(lon: float, lat: float, ring: list[list[float]]) -> bool:
    inside = False
    count = len(ring)
    for index in range(count):
        x1, y1 = ring[index][0], ring[index][1]
        x2, y2 = ring[(index + 1) % count][0], ring[(index + 1) % count][1]
        if (y1 > lat) != (y2 > lat):
            crossing = x1 + (lat - y1) / (y2 - y1) * (x2 - x1)
            if lon < crossing:
                inside = not inside
    return inside


def in_polygon(lon: float, lat: float, polygon: list[list[list[float]]]) -> bool:
    if not in_ring(lon, lat, polygon[0]):
        return False
    return not any(in_ring(lon, lat, hole) for hole in polygon[1:])


def bounds(polygon: list[list[list[float]]]) -> tuple[float, float, float, float]:
    xs = [point[0] for point in polygon[0]]
    ys = [point[1] for point in polygon[0]]
    return min(xs), min(ys), max(xs), max(ys)


def build_mask(land_path: Path) -> list[str]:
    features = json.loads(land_path.read_text())['features']
    shapes: list[tuple[tuple[float, float, float, float], list[list[list[float]]]]] = []
    for feature in features:
        for polygon in polygons(feature['geometry']):
            shapes.append((bounds(polygon), polygon))

    step = CELL / (SUBSAMPLES + 1)
    rows: list[str] = []
    for row in range(ROWS):
        cells: list[str] = []
        top = LAT_TOP - row * CELL
        for column in range(COLUMNS):
            left = -180.0 + column * CELL
            hit = False
            for sub_y in range(1, SUBSAMPLES + 1):
                lat = top - sub_y * step
                for sub_x in range(1, SUBSAMPLES + 1):
                    lon = left + sub_x * step
                    for (min_x, min_y, max_x, max_y), polygon in shapes:
                        if lon < min_x or lon > max_x or lat < min_y or lat > max_y:
                            continue
                        if in_polygon(lon, lat, polygon):
                            hit = True
                            break
                    if hit:
                        break
                if hit:
                    break
            cells.append('#' if hit else '.')
        rows.append(''.join(cells))
    return rows


def largest_polygon(geometry: dict) -> list[list[list[float]]] | None:
    best = None
    best_area = 0.0
    for polygon in polygons(geometry):
        min_x, min_y, max_x, max_y = bounds(polygon)
        area = (max_x - min_x) * (max_y - min_y)
        if area > best_area:
            best_area, best = area, polygon
    return best


def anchor_for(geometry: dict) -> tuple[float, float] | None:
    """A point inside the country's main landmass, not merely its bounding box."""
    polygon = largest_polygon(geometry)
    if not polygon:
        return None
    ring = polygon[0]
    lon = sum(point[0] for point in ring) / len(ring)
    lat = sum(point[1] for point in ring) / len(ring)
    if in_polygon(lon, lat, polygon):
        return round(lat, 2), round(lon, 2)
    min_x, min_y, max_x, max_y = bounds(polygon)
    for steps in (12, 30):
        for row in range(1, steps):
            probe_lat = min_y + (max_y - min_y) * row / steps
            for column in range(1, steps):
                probe_lon = min_x + (max_x - min_x) * column / steps
                if in_polygon(probe_lon, probe_lat, polygon):
                    return round(probe_lat, 2), round(probe_lon, 2)
    return round(lat, 2), round(lon, 2)


def build_anchors(countries_path: Path) -> tuple[dict[str, tuple[float, float]], dict[str, str]]:
    features = json.loads(countries_path.read_text())['features']
    anchors: dict[str, tuple[float, float]] = {}
    aliases = dict(ALIASES)
    for feature in features:
        properties = feature['properties']
        name = properties['NAME']
        override = ANCHOR_OVERRIDES.get(name)
        anchor = override if override else anchor_for(feature['geometry'])
        # Antarctica and anything else outside the cropped window has no cell to
        # stand on, so it is left off the map rather than pinned to its edge.
        if not anchor or not LAT_BOTTOM < anchor[0] < LAT_TOP:
            continue
        anchors[name] = anchor
        # Natural Earth carries several spellings per country ("People's Republic
        # of China", "Republic of Korea"). Any of them may reach us from a label.
        for key in ('NAME_EN', 'NAME_LONG', 'FORMAL_EN', 'NAME_CIAWF', 'BRK_NAME'):
            other = properties.get(key)
            if other and normalise(other) != normalise(name):
                aliases.setdefault(normalise(other), name)
    missing = set(ANCHOR_OVERRIDES) - set(anchors)
    if missing:
        raise SystemExit(f'anchor override does not match a Natural Earth name: {sorted(missing)}')
    known = {normalise(name) for name in anchors}
    # A hand-written alias may name a country the way people write it rather than
    # the way Natural Earth abbreviates it ("Bosnia and Herzegovina" vs "Bosnia
    # and Herz."), so follow the generated aliases to reach a primary name.
    resolved: dict[str, str] = {}
    for alias, target in aliases.items():
        key = normalise(target)
        if key not in known:
            key = normalise(aliases.get(key, ''))
        if key not in known:
            raise SystemExit(f'alias {alias!r} points at an unknown country: {target!r}')
        if alias not in known:
            resolved[alias] = key
    return anchors, resolved


def render(mask: list[str], anchors: dict[str, tuple[float, float]], aliases: dict[str, str]) -> str:
    anchor_lines = ',\n'.join(
        f"  '{normalise(name)}':[{lat},{lon}]" for name, (lat, lon) in sorted(anchors.items())
    )
    alias_lines = ',\n'.join(
        f"  '{alias}':'{target}'" for alias, target in sorted(aliases.items())
    )
    mask_lines = ',\n'.join(f"  '{row}'" for row in mask)
    return f'''// Generated by scripts/generate_world_map.py from Natural Earth 1:110m (public
// domain). Do not edit by hand - re-run the script instead.

export const MAP_LAT_TOP={LAT_TOP};
export const MAP_LAT_BOTTOM={LAT_BOTTOM};
export const MAP_CELL={CELL};
export const MAP_COLUMNS={COLUMNS};
export const MAP_ROWS={ROWS};

/** One character per {int(CELL)}-degree cell, '#' where the cell contains land. */
export const LAND_MASK:readonly string[]=[
{mask_lines}
];

/** Normalised country name -> [latitude, longitude] inside its main landmass. */
export const COUNTRY_ANCHORS:Readonly<Record<string,readonly [number,number]>>={{
{anchor_lines}
}};

/** Spellings the journal may hold that differ from the Natural Earth name. */
export const COUNTRY_ALIASES:Readonly<Record<string,string>>={{
{alias_lines}
}};
'''


def light_anchor_cells(mask: list[str], anchors: dict[str, tuple[float, float]]) -> list[str]:
    """Force every anchor's cell to be land.

    Malta and Singapore are smaller than a four-degree cell, so rasterising can
    miss them entirely and leave their marker floating in open water. Marking
    the cell keeps every marker standing on something.
    """
    grid = [list(row) for row in mask]
    for lat, lon in anchors.values():
        row = int((LAT_TOP - lat) // CELL)
        column = int((lon + 180) // CELL)
        if 0 <= row < ROWS and 0 <= column < COLUMNS:
            grid[row][column] = '#'
    return [''.join(row) for row in grid]


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    source = Path(sys.argv[1])
    target = Path(sys.argv[2]) if len(sys.argv) > 2 else Path('src/features/journey/worldMapData.ts')
    mask = build_mask(source / 'ne_110m_land.geojson')
    anchors, aliases = build_anchors(source / 'ne_110m_admin_0_countries.geojson')
    mask = light_anchor_cells(mask, anchors)
    target.write_text(render(mask, anchors, aliases))
    land = sum(row.count('#') for row in mask)
    print(f'{target}: {COLUMNS}x{ROWS} grid, {land} land cells, '
          f'{len(anchors)} country anchors, {len(aliases)} aliases')


if __name__ == '__main__':
    main()
