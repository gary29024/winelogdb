"""Inventory, acquire and pin the official historical sources for Grand Cru bundles.

  python scripts/inventory_grand_cru_sources.py --all --pin
  python scripts/inventory_grand_cru_sources.py --rollout --pin
  python scripts/inventory_grand_cru_sources.py --cru echezeaux --pin

Catalogues are dated, byte-hashed snapshots. Every listed geometry vintage through
the pinned current geometry is attempted, including intermediate releases. Rights
and complete DFI department members are cached once across commune bundles. Failed
URLs remain in the inventory; rerun with --retry-missing to retry them. A normal
rerun reuses the dated inventory and verified bytes, including retrieval times.
Only the standard library is required. Updating the current map is a separate task.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import gzip
import json
from pathlib import Path
import re
import urllib.request

from grand_cru import (BUNDLE_DIR, CONFIG_DIR, ROOT, SOURCE_ROOT, bundle_ids, communes,
                       load_bundle, load_cru, read_json, relative, require, sha256, zip_member)

SOURCE_DIR = CONFIG_DIR / 'sources'
SHARED_DIR = SOURCE_ROOT / 'shared'
CATALOGUES = {
    'dfi': 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/documents-de-filiation-informatises-dfi-des-parcelles',
    'rights': 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/fichiers-des-locaux-et-des-parcelles-des-personnes-morales',
    'geometry': 'https://files.data.gouv.fr/cadastre/etalab-cadastre/',
}
MONTHS = {'janvier': '01', 'avril': '04', 'juillet': '07', 'octobre': '10'}


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def save_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')


def fetch_resource(url):
    """Decode HTTP transport encoding; retain hashes of both transport and resource."""
    request = urllib.request.Request(url, headers={'Accept-Encoding': 'identity'})
    with urllib.request.urlopen(request, timeout=60) as response:
        wire = response.read()
        encoding = response.headers.get('Content-Encoding')
        data = gzip.decompress(wire) if encoding == 'gzip' else wire
        return data, {'resolvedUrl': response.url, 'httpContentEncoding': encoding,
                      'transportSha256': sha256(wire), 'transportSize': len(wire)}


def acquire(source, *, retry_missing=False):
    """Cache by source identity and never invent a retrieval time for legacy bytes."""
    path = SHARED_DIR / source['fileName']
    metadata_path = SHARED_DIR / (source['fileName'] + '.metadata.json')
    if metadata_path.exists():
        metadata = read_json(metadata_path)
        require(metadata['url'] == source['url'] and metadata.get('member') == source.get('member'),
                f'Source cache identity collision: {source["fileName"]}')
        if metadata['status'] == 'obtained' and path.exists() and sha256(path.read_bytes()) == metadata['sha256']:
            return {**source, **metadata}
        if metadata['status'] == 'missing' and not retry_missing:
            return {**source, **metadata}
    SHARED_DIR.mkdir(parents=True, exist_ok=True)
    try:
        if source.get('member'):
            data, transport = zip_member(source['url'], source['member']), {}
        else:
            data, transport = fetch_resource(source['url'])
        metadata = {**source, **transport, 'status': 'obtained', 'retrievedAt': utc_now(),
                    'sha256': sha256(data), 'size': len(data)}
        path.write_bytes(data)
    except Exception as error:
        metadata = {**source, 'status': 'missing', 'attemptedAt': utc_now(), 'reason': str(error)}
    save_json(metadata_path, metadata)
    print(f'{source["id"]}: {metadata["status"]}', flush=True)
    return metadata


def department_bound(value, *, dfi=False):
    if value.lower().startswith('2a'):
        return 1  # lower archive bound; both Burgundy departments are above Corsica
    number = int(value)
    return number // 10 if dfi and len(value) == 3 and value.endswith('0') else number


def archive_covers(attachment_id, department, *, dfi=False):
    match = re.search(r'(?:depts?|dpts?)_?([0-9a-z]+)_?(?:a|\u00e0)_?(?:depts?_?)?([0-9]+)', attachment_id)
    if not match:
        # The April 2026 DFI archive is published without department bounds.
        return dfi and bool(re.fullmatch(r'documents_de_filiation_informatises_situation_[a-z]+_\d{4}zip', attachment_id))
    return department_bound(match[1], dfi=dfi) <= int(department) <= department_bound(match[2], dfi=dfi)


def rights_releases(catalogue, department):
    releases = []
    for item in catalogue['attachments']:
        match = re.search(r'^fichiers?_des_parcelles_situation_(\d{4})_', item['id'])
        if match and archive_covers(item['id'], department):
            releases.append({**item, 'asOf': match[1] + '-01-01'})
    dates = [r['asOf'] for r in releases]
    require(len(dates) == len(set(dates)), f'Ambiguous rights releases for department {department}')
    require(releases, f'No rights release found for department {department}')
    return sorted(releases, key=lambda r: r['asOf'])


def dfi_releases(catalogue, department):
    releases = []
    for item in catalogue['attachments']:
        match = re.search(r'situation_(janvier|avril|juillet|octobre)_(\d{4})', item['id'])
        if match and item['mimetype'] == 'application/zip' and archive_covers(item['id'], department, dfi=True):
            releases.append({**item, 'asOf': match[2] + '-' + MONTHS[match[1]] + '-01'})
    require(releases, f'No supported complete DFI archive found for department {department}')
    dates = [r['asOf'] for r in releases]
    require(len(dates) == len(set(dates)), f'Ambiguous DFI releases for department {department}')
    return sorted(releases, key=lambda r: r['asOf'])


def geometry_releases(html):
    return sorted(set(re.findall(r'href=["\'][^"\']*?(\d{4}-\d{2}-\d{2})/["\']', html)))


def dfi_schema(catalogue):
    dated = []
    for item in catalogue['attachments']:
        match = re.fullmatch(r'documents_de_filiation_informatises_descriptif_du_fichier_(janvier|avril|juillet|octobre)(\d{4})_pdf', item['id'])
        if match:
            dated.append((match[2] + '-' + MONTHS[match[1]], item))
    require(dated, 'No dated DFI schema found; review the changed catalogue')
    return max(dated, key=lambda v: v[0])


def catalogue_snapshot(kind, stamp):
    suffix = 'html' if kind == 'geometry' else 'json'
    path = SOURCE_DIR / 'catalogues' / stamp / f'{kind}.{suffix}'
    metadata_path = path.with_suffix(path.suffix + '.metadata.json')
    if path.exists() and metadata_path.exists():
        metadata = read_json(metadata_path)
        data = path.read_bytes()
        require(sha256(data) == metadata['sha256'], f'Changed catalogue snapshot: {path}')
    else:
        data, transport = fetch_resource(CATALOGUES[kind])
        metadata = {'url': CATALOGUES[kind], 'retrievedAt': utc_now(), 'sha256': sha256(data),
                    'size': len(data), **transport}
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        save_json(metadata_path, metadata)
    return (data.decode('utf-8') if kind == 'geometry' else json.loads(data)), {**metadata, 'path': relative(path)}


def discover(bundles, stamp, departments):
    catalogues, catalogue_metadata = {}, {}
    for kind in CATALOGUES:
        catalogues[kind], catalogue_metadata[kind] = catalogue_snapshot(kind, stamp)
    schema_version, schema = dfi_schema(catalogues['dfi'])
    schema_source = {'id': f'dfi-schema-{schema_version}', 'kind': 'dfi-schema', 'schemaVersion': schema_version,
                     'url': schema['url'], 'fileName': f'dfi-schema-{schema_version}.pdf',
                     'catalogueUrl': CATALOGUES['dfi'], 'sourceReleaseDate': None, 'asOf': None,
                     'licence': catalogues['dfi']['metas']['default']['license'],
                     'licenceUrl': catalogues['dfi']['metas']['default']['license_url']}
    sources = [schema_source]
    available = {'rights': {}, 'dfi': {}, 'geometry': {}}
    for department in departments:
        for kind, releases in [('rights', rights_releases(catalogues['rights'], department)),
                               ('dfi', dfi_releases(catalogues['dfi'], department))]:
            available[kind][department] = releases
            selected = releases[-1:] if kind == 'dfi' else releases
            licence = catalogues[kind]['metas']['default']
            for item in selected:
                as_of = item['asOf']
                if kind == 'dfi':
                    member = f'dfiano-dep{department}0-{as_of[8:10]}{as_of[5:7]}{as_of[:4]}.txt'
                else:
                    # A changed extension or schema fails visibly for review.
                    extension = 'txt' if int(as_of[:4]) <= 2023 else 'csv'
                    member = f'PM_{as_of[2:4]}_NB_{department}0.{extension}'
                sources.append({'id': f'{kind}-{department}-{as_of}', 'kind': kind, 'department': department,
                                'departmentCode': department + '0', 'asOf': as_of, 'sourceReleaseDate': None,
                                'catalogueUrl': CATALOGUES[kind], 'url': item['url'], 'member': member,
                                'fileName': member, 'schemaVersion': schema_version if kind == 'dfi' else '24-column-parcels',
                                'encoding': 'ascii' if kind == 'dfi' else ('latin-1' if int(as_of[:4]) <= 2023 else 'utf-8-sig'),
                                'licence': licence['license'], 'licenceUrl': licence['license_url']})
    all_dates = geometry_releases(catalogues['geometry'])
    require(all_dates, 'No dated geometry releases found')
    current_dates = {}
    for bundle in bundles:
        for insee in communes(bundle):
            current_dates[insee] = max(current_dates.get(insee, ''), bundle['parcels']['cadastreDate'])
    for insee, current_date in sorted(current_dates.items()):
        dates = [d for d in all_dates if d <= current_date]
        available['geometry'][insee] = {'dates': dates, 'afterPinnedGeometry': [d for d in all_dates if d > current_date],
                                       'pinnedCurrentGeometry': current_date}
        for vintage in dates:
            name = f'parcelles-{insee}-{vintage}.json.gz'
            sources.append({'id': f'geometry-{insee}-{vintage}', 'kind': 'geometry', 'commune': insee,
                            'date': vintage, 'dateRole': 'cadastral-release-observation', 'asOf': vintage,
                            'sourceReleaseDate': vintage, 'catalogueUrl': CATALOGUES['geometry'],
                            'url': f'https://files.data.gouv.fr/cadastre/etalab-cadastre/{vintage}/geojson/communes/{insee[:2]}/{insee}/cadastre-{insee}-parcelles.json.gz',
                            'fileName': name, 'licence': 'Licence Ouverte / Open Licence',
                            'licenceUrl': 'https://www.data.gouv.fr/datasets/cadastre'})
    return sources, available, catalogue_metadata


def pin_bundles(bundles, inventory, inventory_path):
    for bundle in bundles:
        selected_communes = set(communes(bundle))
        departments = {c[:2] for c in selected_communes}
        obtained = [s for s in inventory['sources'] if s['status'] == 'obtained']
        # Retain failures in the inventory, even when they cannot become inputs.
        rights = [s for s in obtained if s['kind'] == 'rights' and s['department'] in departments
                  and s['asOf'] != bundle['parcels']['rightsAsOf']]
        cadastre = [s for s in obtained if s['kind'] == 'geometry' and s['commune'] in selected_communes
                    and s['date'] < bundle['parcels']['cadastreDate']]
        bundle['rightsHistory']['rights'] = [{k: s[k] for k in ('asOf', 'url', 'member', 'sha256', 'size', 'encoding', 'department')}
                                            for s in sorted(rights, key=lambda s: (s['asOf'], s['department']))]
        bundle['rightsHistory']['cadastre'] = [{k: s[k] for k in ('date', 'commune', 'url', 'sha256', 'size')}
                                              for s in sorted(cadastre, key=lambda s: (s['date'], s['commune']))]
        bundle['officialHistory'] = {'inventory': relative(inventory_path),
                                     'departments': sorted(departments), 'communes': sorted(selected_communes)}
        save_json(BUNDLE_DIR / (bundle['id'] + '.json'), bundle)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    selection = parser.add_mutually_exclusive_group(required=True)
    selection.add_argument('--cru')
    selection.add_argument('--all', action='store_true')
    selection.add_argument('--rollout', action='store_true', help='Acquire every INAO commune of all 33 history targets')
    parser.add_argument('--stamp', default=datetime.now(timezone.utc).date().isoformat())
    parser.add_argument('--departments', nargs='+', default=['21', '89'])
    parser.add_argument('--retry-missing', action='store_true')
    parser.add_argument('--pin', action='store_true')
    parser.add_argument('--workers', type=int, default=4)
    args = parser.parse_args()
    bundles = [load_cru(args.cru)[1]] if args.cru else [load_bundle(b) for b in bundle_ids()]
    acquisition_bundles = bundles
    if args.rollout:
        targets = read_json(CONFIG_DIR / 'rollout/history-targets.json')['targets']
        require(len(targets) == 33 and {t['issue'] for t in targets} == set(range(376, 409)), 'Incomplete history target inventory')
        wanted = sorted({c for target in targets for c in target['communeCodes']})
        acquisition_bundles = [{'parcels': {'commune': c, 'cadastreDate': '2026-06-01'}} for c in wanted]
    sources, available, metadata = discover(acquisition_bundles, args.stamp, args.departments)
    # Each source identity occurs once, independently of the number of crus.
    require(len({s['id'] for s in sources}) == len(sources), 'Duplicate acquisition request')
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        acquired = list(pool.map(lambda s: acquire(s, retry_missing=args.retry_missing), sources))
    inventory = {
        'schemaVersion': 1, 'catalogueDate': args.stamp, 'catalogues': metadata,
        'available': available, 'sources': sorted(acquired, key=lambda s: s['id']),
        'limitations': [
            'Catalogue availability is observed at the pinned UTC retrieval time, not a permanent cutoff.',
            'DFI is cumulative since departmental computerisation; rural consolidation correspondence is absent.',
            'DFI validation, geometry observations and 1 January rights snapshots have distinct date roles.',
            'A failed URL or an unsearched interval is a coverage gap, not absence of a historical record.',
            'Source release dates not supplied by the publisher remain null; as-of dates are retained separately.',
            'Sales and administrative notices require independent source inventories; these catalogues do not cover them.',
        ],
    }
    inventory_path = SOURCE_DIR / f'inventory-{args.stamp}.json'
    if inventory_path.exists():
        previous = read_json(inventory_path)
        require(previous['catalogues'] == metadata, 'Catalogue changed within a pinned inventory date')
        for kind in available:
            inventory['available'][kind] = {**previous['available'].get(kind, {}), **available[kind]}
        # A --cru acquisition must not erase the other bundles' source coverage.
        merged = {s['id']: s for s in previous['sources']}
        merged.update({s['id']: s for s in inventory['sources']})
        inventory['sources'] = [merged[k] for k in sorted(merged)]
    inventory['counts'] = {state: sum(s['status'] == state for s in inventory['sources']) for state in ('obtained', 'missing')}
    save_json(inventory_path, inventory)
    if args.pin:
        pin_bundles(bundles, inventory, inventory_path)
    print(json.dumps({'inventory': relative(inventory_path), 'obtained': sum(s['status'] == 'obtained' for s in acquired),
                      'missing': sum(s['status'] == 'missing' for s in acquired)}))


if __name__ == '__main__':
    main()
