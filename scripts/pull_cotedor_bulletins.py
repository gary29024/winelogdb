"""Discover and archive Côte-d'Or departmental bulletins for 2016–2020.

Each run acquires unsaved annual listings, then a bounded PDF batch. Reruns use
the same archive and honour persisted cooldowns. Exported URL lists include all
discovered documents, but only a successfully saved listing establishes that
year's discovery coverage. Known publication gaps are kept in sources.json.
"""
import argparse
import hashlib
import json
import os
import time
from pathlib import Path
from urllib.parse import urlsplit

from bulletin_archive import Archive, DEFAULT_ARCHIVE, Deferred, ROOT, atomic_json, read_links

SOURCES = ROOT / 'docs/research/cote-dor-bulletins/sources.json'


def pull(archive, years, *, limit=10, min_interval=3, max_wait=5, discover_only=False, refresh_listings=False):
    if limit < 1 or min_interval < 0 or max_wait < 0:
        raise ValueError('limit must be positive; interval and max_wait must be non-negative')
    sources = json.loads(SOURCES.read_text(encoding='utf-8'))['years']
    selected = [source for source in sources if source['year'] in years]
    for source in selected:
        if source.get('manifestFile'):
            path = SOURCES.parent / source['manifestFile']
            if hashlib.sha256(path.read_bytes().replace(b'\r\n', b'\n')).hexdigest() != source['manifestSha256']:
                raise ValueError(f'Changed URL manifest: {path}; review the source capture')
            urls = read_links([path])
            if len(urls) != source['pdfCount']:
                raise ValueError(f'URL count differs from captured listing: {path}')
            archive.enqueue(urls, f'cote-dor-{source["year"]}',
                            source=source['url'] + ' [captured listing SHA-256 ' + source['listingSha256'] + ']')
            archive.enqueue_alternates(source.get('alternateLinks', []), f'cote-dor-{source["year"]}', source['url'])
    with archive.db:
        for source in selected:
            archive.db.execute('INSERT OR IGNORE INTO listings(url,corpus) VALUES(?,?)',
                               (source['url'], f'cote-dor-{source["year"]}'))
            if refresh_listings:
                archive.db.execute("UPDATE listings SET state='pending',error=NULL WHERE url=?", (source['url'],))
            elif source.get('manifestFile'):
                archive.db.execute("""UPDATE listings SET state='saved-manifest',pdf_count=?,error=NULL
                 WHERE url=? AND state IN ('pending','retry')""", (source['pdfCount'], source['url']))
    # Prioritise a year that has not yet been attempted, rather than retrying the first forever.
    selected.sort(key=lambda s: archive.db.execute('SELECT attempts FROM listings WHERE url=?', (s['url'],)).fetchone()[0])
    for source in selected:
        host = archive.db.execute('SELECT ready FROM hosts WHERE host=?', (urlsplit(source['url']).netloc.lower(),)).fetchone()
        wait = (host['ready'] - archive.clock()) if host else 0
        if 0 < wait <= max_wait:
            time.sleep(wait)
        try:
            archive.fetch_listing(source['url'], f'cote-dor-{source["year"]}', min_interval)
        except Deferred:
            continue
    attempted = 0
    if not discover_only:
        # Limit is a total request budget across all selected years, not a per-year multiplier.
        result = archive.fetch_batch(limit, min_interval, max_wait, [f'cote-dor-{year}' for year in sorted(years)])
        attempted = result['attempted']
    directory = archive.root / 'manifests'
    directory.mkdir(exist_ok=True)
    report = []
    for source in selected:
        year = source['year']
        listing = dict(archive.db.execute('SELECT * FROM listings WHERE url=?', (source['url'],)).fetchone())
        docs = [dict(r) for r in archive.db.execute('SELECT url,state,sha256,bytes,error FROM documents WHERE corpus=? ORDER BY url',
                                                   (f'cote-dor-{year}',))]
        (directory / f'cote-dor-{year}.txt').write_text(''.join(r['url'] + '\n' for r in docs), encoding='utf-8')
        report.append({'year': year, 'listing': listing, 'knownPublicationGaps': source.get('knownPublicationGaps', []),
                       'discoveredPDFs': sum(r['state'] != 'needs-resolution' for r in docs),
                       'unresolvedDownloadLinks': [r for r in docs if r['state'] == 'needs-resolution'],
                       'downloadedPDFs': sum(r['state'] == 'downloaded' for r in docs),
                       'documents': docs})
    summary = {'pdfAttemptsThisRun': attempted, 'years': sorted(report, key=lambda r: r['year'])}
    (directory / 'cote-dor-2016-2020.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return summary


def run_until_complete(archive, years, *, limit=10, min_interval=3, max_runtime=21600):
    """One bounded foreground job, not a scheduler. The durable queue survives its exit."""
    started = archive.clock()
    status_path = archive.root / 'run-status.json'
    corpora = [f'cote-dor-{year}' for year in sorted(years)]
    while True:
        state = {'pid': os.getpid(), 'phase': 'running', 'startedAt': started,
                 'updatedAt': archive.clock(), 'maxRuntimeSeconds': max_runtime, 'corpora': corpora}
        atomic_json(status_path, state)
        result = pull(archive, years, limit=limit, min_interval=min_interval, max_wait=5)
        pending = archive.db.execute("SELECT * FROM documents WHERE state IN ('pending','retry') AND corpus IN ("
                                     + ','.join('?' for _ in corpora) + ')', corpora).fetchall()
        state.update({'updatedAt': archive.clock(), 'pendingPDFs': len(pending),
                      'downloadedPDFs': sum(r['downloadedPDFs'] for r in result['years']),
                      'unresolvedDownloadLinks': sum(len(r['unresolvedDownloadLinks']) for r in result['years'])})
        discovery_pending = [r for r in result['years'] if r['listing']['state'] in ('pending', 'retry')]
        if not pending and not discovery_pending:
            state['phase'] = 'finished'  # inspect manifest for blocked/needs-resolution records
        elif archive.clock() - started >= max_runtime:
            state['phase'] = 'paused-runtime-limit'
        atomic_json(status_path, state)
        print(json.dumps(state), flush=True)
        if state['phase'] != 'running':
            return result
        ready = min((archive.due_at(row) for row in pending), default=archive.clock() + 60)
        # Periodic state writes show that a long server cooldown is still being honoured.
        time.sleep(min(60, max(1, ready - archive.clock()), max(1, max_runtime - (archive.clock() - started))))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive-dir', type=Path, default=DEFAULT_ARCHIVE)
    parser.add_argument('--years', type=int, nargs='+', choices=range(2016, 2021), default=list(range(2016, 2021)))
    parser.add_argument('--limit', type=int, default=10, help='maximum PDF request attempts this run')
    parser.add_argument('--min-interval', type=float, default=3)
    parser.add_argument('--max-wait', type=float, default=5, help='leave longer cooldowns pending rather than sleeping')
    parser.add_argument('--discover-only', action='store_true')
    parser.add_argument('--refresh-listings', action='store_true', help='deliberately recapture the annual listings')
    parser.add_argument('--until-complete', action='store_true', help='keep this process running through cooldowns')
    parser.add_argument('--max-runtime', type=float, default=21600, help='seconds allowed for --until-complete (default six hours)')
    args = parser.parse_args()
    with Archive(args.archive_dir) as archive:
        if args.until_complete:
            if args.discover_only or args.refresh_listings or args.max_runtime <= 0:
                parser.error('--until-complete requires a positive runtime and no discovery-only/refresh flags')
            summary = run_until_complete(archive, set(args.years), limit=args.limit,
                                         min_interval=args.min_interval, max_runtime=args.max_runtime)
        else:
            summary = pull(archive, set(args.years), limit=args.limit, min_interval=args.min_interval,
                           max_wait=args.max_wait, discover_only=args.discover_only, refresh_listings=args.refresh_listings)
        print(json.dumps({'manifest': str(archive.root / 'manifests/cote-dor-2016-2020.json'),
                          'pdfAttemptsThisRun': summary['pdfAttemptsThisRun'],
                          'years': [{k: row[k] for k in ('year', 'discoveredPDFs', 'downloadedPDFs', 'knownPublicationGaps')}
                                    | {'listingStatus': row['listing']['state'], 'error': row['listing']['error'],
                                       'unresolvedDownloadLinks': len(row['unresolvedDownloadLinks'])}
                                    for row in summary['years']]}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
