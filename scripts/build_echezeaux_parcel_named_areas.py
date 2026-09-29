"""Cadastral named area (lieu-dit) of every mapped Échezeaux parcel.

Uses the hash-pinned Etalab lieux-dits snapshot already named in
scripts/echezeaux-named-plots.json. Each parcel gets the lieu-dit holding most of
its geometry; the builder fails if any parcel is split below 90%. This includes the
cadastral "LES POULA", whose identity with Les Poulaillères is still unreviewed.

  python scripts/build_echezeaux_parcel_named_areas.py --source-dir .tmp/echezeaux-sources --download
  python scripts/build_echezeaux_parcel_named_areas.py --source-dir .tmp/echezeaux-sources --check

Requires scripts/burgundy-map-requirements.txt.
"""
import argparse
import gzip
import hashlib
import json
import urllib.request
from pathlib import Path

from shapely.geometry import shape

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / 'scripts/echezeaux-named-plots.json'
MANIFEST = ROOT / 'src/lib/places/echezeauxParcelManifest.json'
OUTPUT = ROOT / 'docs/research/echezeaux-parcel-named-areas.json'
MINIMUM_SHARE = 0.9


def require(condition, message):
    if not condition:
        raise ValueError(message)


def source_path(source_dir):
    return source_dir / 'cadastre-21267-lieux_dits.json.gz'


def build(config, manifest, source_dir):
    data = source_path(source_dir).read_bytes()
    require(hashlib.sha256(data).hexdigest() == config['cadastreSha256'], 'Lieux-dits snapshot hash changed')
    asset = (ROOT / 'public' / manifest['dataUrl'].lstrip('/')).read_bytes().replace(b'\r\n', b'\n')
    require(hashlib.sha256(asset).hexdigest() == manifest['sha256'], 'Parcel snapshot hash changed')
    areas = [(f['properties']['nom'], shape(f['geometry'])) for f in json.loads(gzip.decompress(data))['features']]
    reviewed = {p['sourceName']: p['name'] for p in config['plots']}
    parcels = {}
    for feature in json.loads(asset)['features']:
        props = feature['properties']
        if not any(o['parentFeatureId'] == config['parentFeatureId'] for o in props['overlaps']):
            continue
        geometry = shape(feature['geometry'])
        share, name = max((geometry.intersection(area).area / geometry.area, name) for name, area in areas)
        require(share >= MINIMUM_SHARE, f"{props['id']} is split between named areas")
        parcels[props['id']] = {'sourceName': name, 'name': reviewed.get(name), 'share': round(share, 4)}
    unreviewed = sorted({p['sourceName'] for p in parcels.values() if not p['name']})
    require(unreviewed == [u['sourceCandidate'] for u in config['unresolved']], f'Unexpected unreviewed names: {unreviewed}')
    return {
        'schemaVersion': 1, 'parentFeatureId': config['parentFeatureId'],
        'inputs': {'parcelSnapshotSha256': manifest['sha256'], 'lieuxDitsUrl': config['cadastreUrl'],
                   'lieuxDitsSha256': config['cadastreSha256']},
        'note': 'Cadastral lieu-dit by largest share of parcel geometry. "name" is null where no reviewed crosswalk exists.',
        'parcels': dict(sorted(parcels.items())),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--source-dir', type=Path, required=True)
    parser.add_argument('--download', action='store_true')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    config = json.loads(CONFIG.read_text(encoding='utf-8'))
    if args.download:
        args.source_dir.mkdir(parents=True, exist_ok=True)
        # cadastre.data.gouv.fr redirects here; the file is the same pinned snapshot.
        url = config['cadastreUrl'].replace('https://cadastre.data.gouv.fr/data/', 'https://files.data.gouv.fr/cadastre/')
        with urllib.request.urlopen(url, timeout=120) as response:
            source_path(args.source_dir).write_bytes(response.read())
    result = build(config, json.loads(MANIFEST.read_text(encoding='utf-8')), args.source_dir)
    content = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
    if args.check:
        require(OUTPUT.exists() and OUTPUT.read_text(encoding='utf-8') == content, f'Stale output: {OUTPUT}')
    else:
        OUTPUT.write_text(content, encoding='utf-8', newline='\n')
    print(json.dumps({'parcels': len(result['parcels'])}))


if __name__ == '__main__':
    main()
