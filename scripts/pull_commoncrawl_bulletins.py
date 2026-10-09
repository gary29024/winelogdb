"""Recover inventoried bulletins that the Internet Archive lacks from Common Crawl (#461).

  python scripts/pull_commoncrawl_bulletins.py scan      # resumable; index lookups only
  python scripts/pull_commoncrawl_bulletins.py recover   # fetch, validate and store matches

The Common Crawl index server times out on prefix queries, so each crawl's
cluster.idx is binary-searched with byte-range requests and only the index blocks
covering the prefecture hosts are downloaded. A missing bulletin matches a record
only by its listed official URL (scheme, www and encoding aside) or the same
publisher document ID pair; filename-only matches are never used. Each record's
WARC response is fetched by byte range, and its body must pass the archive's PDF
signature/EOF check. Common Crawl truncated bodies at 1 MiB, and older crawls did
not flag it, so truncated copies are rejected and stay missing.
"""
import argparse
import gzip
import json
import re
import sys
import tempfile
import threading
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import unquote, urlsplit

from bulletin_archive import Archive, DEFAULT_ARCHIVE, InvalidPDF, ROOT, writer_lock

DATA = 'https://data.commoncrawl.org/'
AGENT = {'User-Agent': 'winelogdb-research (+https://github.com/gary29024/winelogdb)'}
PREFIXES = ['fr,gouv,yonne)/', 'fr,gouv,cote-dor)/', 'fr,gouv,pref,yonne)/', 'fr,gouv,pref,cote-dor)/']
SOURCES = ROOT / 'docs/research/earlier-bulletins/sources.json'
DOCUMENT_ID = re.compile(r'/(?:contenu/telechargement|content/download)/(\d+)/(\d+)/')


def request(url, start=None, end=None, method='GET'):
    headers = {**AGENT, **({'Range': f'bytes={start}-{end}'} if start is not None else {})}
    for attempt in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers, method=method), timeout=120) as response:
                if start is not None:
                    content_range = response.headers.get('Content-Range', '')
                    if response.status != 206 or not content_range.startswith(f'bytes {start}-{end}/'):
                        raise ValueError('Server did not honour the requested byte range')
                return response.headers if method == 'HEAD' else response.read()
        except ValueError:
            raise  # a full/mismatched response is not a usable ranged archive record
        except Exception as error:  # 403/503 are throttling here: back off longer
            print(f'  retry {attempt}: {error}', file=sys.stderr, flush=True)
            time.sleep((60 if any(code in str(error) for code in ('403', '503')) else 10) * (attempt + 1))
    raise ConnectionError(url)


def index_blocks(crawl, prefix):
    """cluster.idx rows for the zipnum blocks that can hold keys starting with prefix."""
    url = f'{DATA}cc-index/collections/{crawl}/indexes/cluster.idx'
    total = int(request(url, method='HEAD')['Content-Length'])
    low, high = 0, total
    while high - low > 8192:
        middle = (low + high) // 2
        chunk = request(url, middle, min(total - 1, middle + 4096)).split(b'\n', 1)[-1]
        key = chunk.split(b'\n', 1)[0].decode('utf-8', 'replace').split(' ', 1)[0]
        low, high = (middle, high) if key < prefix else (low, middle)
    rows = [line.split('\t') for line in request(url, low, min(total - 1, high + 200000)).decode('utf-8', 'replace').split('\n')[1:-1] if line]
    keep, previous = [], None
    for row in rows:
        key = row[0].split(' ', 1)[0]
        if key >= prefix and previous and not keep:
            keep.append(previous)  # the block before the first matching key can hold early matches
        if key.startswith(prefix):
            keep.append(row)
        elif key > prefix and keep:
            break
        previous = row
    return keep


def index_lines(crawl, prefix):
    found = []
    for row in index_blocks(crawl, prefix):
        filename, offset, length = row[1], int(row[2]), int(row[3])
        data = gzip.decompress(request(f'{DATA}cc-index/collections/{crawl}/indexes/{filename}', offset, offset + length - 1))
        for line in data.decode('utf-8', 'replace').split('\n'):
            if line.startswith(prefix):
                _, timestamp, record = line.split(' ', 2)
                found.append({**json.loads(record), 'timestamp': timestamp})
    return found


def scan(path, workers=2):
    crawls = [c['id'] for c in json.loads(urllib.request.urlopen('https://index.commoncrawl.org/collinfo.json', timeout=120).read())]
    done = set()
    if path.exists():
        done = {(r['crawl'], r['prefix']) for r in map(json.loads, path.open(encoding='utf-8')) if r.get('_done')}
    jobs = [(c, p) for c in crawls for p in PREFIXES
            if (c, p) not in done and not ('pref' in p and int(c.split('-')[2]) > 2016)]  # *.pref.gouv.fr retired
    lock, out = threading.Lock(), path.open('a', encoding='utf-8')

    def work(crawl, prefix):
        try:
            records = [r for r in index_lines(crawl, prefix) if r.get('status') == '200']
        except Exception as error:
            print(crawl, prefix, 'FAILED', error, flush=True)
            return
        with lock:
            for record in records:
                out.write(json.dumps({**record, 'crawl': crawl}) + '\n')
            out.write(json.dumps({'_done': True, 'crawl': crawl, 'prefix': prefix}) + '\n')
            out.flush()
            print(crawl, prefix, len(records), 'status-200 records', flush=True)

    print(len(jobs), 'lookups queued', flush=True)
    with ThreadPoolExecutor(workers) as pool:
        for job in jobs:
            pool.submit(work, *job)


def normalized(url):
    return unquote(re.sub(r'^https?://(www\.)?', '', url).replace(':80/', '/')).lower()


def publisher_document(url):
    """Document IDs are local to a prefecture, not unique across departments."""
    host = (urlsplit(url).hostname or '').lower().removeprefix('www.')
    host = host.replace('.pref.gouv.fr', '.gouv.fr')
    match = DOCUMENT_ID.search(url)
    if host in ('cote-dor.gouv.fr', 'yonne.gouv.fr') and match:
        return host, *match.groups()
    return None


def matches(missing, records):
    """{listed URL: [records]} by listed URL or the same publisher document ID pair only."""
    by_url, by_id = {}, {}
    for url in missing:
        by_url.setdefault(normalized(url), set()).add(url)
        if identity := publisher_document(url):
            by_id.setdefault(identity, set()).add(url)
    found = {}
    for record in records:
        urls = by_url.get(normalized(record['url']), set()) | by_id.get(publisher_document(record['url']), set())
        for url in sorted(urls):
            found.setdefault(url, []).append(record)
    return found


def warc_body(record):
    offset, length = int(record['offset']), int(record['length'])
    raw = gzip.decompress(request(DATA + record['filename'], offset, offset + length - 1))
    warc, rest = raw.split(b'\r\n\r\n', 1)
    http, body = rest.split(b'\r\n\r\n', 1)
    headers = dict(line.split(': ', 1) for line in warc.decode('latin-1').split('\r\n')[1:] if ': ' in line)
    return int(http.split(b' ', 2)[1]), headers, body


def recover(archive, scan_path):
    sources = json.loads(SOURCES.read_text(encoding='utf-8'))
    listed = set()
    with writer_lock(archive.root):
        for block in sources['departments'].values():
            for entry in block['years'] + [block['undated']]:
                urls = [item['url'] for item in entry['pdfs']]
                archive.enqueue(urls, entry['corpus'], source=str(SOURCES))
                listed.update(urls)
    missing = [u for u in sorted(listed) if archive.document(u)['state'] != 'downloaded' or not archive.local_pdf(u)]
    records = [r for r in map(json.loads, scan_path.open(encoding='utf-8')) if not r.get('_done')]
    stored = 0
    for url, candidates in matches(missing, records).items():
        for record in sorted((r for r in candidates if not r.get('truncated')), key=lambda r: r['timestamp'], reverse=True):
            status, headers, body = warc_body(record)
            if status != 200:
                continue
            final = (f"{DATA}{record['filename']}#offset={record['offset']}&length={record['length']}"
                     f"&record={headers.get('WARC-Record-ID', '')}")
            with tempfile.NamedTemporaryFile(dir=archive.root, suffix='.part', delete=False) as handle:
                handle.write(body)
            try:
                with writer_lock(archive.root):
                    archive.store_pdf(url, Path(handle.name), {'finalUrl': final})
            except InvalidPDF:
                continue  # truncated at 1 MiB without a flag; try an older record
            finally:
                Path(handle.name).unlink(missing_ok=True)
            with archive.db:
                archive.db.execute('INSERT INTO attempts VALUES(?,?,?,?)', (url, archive.clock(), 200, 'Common Crawl ' + record['crawl']))
            stored += 1
            print('stored', archive.document(url)['corpus'], url, record['crawl'], flush=True)
            break
    return stored


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('command', choices=('scan', 'recover'))
    parser.add_argument('--archive-dir', type=Path, default=DEFAULT_ARCHIVE)
    parser.add_argument('--scan-file', type=Path, help='resumable JSON Lines of index records (default: archive/manifests)')
    parser.add_argument('--workers', type=int, default=2)
    args = parser.parse_args()
    path = args.scan_file or args.archive_dir / 'manifests/commoncrawl-scan.jsonl'
    path.parent.mkdir(parents=True, exist_ok=True)
    if args.command == 'scan':
        scan(path, args.workers)
    else:
        with Archive(args.archive_dir) as archive:
            print(json.dumps({'stored': recover(archive, path)}))


if __name__ == '__main__':
    main()
