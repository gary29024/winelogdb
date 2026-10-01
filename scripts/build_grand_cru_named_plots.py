"""Build a cru's cadastral named-area display layer; never edit official cru geometry.

  python scripts/build_grand_cru_named_plots.py --cru echezeaux

Uses scripts/burgundy-map-requirements.txt and the bundle's pinned lieux-dits snapshot
(download_grand_cru_sources.py). Only reviewed exact cadastral names in the cru config
are mapped; unresolved names keep the whole-cru fallback.
"""
import argparse
import gzip
import json

from pyproj import Transformer
from shapely.geometry import shape, mapping, MultiPolygon
from shapely.ops import transform, unary_union

from build_burgundy_village_map import ROOT, key, write_json
from grand_cru import (communes, lieux_dits_file, load_cru, named_plot_catalogue_path, named_plot_index_path,
                       named_plot_report_path, pinned, require, sha256, source_dir, village_map)


def polygons(geometry):
    if geometry.geom_type == 'Polygon':
        return [geometry]
    return [p for part in geometry.geoms for p in polygons(part)] if hasattr(geometry, 'geoms') else []


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--cru', required=True)
    parser.add_argument('--source-dir')
    args = parser.parse_args()
    cru, bundle = load_cru(args.cru)
    require('namedPlots' in cru, f'{cru["slug"]}: no reviewed named areas configured yet')
    config, cadastre_date = cru['namedPlots'], bundle['parcels']['cadastreDate']
    # A cru that is a single named area keeps its whole-cru outline; a duplicate layer adds nothing.
    display_layer = config.get('displayLayer', True)
    directory = source_dir(bundle, args.source_dir)
    inputs, lieux_dits = [], []
    for insee in communes(bundle):
        source = bundle['lieuxDits'][insee]
        features = json.loads(gzip.decompress(pinned(directory, lieux_dits_file(insee), source['sha256'])))['features']
        assert all(f['properties']['commune'] == insee for f in features)
        inputs += features
        lieux_dits.append((insee, source))
    catalogue, source_bytes, _ = village_map(bundle, cru['parentFeatureId'])
    parent_feature = next(f for f in json.loads(source_bytes)['features'] if f['id'] == cru['parentFeatureId'])
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
        assert parts, f"Plot outside {cru['name']}: {entry['name']}"
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
            'id': f'{cru["slug"]}-plot-' + entry['id'], 'name': entry['name'], 'kind': 'named_plot',
            'tier': 'grand_cru', 'appellationId': cru['appellationId'], 'denominationId': None,
            'parentFeatureId': cru['parentFeatureId'], 'parentAppellation': cru['name'],
            'sourceName': entry['sourceName'], 'communes': [found[0]['properties']['commune']],
            'areaHa': round(area(geometry) / 10000, 6), 'matchId': '', 'atlasUrl': None,
            'bounds': list(geometry.bounds), 'labelPoint': [point.x, point.y],
        }
        features.append({'type': 'Feature', 'id': properties['id'], 'properties': properties, 'geometry': mapping(geometry)})
        metadata.append(properties)
        diagnostics.append({'id': properties['id'], 'sourceHa': area(original) / 10000, 'clippedHa': area(geometry) / 10000,
                            'parts': len(parts), 'holes': sum(len(p.interiors) for p in parts)})
    if not display_layer:
        # Audit the same exact clipped polygons even when a whole-cru named area needs no duplicate app layer.
        write_json(named_plot_report_path(cru), {
            'method': f'Exact reviewed cadastral names intersected with the unchanged INAO {cru["name"]} boundary; metric diagnostics in EPSG:2154.',
            'displayLayer': False, 'coverageNote': config['coverageNote'],
            'sources': [{'commune': insee, **s, 'date': cadastre_date, 'license': bundle['parcels']['cadastreLicence']}
                        for insee, s in lieux_dits],
            'nameSourceUrl': config['nameSourceUrl'], 'nameSourceChecked': config['nameSourceChecked'],
            'parentSourceSha256': sha256(source_bytes), 'parentSources': catalogue['sources'],
            'parentHa': area(parent) / 10000, 'mappedHa': area(unary_union(geometries)) / 10000,
            'unmappedHa': area(parent.difference(unary_union(geometries))) / 10000,
            'plots': diagnostics, 'unresolved': config['unresolved'],
        })
        print(f'{len(features)} named areas audited; whole-cru outline retained ({config["coverageNote"]})')
        return
    result = {'type': 'FeatureCollection', 'features': features}
    payload = (json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
    data_url = f'/maps/{cru["slug"]}-named-plots.{cadastre_date}.{sha256(payload)[:12]}.geojson'
    (ROOT / ('public' + data_url)).write_bytes(payload)
    # The display source names one snapshot; a multi-commune cru lists every pinned file in its report.
    first = lieux_dits[0][1]
    source = {'name': 'Cadastre Etalab lieux-dits', 'date': cadastre_date, 'url': first['url'],
              'sha256': first['sha256'], 'license': bundle['parcels']['cadastreLicence']}
    layer = {'dataUrl': data_url, 'parentFeatureId': cru['parentFeatureId'], 'source': source,
             'coverageNote': config['coverageNote'], 'features': metadata}
    write_json(named_plot_catalogue_path(cru), layer)
    write_json(named_plot_index_path(cru), {
        'parentMatchId': config['parentMatchId'],
        'plots': [{'id': f'{cru["slug"]}-plot-{p["id"]}', 'name': p['name'], 'aliases': p['aliases']} for p in config['plots']]})
    report = {
        'method': f'Exact reviewed cadastral names intersected with the unchanged INAO {cru["name"]} boundary in WGS84; metric diagnostics in EPSG:2154.',
        'source': source}
    if len(lieux_dits) > 1:
        report['sources'] = [{'commune': insee, **s} for insee, s in lieux_dits]
    report.update({
        'nameSourceUrl': config['nameSourceUrl'], 'nameSourceChecked': config['nameSourceChecked'],
        'parentSourceSha256': sha256(source_bytes), 'parentSources': catalogue['sources'],
        'dataUrl': data_url, 'sha256': sha256(payload), 'bytes': len(payload), 'gzipEquivalentBytes': len(gzip.compress(payload, mtime=0)),
        'parentHa': area(parent) / 10000, 'mappedHa': area(unary_union(geometries)) / 10000,
        'unmappedHa': area(parent.difference(unary_union(geometries))) / 10000,
        'plots': diagnostics, 'unresolved': config['unresolved']})
    write_json(named_plot_report_path(cru), report)
    print(f'{len(features)} plots, {len(payload)} bytes, {len(gzip.compress(payload, mtime=0))} gzip-equivalent bytes')


if __name__ == '__main__':
    main()
