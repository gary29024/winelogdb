"""Audit a cru's INAO boundary against the cadastre of its own and neighbouring communes.

  python scripts/build_grand_cru_commune_audit.py --cru grands-echezeaux
  python scripts/build_grand_cru_commune_audit.py --cru grands-echezeaux --check

Proves the bundle's communes are the right ones: no parcel of a neighbouring commune pinned in
the bundle's "auditCommunes" may overlap the cru by more than the bundle's minimum
overlap, and the bundle's own parcels must cover the cru apart from small gaps between
parcels (roads, paths). Edge contacts left out of the parcel file are listed.
Requires scripts/burgundy-map-requirements.txt and download_grand_cru_sources.py inputs.
"""
import argparse
import gzip
import json

from pyproj import Transformer
from shapely.geometry import shape
from shapely.ops import transform, unary_union

from grand_cru import (audit_file, cadastre_sources, commune_audit_path, load_cru, parcel_report_path, parcels_file,
                       pinned, read_json, require, source_dir, village_map, write_or_check)

MAX_UNCOVERED_SHARE = 0.001  # gaps between parcels; a missing commune would leave far more


def build(cru, bundle, directory):
    project = Transformer.from_crs(4326, 2154, always_xy=True).transform
    catalogue, canonical, _ = village_map(bundle)
    feature = next(f for f in json.loads(canonical)['features'] if f['id'] == cru['parentFeatureId'])
    boundary = transform(project, shape(feature['geometry']))
    names = {c['id']: c['name'] for c in catalogue['communes']}

    def parcels(name, digest):
        return [transform(project, shape(f['geometry']))
                for f in json.loads(gzip.decompress(pinned(directory, name, digest)))['features']]

    own = []
    for insee, _, digest in cadastre_sources(bundle):
        own += parcels(parcels_file(insee), digest)
    covered = unary_union(own).intersection(boundary).area
    uncovered = boundary.area - covered
    require(uncovered / boundary.area <= MAX_UNCOVERED_SHARE, f'{cru["slug"]}: bundle communes leave {uncovered:.1f} m² uncovered')
    neighbours = []
    for insee, source in sorted(bundle.get('auditCommunes', {}).items()):
        # The same rule as parcel admission: a neighbouring parcel overlapping by more than the minimum
        # would belong in the cru's parcel set, so the bundle would be missing a commune.
        overlaps = [p.intersection(boundary).area for p in parcels(audit_file(insee), source['sha256'])]
        crossing = [a for a in overlaps if a > bundle['parcels']['minimumOverlapM2']]
        require(not crossing, f'{cru["slug"]} crosses into commune {insee}: {len(crossing)} parcels over the minimum overlap')
        neighbours.append({'commune': insee, 'name': source['name'], 'url': source['url'], 'sha256': source['sha256'],
                           'overlapM2': round(sum(overlaps), 1), 'edgeContacts': sum(a > 0 for a in overlaps)})
    report = read_json(parcel_report_path(bundle))
    contacts = [c for c in report['excludedBoundaryContacts'] if c['parentFeatureId'] == cru['parentFeatureId']]
    return {
        'schemaVersion': 1, 'parentFeatureId': cru['parentFeatureId'], 'name': cru['name'],
        'inaoCommunes': feature['properties']['communes'],
        'bundleCommunes': [{'commune': insee, 'name': names.get(insee), 'url': url, 'sha256': digest}
                           for insee, url, digest in cadastre_sources(bundle)],
        'boundaryAreaM2': round(boundary.area, 1),
        'coveredByBundleParcelsM2': round(covered, 1), 'uncoveredM2': round(uncovered, 1),
        'neighbours': neighbours,
        'excludedEdgeContacts': len(contacts),
        'note': ('Uncovered area is the gaps between cadastral parcels inside the boundary. A neighbour overlap at or '
                 'below the minimum overlap is an edge contact, not a cross-commune parcel.'),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--cru', required=True)
    parser.add_argument('--source-dir')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    cru, bundle = load_cru(args.cru)
    result = build(cru, bundle, source_dir(bundle, args.source_dir))
    write_or_check(commune_audit_path(cru), json.dumps(result, ensure_ascii=False, indent=2) + '\n', args.check)
    print(json.dumps({k: result[k] for k in ('uncoveredM2', 'neighbours', 'excludedEdgeContacts')}))


if __name__ == '__main__':
    main()
