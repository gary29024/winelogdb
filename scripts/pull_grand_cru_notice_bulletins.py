"""Resume #461's earlier departmental notice acquisition in the shared archive.

Annual URL patterns are discovery targets, not proof that a listing exists or is
complete. Keep failed requests, deferred years and PDF acquisition separate from
extraction and page-image review. This does not alter the pinned 2026-10-01 inputs.
"""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path

from bulletin_archive import Archive, DEFAULT_ARCHIVE, Deferred, ROOT, atomic_json

BASELINE = ROOT / 'scripts/grand-crus/sources/notice-coverage-2026-10-01.json'
SCOPES = {
    '21': ('cote-dor', range(2004, 2016),
           'https://www.cote-dor.gouv.fr/Publications/Recueils-des-Actes-Administratifs/'
           'Recueils-des-actes-administratifs-des-annees-anterieures/'
           'Recueils-des-actes-administratifs-{year}'),
    '89': ('yonne', range(2008, 2027),
           'https://www.yonne.gouv.fr/Publications/Publications-legales/'
           'Recueil-des-actes-administratifs/RAA-{year}'),
}


def utc(value):
    return datetime.fromtimestamp(value, timezone.utc).isoformat(timespec='microseconds').replace('+00:00', 'Z')


def targets(departments):
    if not departments or set(departments) - SCOPES.keys():
        raise ValueError('Select department 21 and/or 89')
    return [{'department': department, 'publicationYear': year,
             'corpus': f'{prefix}-{year}', 'url': pattern.format(year=year),
             'urlBasis': 'annual-path-to-resolve; not an obtained listing'}
            for department in sorted(set(departments))
            for prefix, years, pattern in [SCOPES[department]] for year in years]


def pull(archive, departments=('21', '89'), *, limit=10, min_interval=3, max_wait=5):
    if limit < 1 or min_interval < 0 or not 0 <= max_wait <= 60:
        raise ValueError('Use a positive limit, nonnegative interval and wait between 0 and 60 seconds')
    selected = targets(departments)
    baseline = json.loads(BASELINE.read_text(encoding='utf-8'))
    with archive.db:
        for target in selected:
            archive.db.execute('INSERT OR IGNORE INTO listings(url,corpus) VALUES(?,?)',
                               (target['url'], target['corpus']))
    for department in sorted(set(departments)):
        source = baseline['departments'][department]
        prefix, _, _ = SCOPES[department]
        archive.enqueue([source['failedPublishedPdf']['url']],
                        f'{prefix}-{source["earliestPublishedYearLocated"]}',
                        source='Located official PDF: ' + str(BASELINE.relative_to(ROOT)))

    requests, deferred = [], {}
    # Rotate through unattempted years when a persistently broken first listing
    # cools down the host; rerunning must not starve the remaining annual paths.
    discovery_order = sorted(selected, key=lambda target: archive.db.execute(
        'SELECT attempts FROM listings WHERE url=?', (target['url'],)).fetchone()[0])
    for target in discovery_order:
        before = archive.db.execute('SELECT attempts FROM listings WHERE url=?', (target['url'],)).fetchone()[0]
        attempted_at = utc(archive.clock())
        try:
            archive.fetch_listing(target['url'], target['corpus'], min_interval)
        except Deferred as error:
            deferred[target['url']] = str(error)
        row = dict(archive.db.execute('SELECT * FROM listings WHERE url=?', (target['url'],)).fetchone())
        if row['attempts'] > before:
            requests.append({'url': row['url'], 'corpus': row['corpus'], 'attemptedAt': attempted_at,
                             'state': row['state'], 'error': row['error']})

    batch = archive.fetch_batch(limit, min_interval, max_wait, [t['corpus'] for t in selected])
    years = []
    for target in selected:
        row = dict(archive.db.execute('SELECT * FROM listings WHERE url=?', (target['url'],)).fetchone())
        listing = {key: row[key] for key in ('state', 'attempts', 'pdf_count', 'error')}
        listing['capturedAt'] = utc(row['captured_at']) if row['captured_at'] is not None else None
        listing['sha256'] = Path(row['path']).stem if row['path'] else None
        listing['deferredReasonThisRun'] = deferred.get(target['url'])
        documents = []
        for doc in archive.db.execute('SELECT * FROM documents WHERE corpus=? ORDER BY url', (target['corpus'],)).fetchall():
            item = {key: doc[key] for key in ('url', 'state', 'sha256', 'bytes', 'final_url', 'error', 'attempts')}
            item.update({'retrievedAt': utc(doc['fetched_at']) if doc['fetched_at'] is not None else None,
                         'sourceReleaseDate': None, 'licence': None,
                         'nextAttemptAt': utc(archive.due_at(doc)) if doc['state'] in ('pending', 'retry') else None,
                         'acquisitionAttempts': [
                             {'attemptedAt': utc(attempt['at']), 'httpStatus': attempt['status'], 'error': attempt['error']}
                             for attempt in archive.db.execute('SELECT * FROM attempts WHERE url=? ORDER BY at', (doc['url'],))]})
            if doc['sha256']:
                item['archiveObject'] = archive.object_path(doc['sha256']).relative_to(archive.root).as_posix()
            documents.append(item)
        years.append({**target, 'listing': listing, 'documents': documents,
                      'downloadedPDFs': sum(d['state'] == 'downloaded' for d in documents),
                      'extractedPages': archive.db.execute(
                          'SELECT count(*) FROM pages p JOIN documents d ON d.url=p.url WHERE d.corpus=?',
                          (target['corpus'],)).fetchone()[0]})
    summary = {'requestedPublicationYears': len(years), 'listingRequestsThisRun': len(requests),
               'savedListings': sum(y['listing']['state'] == 'saved' for y in years),
               'unobtainedListings': sum(y['listing']['state'] not in ('saved', 'saved-manifest') for y in years),
               'pdfAttemptsThisRun': batch['attempted'],
               'knownPDFs': sum(len(y['documents']) for y in years),
               'downloadedPDFs': sum(y['downloadedPDFs'] for y in years),
               'extractedPages': sum(y['extractedPages'] for y in years)}
    return {'schemaVersion': 1, 'baselineAvailabilityAudit': BASELINE.relative_to(ROOT).as_posix(),
            'reportedAt': utc(archive.clock()), 'summary': summary, 'listingRequestsThisRun': requests,
            'years': years,
            'limitation': 'Annual paths are discovery targets. Only saved HTML supplies PDF links; child listings '
                          'and publication gaps still require review. Located seed PDFs do not establish year '
                          'completeness. Deferred requests are unattempted in this run. Downloading and extraction '
                          'do not constitute page-image review or absence of a historical notice.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive-dir', type=Path, default=DEFAULT_ARCHIVE)
    parser.add_argument('--departments', nargs='+', choices=tuple(SCOPES), default=list(SCOPES))
    parser.add_argument('--limit', type=int, default=10, help='total PDF request budget across both departments')
    parser.add_argument('--min-interval', type=float, default=3)
    parser.add_argument('--max-wait', type=float, default=5, help='leave longer cooldowns pending; maximum 60 seconds')
    parser.add_argument('--report', type=Path, help='dated report path; default is a mutable archive manifest')
    args = parser.parse_args()
    with Archive(args.archive_dir) as archive:
        result = pull(archive, args.departments, limit=args.limit,
                      min_interval=args.min_interval, max_wait=args.max_wait)
        output = args.report or archive.root / 'manifests/grand-cru-earlier-notices.json'
        output.parent.mkdir(parents=True, exist_ok=True)
        atomic_json(output, result)
        print(json.dumps({'report': str(output), **result['summary']}))


if __name__ == '__main__':
    main()
