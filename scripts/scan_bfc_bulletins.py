"""Scan Bourgogne-Franche-Comté administrative bulletins for Côte-d'Or DDT notices.

Each bulletin opens with a machine-readable table of contents that lists every
act under its issuing service with a page number. Only acts listed under the
Côte-d'Or DDT are read; scanned pages are OCRed. A bulletin without a readable
contents list is OCRed in full rather than skipped.

  python scripts/scan_bfc_bulletins.py docs/research/bfc-bulletins/links-2022.txt [...]

Results are cached per bulletin in .tmp/bfc-bulletins/ (one JSON each) and are
the input of build_bfc_bulletin_index.py. Needs curl, poppler-utils and
tesseract with the French language pack. The yearly link lists come from the
prefecture's listing pages saved in a browser; the listing pages refuse
automated clients, the PDFs do not.
"""
import argparse
import hashlib
import json
import os
import re
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.tmp/bfc-bulletins'
SECTION = re.compile(r"territoires de la C[ôo]te.d.Or", re.I)
ENTRY_END = re.compile(r"\((\d+)\s*pages?\)\s*Page\s*(\d+)\s*$", re.I)
SECTION_HINT = re.compile(r'/|Direction|DRAAF|DREAL|ARS|Préfecture|Rectorat|DDT|DDETS')
MIN_TEXT_LAYER = 400  # characters; below this a page is treated as a scan


def pdf_text(pdf, first, last):
    return subprocess.run(['pdftotext', '-f', str(first), '-l', str(last), '-layout', pdf, '-'],
                          capture_output=True, text=True).stdout


def page_text(pdf, page):
    text = pdf_text(pdf, page, page)
    if len(re.sub(r'\s', '', text)) >= MIN_TEXT_LAYER:
        return text
    with tempfile.TemporaryDirectory() as tmp:
        stem = os.path.join(tmp, 'page')
        subprocess.run(['pdftoppm', '-f', str(page), '-l', str(page), '-r', '110', '-gray', '-png',
                        '-singlefile', pdf, stem], check=True)
        return subprocess.run(['tesseract', stem + '.png', '-', '-l', 'fra', '--psm', '3'], capture_output=True,
                              text=True, env={**os.environ, 'OMP_THREAD_LIMIT': '1'}).stdout


def contents(pdf, pages):
    """Parse (section, title, pages, first page) from the leading contents list."""
    section, buffer, entries = None, '', []
    for line in pdf_text(pdf, 1, min(pages, 10)).splitlines():
        if not line.strip():
            continue
        if not line.startswith((' ', '\t')) and not ENTRY_END.search(line):
            if SECTION_HINT.search(line):
                section, buffer = line.strip(), ''
                continue
            if section and not buffer:
                section += ' ' + line.strip()  # wrapped section title
                continue
        buffer += ' ' + line.strip()
        match = ENTRY_END.search(buffer)
        if match and section:
            entries.append({'section': section, 'title': re.sub(r'\s+', ' ', buffer[:match.start()]).strip(),
                            'pages': int(match.group(1)), 'page': int(match.group(2))})
            buffer = ''
    return entries


def scan(url):
    name = url.rsplit('/', 1)[1].replace('(1)', '').replace('(2)', '')
    record = CACHE / (name + '.json')
    if record.exists() and 'error' not in json.loads(record.read_text(encoding='utf-8')):
        return
    pdf = str(CACHE / name)
    result = subprocess.run(['curl', '-sSfL', '-m', '900', '--retry', '5', '--retry-all-errors', '-C', '-',
                             '-o', pdf, url], capture_output=True, text=True)
    if result.returncode:
        record.write_text(json.dumps({'url': url, 'error': result.stderr.strip()}), encoding='utf-8')
        return
    pages = int(re.search(r'Pages:\s+(\d+)', subprocess.run(['pdfinfo', pdf], capture_output=True, text=True).stdout).group(1))
    sha256 = hashlib.sha256(Path(pdf).read_bytes()).hexdigest()
    entries = contents(pdf, pages)
    targets = [e for e in entries if SECTION.search(e['section'])]
    text = {}
    for entry in targets:
        # The listed page is the act's separator page; read one page beyond the stated length.
        for page in range(entry['page'], min(pages, entry['page'] + entry['pages'] + 1) + 1):
            text.setdefault(page, page_text(pdf, page))
    fallback = not entries
    if fallback:
        text = {page: page_text(pdf, page) for page in range(1, pages + 1)}
    record.write_text(json.dumps({'url': url, 'sha256': sha256, 'pages': pages, 'tocEntries': len(entries),
                                  'coteDorEntries': targets, 'fallbackFullScan': fallback,
                                  'text': {str(k): v for k, v in sorted(text.items())}}, ensure_ascii=False),
                      encoding='utf-8')
    os.remove(pdf)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('link_lists', nargs='+', type=Path)
    parser.add_argument('--jobs', type=int, default=4)
    args = parser.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)
    urls = [u.strip() for path in args.link_lists for u in path.read_text(encoding='utf-8').splitlines() if u.strip()]
    with ThreadPoolExecutor(args.jobs) as pool:
        list(pool.map(scan, urls))
    failed = [p.name for p in CACHE.glob('*.json') if 'error' in json.loads(p.read_text(encoding='utf-8'))]
    print(f'{len(urls)} bulletins requested; {len(failed)} failed downloads (rerun to retry): {failed}')


if __name__ == '__main__':
    main()
