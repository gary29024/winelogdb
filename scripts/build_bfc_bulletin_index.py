"""Build the Côte-d'Or notice index from scanned BFC administrative bulletins.

Reads the per-bulletin cache written by scan_bfc_bulletins.py and writes, under
docs/research/bfc-bulletins/:

  coverage.json            every bulletin checked, with hash and what was read
  notices.json             one row per Côte-d'Or DDT notice, with OCR-derived hints
  notice-text.jsonl.gz     the text of each notice's pages (gzip, deterministic)

reviewed-parcels.json is curated by hand after checking the page image; the
builder validates it against the notices. OCR-derived communes and references
are search hints, never evidence: only reviewed rows may feed a register.

  python scripts/build_bfc_bulletin_index.py            # rebuild from .tmp/bfc-bulletins
  python scripts/build_bfc_bulletin_index.py --check    # verify committed outputs
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


def build(cache_dir, communes):
    coverage, notices, texts = [], [], []
    for path in sorted(cache_dir.glob('*.json')):
        record = json.loads(path.read_text(encoding='utf-8'))
        match = BULLETIN.search(record['url'])
        require(match, f'Unrecognised bulletin URL: {record["url"]}')
        bulletin = f'bfc-{match.group(1)}-{match.group(2)}'
        if 'error' in record:
            coverage.append({'bulletin': bulletin, 'url': record['url'], 'status': 'download-failed'})
            continue
        coverage.append({'bulletin': bulletin, 'url': record['url'], 'sha256': record['sha256'],
                         'pages': record['pages'], 'contentsEntries': record['tocEntries'],
                         'coteDorNotices': len(record['coteDorEntries']),
                         'status': 'full-ocr-no-contents' if record['fallbackFullScan'] else 'contents-read'})
        entries = record['coteDorEntries']
        if record['fallbackFullScan']:
            # No readable contents list: keep the whole bulletin as one notice so its text stays searchable.
            entries = [{'section': 'Whole bulletin (no readable contents list)', 'title': '', 'page': 1,
                        'pages': record['pages'] - 2}]
        for entry in entries:
            act = ACT.search(entry['title'])
            last = min(record['pages'], entry['page'] + entry['pages'] + 1)
            pages = {p: record['text'][str(p)] for p in range(entry['page'], last + 1) if str(p) in record['text']}
            text = '\n'.join(pages.values())
            mentioned, refs = hints(text, communes)
            notice_id = f'{bulletin}:p{entry["page"]}'
            kind = next((k for k, pattern in KINDS if pattern.search(entry['title'])), 'other')
            notices.append({'id': notice_id, 'bulletin': bulletin, 'firstPage': entry['page'], 'lastPage': last,
                            'section': entry['section'], 'title': entry['title'],
                            'actId': act.group(0) if act else None,
                            'actDate': '-'.join(act.groups()) if act else None,
                            'applicant': applicant(entry['title'], act.group(0) if act else None),
                            'titleKind': kind, 'farmStructures': bool(FARM.search(entry['section'] + ' ' + entry['title'])),
                            'communesMentioned': mentioned, 'referenceHints': refs})
            texts.append({'id': notice_id, 'pages': {str(p): t for p, t in pages.items()}})
    coverage.sort(key=lambda c: c['bulletin'])
    notices.sort(key=lambda n: (n['bulletin'], n['firstPage']))
    order = {n['id']: i for i, n in enumerate(notices)}
    texts.sort(key=lambda t: order[t['id']])  # same order as notices.json
    require(len({n['id'] for n in notices}) == len(notices), 'Duplicate notice id')
    return coverage, notices, texts


def validate_reviewed(reviewed, notices, communes):
    by_id = {n['id']: n for n in notices}
    for row in reviewed['parcels']:
        require(row['noticeId'] in by_id, f'Reviewed parcel cites unknown notice: {row["noticeId"]}')
        require(row['communeCode'] in communes, f'Unknown commune code: {row["communeCode"]}')
        # null keeps a printed reference that cannot be normalised without guessing.
        require(row['reference'] is None or re.fullmatch(r'[A-Z]{1,2}\d{4}', row['reference']),
                f'Normalise reference as section + 4 digits: {row["reference"]}')
        require(row['printedReference'] and row['reviewedAt'] and row['reviewMethod'], 'Incomplete reviewed parcel')
        require(row['status'] in reviewed['statuses'], f'Unknown status: {row["status"]}')


def gzip_bytes(lines):
    buffer = io.BytesIO()
    with gzip.GzipFile(fileobj=buffer, mode='wb', mtime=0, compresslevel=9) as handle:
        handle.write(''.join(json.dumps(line, ensure_ascii=False, sort_keys=True) + '\n' for line in lines).encode())
    return buffer.getvalue()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--check', action='store_true', help='validate committed outputs without the scan cache')
    args = parser.parse_args()
    communes = json.loads((OUT / 'cote-dor-communes.json').read_text(encoding='utf-8'))['communes']
    reviewed = json.loads((OUT / 'reviewed-parcels.json').read_text(encoding='utf-8'))
    if args.check:
        notices = json.loads((OUT / 'notices.json').read_text(encoding='utf-8'))['notices']
        texts = [json.loads(line) for line in gzip.decompress((OUT / 'notice-text.jsonl.gz').read_bytes()).splitlines()]
        require([t['id'] for t in texts] == [n['id'] for n in notices], 'Notice text and index are out of step')
        validate_reviewed(reviewed, notices, communes)
        print(f'{len(notices)} notices; {len(reviewed["parcels"])} reviewed parcels valid')
        return
    coverage, notices, texts = build(CACHE, communes)
    validate_reviewed(reviewed, notices, communes)
    years = sorted({c['bulletin'][4:8] for c in coverage})
    summary = {'bulletins': len(coverage), 'downloadFailed': sum(c['status'] == 'download-failed' for c in coverage),
               'fullOcrNoContents': sum(c['status'] == 'full-ocr-no-contents' for c in coverage),
               'withCoteDorNotices': sum(c.get('coteDorNotices', 0) > 0 for c in coverage),
               'coteDorNotices': len(notices), 'farmStructureNotices': sum(n['farmStructures'] for n in notices)}
    (OUT / 'coverage.json').write_text(json.dumps({'years': years, 'summary': summary, 'bulletins': coverage},
                                                  ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    (OUT / 'notices.json').write_text(json.dumps({'note': 'communesMentioned and referenceHints come from OCR and '
                                                  'include addresses and misreadings; review the page image before use.',
                                                  'notices': notices}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    (OUT / 'notice-text.jsonl.gz').write_bytes(gzip_bytes(texts))
    print(json.dumps(summary))


if __name__ == '__main__':
    main()
