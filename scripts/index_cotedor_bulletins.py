"""Index every archived departmental page, then OCR sparse pages with checkpoints.

The regional index is retained. Departmental pages append to the same SQLite search
index; exported notice candidates are unreviewed research leads, never farmer links.
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from bulletin_archive import Archive, DEFAULT_ARCHIVE, ROOT, atomic_json, digest
from build_bfc_bulletin_index import KINDS, gzip_bytes, hints, plain

VERSION = 'poppler-layout-tesseract-fra-200dpi-psm3-v1'
OK = {'text-layer', 'ocr'}
ACT = re.compile(r'\b(?:21|BFC)-(\d{4})-(\d{2})-(\d{2})-\d{3,5}\b')
FARM = re.compile(r'CONTROLE\s+DES\s+STRUCTURES|AUTORISATION\s+D[\W_]*EXPLOITER|'
                  r'AUTORISER.{0,100}EXPLOITER|REPRISE.{0,100}(?:PARCELLE|EXPLOITATION)|'
                  r'PRENEUR\s+EN\s+PLACE|ANCIEN\s+EXPLOITANT|\bSDREA\b', re.I)
_progress_lock = threading.Lock()
ENTRY_END = re.compile(r'\((\d+)\s*pages?\)\s*Page\s*(\d+)\s*$', re.I)


def applicant_hint(title):
    match = re.search(r'notification\s+de\s+d[ée]cision(?:\s+modificative)?\s*(.+)$', title, re.I)
    return match[1].strip(' -') if match else None


def command(argv, timeout=180):
    return subprocess.run(argv, capture_output=True, text=True, encoding='utf-8', errors='replace',
                          timeout=timeout, env={**os.environ, 'OMP_THREAD_LIMIT': '1'})


def seed_record(row, pdf):
    info = command(['pdfinfo', str(pdf)])
    count = re.search(r'Pages:\s+(\d+)', info.stdout)
    if info.returncode or not count:
        raise ValueError('pdfinfo did not establish the page count')
    total = int(count[1])
    layer = command(['pdftotext', '-layout', '-enc', 'UTF-8', str(pdf), '-'])
    pages = layer.stdout.split('\f')
    if pages and not pages[-1].strip():
        pages.pop()
    aligned = layer.returncode == 0 and len(pages) == total
    text = {str(p): pages[p - 1] if aligned else '' for p in range(1, total + 1)}
    statuses = {p: 'text-layer' if len(re.sub(r'\s', '', value)) >= 400 else 'pending:ocr'
                for p, value in text.items()}
    return {'url': row['url'], 'corpus': row['corpus'], 'sha256': row['sha256'], 'pages': total,
            'extractionVersion': VERSION, 'text': text, 'pageStatus': statuses,
            'textLayerError': None if aligned else 'pdftotext failed or page count did not match; OCR required'}


def ocr_page(pdf, page, layer):
    try:
        with tempfile.TemporaryDirectory() as tmp:
            stem = str(Path(tmp) / 'page')
            render = command(['pdftoppm', '-f', str(page), '-l', str(page), '-r', '200', '-gray',
                              '-png', '-singlefile', str(pdf), stem])
            if render.returncode or not Path(stem + '.png').exists():
                return layer, 'failed:render'
            result = command(['tesseract', stem + '.png', '-', '-l', 'fra', '--psm', '3'])
            if result.returncode:
                return layer, 'failed:ocr'
            return result.stdout, 'ocr'
    except subprocess.TimeoutExpired:
        return layer, 'failed:timeout'
    except OSError:
        return layer, 'failed:tool'


def record_path(root, url):
    return root / 'departmental-scans' / (hashlib.sha256(url.encode()).hexdigest() + '.json')


def load_record(root, row):
    path = record_path(root, row['url'])
    if not path.exists():
        return None
    record = json.loads(path.read_text(encoding='utf-8'))
    if (record.get('url'), record.get('sha256'), record.get('extractionVersion')) != (row['url'], row['sha256'], VERSION):
        return None
    expected = {str(p) for p in range(1, record['pages'] + 1)}
    if set(record['text']) != expected or set(record['pageStatus']) != expected:
        return None
    return record


def save_record(archive, record):
    atomic_json(record_path(archive.root, record['url']), record)
    archive.index_scan(record)


def progress(root, phase, **extra):
    with _progress_lock, Archive(root) as archive:
        counts = dict(archive.db.execute("""SELECT p.status,count(*) FROM pages p JOIN documents d ON d.url=p.url
             WHERE d.corpus LIKE 'cote-dor-%' GROUP BY p.status"""))
        documents = archive.db.execute("""SELECT count(DISTINCT p.url) FROM pages p JOIN documents d ON d.url=p.url
             WHERE d.corpus LIKE 'cote-dor-%'""").fetchone()[0]
        state = {'pid': os.getpid(), 'phase': phase, 'updatedAt': time.time(), 'indexedPDFs': documents,
                 'indexedPages': sum(counts.values()), 'pageStatuses': counts, **extra}
        atomic_json(root / 'extraction-status.json', state)
        print(json.dumps(state), flush=True)


def extract_one(root, row, stage):
    with Archive(root) as archive:
        pdf = archive.local_pdf(row['url'])
        if pdf is None:
            raise ValueError('Archived original is missing or has a different hash: ' + row['url'])
        record = load_record(root, row)
        if record is None:
            record = seed_record(row, pdf)
            save_record(archive, record)
        else:
            archive.index_scan(record)  # recover a crash between checkpoint and SQLite commit
        if stage == 'ocr':
            changed = 0
            for page in range(1, record['pages'] + 1):
                key = str(page)
                if record['pageStatus'][key] in OK:
                    continue
                record['text'][key], record['pageStatus'][key] = ocr_page(pdf, page, record['text'][key])
                changed += 1
                if changed % 10 == 0:
                    save_record(archive, record)
                    progress(root, 'ocr', activeURL=row['url'], activePage=page)
            if changed:
                save_record(archive, record)
    return row['url']


def candidate_pages(record, communes):
    """Broad page-level leads; do not invent notice boundaries, applicants or operator roles."""
    result = []
    for page, text in record['text'].items():
        matching = [line.strip() for line in text.splitlines() if FARM.search(plain(line))]
        # Also match a phrase split across two printed lines.
        if not matching and FARM.search(plain(text)):
            matching = ['Farm-structure phrase spans lines; inspect the source page.']
        if not matching:
            continue
        mentioned, refs = hints(text, communes)
        acts = sorted({m.group(0) for m in ACT.finditer(text)})
        result.append({'id': hashlib.sha256(record['url'].encode()).hexdigest() + ':p' + page,
                       'corpus': record['corpus'], 'url': record['url'] + '#page=' + page,
                       'sourceSha256': record['sha256'], 'page': int(page),
                       'extractionStatus': record['pageStatus'][page], 'reviewStatus': 'unreviewed',
                       'actIdHints': acts, 'communesMentioned': mentioned, 'referenceHints': refs,
                       'matchingLines': matching[:12]})
    return result


def notice_entries(record, communes):
    """Read modern departmental contents entries; legacy layouts stay page-searchable.

    These are source occurrences, not deduplicated farming events. Repeated act IDs
    can be grouped later without throwing away conflicting titles or source pages.
    """
    entries, section, headers, buffer = [], '', [], ''
    first_act_page = record['pages'] + 1
    in_contents = False
    for page in range(1, min(record['pages'], 20) + 1):
        if page >= first_act_page:
            break
        for line in record['text'][str(page)].splitlines():
            value = line.strip()
            if plain(value) == 'SOMMAIRE':
                in_contents = True
                continue
            if not in_contents or not value or value.isdigit():
                continue
            if ACT.match(value):
                if headers:
                    section, headers = ' '.join(headers), []
                buffer = value
            elif buffer:
                buffer += ' ' + value
            else:
                headers.append(value)
            end = ENTRY_END.search(buffer)
            if not end:
                continue
            act = ACT.match(buffer)
            start, length = int(end[2]), int(end[1])
            first_act_page = min(first_act_page, start)
            title = re.sub(r'\s+', ' ', buffer[act.end():end.start()]).strip(' -')
            buffer = ''
            if not (1 <= start <= record['pages']) or length < 1:
                continue
            if 'TERRITOIRES' not in plain(section) and not FARM.search(plain(title)):
                continue
            last = min(record['pages'], start + length)  # separator + stated content pages
            selected = [str(p) for p in range(start, last + 1)]
            text = '\n'.join(record['text'][p] for p in selected)
            mentioned, refs = hints(text, communes)
            kind = next((k for k, pattern in KINDS if pattern.search(title)), 'other')
            entries.append({'id': hashlib.sha256(record['url'].encode()).hexdigest() + ':p' + str(start),
                            'corpus': record['corpus'], 'url': record['url'], 'sourceSha256': record['sha256'],
                            'firstPage': start, 'lastPage': last, 'section': section, 'title': title,
                            'actId': act.group(0), 'actDateHint': '-'.join(act.groups()),
                            'applicantHint': applicant_hint(title), 'titleKind': kind,
                            'farmStructures': bool(FARM.search(plain(section + ' ' + title))),
                            'reviewStatus': 'unreviewed', 'communesMentioned': mentioned, 'referenceHints': refs,
                            'pendingPages': [int(p) for p in selected if record['pageStatus'][p].startswith('pending:')],
                            'failedPages': [int(p) for p in selected if record['pageStatus'][p].startswith('failed:')]})
    return entries, in_contents and first_act_page <= record['pages']


def export_index(root, output):
    output.mkdir(parents=True, exist_ok=True)
    communes = json.loads((ROOT / 'docs/research/bfc-bulletins/cote-dor-communes.json').read_text(encoding='utf-8'))['communes']
    coverage, candidates, pages, notices = [], [], [], []
    with Archive(root) as archive:
        rows = [dict(r) for r in archive.db.execute("SELECT * FROM documents WHERE corpus LIKE 'cote-dor-%' ORDER BY corpus,url")]
        for row in rows:
            item = {'url': row['url'], 'corpus': row['corpus'], 'sha256': row['sha256'], 'downloadStatus': row['state']}
            record = load_record(root, row)
            if record is None:
                item['extractionStatus'] = 'not-scanned'
            else:
                pending = [int(p) for p, s in record['pageStatus'].items() if s.startswith('pending:')]
                failed = [int(p) for p, s in record['pageStatus'].items() if s.startswith('failed:')]
                item.update({'pages': record['pages'], 'pendingPages': pending, 'failedPages': failed,
                             'extractionStatus': 'incomplete' if pending or failed else 'complete'})
                entries, modern = notice_entries(record, communes)
                item.update({'noticeIndexStatus': 'modern-contents-parsed' if modern else 'page-search-only',
                             'noticeOccurrences': len(entries)})
                notices.extend(entries)
                candidates.extend(candidate_pages(record, communes))
                for page, value in record['text'].items():
                    pages.append({'url': record['url'], 'sha256': record['sha256'], 'page': int(page),
                                  'status': record['pageStatus'][page], 'text': value})
            coverage.append(item)
    summary = {'documentReferences': len(coverage), 'downloadedPDFs': sum(c['downloadStatus'] == 'downloaded' for c in coverage),
               'completePDFs': sum(c['extractionStatus'] == 'complete' for c in coverage),
               'indexedPages': len(pages), 'pendingPages': sum(len(c.get('pendingPages', [])) for c in coverage),
               'failedPages': sum(len(c.get('failedPages', [])) for c in coverage), 'candidatePages': len(candidates),
               'noticeOccurrences': len(notices), 'farmStructureOccurrences': sum(n['farmStructures'] for n in notices)}
    atomic_json(output / 'coverage.json', {'extractionVersion': VERSION, 'summary': summary, 'documents': coverage})
    atomic_json(output / 'candidate-pages.json', {'note': 'Broad, unreviewed page matches; may include contents, repeated acts and non-farming authorisations. Not a list of verified notices or current farmers.', 'pages': candidates})
    groups = {}
    for notice in notices:
        groups.setdefault(notice['actId'], []).append(notice['id'])
    atomic_json(output / 'notices.json', {'note': 'Unreviewed contents entries, including non-farming DDT acts. Dates, applicants and parcel references are hints. Legacy layouts remain in full-page search and candidate-pages.json.',
                                        'notices': notices, 'repeatedActIds': {k: v for k, v in groups.items() if len(v) > 1}})
    target = output / 'page-text.jsonl.gz'
    temporary = target.with_suffix('.gz.new')
    temporary.write_bytes(gzip_bytes(pages))
    temporary.replace(target)
    atomic_json(output / 'catalog.json', {'geography': 'All communes of Cote-d\'Or; no vineyard or producer filter',
                'departmentalYears': list(range(2016, 2021)), 'regionalIndex': 'docs/research/bfc-bulletins',
                'departmentalCoverage': 'coverage.json', 'departmentalText': 'page-text.jsonl.gz',
                'departmentalCandidates': 'candidate-pages.json', 'departmentalNotices': 'notices.json',
                'sharedSearch': 'bulletin_archive.py search QUERY',
                'deduplication': 'One page per source URL and PDF hash; repeated acts retain every source citation.'})
    return summary


def preflight(stage):
    needed = ['pdfinfo', 'pdftotext'] + (['pdftoppm', 'tesseract'] if stage in ('ocr', 'all') else [])
    missing = [name for name in needed if shutil.which(name) is None]
    if missing:
        raise ValueError('Missing extraction tools: ' + ', '.join(missing))
    if 'tesseract' in needed:
        languages = command(['tesseract', '--list-langs'])
        if languages.returncode or 'fra' not in languages.stdout.split():
            raise ValueError('Tesseract French language model is unavailable')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive-dir', type=Path, default=DEFAULT_ARCHIVE)
    parser.add_argument('--stage', choices=('text', 'ocr', 'all', 'export'), default='all')
    parser.add_argument('--jobs', type=int, default=4)
    parser.add_argument('--output', type=Path, help='export directory; defaults to archive/departmental-index')
    args = parser.parse_args()
    if args.jobs < 1:
        parser.error('--jobs must be positive')
    root = args.archive_dir.resolve()
    output = args.output or root / 'departmental-index'
    (root / 'departmental-scans').mkdir(exist_ok=True)
    try:
        if args.stage != 'export':
            preflight(args.stage)
            with Archive(root) as archive:
                rows = [dict(r) for r in archive.db.execute("SELECT * FROM documents WHERE corpus LIKE 'cote-dor-%' AND state='downloaded' ORDER BY corpus,url")]
            for stage in (['text', 'ocr'] if args.stage == 'all' else [args.stage]):
                progress(root, stage, targetPDFs=len(rows))
                with ThreadPoolExecutor(args.jobs) as pool:
                    futures = [pool.submit(extract_one, root, row, stage) for row in rows]
                    for future in as_completed(futures):
                        future.result()
                        progress(root, stage, targetPDFs=len(rows))
                summary = export_index(root, output)
                print(json.dumps({'export': str(output), **summary}), flush=True)
        else:
            summary = export_index(root, output)
            print(json.dumps({'export': str(output), **summary}), flush=True)
            return  # A snapshot export must not overwrite a live extraction job's status.
        phase = 'finished' if summary['downloadedPDFs'] == summary['completePDFs'] else 'extraction-incomplete'
        progress(root, phase, summary=summary, output=str(output))
    except Exception as error:
        progress(root, 'failed', error=f'{type(error).__name__}: {error}')
        raise


if __name__ == '__main__':
    main()
