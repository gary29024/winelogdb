"""Query reviewed notices and unreviewed indexes with every reachable reference.

  python scripts/build_grand_cru_notice_history.py --cru echezeaux
  python scripts/build_grand_cru_notice_history.py --cru echezeaux --check

Reviewed printed references retain their original date, scope and source. OCR
hints are review candidates, never parcel events or proof of operation. Côte-d'Or
indexes are not applied to Yonne. Earlier unsearched intervals remain explicit.
"""
import argparse
import json
import re

from grand_cru import (record_json, ROOT, communes, load_cru, read_json, relative, require, research_path,
                       sha256, write_or_check)
from grand_cru_filiation import historical_evidence_paths

INDEXES = [
    {'id': 'regional-bfc-cote-dor', 'department': '21', 'publicationYears': list(range(2019, 2027)),
     'directory': 'docs/research/bfc-bulletins', 'index': 'notices.json', 'coverage': 'coverage.json'},
    {'id': 'departmental-cote-dor', 'department': '21', 'publicationYears': list(range(2016, 2021)),
     'directory': 'docs/research/cote-dor-bulletins', 'index': 'index/notices.json', 'coverage': 'index/coverage.json'},
    # Internet Archive captures only: years with at least one obtained bulletin, most of them partial.
    {'id': 'departmental-cote-dor-earlier-archive', 'department': '21',
     'publicationYears': [2004, 2005, 2006, 2008, 2010, 2011, 2013, 2015],
     'directory': 'docs/research/earlier-bulletins/cote-dor', 'index': 'index/notices.json', 'coverage': 'index/coverage.json'},
    # Yonne's own departmental bulletins; Côte-d'Or indexes are never applied to Yonne.
    {'id': 'departmental-yonne-archive', 'department': '89', 'publicationYears': list(range(2008, 2027)),
     'directory': 'docs/research/earlier-bulletins/yonne', 'index': 'index/notices.json', 'coverage': 'index/coverage.json'},
]

# Article 2 names four communes collectively, without assigning its individual
# rows. The earlier index used holder context for section D; preserve that reading
# as unassigned context rather than treating it as a printed commune assignment.
AMBIGUOUS_COMMUNE_NOTICES = {'bfc-2022-084:p171', 'bfc-2022-154:p19'}
AVAILABILITY_PATH = ROOT / 'scripts/grand-crus/sources/notice-coverage-2026-10-04.json'


def load_availability(path=AVAILABILITY_PATH):
    availability = read_json(path)
    for department in availability['departments'].values():
        for key in ('acquisitionRetry', 'archiveAcquisition', 'archiveRetry', 'commonCrawlRecovery'):
            if record := department.get(key):
                raw = (ROOT / record['report']).read_bytes().replace(b'\r\n', b'\n')
                require(sha256(raw) == record['sha256'], 'Notice acquisition report hash changed; review the dated snapshot')
    return availability


def normalized_reference(value):
    if not isinstance(value, str):
        return None
    match = re.fullmatch(r'\s*([A-Z]{1,2})\s*0*([0-9]{1,4})\s*', value.upper())
    return match[1].zfill(2) + match[2].zfill(4) if match else None


def match_printed_reference(commune, printed, reachable):
    """A notice does not print a section prefix: retain ambiguity rather than guess 000."""
    normalized = normalized_reference(printed)
    if not normalized or not commune:
        return []
    return sorted(p for p in reachable if p[:5] == commune and p[-6:] == normalized)


def query_reviewed(record, reachable, current_ids, ancestry, events):
    matched = match_printed_reference(record.get('communeCode'), record['reference'], reachable)
    if not matched:
        return None
    paths = [p for reference in matched for p in historical_evidence_paths(
        ancestry, events, reference, record['documentDate'])]
    ambiguous = len(matched) != 1
    commune_unassigned = record.get('noticeId') in AMBIGUOUS_COMMUNE_NOTICES
    for path in paths:
        path['qualifications'] = sorted(set(path['qualifications'] + ['section-prefix-not-printed']))
        if ambiguous:
            path['assignment'] = 'unassigned-context'
            path['qualifications'] = sorted(set(path['qualifications'] + ['section-prefix-not-resolved']))
        if record.get('areaHa') is not None:
            path['assignment'] = 'unassigned-context'
            path['qualifications'] = sorted(set(path['qualifications'] + ['notice-area-scope-not-located-on-current-parcel']))
        if commune_unassigned:
            path['assignment'] = 'unassigned-context'
            path['qualifications'] = sorted(set(path['qualifications'] + ['printed-row-commune-not-assigned']))
        if record['documentDate'] is None:  # impossible or incomplete printed date: no chronology check is possible
            path['assignment'] = 'unassigned-context'
            path['qualifications'] = sorted(set(path['qualifications'] + ['notice-act-date-unresolved']))
    return {'originalRecord': record, 'originalDate': record['documentDate'], 'dateRole': 'notice-act-date',
            'originalPrintedReference': record['printedReference'], 'matchedReferenceIds': matched,
            'sectionPrefixPrinted': False, 'referenceMatch': 'printed-row-commune-not-assigned' if commune_unassigned else
             'ambiguous-prefix' if ambiguous else 'unique-reachable-reference',
            'directCurrentParcelIds': sorted(set(matched) & current_ids)
                if not ambiguous and not commune_unassigned and record['documentDate'] is not None else [],
            **({'directMatchWithheld': 'notice-act-date-unresolved'}
               if record['documentDate'] is None and set(matched) & current_ids else {}),
            'contextPaths': paths, 'currentFarmer': None,
            'limitation': 'A reviewed notice names an applicant or a historical procedure, never verified current operation. Original area and scope remain those of the notice.'}


def curated_page_reviews(curation):
    """Image-reviewed assigned references or explicitly rejected OCR hints; a rejection creates no event.

    A republished copy of an already-reviewed act ("repeatOf" its source) is covered by that act's event,
    not a second event."""
    events = {}
    for event in curation['exactParcelEvents']:
        events.setdefault(event['sourceId'], set()).update([*event['parcelIds'], *event.get('predecessorReferences', {})])
    sources = {source['id']: source for source in curation.get('sources', [])}
    reviews = []
    for review in curation.get('noticeReview', []):
        rejected = review.get('rejectedReferenceHints', {})
        require(isinstance(rejected, dict), 'Rejected notice hints require exact references and reasons')
        if rejected:
            require(review.get('reviewMethod') == 'page-image', 'Rejected notice hints require page-image review')
            source = sources.get(review['sourceId'], {})
            require(source.get('type', '').startswith('government') and source.get('url'),
                    'Rejected notice hints require a government source')
            require(re.fullmatch(r'[a-f0-9]{64}', review.get('sha256', '')) and review.get('pages')
                    and all(isinstance(page, int) and page > 0 for page in review['pages']),
                    'Rejected notice hints require pinned PDF bytes and reviewed pages')
            require(all(re.fullmatch(r'[0-9AB]{5}[0-9]{3}[0-9A-Z]{2}[0-9]{4}', reference)
                        and isinstance(reason, str) and reason.strip() for reference, reason in rejected.items()),
                    'Rejected notice hints require full parcel references and nonempty reasons')
            require(not set(rejected) & events.get(review['sourceId'], set()),
                    'A notice reference cannot be both assigned and rejected')
        if 'repeatOf' in review:
            require(review['repeatOf'] in events and review['repeatOf'] in sources,
                    'A republished act must repeat a reviewed source with a parcel event')
        if review.get('reviewMethod') == 'page-image':
            reviews.append({**review, 'references': events.get(review['sourceId'], set()) | events.get(review.get('repeatOf'), set())
                            | set(rejected)})
    return reviews


def covered_by_curated_review(notice, bulletin, matched, reviews):
    """Same bulletin bytes, an overlapping image-reviewed page, every matched reference assigned or rejected."""
    if bulletin is None or 'firstPage' not in notice:
        return False
    pages = set(range(notice['firstPage'], notice['lastPage'] + 1))
    return any(
        r['bulletin'] == notice['bulletin'] and r['sha256'] == bulletin['sha256'] and pages & set(r['pages'])
        and set(matched) <= r['references'] for r in reviews)


def build(cru, bundle, history):
    require(history['parentFeatureId'] == cru['parentFeatureId'], 'History belongs to another cru')
    current = {r['parcelId'] for r in history['parcels']}
    cru_communes = {p[:5] for p in current}
    ancestry = [r['documentedAncestry'] for r in history['parcels'] if 'documentedAncestry' in r]
    reachable = current | {p for row in ancestry for p in row['ancestorIds']}
    events = history.get('documentedEvents', [])
    selected = [index for index in INDEXES if any(c.startswith(index['department']) for c in cru_communes)]
    availability_path = AVAILABILITY_PATH
    availability = load_availability(availability_path)
    reviewed, candidates, unresolved, inputs, index_coverage, already_reviewed = [], [], [], [], [], []
    curation_path = research_path(cru, 'curation.json')
    curation = read_json(curation_path) if curation_path.exists() else None
    curated_reviews = curated_page_reviews(curation) if curation else []
    for config in selected:
        directory = ROOT / config['directory']
        reviewed_data, notices, coverage = (read_json(directory / 'reviewed-parcels.json'),
                                           read_json(directory / config['index']), read_json(directory / config['coverage']))
        by_notice = {n['id']: n for n in notices['notices']}
        source_metadata = {s['noticeId']: s for s in reviewed_data.get('sources', [])}
        if 'bulletins' in coverage:
            bulletins = {b['bulletin']: b for b in coverage['bulletins']}
        else:
            bulletins = {}
        for name in ['reviewed-parcels.json', config['index'], config['coverage']]:
            data = (directory / name).read_bytes().replace(b'\r\n', b'\n')
            inputs.append({'path': relative(directory / name), 'sha256': sha256(data)})
        for record in reviewed_data['parcels']:
            match = query_reviewed(record, reachable, current, ancestry, events)
            if match is None:
                if record.get('communeCode') in cru_communes:
                    unresolved.append({'originalRecord': record, 'indexId': config['id'],
                                       'reason': 'unresolved-printed-reference' if normalized_reference(record.get('reference')) is None
                                                 else 'outside-reachable-reference-set', 'assignment': 'unassigned'})
                continue
            notice = by_notice.get(record['noticeId'], {})
            source = source_metadata.get(record['noticeId'])
            if source is None and notice.get('bulletin') in bulletins:
                source = bulletins[notice['bulletin']]
            reviewed.append({**match, 'indexId': config['id'], 'source': source,
                             'originalNoticeMetadata': source_metadata.get(record['noticeId'], notice)})
        reviewed_notice_ids = {r['noticeId'] for r in reviewed_data['parcels']}
        for notice in notices['notices']:
            if not notice.get('farmStructures') or not set(notice['communesMentioned']) & {p[:5] for p in reachable}:
                continue
            hints = {normalized_reference(h) for h in notice['referenceHints']} - {None}
            matched = sorted(p for p in reachable if p[:5] in notice['communesMentioned'] and p[-6:] in hints)
            # A notice whose page images were already read is reported through its reviewed rows, not as pending review.
            if matched and (notice['id'] in reviewed_notice_ids or
                            covered_by_curated_review(notice, bulletins.get(notice.get('bulletin')), matched, curated_reviews)):
                already_reviewed.append(notice['id'])
            elif matched:
                candidates.append({'indexId': config['id'], 'noticeId': notice['id'], 'matchedReferenceIds': matched,
                                   'printedOcrHints': notice['referenceHints'], 'notice': notice,
                                   'reviewStatus': 'unreviewed-search-candidate', 'assignment': 'unassigned',
                                   'limitation': 'OCR may contain addresses or misread references. A page-image review is required before any parcel event is published.'})
        index_coverage.append({'id': config['id'], 'department': config['department'],
                               'publicationYearsIndexed': config['publicationYears'], 'summary': coverage['summary'],
                               'earlierAvailableYearsAudit': availability['departments'][config['department']],
                               'unsearchedIntervals': availability['departments'][config['department']]['unsearchedIntervals']})
    missing_departments = sorted({c[:2] for c in cru_communes} - {i['department'] for i in selected})
    if curation:
        source_map = {s['id']: s for s in curation['sources']}
        inputs.append({'path': relative(curation_path), 'sha256': sha256(curation_path.read_bytes().replace(b'\r\n', b'\n'))})
        for event in curation['exactParcelEvents']:
            source = source_map[event['sourceId']]
            if not source['type'].startswith('government'):
                continue
            original_references = [*event['parcelIds'], *event.get('predecessorReferences', {})]
            for reference in original_references:
                record = {'communeCode': reference[:5], 'reference': reference[-6:].lstrip('0'),
                          'printedReference': None, 'noticeId': event['sourceId'], 'documentDate': event['documentDate'],
                          'curationEvent': event, 'referenceBasis': 'curation-exact-reference-reading'}
                match = query_reviewed(record, reachable, current, ancestry, events)
                if match:
                    reviewed.append({**match, 'indexId': 'cru-reviewed-notice-curation', 'source': source,
                                     'originalNoticeMetadata': event})
    return {'schemaVersion': 1, 'parentFeatureId': cru['parentFeatureId'],
            'inputs': {'parcelSnapshotSha256': history['inputs']['parcelSnapshotSha256'],
                       'history': relative(research_path(cru, 'rights-history.json')), 'indexes': inputs},
            'coverage': {'indexes': index_coverage, 'missingDepartmentIndexes': missing_departments,
                         'availabilityAudit': {'path': relative(availability_path),
                                               'sha256': sha256(availability_path.read_bytes().replace(b'\r\n', b'\n')),
                                               'departments': {d: availability['departments'][d] for d in sorted({c[:2] for c in cru_communes})}},
                         'reachableReferencesQueried': sorted(reachable),
                         'reviewedMatches': len(reviewed), 'unreviewedSearchCandidates': len(candidates),
                         'searchMatchesAlreadyReviewed': sorted(set(already_reviewed)),
                         'earliestMatchedActDate': min((r['originalDate'] for r in reviewed if r['originalDate']), default=None),
                         'latestMatchedActDate': max((r['originalDate'] for r in reviewed if r['originalDate']), default=None),
                         'reviewedMatchesWithUnresolvedActDate': sum(r['originalDate'] is None for r in reviewed),
                         'limitation': 'Index publication years and matched act dates are different. Earlier unavailable or unsearched notices are not absent records; notice coverage does not reach back to the oldest DFI event.'},
            'reviewedMatches': reviewed, 'unreviewedCandidates': candidates, 'unassignedReviewedReferences': unresolved}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--cru', required=True)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    cru, bundle = load_cru(args.cru)
    history = read_json(research_path(cru, 'rights-history.json'))
    result = build(cru, bundle, history)
    write_or_check(research_path(cru, 'notice-history.json'), record_json(result), args.check)
    print(json.dumps({k: result['coverage'][k] for k in ['reviewedMatches', 'unreviewedSearchCandidates', 'missingDepartmentIndexes']}))


if __name__ == '__main__':
    main()
