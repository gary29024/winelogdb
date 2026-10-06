"""Acquire earlier departmental bulletins from Internet Archive captures (#461).

The prefecture hosts refuse connections from the research network, so official
PDFs are taken from Wayback Machine captures of their original URLs:

  python scripts/pull_wayback_bulletins.py inventory --out docs/research/earlier-bulletins/sources.json
  python scripts/pull_wayback_bulletins.py alternates --sources docs/research/earlier-bulletins/sources.json
  python scripts/pull_wayback_bulletins.py pull --sources docs/research/earlier-bulletins/sources.json
  python scripts/pull_wayback_bulletins.py date --sources docs/research/earlier-bulletins/sources.json \
      --out docs/research/earlier-bulletins/undated-dating.json   # after text extraction

`inventory` resolves the latest complete capture of each annual listing, keeps
its raw HTML hash and PDF links, and adds filename-dated PDFs captured on the
publisher's domains for years without an archived listing. `pull` stores each
capture's raw bytes (`id_` mode) in the shared archive under the ORIGINAL
official URL; `final_url` records the exact capture. A missing capture stays an
explicit gap, never evidence that no bulletin or notice exists.
"""
import argparse
import hashlib
import http.client
import html
import json
import re
import sys
import tempfile
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote, urljoin

from bulletin_archive import Archive, DEFAULT_ARCHIVE, InvalidPDF, ROOT, atomic_json, atomic_text, writer_lock

CDX = 'https://web.archive.org/cdx/search/cdx'
PERMANENT = (403, 404, 410)  # no capture, or a capture withdrawn from public access
AGENT = 'winelogdb-research (+https://github.com/gary29024/winelogdb)'
SCOPES = {
    '21': {'prefix': 'cote-dor', 'years': range(2004, 2016), 'domains': ('www.cote-dor.gouv.fr', 'www.cote-dor.pref.gouv.fr'),
           'listings': ['www.cote-dor.gouv.fr/Publications/Recueils-des-Actes-Administratifs/'
                        'Recueils-des-actes-administratifs-des-annees-anterieures/Recueils-des-actes-administratifs-{year}']},
    '89': {'prefix': 'yonne', 'years': range(2008, 2027), 'domains': ('www.yonne.gouv.fr', 'www.yonne.pref.gouv.fr'),
           'listings': ['www.yonne.gouv.fr/Publications/Publications-legales/Recueil-des-actes-administratifs-RAA/RAA-{year}',
                        'www.yonne.gouv.fr/Publications/Publications-legales/Recueil-des-actes-administratifs/RAA-{year}']},
}
BULLETIN = re.compile(r'raa|recueil', re.I)


def utc(value=None):
    return datetime.fromtimestamp(time.time() if value is None else value, timezone.utc).isoformat(
        timespec='seconds').replace('+00:00', 'Z')


class Wayback:
    """Serial, paced client; 429/5xx and resets back off rather than fail the run."""

    def __init__(self, interval=3.0, opener=urllib.request.urlopen):
        self.interval, self.opener, self.last = interval, opener, 0.0

    def get(self, url, attempts=6):
        for attempt in range(attempts):
            time.sleep(max(0.0, self.last + self.interval - time.time()))
            self.last = time.time()
            try:
                with self.opener(urllib.request.Request(url, headers={'User-Agent': AGENT}), timeout=180) as response:
                    return response.geturl(), response.read()
            except urllib.error.HTTPError as error:
                if error.code in PERMANENT:
                    raise
                wait = 60 * (attempt + 1) if error.code == 429 else 15 * (attempt + 1)
            except (urllib.error.URLError, http.client.HTTPException, TimeoutError, ConnectionError, OSError):
                wait = 15 * (attempt + 1)
            print(f'  backoff {wait}s: {url[:120]}', file=sys.stderr, flush=True)
            time.sleep(wait)
        raise ConnectionError(f'Wayback request failed after {attempts} attempts')

    def captures(self, url, prefix=False):
        query = f'{CDX}?url={quote(url, safe="/:*%")}{"*" if prefix else ""}&output=json&fl=original,timestamp,mimetype&filter=statuscode:200'
        if prefix:  # whole-domain listings are only usable server-filtered and de-duplicated
            query += '&filter=mimetype:application/pdf&collapse=urlkey'
        # A genuine empty result is "[]"; an empty body is a degraded service, not "no captures".
        for attempt in range(6):
            body = self.get(query)[1]
            if body.strip():
                break
            print(f'  empty CDX response; backoff {60 * (attempt + 1)}s', file=sys.stderr, flush=True)
            time.sleep(60 * (attempt + 1))
        else:
            raise ConnectionError('CDX returned empty responses; inventory incomplete')
        rows = json.loads(body)
        return [dict(zip(rows[0], row)) for row in rows[1:]] if rows else []


def listing_links(text, page_url):
    links = set()
    for href in re.findall(r'href="([^"]+)"', text):
        href = re.sub(r'^(https?://web\.archive\.org)?/web/\d+[a-z_]*/', '', html.unescape(href))
        url = urljoin(page_url, href).split('#')[0]
        if re.search(r'\.pdf$|/telechargement/|/content/download/', url, re.I) and re.search(r'(yonne|cote-dor)', url):
            links.add(encoded(re.sub(r'^http://', 'https://', re.sub(r':80/', '/', url))))
    return sorted(links)


def encoded(url):
    """Percent-encode spaces and other unsafe characters; existing escapes are kept."""
    return quote(url, safe=":/?&=%#+~@!$'()*,;[]")


def filename_year(url):
    name = url.rsplit('/', 1)[-1]
    match = (re.search(r'(?<!\d)\d{4}(20[0-2]\d)(?!\d)', name)          # RAA30062004.pdf
             or re.search(r'(?<!\d)(20[0-2]\d)[_-]raa', name, re.I)       # 2010_raa_005.pdf
             or re.search(r'recueil-\d\d-(20[0-2]\d)-', name))            # recueil-89-2019-074-...
    return int(match[1]) if match else None


def inventory(client, listing_dir):
    listing_dir.mkdir(parents=True, exist_ok=True)
    out = {'schemaVersion': 1, 'inventoriedAt': utc(), 'method': __doc__.strip().split('\n\n')[1], 'departments': {}}
    for department, scope in SCOPES.items():
        years, claimed = [], set()
        for year in scope['years']:
            captures = [dict(c, listing=pattern.format(year=year)) for pattern in scope['listings']
                        for c in client.captures(pattern.format(year=year))]
            entry = {'publicationYear': year, 'corpus': f'{scope["prefix"]}-{year}', 'listing': None, 'pdfs': []}
            # Latest capture first: an early-year snapshot lists only January's bulletins.
            for capture in sorted(captures, key=lambda c: c['timestamp'], reverse=True):
                snapshot = f'https://web.archive.org/web/{capture["timestamp"]}id_/https://{capture["listing"]}'
                saved = listing_dir / f'{department}-{year}-{capture["timestamp"]}.html'
                body = saved.read_bytes() if saved.exists() else client.get(snapshot)[1]
                links = listing_links(body.decode('utf-8', 'replace'), 'https://' + capture['listing'])
                if not links:
                    continue
                sha = hashlib.sha256(body).hexdigest()
                saved.write_bytes(body)
                entry['listing'] = {'originalUrl': 'https://' + capture['listing'], 'waybackUrl': snapshot,
                                    'captureTimestamp': capture['timestamp'], 'sha256': sha, 'bytes': len(body),
                                    'otherCaptureTimestamps': sorted(c['timestamp'] for c in captures if c is not capture)}
                entry['pdfs'] = [{'url': url, 'basis': 'archived-listing'} for url in links]
                claimed.update(links)
                break
            years.append(entry)
        # Domain-wide captures fill years without a listing; dated by filename only.
        extra, captured = {}, domain_pdfs(client, scope)
        for url in captured:
            if not BULLETIN.search(url.rsplit('/', 1)[-1]) or url in claimed:
                continue
            year = filename_year(url)
            if year in scope['years']:
                extra.setdefault(year, set()).add(url)
            elif year is None and re.search(r'/IMG/pdf/RAA_\d{3}', url):
                extra.setdefault('undated', set()).add(url)
        for entry in years:
            entry['pdfs'] += [{'url': url, 'basis': 'filename-dated-capture'}
                              for url in sorted(extra.get(entry['publicationYear'], ())) if url not in claimed]
        unassigned = {'corpus': f'{scope["prefix"]}-undated', 'pdfs': [
            {'url': url, 'basis': 'undated-capture; publication year from the PDF before use'}
            for url in sorted(extra.get('undated', ()))]}
        out['departments'][department] = {'years': years, 'undated': unassigned}
        attach_alternates(out['departments'][department], captured)
    return out


def domain_pdfs(client, scope):
    urls = set()
    for domain in scope['domains']:
        for capture in client.captures(domain + '/', prefix=True):
            if capture['mimetype'] == 'application/pdf':
                urls.add(re.sub(r'^http://', 'https://', re.sub(r':80/', '/', capture['original'])))
    return urls


ALTERNATES_TRIED = 'No Internet Archive capture of this URL or its alternate spellings'
DOCUMENT_ID = re.compile(r'/(?:contenu/telechargement|content/download)/(\d+)/(\d+)/')


def attach_alternates(block, captured):
    """Same publisher document IDs under another captured spelling (mis-encoded names, print layout)."""
    by_id = {}
    for url in captured:
        if match := DOCUMENT_ID.search(url):
            by_id.setdefault(match.groups(), set()).add(url)
    for entry in block['years'] + [block['undated']]:
        for item in entry['pdfs']:
            match = DOCUMENT_ID.search(item['url'])
            alternates = sorted(by_id.get(match.groups(), set()) - {item['url']}) if match else []
            item.pop('alternateCaptureUrls', None)
            if alternates:
                item['alternateCaptureUrls'] = alternates


def store_capture(archive, client, url, snapshot, *, exact_fallback=False):
    try:
        _store_capture(archive, client, url, snapshot)
    except (urllib.error.HTTPError, InvalidPDF) as first:
        if not exact_fallback or (isinstance(first, urllib.error.HTTPError) and first.code not in PERMANENT):
            raise
        # Nearest-capture replay of a normalised HTTPS URL can return 404 even
        # when CDX has a usable HTTP/:80 capture. Preserve its original spelling.
        for capture in sorted(client.captures(url), key=lambda c: c['timestamp'], reverse=True):
            exact = f'https://web.archive.org/web/{capture["timestamp"]}id_/{encoded(capture.get("original", url))}'
            if exact == snapshot:
                continue
            try:
                _store_capture(archive, client, url, exact)
                return
            except urllib.error.HTTPError as error:
                if error.code not in PERMANENT:
                    raise
            except InvalidPDF:
                continue
        raise first


def _store_capture(archive, client, url, snapshot):
    final, body = client.get(snapshot)
    with tempfile.NamedTemporaryFile(dir=archive.root, suffix='.part', delete=False) as handle:
        handle.write(body)
    try:
        with writer_lock(archive.root):
            archive.store_pdf(url, Path(handle.name), {'finalUrl': final})
    finally:
        Path(handle.name).unlink(missing_ok=True)


def pull(archive, client, sources, *, departments=('21', '89'), limit=None, retry_unavailable=False):
    attempted = 0
    for department in departments:
        block = sources['departments'][department]
        for entry in block['years'] + [block['undated']]:
            listing = entry.get('listing')
            for item in entry['pdfs']:
                url = item['url']
                origin = (f'Wayback listing {listing["waybackUrl"]} [SHA-256 {listing["sha256"]}]'
                          if item['basis'] == 'archived-listing' else f'Wayback domain capture ({item["basis"]})')
                archive.enqueue([url], entry['corpus'], source=origin)
                row = archive.document(url)
                if row['state'] == 'downloaded' and archive.local_pdf(url):
                    continue
                alternates = item.get('alternateCaptureUrls', [])
                retry_alternates = alternates and not (row['error'] or '').startswith(ALTERNATES_TRIED)
                if (row['state'] == 'unavailable' and not retry_alternates and not retry_unavailable) or (limit is not None and attempted >= limit):
                    continue
                attempted += 1
                status, error = None, None
                try:
                    stamp = listing['captureTimestamp'] if listing else '2026'
                    try:
                        store_capture(archive, client, url, f'https://web.archive.org/web/{stamp}id_/{url}',
                                      exact_fallback=retry_unavailable)
                    except urllib.error.HTTPError as missing:
                        if missing.code not in PERMANENT or not alternates:
                            raise
                        # The same publisher document ID captured under another spelling of its URL.
                        for alternate in alternates:
                            try:
                                store_capture(archive, client, url, f'https://web.archive.org/web/2026id_/{alternate}',
                                              exact_fallback=retry_unavailable)
                                break
                            except (urllib.error.HTTPError, InvalidPDF):
                                continue
                        else:
                            status = 404
                            raise ConnectionError(f'{ALTERNATES_TRIED} ({len(alternates)})')
                    except InvalidPDF as first:
                        # Crawlers often truncated large PDFs (e.g. at exactly 1 MiB); try every other capture.
                        stamps = sorted({c['timestamp'] for c in client.captures(url)}, reverse=True)
                        if not stamps:
                            raise  # nothing to compare against: possibly transient, keep retryable
                        for other in stamps:
                            try:
                                store_capture(archive, client, url, f'https://web.archive.org/web/{other}id_/{url}')
                                break
                            except InvalidPDF:
                                continue
                        else:
                            status = 'incomplete'
                            raise InvalidPDF(f'All {len(stamps)} captures are incomplete PDFs ({first})')
                    status = 200
                except urllib.error.HTTPError as failure:
                    status, error = failure.code, ('No Internet Archive capture of this URL' if failure.code == 404 else
                                                   f'Internet Archive capture not publicly available (HTTP {failure.code})'
                                                   if failure.code in PERMANENT else str(failure))
                except (InvalidPDF, ConnectionError, ValueError) as failure:  # ValueError: malformed URL
                    error = str(failure) if status == 404 else f'{type(failure).__name__}: {failure}'
                with archive.db:
                    archive.db.execute('INSERT INTO attempts VALUES(?,?,?,?)',
                                       (url, archive.clock(), status if isinstance(status, int) else None, error))
                    if error:
                        archive.db.execute("""UPDATE documents SET state=?,error=?,attempts=attempts+1 WHERE url=?""",
                                           ('unavailable' if status in (*PERMANENT, 'incomplete') else 'retry', error, url))
                print(json.dumps({'corpus': entry['corpus'], 'url': url[-90:], 'status': status, 'error': error}), flush=True)
    return attempted


def report(archive, sources):
    rows = []
    for department, block in sources['departments'].items():
        for entry in block['years'] + [block['undated']]:
            items = list({item['url']: item for item in entry['pdfs']}.values())
            docs = [dict(archive.document(item['url']) or {'url': item['url'], 'state': 'not-queued'}) for item in items]
            rows.append({'department': department, 'corpus': entry['corpus'], 'publicationYear': entry.get('publicationYear'),
                         'listing': (entry.get('listing') or {}).get('waybackUrl'),
                         'listedPDFs': sum(i['basis'] == 'archived-listing' for i in items),
                         'filenameDatedPDFs': sum(i['basis'] != 'archived-listing' for i in items),
                         'duplicateInventoryEntries': len(entry['pdfs']) - len(items),
                         'downloaded': sum(d['state'] == 'downloaded' for d in docs),
                         'noCapture': [d['url'] for d in docs if d['state'] == 'unavailable'],
                         'pending': [d['url'] for d in docs if d['state'] in ('pending', 'retry', 'not-queued')]})
    return {'schemaVersion': 1, 'reportedAt': utc(), 'corpora': rows,
            'limitation': 'Archive availability is not publication completeness. A year without a listing capture '
                          'has only filename-dated PDFs; missing captures and undated files remain explicit gaps.'}


MONTHS = ('janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre',
          'novembre', 'decembre')
COVER_MONTH = re.compile(r'\b(' + '|'.join(MONTHS) + r')\s+(20\d\d)\b')
COVER_DATE = re.compile(r'\bdu\s+(\d{1,2})(?:er)?\s+(' + '|'.join(MONTHS) + r')\s+(20\d\d)\b')


def fold_accents(text):
    return text.lower().translate(str.maketrans('éèêëàâäôöûüùîïç', 'eeeeaaaoouuuiic'))


def cover_date(text):
    """Issue date printed on a bulletin cover, before its contents list; None when not printed."""
    cover = re.split(r'\bSOMMAIRE\b', text, maxsplit=1)[0]
    folded = fold_accents(re.sub(r'\s+', ' ', cover))
    if match := COVER_DATE.search(folded):
        day, month, year = int(match[1]), MONTHS.index(match[2]) + 1, int(match[3])
        return f'{year:04d}-{month:02d}-{day:02d}', match[0]
    if match := COVER_MONTH.search(folded):  # some special issues print only the month
        return f'{int(match[2]):04d}-{MONTHS.index(match[1]) + 1:02d}', match[0]
    return None, None


def date_undated(archive, sources, pinned_corpora):
    """Publication years for undated captures come only from their own cover; duplicates are excluded."""
    pinned = {row[0]: row[1] for row in archive.db.execute(
        f'SELECT sha256,corpus FROM documents WHERE sha256 IS NOT NULL AND corpus IN ({",".join("?" * len(pinned_corpora))})',
        pinned_corpora)}
    rows = []
    for department, block in sources['departments'].items():
        for item in block['undated']['pdfs']:
            doc = archive.document(item['url'])
            row = {'department': department, 'url': item['url'], 'downloadState': doc['state'] if doc else 'not-queued'}
            if doc and doc['state'] == 'downloaded':
                cover = archive.db.execute('SELECT text FROM pages WHERE url=? AND page=1', (item['url'],)).fetchone()
                issued, evidence = cover_date(cover[0]) if cover else (None, None)
                row.update({'sha256': doc['sha256'], 'issueDate': issued, 'publicationYear': int(issued[:4]) if issued else None,
                            'coverEvidence': evidence, 'basis': 'printed cover issue date (page 1 text)' if issued else
                            ('page 1 not extracted' if cover is None else 'no cover issue date found; year unresolved')})
                if doc['sha256'] in pinned:
                    row.update({'duplicateOf': pinned[doc['sha256']], 'basis': 'byte-identical to a pinned corpus PDF; excluded'})
            rows.append(row)
    return {'schemaVersion': 1, 'datedAt': utc(), 'pinnedCorporaCompared': list(pinned_corpora), 'documents': rows,
            'limitation': 'A cover date dates the bulletin issue, not the acts it contains. Unresolved years stay undated.'}


def write_sources(path, value):
    atomic_text(path, json.dumps(value, ensure_ascii=False, indent=1) + '\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest='command', required=True)
    inv = sub.add_parser('inventory')
    inv.add_argument('--out', type=Path, required=True)
    inv.add_argument('--listing-dir', type=Path, default=DEFAULT_ARCHIVE / 'wayback-listings')
    alt = sub.add_parser('alternates', help='attach captures of the same document IDs to an existing inventory')
    alt.add_argument('--sources', type=Path, required=True)
    dated = sub.add_parser('date', help='date undated captures from their extracted cover page')
    dated.add_argument('--sources', type=Path, required=True)
    dated.add_argument('--out', type=Path, required=True)
    get = sub.add_parser('pull')
    get.add_argument('--sources', type=Path, required=True)
    get.add_argument('--departments', nargs='+', choices=tuple(SCOPES), default=list(SCOPES))
    get.add_argument('--limit', type=int)
    get.add_argument('--retry-unavailable', action='store_true',
                     help='recheck missing or incomplete captures; retain previous attempts and valid local PDFs')
    get.add_argument('--report', type=Path)
    for p in (inv, alt, dated, get):
        p.add_argument('--archive-dir', type=Path, default=DEFAULT_ARCHIVE)
        p.add_argument('--interval', type=float, default=3.0)
    args = parser.parse_args()
    client = Wayback(args.interval)
    if args.command == 'inventory':
        result = inventory(client, args.listing_dir)
        write_sources(args.out, result)
        for department, block in result['departments'].items():
            for entry in block['years']:
                print(department, entry['publicationYear'], 'listing' if entry['listing'] else 'no-listing', len(entry['pdfs']))
            print(department, 'undated', len(block['undated']['pdfs']))
        return
    sources = json.loads(args.sources.read_text(encoding='utf-8'))
    if args.command == 'alternates':
        for department, block in sources['departments'].items():
            attach_alternates(block, domain_pdfs(client, SCOPES[department]))
        sources['alternatesAttachedAt'] = utc()
        write_sources(args.sources, sources)
        print(sum(bool(i.get('alternateCaptureUrls')) for b in sources['departments'].values()
                  for e in b['years'] + [b['undated']] for i in e['pdfs']), 'documents have alternate captures')
        return
    if args.command == 'date':
        with Archive(args.archive_dir) as archive:
            result = date_undated(archive, sources, [f'cote-dor-{year}' for year in range(2016, 2021)])
        write_sources(args.out, result)
        print(json.dumps({'dated': sum(r.get('publicationYear') is not None and 'duplicateOf' not in r for r in result['documents']),
                          'duplicates': sum('duplicateOf' in r for r in result['documents']), 'documents': len(result['documents'])}))
        return
    with Archive(args.archive_dir) as archive:
        attempted = pull(archive, client, sources, departments=args.departments, limit=args.limit,
                         retry_unavailable=args.retry_unavailable)
        result = report(archive, sources)
        result['attemptedThisRun'] = attempted
        result['retryUnavailable'] = args.retry_unavailable
        atomic_json(args.report or archive.root / 'manifests/wayback-earlier-bulletins.json', result)
        print(json.dumps({'attempted': attempted, 'downloaded': sum(r['downloaded'] for r in result['corpora'])}))


if __name__ == '__main__':
    main()
