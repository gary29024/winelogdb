"""Download the pinned public inputs of a cru's commune bundle, once for every cru that shares it.

  python scripts/download_grand_cru_sources.py --cru echezeaux
  python scripts/download_grand_cru_sources.py --cru grands-echezeaux   # same Flagey bundle: nothing to fetch

Files land in .tmp/grand-cru-sources/<bundle>/ (or --source-dir). A file already present
with the pinned SHA-256 is kept; a changed source fails and must be reviewed before its
hash is updated. DGFiP members are read from the remote ZIP by HTTP range, never unpacked
from a local archive. Only the standard library is required.
"""
import argparse

from grand_cru import (SOURCE_ROOT, bundle_ids, bundle_sources, cadastre_sources, load_bundle, load_cru,
                       parcels_file, require, sha256, source_dir, vintage_file)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    selection = parser.add_mutually_exclusive_group(required=True)
    selection.add_argument('--cru')
    selection.add_argument('--all', action='store_true')
    parser.add_argument('--source-dir')
    args = parser.parse_args()
    bundles = [load_cru(args.cru)[1]] if args.cru else [load_bundle(b) for b in bundle_ids()]
    for bundle in bundles:
        download(bundle, args.source_dir)


def download(bundle, override=None):
    directory = source_dir(bundle, override)
    directory.mkdir(parents=True, exist_ok=True)
    aliases = {parcels_file(insee): vintage_file(insee, bundle['parcels']['cadastreDate'])
               for insee, _, _ in cadastre_sources(bundle)}
    for name, digest, get in bundle_sources(bundle):
        path = directory / name
        if path.exists() and sha256(path.read_bytes()) == digest:
            continue
        shared = SOURCE_ROOT / 'shared' / name
        if shared.exists() and sha256(shared.read_bytes()) == digest:
            continue
        dated = SOURCE_ROOT / 'shared' / aliases.get(name, name)
        if dated.exists() and sha256(dated.read_bytes()) == digest:
            path.write_bytes(dated.read_bytes())
            continue
        data = get()
        require(sha256(data) == digest, f'Changed source; review before updating hash: {name}')
        path.write_bytes(data)
        print(f'{name}: {len(data)} bytes, SHA-256 verified')
    print(f'{bundle["id"]}: all pinned inputs present in {directory}')


if __name__ == '__main__':
    main()
