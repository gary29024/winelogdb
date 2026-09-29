"""App-facing evidence file for the Échezeaux parcel panel.

Turns the research register into one short, dated list of records per parcel
(official notices, published research, ownership changes and weak leads) so the
app can show "History and evidence" without reading the large research files.
Every record is dated evidence; none states who farms a parcel today.
"""
import re

SCHEMA_VERSION = 1
NOTE_LIMIT = 330
KIND_ORDER = ['authorisation', 'suspended', 'application', 'research', 'ownership', 'sale', 'lineage', 'lead']
EVENT_KINDS = {'authorisation': 'authorisation', 'suspended-application': 'suspended', 'historical-application': 'application'}
RESEARCH_LABELS = {
    'critic-named-cadastral-reference': 'Named by parcel number',
    'critic-attribution-area-reconstructed': 'Matched by area only',
    'critic-holding-description': 'Holding described, parcel not named',
    'estate-area-exact-match': 'Matched by exact area',
    'court-named-cadastral-reference': 'Named in a court ruling',
}
LEAD_LABELS = {
    'brand-identity-confirmed': 'Brand identity confirmed',
    'estate-context': 'Estate context',
    'secondary-estate-context': 'Estate context (secondary source)',
    'management-and-estate-context': 'Management and estate context',
    'management-and-reported-estate-context': 'Management and reported estate context',
    'management-only-lead': 'Management link only',
    'bottler-only-lead': 'Bottler only',
    'identity-only': 'Identity only',
    'weak-identity-lead': 'Similar name only',
    'reported-operator-relationship': 'Reported relationship',
    'succession-lead': 'Succession lead',
    'partial-succession-lead': 'Partial succession lead',
    'registered-office-match': 'Same registered office',
}
OWNERSHIP_KINDS = {'record-appeared', 'holder-changed'}
SALE_TITLES = {'sale': 'Sold', 'exchange': 'Exchanged', 'auction': 'Sold at auction', 'other': 'Transferred'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def year(date):
    return date[:4]


def title_case_owner(name):
    """DGFiP names are upper case; keep legal-form acronyms."""
    forms = {'GFA', 'GFV', 'SA', 'SAS', 'SARL', 'SCEA', 'SCEV', 'SCI', 'EARL', 'GAEC', 'SCA', 'BND', 'HOR'}
    small = {'de', 'du', 'des', 'la', 'le', 'les', 'et', 'en', 'aux'}
    words = re.split(r'(\s+|-)', name.lower())
    out = []
    for i, word in enumerate(words):
        if not word.strip() or word == '-':
            out.append(word)
        elif word.upper() in forms:
            out.append(word.upper())
        elif i > 0 and word in small:
            out.append(word)
        else:
            out.append(re.sub(r"^(d'|l')?(.)", lambda m: (m.group(1) or '') + m.group(2).upper(), word))
    return ''.join(out)


def short_reference(parcel_id):
    return f"D{parcel_id[-4:]}"


SOURCE_KINDS = {
    'critic-research': 'research', 'registry-dataset': 'data', 'geometry': 'data', 'court-decision': 'official',
    'registry': 'company', 'registry-aggregator': 'company', 'company-filing': 'company', 'legal-notice-republisher': 'company',
    'estate': 'estate', 'estate-hosted-press': 'estate', 'estate-visit-report': 'estate',
}


def source_entry(source):
    kind = 'official' if source['type'].startswith('government') else SOURCE_KINDS.get(source['type'], 'other')
    return {'title': source['title'], 'url': source['url'], 'kind': kind, 'date': source.get('documentDate')}


def event_item(event, via=None):
    kind = EVENT_KINDS[event['kind']]
    item = {'kind': kind, 'date': event['documentDate'], 'title': event['applicant'], 'note': event['appNote'],
            'sources': [event['sourceId']]}
    previous = event.get('previousOperator')
    if previous and previous != 'Not stated':
        item['detail'] = f'Previously farmed by {previous}'
    if via:
        item['via'] = short_reference(via)
    return item


def research_item(entry, source_dates, via=None):
    # Estate pages are often undated; the item then shows no date rather than a review date.
    item = {'kind': 'research', 'date': min((source_dates[s] for s in entry['sourceIds'] if source_dates.get(s)), default=None),
            'title': entry['title'], 'label': RESEARCH_LABELS[entry['basis']], 'note': entry['appNote'],
            'sources': list(entry['sourceIds'])}
    if via:
        item['via'] = short_reference(via)
    return item


def ownership_items(row):
    items = []
    for change in row['rightsChanges']:
        if change['kind'] not in OWNERSHIP_KINDS:
            continue
        after = ' / '.join(title_case_owner(n) for n in change['after'])
        if change['kind'] == 'holder-changed':
            before = ' / '.join(title_case_owner(n) for n in change['before'])
            title = f'Recorded owner changed to {after}'
            detail = f'Previously {before}'
        else:
            title = f'First company owner on record: {after}'
            detail = f'No company owner was recorded on 1 January {year(change["from"])}'
        items.append({'kind': 'ownership', 'date': year(change['to']), 'title': title, 'detail': detail,
                      'note': 'Company owners only. A change can be a sale, or a transfer into a company.',
                      'sources': ['dgfip-history']})
    if row['predecessorIds']:
        refs = ', '.join(short_reference(p) for p in row['predecessorIds'])
        items.append({'kind': 'lineage', 'date': year(row['cadastreFirstSeen']) if row['cadastreFirstSeen'] > '2019-01-01'
                      else None, 'title': f'Created by dividing {refs}', 'sources': ['cadastre-history'],
                      'note': 'Accepted only when the new parcel first appears in the next cadastre vintage and lies almost entirely inside the old one.'})
    return items


def sale_items(row):
    items = []
    for sale in row['saleRecords']:
        item = {'kind': 'sale', 'date': sale['date'], 'title': SALE_TITLES[sale['nature']], 'sources': ['dvf-sales'],
                'note': 'Public sale record: a date and a deed, with no buyer, seller or price. A buyer need not farm the land.'}
        parts = [short_reference(p) for p in sale['sameDeed']]
        if sale['otherParcels']:
            parts.append(f"{sale['otherParcels']} parcel{'s' if sale['otherParcels'] > 1 else ''} outside the cru")
        if parts:
            # Only a single-disposition sale moves all its parcels together, for one price.
            together = sale['nature'] == 'sale' and sale['dispositions'] == 1
            item['detail'] = ('Sold together with ' if together else 'In the same deed as ') + ', '.join(parts)
        buyers = [c for c in row['candidateLeads'] if c['basis'] == 'same-sale-as-company-buyer' and c['deedId'] == sale['deedId']]
        if buyers:
            names = ' / '.join(title_case_owner(c['name']) for c in buyers)
            item['detail'] += f'. The Échezeaux parcels among them were next recorded to {names}; this parcel has no company record, so its buyer is unknown.'
            item['sources'] = ['dvf-sales', 'dgfip-history']
        items.append(item)
    return items


def lead_items(row, holders):
    items = []
    for lead in row['candidateLeads']:
        if 'holderId' not in lead:
            continue
        holder = holders[lead['holderId']]
        note = holder['finding']
        require(len(note) <= NOTE_LIMIT, f'Holder finding too long for the app: {lead["holderId"]}')
        items.append({'kind': 'lead', 'date': None, 'title': f'Possible domaine: {lead["name"]}',
                      'label': LEAD_LABELS.get(lead['basis'], lead['basis'].replace('-', ' ').capitalize()),
                      'note': note, 'sources': list(lead['sourceIds'])})
    return items


def sort_key(item):
    return KIND_ORDER.index(item['kind']), tuple(-ord(c) for c in (item.get('date') or '')), item['title']


def build_evidence(register, curation, history, features):
    sources = {s['id']: s for s in curation['sources']}
    source_dates = {s['id']: s.get('documentDate') for s in curation['sources']}
    holders = {h['holderId']: h for h in curation['holders']}
    by_id = {r['parcelId']: r for r in register['parcels']}
    features_by_id = {f['id'] for f in features}
    accepted = {r['parcelId']: {s['parcelId'] for s in r['successors'] if s['accepted']} for r in history['retiredParcels']}
    parcels = {}
    used = set()
    for event in curation['exactParcelEvents']:
        require(event.get('appNote') and len(event['appNote']) <= NOTE_LIMIT, f'{event["sourceId"]}: needs a short appNote')
    for entry in curation['externalResearch']:
        if entry['parcelIds'] or entry.get('predecessorReferences'):
            require(entry.get('appNote') and len(entry['appNote']) <= NOTE_LIMIT, f'{entry["id"]}: needs a short appNote')

    def add(parcel_id, item):
        parcels.setdefault(parcel_id, []).append(item)
        used.update(item['sources'])

    for parcel_id, row in by_id.items():
        for event in curation['exactParcelEvents']:
            if parcel_id in event['parcelIds']:
                add(parcel_id, event_item(event))
            for retired, current in event.get('predecessorReferences', {}).items():
                if parcel_id in current:
                    add(parcel_id, event_item(event, via=retired))
        for entry in curation['externalResearch']:
            if not (entry['parcelIds'] or entry.get('predecessorReferences')):
                continue
            if parcel_id in entry['parcelIds']:
                add(parcel_id, research_item(entry, source_dates))
            for retired, current in entry.get('predecessorReferences', {}).items():
                if parcel_id in current:
                    add(parcel_id, research_item(entry, source_dates, via=retired))
        for item in ownership_items(row) + sale_items(row) + lead_items(row, holders):
            add(parcel_id, item)
    for event in curation['exactParcelEvents']:
        for parcel_id in event.get('otherCruParcelIds', []):
            require(parcel_id in features_by_id and parcel_id not in by_id, f'Unknown other-cru parcel: {parcel_id}')
            add(parcel_id, event_item(event))
    for items in parcels.values():
        items.sort(key=sort_key)
        for item in items:
            require(all(s in sources or s in {'dgfip-history', 'cadastre-history'} for s in item['sources']), 'Unknown evidence source')
    return {
        'schemaVersion': SCHEMA_VERSION,
        'note': 'Dated records per parcel. None states who farms a parcel today; each needs a dated confirmation of actual operation.',
        'reviewedAt': curation['reviewedAt'],
        'sources': {s: source_entry(sources[s]) for s in sorted(used)},
        'parcels': {p: parcels[p] for p in sorted(parcels)},
    }
