"""Build reviewed regional denominations without changing the village registry.

Uses the same pinned sources and exact source CRS as build_burgundy_village_map.py.
Published regional geometry defaults to a 0.000001° grid (about 10 cm), with a
reviewed finer grid where necessary to retain holes. This keeps valid topology
and reduces the large regional files. Downloads are separate; see the regional guide.
"""
import argparse
import gzip
import hashlib
import json
import shutil
import zipfile
import geobuf
from collections import defaultdict
from pathlib import Path
from math import ceil, hypot

import shapefile
from pyproj import CRS, Transformer
from shapely.geometry import Polygon, shape
from shapely import get_parts, make_valid, set_precision, segmentize, prepare
from shapely.ops import transform, unary_union

from build_burgundy_village_map import (
    ROOT, PLACES, DATE, CADASTRE_DATE, INAO_SHA256, INAO_URL,
    read_json, write_json, rounded, geometry_json,
)


# Regional overviews are drawn at hillside-to-commune scale; about 10 cm of
# coordinate precision is invisible there. set_precision snaps to the grid and
# keeps topology valid, unlike plain rounding, which can cross narrow rings.
GRID = 1e-6


def trimmed(geom, source=None, grid=GRID):
    """Snap to the reviewed grid; verify nothing material moved in source CRS."""
    result = set_precision(geom, grid)
    assert result.is_valid and not result.is_empty
    if source is not None:
        projected = transform(source[1], result)
        prepare(projected)
        # Area moves by under 0.005% (edge shifts of centimetres), and only sub-2 m² slivers between
        # source parcels may close or vanish. No real parcel or hole is lost.
        assert abs(projected.area - source[0].area) < 5e-5 * source[0].area
        closed = [ring for part in get_parts(source[0]) for ring in part.interiors
                  if projected.contains(Polygon(ring).representative_point())]
        assert all(Polygon(ring).area < 2 for ring in closed)
        lost = [part for part in get_parts(source[0]) if not projected.intersects(part.representative_point().buffer(0.3))]
        assert all(part.area < 2 for part in lost)
    return result


def projected_boundary(source, config, forward, backward):
    """Retain reviewed touching rings without weakening the round-trip gate."""
    if config.get('projectionByPart'):
        assert config['denominationId'] == 362
        # Whole-MultiPolygon GEOS segmentize loses source parts here. Reproject
        # each part separately, adding collinear points only when needed. Keep
        # the untouched source union as the final round-trip reference.
        def sampled_ring(ring):
            points = list(ring.coords)
            result = []
            for a, b in zip(points, points[1:]):
                result.append(a)
                count = ceil(hypot(b[0] - a[0], b[1] - a[1]) / 20)
                result.extend((a[0] + (b[0] - a[0]) * i / count,
                               a[1] + (b[1] - a[1]) * i / count) for i in range(1, count))
            return result + [points[-1]]

        parts, total_difference = [], 0
        for part in get_parts(source):
            projected = make_valid(transform(forward, part))
            difference = part.symmetric_difference(make_valid(transform(backward, projected))).area
            if difference > 1e-5:
                sampled = Polygon(sampled_ring(part.exterior), [sampled_ring(ring) for ring in part.interiors])
                assert part.symmetric_difference(make_valid(sampled)).area < 0.01
                projected = make_valid(transform(forward, sampled))
                difference = part.symmetric_difference(make_valid(transform(backward, projected))).area
            total_difference += difference
            parts.extend(p for p in get_parts(projected) if p.geom_type == 'Polygon')
        assert total_difference < 0.01
        result = unary_union(parts)
        assert result.is_valid and not result.is_empty
        difference = source.symmetric_difference(make_valid(transform(backward, result))).area
        assert difference < 0.01
        return result, difference
    sampled = source
    if length := config.get('projectionSegmentLength'):
        assert config['denominationId'] in (1713, 2893, 2338) and length == 20
        # Collinear source-CRS vertices preserve the original straight edges.
        # Sampling before reprojection avoids cutting across touching rings on
        # long edges when the CRS transform curves them. No smoothing/buffering.
        sampled = segmentize(source, length)
        assert source.symmetric_difference(sampled).area < 0.01
    result = transform(forward, sampled)
    if not result.is_valid:
        assert config['denominationId'] in (2840, 1728, 1713, 2893, 389, 391, 394, 2338, 561)
        result = make_valid(result)
    if config['denominationId'] in (1713, 2893, 2338, 561) and result.geom_type == 'GeometryCollection':
        # Repaired point-touching rings can leave zero-area lines. Keep every
        # polygon, then check against the untouched source union below.
        result = unary_union([part for part in get_parts(result) if part.geom_type in ('Polygon', 'MultiPolygon')])
    assert result.is_valid and result.geom_type in ('Polygon', 'MultiPolygon')
    difference = source.symmetric_difference(make_valid(transform(backward, result))).area
    assert difference < 0.01
    return result, difference


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-dir', type=Path, required=True)
    args = parser.parse_args()
    settings = read_json(ROOT / 'scripts/burgundy-regional-maps.json')
    maps = settings['maps']
    inventory = read_json(ROOT / 'scripts/burgundy-regional-map-coverage.json')['appellations']
    assert len(inventory) == 7
    assert sum(len(app['denominations']) for app in inventory) == 49
    mapped = {d['denominationId'] for app in inventory for d in app['denominations'] if d['status'] in ('mapped', 'partial')}
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
                source_shape = reader.shape(record.oid)
                ring_review = {
                    (362, '71494'): (1781, 7, 1, 1.1577),
                    (389, '71360'): (288, 52, 67, 7.62945),
                    (391, '71360'): (289, 52, 67, 7.62945),
                    (394, '71360'): (290, 52, 67, 7.5912795),
                    (561, '69126'): (474, 40, 6, 0.1815300567),
                    (561, '69165'): (474, 135, 11, 0.56),
                    (561, '69198'): (474, 90, 5, 2.28),
                    (561, '71360'): (474, 51, 69, 7.98),
                    (561, '71574'): (474, 27, 9, 139.6),
                }
                if review := ring_review.get((row['id_denom'], row['insee'])):
                    # Reviewed touching/nearly degenerate holes either confuse
                    # pyshp's sample-point search or become exterior rings.
                    # Assign original oriented rings by full containment;
                    # no vertex moves and every exclusion keeps one shell.
                    assert row['id_aire'] == review[0]
                    rings = [source_shape.points[a:b] for a, b in zip(source_shape.parts, list(source_shape.parts)[1:] + [len(source_shape.points)])]
                    shells = [Polygon(r) for r in rings if shapefile.signed_area(r) < 0]
                    holes = [Polygon(r) for r in rings if shapefile.signed_area(r) > 0]
                    assert (len(shells), len(holes)) == review[1:3]
                    expected_hole_area = review[3]
                    assert any(abs(h.area - expected_hole_area) < 1e-6 for h in holes)
                    assert all(sum(shell.covers(h) for shell in shells) == 1 for h in holes)
                    geometry = unary_union([Polygon(shell.exterior, [h.exterior for h in holes if shell.covers(h)]) for shell in shells])
                    assert geometry.is_valid
                    assert abs(geometry.area + sum(shapefile.signed_area(r) for r in rings)) < 1e-6
                else:
                    geometry = shape(source_shape.__geo_interface__)
                grouped[row['id_denom']].append((row, geometry))
    for app in inventory:
        expected = {d['denominationId']: set(d['sourceNames']) for d in app['denominations']}
        assert actual[app['appellationId']] == expected, f"Review regional inventory: {app['name']}"

    outputs, binary_outputs, registry = [], [], []
    for config in maps:
        rows = grouped[config['denominationId']]
        # Retain every source parcel when old commune codes survive a merger.
        # Verify the original code set before grouping navigation under current
        # communes; no production geometry is clipped to administrative borders.
        if config.get('communeAliases'):
            aliases = config['communeAliases']
            assert sorted({r['insee'] for r, _ in rows}) == config['sourceCommunes']
            assert set(aliases).issubset(config['sourceCommunes'])
            assert set(aliases.values()).issubset(config['communes'])
            rows = [(dict(r, insee=aliases.get(r['insee'], r['insee'])), g) for r, g in rows]
        assert {r['id_app'] for r, _ in rows} == {config['appellationId']}
        equivalent_names = config.get('equivalentSourceNames', [])
        additional_names = config.get('additionalSourceNames', [])
        variants = config.get('sourceVariants', [])
        assert {r['denom'] for r, _ in rows} == {config['sourceName'], *equivalent_names, *(v['name'] for v in additional_names), *(v['name'] for v in variants)}
        # A reviewed same-colour source label can add parcels, unlike an exact
        # duplicate (Fuissé) or a separately displayed colour sector.
        for extra in additional_names:
            assert sorted({r['insee'] for r, _ in rows if r['denom'] == extra['name']}) == extra['communes']
        for variant in variants:
            assert sorted({r['insee'] for r, _ in rows if r['denom'] == variant['name']}) == variant['communes']
        # Fuissé repeats identical white-only geometry under two source labels.
        # Require exact topological equality per commune before treating a
        # reviewed alias as a duplicate; never merge distinct colour areas.
        for name in equivalent_names:
            for code in config['communes']:
                original = unary_union([g for r, g in rows if r['denom'] == config['sourceName'] and r['insee'] == code])
                duplicate = unary_union([g for r, g in rows if r['denom'] == name and r['insee'] == code])
                assert not original.is_empty and original.equals(duplicate)
        # A new source variant or changed colour code must be reviewed.
        assert {r['cvi'] for r, _ in rows} == {config['sourceCvi']}
        assert sorted({r['insee'] for r, _ in rows}) == config['communes']
        colour_codes = {'R': 'red', 'B': 'white', 'S': 'rose'}
        assert sorted({colour_codes[code.strip()[1]] for code in config['sourceCvi'].split(',')}) == sorted(config['wineColours'])
        if config.get('productStyle'):
            assert config['denominationId'] in (391, 561) and config['productStyle'] == 'sparkling'
            expected_category = 'Vin mousseux "Crémant"' if config['denominationId'] == 561 else 'Vin mousseux'
            assert {r['categorie'] for r, _ in rows} == {expected_category}
        whole_m = unary_union([geom for _, geom in rows])
        assert whole_m.is_valid
        whole, difference = projected_boundary(whole_m, config, to_wgs84, to_source)
        west, south, east, north = config['expectedBounds']
        assert west < whole.bounds[0] < whole.bounds[2] < east
        assert south < whole.bounds[1] < whole.bounds[3] < north
        feature_id = f"inao-denom-{config['denominationId']}"
        props = dict(id=feature_id, name=config['name'], tier='regional', kind='appellation',
                     appellationId=config['appellationId'], denominationId=config['denominationId'],
                     sourceName=config['sourceName'], communes=config['communes'], areaHa=round(whole_m.area / 10000, 2))
        # Reviewed finer grids preserve excluded holes and small production
        # areas. Keep the same gates at either precision; see each precisionNote.
        grid = config.get('coordinateGrid', GRID)
        assert grid in (GRID, 1e-7) or (config['denominationId'] == 362 and grid == 1e-9) or (config['denominationId'] == 561 and grid == 1e-8), 'Review a new precision before publishing'
        if config.get('coverage'):
            props['coverage'] = config['coverage']
        features = [dict(type='Feature', id=feature_id, properties=props, geometry=geometry_json(trimmed(whole, (whole_m, to_source), grid)))]
        point = whole.representative_point()
        metadata = dict(**props, matchId=feature_id, atlasUrl=None, bounds=rounded(whole.bounds), labelPoint=rounded([point.x, point.y]))
        metadata_list, notes = [metadata], {}
        # These are published source sectors, not complete red/white/rosé
        # eligibility areas. They remain selectable but never auto-locate a wine.
        for variant in variants:
            sector_m = unary_union([g for r, g in rows if r['denom'] == variant['name']])
            sector, _ = projected_boundary(sector_m, config, to_wgs84, to_source)
            assert sector_m.is_valid and sector.is_valid and not sector.is_empty
            assert sector_m.symmetric_difference(transform(to_source, sector)).area < 0.01
            assert sector_m.difference(whole_m).area < 0.01
            sector_id = feature_id + '-' + variant['id']
            sector_props = dict(props, id=sector_id, name=variant['label'], sourceName=variant['name'],
                                communes=variant['communes'], areaHa=round(sector_m.area / 10000, 2))
            sector_props.pop('coverage', None)
            if variant.get('sectorColour'):
                sector_props['sectorColour'] = variant['sectorColour']
            features.append(dict(type='Feature', id=sector_id, properties=sector_props,
                                 geometry=geometry_json(trimmed(sector, (sector_m, to_source), grid))))
            sector_point = sector.representative_point()
            metadata_list.append(dict(**sector_props, matchId=sector_id, atlasUrl=None, bounds=rounded(sector.bounds),
                                      labelPoint=rounded([sector_point.x, sector_point.y])))
            notes[sector_id] = dict(note=variant['note'])
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
                                 geometry=geometry_json(trimmed(shape(source['geometry'])))))
            sources.append(dict(name='Cadastre Etalab', date=CADASTRE_DATE, license='Licence Ouverte 2.0',
                                url=f'https://cadastre.data.gouv.fr/data/etalab-cadastre/{CADASTRE_DATE}/geojson/communes/{code[:2]}/{code}/cadastre-{code}-communes.json.gz',
                                sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
        communes.sort(key=lambda c: c['name'])
        url = f"/maps/{config['id']}.{DATE}.geojson"
        catalogue = dict(id=config['id'], name=config['name'], region=config['region'], mapKind='regional',
                         communes=communes, dataUrl=url, bounds=rounded(whole.bounds), sources=sources, notes=notes, features=metadata_list,
                         coverageNote=config.get('coverageNote', 'A geographic denomination within Bourgogne AOC. The highlight shows its full INAO production area; named cuvées and producer holdings have no separate boundaries here.'))
        if config.get('colourScope'):
            catalogue['colourScope'] = config['colourScope']
        if config.get('downloadTimeoutMs'):
            assert config['denominationId'] in (362, 389, 391, 394, 561, 1713, 2893, 2338) and config['downloadTimeoutMs'] == 60000
            catalogue['downloadTimeoutMs'] = config['downloadTimeoutMs']
        collection = dict(type='FeatureCollection', features=features)
        if config.get('compactDownload'):
            # Transport only: preserve the reviewed grid, every ring and every
            # property. Geobuf's default six decimals would erase narrow holes.
            assert config['denominationId'] in (362, 389, 391, 394, 561, 1713, 2893, 2338)
            encoded = geobuf.Encoder().encode(collection, precision=9 if grid == 1e-9 else 8 if grid == 1e-8 else 7, dim=2)
            canonical = json.loads(json.dumps(collection))  # tuples -> lists
            assert geobuf.decode(encoded) == canonical, 'Compact download changes the map'
            packed = gzip.compress(encoded, compresslevel=9, mtime=0)
            assert geobuf.decode(gzip.decompress(packed)) == canonical
            catalogue['geobufUrl'] = url.removesuffix('.geojson') + '.pbf.gz'
            binary_outputs.append((ROOT / 'public' / catalogue['geobufUrl'].lstrip('/'), packed))
        outputs.extend([(ROOT / 'public' / url.lstrip('/'), collection, True),
                        (PLACES / f"{config['id']}MapCatalogue.json", catalogue, False)])
        entry = {key: config[key] for key in ('id', 'name', 'region', 'aliases', 'compatibleRegions', 'wineColours')}
        # Reviewed site names require the matching base appellation on the wine.
        for key in ('siteNames', 'baseAppellations', 'matchAppellationOnly', 'conflictingNames', 'accessoryGrapes', 'broadAppellation', 'productStyle', 'additionalGrapes', 'labelMentions', 'grapeColourOverrides', 'labelTerms'):
            if key in config:
                entry[key] = config[key]
        registry.append({**entry, 'featureId': feature_id})
        print(f"{config['name']}: {len(communes)} communes, {props['areaHa']} ha, {len(rows)} source rows; round-trip difference {difference:.8f} m²; grid {grid:g}°")
    # No output is changed until every map and the full inventory validates.
    for path, value, compact in outputs:
        write_json(path, value, compact)
    for path, value in binary_outputs:
        path.write_bytes(value)
    # Other regional designations can conflict with a mapped label even though
    # their own maps are pending. Keep their names in the small identity index.
    other_names = {app['name'] for app in inventory if app['appellationId'] != 138}
    other_names.update(name for app in inventory for d in app['denominations']
                       if d['denominationId'] not in mapped | {362}
                       for name in d['sourceNames'])
    write_json(PLACES / 'burgundyRegionalMapRegistry.json', dict(maps=registry, otherAppellations=sorted(other_names)))


if __name__ == '__main__':
    main()
