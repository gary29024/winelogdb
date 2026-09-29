#!/usr/bin/env python3
"""Validate the curated review overlay against the immutable departmental index."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import re
import unicodedata
from collections import Counter
from datetime import date

DEFAULT = Path(__file__).resolve().parents[1] / 'docs/research/cote-dor-bulletins'


def normalized_name(value):
    return re.sub(r'[^A-Z0-9]', '', ''.join(
        c for c in unicodedata.normalize('NFD', value.upper())
        if unicodedata.category(c) != 'Mn'))


def expanded_references(groups):
    result = []
    for group in groups:
        section = None
        for token in re.split('[,;]', group['printedReferences']):
            token = token.strip()
            match = re.fullmatch(r'([A-Z]{1,2})\s+(\d+)', token)
            if match:
                section, number = match.groups()
            else:
                if not section or not token.isdigit():
                    raise ValueError(f'Unresolved reference group: {token}')
                number = token
            result.append((group['communeCode'], group['printedCommune'],
                           f'{section} {number}', f'{section}{int(number):04d}'))
    return result


def validate_data(review, audit, context, pages, indexed, communes):
    def require(condition, message):
        if not condition:
            raise ValueError(message)

    def validate_source(source):
        require(source['currentFarmerVerified'] is False, 'Historical notice cannot verify current farmer')
        date.fromisoformat(source['documentDate'])
        date.fromisoformat(source['reviewedAt'])
        require(bool(source['evidencePages']), 'Missing image evidence pages')
        require(set(source['evidencePages']) <= set(source['noticePages']), 'Evidence outside notice')
        for number in source['noticePages']:
            page = pages.get((source['url'], number))
            require(page is not None, 'Source page missing from archive snapshot')
            require(page['sha256'] == source['sha256'], 'Source hash mismatch')
            require(page['status'] in {'text-layer', 'ocr'}, 'Unextracted source page')
        if source['noticeId'] in indexed:
            n = indexed[source['noticeId']]
            require(source['actId'] == n['actId'], 'Act ID mismatch')
            require(source['url'] == n['url'], 'Indexed URL mismatch')
            require(source['noticePages'] == list(range(n['firstPage'], n['lastPage'] + 1)),
                    'Indexed notice boundary mismatch')

    sources = {s['noticeId']: s for s in review['sources']}
    require(len(sources) == len(review['sources']), 'Duplicate reviewed notice')
    extra_communes = {}
    for source in review['communeCodeSources']:
        extra_communes.update(source.get('communes', {}))
    names = {**communes, **extra_communes}
    seen = set()
    for source in sources.values():
        validate_source(source)
        require(source['status'] in review['statuses'], 'Unknown outcome')
        for field in ['applicationDate', 'registeredDate']:
            require(date.fromisoformat(source[field]) <= date.fromisoformat(source['documentDate']),
                    'Application date after decision')
        expected = Counter(expanded_references(source['parcelGroups']))
        actual = []
        rows = [p for p in review['parcels'] if p['noticeId'] == source['noticeId']]
        require(len(rows) == source['parcelCount'], 'Parcel count mismatch')
        for p in rows:
            key = (p['noticeId'], p['printedCommune'], p['reference'])
            require(key not in seen, 'Duplicate parcel within decision')
            seen.add(key)
            for field in ['actId', 'documentDate', 'applicant', 'previousOperator', 'status',
                          'currentFarmerVerified', 'reviewedAt', 'reviewMethod', 'note']:
                require(p[field] == source[field], f'Parcel/source {field} mismatch')
            require(p['sourcePages'] == source['evidencePages'], 'Parcel evidence mismatch')
            require(p['areaHa'] is None or len(rows) == 1, 'Notice area allocated to multiple parcels')
            if p['areaHa'] is not None:
                require(p['areaHa'] == source['totalNoticeAreaHa'], 'Single-parcel authorised area mismatch')
            code = p['communeCode']
            if code is not None:
                require(code in names, 'Unknown commune code')
                require(normalized_name(names[code]) == normalized_name(p['printedCommune']),
                        'Printed commune/code mismatch')
            else:
                require('unresolved' in p['note'].lower(), 'Missing reason for unresolved commune')
            actual.append((code, p['printedCommune'], p['printedReference'], p['reference']))
        require(Counter(actual) == expected, 'Parcel rows differ from reviewed printed groups')
    require(len(seen) == len(review['parcels']), 'Orphan parcel notice ID')
    for source in context['sources']:
        validate_source(source)
        require(source['currentFarmer'] is None, 'Context beneficiary must not become farmer')
        require(source['noticeId'] not in sources, 'Context mixed into farming evidence')
    title_ids = {n['id'] for n in indexed.values() if n['farmStructures']}
    require({n['noticeId'] for n in audit['notices']} == title_ids, 'Incomplete title-match audit')
    require(len(audit['notices']) == len(title_ids), 'Duplicate audit entry')
    for n in audit['notices']:
        original = indexed[n['noticeId']]
        require(n['actId'] == original['actId'] and n['sha256'] == original['sourceSha256'],
                'Audit provenance mismatch')
        require((n['classification'] == 'reviewed-parcels') == (n['noticeId'] in sources),
                'Review status/source mismatch')
    for p in audit['keywordPages']:
        require(pages[(p['url'], p['page'])]['sha256'] == p['sha256'], 'Keyword page hash mismatch')
        require(all(i in sources for i in p['reviewedNoticeIds']), 'Unknown keyword review link')
    return dict(reviewedFarmDecisions=len(sources), parcelEvidenceRows=len(review['parcels']),
                distinctPrintedParcels=len({(p['printedCommune'], p['reference']) for p in review['parcels']}),
                unresolvedCommuneRows=sum(p['communeCode'] is None for p in review['parcels']),
                reviewedContextNotices=len(context['sources']),
                titleDispositions=dict(Counter(n['classification'] for n in audit['notices'])))


def validate(directory=DEFAULT, write_catalog=False):
    def read(name):
        return json.loads((directory / name).read_text(encoding='utf8'))
    review, audit, context = (read(n) for n in
                              ['reviewed-parcels.json', 'review-audit.json', 'reviewed-context.json'])
    raw = read('index/notices.json')
    indexed = {n['id']: n for n in (raw['notices'] if isinstance(raw, dict) else raw)}
    pages = {}
    for line in gzip.open(directory / 'index/page-text.jsonl.gz', 'rt', encoding='utf8'):
        p = json.loads(line)
        pages[(p['url'], p['page'])] = p
    communes = json.loads((directory.parent / 'bfc-bulletins/cote-dor-communes.json')
                          .read_text(encoding='utf8'))['communes']
    summary = validate_data(review, audit, context, pages, indexed, communes)
    files = ['reviewed-parcels.json', 'review-audit.json', 'reviewed-context.json',
             'index/snapshot.json', 'index/page-text.jsonl.gz']
    checksums = {name: hashlib.sha256((directory / name).read_bytes()).hexdigest() for name in files}
    if checksums['index/page-text.jsonl.gz'] != audit['search']['sha256']:
        raise ValueError('Review screening input changed')
    catalog = dict(schemaVersion=1, reviewedAt='2026-09-29', rawIndex='index/catalog.json',
                   reviewedParcels='reviewed-parcels.json', reviewAudit='review-audit.json',
                   reviewedContext='reviewed-context.json', summary=summary, sha256=checksums,
                   integration='Join modern reviews by noticeId; append legacy reviews from sources. Preserve each decision occurrence and null/uncertain fields. Do not import context beneficiaries as farming producers.')
    if write_catalog:
        (directory / 'review-catalog.json').write_text(
            json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf8', newline='\n')
    elif read('review-catalog.json') != catalog:
        raise ValueError('Review catalog/checksums stale; validate then use --write-catalog')
    return summary


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write-catalog', action='store_true')
    args = parser.parse_args()
    print(json.dumps(validate(write_catalog=args.write_catalog), ensure_ascii=False, indent=2))
