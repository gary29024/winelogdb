"""Persistent, offline-searchable archive of public administrative PDFs.

Use --archive-dir (or WINELOG_BULLETIN_ARCHIVE) to share one archive across
checkouts. PDF objects, the SQLite catalogue and retry state stay outside Git.
No daemon: fetch performs a bounded batch and leaves deferred work on disk.
"""
import argparse
import errno
import gzip
import hashlib
import http.client
import json
import os
import random
import re
import shutil
import sqlite3
import tempfile
import time
import unicodedata
import urllib.error
import urllib.request
from contextlib import contextmanager
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urldefrag, urljoin, urlsplit

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ARCHIVE = Path(os.environ.get('WINELOG_BULLETIN_ARCHIVE', ROOT / '.tmp/bulletin-archive'))
SCHEMA = """
CREATE TABLE IF NOT EXISTS documents (
 url TEXT PRIMARY KEY, host TEXT NOT NULL, corpus TEXT NOT NULL, expected_sha TEXT,
 state TEXT NOT NULL DEFAULT 'pending', sha256 TEXT, bytes INTEGER, final_url TEXT,
 etag TEXT, last_modified TEXT, attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt REAL NOT NULL DEFAULT 0, error TEXT, fetched_at REAL
);
CREATE TABLE IF NOT EXISTS hosts (host TEXT PRIMARY KEY, ready REAL NOT NULL, failures INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS discoveries (url TEXT, source TEXT, captured_at REAL, PRIMARY KEY(url,source));
CREATE TABLE IF NOT EXISTS listings (
 url TEXT PRIMARY KEY, corpus TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending',
 path TEXT, pdf_count INTEGER, error TEXT, attempts INTEGER NOT NULL DEFAULT 0, captured_at REAL
);
CREATE TABLE IF NOT EXISTS attempts (url TEXT, at REAL, status INTEGER, error TEXT);
CREATE TABLE IF NOT EXISTS pages (
 url TEXT, page INTEGER, text TEXT NOT NULL, folded TEXT NOT NULL, status TEXT NOT NULL,
 source_sha TEXT NOT NULL, provenance TEXT NOT NULL, PRIMARY KEY(url,page)
);
"""


def digest(path):
    with Path(path).open('rb') as handle:
        return hashlib.file_digest(handle, 'sha256').hexdigest()


def fold(text):
    return ' '.join(unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode().lower().split())


def checked_url(url):
    url = urldefrag(url.strip())[0]
    parts = urlsplit(url)
    if parts.scheme not in ('http', 'https') or not parts.hostname or parts.username or parts.password:
        raise ValueError(f'Expected a public HTTP(S) URL: {url}')
    return url


def read_links(paths):
    return list(dict.fromkeys(checked_url(line) for path in paths
                            for line in Path(path).read_text(encoding='utf-8-sig').splitlines()
                            if line.strip() and not line.lstrip().startswith('#')))


def retry_after(value, now):
    if not value:
        return 0
    try:
        return max(0, float(value))
    except ValueError:
        try:
            return max(0, parsedate_to_datetime(value).timestamp() - now)
        except (ValueError, TypeError, OverflowError):
            return 0


def atomic_text(path, value):
    """Keep the last complete export if Windows briefly refuses a file operation."""
    path = Path(path)
    for attempt in range(4):
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', newline='\n',
                                             dir=path.parent, prefix=path.name + '.',
                                             suffix='.new', delete=False) as output:
                temporary = Path(output.name)
                output.write(value)
                output.flush()
                os.fsync(output.fileno())
            temporary.replace(path)
            return
        except OSError as error:
            if attempt == 3 or (error.errno not in (errno.EACCES, errno.EPERM, errno.EBUSY, errno.EINVAL)
                                and getattr(error, 'winerror', None) not in (32, 33)):
                raise
            time.sleep(0.25 * 2 ** attempt)
        finally:
            if temporary is not None:
                try:
                    temporary.unlink(missing_ok=True)
                except OSError:
                    pass  # Preserve the original error; a stray .new file is not a committed export.


def atomic_json(path, value):
    atomic_text(path, json.dumps(value, ensure_ascii=False))


@contextmanager
def writer_lock(root):
    """OS-held lock releases on process exit; no stale PID file or force-unlock."""
    with (root / 'acquisition.lock').open('a+b') as handle:
        handle.seek(0, 2)
        if not handle.tell():
            handle.write(b'0')
            handle.flush()
        handle.seek(0)
        try:
            if os.name == 'nt':
                import msvcrt
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as error:
            raise RuntimeError('Another downloader/import is using this archive; retry after it finishes') from error
        try:
            yield
        finally:
            handle.seek(0)
            if os.name == 'nt':
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(handle, fcntl.LOCK_UN)


class Deferred(Exception):
    pass


class InvalidPDF(ValueError):
    pass


class Archive:
    def __init__(self, root=DEFAULT_ARCHIVE, *, clock=time.time, opener=urllib.request.urlopen):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        for name in ('objects', 'partials', 'listings'):
            (self.root / name).mkdir(exist_ok=True)
        self.db = sqlite3.connect(self.root / 'archive.sqlite3', timeout=30)
        self.db.row_factory = sqlite3.Row
        self.db.executescript(SCHEMA)
        self.clock, self.opener = clock, opener

    def close(self):
        self.db.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()

    def enqueue(self, urls, corpus='regional-bfc', source='manual', expected=None):
        with self.db:
            for url in urls:
                url = checked_url(url)
                sha = (expected or {}).get(url)
                old = self.document(url)
                if old and sha and old['expected_sha'] and old['expected_sha'] != sha:
                    raise ValueError(f'Pinned source hash changed; review before replacing: {url}')
                if old and sha and old['sha256'] and old['sha256'] != sha:
                    raise ValueError(f'Existing PDF differs from the imported source pin: {url}')
                self.db.execute('INSERT OR IGNORE INTO documents(url,host,corpus,expected_sha) VALUES(?,?,?,?)',
                                (url, urlsplit(url).netloc.lower(), corpus, sha))
                if sha:
                    self.db.execute('UPDATE documents SET expected_sha=? WHERE url=?', (sha, url))
                self.db.execute('INSERT OR IGNORE INTO discoveries VALUES(?,?,?)', (url, source, self.clock()))

    def document(self, url):
        return self.db.execute('SELECT * FROM documents WHERE url=?', (url,)).fetchone()

    def object_path(self, sha):
        if not re.fullmatch('[0-9a-f]{64}', sha):
            raise ValueError('Invalid object hash')
        return self.root / 'objects' / sha[:2] / (sha + '.pdf')

    def local_pdf(self, url):
        row = self.document(url)
        if row and row['sha256']:
            path = self.object_path(row['sha256'])
            if path.exists() and digest(path) == row['sha256']:
                return path
        return None

    def store_pdf(self, url, path, metadata=None):
        """Transport integrity only; the scanner separately parses PDF pages."""
        size = path.stat().st_size
        with path.open('rb') as handle:
            start = handle.read(1024)
            handle.seek(max(0, size - 4096))
            end = handle.read()
        if not start.lstrip().startswith(b'%PDF-') or b'%%EOF' not in end:
            raise InvalidPDF('Response is not a complete PDF (signature/EOF check failed)')
        sha = digest(path)
        row = self.document(url)
        if row['expected_sha'] and sha != row['expected_sha']:
            raise InvalidPDF('PDF differs from the pinned source SHA-256; review the changed publication')
        dest = self.object_path(sha)
        dest.parent.mkdir(exist_ok=True)
        if not dest.exists() or digest(dest) != sha:
            temporary = dest.with_suffix('.new')
            shutil.copyfile(path, temporary)
            temporary.replace(dest)
        metadata = metadata or {}
        with self.db:
            self.db.execute("""UPDATE documents SET state='downloaded',sha256=?,bytes=?,final_url=?,
             etag=?,last_modified=?,fetched_at=?,next_attempt=0,error=NULL WHERE url=?""",
                            (sha, size, metadata.get('finalUrl', url), metadata.get('etag'),
                             metadata.get('lastModified'), self.clock(), url))
        return dest

    def import_pdf(self, url, path, corpus='regional-bfc'):
        self.enqueue([url], corpus, source=f'local import: {Path(path).name}')
        with writer_lock(self.root):
            return self.store_pdf(url, Path(path))

    def due_at(self, row):
        host = self.db.execute('SELECT ready FROM hosts WHERE host=?', (row['host'],)).fetchone()
        return max(row['next_attempt'], host['ready'] if host else 0)

    def _failure(self, row, error, status, delay_header, interval, transient):
        now = self.clock()
        host = self.db.execute('SELECT failures FROM hosts WHERE host=?', (row['host'],)).fetchone()
        failures = (host['failures'] if host else 0) + 1
        delay = max(interval, retry_after(delay_header, now), min(3600, 30 * 2 ** min(failures - 1, 7))
                    * random.uniform(1, 1.2)) if transient else interval
        with self.db:
            self.db.execute('INSERT OR REPLACE INTO hosts VALUES(?,?,?)',
                            (row['host'], now + delay, failures if transient else 0))
            self.db.execute('UPDATE documents SET state=?,error=?,next_attempt=? WHERE url=?',
                            ('retry' if transient else 'blocked', str(error)[:1000], now + delay, row['url']))
            self.db.execute('INSERT INTO attempts VALUES(?,?,?,?)', (row['url'], now, status, str(error)[:1000]))
        return None

    def fetch_one(self, url, *, min_interval=3, refresh=False):
        """One request attempt. Never sleep through a host cooldown or bypass it on rerun."""
        if min_interval < 0:
            raise ValueError('min_interval must be non-negative')
        url = checked_url(url)
        self.enqueue([url])
        with writer_lock(self.root):
            row = self.document(url)
            local = self.local_pdf(url)
            if local and not refresh:
                if row['state'] != 'blocked':
                    with self.db:
                        self.db.execute("UPDATE documents SET state='downloaded',error=NULL,next_attempt=0 WHERE url=?", (url,))
                return local
            if self.due_at(row) > self.clock():
                raise Deferred(f'Host/document cooldown until {self.due_at(row):.0f}')
            if row['state'] == 'blocked' and not refresh:
                raise Deferred(f'Blocked; inspect status and explicitly retry: {row["error"]}')
            key = hashlib.sha256(url.encode()).hexdigest()
            partial = self.root / 'partials' / (key + '.part')
            sidecar = partial.with_suffix('.json')
            saved = json.loads(sidecar.read_text()) if sidecar.exists() else {}
            offset = partial.stat().st_size if partial.exists() else 0
            resumable = bool(offset and (saved.get('etag') or '').startswith('"') and saved.get('ranges') == 'bytes')
            headers = {'User-Agent': 'WineLog-public-bulletin-archive/1.0', 'Accept-Encoding': 'identity'}
            if resumable:
                headers.update({'Range': f'bytes={offset}-', 'If-Range': saved['etag']})
            elif local and refresh:
                if row['etag']:
                    headers['If-None-Match'] = row['etag']
                elif row['last_modified']:
                    headers['If-Modified-Since'] = row['last_modified']
            with self.db:
                self.db.execute('UPDATE documents SET attempts=attempts+1 WHERE url=?', (url,))
                # A killed downloader still leaves pacing in place for the next process.
                self.db.execute('INSERT OR REPLACE INTO hosts VALUES(?,?,COALESCE((SELECT failures FROM hosts WHERE host=?),0))',
                                (row['host'], self.clock() + min_interval, row['host']))
            try:
                response = self.opener(urllib.request.Request(url, headers=headers), timeout=45)
                with response:
                    status = response.status
                    if status not in (200, 206):
                        raise InvalidPDF(f'Unexpected HTTP {status}')
                    metadata = {'etag': response.headers.get('ETag'), 'lastModified': response.headers.get('Last-Modified'),
                                'ranges': response.headers.get('Accept-Ranges'), 'finalUrl': response.geturl()}
                    total = None
                    if status == 206:
                        match = re.fullmatch(r'bytes (\d+)-(\d+)/(\d+)', response.headers.get('Content-Range', ''))
                        if not resumable or not match or int(match[1]) != offset or metadata['etag'] != saved['etag']:
                            partial.unlink(missing_ok=True)
                            sidecar.unlink(missing_ok=True)
                            raise OSError('Invalid range/validator response; next attempt will restart')
                        total = int(match[3])
                        if int(match[2]) + 1 != total:
                            raise OSError('Server returned an incomplete requested range')
                    else:
                        offset = 0  # a server ignoring Range returned the full representation
                    # Truncate before committing a new validator; an interrupted restart cannot pair old bytes with it.
                    with partial.open('ab' if status == 206 else 'wb') as output:
                        atomic_json(sidecar, metadata)
                        received = 0
                        while True:
                            try:
                                chunk = response.read(256 * 1024)
                            except http.client.IncompleteRead as error:
                                output.write(error.partial)
                                raise
                            if not chunk:
                                break
                            output.write(chunk)
                            received += len(chunk)
                    length = response.headers.get('Content-Length')
                    if length is not None and not length.isdigit():
                        raise InvalidPDF('Invalid Content-Length')
                    if length is not None and received != int(length):
                        raise OSError('Incomplete response body; kept partial download')
                    if total is not None and offset + received != total:
                        raise OSError('Incomplete range body; kept partial download')
                    dest = self.store_pdf(url, partial, metadata)
                    partial.unlink(missing_ok=True)
                    sidecar.unlink(missing_ok=True)
                    with self.db:
                        self.db.execute('INSERT OR REPLACE INTO hosts VALUES(?,?,0)',
                                        (row['host'], self.clock() + min_interval))
                        self.db.execute('INSERT INTO attempts VALUES(?,?,?,NULL)', (url, self.clock(), status))
                    return dest
            except urllib.error.HTTPError as error:
                with error:
                    if error.code == 304 and local and refresh:
                        with self.db:
                            self.db.execute("UPDATE documents SET state='downloaded',error=NULL,next_attempt=0,fetched_at=? WHERE url=?",
                                            (self.clock(), url))
                            self.db.execute('INSERT OR REPLACE INTO hosts VALUES(?,?,0)', (row['host'], self.clock() + min_interval))
                            self.db.execute('INSERT INTO attempts VALUES(?,?,304,NULL)', (url, self.clock()))
                        return local
                    if error.code == 416:
                        partial.unlink(missing_ok=True)
                        sidecar.unlink(missing_ok=True)
                    return self._failure(row, f'HTTP {error.code}: {error.reason}', error.code,
                                         error.headers.get('Retry-After'), min_interval,
                                         error.code in (408, 416, 425, 429) or error.code >= 500)
            except InvalidPDF as error:
                partial.unlink(missing_ok=True)
                sidecar.unlink(missing_ok=True)
                return self._failure(row, error, None, None, min_interval, False)
            except (OSError, urllib.error.URLError, http.client.HTTPException) as error:
                return self._failure(row, error, None, None, min_interval, True)

    def fetch_batch(self, limit=10, min_interval=3, max_wait=5, corpus=None):
        if limit < 1 or max_wait < 0 or min_interval < 0:
            raise ValueError('limit must be positive; wait and interval must be non-negative')
        done = 0
        corpora = [corpus] if isinstance(corpus, str) else list(corpus or [])
        while done < limit:
            scope = ' AND corpus IN (' + ','.join('?' for _ in corpora) + ')' if corpora else ''
            rows = self.db.execute("SELECT * FROM documents WHERE state IN ('pending','retry')" + scope, corpora).fetchall()
            if not rows:
                break
            # A persistently broken early URL must not starve the rest of its host's queue.
            row = min(rows, key=lambda r: (self.due_at(r), r['attempts'], r['url']))
            wait = self.due_at(row) - self.clock()
            if wait > max_wait:
                break  # leave the host cooldown and work durable; no unbounded sleeps
            if wait > 0:
                time.sleep(wait)
            try:
                self.fetch_one(row['url'], min_interval=min_interval)
            except Deferred:
                break
            done += 1
        return {'attempted': done, **self.status()}

    def status(self):
        counts = [dict(r) for r in self.db.execute('SELECT corpus,state,count(*) AS documents FROM documents GROUP BY corpus,state')]
        return {'archive': str(self.root), 'coverage': counts,
                'pdfObjects': self.db.execute('SELECT count(DISTINCT sha256) FROM documents WHERE sha256 IS NOT NULL').fetchone()[0],
                'searchablePages': self.db.execute('SELECT count(*) FROM pages').fetchone()[0],
                'listings': [dict(r) for r in self.db.execute('SELECT * FROM listings ORDER BY corpus,url')],
                'deferredHosts': [dict(r) for r in self.db.execute('SELECT * FROM hosts WHERE ready>?', (self.clock(),))],
                'problems': [dict(r) for r in self.db.execute("SELECT url,state,error,next_attempt FROM documents WHERE state IN ('retry','blocked')")]}

    def import_index(self, directory, legacy_search_hints=False):
        from build_bfc_bulletin_index import check, manifest_urls, validate_reviewed
        directory = Path(directory)
        communes = json.loads((directory / 'cote-dor-communes.json').read_text(encoding='utf-8'))['communes']
        reviewed = json.loads((directory / 'reviewed-parcels.json').read_text(encoding='utf-8'))
        coverage_doc = json.loads((directory / 'coverage.json').read_text(encoding='utf-8'))
        coverage = coverage_doc['bulletins']
        texts = [json.loads(line) for line in gzip.decompress((directory / 'notice-text.jsonl.gz').read_bytes()).splitlines()]
        if legacy_search_hints:
            # Never invent historical extraction success to upgrade a pre-status corpus.
            notices = json.loads((directory / 'notices.json').read_text(encoding='utf-8'))['notices']
            if any('pageStatus' in t for t in texts) or any('failedPages' in n for n in notices):
                raise ValueError('Legacy import is only for the original corpus without extraction statuses')
            if sorted(r['url'] for r in coverage) != sorted(manifest_urls(directory)):
                raise ValueError('Coverage does not match the link lists')
            if [t['id'] for t in texts] != [n['id'] for n in notices] or len({n['id'] for n in notices}) != len(notices):
                raise ValueError('Notice text IDs do not match the index')
            known = {r['bulletin']: r for r in coverage}
            for notice, text in zip(notices, texts):
                source = known.get(notice['bulletin'])
                if not source or not source.get('sha256') or notice['firstPage'] < 1 or notice['lastPage'] > source['pages']:
                    raise ValueError('Notice does not map to a declared source PDF')
                if set(text['pages']) != {str(p) for p in range(notice['firstPage'], notice['lastPage'] + 1)}:
                    raise ValueError('Notice page text is missing')
            validate_reviewed(reviewed, notices, communes)
        else:
            notices = check(directory, communes, reviewed)
        by_bulletin = {r['bulletin']: r for r in coverage}
        self.enqueue([r['url'] for r in coverage], source='BFC index: ' + digest(directory / 'coverage.json'),
                     expected={r['url']: r.get('sha256') for r in coverage})
        provenance = 'BFC notice index SHA-256 ' + digest(directory / 'notice-text.jsonl.gz')
        if legacy_search_hints:
            provenance += ' (legacy extraction status unknown; search hints only)'
        with self.db:
            for notice, text in zip(notices, texts):
                source = by_bulletin[notice['bulletin']]
                for page, value in text['pages'].items():
                    existing = self.db.execute('SELECT status,source_sha FROM pages WHERE url=? AND page=?',
                                               (source['url'], int(page))).fetchone()
                    if legacy_search_hints and existing and existing['source_sha'] == source['sha256'] and existing['status'] in ('text-layer', 'ocr', 'ocr-no-text-layer'):
                        continue  # an older search cache must not replace checked local extraction
                    self.db.execute('INSERT OR REPLACE INTO pages VALUES(?,?,?,?,?,?,?)',
                                    (source['url'], int(page), value, fold(value),
                                     'legacy-unverified' if legacy_search_hints else text['pageStatus'][page], source['sha256'], provenance))
        return self.status()

    def search(self, query, limit=20, corpus=None):
        # Literal AND terms, accent-insensitive. No SQL, FTS syntax or wildcard interpretation.
        terms = fold(query).split()
        if not terms:
            raise ValueError('Supply a nonempty search term')
        where = ' AND '.join('instr(p.folded,?) > 0' for _ in terms)
        rows = self.db.execute(f"""SELECT p.*,d.corpus,d.sha256 AS local_sha FROM pages p
         JOIN documents d ON d.url=p.url WHERE {where} AND (? IS NULL OR d.corpus=?)
         ORDER BY p.url,p.page LIMIT ?""", (*terms, corpus, corpus, limit))
        results = []
        for row in rows:
            local = self.local_pdf(row['url'])
            results.append({'url': row['url'] + '#page=' + str(row['page']), 'page': row['page'],
                            'corpus': row['corpus'], 'status': row['status'], 'sourceSha256': row['source_sha'],
                            'provenance': row['provenance'], 'localPdf': str(local) if local and row['local_sha'] == row['source_sha'] else None,
                            'text': row['text']})
        return results

    def index_scan(self, record):
        """Index checked per-page scanner output, retaining failures as labelled search hints."""
        if record.get('error'):
            return
        row = self.document(record['url'])
        if not row or row['sha256'] != record['sha256']:
            raise ValueError('Extraction must refer to the archived PDF hash')
        with self.db:
            for page, value in record['text'].items():
                self.db.execute('INSERT OR REPLACE INTO pages VALUES(?,?,?,?,?,?,?)',
                                (record['url'], int(page), value, fold(value), record['pageStatus'][page],
                                 record['sha256'], record.get('extractionVersion', 'scanner-schema-2')))

    def verify(self):
        missing = []
        for row in self.db.execute('SELECT url FROM documents WHERE sha256 IS NOT NULL').fetchall():
            if not self.local_pdf(row['url']):
                missing.append(row['url'])
                with self.db:
                    self.db.execute("UPDATE documents SET state='pending',error='Local PDF missing or corrupt' WHERE url=?", (row['url'],))
        return {'missingOrCorrupt': missing}

    def discover(self, html, source_url, corpus):
        source_url = checked_url(source_url)
        urls = []
        alternate = []

        class Links(HTMLParser):
            href = None
            label = ''

            def handle_starttag(self, tag, attrs):
                if tag == 'a':
                    href = dict(attrs).get('href', '')
                    url = urldefrag(urljoin(source_url, href))[0]
                    self.href, self.label = url, ''
                    if urlsplit(url).path.lower().endswith('.pdf'):
                        urls.append(checked_url(url))

            def handle_data(self, text):
                if self.href:
                    self.label += text

            def handle_endtag(self, tag):
                if tag == 'a' and self.href:
                    if re.search(r'\bRAA\s+n', self.label, re.I) and not urlsplit(self.href).path.lower().endswith('.pdf'):
                        alternate.append({'url': checked_url(self.href), 'title': ' '.join(self.label.split())})
                    self.href = None

        path = Path(html)
        Links().feed(path.read_text(encoding='utf-8-sig'))
        saved = self.root / 'listings' / (digest(path) + '.html')
        if not saved.exists():
            shutil.copyfile(path, saved)
        self.enqueue(urls, corpus, source=source_url + ' [saved HTML SHA-256 ' + digest(path) + ']')
        self.enqueue_alternates(alternate, corpus, source_url)
        with self.db:
            self.db.execute("""INSERT INTO listings(url,corpus,state,path,pdf_count,captured_at)
             VALUES(?,?,'saved',?,?,?) ON CONFLICT(url) DO UPDATE SET state='saved',path=excluded.path,
             pdf_count=excluded.pdf_count,error=NULL,captured_at=excluded.captured_at""",
                            (source_url, corpus, str(saved), len(set(urls)), self.clock()))
        return {'linksDiscovered': len(set(urls)), 'alternateLinks': alternate, 'savedListing': str(saved)}

    def enqueue_alternates(self, links, corpus, source):
        self.enqueue([link['url'] for link in links], corpus, source)
        with self.db:
            for link in links:
                self.db.execute("UPDATE documents SET state='needs-resolution',error=? WHERE url=? AND state='pending'",
                                ('Alternate publication link: ' + link['title'], link['url']))

    def fetch_listing(self, url, corpus, min_interval=3):
        """Acquire a listing once, sharing the PDF host cooldown; saved HTML can also be imported."""
        url = checked_url(url)
        host = urlsplit(url).netloc.lower()
        with self.db:
            self.db.execute('INSERT OR IGNORE INTO listings(url,corpus) VALUES(?,?)', (url, corpus))
        with writer_lock(self.root):
            row = self.db.execute('SELECT * FROM listings WHERE url=?', (url,)).fetchone()
            if row['state'] in ('saved', 'saved-manifest'):
                return {'linksDiscovered': row['pdf_count'], 'savedListing': row['path']}
            if row['state'] == 'blocked':
                raise Deferred(f'Listing blocked; explicitly retry after inspecting: {row["error"]}')
            host_row = self.db.execute('SELECT * FROM hosts WHERE host=?', (host,)).fetchone()
            if host_row and host_row['ready'] > self.clock():
                raise Deferred(f'Host cooldown until {host_row["ready"]:.0f}')
            with self.db:
                self.db.execute('UPDATE listings SET attempts=attempts+1 WHERE url=?', (url,))
                self.db.execute('INSERT OR REPLACE INTO hosts VALUES(?,?,?)',
                                (host, self.clock() + min_interval, host_row['failures'] if host_row else 0))
            try:
                request = urllib.request.Request(url, headers={'User-Agent': 'WineLog-public-bulletin-archive/1.0'})
                with self.opener(request, timeout=45) as response:
                    data = response.read(8 * 1024 * 1024 + 1)
                    if response.status != 200 or len(data) > 8 * 1024 * 1024 or b'<html' not in data.lower():
                        raise ValueError('Response is not a usable HTML listing')
                path = self.root / 'listings' / (hashlib.sha256(data).hexdigest() + '.html')
                path.write_bytes(data)
                result = self.discover(path, url, corpus)
                if not result['linksDiscovered']:
                    raise ValueError('Listing contains no PDF links; needs review, not complete coverage')
                with self.db:
                    self.db.execute('INSERT OR REPLACE INTO hosts VALUES(?,?,0)', (host, self.clock() + min_interval))
                return result
            except (OSError, urllib.error.URLError, http.client.HTTPException, ValueError) as error:
                delay_header = error.headers.get('Retry-After') if isinstance(error, urllib.error.HTTPError) else None
                if isinstance(error, urllib.error.HTTPError):
                    error.close()
                failures = (host_row['failures'] if host_row else 0) + 1
                delay = max(min_interval, retry_after(delay_header, self.clock()),
                            min(3600, 30 * 2 ** min(failures - 1, 7)) * random.uniform(1, 1.2))
                with self.db:
                    terminal = isinstance(error, urllib.error.HTTPError) and error.code in (400, 401, 403, 404, 410)
                    self.db.execute('UPDATE listings SET state=?,error=? WHERE url=?',
                                    ('blocked' if terminal else 'retry', str(error)[:1000], url))
                    self.db.execute('INSERT OR REPLACE INTO hosts VALUES(?,?,?)', (host, self.clock() + delay, failures))
                return {'error': str(error), 'retryAt': self.clock() + delay}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive-dir', type=Path, default=DEFAULT_ARCHIVE)
    sub = parser.add_subparsers(dest='command', required=True)
    add = sub.add_parser('enqueue', help='save a queue from URL lists, without downloading')
    add.add_argument('lists', nargs='+', type=Path)
    add.add_argument('--corpus', default='regional-bfc')
    discover = sub.add_parser('discover', help='extract PDF links from a browser-saved HTML listing, offline')
    discover.add_argument('html', type=Path)
    discover.add_argument('--source-url', required=True)
    discover.add_argument('--corpus', required=True)
    index = sub.add_parser('import-index', help='import the checked BFC page text; PDFs remain pending')
    index.add_argument('directory', type=Path)
    index.add_argument('--legacy-search-hints', action='store_true',
                       help='original pre-status corpus only; label every imported page legacy-unverified')
    local = sub.add_parser('import-pdf', help='retain an existing PDF without another download')
    local.add_argument('url')
    local.add_argument('path', type=Path)
    local.add_argument('--corpus', default='regional-bfc')
    fetch = sub.add_parser('fetch', help='download a bounded batch of eligible URLs')
    fetch.add_argument('--limit', type=int, default=10)
    fetch.add_argument('--min-interval', type=float, default=3)
    fetch.add_argument('--max-wait', type=float, default=5)
    fetch.add_argument('--corpus')
    one = sub.add_parser('fetch-url', help='queue/acquire one URL, or deliberately refresh a local copy')
    one.add_argument('url')
    one.add_argument('--refresh', action='store_true')
    one.add_argument('--corpus', default='regional-bfc')
    one.add_argument('--min-interval', type=float, default=3)
    retry = sub.add_parser('retry', help='requeue a blocked URL; preserves the host cooldown')
    retry.add_argument('url')
    search = sub.add_parser('search', help='search cached text offline; results are leads, not farming evidence')
    search.add_argument('query')
    search.add_argument('--limit', type=int, default=20)
    search.add_argument('--corpus')
    sub.add_parser('status')
    sub.add_parser('verify', help='check PDF hashes and requeue missing/corrupt objects')
    args = parser.parse_args()
    with Archive(args.archive_dir) as archive:
        if args.command == 'enqueue':
            for path in args.lists:
                archive.enqueue(read_links([path]), args.corpus, source=f'URL list {path.name} SHA-256 {digest(path)}')
            result = archive.status()
        elif args.command == 'discover':
            result = archive.discover(args.html, args.source_url, args.corpus)
        elif args.command == 'import-index':
            result = archive.import_index(args.directory, args.legacy_search_hints)
        elif args.command == 'import-pdf':
            result = {'pdf': str(archive.import_pdf(checked_url(args.url), args.path, args.corpus))}
        elif args.command == 'fetch':
            result = archive.fetch_batch(args.limit, args.min_interval, args.max_wait, args.corpus)
        elif args.command == 'fetch-url':
            url = checked_url(args.url)
            archive.enqueue([url], args.corpus)
            try:
                pdf = archive.fetch_one(url, min_interval=args.min_interval, refresh=args.refresh)
                result = {'pdf': str(pdf) if pdf else None, 'document': dict(archive.document(url))}
            except Deferred as error:
                result = {'deferred': str(error), 'document': dict(archive.document(url))}
        elif args.command == 'retry':
            url = checked_url(args.url)
            with archive.db:
                archive.db.execute("UPDATE documents SET state='pending',error=NULL,next_attempt=0 WHERE url=?", (url,))
                archive.db.execute("UPDATE listings SET state='pending',error=NULL WHERE url=?", (url,))
            result = archive.status()
        elif args.command == 'search':
            result = archive.search(args.query, args.limit, args.corpus)
        elif args.command == 'verify':
            result = archive.verify()
        else:
            result = archive.status()
        print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
