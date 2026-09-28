"""Build a separate cadastral display layer; never edit official cru geometry.

Uses scripts/burgundy-map-requirements.txt. Download the pinned cadastreUrl in
scripts/echezeaux-named-plots.json as lieux-dits-21267.json.gz in --source-dir.
"""
import argparse
import gzip
import hashlib
import json
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import shape, mapping, MultiPolygon
from shapely.ops import transform, unary_union

from build_burgundy_village_map import ROOT, key, read_json, write_json


def sha(data):
    return hashlib.sha256(data).hexdigest()


def polygons(geometry):
    if geometry.geom_type == 'Polygon':
        return [geometry]
    return [p for part in geometry.geoms for p in polygons(part)] if hasattr(geometry, 'geoms') else []


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, required=True)
    args = parser.parse_args()
    config = read_json(ROOT / 'scripts/echezeaux-named-plots.json')
    cadastre = (args.source_dir / 'lieux-dits-21267.json.gz').read_bytes()
    assert sha(cadastre) == config['cadastreSha256'], 'Review changed cadastral source'
    inputs = json.loads(gzip.decompress(cadastre))['features']
    assert all(f['properties']['commune'] == config['commune'] for f in inputs)
    catalogue = read_json(ROOT / 'src/lib/places/vosneVillageMapCatalogue.json')
    source_bytes = (ROOT / ('public' + catalogue['dataUrl'])).read_text(encoding='utf8').replace('\r\n', '\n').encode()
    # Guard the exact reviewed canonical file, not a neighbouring AOC or an
    # unreviewed regenerated boundary. Source provenance stays in its catalogue.
    baseline = next(m for m in read_json(ROOT / 'scripts/burgundy-lossless-map-report.json')['maps'] if m['id'] == 'vosne-romanee')
    assert sha(source_bytes) == baseline['sourceSha256'], 'Review changed parent source'
    parent_feature = next(f for f in json.loads(source_bytes)['features'] if f['id'] == config['parentFeatureId'])
    parent = shape(parent_feature['geometry'])
    project = Transformer.from_crs(4326, 2154, always_xy=True).transform
    area = lambda g: transform(project, g).area
    features, metadata, diagnostics, geometries = [], [], [], []
    for entry in config['plots']:
        found = [f for f in inputs if key(f['properties']['nom']) == key(entry['sourceName'])]
        assert len(found) == 1, f"Missing or duplicate cadastral name: {entry['sourceName']}"
        original = shape(found[0]['geometry'])
        assert original.is_valid and original.geom_type in ('Polygon', 'MultiPolygon')
        clipped = original.intersection(parent)
        parts = polygons(clipped)
        assert parts, f"Plot outside Échezeaux: {entry['name']}"
        geometry = parts[0] if len(parts) == 1 else MultiPolygon(parts)
        assert geometry.is_valid and not geometry.is_empty
        assert area(geometry.difference(parent)) < 0.000001
        # Keep all positive-area pieces and exclusions. No rounding, buffering,
        # snapping, sliver removal or gap filling is used to force coverage.
        assert abs(area(geometry) - area(clipped)) < 0.000001
        for previous in geometries:
            assert area(geometry.intersection(previous)) < 0.01, 'Overlapping named plots require review'
        geometries.append(geometry)
        point = max(parts, key=area).representative_point()
        properties = {
            'id': 'echezeaux-plot-' + entry['id'], 'name': entry['name'], 'kind': 'named_plot',
            'tier': 'grand_cru', 'appellationId': 179, 'denominationId': None,
            'parentFeatureId': config['parentFeatureId'], 'parentAppellation': 'Échezeaux',
            'sourceName': entry['sourceName'], 'communes': [config['commune']],
            'areaHa': round(area(geometry) / 10000, 6), 'matchId': '', 'atlasUrl': None,
            'bounds': list(geometry.bounds), 'labelPoint': [point.x, point.y],
        }
        features.append({'type': 'Feature', 'id': properties['id'], 'properties': properties, 'geometry': mapping(geometry)})
        metadata.append(properties)
        diagnostics.append({'id': properties['id'], 'sourceHa': area(original) / 10000, 'clippedHa': area(geometry) / 10000,
                            'parts': len(parts), 'holes': sum(len(p.interiors) for p in parts)})
    result = {'type': 'FeatureCollection', 'features': features}
    payload = (json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
    data_url = f'/maps/echezeaux-named-plots.{config["cadastreDate"]}.{sha(payload)[:12]}.geojson'
    (ROOT / ('public' + data_url)).write_bytes(payload)
    source = {'name': 'Cadastre Etalab lieux-dits', 'date': config['cadastreDate'], 'url': config['cadastreUrl'],
              'sha256': config['cadastreSha256'], 'license': 'Licence Ouverte 2.0'}
    layer = {'dataUrl': data_url, 'parentFeatureId': config['parentFeatureId'], 'source': source,
             'coverageNote': 'Échezeaux pilot: 10 cadastral named areas are mapped. Les Poulaillères remains unverified because the cadastral source says “LES POULA”. Cadastral areas are not separate INAO cru boundaries or producer holdings.',
             'features': metadata}
    write_json(ROOT / 'src/lib/places/echezeauxNamedPlotCatalogue.json', layer)
    write_json(ROOT / 'src/lib/places/echezeauxNamedPlotIndex.json', {
        'parentMatchId': 'france/burgundy/cote-de-nuits/echezeaux',
        'plots': [{'id': f'echezeaux-plot-{p["id"]}', 'name': p['name'], 'aliases': p['aliases']} for p in config['plots']]})
    write_json(ROOT / 'scripts/echezeaux-named-plot-report.json', {
        'method': 'Exact reviewed cadastral names intersected with the unchanged INAO Échezeaux boundary in WGS84; metric diagnostics in EPSG:2154.',
        'source': source, 'nameSourceUrl': config['nameSourceUrl'], 'nameSourceChecked': config['nameSourceChecked'],
        'parentSourceSha256': sha(source_bytes), 'parentSources': catalogue['sources'],
        'dataUrl': data_url, 'sha256': sha(payload), 'bytes': len(payload), 'gzipEquivalentBytes': len(gzip.compress(payload, mtime=0)),
        'parentHa': area(parent) / 10000, 'mappedHa': area(unary_union(geometries)) / 10000,
        'unmappedHa': area(parent.difference(unary_union(geometries))) / 10000,
        'plots': diagnostics, 'unresolved': config['unresolved']})
    print(f'{len(features)} plots, {len(payload)} bytes, {len(gzip.compress(payload, mtime=0))} gzip-equivalent bytes')


if __name__ == '__main__':
    main()
