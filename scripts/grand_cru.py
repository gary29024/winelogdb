"""Shared configuration, paths and pinned-input helpers for the Grand Cru parcel pipeline.

Each cru has one config, scripts/grand-crus/<slug>.json, naming its INAO feature,
research tier and the commune bundle it belongs to. A bundle,
scripts/grand-crus/bundles/<id>.json, pins everything fetched once per commune set:
cadastre and lieux-dits snapshots, DGFiP rights files, cadastre vintages and DVF+.
Several crus share one bundle (Flagey serves Échezeaux and Grands-Échezeaux), so
downloads are never repeated, while each cru keeps its own research folder:

  docs/research/<slug>/                     curation and generated register (never shared)
  src/lib/places/grandCruParcels/           app-facing manifests, holder indexes and evidence

Only the standard library is needed here; geometry builders import shapely themselves.
"""
import gzip
import hashlib
import json
import os
import struct
import urllib.request
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG_DIR = ROOT / 'scripts/grand-crus'
BUNDLE_DIR = CONFIG_DIR / 'bundles'
REPORT_DIR = CONFIG_DIR / 'reports'
APP_DIR = ROOT / 'src/lib/places/grandCruParcels'
RESEARCH_DIR = ROOT / 'docs/research'
SOURCE_ROOT = ROOT / '.tmp/grand-cru-sources'
TIERS = {1, 2, 3}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def cru_slugs():
    return sorted(p.stem for p in CONFIG_DIR.glob('*.json'))


def bundle_ids():
    return sorted(p.stem for p in BUNDLE_DIR.glob('*.json'))


def load_bundle(bundle_id):
    bundle = read_json(BUNDLE_DIR / f'{bundle_id}.json')
    require(bundle['id'] == bundle_id, f'Bundle file name differs from its id: {bundle_id}')
    return bundle


def load_cru(slug):
    """Return (cru, bundle), checking that the two configs agree."""
    path = CONFIG_DIR / f'{slug}.json'
    require(path.exists(), f'Unknown cru: {slug}. Configured: {", ".join(cru_slugs())}')
    cru = read_json(path)
    require(cru['slug'] == slug, f'Cru file name differs from its slug: {slug}')
    require(cru['tier'] in TIERS, f'{slug}: research tier must be 1, 2 or 3')
    bundle = load_bundle(cru['bundle'])
    require(slug in bundle['crus'], f'{slug} is not listed in bundle {bundle["id"]}')
    require(cru['parentFeatureId'] in bundle['parcels']['parentFeatureIds'], f'{slug}: INAO feature absent from its bundle')
    maps = cru['villageMaps']
    require(maps and len(maps) == len(set(maps)), f'{slug}: villageMaps must be nonempty and unique')
    require(set(maps) <= set(bundle_village_maps(bundle)), f'{slug}: village map absent from its bundle')
    for other in cru['evidenceFrom']:
        require((CONFIG_DIR / f'{other}.json').exists() and 'research' in read_json(CONFIG_DIR / f'{other}.json'),
                f'{slug}: evidence source {other} has no research configured')
    return cru, bundle


def communes(bundle):
    """INSEE codes of every commune in a bundle; the first is the one the pilot schema names."""
    parcels = bundle['parcels']
    return [parcels['commune']] + [c['commune'] for c in parcels.get('additionalCommunes', [])]


def cadastre_sources(bundle):
    """Current cadastral parcel snapshot per commune: [(insee, url, sha256)]."""
    parcels = bundle['parcels']
    return [(parcels['commune'], parcels['cadastreUrl'], parcels['cadastreSha256'])] + [
        (c['commune'], c['cadastreUrl'], c['cadastreSha256']) for c in parcels.get('additionalCommunes', [])]


def source_dir(bundle, override=None):
    return Path(override) if override else SOURCE_ROOT / bundle['id']


# Conventional file names inside a bundle's source directory, shared by the downloader and every builder.
def parcels_file(insee):
    return f'parcelles-{insee}.json.gz'


def vintage_file(insee, date):
    return f'parcelles-{insee}-{date}.json.gz'


def lieux_dits_file(insee):
    return f'lieux-dits-{insee}.json.gz'


def audit_file(insee):
    """A neighbouring commune's parcels, used only to prove a cru does not cross into it."""
    return f'audit-parcelles-{insee}.json.gz'


def schema_file(bundle):
    return f'dgfip-{bundle["parcels"]["rightsAsOf"][:4]}-description.odt'


def pinned(directory, name, digest):
    path = Path(directory) / name
    if not path.exists():
        # Department rights/DFI and historical geometry are acquired once, even
        # when several bundles consume them. Legacy bundle-local inputs work too.
        path = SOURCE_ROOT / 'shared' / name
    data = path.read_bytes()
    require(sha256(data) == digest, f'Review changed input: {name}')
    return data


def official_inventory(bundle):
    config = bundle.get('officialHistory')
    return read_json(ROOT / config['inventory']) if config else None


def official_sources(bundle, kind):
    inventory = official_inventory(bundle)
    if inventory is None:
        return []
    config = bundle['officialHistory']
    return [s for s in inventory['sources'] if s['kind'] == kind
            and (kind == 'dfi-schema' or s.get('department') in config['departments']
                 or kind == 'sales' and s.get('region') == 'Bourgogne-Franche-Comté'
                 or s.get('commune') in config['communes'])]


# Conventional output paths. One cru's research lives only in its own folder.
def manifest_path(bundle):
    return APP_DIR / f'{bundle["id"]}.manifest.json'


def holder_index_path(bundle):
    return APP_DIR / f'{bundle["id"]}.holders.json'


def parcel_report_path(bundle):
    return REPORT_DIR / f'{bundle["id"]}-parcels.json'


def evidence_path(cru):
    return APP_DIR / f'{cru["slug"]}.evidence.json'


def named_plot_catalogue_path(cru):
    return APP_DIR / f'{cru["slug"]}.named-plots.json'


def named_plot_index_path(cru):
    return APP_DIR / f'{cru["slug"]}.named-plot-index.json'


def commune_audit_path(cru):
    return REPORT_DIR / f'{cru["slug"]}-commune-audit.json'


def app_cru_slugs():
    """Crus the app may show: only those whose commune-edge audit is committed (checked by test_grand_cru_config).

    A cru without one keeps its research and history files, but stays off the maps until its Tier 1 audit passes.
    """
    return [slug for slug in cru_slugs() if commune_audit_path(load_cru(slug)[0]).exists()]


def app_bundle_ids():
    """Bundles that serve at least one app-visible cru."""
    return sorted({load_cru(slug)[0]['bundle'] for slug in app_cru_slugs()})


def named_plot_report_path(cru):
    return REPORT_DIR / f'{cru["slug"]}-named-plots.json'


def research_dir(cru):
    return RESEARCH_DIR / cru['slug']


def research_path(cru, name):
    """name is one of README.md, curation.json, register.json, register.md, rights-history.json, sale-records.json, parcel-named-areas.json."""
    return research_dir(cru) / name


def relative(path, start=ROOT):
    """Repository-relative POSIX path, as written into generated files and links."""
    return Path(os.path.relpath(path, start)).as_posix()


def command(script, cru):
    return f'python scripts/{script} --cru {cru["slug"]}'


def load_manifest(bundle):
    return read_json(manifest_path(bundle))


def parcel_asset(manifest):
    """The bundle's published parcel file, as LF bytes. Git autocrlf may add CRs in a Windows checkout."""
    asset = (ROOT / 'public' / manifest['dataUrl'].lstrip('/')).read_bytes().replace(b'\r\n', b'\n')
    require(sha256(asset) == manifest['sha256'], 'Parcel snapshot hash changed')
    return asset


def in_cru(feature, parent):
    return any(o['parentFeatureId'] == parent for o in feature['properties']['overlaps'])


def bundle_village_maps(bundle):
    """The primary INAO source map and any other maps covered by this commune bundle."""
    maps = [bundle['villageMap'], *bundle.get('additionalVillageMaps', [])]
    require(len(maps) == len(set(maps)), f'{bundle["id"]}: duplicate village map')
    return maps


def _village_map(map_id):
    """One exact reviewed village map (INAO boundaries) and its catalogue."""
    entry = next(m for m in read_json(ROOT / 'scripts/burgundy-lossless-map-report.json')['maps'] if m['id'] == map_id)
    catalogue = read_json(ROOT / 'src/lib/places' / entry['catalogue'])
    canonical = (ROOT / ('public' + catalogue['dataUrl'])).read_text(encoding='utf8').replace('\r\n', '\n').encode()
    require(sha256(canonical) == entry['sourceSha256'], 'Review changed parent source')
    return catalogue, canonical, entry['sourceSha256']


def village_map(bundle, parent_feature_id=None):
    """The bundle's primary map, or a map containing a particular INAO feature.

    A cru can be shown on several village maps. Repeated copies of its official
    feature must agree before any builder uses one of them.
    """
    found = []
    for map_id in bundle_village_maps(bundle):
        item = _village_map(map_id)
        if parent_feature_id is None:
            return item
        feature = next((f for f in json.loads(item[1])['features'] if f['id'] == parent_feature_id), None)
        if feature is not None:
            found.append((item, feature))
    require(found, f'{bundle["id"]}: {parent_feature_id} absent from every village map')
    require(all(feature == found[0][1] for _, feature in found[1:]),
            f'{bundle["id"]}: {parent_feature_id} differs between village maps')
    return found[0][0]


def bundle_parent_features(bundle):
    """Collect every configured INAO feature across a bundle's village maps."""
    wanted = set(bundle['parcels']['parentFeatureIds'])
    parents, source_hashes = {}, {}
    for map_id in bundle_village_maps(bundle):
        _, canonical, digest = _village_map(map_id)
        source_hashes[map_id] = digest
        for feature in json.loads(canonical)['features']:
            if feature['id'] not in wanted:
                continue
            previous = parents.setdefault(feature['id'], feature)
            require(previous == feature, f'{feature["id"]} differs between village maps')
    require(set(parents) == wanted, f'{bundle["id"]}: INAO features missing from village maps: {sorted(wanted - set(parents))}')
    return parents, source_hashes


def bundle_commune_names(bundle):
    """Names from all reviewed village catalogues in a multi-map bundle."""
    names = {}
    for map_id in bundle_village_maps(bundle):
        catalogue, _, _ = _village_map(map_id)
        for commune in catalogue['communes']:
            previous = names.setdefault(commune['id'], commune['name'])
            require(previous == commune['name'], f'{commune["id"]} differs between village maps')
    return names


HOLDER_LINKS = RESEARCH_DIR / 'holders/holder-links.json'
ACTIVE_LINK_STATUSES = {'reviewed', 'provisional'}


def active_holder_links(entry, slug):
    """A holder's links that apply in this cru: reviewed or provisional, and unscoped or scoped to it."""
    return [link for link in (entry or {}).get('links', [])
            if link['reviewStatus'] in ACTIVE_LINK_STATUSES and slug in link.get('crus', [slug])]


def resolve_curation(curation, slug, links=None):
    """A cru's curation with candidate names drawn from the shared holder-to-domaine table.

    Holder research is done once per legal holder in docs/research/holders/holder-links.json. A cru adopts it with
    "holderLinks": "shared"; until then its holders keep no candidate. The cru's own basis, finding and sources stay;
    link sources are appended, and every shared source the curation cites is added to its source list."""
    links = read_json(HOLDER_LINKS) if links is None else links
    require(curation.get('holderLinks') in (None, 'shared'), f'{slug}: unknown holderLinks mode')
    require(not any('candidateNames' in h or 'legalIdentityCrosswalk' in h for h in curation['holders']),
            f'{slug}: candidate names and identity crosswalks belong in {relative(HOLDER_LINKS)}')
    shared = {s['id']: s for s in links['sources']}
    clash = sorted(shared.keys() & {s['id'] for s in curation['sources']})
    require(not clash, f'{slug}: source IDs also in the shared holder table: {", ".join(clash)}')
    adopted = curation.get('holderLinks') == 'shared'
    holders = []
    for h in curation['holders']:
        found = active_holder_links(links['holders'].get(h['holderId']), slug) if adopted else []
        # Two links can reach the same domaine (a succession and a recited lease); it is one candidate.
        holders.append({**h, 'candidateNames': list(dict.fromkeys(link['domaine'] for link in found)),
                        'sourceIds': list(dict.fromkeys(h['sourceIds'] + [s for link in found for s in link['sourceIds']]))})

    def strings(value):
        if isinstance(value, str):
            yield value
        elif isinstance(value, dict):
            for item in value.values():
                yield from strings(item)
        elif isinstance(value, list):
            for item in value:
                yield from strings(item)
    cited = set(strings({**curation, 'holders': holders})) & shared.keys()
    return {**curation, 'holders': holders, 'sources': curation['sources'] + [s for s in links['sources'] if s['id'] in cited]}


def record_json(value):
    """Generated research JSON with one compact line per record, so a changed parcel is a one-line diff.

    Top-level keys each take a line. A list puts each item on its own line; a mapping of records (e.g. parcels by
    reference) puts each entry on its own line. Everything else stays compact. Parses to exactly the same value.
    """
    def compact(item):
        return json.dumps(item, ensure_ascii=False, separators=(',', ':'))

    def field(item):
        if isinstance(item, list) and item:
            return '[\n' + ',\n'.join(compact(x) for x in item) + '\n]'
        if isinstance(item, dict) and item and all(isinstance(x, (dict, list)) for x in item.values()):
            return '{\n' + ',\n'.join(f'{compact(k)}:{compact(v)}' for k, v in item.items()) + '\n}'
        return compact(item)
    if not isinstance(value, dict):
        return compact(value) + '\n'
    return '{\n' + ',\n'.join(f'{compact(k)}:{field(v)}' for k, v in value.items()) + '\n}\n'


def write_or_check(path, content, check):
    path = Path(path)
    if check:
        require(path.exists() and path.read_text(encoding='utf-8') == content, f'Stale output: {relative(path)}')
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding='utf-8', newline='\n')


# Downloads: only pinned inputs, verified by hash; ZIP members are read by HTTP range, never extracted from disk.
def fetch(url, byte_range=None):
    headers = {'Accept-Encoding': 'identity'}
    if byte_range:
        headers['Range'] = byte_range
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=900) as response:
        require(not byte_range or response.status == 206, f'Range request not honoured: {url}')
        data = response.read()
        # The publisher sometimes ignores identity, including for the PDF schema.
        # Decode HTTP transport compression; .json.gz resources retain their gzip bytes.
        encoding = response.headers.get('Content-Encoding', '').lower()
        require(not byte_range or encoding in ('', 'identity'), f'Compressed range response: {url}')
        require(encoding in ('', 'identity', 'gzip'), f'Unsupported HTTP content encoding: {encoding}')
        return gzip.decompress(data) if encoding == 'gzip' else data


def zip_member(url, member):
    """Read one deflated member of a remote ZIP (including ZIP64 directories)."""
    tail = fetch(url, 'bytes=-65557')
    end = tail.rfind(b'PK\x05\x06')
    require(end >= 0, 'ZIP end record missing')
    size, offset = struct.unpack('<II', tail[end + 12:end + 20])
    if offset == 0xFFFFFFFF:
        z64 = tail.rfind(b'PK\x06\x06')
        size, offset = struct.unpack('<QQ', tail[z64 + 40:z64 + 56])
    directory, found, p = fetch(url, f'bytes={offset}-{offset + size - 1}'), [], 0
    while p < len(directory):
        require(directory[p:p + 4] == b'PK\x01\x02', 'Invalid central directory')
        method, = struct.unpack('<H', directory[p + 10:p + 12])
        crc, compressed, uncompressed = struct.unpack('<III', directory[p + 16:p + 28])
        name_len, extra_len, comment_len = struct.unpack('<HHH', directory[p + 28:p + 34])
        local, = struct.unpack('<I', directory[p + 42:p + 46])
        name = directory[p + 46:p + 46 + name_len].decode('cp437')
        extra, q = directory[p + 46 + name_len:p + 46 + name_len + extra_len], 0
        while q < len(extra):
            tag, length = struct.unpack('<HH', extra[q:q + 4])
            if tag == 1:  # ZIP64: 8-byte values replace, in order, each saturated 4-byte field.
                values = iter(struct.unpack(f'<{length // 8}Q', extra[q + 4:q + 4 + length // 8 * 8]))
                uncompressed = next(values) if uncompressed == 0xFFFFFFFF else uncompressed
                compressed = next(values) if compressed == 0xFFFFFFFF else compressed
                local = next(values) if local == 0xFFFFFFFF else local
            q += 4 + length
        if name.split('/')[-1] == member:
            found.append((method, crc, compressed, uncompressed, local))
        p += 46 + name_len + extra_len + comment_len
    require(len(found) == 1, f'Missing or ambiguous ZIP member: {member}')
    method, crc, compressed, uncompressed, local = found[0]
    require(method == 8, 'Unexpected ZIP compression')
    header = fetch(url, f'bytes={local}-{local + 29}')
    require(header[:4] == b'PK\x03\x04', 'Invalid local header')
    start = local + 30 + sum(struct.unpack('<HH', header[26:30]))
    data = zlib.decompress(fetch(url, f'bytes={start}-{start + compressed - 1}'), -15)
    require(len(data) == uncompressed and zlib.crc32(data) == crc, f'ZIP member check failed: {member}')
    return data


def cadastre_url(url):
    # cadastre.data.gouv.fr redirects here; the file is the same pinned snapshot.
    return url.replace('https://cadastre.data.gouv.fr/data/', 'https://files.data.gouv.fr/cadastre/')


def bundle_sources(bundle):
    """Every pinned input of a bundle: [(file name, sha256, fetcher)]. Each is downloaded once for all its crus."""
    parcels = bundle['parcels']
    wanted = [(parcels_file(insee), digest, lambda url=url: fetch(cadastre_url(url))) for insee, url, digest in cadastre_sources(bundle)]
    wanted += [(lieux_dits_file(insee), s['sha256'], lambda s=s: fetch(cadastre_url(s['url']))) for insee, s in bundle['lieuxDits'].items()]
    wanted.append((schema_file(bundle), parcels['schemaSha256'], lambda: fetch(parcels['schemaUrl'])))
    wanted.append((parcels['rightsMember'], parcels['rightsMemberSha256'], lambda: zip_member(parcels['rightsUrl'], parcels['rightsMember'])))
    history = bundle.get('rightsHistory')
    if history:
        wanted += [(r['member'], r['sha256'], lambda r=r: zip_member(r['url'], r['member'])) for r in history['rights']]
        wanted += [(vintage_file(c.get('commune', parcels['commune']), c['date']), c['sha256'], lambda c=c: fetch(c['url']))
                   for c in history['cadastre']]
    wanted += [(audit_file(insee), a['sha256'], lambda a=a: fetch(cadastre_url(a['url'])))
               for insee, a in bundle.get('auditCommunes', {}).items()]
    if sales := bundle.get('saleRecords'):
        wanted.append((sales['fileName'], sales['sha256'], lambda: fetch(sales['url'])))
    for kind in ('dfi', 'dfi-schema'):
        for item in official_sources(bundle, kind):
            if item['status'] == 'obtained':
                wanted.append((item['fileName'], item['sha256'],
                               lambda item=item: zip_member(item['url'], item['member']) if item.get('member') else fetch(item['url'])))
    names = [name for name, _, _ in wanted]
    require(len(names) == len(set(names)), 'Duplicate source file in bundle')
    return wanted
