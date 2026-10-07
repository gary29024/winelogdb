"""Cadastral named area (lieu-dit) of every mapped parcel of a cru.

Uses the bundle's hash-pinned Etalab lieux-dits snapshots. Each parcel gets the lieu-dit
holding most of its geometry; the builder fails if any parcel is split below 90%.
Cadastral names without a reviewed crosswalk (the cru config's "unresolved") are kept
as printed, with no name, and any other unreviewed name fails the build. A parcel that no
lieu-dit touches at all (a gap in the lieux-dits layer) keeps no source name; the config
must declare that gap as an unresolved entry whose "sourceCandidate" is null. A parcel that
only touches the cru edge can lie mostly in a neighbouring lieu-dit; the config lists those
names in "neighbouringLieuxDits", and the build fails if one holds a parcel mostly inside the cru.

  python scripts/build_grand_cru_parcel_named_areas.py --cru echezeaux
  python scripts/build_grand_cru_parcel_named_areas.py --cru echezeaux --check

Requires scripts/burgundy-map-requirements.txt.
"""
import argparse
import gzip
import json

from shapely.geometry import shape
from shapely.ops import unary_union

from grand_cru import (record_json, communes, in_cru, lieux_dits_file, load_cru, load_manifest, parcel_asset, pinned, require,
                       research_path, source_dir, write_or_check)

MINIMUM_SHARE = 0.9


def build(cru, bundle, manifest, directory):
    config = cru['namedPlots']
    asset = parcel_asset(manifest)
    by_name = {}
    for insee in communes(bundle):
        data = pinned(directory, lieux_dits_file(insee), bundle['lieuxDits'][insee]['sha256'])
        for f in json.loads(gzip.decompress(data))['features']:
            by_name.setdefault(f['properties']['nom'], []).append(shape(f['geometry']))
    # Same-name features (one lieu-dit recorded in pieces) form one named area.
    areas = [(name, shapes[0] if len(shapes) == 1 else unary_union(shapes)) for name, shapes in by_name.items()]
    reviewed = {p['sourceName']: p['name'] for p in config['plots']}
    parcels = {}
    for feature in json.loads(asset)['features']:
        props = feature['properties']
        if not in_cru(feature, cru['parentFeatureId']):
            continue
        geometry = shape(feature['geometry'])
        share, name = max((geometry.intersection(area).area / geometry.area, name) for name, area in areas)
        if share == 0:
            parcels[props['id']] = {'sourceName': None, 'name': None, 'share': 0}
            continue
        require(share >= MINIMUM_SHARE, f"{props['id']} is split between named areas")
        parcels[props['id']] = {'sourceName': name, 'name': reviewed.get(name), 'share': round(share, 4)}
    neighbouring = {n['sourceName'] for n in config.get('neighbouringLieuxDits', [])}
    require(not neighbouring & set(reviewed), 'A reviewed named area cannot also be a neighbouring lieu-dit')
    for feature in json.loads(asset)['features']:
        row = parcels.get(feature['properties']['id'])
        if row and row['sourceName'] in neighbouring:
            row['neighbouringLieuDit'] = True
            overlap = next(o for o in feature['properties']['overlaps'] if o['parentFeatureId'] == cru['parentFeatureId'])
            require(overlap['parcelPercent'] < 50, f"{feature['properties']['id']} lies mostly inside the cru, not on its edge")
    unreviewed = sorted({p['sourceName'] for p in parcels.values() if not p['name'] and p['sourceName'] and p['sourceName'] not in neighbouring})
    require(unreviewed == [u['sourceCandidate'] for u in config['unresolved'] if u['sourceCandidate'] is not None],
            f'Unexpected unreviewed names: {unreviewed}')
    require(neighbouring == {p['sourceName'] for p in parcels.values() if p.get('neighbouringLieuDit')},
            'Every neighbouring lieu-dit must hold at least one edge parcel')
    without_lieu_dit = any(p['sourceName'] is None for p in parcels.values())
    require(without_lieu_dit == any(u['sourceCandidate'] is None for u in config['unresolved']),
            'Parcels outside every lieu-dit need, and only they allow, an unresolved entry without a source candidate')
    inputs = {'parcelSnapshotSha256': manifest['sha256']}
    for index, insee in enumerate(communes(bundle)):
        suffix = '' if index == 0 else f'_{insee}'
        inputs[f'lieuxDitsUrl{suffix}'] = bundle['lieuxDits'][insee]['url']
        inputs[f'lieuxDitsSha256{suffix}'] = bundle['lieuxDits'][insee]['sha256']
    return {
        'schemaVersion': 1, 'parentFeatureId': cru['parentFeatureId'], 'inputs': inputs,
        'note': 'Cadastral lieu-dit by largest share of parcel geometry. "name" is null where no reviewed crosswalk exists.',
        'parcels': dict(sorted(parcels.items())),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--cru', required=True)
    parser.add_argument('--source-dir')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    cru, bundle = load_cru(args.cru)
    require('namedPlots' in cru, f'{cru["slug"]}: no reviewed named areas configured yet')
    result = build(cru, bundle, load_manifest(bundle), source_dir(bundle, args.source_dir))
    write_or_check(research_path(cru, 'parcel-named-areas.json'), record_json(result), args.check)
    print(json.dumps({'parcels': len(result['parcels'])}))


if __name__ == '__main__':
    main()
