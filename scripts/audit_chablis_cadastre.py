"""Read-only benchmark of the proposed Chablis cadastral reconstruction.

Uses the map builder's dependencies and pinned INAO release. Download sources
listed in docs/chablis-cadastre-audit.md to --source-dir first. Never writes map
geometry or a production crosswalk. Exit 2 means the proposed method failed.
"""
import argparse
import gzip
import hashlib
import io
import json
import zipfile
from pathlib import Path

import shapefile
from pyproj import CRS, Transformer
from shapely.geometry import shape
from shapely.ops import transform, unary_union

from build_burgundy_village_map import DATE, INAO_SHA256, INAO_URL, ROOT, key


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, required=True)
    parser.add_argument('--report', type=Path, required=True)
    args = parser.parse_args()
    config = json.loads((ROOT / 'scripts/chablis-cadastre-audit.json').read_text(encoding='utf-8'))
    manifest = []

    def source(filename, url, expected_hash=None):
        data = (args.source_dir / filename).read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        if expected_hash:
            assert digest == expected_hash, f'Unexpected source: {filename}'
        manifest.append({'file': filename, 'url': url, 'sha256': digest})
        return data

    source(config['cdc']['file'], config['cdc']['url'], config['cdc']['sha256'])
    archive = source(f'inao-{DATE}.zip', INAO_URL, INAO_SHA256)
    ids = {entry['denomination'] for entry in config['benchmarks']} | {438, 439}
    grouped = {d: [] for d in ids}
    with zipfile.ZipFile(io.BytesIO(archive)) as z:
        stem = f'{DATE}_delim-parcellaire-aoc-shp'
        crs = CRS.from_wkt(z.read(f'{stem}.prj').decode())
        assert crs.to_epsg() == 2154
        project = Transformer.from_crs(4326, crs, always_xy=True).transform
        with shapefile.Reader(**{ext: io.BytesIO(z.read(f'{stem}.{ext}')) for ext in ['shp', 'shx', 'dbf']}, encoding='utf-8') as reader:
            for record in reader.iterRecords():
                denomination = record.as_dict()['id_denom']
                if denomination in ids:
                    grouped[denomination].append(shape(reader.shape(record.oid).__geo_interface__))
    inao = {d: unary_union(polygons) for d, polygons in grouped.items()}
    assert all(g.is_valid and not g.is_empty for g in inao.values())
    codes = sorted({code for entry in config['benchmarks'] for code in entry['places']})
    cadastre = {}
    for code in codes:
        filename = f'lieux-dits-{code}.json.gz'
        url = f"https://cadastre.data.gouv.fr/data/etalab-cadastre/{config['cadastreDate']}/geojson/communes/89/{code}/cadastre-{code}-lieux_dits.json.gz"
        features = json.loads(gzip.decompress(source(filename, url, config['cadastreHashes'][code])))['features']
        assert all(f['properties']['commune'] == code for f in features)
        cadastre[code] = features

    results, candidates = [], []
    for entry in config['benchmarks']:
        lookups, polygons = [], []
        for code, names in entry['places'].items():
            for name in names:
                found = [f for f in cadastre[code] if key(f['properties']['nom']) == key(name)]
                geometries = [shape(f['geometry']) for f in found]
                assert all(g.is_valid and g.geom_type in ('Polygon', 'MultiPolygon') for g in geometries)
                lookups.append({'commune': code, 'name': name, 'matches': len(found)})
                polygons.extend(transform(project, g) for g in geometries)
        # Diagnostic only: union every exact match, including duplicate names,
        # to quantify a generous interpretation. Missing names remain missing;
        # never fuzzy-match or choose a polygon by its proximity to the target.
        derived = unary_union(polygons).intersection(inao[438])
        baseline = inao[entry['denomination']]
        delta = derived.symmetric_difference(baseline).area / baseline.area
        strict_names = all(row['matches'] == 1 for row in lookups)
        candidates.append(derived)
        results.append({
            'denomination': entry['denomination'], 'name': entry['name'], 'cdcPages': entry['pages'],
            'lookups': lookups, 'uniqueNamesPass': strict_names,
            'inaoHa': round(baseline.area / 10000, 4), 'diagnosticHa': round(derived.area / 10000, 4),
            'missingHa': round(baseline.difference(derived).area / 10000, 4),
            'extraHa': round(derived.difference(baseline).area / 10000, 4),
            'symmetricDifferencePercent': round(delta * 100, 4),
            'passes': strict_names and delta <= config['maximumSymmetricDifferenceRatio'],
        })
    known = unary_union([inao[entry['denomination']] for entry in config['benchmarks']])
    report = {
        'method': '2010 draft exact-name lieux-dits union intersected with INAO 438; diagnostics only',
        'tolerancePercent': config['maximumSymmetricDifferenceRatio'] * 100,
        'passed': all(row['passes'] for row in results), 'sources': manifest, 'benchmarks': results,
        'broadPremierHa': round(inao[438].area / 10000, 4),
        'knownEightUnionHa': round(known.area / 10000, 4),
        'broadOutsideKnownEightHa': round(inao[438].difference(known).area / 10000, 4),
        'broadOutsideDiagnosticUnionHa': round(inao[438].difference(unary_union(candidates)).area / 10000, 4),
        'grandCruWithinBroadPremierHa': round(inao[439].intersection(inao[438]).area / 10000, 4),
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    for row in results:
        print(f"{row['name']}: {'PASS' if row['passes'] else 'FAIL'}, symmetric difference {row['symmetricDifferencePercent']}%, name problems {[r for r in row['lookups'] if r['matches'] != 1]}")
    print(f"Publication gate: {'PASS' if report['passed'] else 'FAIL'}. No map files written.")
    return 0 if report['passed'] else 2


if __name__ == '__main__':
    raise SystemExit(main())
