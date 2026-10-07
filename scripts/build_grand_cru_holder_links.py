"""Check the shared holder-to-domaine table and generate its coverage report and research queue.

  python scripts/build_grand_cru_holder_links.py
  python scripts/build_grand_cru_holder_links.py --check      # also run by build_grand_cru_research.py --all

docs/research/holders/holder-links.json is curated once per legal holder (SIREN or provisional U… identifier) and
read by every cru that sets "holderLinks": "shared" in its curation. A link names a domaine or producer, the
company relation and its sources; it is a research link, never evidence that the domaine farms a parcel.
Writes docs/research/holders/holders.md from the table and the generated cru registers.
Only the standard library is required. No network access.
"""
import argparse
import re
from collections import Counter, defaultdict

from grand_cru import (ACTIVE_LINK_STATUSES, HOLDER_LINKS, active_holder_links, cru_slugs, load_cru, read_json, relative,
                       require, research_path, write_or_check)

REPORT = HOLDER_LINKS.parent / 'holders.md'
# What connects the recorded legal holder to the domaine. None of these is farming.
RELATIONS = {
    'owner-company': "the holder is the domaine's own company",
    'family-holding': "a family land company of the domaine's owners",
    'subsidiary': 'a company the domaine controls',
    'parent-group': 'a company that controls the domaine',
    'common-ownership': 'a sister company under the same owners',
    'partner-company': "the domaine's company is a recorded partner of the holder",
    'management': 'shared management only',
    'brand-identity': "the company behind the domaine's brand",
    'lessor-per-filing': 'a filing names the domaine side as tenant or intended tenant',
    'reported-tenancy': 'critics or the trade report a tenancy',
    'succession': 'the domaine succeeded to part of the holding',
    'shared-office': 'a shared registered office only',
}
# A lease or a reported tenancy covers particular land, so the link is limited to the crus whose parcels it names.
SCOPED = {'lessor-per-filing', 'reported-tenancy'}
# A corporate relation, or any reviewed link, rests on a company record, filing or legal notice.
CORPORATE = {'family-holding', 'subsidiary', 'parent-group', 'common-ownership', 'partner-company'}
IDENTITY_SOURCE_TYPES = {'registry', 'registry-aggregator', 'company-filing', 'legal-notice-republisher', 'court-decision',
                         'government-decision', 'government-event'}
LEASE_STATUSES = {'executed', 'recited', 'mandate-only'}
STATUSES = ACTIVE_LINK_STATUSES | {'retired'}
SEARCH_OUTCOMES = {'linked', 'no-link-found', 'partial'}
SOURCE_TYPES = {'registry', 'registry-aggregator', 'company-filing', 'legal-notice-republisher', 'court-decision',
                'government-decision', 'government-event', 'estate', 'estate-hosted-press', 'importer', 'merchant',
                'press', 'critic-research', 'book', 'auction'}
DATE = re.compile(r'^\d{4}-\d{2}-\d{2}$')
HOLDER_ID = re.compile(r'^(\d{9}|U\d+)$')
# Exported wording never claims farming.
FARMING_CLAIM = re.compile(r'\b(farms|farmed by|is farming|currently farming|farmer of|operates the parcel)\b', re.I)


def recorded_holders():
    """holderId -> {'names', 'crus', 'parcels'} from every cru's generated register.

    A parcel inside two crus (e.g. Corton and Corton-Charlemagne) counts once."""
    holders = defaultdict(lambda: {'names': set(), 'crus': set(), 'parcels': set()})
    parcels_with_rights = set()
    for slug in cru_slugs():
        cru, _ = load_cru(slug)
        if 'research' not in cru:
            continue
        for parcel in read_json(research_path(cru, 'register.json'))['parcels']:
            ids = {r['holderId'] for r in parcel['recordedRights']}
            if ids:
                parcels_with_rights.add(parcel['parcelId'])
            for right in parcel['recordedRights']:
                holders[right['holderId']]['names'].add(right['name'])
            for hid in ids:
                holders[hid]['crus'].add(slug)
                holders[hid]['parcels'].add(parcel['parcelId'])
    return dict(holders), parcels_with_rights


def curations():
    found = {}
    for slug in cru_slugs():
        cru, _ = load_cru(slug)
        if 'research' in cru:
            found[slug] = (cru, read_json(research_path(cru, 'curation.json')))
    return found


def strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from strings(item)


def validate(table, recorded, cru_curations):
    require(table['schemaVersion'] == 1, 'Unknown holder table schema')
    sources = {s['id']: s for s in table['sources']}
    require(len(sources) == len(table['sources']), 'Duplicate shared source ID')
    curation_source_ids = {s['id'] for _, c in cru_curations.values() for s in c['sources']}
    clash = sorted(sources.keys() & curation_source_ids)
    require(not clash, f'Shared source IDs must be unique across the table and every curation: {", ".join(clash)}')
    for s in table['sources']:
        sid = s['id']
        require(s.get('title') and s.get('finding') and s.get('access'), f'{sid}: source needs a title, finding and access')
        require(str(s.get('url', '')).startswith('https://'), f'{sid}: source needs an https URL')
        require(s.get('type') in SOURCE_TYPES, f'{sid}: unknown source type {s.get("type")}')
        require('documentDate' in s and (s['documentDate'] is None or re.match(r'^\d{4}(-\d{2}(-\d{2})?)?$', s['documentDate'])),
                f'{sid}: source needs a documentDate (deed or document date, or null)')
        require(DATE.match(s.get('reviewedAt') or ''), f'{sid}: source needs its review date')
        if s['type'] == 'company-filing':
            # The deed date is documentDate; a filing or deposit date, where printed, is kept separately.
            require(s['documentDate'], f'{sid}: a filing needs its deed or document date')
            require(re.match(r'^[0-9a-f]{64}$', s.get('sha256', '')), f'{sid}: a filing needs the SHA-256 of its raw bytes')
            require(s.get('reviewedPages') or '#page=' in s['url'], f'{sid}: a filing needs its reviewed pages or a page anchor')
        if 'retrievedFrom' in s:
            require(re.match(r'^[0-9a-f]{64}$', s.get('sha256', '')) and DATE.match(s.get('retrievedAt', '')[:10]),
                    f'{sid}: a retrieved copy needs its SHA-256 and retrieval date')

    cited = set()
    link_ids = set()
    for hid, entry in table['holders'].items():
        require(HOLDER_ID.match(hid), f'{hid}: holder key must be a SIREN or provisional U… identifier')
        require(hid in recorded, f'{hid}: stale entry, no longer a recorded holder in any cru')
        require(set(entry) <= {'identity', 'links', 'searches', 'effort'}, f'{hid}: unknown entry field')
        identity = entry.get('identity')
        if identity:
            require(hid.startswith('U'), f'{hid}: only a provisional identifier takes an identity crosswalk')
            siren = identity['companySiren']
            require(len(siren) == 9 and siren.isdigit() and siren not in table['holders'], f'{hid}: invalid identity crosswalk')
            require(identity['sourceIds'] and set(identity['sourceIds']) <= sources.keys(), f'{hid}: unknown crosswalk source')
            require(identity.get('limitation'), f'{hid}: identity crosswalk needs its limitation')
            cited.update(identity['sourceIds'])
        searches = entry.get('searches', [])
        for search in searches:
            require(DATE.match(search['at']) and search['where'] and search['outcome'] in SEARCH_OUTCOMES,
                    f'{hid}: a search records its date, where and outcome')
            require(set(search) <= {'at', 'where', 'outcome', 'note'}, f'{hid}: unknown search field')
            require(not FARMING_CLAIM.search(search.get('note', '')), f'{hid}: search notes must not claim farming')
        if effort := entry.get('effort'):
            require(set(effort) <= {'filingsScreened', 'pagesRead', 'note'} and
                    all(isinstance(effort.get(k, 0), int) and effort.get(k, 0) >= 0 for k in ('filingsScreened', 'pagesRead')),
                    f'{hid}: effort counts filings screened and pages read')
        links = entry.get('links', [])
        require(links or any(s['outcome'] == 'no-link-found' for s in searches),
                f'{hid}: an entry without links records the search that found none')
        active = [link for link in links if link['reviewStatus'] in ACTIVE_LINK_STATUSES]
        require(not (hid.startswith('U') and active and not identity),
                f'{hid}: a provisional identifier needs an identity crosswalk before it is linked')
        for link in links:
            lid = link['id']
            require(lid.startswith(hid + '/') and lid not in link_ids, f'{lid}: link IDs are unique and start with the holder')
            link_ids.add(lid)
            require(set(link) <= {'id', 'domaine', 'relation', 'leaseStatus', 'crus', 'basis', 'sourceIds', 'reviewStatus',
                                  'reviewedAt', 'retiredReason'}, f'{lid}: unknown link field')
            require(link['relation'] in RELATIONS, f'{lid}: unknown relation {link["relation"]}')
            require(link['reviewStatus'] in STATUSES and DATE.match(link['reviewedAt']), f'{lid}: unknown review status or date')
            require((link['reviewStatus'] == 'retired') == bool(link.get('retiredReason')), f'{lid}: a retired link, and only one, needs its reason')
            require(link['domaine'] and link['basis'], f'{lid}: a link needs its domaine and basis')
            for text in (link['domaine'], link['basis']):
                require(not FARMING_CLAIM.search(text), f'{lid}: link wording must not claim farming')
            require(link['sourceIds'] and set(link['sourceIds']) <= sources.keys(), f'{lid}: every link needs known sources')
            cited.update(link['sourceIds'])
            types = {sources[s]['type'] for s in link['sourceIds']}
            if 'crus' in link:
                require(link['crus'] and link['crus'] == sorted(set(link['crus'])) and set(link['crus']) <= recorded[hid]['crus'],
                        f'{lid}: link scope must list crus where the holder has recorded rights')
            require(link['relation'] not in SCOPED or 'crus' in link, f'{lid}: a lease or reported tenancy is limited to named crus')
            if link['relation'] == 'lessor-per-filing':
                require(link.get('leaseStatus') in LEASE_STATUSES and 'company-filing' in types,
                        f'{lid}: a filing lease link needs its lease status and the filing')
            else:
                require('leaseStatus' not in link, f'{lid}: only a filing lease link has a lease status')
            if link['relation'] in CORPORATE or (link['reviewStatus'] == 'reviewed' and link['relation'] != 'reported-tenancy'):
                require(types & IDENTITY_SOURCE_TYPES or link['relation'] == 'brand-identity' and 'estate' in types,
                        f'{lid}: a corporate or reviewed link needs a company record, filing or legal notice')
    referenced = {s for _, c in cru_curations.values() for s in strings(c)} & sources.keys()
    unused = sorted(sources.keys() - cited - referenced)
    require(not unused, f'Stale shared sources, cited by no link, crosswalk or curation: {", ".join(unused)}')


def render(table, recorded, parcels_with_rights, cru_curations):
    entries = table['holders']
    links = [link for entry in entries.values() for link in entry.get('links', [])]
    status = Counter(link['reviewStatus'] for link in links)
    searched_none = sum(1 for e in entries.values() if not any(l['reviewStatus'] in ACTIVE_LINK_STATUSES for l in e.get('links', []))
                        and any(s['outcome'] == 'no-link-found' for s in e.get('searches', [])))
    order = sorted(recorded, key=lambda h: (-len(recorded[h]['parcels']), h))
    top50 = len(set().union(*(recorded[h]['parcels'] for h in order[:50])))
    linked = {h for h, e in entries.items() if any(l['reviewStatus'] in ACTIVE_LINK_STATUSES for l in e.get('links', []))}
    reached = len(set().union(*(recorded[h]['parcels'] for h in linked if h in recorded)))
    lines = [
        '# Shared holder-to-domaine links', '',
        'Holder research is done once per legal holder, not once per cru. Each link connects a recorded legal holder '
        '(SIREN or provisional DGFiP identifier) to a domaine or producer through a stated company relation and its sources. '
        'It is shown as **Research link · farming unverified**: a relation between companies never establishes who farms a '
        'parcel. Legal holder, applicant, operator and bottler stay distinct.', '',
        f"Generated by `python scripts/build_grand_cru_holder_links.py`; use `--check` to verify. "
        f"Edit [the table]({HOLDER_LINKS.name}), not this report. "
        'Method: [Grand Cru parcel rollout, shared holder research](../../grand-cru-parcel-rollout.md#shared-holder-research).', '',
        '## Coverage', '',
        f"{len(recorded)} recorded holders across {len(cru_curations)} crus; {sum(len(v['crus']) > 1 for v in recorded.values())} "
        f"hold rights in more than one cru. {len(parcels_with_rights):,} distinct parcels have recorded rights; the 50 holders "
        f"with the most parcels hold rights on {top50:,} of them ({top50 / len(parcels_with_rights):.0%}).", '',
        f"The table has {len(entries)} holders: {status['reviewed']} reviewed, {status['provisional']} provisional and "
        f"{status['retired']} retired links; {searched_none} holders were searched without finding a link. Holders with an "
        f"active link hold rights on {reached:,} distinct parcels ({reached / len(parcels_with_rights):.0%}), before any cru "
        'scope is applied.', '',
        'A cru uses the table once its curation sets `"holderLinks": "shared"`, normally in its Tier 2 PR. '
        '"Reached" counts parcels where at least one recorded holder has a link applying to that cru, whether or not the cru uses '
        'the table yet; a link alone is not a lead to a farmer.', '',
        '| Cru | Uses table | Recorded holders | Holders with an applicable link | Parcels with rights | Parcels reached |',
        '| --- | --- | ---: | ---: | ---: | ---: |']
    for slug, (cru, curation) in cru_curations.items():
        rows = [p for p in read_json(research_path(cru, 'register.json'))['parcels'] if p['recordedRights']]
        holder_ids = {r['holderId'] for p in rows for r in p['recordedRights']}
        linked = {h for h in holder_ids if active_holder_links(entries.get(h), slug)}
        reached = sum(1 for p in rows if {r['holderId'] for r in p['recordedRights']} & linked)
        lines.append(f"| {cru['name']} | {'yes' if curation.get('holderLinks') == 'shared' else 'no'} | {len(holder_ids)} | "
                     f"{len(linked)} | {len(rows)} | {reached} |")
    lines += ['', '## Holders by parcels held', '',
              'Research queue, most parcels first. Relation, review status and scope are per link; an unscoped link applies in '
              'every cru where the holder has rights. Identity gives the SIREN behind a provisional identifier.', '',
              '| Holder | Recorded name | Crus | Parcels | Links | Identity | Effort | Last review |',
              '| --- | --- | ---: | ---: | --- | --- | --- | --- |']
    for hid in order:
        entry = entries.get(hid, {})
        described = []
        for link in entry.get('links', []):
            scope = f"; {', '.join(link['crus'])}" if 'crus' in link else ''
            lease = f", {link['leaseStatus']}" if 'leaseStatus' in link else ''
            described.append(f"{link['domaine']} ({link['relation']}{lease}; {link['reviewStatus']}{scope})")
        if not described and entry:
            described = ['No link found']
        effort = entry.get('effort')
        effort_text = (f"{effort.get('filingsScreened', 0)} filings, {effort.get('pagesRead', 0)} pages" if effort else '—')
        dates = [l['reviewedAt'] for l in entry.get('links', [])] + [s['at'] for s in entry.get('searches', [])]
        identity = entry.get('identity', {}).get('companySiren', '—')
        names = ' / '.join(sorted(recorded[hid]['names'])).replace('|', '\\|')
        lines.append(f"| {hid} | {names} | {len(recorded[hid]['crus'])} | {len(recorded[hid]['parcels'])} | "
                     f"{'; '.join(described).replace('|', chr(92) + '|') or '—'} | {identity} | {effort_text} | {max(dates) if dates else '—'} |")
    lines += ['', '## Link evidence', '',
              'Each link with its basis and sources. Retired links stay listed with their reason and are never shown in the app.', '']
    for hid in sorted(entries, key=lambda h: (-len(recorded[h]['parcels']), h)):
        entry = entries[hid]
        if identity := entry.get('identity'):
            lines.append(f"- **{hid} → SIREN {identity['companySiren']}** (identity crosswalk). {identity['limitation']} "
                         f"Sources: {', '.join(identity['sourceIds'])}.")
        for link in entry.get('links', []):
            scope = f" Limited to {', '.join(link['crus'])}." if 'crus' in link else ''
            lease = f" Lease: {link['leaseStatus']}." if 'leaseStatus' in link else ''
            retired = f" Retired: {link['retiredReason']}" if link['reviewStatus'] == 'retired' else ''
            lines.append(f"- **{link['id']}** — {link['domaine']}; {link['relation']} ({RELATIONS[link['relation']]}); "
                         f"{link['reviewStatus']} {link['reviewedAt']}.{scope}{lease} {link['basis']}{retired} "
                         f"Sources: {', '.join(link['sourceIds'])}.")
        for search in entry.get('searches', []):
            if search['outcome'] == 'no-link-found':
                note = f" {search['note']}" if search.get('note') else ''
                lines.append(f"- **{hid}** — searched {search['at']} in {', '.join(search['where'])}; no link found.{note}")
    lines += ['', '## Sources', '']
    for s in table['sources']:
        dates = f"document date {s['documentDate'] or 'not established'}; reviewed {s['reviewedAt']}"
        lines.append(f"- **{s['id']}** — [{s['title']}]({s['url']}). {s['type']}; {dates}. {s['finding']}")
    return '\n'.join(lines) + '\n'


def generate(check=False, table=None):
    table = read_json(HOLDER_LINKS) if table is None else table
    recorded, parcels_with_rights = recorded_holders()
    found = curations()
    validate(table, recorded, found)
    write_or_check(REPORT, render(table, recorded, parcels_with_rights, found), check)
    print(f'{relative(REPORT)}: {len(table["holders"])} holders linked or searched, {len(table["sources"])} sources')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--check', action='store_true')
    generate(parser.parse_args().check)
