"""Build display-only regional overviews from the reviewed, immutable map files.

These are generalised illustrations, not parcel boundaries. The full source
builder and its strict precision gates are deliberately separate and unchanged.
Run after build_burgundy_regional_maps.py; no downloads or source edits occur.
"""
import gzip
import hashlib
import json
from math import cos, log2, radians
from pathlib import Path

import geobuf
from pyproj import Transformer
from shapely import get_parts, make_valid, set_precision, prepare
from shapely.geometry import Point, Polygon, shape, mapping
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
PLACES = ROOT / 'src/lib/places'
FORWARD = Transformer.from_crs(4326, 2154, always_xy=True).transform
BACKWARD = Transformer.from_crs(2154, 4326, always_xy=True).transform
ANCHORS = ['Dijon', 'Beaune', 'Chablis', 'Mâcon', 'Joigny', 'Nuits-Saint-Georges',
           'Mercurey', 'Tournus', 'Beaujeu', 'Tonnerre', 'Givry', 'Chasselas']


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf8', newline='\n')


def source_bytes(path):
    # Git may check text out as CRLF on Windows. Hash and benchmark canonical
    # LF bytes so source freshness and generated output agree on every host.
    return path.read_bytes().replace(b'\r\n', b'\n')


def portable_gzip(raw):
    packed = gzip.compress(raw, compresslevel=9, mtime=0)
    # Python 3.11/3.12 delegates the OS header byte to platform zlib. It is
    # metadata only; normalise it to "unknown" just as Python 3.13+ does.
    return packed[:9] + b'\xff' + packed[10:]


def polygonal(geometry):
    value = make_valid(geometry, method='structure', keep_collapsed=False)
    if value.geom_type == 'GeometryCollection':
        # Intersecting a sector with its overview can also produce touching
        # zero-area lines. They are not part of an area fill.
        polygons = []
        def collect(part):
            if part.geom_type in ('Polygon', 'MultiPolygon'):
                polygons.append(part)
            elif part.geom_type == 'GeometryCollection':
                for child in get_parts(part):
                    collect(child)
        collect(value)
        value = unary_union(polygons)
    assert value.geom_type in ('Polygon', 'MultiPolygon') and not value.is_empty
    return value


def labels(communes):
    """A few familiar anchors, then fill geographic gaps; no alphabetical bias."""
    by_name = {c['name']: c for c in communes}
    chosen = [by_name[name] for name in ANCHORS if name in by_name][:6]
    points = {c['id']: FORWARD(*c['labelPoint']) for c in communes}
    if not chosen:
        chosen = [communes[0]]
    while len(chosen) < min(8, len(communes)):
        used = {c['id'] for c in chosen}
        def distance(c):
            x, y = points[c['id']]
            return min((x-points[s['id']][0])**2 + (y-points[s['id']][1])**2 for s in chosen)
        chosen.append(max((c for c in communes if c['id'] not in used), key=distance))
    return [c['id'] for c in chosen]


def generalise(feature, tolerance, containing=None):
    source = polygonal(transform(FORWARD, shape(feature['geometry'])))
    # Remove numerical slivers before simplification. This is display geometry
    # only; the source file, area metadata and source-builder checks stay exact.
    stable = set_precision(source, .05)
    holes = [Polygon(r) for p in get_parts(stable) for r in p.interiors]
    hole_cutoff = 4 * tolerance**2
    cleaned = unary_union([Polygon(p.exterior, [r for r in p.interiors if Polygon(r).area >= hole_cutoff])
                           for p in get_parts(stable)])
    simplified = polygonal(cleaned.simplify(tolerance, preserve_topology=True))
    final = set_precision(polygonal(transform(BACKWARD, simplified)), 1e-6)
    if containing is not None:
        final = polygonal(final.intersection(containing))
    geometry = mapping(final)
    # Use the coordinates actually published by Geobuf for every spatial gate.
    encoded = geobuf.Encoder().encode(dict(type='Feature', properties=feature['properties'], geometry=geometry), precision=6, dim=2)
    decoded = geobuf.decode(encoded)
    projected = polygonal(transform(FORWARD, shape(decoded['geometry'])))
    prepare(projected)
    difference = source.symmetric_difference(projected).area / source.area
    area_change = abs(projected.area-source.area) / source.area
    # Generalisation has its own explicit display budget; it never weakens the
    # canonical source's sub-2 m² exclusions or 0.005% area gate.
    assert difference < .12 and area_change < .05, (feature['id'], tolerance, difference, area_change)
    assert all(projected.intersects(p) for p in get_parts(source) if p.area >= hole_cutoff)
    # Preserve the interior of exclusions wider than the display tolerance.
    # A hole may itself contain a separate eligible island: subtract source
    # coverage first so that legitimate island is never counted as an intrusion.
    cores = unary_union([hole.buffer(-tolerance*1.5) for hole in holes if hole.area >= hole_cutoff]).difference(source)
    assert projected.intersection(cores).area < 1, (feature['id'], 'exclusion core')
    assert max(abs(a-b) for a, b in zip(source.bounds, projected.bounds)) <= tolerance*2 + 1
    result = dict(feature, geometry=decoded['geometry'])
    return result, dict(toleranceMetres=tolerance, smallHoleCutoffM2=hole_cutoff,
                        areaChangePercent=round(area_change*100, 4), differencePercent=round(difference*100, 4))


def main():
    registry = json.loads((PLACES / 'burgundyRegionalMapRegistry.json').read_bytes())
    entries, report, outputs = {}, [], []
    for entry in registry['maps']:
        catalogue_path = PLACES / f"{entry['id']}MapCatalogue.json"
        catalogue_bytes = source_bytes(catalogue_path)
        catalogue = json.loads(catalogue_bytes)
        source_path = ROOT / 'public' / catalogue['dataUrl'].lstrip('/')
        canonical_bytes = source_bytes(source_path)
        data = json.loads(canonical_bytes)
        # Commune outlines are navigation metadata, not useful regional detail.
        features = [f for f in data['features'] if f['properties']['kind'] == 'appellation']
        bounds = transform(FORWARD, shape(features[0]['geometry'])).bounds
        span = max(bounds[2]-bounds[0], bounds[3]-bounds[1])
        tolerance = round(max(2, min(30, span/1200)), 2)
        for attempt in range(5):
            try:
                derived = []
                for feature in features:
                    containing = shape(derived[0][0]['geometry']) if derived else None
                    derived.append(generalise(feature, tolerance, containing))
                break
            except AssertionError:
                if attempt == 4:
                    raise
                tolerance = round(tolerance/2, 4)
        collection = dict(type='FeatureCollection', features=[f for f, _ in derived])
        overview_area = polygonal(transform(FORWARD, shape(collection['features'][0]['geometry'])))
        prepare(overview_area)
        anchor_distances = [overview_area.distance(Point(FORWARD(*c['labelPoint']))) for c in catalogue['communes']]
        assert max(anchor_distances) <= tolerance*2 + 1, (entry['id'], 'commune anchor lost')
        raw = geobuf.Encoder().encode(collection, precision=6, dim=2)
        assert geobuf.decode(raw) == collection
        assert all(shape(f['geometry']).is_valid for f in collection['features'])
        packed = portable_gzip(raw)
        assert len(packed) < 800000 and len(raw) < 1000000
        stem = catalogue['dataUrl'].removesuffix('.geojson') + '.overview'
        latitude = sum(catalogue['bounds'][1::2])/2
        max_zoom = round(min(14, log2(156543*cos(radians(latitude))/(tolerance/1.5))), 1)
        entries[entry['id']] = dict(dataUrl=catalogue['dataUrl'], geobufUrl=stem+'.pbf.gz', geobufRawUrl=stem+'.pbf',
                                  downloadTimeoutMs=20000, maxZoom=max_zoom, labelIds=labels(catalogue['communes']))
        for suffix, content in [('.pbf', raw), ('.pbf.gz', packed)]:
            outputs.append((ROOT / 'public' / (stem+suffix).lstrip('/'), content))
        previous = ROOT / 'public' / catalogue.get('geobufUrl', '').lstrip('/')
        before = previous.stat().st_size if catalogue.get('geobufUrl') else len(gzip.compress(canonical_bytes, compresslevel=9, mtime=0))
        report.append(dict(id=entry['id'], sourceSha256=hashlib.sha256(canonical_bytes).hexdigest(),
                           catalogueSha256=hashlib.sha256(catalogue_bytes).hexdigest(),
                           overviewSha256=hashlib.sha256(raw).hexdigest(),
                           maxCommuneAnchorDistanceMetres=round(max(anchor_distances), 4),
                           previousGzipBytes=before, overviewGzipBytes=len(packed), overviewRawBytes=len(raw),
                           features=[dict(id=f['id'], **metrics) for f, metrics in derived]))
        print(f"{entry['name']}: {before:,} -> {len(packed):,} bytes; {tolerance:g} m; max zoom {max_zoom}", flush=True)
    assert len(entries) == 49
    for path, content in outputs:
        path.write_bytes(content)
    write_json(PLACES / 'burgundyRegionalOverviewRegistry.json', entries)
    write_json(ROOT / 'scripts/burgundy-regional-overview-report.json', report)


if __name__ == '__main__':
    main()
