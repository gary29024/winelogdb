"""Expand curated earlier-bulletin decisions into reviewed parcel rows (#461).

  python scripts/build_earlier_bulletin_reviews.py --department cote-dor
  python scripts/build_earlier_bulletin_reviews.py --department cote-dor --check

Each curated decision must cite a PDF and pages present in the committed index.
Printed references are expanded within their commune group only; lettered
sub-parcels and slash pairs stay unresolved exactly as printed. A notice total is
never divided among parcels, and no row is a verified current farmer.
"""
import argparse
import gzip
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'docs/research/earlier-bulletins'
DICTIONARIES = {'cote-dor': 'cote-dor-communes.json', 'yonne': 'yonne-communes.json'}
STATUSES = {'authorised', 'refused', 'application-received', 'implicit-authorisation',
            'not-subject-to-authorisation', 'application-suspended',
            # A treatment derogation for listed parcels: never ownership, a lease or proof of who farmed them.
            'derogation-granted'}


def expand(group):
    """Shared sections carry forward within a printed group; unusual tokens stay unresolved."""
    rows, section = [], None
    for token in (t.strip() for t in re.split('[,;]', group['printedReferences'])):
        match = re.fullmatch(r'([A-Z]{1,2})\s+(\S+)', token)
        if match:
            section, number = match.groups()
        elif section:
            number = token
        else:
            raise ValueError(f'Reference without a section: {token!r}')
        printed = f'{section} {number}'
        reference = f'{section}{int(number):04d}' if number.isdigit() else None
        rows.append((printed, reference))
    return rows


TABLE_ROW = re.compile(r'^(?P<section>[A-Z]{1,2}\d?)\s+(?P<number>\d{1,4})\s+(?P<lieu>\S.*?)'
                       r'(?:\s{2,}(?P<area>\d+(?:\.\d+)?))?\s*$')
SHARED_AREA = re.compile(r'^\s{20,}(\d+\.\d+)\s*$')


def parse_table(table, page_text):
    """Rows of a printed parcel annex, read from the committed text layer and pinned by its image-read total.

    A merged surface cell (one area shared by several rows) is retained once as a shared
    area and never copied onto those rows; a blank commune cell stays null.
    """
    rows, shared, current = [], [], None
    for page in table['pages']:
        for line in page_text[page].splitlines():
            if re.search(r'Commune\s+Section', line):
                continue
            if (match := SHARED_AREA.match(line)) and float(match[1]) != table['printedTotalHa']:
                shared.append(float(match[1]))
                continue
            # Long names fill their column, so the printed commune is matched against the mapped names.
            stripped, printed = line.strip(), None
            for name in sorted(table['communes'], key=len, reverse=True):
                if stripped.startswith(name + ' '):
                    printed, stripped = name, stripped[len(name):].strip()
                    break
            if printed is None and not line.startswith(' ' * 10):
                continue  # not a blank commune cell
            match = TABLE_ROW.match(stripped)
            if not match:
                continue
            section, number = match['section'], match['number']
            rows.append({'communeCode': table['communes'][printed] if printed else None, 'printedCommune': printed,
                         'printedReference': f'{section} {number}',
                         'reference': f'{section}{int(number):04d}' if section.isalpha() else None,
                         'lieuDit': match['lieu'].strip(),
                         'printedRowAreaHa': float(match['area']) if match['area'] else None})
    total = round(sum(r['printedRowAreaHa'] or 0 for r in rows) + sum(shared), 4)
    if len(rows) != table['expectedRows'] or total != table['printedTotalHa']:
        raise ValueError(f'Parsed {len(rows)} rows totalling {total}; image-read {table["expectedRows"]} rows, '
                         f'{table["printedTotalHa"]} ha')
    return rows, shared


def build(department):
    directory = BASE / department
    curated = json.loads((directory / 'review-decisions.json').read_text(encoding='utf-8'))
    communes = json.loads((ROOT / 'docs/research/bfc-bulletins' / DICTIONARIES[department]).read_text(encoding='utf-8'))['communes']
    coverage = {d['url']: d for d in json.loads((directory / 'index/coverage.json').read_text(encoding='utf-8'))['documents']}
    with gzip.open(directory / 'index/page-text.jsonl.gz', 'rt', encoding='utf-8') as handle:
        text = {(row['url'], row['page']): row['text'] for row in map(json.loads, handle)}
    pages = set(text)
    sources, parcels = [], []
    for decision in curated['decisions']:
        document = coverage.get(decision['url'])
        if not document or document['sha256'] != decision['sha256'] or document.get('extractionStatus') != 'complete':
            raise ValueError(f'{decision["noticeId"]}: source is not a completely extracted indexed PDF with this hash')
        for page in decision['noticePages'] + decision['evidencePages']:
            if (decision['url'], page) not in pages:
                raise ValueError(f'{decision["noticeId"]}: page {page} is not in the committed page text')
        if decision['status'] not in STATUSES:
            raise ValueError(f'{decision["noticeId"]}: unknown status {decision["status"]}')
        if decision['documentDate'] is not None and decision['documentDate'] > decision['publicationDate']:
            raise ValueError(f'{decision["noticeId"]}: act date after its publication; record it as unresolved')
        expanded, shared = [], []
        if table := decision.get('parcelTable'):
            expanded, shared = parse_table(table, {p: text[(decision['url'], p)] for p in table['pages']})
            for row in expanded:
                if row['communeCode'] is not None and row['communeCode'] not in communes:
                    raise ValueError(f'{decision["noticeId"]}: unknown commune {row["communeCode"]}')
        for group in decision.get('parcelGroups', []):
            if group['communeCode'] not in communes:
                raise ValueError(f'{decision["noticeId"]}: unknown commune {group["communeCode"]}')
            for printed, reference in expand(group):
                expanded.append({'communeCode': group['communeCode'], 'printedCommune': group['printedCommune'],
                                 'printedReference': printed, 'reference': reference})
        single = len(expanded) == 1
        sources.append({**{k: v for k, v in decision.items()},
                        'title': f'{decision["bulletin"]}: {decision.get("actId") or decision["applicant"]} '
                                 f'({decision["printedDate"]}, Internet Archive capture)',
                        'parcelCount': len(expanded),
                        **({'sharedPrintedAreasHa': shared} if shared else {}),
                        'currentFarmerVerified': False, 'reviewedAt': curated['reviewedAt'],
                        'reviewMethod': curated['reviewMethod'],
                        'areaScope': 'Whole decision across all listed parcels; not a per-parcel or cadastral area.'})
        for row in expanded:
            parcels.append({'noticeId': decision['noticeId'], 'actId': None, 'documentDate': decision['documentDate'],
                            'printedDate': decision['printedDate'], 'publicationDate': decision['publicationDate'],
                            'applicant': decision['applicant'], 'previousOperator': decision['previousOperator'],
                            **row, 'status': decision['status'],
                            # A sole printed reference may carry the decision area; otherwise never divide it.
                            # A table prints each parcel's own surface; a merged (shared) cell stays null.
                            'areaHa': row['printedRowAreaHa'] if 'printedRowAreaHa' in row else
                                      decision['totalNoticeAreaHa'] if single else None,
                            'sourcePages': decision['evidencePages'], 'reviewedAt': curated['reviewedAt'],
                            'reviewMethod': curated['reviewMethod'], 'currentFarmerVerified': False,
                            'note': decision['note']})
    return {'schemaVersion': 2,
            'purpose': 'Image-reviewed historical parcel evidence from Internet Archive captures of earlier departmental '
                       'bulletins. Never proof of actual or current farming. Sources hold decision-level area and scope; '
                       'parcels hold one row per decision and printed reference.',
            'normalization': 'Shared sections carry forward within a printed commune group; numbers are padded to four '
                             'digits. Lettered sub-parcels and slash pairs keep reference null. Textual normalization only, '
                             'not a verified crosswalk to current cadastral geometry.',
            'dateRoles': {'documentDate': 'Signature date as printed; null when the printed date is impossible or incomplete.',
                          'printedDate': 'Exactly as printed.', 'publicationDate': 'Bulletin date.'},
            'sources': sources, 'parcels': parcels}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--department', choices=sorted(DICTIONARIES), required=True)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    text = json.dumps(build(args.department), ensure_ascii=False, indent=1) + '\n'
    target = BASE / args.department / 'reviewed-parcels.json'
    if args.check:
        if not target.exists() or target.read_text(encoding='utf-8') != text:
            raise SystemExit(f'{target} is out of date; rerun without --check')
    else:
        target.write_text(text, encoding='utf-8', newline='\n')
    print(json.dumps({'department': args.department, 'reviewedParcelRows': text.count('"printedReference"')}))


if __name__ == '__main__':
    main()
