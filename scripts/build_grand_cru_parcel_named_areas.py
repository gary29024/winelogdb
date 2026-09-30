"""Cadastral named area (lieu-dit) of every mapped parcel of a cru.

Uses the bundle's hash-pinned Etalab lieux-dits snapshots. Each parcel gets the lieu-dit
holding most of its geometry; the builder fails if any parcel is split below 90%.
Cadastral names without a reviewed crosswalk (the cru config's "unresolved") are kept
as printed, with no name, and any other unreviewed name fails the build.

  python scripts/build_grand_cru_parcel_named_areas.py --cru echezeaux
  python scripts/build_grand_cru_parcel_named_areas.py --cru echezeaux --check

Requires scripts/burgundy-map-requirements.txt.
"""
import argparse
import gzip
import json

from shapely.geometry import shape

from grand_cru import (communes, in_cru, lieux_dits_file, load_cru, load_manifest, parcel_asset, pinned, require,
                       research_path, source_dir, write_or_check)

MINIMUM_SHARE = 0.9


def build(cru, bundle, manifest, directory):
    config = cru['namedPlots']
    asset = parcel_asset(manifest)
    areas = []
    for insee in communes(bundle):
        data = pinned(directory, lieux_dits_file(insee), bundle['lieuxDits'][insee]['sha256'])
        areas += [(f['properties']['nom'], shape(f['geometry'])) for f in json.loads(gzip.decompress(data))['features']]
    reviewed = {p['sourceName']: p['name'] for p in config['plots']}
    parcels = {}
    for feature in json.loads(asset)['features']:
        props = feature['properties']
        if not in_cru(feature, cru['parentFeatureId']):
            continue
        geometry = shape(feature['geometry'])
        share, name = max((geometry.intersection(area).area / geometry.area, name) for name, area in areas)
        require(share >= MINIMUM_SHARE, f"{props['id']} is split between named areas")
        parcels[props['id']] = {'sourceName': name, 'name': reviewed.get(name), 'share': round(share, 4)}
    unreviewed = sorted({p['sourceName'] for p in parcels.values() if not p['name']})
    require(unreviewed == [u['sourceCandidate'] for u in config['unresolved']], f'Unexpected unreviewed names: {unreviewed}')
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
    write_or_check(research_path(cru, 'parcel-named-areas.json'), json.dumps(result, ensure_ascii=False, indent=1) + '\n', args.check)
    print(json.dumps({'parcels': len(result['parcels'])}))


if __name__ == '__main__':
    main()
