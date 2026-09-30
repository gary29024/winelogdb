"""Audit a cru's INAO boundary against the cadastre of its own and neighbouring communes.

  python scripts/build_grand_cru_commune_audit.py --cru grands-echezeaux
  python scripts/build_grand_cru_commune_audit.py --cru grands-echezeaux --check

Import scope is the communes INAO lists for the cru. The audit proves that scope is complete:
every INAO commune is in the bundle, and the bundle's parcels cover the boundary apart from
small gaps between parcels (roads, paths). Neighbouring communes pinned in the bundle's
"auditCommunes" are measured, never imported: where the INAO line and the cadastral commune
line disagree, their parcels touch the cru by a few square metres. Each contact is published
with its area and share of the parcel.
Requires scripts/burgundy-map-requirements.txt and download_grand_cru_sources.py inputs.
"""
import argparse
import gzip
import json

from pyproj import Transformer
from shapely.geometry import shape
from shapely.ops import transform, unary_union

from grand_cru import (audit_file, bundle_commune_names, cadastre_sources, communes, commune_audit_path, load_cru, parcel_report_path, parcels_file,
                       pinned, read_json, require, source_dir, village_map, write_or_check)

MAX_UNCOVERED_SHARE = 0.001  # gaps between parcels; a missing commune would leave far more


def build(cru, bundle, directory):
    project = Transformer.from_crs(4326, 2154, always_xy=True).transform
    _, canonical, _ = village_map(bundle, cru['parentFeatureId'])
    feature = next(f for f in json.loads(canonical)['features'] if f['id'] == cru['parentFeatureId'])
    boundary = transform(project, shape(feature['geometry']))
    names = bundle_commune_names(bundle)

    def parcels(name, digest):
        return [transform(project, shape(f['geometry']))
                for f in json.loads(gzip.decompress(pinned(directory, name, digest)))['features']]

    own = []
    for insee, _, digest in cadastre_sources(bundle):
        own += parcels(parcels_file(insee), digest)
    covered = unary_union(own).intersection(boundary).area
    uncovered = boundary.area - covered
    require(uncovered / boundary.area <= MAX_UNCOVERED_SHARE, f'{cru["slug"]}: bundle communes leave {uncovered:.1f} m² uncovered')
    inao = feature['properties']['communes']
    require(set(inao) <= set(communes(bundle)), f'{cru["slug"]}: INAO commune missing from the bundle: {sorted(set(inao) - set(communes(bundle)))}')
    neighbours = []
    for insee, source in sorted(bundle.get('auditCommunes', {}).items()):
        require(insee not in inao, f'{cru["slug"]}: INAO lists {insee}; import it in the bundle instead of auditing it')
        contacts = []
        for f in json.loads(gzip.decompress(pinned(directory, audit_file(insee), source['sha256'])))['features']:
            metric = transform(project, shape(f['geometry']))
            overlap = metric.intersection(boundary).area
            if overlap > 0:
                contacts.append({'parcelId': f['properties']['id'], 'overlapM2': round(overlap, 2),
                                 'parcelPercent': round(100 * overlap / metric.area, 3)})
        contacts.sort(key=lambda c: (-c['overlapM2'], c['parcelId']))
        neighbours.append({'commune': insee, 'name': source['name'], 'url': source['url'], 'sha256': source['sha256'],
                           'contactAreaM2': round(sum(c['overlapM2'] for c in contacts), 1),
                           'contactsOverMinimumOverlap': sum(c['overlapM2'] > bundle['parcels']['minimumOverlapM2'] for c in contacts),
                           'maxParcelPercent': max((c['parcelPercent'] for c in contacts), default=0),
                           'contacts': contacts})
    report = read_json(parcel_report_path(bundle))
    contacts = [c for c in report['excludedBoundaryContacts'] if c['parentFeatureId'] == cru['parentFeatureId']]
    return {
        'schemaVersion': 1, 'parentFeatureId': cru['parentFeatureId'], 'name': cru['name'],
        'inaoCommunes': inao,
        'bundleCommunes': [{'commune': insee, 'name': names.get(insee), 'url': url, 'sha256': digest}
                           for insee, url, digest in cadastre_sources(bundle)],
        'boundaryAreaM2': round(boundary.area, 1),
        'coveredByBundleParcelsM2': round(covered, 1), 'uncoveredM2': round(uncovered, 1),
        'neighbours': neighbours,
        'excludedEdgeContacts': len(contacts),
        'note': ('Only communes listed by INAO are imported. Neighbouring-commune contacts are where the INAO boundary '
                 'and the cadastral commune line disagree; they are measured here and never added as parcels, whatever '
                 'their area. Uncovered area is the gaps between cadastral parcels inside the boundary.'),
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
    print(json.dumps({'uncoveredM2': result['uncoveredM2'], 'excludedEdgeContacts': result['excludedEdgeContacts'],
                      'neighbours': {n['name']: [n['contactAreaM2'], n['contactsOverMinimumOverlap'], n['maxParcelPercent']]
                                     for n in result['neighbours']}}, ensure_ascii=False))


if __name__ == '__main__':
    main()
