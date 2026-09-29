"""Scan Bourgogne-Franche-Comté administrative bulletins for Côte-d'Or DDT notices.

Each bulletin opens with a machine-readable table of contents that lists every
act under its issuing service with a page number. Only acts listed under the
Côte-d'Or DDT are read; scanned pages are OCRed. A bulletin without a readable
contents list is OCRed in full rather than skipped.

  python scripts/scan_bfc_bulletins.py docs/research/bfc-bulletins/links-2022.txt [...]

Downloads run one at a time per host, paced by --min-interval and backing off
on throttling (HTTP 429/503, honouring Retry-After, and HTTP/2 ENHANCE_YOUR_CALM);
OCR runs in parallel. Every extraction step's exit status is recorded per page:
a failed page is kept as "failed" (with any text-layer output preserved), the
record is marked incomplete and the next run retries it.

Cache (outside Git): .tmp/bfc-bulletins/records/<bulletin>.json, and PDFs in
.tmp/bfc-bulletins/pdf/ for bulletins with Côte-d'Or notices or failed pages
(--keep-all-pdfs keeps every PDF). Needs curl, poppler-utils and tesseract with
the French language pack. The yearly link lists come from the prefecture's
listing pages saved in a browser; the listing pages refuse automated clients.
"""
import argparse
import hashlib
import json
import os
import random
import re
import subprocess
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.tmp/bfc-bulletins'
SCHEMA = 2
SECTION = re.compile(r"territoires de la C[ôo]te.d.Or", re.I)
ENTRY_END = re.compile(r"\((\d+)\s*pages?\)\s*Page\s*(\d+)\s*$", re.I)
SECTION_HINT = re.compile(r'/|Direction|DRAAF|DREAL|ARS|Préfecture|Rectorat|DDT|DDETS')
BULLETIN = re.compile(r'recueil-bfc-(\d{4})-(\d{3})')
MIN_TEXT_LAYER = 400  # characters; below this a page is treated as a scan
THROTTLED = {429, 503}
run = subprocess.run  # patched in tests


def bulletin_id(url):
    match = BULLETIN.search(url)
    if not match:
        raise ValueError(f'Unrecognised bulletin URL: {url}')
    return f'bfc-{match.group(1)}-{match.group(2)}'


def pdf_text(pdf, first, last):
    result = run(['pdftotext', '-f', str(first), '-l', str(last), '-layout', pdf, '-'], capture_output=True, text=True)
    return result.stdout if result.returncode == 0 else None


def page_text(pdf, page):
    """Return (text, status): status is text-layer, ocr, or failed:<step>. Failed OCR keeps text-layer output."""
    layer = pdf_text(pdf, page, page)
    if layer is not None and len(re.sub(r'\s', '', layer)) >= MIN_TEXT_LAYER:
        return layer, 'text-layer'
    with tempfile.TemporaryDirectory() as tmp:
        stem = os.path.join(tmp, 'page')
        image = run(['pdftoppm', '-f', str(page), '-l', str(page), '-r', '110', '-gray', '-png', '-singlefile', pdf, stem],
                    capture_output=True, text=True)
        if image.returncode or not os.path.exists(stem + '.png'):
            return layer or '', 'failed:pdftoppm'
        ocr = run(['tesseract', stem + '.png', '-', '-l', 'fra', '--psm', '3'], capture_output=True, text=True,
                  env={**os.environ, 'OMP_THREAD_LIMIT': '1'})
    if ocr.returncode:
        return layer or '', 'failed:tesseract'
    return ocr.stdout, 'ocr' if layer is not None else 'ocr-no-text-layer'


def contents(pdf, pages):
    """Parse (section, title, pages, first page) from the leading contents list; None if unreadable."""
    raw = pdf_text(pdf, 1, min(pages, 10))
    if raw is None:
        return None
    section, buffer, entries = None, '', []
    for line in raw.splitlines():
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


def complete(record):
    """A record is final only when downloaded, current schema, and every read page extracted."""
    return (record is not None and 'error' not in record and record.get('schemaVersion') == SCHEMA
            and not record.get('failedPages'))


def legacy_complete(record):
    # Pre-schema records carry no page statuses; only those that read no pages can be trusted as they are.
    return (record is not None and 'error' not in record and 'schemaVersion' not in record
            and not record.get('coteDorEntries') and not record.get('fallbackFullScan'))


class Downloader:
    """One download at a time per host, with pacing, bounded retries, jitter and a shared cooldown."""

    def __init__(self, min_interval=0.0, attempts=5, base_delay=30.0, sleep=time.sleep, clock=time.monotonic):
        self.min_interval, self.attempts, self.base_delay = min_interval, attempts, base_delay
        self.sleep, self.clock, self.ready = sleep, clock, {}

    def fetch(self, url, dest):
        host = urlparse(url).hostname
        for attempt in range(self.attempts):
            wait = self.ready.get(host, 0) - self.clock()
            if wait > 0:
                self.sleep(wait)
            with tempfile.NamedTemporaryFile() as headers:
                result = run(['curl', '-sSL', '-m', '900', '-C', '-', '-D', headers.name, '-w', '%{http_code}',
                              '-o', str(dest), url], capture_output=True, text=True)
                header_text = Path(headers.name).read_text(errors='ignore')
            status = int(result.stdout.strip() or 0) if result.stdout.strip().isdigit() else 0
            self.ready[host] = self.clock() + self.min_interval
            if result.returncode == 0 and status in (200, 206):
                return None
            throttled = status in THROTTLED or 'ENHANCE_YOUR_CALM' in result.stderr
            retry_after = re.findall(r'(?im)^retry-after:\s*(\d+)', header_text)
            delay = max(float(retry_after[-1]) if retry_after else 0, self.base_delay * 2 ** attempt)
            self.ready[host] = self.clock() + delay * random.uniform(1, 1.25)
            error = f'HTTP {status} ' if status else ''
            error += 'throttled' if throttled else (result.stderr.strip() or 'download failed')
        return f'{error} after {self.attempts} attempts'


def process(url, pdf, keep_all):
    pages_info = run(['pdfinfo', str(pdf)], capture_output=True, text=True)
    count = re.search(r'Pages:\s+(\d+)', pages_info.stdout)
    if pages_info.returncode or not count:
        return {'url': url, 'error': 'pdfinfo failed', 'schemaVersion': SCHEMA}
    pages = int(count.group(1))
    entries = contents(str(pdf), pages)
    targets = [e for e in entries or [] if SECTION.search(e['section'])]
    wanted = []
    for entry in targets:
        # The listed page is the act's separator page; read one page beyond the stated length.
        wanted += range(entry['page'], min(pages, entry['page'] + entry['pages'] + 1) + 1)
    fallback = not entries
    if fallback:  # unreadable or empty contents: read everything rather than skip the bulletin
        wanted = range(1, pages + 1)
    text, status = {}, {}
    for page in wanted:
        if page not in text:  # overlapping acts share pages; extract each once
            text[page], status[page] = page_text(str(pdf), page)
    failed = sorted(p for p, s in status.items() if s.startswith('failed'))
    record = {'schemaVersion': SCHEMA, 'url': url, 'sha256': hashlib.sha256(pdf.read_bytes()).hexdigest(),
              'pages': pages, 'contentsStatus': 'unreadable' if entries is None else 'read', 'tocEntries': len(entries or []),
              'coteDorEntries': targets, 'fallbackFullScan': fallback, 'failedPages': failed,
              'text': {str(k): v for k, v in sorted(text.items())}, 'pageStatus': {str(k): v for k, v in sorted(status.items())}}
    if not (keep_all or targets or failed or fallback):
        pdf.unlink()
    return record


def scan(urls, jobs=4, min_interval=0.0, keep_all=False, downloader=None):
    records, pdfs = CACHE / 'records', CACHE / 'pdf'
    records.mkdir(parents=True, exist_ok=True)
    pdfs.mkdir(parents=True, exist_ok=True)
    downloader = downloader or Downloader(min_interval)
    pending = []
    with ThreadPoolExecutor(jobs) as pool:
        for url in urls:
            name = bulletin_id(url)
            path = records / f'{name}.json'
            record = json.loads(path.read_text(encoding='utf-8')) if path.exists() else None
            if complete(record) or legacy_complete(record):
                continue
            pdf = pdfs / f'{name}.pdf'
            if not (pdf.exists() and record and record.get('sha256') == hashlib.sha256(pdf.read_bytes()).hexdigest()):
                error = downloader.fetch(url, pdf)
                if error:
                    attempts = (record or {}).get('attempts', 0) + 1
                    path.write_text(json.dumps({'url': url, 'error': error, 'attempts': attempts,
                                                'lastAttempt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}),
                                    encoding='utf-8')
                    continue
            pending.append(pool.submit(lambda u=url, p=pdf, out=path: out.write_text(
                json.dumps(process(u, p, keep_all), ensure_ascii=False), encoding='utf-8')))
        for future in pending:
            future.result()
    incomplete = [p.stem for p in records.glob('*.json')
                  if not (complete(r := json.loads(p.read_text(encoding='utf-8'))) or legacy_complete(r))]
    return incomplete


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('link_lists', nargs='+', type=Path)
    parser.add_argument('--jobs', type=int, default=4, help='parallel OCR workers')
    parser.add_argument('--min-interval', type=float, default=0.0, help='seconds between downloads from one host')
    parser.add_argument('--keep-all-pdfs', action='store_true')
    args = parser.parse_args()
    urls = [u.strip() for path in args.link_lists for u in path.read_text(encoding='utf-8').splitlines() if u.strip()]
    incomplete = scan(urls, args.jobs, args.min_interval, args.keep_all_pdfs)
    print(f'{len(urls)} bulletins requested; {len(incomplete)} incomplete (rerun to retry): {sorted(incomplete)}')


if __name__ == '__main__':
    main()
