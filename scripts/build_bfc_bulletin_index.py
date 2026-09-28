"""Build the Côte-d'Or notice index from scanned BFC administrative bulletins.

Reads the per-bulletin cache written by scan_bfc_bulletins.py and writes, under
docs/research/bfc-bulletins/:

  coverage.json            every bulletin in the link lists, with hash, what was read and its status
  notices.json             one row per Côte-d'Or DDT notice, with OCR-derived hints
  notice-text.jsonl.gz     each notice's page text and per-page extraction status (gzip, deterministic)

reviewed-parcels.json is curated by hand after checking the page image; the
builder validates it against the notices. OCR-derived communes and references
are search hints, never evidence: only reviewed rows may feed a register.

  python scripts/build_bfc_bulletin_index.py            # rebuild from .tmp/bfc-bulletins
  python scripts/build_bfc_bulletin_index.py --check    # verify committed outputs offline

Coverage is reconciled against the link lists: a bulletin without a scan record
is reported as not-scanned, never dropped. Every notice page carries an
extraction status, so a blank separator page is distinguishable from a page
whose extraction failed.
"""
import argparse
import gzip
import io
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.tmp/bfc-bulletins'
OUT = ROOT / 'docs/research/bfc-bulletins'
READABLE = {'contents-read', 'full-ocr-no-contents', 'extraction-incomplete'}
PAGE_OK = {'text-layer', 'ocr', 'ocr-no-text-layer'}
BULLETIN = re.compile(r'recueil-bfc-(\d{4})-(\d{3})')
ACT = re.compile(r'BFC-(\d{4})-(\d{2})-(\d{2})-\d{5}')
KINDS = [  # First match wins; derived from the contents title only.
    ('suspension', re.compile(r'\bsusp', re.I)),
    ('implicit-authorisation', re.compile(r'implicite|tacite', re.I)),
    ('partial-decision', re.compile(r'partielle|refus et autoris', re.I)),
    ('refusal', re.compile(r'refus', re.I)),
    ('not-subject-to-authorisation', re.compile(r'\bns\b|non soumis', re.I)),
    ('receipt-complete-application', re.compile(r'\bARC[_ ]|accus', re.I)),
    ('authorisation', re.compile(r'autoris|\bAE\b', re.I)),
    ('ruling', re.compile(r'rescrit', re.I)),
]
FARM = re.compile(r'structures|[ée]conomie agricole|exploiter|\bARC[_ ]', re.I)
REF = r'[0O]?[A-Z]{1,2}\s?\d{1,4}'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def plain(text):
    """Upper-case ASCII with whitespace collapsed; punctuation kept."""
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode().upper())


def fold(text):
    return re.sub(r'[^A-Z0-9]+', ' ', plain(text))


def applicant(title, act):
    rest = title.split(act, 1)[1] if act else title
    rest = re.sub(r'^\s*-\s*', '', rest)
    rest = re.sub(r'^(?:\d{6}\s+21\s+\w+\s+|ARC[_ ]|NC[_ ]|AE[_ ]\w*\s*-?\s*)', '', rest, flags=re.I)
    return rest.strip(' -')


def hints(text, communes):
    folded = f' {fold(text)} '
    mentioned = sorted(code for code, name in communes.items() if f' {fold(name).strip()} ' in folded)
    refs, flat = set(), plain(text)
    for name in (communes[c] for c in mentioned):
        # "FLAGEY-ECHEZEAUX (D184, D558, D774)": the references printed after a commune name.
        pattern = r'\b' + r'[\s-]*'.join(map(re.escape, fold(name).split())) + r'\s*\(([^)]{1,300})\)'
        for group in re.findall(pattern, flat):
            refs.update(re.findall(r'\b' + REF + r'\b', group))
    for line in text.splitlines():  # table rows: reference then an area in hectares
        match = re.match(r'^\W*(' + REF + r')\W+\d+[,.]\d{3,4}\b', line.strip())
        if match:
            refs.add(match.group(1))
    return mentioned, sorted(re.sub(r'\s', '', r) for r in refs)


def manifest_urls(out_dir):
    urls = [u.strip() for path in sorted(out_dir.glob('links-*.txt'))
            for u in path.read_text(encoding='utf-8').splitlines() if u.strip()]
    require(len(urls) == len(set(urls)), 'Duplicate URL in link lists')
    return urls


def bulletin_of(url):
    match = BULLETIN.search(url)
    require(match, f'Unrecognised bulletin URL: {url}')
    return f'bfc-{match.group(1)}-{match.group(2)}'


def build(urls, cache_dir, communes):
    coverage, notices, texts = [], [], []
    for url in urls:
        bulletin = bulletin_of(url)
        path = cache_dir / 'records' / f'{bulletin}.json'
        record = json.loads(path.read_text(encoding='utf-8')) if path.exists() else None
        if record is None or record['url'] != url:
            coverage.append({'bulletin': bulletin, 'url': url, 'status': 'not-scanned'})
            continue
        if 'error' in record:
            coverage.append({'bulletin': bulletin, 'url': url, 'status': 'download-failed', 'error': record['error']})
            continue
        entries = record['coteDorEntries']
        if record['fallbackFullScan']:
            # No readable contents list: keep the whole bulletin as one notice so its text stays searchable.
            entries = [{'section': 'Whole bulletin (no readable contents list)', 'title': '', 'page': 1,
                        'pages': record['pages'] - 2}]
        require(not entries or 'pageStatus' in record, f'{bulletin}: notice pages lack extraction status; rescan it')
        failed = record.get('failedPages', [])
        coverage.append({'bulletin': bulletin, 'url': url, 'sha256': record['sha256'], 'pages': record['pages'],
                         'contentsEntries': record['tocEntries'], 'coteDorNotices': len(entries), 'failedPages': failed,
                         'status': 'extraction-incomplete' if failed else
                                   'full-ocr-no-contents' if record['fallbackFullScan'] else 'contents-read'})
        for entry in entries:
            act = ACT.search(entry['title'])
            last = min(record['pages'], entry['page'] + entry['pages'] + 1)
            keys = [str(p) for p in range(entry['page'], last + 1)]
            require(all(k in record['text'] and k in record['pageStatus'] for k in keys),
                    f'{bulletin}: notice at page {entry["page"]} has pages that were never extracted')
            text = '\n'.join(record['text'][k] for k in keys)
            mentioned, refs = hints(text, communes)
            notice_id = f'{bulletin}:p{entry["page"]}'
            kind = next((k for k, pattern in KINDS if pattern.search(entry['title'])), 'other')
            notices.append({'id': notice_id, 'bulletin': bulletin, 'firstPage': entry['page'], 'lastPage': last,
                            'section': entry['section'], 'title': entry['title'],
                            'actId': act.group(0) if act else None,
                            'actDate': '-'.join(act.groups()) if act else None,
                            'applicant': applicant(entry['title'], act.group(0) if act else None),
                            'titleKind': kind, 'farmStructures': bool(FARM.search(entry['section'] + ' ' + entry['title'])),
                            'failedPages': [int(k) for k in keys if int(k) in failed],
                            'communesMentioned': mentioned, 'referenceHints': refs})
            texts.append({'id': notice_id, 'pages': {k: record['text'][k] for k in keys},
                          'pageStatus': {k: record['pageStatus'][k] for k in keys}})
    coverage.sort(key=lambda c: c['bulletin'])
    notices.sort(key=lambda n: (n['bulletin'], n['firstPage']))
    order = {n['id']: i for i, n in enumerate(notices)}
    texts.sort(key=lambda t: order[t['id']])  # same order as notices.json
    require(len({n['id'] for n in notices}) == len(notices), 'Duplicate notice id')
    return coverage, notices, texts


def summarize(coverage, notices):
    status = lambda s: sum(c['status'] == s for c in coverage)
    return {'bulletins': len(coverage), 'notScanned': status('not-scanned'), 'downloadFailed': status('download-failed'),
            'extractionIncomplete': status('extraction-incomplete'), 'fullOcrNoContents': status('full-ocr-no-contents'),
            'failedPages': sum(len(c.get('failedPages', [])) for c in coverage),
            'withCoteDorNotices': sum(c.get('coteDorNotices', 0) > 0 for c in coverage),
            'coteDorNotices': len(notices), 'farmStructureNotices': sum(n['farmStructures'] for n in notices)}


def validate_reviewed(reviewed, notices, communes):
    by_id = {n['id']: n for n in notices}
    for row in reviewed['parcels']:
        require(row['noticeId'] in by_id, f'Reviewed parcel cites unknown notice: {row["noticeId"]}')
        notice = by_id[row['noticeId']]
        require(row['actId'] == notice['actId'] and row['documentDate'] == notice['actDate'],
                f'Reviewed parcel {row["printedReference"]}: act or date differs from notice {row["noticeId"]}')
        require(row['communeCode'] in communes, f'Unknown commune code: {row["communeCode"]}')
        # null keeps a printed reference that cannot be normalised without guessing.
        require(row['reference'] is None or re.fullmatch(r'[A-Z]{1,2}\d{4}', row['reference']),
                f'Normalise reference as section + 4 digits: {row["reference"]}')
        require(row['printedReference'] and row['reviewedAt'] and row['reviewMethod'], 'Incomplete reviewed parcel')
        require(row['status'] in reviewed['statuses'], f'Unknown status: {row["status"]}')


def check(out_dir, communes, reviewed):
    """Validate committed outputs against the link lists without the scan cache."""
    urls = manifest_urls(out_dir)
    require((out_dir / 'coverage.json').exists(), 'coverage.json is missing')
    coverage_doc = json.loads((out_dir / 'coverage.json').read_text(encoding='utf-8'))
    coverage = coverage_doc['bulletins']
    require(sorted(c['url'] for c in coverage) == sorted(urls), 'Coverage does not match the link lists')
    notices = json.loads((out_dir / 'notices.json').read_text(encoding='utf-8'))['notices']
    texts = [json.loads(line) for line in gzip.decompress((out_dir / 'notice-text.jsonl.gz').read_bytes()).splitlines()]
    require([t['id'] for t in texts] == [n['id'] for n in notices], 'Notice text and index are out of step')
    require(len({n['id'] for n in notices}) == len(notices), 'Duplicate notice id')
    require(coverage_doc['summary'] == summarize(coverage, notices), 'Coverage summary does not match its rows')
    by_bulletin = {c['bulletin']: c for c in coverage}
    for n in notices:
        require(n['bulletin'] in by_bulletin and by_bulletin[n['bulletin']]['status'] in READABLE,
                f'{n["id"]}: notice from a bulletin that was not read')
    for bulletin, c in by_bulletin.items():
        require(c.get('coteDorNotices', 0) == sum(n['bulletin'] == bulletin for n in notices),
                f'{bulletin}: notice count differs from coverage')
    for n, t in zip(notices, texts):
        keys = [str(p) for p in range(n['firstPage'], n['lastPage'] + 1)]
        require(sorted(t['pages']) == sorted(keys) and sorted(t['pageStatus']) == sorted(keys),
                f'{n["id"]}: page text or status missing')
        failed = sorted(int(k) for k, s in t['pageStatus'].items() if s not in PAGE_OK)
        require(all(s in PAGE_OK or s.startswith('failed') for s in t['pageStatus'].values()), f'{n["id"]}: unknown page status')
        require(failed == n['failedPages'] and set(failed) <= set(by_bulletin[n['bulletin']].get('failedPages', [])),
                f'{n["id"]}: failed pages not declared')
    validate_reviewed(reviewed, notices, communes)
    return notices


def gzip_bytes(lines):
    buffer = io.BytesIO()
    with gzip.GzipFile(fileobj=buffer, mode='wb', mtime=0, compresslevel=9) as handle:
        handle.write(''.join(json.dumps(line, ensure_ascii=False, sort_keys=True) + '\n' for line in lines).encode())
    return buffer.getvalue()


def write_outputs(out_dir, coverage, notices, texts):
    summary = summarize(coverage, notices)
    years = sorted({c['bulletin'][4:8] for c in coverage})
    (out_dir / 'coverage.json').write_text(json.dumps({'years': years, 'summary': summary, 'bulletins': coverage},
                                                      ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    (out_dir / 'notices.json').write_text(json.dumps({'note': 'communesMentioned and referenceHints come from OCR and '
                                                      'include addresses and misreadings; review the page image before use.',
                                                      'notices': notices}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    (out_dir / 'notice-text.jsonl.gz').write_bytes(gzip_bytes(texts))
    return summary


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--check', action='store_true', help='validate committed outputs without the scan cache')
    args = parser.parse_args()
    communes = json.loads((OUT / 'cote-dor-communes.json').read_text(encoding='utf-8'))['communes']
    reviewed = json.loads((OUT / 'reviewed-parcels.json').read_text(encoding='utf-8'))
    if args.check:
        notices = check(OUT, communes, reviewed)
        print(f'{len(notices)} notices; {len(reviewed["parcels"])} reviewed parcels valid')
        return
    coverage, notices, texts = build(manifest_urls(OUT), CACHE, communes)
    validate_reviewed(reviewed, notices, communes)
    summary = write_outputs(OUT, coverage, notices, texts)
    check(OUT, communes, reviewed)
    print(json.dumps(summary))


if __name__ == '__main__':
    main()
