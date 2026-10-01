"""Measure production parcel/evidence payloads after npm run build (no network)."""
import argparse
import gzip
import json
from pathlib import Path
import re

from grand_cru import (REPORT_DIR, ROOT, app_bundle_ids, app_cru_slugs, load_bundle, load_manifest,
                       parcel_asset, relative, require, sha256, write_or_check)


def static_modules(pending, dist):
    modules = set()
    while pending:
        path = pending.pop().resolve()
        if path in modules:
            continue
        require(path.is_relative_to(dist.resolve()) and path.exists(), f'Unexpected build dependency: {path}')
        modules.add(path)
        module = path.read_text(encoding='utf-8')
        imports = re.findall(r'\b(?:import|export)[^;]*?\bfrom\s*[\"\'](\.[^\"\']+\.js)[\"\']', module)
        imports += re.findall(r'\bimport\s*[\"\'](\.[^\"\']+\.js)[\"\']', module)
        pending.extend(path.parent / name for name in imports)
    return modules


def measure(dist):
    chunks = []
    for slug in app_cru_slugs():  # hidden crus are not bundled into the app
        paths = list((dist / 'assets').glob(f'{slug}.evidence-*.js'))
        require(len(paths) == 1, f'Missing/ambiguous production evidence chunk: {slug}; rebuild first')
        raw = paths[0].read_bytes()
        chunks.append({'cru': slug, 'file': relative(paths[0]), 'sha256': sha256(raw),
                       'bytes': len(raw), 'gzipBytes': len(gzip.compress(raw, mtime=0))})
    # Follow only static module dependencies of the entry page. Dynamic imports
    # remain separate, so none of the history chunks may enter this initial set.
    html = (dist / 'index.html').read_text(encoding='utf-8')
    initial = static_modules([dist / name.lstrip('/') for name in re.findall(r'(?:src|href)="([^\"]+\.js)"', html)], dist)
    map_paths = list((dist / 'assets').glob('VillageMap-*.js'))
    require(len(map_paths) == 1, 'Missing/ambiguous production map chunk; rebuild first')
    map_modules = static_modules(map_paths, dist)
    require(all((ROOT / c['file']).resolve() not in initial | map_modules for c in chunks), 'History leaked into initial or map static imports')
    bundles = []
    for bundle_id in app_bundle_ids():
        manifest = load_manifest(load_bundle(bundle_id))
        raw = parcel_asset(manifest)
        bundles.append({'bundle': bundle_id, 'dataUrl': manifest['dataUrl'], 'sha256': sha256(raw),
                        'bytes': len(raw), 'gzipBytes': len(gzip.compress(raw, mtime=0))})
    return {'schemaVersion': 1, 'measurement': 'Production JS chunks and pinned GeoJSON; gzip level 9, mtime 0',
            'initialStaticModules': sorted(relative(p) for p in initial), 'evidenceInInitialStaticModules': 0,
            'mapStaticModules': sorted(relative(p) for p in map_modules), 'evidenceInMapStaticModules': 0,
            'evidenceChunkCount': len(chunks), 'evidenceBytesTotal': sum(c['bytes'] for c in chunks),
            'evidenceGzipBytesTotal': sum(c['gzipBytes'] for c in chunks),
            'parcelBundleBytesTotal': sum(b['bytes'] for b in bundles),
            'parcelBundleGzipBytesTotal': sum(b['gzipBytes'] for b in bundles),
            'evidenceChunks': chunks, 'parcelBundles': bundles}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dist', type=Path, default=ROOT / 'dist/client')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    result = measure(args.dist)
    write_or_check(REPORT_DIR / 'history-payload.json', json.dumps(result, ensure_ascii=False, indent=2) + '\n', args.check)
    print(json.dumps({k: v for k, v in result.items() if k not in ('evidenceChunks', 'parcelBundles', 'initialStaticModules', 'mapStaticModules')}))


if __name__ == '__main__':
    main()
