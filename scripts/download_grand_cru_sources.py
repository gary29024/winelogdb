"""Download the pinned public inputs of a cru's commune bundle, once for every cru that shares it.

  python scripts/download_grand_cru_sources.py --cru echezeaux
  python scripts/download_grand_cru_sources.py --cru grands-echezeaux   # same Flagey bundle: nothing to fetch

Files land in .tmp/grand-cru-sources/<bundle>/ (or --source-dir). A file already present
with the pinned SHA-256 is kept; a changed source fails and must be reviewed before its
hash is updated. DGFiP members are read from the remote ZIP by HTTP range, never unpacked
from a local archive. Only the standard library is required.
"""
import argparse

from grand_cru import bundle_sources, load_cru, require, sha256, source_dir


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--cru', required=True)
    parser.add_argument('--source-dir')
    args = parser.parse_args()
    _, bundle = load_cru(args.cru)
    directory = source_dir(bundle, args.source_dir)
    directory.mkdir(parents=True, exist_ok=True)
    for name, digest, get in bundle_sources(bundle):
        path = directory / name
        if path.exists() and sha256(path.read_bytes()) == digest:
            continue
        data = get()
        require(sha256(data) == digest, f'Changed source; review before updating hash: {name}')
        path.write_bytes(data)
        print(f'{name}: {len(data)} bytes, SHA-256 verified')
    print(f'{bundle["id"]}: all pinned inputs present in {directory}')


if __name__ == '__main__':
    main()
