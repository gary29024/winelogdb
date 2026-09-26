"""Build reviewed regional denominations without changing the village registry.

Uses the same pinned sources, exact source CRS and full-precision polygons as
build_burgundy_village_map.py. Downloads are separate; see the regional guide.
"""
import argparse
import gzip
import hashlib
import json
import shutil
import zipfile
from collections import defaultdict
from pathlib import Path

import shapefile
from pyproj import CRS, Transformer
from shapely.geometry import shape
from shapely import make_valid
from shapely.ops import transform, unary_union

from build_burgundy_village_map import (
    ROOT, PLACES, DATE, CADASTRE_DATE, INAO_SHA256, INAO_URL,
    read_json, write_json, rounded, geometry_json,
)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-dir', type=Path, required=True)
    args = parser.parse_args()
    settings = read_json(ROOT / 'scripts/burgundy-regional-maps.json')
    maps = settings['maps']
    inventory = read_json(ROOT / 'scripts/burgundy-regional-map-coverage.json')['appellations']
    assert len(inventory) == 7
    assert sum(len(app['denominations']) for app in inventory) == 49
    mapped = {d['denominationId'] for app in inventory for d in app['denominations'] if d['status'] == 'mapped'}
    assert mapped == {m['denominationId'] for m in maps}
    archive = args.source_dir / f'inao-{DATE}.zip'
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == INAO_SHA256
    stem = f'{DATE}_delim-parcellaire-aoc-shp'
    with zipfile.ZipFile(archive) as z:
        for suffix in ('shp', 'shx', 'dbf'):
            with z.open(f'{stem}.{suffix}') as source, (args.source_dir / f'{stem}.{suffix}').open('wb') as dest:
                shutil.copyfileobj(source, dest)
        crs = CRS.from_wkt(z.read(f'{stem}.prj').decode())
        assert crs.to_epsg() == 2154
    to_wgs84 = Transformer.from_crs(crs, 4326, always_xy=True).transform
    to_source = Transformer.from_crs(4326, crs, always_xy=True).transform
    grouped, actual = defaultdict(list), defaultdict(lambda: defaultdict(set))
    app_ids = {app['appellationId'] for app in inventory}
    with shapefile.Reader(str(args.source_dir / stem), encoding='utf-8') as reader:
        for record in reader.iterRecords():
            row = record.as_dict()
            if row['id_app'] in app_ids:
                actual[row['id_app']][row['id_denom']].add(row['denom'])
            if row['id_denom'] in mapped:
                grouped[row['id_denom']].append((row, shape(reader.shape(record.oid).__geo_interface__)))
    for app in inventory:
        expected = {d['denominationId']: set(d['sourceNames']) for d in app['denominations']}
        assert actual[app['appellationId']] == expected, f"Review regional inventory: {app['name']}"

    outputs, registry = [], []
    for config in maps:
        rows = grouped[config['denominationId']]
        assert {r['id_app'] for r, _ in rows} == {config['appellationId']}
        assert {r['denom'] for r, _ in rows} == {config['sourceName']}
        # All three pilots share geometry across their allowed colours. A new
        # source variant or changed colour code must be reviewed, not merged.
        assert {r['cvi'] for r, _ in rows} == {config['sourceCvi']}
        assert sorted({r['insee'] for r, _ in rows}) == config['communes']
        colour_codes = {'R': 'red', 'B': 'white', 'S': 'rose'}
        assert sorted(colour_codes[code.strip()[1]] for code in config['sourceCvi'].split(',')) == sorted(config['wineColours'])
        whole_m = unary_union([geom for _, geom in rows])
        assert whole_m.is_valid
        whole = transform(to_wgs84, whole_m)
        # Côte d'Or has a point-touching ring that crosses itself at floating
        # precision after reprojection. Repair only that reviewed case, with a
        # strict source-CRS round-trip area bound; never buffer or
        # simplify away real parcels or holes.
        if not whole.is_valid:
            assert config['denominationId'] == 2840
            whole = make_valid(whole)
        round_trip = make_valid(transform(to_source, whole))
        difference = whole_m.symmetric_difference(round_trip).area
        assert difference < 0.01
        west, south, east, north = config['expectedBounds']
        assert west < whole.bounds[0] < whole.bounds[2] < east
        assert south < whole.bounds[1] < whole.bounds[3] < north
        feature_id = f"inao-denom-{config['denominationId']}"
        props = dict(id=feature_id, name=config['name'], tier='regional', kind='appellation',
                     appellationId=config['appellationId'], denominationId=config['denominationId'],
                     sourceName=config['sourceName'], communes=config['communes'], areaHa=round(whole_m.area / 10000, 2))
        features = [dict(type='Feature', id=feature_id, properties=props, geometry=geometry_json(whole))]
        point = whole.representative_point()
        metadata = dict(**props, matchId=feature_id, atlasUrl=None, bounds=rounded(whole.bounds), labelPoint=rounded([point.x, point.y]))
        communes, sources = [], [dict(name='INAO', date=DATE, url=INAO_URL, sha256=INAO_SHA256, license='Licence Ouverte')]
        for code in config['communes']:
            path = args.source_dir / f'commune-{code}.json.gz'
            data = json.loads(gzip.decompress(path.read_bytes()))
            assert len(data['features']) == 1 and data['features'][0]['properties']['id'] == code
            source = data['features'][0]
            # Navigation frames the INAO production parcels attributed to this
            # commune; it never clips/relabels the official regional highlight.
            local = transform(to_wgs84, unary_union([geom for r, geom in rows if r['insee'] == code]))
            local_point = local.representative_point()
            communes.append(dict(id=code, name=settings['communeNames'][code], bounds=rounded(local.bounds),
                                 labelPoint=rounded([local_point.x, local_point.y])))
            features.append(dict(type='Feature', id=f'commune-{code}',
                                 properties=dict(id=f'commune-{code}', name=settings['communeNames'][code], kind='commune', tier='commune'),
                                 geometry=geometry_json(shape(source['geometry']))))
            sources.append(dict(name='Cadastre Etalab', date=CADASTRE_DATE, license='Licence Ouverte 2.0',
                                url=f'https://cadastre.data.gouv.fr/data/etalab-cadastre/{CADASTRE_DATE}/geojson/communes/{code[:2]}/{code}/cadastre-{code}-communes.json.gz',
                                sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
        communes.sort(key=lambda c: c['name'])
        url = f"/maps/{config['id']}.{DATE}.geojson"
        catalogue = dict(id=config['id'], name=config['name'], region=config['region'], mapKind='regional',
                         communes=communes, dataUrl=url, bounds=rounded(whole.bounds), sources=sources, notes={}, features=[metadata],
                         coverageNote='A geographic denomination within Bourgogne AOC. The highlight shows its full INAO production area; named cuvées and producer holdings have no separate boundaries here.')
        outputs.extend([(ROOT / 'public' / url.lstrip('/'), dict(type='FeatureCollection', features=features), True),
                        (PLACES / f"{config['id']}MapCatalogue.json", catalogue, False)])
        registry.append({**{key: config[key] for key in ('id', 'name', 'region', 'aliases', 'compatibleRegions', 'wineColours')}, 'featureId': feature_id})
        print(f"{config['name']}: {len(communes)} communes, {props['areaHa']} ha, {len(rows)} source rows; round-trip difference {difference:.8f} m²")
    # No output is changed until every map and the full inventory validates.
    for path, value, compact in outputs:
        write_json(path, value, compact)
    # Other regional designations can conflict with a pilot label even though
    # their own maps are pending. Keep their names in the small identity index.
    other_names = {app['name'] for app in inventory if app['appellationId'] != 138}
    other_names.update(name for app in inventory for d in app['denominations']
                       if d['denominationId'] not in mapped | {362}
                       for name in d['sourceNames'])
    write_json(PLACES / 'burgundyRegionalMapRegistry.json', dict(maps=registry, otherAppellations=sorted(other_names)))


if __name__ == '__main__':
    main()
