"""One explicitly approved illustration, never an official boundary builder.

Requires burgundy-map-requirements.txt plus numpy. Download the producer image
and pinned INAO archive separately, then run with --source-dir .tmp/burgundy-map.
Only writes laMoutonneApproximation.json; --check verifies it without writing.
"""
import argparse
import hashlib
import json
import zipfile
from pathlib import Path

import numpy as np
from pyproj import CRS, Transformer
from shapely.geometry import Point, Polygon, mapping, shape
from shapely.geometry.polygon import orient
from shapely.ops import transform, unary_union

from build_burgundy_village_map import DATE, INAO_SHA256, ROOT


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-dir', type=Path, required=True)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    config = json.loads((ROOT / 'scripts/la-moutonne-approximation.json').read_text(encoding='utf-8'))
    assert config['id'] == 'location-long-depaquit-la-moutonne'
    assert hashlib.sha256((args.source_dir / config['source']['file']).read_bytes()).hexdigest() == config['source']['sha256']
    archive = args.source_dir / f'inao-{DATE}.zip'
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == INAO_SHA256
    with zipfile.ZipFile(archive) as z:
        crs = CRS.from_wkt(z.read(f'{DATE}_delim-parcellaire-aoc-shp.prj').decode())
    to_source = Transformer.from_crs(4326, crs, always_xy=True).transform
    to_wgs84 = Transformer.from_crs(crs, 4326, always_xy=True).transform
    data = json.loads((ROOT / f'public/maps/chablis.{DATE}.geojson').read_text(encoding='utf-8'))
    geometries = {f['id']: transform(to_source, shape(f['geometry'])) for f in data['features']}
    pixels = np.array([c['pixel'] + [1] for c in config['controls']])
    # Reviewed metre coordinates identify existing corners. Snap only these
    # control points to their nearest original vertex (within one metre), never
    # move/clip the producer outline to manufacture a desired area or 95/5 split.
    anchors = []
    for control in config['controls']:
        geom = geometries[control['featureId']]
        polygons = list(geom.geoms) if geom.geom_type == 'MultiPolygon' else [geom]
        vertices = [p for poly in polygons for p in poly.exterior.coords]
        seed = Point(control['lambert93'])
        anchor = min(vertices, key=lambda p: Point(p).distance(seed))
        assert Point(anchor).distance(seed) < 1, 'Review changed control geography'
        anchors.append(anchor)
    anchors = np.array(anchors)
    affine, _, rank, _ = np.linalg.lstsq(pixels, anchors, rcond=None)
    assert rank == 3
    residuals = np.linalg.norm(pixels @ affine - anchors, axis=1)
    assert max(residuals) < 25, 'Control alignment changed; review required'
    projected = orient(Polygon(np.array([p + [1] for p in config['outlinePixels']]) @ affine))
    assert projected.is_valid
    containing = unary_union([geometries[f'inao-denom-{i}'] for i in (444, 446)])
    outside = projected.difference(containing).area / projected.area
    shares = {str(i): projected.intersection(geometries[f'inao-denom-{i}']).area / projected.area for i in (444, 446)}
    # Sanity guards against a misplaced trace, not a claim of parcel accuracy.
    assert 1 < projected.area / 10000 < 4 and outside < .05
    assert .005 < shares['444'] < .15 and shares['446'] > .8
    geographic = transform(to_wgs84, projected)
    diagnostics = {
        'controlResidualMetres': [round(float(x), 2) for x in residuals],
        'controlRmsMetres': round(float(np.sqrt(np.mean(residuals**2))), 2),
        'illustratedAreaHa': round(projected.area / 10000, 4),
        'publishedAreaHa': config['publishedAreaHa'],
        'intersectionPercent': {i: round(share * 100, 2) for i, share in shares.items()},
        'outsideContainingClimatsPercent': round(outside * 100, 2),
        'caveat': 'Control residuals are not an accuracy bound. The schematic is larger than the published holding and includes road gaps; do not measure parcels or infer ownership from it.'
    }
    output = {key: config[key] for key in ('id', 'name', 'reviewedOn', 'source', 'method')}
    # Six decimal places keep numerical-library noise out of the checked-in
    # artifact. Coordinate digits do not imply surveyed accuracy.
    geometry = mapping(geographic)
    geometry['coordinates'] = [[[round(n, 6) for n in p] for p in ring] for ring in geometry['coordinates']]
    geographic = shape(geometry)
    assert geographic.is_valid
    # Put the badge above the northern tip so it does not cover this small plot.
    output.update(bounds=list(geographic.bounds), labelPoint=list(max(geographic.exterior.coords, key=lambda p: p[1])), geometry=geometry, diagnostics=diagnostics)
    text = json.dumps(output, ensure_ascii=False, indent=2) + '\n'
    destination = ROOT / 'src/lib/places/laMoutonneApproximation.json'
    if args.check:
        assert destination.read_text(encoding='utf-8') == text, 'Regenerate the reviewed approximation'
    else:
        destination.write_text(text, encoding='utf-8')
    print(json.dumps(diagnostics, indent=2))


if __name__ == '__main__':
    main()
