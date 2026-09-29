"""Build a research register, never an operator overlay, from the pinned pilot.

Run from any directory; --check verifies committed outputs without writing.
Only the standard library is required. No network access or source-asset edits.
"""
import argparse
from build_echezeaux_parcel_evidence import build_evidence
import hashlib
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CURATION = ROOT / 'docs/research/echezeaux-farming-curation.json'
MANIFEST = ROOT / 'src/lib/places/echezeauxParcelManifest.json'
OUTPUT = ROOT / 'docs/research/echezeaux-farming-parcels.json'
REPORT = ROOT / 'docs/echezeaux-farming-parcel-register.md'
HISTORY = ROOT / 'docs/research/echezeaux-rights-history.json'
EVIDENCE = ROOT / 'src/lib/places/echezeauxParcelEvidence.json'
SALES = ROOT / 'docs/research/echezeaux-sale-records.json'
NAMED_AREAS = ROOT / 'docs/research/echezeaux-parcel-named-areas.json'


def require(condition, message):
    if not condition:
        raise ValueError(message)


EVENT_KINDS = {'historical-application': 'Application received', 'authorisation': 'Authorisation decision',
               'suspended-application': 'Application suspended'}
SALE_LABELS = {'sale': 'Sold', 'exchange': 'Exchanged', 'auction': 'Sold at auction', 'other': 'Transferred'}
# A later holder may have received a contribution after the sale; it is not necessarily the buyer.
LATER_HOLDER_CHANGES = {'record-appeared', 'holder-changed', 'unprovable-identifier-change'}
EXTERNAL_BASES = {'critic-named-cadastral-reference', 'critic-attribution-area-reconstructed', 'critic-holding-description',
                  'estate-area-exact-match', 'estate-area-near-match', 'court-named-cadastral-reference'}
HOLDING_RELATIONS = {'owner', 'farmer', 'metayer', 'unstated'}
HOLDING_PRECISIONS = {'square-metre', 'are', 'hundredth-hectare', 'approximate', 'none'}


def build_register(manifest, asset, curation, history, sales, named_areas):
    # Git autocrlf changes the final newline in a Windows checkout. Match the
    # canonical LF bytes hashed by build_echezeaux_parcels.py, without reserialising.
    asset = asset.replace(b'\r\n', b'\n')
    require(hashlib.sha256(asset).hexdigest() == manifest['sha256'], 'Parcel snapshot hash changed')
    parent = curation['parentFeatureId']
    require(parent in manifest['parentFeatureIds'], 'Research cru absent from snapshot')
    parcels = sorted((f['properties'] for f in json.loads(asset)['features']
                      if any(o['parentFeatureId'] == parent for o in f['properties']['overlaps'])),
                     key=lambda p: p['id'])
    ids = {p['id'] for p in parcels}
    require(len(ids) == len(parcels), 'Duplicate cadastral ID')
    sources = {s['id']: s for s in curation['sources']}
    require(len(sources) == len(curation['sources']), 'Duplicate source ID')
    holders = {h['holderId']: h for h in curation['holders']}
    require(len(holders) == len(curation['holders']), 'Duplicate holder ID')
    actual_holders = {r['holderId'] for p in parcels for r in p['recordedRights']}
    require(actual_holders == set(holders), 'Curation must cover every and only recorded holder')
    for h in holders.values():
        require(h['parcelOperationConfirmed'] is False, 'Lead register cannot publish confirmed operation')
        require(set(h['sourceIds']) <= sources.keys(), 'Unknown holder source')
        require(not h['candidateNames'] or h['sourceIds'], 'Candidate requires a cited research source')
    require(history['inputs']['parcelSnapshotSha256'] == manifest['sha256'] and history['parentFeatureId'] == parent,
            'Rights history built from another snapshot')
    lineage = {r['parcelId']: r for r in history['parcels']}
    require(set(lineage) == ids, 'Rights history must cover every and only mapped parcel')
    for finding in curation['historyFindings']:
        require(finding['parcelIds'] and set(finding['parcelIds']) <= ids, 'History finding outside research cru')
        require(finding['sourceIds'] and set(finding['sourceIds']) <= sources.keys(), 'Unknown history finding source')
        require(finding.get('currentFarmer') is None, 'Rights history cannot establish current farming')
    # Only rule-accepted splits may carry evidence to today's parcels; rejected spatial candidates never do.
    successors = {r['parcelId']: {s['parcelId'] for s in r['successors'] if s['accepted']} for r in history['retiredParcels']}

    def check_lineage(item, kind):
        for retired, current in item.get('predecessorReferences', {}).items():
            require(retired in successors and set(current) <= successors[retired] & ids,
                    f'{kind} predecessor reference without matching cadastral lineage')
    for event in curation['exactParcelEvents']:
        require(set(event['parcelIds']) <= ids, 'Event reference outside research cru')
        require(event['sourceId'] in sources, 'Unknown event source')
        require(event['kind'] in EVENT_KINDS, f"Unknown event kind: {event['kind']}")
        require(event['currentFarmer'] is None, 'Historical event cannot establish current farming')
        # A retired reference named in a notice reaches today's parcels only through recorded lineage.
        check_lineage(event, 'Event')
    for item in curation['externalResearch']:
        require(set(item['parcelIds']) <= ids, 'External research outside research cru')
        require(item['sourceIds'] and set(item['sourceIds']) <= sources.keys(), 'Unknown external research source')
        require(item['basis'] in EXTERNAL_BASES, f"Unknown external research basis: {item['basis']}")
        require(item.get('currentFarmer') is None, 'External research cannot establish current farming')
        require(item.get('dateSourceId') in item['sourceIds'], 'Research needs an explicit date source')
        check_lineage(item, 'External research')
    filings = curation['parcelFilings']
    require(len({f['id'] for f in filings}) == len(filings), 'Duplicate filing ID')
    by_id = {p['id']: p for p in parcels}
    for filing in filings:
        refs = set(filing['parcelAreasM2'])
        require(refs and refs <= ids, 'Filing outside research cru')
        require(filing['sourceId'] in sources, 'Unknown filing source')
        require(filing['documentDate'] == sources[filing['sourceId']]['documentDate'], 'Filing date must be the deed date')
        require(filing.get('currentFarmer') is None, 'Filing cannot establish current farming')
        for pid, area in filing['parcelAreasM2'].items():
            require(area == by_id[pid]['cadastreAreaM2'], 'Filing cadastral area differs from snapshot')
            require(filing['holderId'] in {r['holderId'] for r in by_id[pid]['recordedRights']}, 'Filing holder differs from snapshot')
        for lease in filing['leaseEvidence']:
            require(set(lease.get('parcelAreasM2', {})) <= refs, 'Lease outside contributed parcels')
            for pid, area in lease.get('parcelAreasM2', {}).items():
                require(0 < area <= filing['parcelAreasM2'][pid], 'Lease area exceeds contributed parcel')
    require(sales['inputs']['parcelSnapshotSha256'] == manifest['sha256'] and sales['parentFeatureId'] == parent,
            'Sale records built from another snapshot')
    require('dvf-sales' in sources and 'dgfip-history' in sources, 'Sale records need the dvf-sales and dgfip-history sources')
    deeds_by_parcel = {}
    for deed in sales['deeds']:
        require(set(deed['parcelIds']) <= ids, 'Sale record outside research cru')
        for pid in deed['parcelIds']:
            deeds_by_parcel.setdefault(pid, []).append(deed)

    def sale_rows_and_leads(pid, has_rights):
        records, leads = [], []
        for deed in deeds_by_parcel.get(pid, []):
            together = [x for x in deed['parcelIds'] if x != pid]
            records.append({'deedId': deed['deedId'], 'date': deed['date'], 'nature': deed['nature'],
                            'dispositions': deed['dispositions'], 'sameDeed': together, 'otherParcels': deed['otherParcels']})
            if has_rights or deed['nature'] != 'sale' or deed['dispositions'] != 1:
                continue
            # Co-sale plus a later company record is a lead to investigate the sequence of transfers.
            # Neither DVF nor an annual snapshot names the buyer at the time of the deed.
            later_holders = {}
            for other in together:
                for change in lineage[other]['rightsChanges']:
                    if change['kind'] in LATER_HOLDER_CHANGES and change['from'] <= deed['date'] < change['to']:
                        for name in change['after']:
                            later_holders.setdefault(name, []).append(other)
            leads += [{'name': name, 'basis': 'co-sale-with-later-company-holder', 'sourceIds': ['dvf-sales', 'dgfip-history'],
                       'deedId': deed['deedId'], 'viaParcelIds': sorted(set(refs))} for name, refs in sorted(later_holders.items())]
        return records, leads

    require(named_areas['inputs']['parcelSnapshotSha256'] == manifest['sha256'] and set(named_areas['parcels']) == ids,
            'Named areas must cover every and only mapped parcel of this snapshot')
    area_names = {a['sourceName'] for a in named_areas['parcels'].values()}
    holder_names = {r['holderId']: r['name'] for p in parcels for r in p['recordedRights']}
    for h in curation['producerHoldings']:
        require(h['namedAreas'] and set(h['namedAreas']) <= area_names, f"{h['id']}: unknown named area")
        require(set(h['sourceIds']) <= sources.keys() and h['sourceIds'], f"{h['id']}: unknown holding source")
        require(set(h['producerHolderIds'] + h['ownerHolderIds']) <= holders.keys(), f"{h['id']}: unknown holder")
        require(h['relation'] in HOLDING_RELATIONS and h['precision'] in HOLDING_PRECISIONS, f"{h['id']}: unknown relation or precision")
        require(h.get('locationStatus', 'stated') in {'stated', 'disputed'}, f"{h['id']}: unknown location status")
        # A holding describes a named area, never parcels: exact matches belong in externalResearch.
        require('parcelIds' not in h and h.get('currentFarmer') is None, f"{h['id']}: a holding cannot name parcels or a farmer")
    for entry in curation['historicalOwnerLists']:
        require(entry['sourceId'] in sources and entry['owners'], 'Historical owner list needs a source and names')
        # Printed climat names are kept as printed; only reviewed cadastral names join the census.
        require(entry['namedArea'] is None or entry['namedArea'] in area_names, f"Unknown named area: {entry['namedArea']}")

    rows = []
    for p in parcels:
        holder_ids = sorted({r['holderId'] for r in p['recordedRights']})
        events = [e for e in curation['exactParcelEvents'] if p['id'] in e['parcelIds']]
        inherited = [(e, retired) for e in curation['exactParcelEvents']
                     for retired, current in e.get('predecessorReferences', {}).items() if p['id'] in current]
        external = [x for x in curation['externalResearch'] if p['id'] in x['parcelIds']]
        external_inherited = [(x, retired) for x in curation['externalResearch']
                              for retired, current in x.get('predecessorReferences', {}).items() if p['id'] in current]
        parcel_filings = [f for f in filings if p['id'] in f['parcelAreasM2']]
        leads = [{'name': name, 'holderId': hid, 'basis': holders[hid]['basis'],
                  'sourceIds': holders[hid]['sourceIds']}
                 for hid in holder_ids for name in holders[hid]['candidateNames']]
        event_leads = [{'name': e['applicant'], 'basis': e['kind'], 'sourceIds': [e['sourceId']]} for e in events]
        event_leads += [{'name': e['applicant'], 'basis': f"{e['kind']} on predecessor {r[8:10].lstrip('0')}{r[10:]}",
                         'sourceIds': [e['sourceId']]} for e, r in inherited]
        external_leads = [{'name': x['producer'], 'basis': x['basis'], 'sourceIds': x['sourceIds']}
                          for x in external if x.get('producer')]
        external_leads += [{'name': x['producer'], 'basis': f"{x['basis']} on predecessor {r[8:10].lstrip('0')}{r[10:]}",
                            'sourceIds': x['sourceIds']} for x, r in external_inherited if x.get('producer')]
        sale_records, sale_leads = sale_rows_and_leads(p['id'], bool(p['recordedRights']))
        rows.append({
            'parcelId': p['id'], 'reference': p['reference'], 'commune': p['commune'],
            'namedArea': named_areas['parcels'][p['id']]['sourceName'],
            'cruOverlapM2': next(o['areaM2'] for o in p['overlaps'] if o['parentFeatureId'] == parent),
            'recordedRights': p['recordedRights'], 'recordMatch': p['recordMatch'],
            'holderResearchIds': holder_ids, 'candidateLeads': leads + event_leads + external_leads + sale_leads,
            'historicalEvents': events + [{**e, 'viaPredecessor': r} for e, r in inherited],
            'externalResearchIds': [x['id'] for x in external] + [x['id'] for x, _ in external_inherited],
            'parcelFilingIds': [f['id'] for f in parcel_filings],
            # Dated legal-entity rights since 2019 and cadastral splits: context for who to ask, not farming.
            'rightsChanges': [{k: c[k] for k in ('from', 'to', 'kind', 'before', 'after')}
                              for c in lineage[p['id']]['rightsChanges']],
            # Dated transfers by deed, without parties or prices: when a parcel changed hands, not who farms it.
            'saleRecords': sale_records,
            'cadastreFirstSeen': lineage[p['id']]['firstSeenCadastre'],
            'predecessorIds': lineage[p['id']]['predecessorIds'],
            'historyFindingIds': [f['id'] for f in curation['historyFindings'] if p['id'] in f['parcelIds']],
            'researchStatus': ('historical-authorisation' if any(e['kind'] == 'authorisation' for e in events) else
                               'historical-application' if events or inherited else
                               'holder-lead' if leads or external_leads else
                               'sale-lead' if sale_leads else 'unresolved'),
            'researchDepth': ('parcel-filing-reviewed' if parcel_filings else
                              'exact-reference-event-reviewed' if events or inherited else
                              'external-research-reviewed' if external or external_inherited else
                              'holder-group-triage' if holder_ids else
                              'sale-record-reviewed' if sale_records else 'inventory-only'),
            'currentFarmer': None, 'verifiedAsOf': None, 'operationScope': 'unconfirmed',
            'nextEvidenceNeeded': ('Confirm actual operation, scope and continuation since the decision.'
                                   if any(e['kind'] == 'authorisation' for e in events) else
                                   'Check the decision after the suspension ends, and who farms meanwhile.'
                                   if any(e['kind'] == 'suspended-application' for e in events) else
                                   'Resolve application outcome, actual operation and cadastral continuity.'
                                   if events or inherited else 'Obtain dated parcel-specific operation evidence and scope.'
                                   if leads else 'Trace the co-sale and subsequent transfers; the later company holder is not necessarily the buyer. Obtain parcel-specific operation evidence.'
                                   if sale_leads else 'Identify operator through a shareable parcel-specific record; do not infer from neighbours.'),
        })
    statuses = Counter(r['researchStatus'] for r in rows)
    census = build_census(rows, curation['producerHoldings'], named_areas, holder_names)
    return {
        'schemaVersion': 1, 'reviewedAt': curation['reviewedAt'], 'targetSeason': curation['targetSeason'],
        'status': curation['status'], 'scope': curation['scope'], 'parentFeatureId': parent,
        'inputs': {'curation': 'docs/research/echezeaux-farming-curation.json',
                   'dataUrl': manifest['dataUrl'], 'sha256': manifest['sha256'],
                   'cadastreDate': manifest['cadastreDate'], 'rightsAsOf': manifest['rightsAsOf'],
                   'rightsHistory': 'docs/research/echezeaux-rights-history.json',
                   'rightsHistoryYears': [r['asOf'] for r in history['inputs']['rights']],
                   'saleRecords': 'docs/research/echezeaux-sale-records.json', 'saleRecordsCoverage': sales['coverage']},
        'counts': {'parcels': len(rows), 'recordedHolders': len(holders),
                   'withRecordedRights': sum(bool(r['recordedRights']) for r in rows),
                   'withoutMatchedRights': sum(not r['recordedRights'] for r in rows),
                   'holderLead': statuses['holder-lead'], 'historicalApplication': statuses['historical-application'],
                   'historicalAuthorisation': statuses['historical-authorisation'],
                   'saleLead': statuses['sale-lead'], 'unresolved': statuses['unresolved'], 'currentFarmerConfirmed': 0,
                   'withSaleRecord': sum(bool(r['saleRecords']) for r in rows),
                   'withParcelFiling': sum(bool(r['parcelFilingIds']) for r in rows),
                   'withRightsChangeSince2019': sum(bool(r['rightsChanges']) for r in rows),
                   'withCadastralPredecessor': sum(bool(r['predecessorIds']) for r in rows)},
        'namedAreaCensus': census,
        'parcels': rows,
    }


def build_census(rows, holdings, named_areas, holder_names):
    """Per named area: land without a company record, and published holdings that could account for it.

    A holding is published by a producer for a whole named area. The census only compares areas;
    it never places a holding on particular parcels."""
    reviewed = {a['sourceName']: a['name'] for a in named_areas['parcels'].values()}
    census = []
    for name in sorted({r['namedArea'] for r in rows}):
        here = [r for r in rows if r['namedArea'] == name]
        m2 = lambda items: round(sum(r['cruOverlapM2'] for r in items))
        entries, beyond_total = [], 0
        for h in holdings:
            if name not in h['namedAreas']:
                continue
            recorded = m2([r for r in here if {x['holderId'] for x in r['recordedRights']} & set(h['producerHolderIds'])])
            beyond = None
            # Only a live, single-area, sized holding can be compared with this area's unrecorded land.
            # A métayer farms land already recorded to its owner, so it adds nothing here.
            if (len(h['namedAreas']) == 1 and h['publishedAreaHa'] is not None and not h['endedSeason']
                    and h['relation'] != 'metayer' and h.get('locationStatus') != 'disputed'):
                beyond = max(0, round(h['publishedAreaHa'] * 10000) - recorded)
                beyond_total += beyond
            entries.append({'holdingId': h['id'], 'producer': h['producer'], 'publishedAreaHa': h['publishedAreaHa'],
                            'precision': h['precision'], 'relation': h['relation'], 'endedSeason': h['endedSeason'],
                            'locationStatus': h.get('locationStatus', 'stated'),
                            'sharedWith': [a for a in h['namedAreas'] if a != name] if h.get('locationStatus') != 'disputed' else [],
                            'alternativeLocations': [a for a in h['namedAreas'] if a != name] if h.get('locationStatus') == 'disputed' else [],
                            'recordedToProducerM2': recorded, 'beyondCompanyRecordsM2': beyond,
                            'owners': [holder_names[i] for i in h['ownerHolderIds']]})
        unrecorded = [r for r in here if not r['recordedRights']]
        census.append({
            'sourceName': name, 'name': reviewed[name], 'parcels': len(here), 'areaM2': m2(here),
            'withoutCompanyRecord': len(unrecorded), 'withoutCompanyRecordM2': m2(unrecorded),
            'withoutCompanyRecordOrLead': sum(r['researchStatus'] == 'unresolved' for r in unrecorded),
            'withoutCompanyRecordOrLeadM2': m2([r for r in unrecorded if r['researchStatus'] == 'unresolved']),
            'publishedBeyondCompanyRecordsM2': beyond_total, 'holdings': entries,
        })
    return census


def cell(value):
    return str(value).replace('|', '\\|').replace('\n', ' ')


def render_report(register, curation, history):
    counts = register['counts']
    sources = {s['id']: s for s in curation['sources']}
    lines = [
        '# Échezeaux parcel farming research register', '',
        f"Reviewed {register['reviewedAt']}; target season {register['targetSeason']}.", '',
        '**Current farmer identification remains incomplete: no parcel has confirmed current-operation evidence.**', '',
        register['scope'], '',
        f"Of {counts['parcels']} mapped parcels, {counts['withRecordedRights']} have recorded rights and "
        f"{counts['withoutMatchedRights']} have no matched right holder. All {counts['recordedHolders']} holder groups were triaged. "
        f"{counts['holderLead']} parcels have holder-derived or independent-research leads, {counts['historicalApplication']} have an "
        f"exact-reference application or suspended application, {counts['historicalAuthorisation']} have an authorisation decision, "
        f"{counts['saleLead']} have co-sale leads through a later company holder, and "
        f"{counts['unresolved']} remain without a named candidate. These are mutually exclusive research categories, not farmer counts.", '',
        f"{sum(r['researchDepth'] == 'inventory-only' for r in register['parcels'])} parcels have inventory records only, not individual source investigations. "
        'Historical application references can also lack matched rights.', '',
        f"{counts['withParcelFiling']} parcels have reviewed company filings naming their contributions and dated lease relationships. "
        'These do not confirm operation in the target season.', '',
        'Candidate names below are hypotheses. Their basis ranges from estate context to a weak company-name or bottler connection. '
        'No confidence percentage is assigned; the stated evidence must be checked before accepting any relationship.', '',
        f"Geometry: {register['inputs']['cadastreDate']}. Rights: {register['inputs']['rightsAsOf']}. "
        'Areas measure the intersection with the cru, not ownership shares or planted hectares. A mapped intersection may include a sliver or land whose farming applicability remains unknown.', '',
        'Generated by `python scripts/build_echezeaux_farming_research.py`; use `--check` to verify. '
        'Edit [curation](research/echezeaux-farming-curation.json), not this report. '
        '[Machine-readable parcel register](research/echezeaux-farming-parcels.json) · '
        '[Evidence method and app behaviour](echezeaux-farming-research.md).', '',
        '## Holder investigations', '',
    ]
    for h in curation['holders']:
        rows = [r for r in register['parcels'] if h['holderId'] in r['holderResearchIds']]
        names = sorted({right['name'] for r in rows for right in r['recordedRights'] if right['holderId'] == h['holderId']})
        lines += [f"### {h['holderId']} — {' / '.join(names)}", '',
                  f"Parcels ({len(rows)}): " + ', '.join(r['reference'] for r in rows) + '.', '',
                  '**Candidate to investigate:** ' + (', '.join(h['candidateNames']) or 'Unresolved') + '. '
                  f"**Basis:** {h['basis']}. **Current farming:** unconfirmed.", '', h['finding'], '',
                  'Sources: ' + (', '.join(f"[{cell(sources[s]['title'])}]({sources[s]['url']})" for s in h['sourceIds'])
                                 or 'No usable independent source located; recorded rights only.') + '.', '']
    lines += render_census(register, curation, sources)
    lines += ['## Every mapped parcel', '',
              'All references are in commune 21267 (Flagey-Échezeaux). Full IDs and evidence links are in the JSON register. '
              '“Holder” points to the investigations above. “None” means no matched record, not no farmer.', '',
              '| Reference | Named area | Cru overlap (m²) | Holder research ID | Candidate to investigate — never verified | Current farmer |',
              '| --- | --- | ---: | --- | --- | --- |']
    for r in register['parcels']:
        # Explicit anchors below avoid renderer-specific slug rules for accented holder names.
        holders = ', '.join(f"[{h}](#holder-{h.lower()})" for h in r['holderResearchIds']) or 'None'
        leads = '; '.join(f"{c['name']} ({c['basis']})" for c in r['candidateLeads']) or 'Unresolved'
        lines.append(f"| {cell(r['reference'])} | {area_label(r['namedArea'], register)} | {r['cruOverlapM2']:.2f} | {holders} | {cell(leads)} | Unconfirmed |")
    rows_by_id = {r['parcelId']: r for r in register['parcels']}
    ref = lambda pid: rows_by_id[pid]['reference'] if pid in rows_by_id else f"{pid[8:10].lstrip('0')} {pid[10:]}"
    lines += ['', '## Exact-reference administrative events', '',
              'Farm-structure notices published by the Côte-d\'Or DDT name the applicant, the previous operator and the '
              'cadastral references. A receipt of a complete application explicitly does not authorise cultivation; an '
              'authorisation is a dated decision, not proof of actual or current operation. References were read from the '
              'page image. Grands-Échezeaux references (such as D0093) are outside this register.', '']
    for e in sorted(curation['exactParcelEvents'], key=lambda e: e['documentDate']):
        refs = ', '.join(ref(i) for i in e['parcelIds'])
        via = '; '.join(f"{ref(r)} (retired) → {', '.join(ref(c) for c in cs)}"
                        for r, cs in e.get('predecessorReferences', {}).items())
        label = EVENT_KINDS[e['kind']]
        lines.append(f"- **{e['documentDate']} — {cell(e['applicant'])}.** {label}; previous operator "
                     f"{cell(e['previousOperator'])}. Parcels: {refs}" + (f"; via lineage: {via}" if via else '') +
                     f". {e['summary']} [{cell(sources[e['sourceId']]['title'])}]({sources[e['sourceId']]['url']}).")
    lines += ['', '## Parcel-specific company filings', '',
              'Deed dates are separate from filing labels. Existing lease recitals, concurrent lease references and mandates '
              'are kept distinct; none proves current-season farming. See [the detailed reading and next source requests]'
              '(echezeaux-statutes-research.md).', '']
    for filing in curation['parcelFilings']:
        source = sources[filing['sourceId']]
        refs = ', '.join(f'{ref(pid)} ({area} m²)' for pid, area in filing['parcelAreasM2'].items())
        lines += [f"- **{filing['documentDate']} - {filing['title']}**. {refs}. {filing['finding']} "
                  f"[{cell(source['title'])}]({source['url']})."]
    lines += ['', '## Independent research', '',
              'Published vineyard research can name cadastral references or describe holdings. It is dated secondary '
              'evidence of ownership or production, cross-checked here against the recorded rights; it never establishes '
              'current farming. Area reconstructions are inferences; exact and near-area matches are distinguished. '
              'The source itself does not name those parcels. Dates follow an explicitly selected research source, '
              'not another supporting registry record.', '']
    for x in curation['externalResearch']:
        via = '; '.join(f"{ref(r)} (retired) → {', '.join(ref(c) for c in cs)}" for r, cs in x.get('predecessorReferences', {}).items())
        refs = ', '.join(ref(i) for i in x['parcelIds']) + (('; via lineage: ' if x['parcelIds'] else 'via lineage: ') + via if via else '')
        refs = refs or 'no cadastral reference'
        cited = ', '.join(f"[{cell(sources[s]['title'])}]({sources[s]['url']})" for s in x['sourceIds'])
        lines.append(f"- **{cell(x['title'])}** ({refs}; {x['basis']}). {x['finding']} Sources: {cited}.")
    lines.append('')
    lines += render_history(register, curation, history, sources)
    lines += render_sales(register, sources)
    lines += ['## Source log', '',
              'Publication/document dates and vintage seasons are separate fields in the curation. An undated page, '
              'recent upload or review date does not establish operation in the target season.', '']
    for s in curation['sources']:
        season = f"; evidence season {s['evidenceSeason']}" if s.get('evidenceSeason') else ''
        lines += [f"- **{s['id']}** — [{cell(s['title'])}]({s['url']}). "
                  f"{s['type']}; {s['access']}; document date {s['documentDate'] or 'not established'}{season}. {s['finding']}"]
    lines += ['', '## Remaining evidence and access gaps', ''] + ['- ' + gap for gap in curation['accessGaps']]
    lines += ['', 'For each proposed farmer, request a dated, shareable confirmation naming the exact cadastral IDs, '
              'whole/partial scope, season and operating entity; check any cadastral splits or merges. '
              'An appropriately shared CVI extract or parcel-specific lease plus evidence of actual operation may resolve the join. '
              'Do not publish private records without permission. No outreach has been sent.', '']
    for index, line in enumerate(lines):
        if line.startswith('### '):
            hid = line.split(' ')[1]
            lines[index] = f'<a id="holder-{hid.lower()}"></a>\n\n' + line
    return '\n'.join(lines)


CHANGE_LABELS = {
    'record-appeared': 'First company record on an existing parcel',
    'new-parcel-reference': 'Record on a newly created parcel reference',
    'record-disappeared': 'Company record ended',
    'same-holder-renamed': 'Same SIREN, new name',
    'right-type-changed': 'Same holder, different right',
    'unprovable-identifier-change': 'Identifier changed; earlier record had no SIREN',
    'holder-changed': 'Different SIREN',
}


def render_history(register, curation, history, sources):
    counts, rows = history['counts'], {r['parcelId']: r for r in register['parcels']}
    years = register['inputs']['rightsHistoryYears']
    lines = ['## Rights history and parcel lineage', '',
             f"The legal-entity rights files for 1 January {years[0][:4]}–{years[-1][:4]} were compared with the pinned "
             f"{register['inputs']['rightsAsOf']} snapshot, and Etalab cadastre vintages from {history['inputs']['cadastre'][0]['date']} "
             f"with the {register['inputs']['cadastreDate']} geometry. {counts['withAnyRightsChange']} of {counts['parcels']} parcels had "
             f"a recorded-rights change; {counts['createdSinceFirstVintage']} current references did not exist in the first vintage, and "
             f"{counts['retiredReferences']} retired references overlapped the cru. "
             'Only company-type holders appear: a first record can be a purchase, a transfer from private owners into a family company, '
             'or a new reference after a split. Continuity is proved only by an unchanged SIREN. None of this is farming evidence. '
             '[Full yearly records and lineage](research/echezeaux-rights-history.json), rebuilt by '
             '`python scripts/build_echezeaux_rights_history.py`.', '',
             '**Reviewed findings**', '']
    for f in curation['historyFindings']:
        refs = ', '.join(rows[i]['reference'] for i in f['parcelIds'])
        cited = ', '.join(f"[{cell(sources[s]['title'])}]({sources[s]['url']})" for s in f['sourceIds'])
        lines.append(f"- **{cell(f['title'])}** ({refs}). {f['finding']} Sources: {cited}.")
    grouped = {}
    for r in register['parcels']:
        for c in r['rightsChanges']:
            key = (c['from'], c['to'], c['kind'], ' / '.join(c['before']) or '—', ' / '.join(c['after']) or '—')
            grouped.setdefault(key, []).append(r['reference'])
    lines += ['', '**Every recorded change**', '', '| Parcels | Between | Change | Before | After |', '| --- | --- | --- | --- | --- |']
    for (start, end, kind, before, after), refs in sorted(grouped.items()):
        lines.append(f"| {', '.join(refs)} | {start[:4]} → {end[:4]} | {CHANGE_LABELS[kind]} | {cell(before)} | {cell(after)} |")
    lines += ['', '**Retired references and their current successors**', '',
              'A successor is accepted when it first appears in the vintage right after the retired reference and lies '
              'almost entirely inside it. Other overlaps, such as boundary slivers or parcels that already existed, are '
              'rejected candidates and never carry evidence. The rule is spatial, not a documented division act.', '',
              '| Retired reference | Last vintage | Accepted successors | Rejected spatial candidates | Company records before retirement |',
              '| --- | --- | --- | --- | --- |']
    for p in history['retiredParcels']:
        name = lambda s: rows[s['parcelId']]['reference'] if s['parcelId'] in rows else s['parcelId']
        accepted = ', '.join(name(s) for s in p['successors'] if s['accepted']) or 'None'
        rejected = ', '.join(f"{name(s)} ({s['sharedAreaM2']} m²)" for s in p['successors'] if not s['accepted']) or '—'
        names = sorted({r['name'] for h in p['rightsHistory'] for r in h['records']})
        lines.append(f"| {p['reference']} | {p['lastSeenCadastre']} | {accepted} | {rejected} | {cell(' / '.join(names)) or 'None'} |")
    return lines + ['']


def area_label(source_name, register):
    reviewed = {a['sourceName']: a['name'] for a in register['namedAreaCensus']}
    return reviewed[source_name] or f'{source_name} (cadastral; unreviewed)'


def hectares(m2):
    return f'{m2 / 10000:.2f} ha'


def render_census(register, curation, sources):
    lines = ['## Named-area census', '',
             'Parcels are grouped by the cadastral lieu-dit holding most of their geometry. For each named area the census '
             'compares land without a company record with the Échezeaux holdings producers publish there. "Beyond company '
             'records" is a published area minus the land recorded to company records linked to that producer in the same named area: land the '
             'producer says it owns or farms, which the legal-entity files do not show. It is an area comparison only. It never '
             'places a holding on particular parcels, and a producer\'s published figure can be rounded, out of date or include '
             'leased land. A métayer farms land already recorded to its owner; a holding spread over several named areas cannot '
             'be split, so neither is counted. Disputed locations are listed as alternatives and excluded from numeric '
             'climat totals. `LES POULA` has no reviewed crosswalk to Les Poulaillères.', '',
             '| Named area | Parcels | Without company record | …of which without any lead | Published beyond company records |',
             '| --- | ---: | ---: | ---: | ---: |']
    for a in register['namedAreaCensus']:
        lines.append(f"| {area_label(a['sourceName'], register)} | {a['parcels']} ({hectares(a['areaM2'])}) | "
                     f"{a['withoutCompanyRecord']} ({hectares(a['withoutCompanyRecordM2'])}) | "
                     f"{a['withoutCompanyRecordOrLead']} ({hectares(a['withoutCompanyRecordOrLeadM2'])}) | {hectares(a['publishedBeyondCompanyRecordsM2'])} |")
    lines += ['', '**Published holdings by named area**', '']
    holdings = {h['id']: h for h in curation['producerHoldings']}
    relations = {'owner': 'states ownership', 'farmer': 'states it farms', 'metayer': 'sharecrops (métayage)',
                 'unstated': 'tenure not stated'}
    for a in register['namedAreaCensus']:
        if not a['holdings']:
            continue
        lines.append(f"- **{area_label(a['sourceName'], register)}**")
        for e in a['holdings']:
            size = f"{e['publishedAreaHa']} ha" if e['publishedAreaHa'] is not None else 'area not published'
            notes = [relations[e['relation']]]
            if e['owners']:
                notes.append('owner recorded as ' + ' / '.join(e['owners']))
            if e['endedSeason']:
                notes.append(f"ended with the {e['endedSeason']} harvest")
            if e['sharedWith']:
                notes.append('total also covers ' + ', '.join(area_label(s, register) for s in e['sharedWith']))
            if e['locationStatus'] == 'disputed':
                notes.append('location disputed; excluded from totals; alternative: ' +
                             ', '.join(area_label(s, register) for s in e['alternativeLocations']))
            if e['relation'] != 'metayer':
                notes.append(f"{hectares(e['recordedToProducerM2'])} recorded to linked company records here")
            if e['beyondCompanyRecordsM2'] is not None:
                notes.append(f"{hectares(e['beyondCompanyRecordsM2'])} beyond company records")
            holding = holdings[e['holdingId']]
            cited = ', '.join(f"[{cell(sources[s]['title'])}]({sources[s]['url']})" for s in holding['sourceIds'])
            lines.append(f"  - {cell(e['producer'])}: {size} ({e['precision']}); {'; '.join(notes)}. {holding['finding']} {cited}.")
    lists = curation['historicalOwnerLists']
    years = sorted({(x['year'], x['sourceId']) for x in lists})
    lines += ['', '**Owners named in old guides**', '',
              'Historical context only: family names a century and more ago, not owners or farmers today. Printed climat '
              'names are kept; Les Poulaillères has no reviewed cadastral crosswalk. Sources: ' +
              ', '.join(f"[{cell(sources[s]['title'])}]({sources[s]['url']})" for _, s in years) + '.', '',
              '| Climat (as printed) | ' + ' | '.join(str(y) for y, _ in years) + ' |', '| --- |' + ' --- |' * len(years)]
    keys = sorted({x['namedArea'] or x['printedName'] for x in lists}, key=lambda k: k.lower())
    for key in keys:
        entries = {(x['year'], x['sourceId']): x for x in lists if (x['namedArea'] or x['printedName']) == key}
        label = area_label(key, register) if any(x['namedArea'] for x in entries.values()) else key
        lines.append(f"| {cell(label)} | " + ' | '.join(cell(', '.join(entries[y]['owners'])) if y in entries else '—'
                                                    for y in years) + ' |')
    return lines + ['']


def render_sales(register, sources):
    rows = {r['parcelId']: r for r in register['parcels']}
    deeds = {}
    for r in register['parcels']:
        for s in r['saleRecords']:
            deeds.setdefault((s['date'], s['deedId'], s['nature'], s['dispositions'], s['otherParcels']), set()).add(r['parcelId'])
    source = sources['dvf-sales']
    lines = ['## Sale and exchange deeds', '',
             f"[{cell(source['title'])}]({source['url']}) ({register['inputs']['saleRecordsCoverage']}) list registered transfers "
             'for a fee by deed, without buyer or seller. Prices are not kept. A later annual company record can follow '
             'an intervening contribution or another transfer, so it does not identify the deed buyer. A single-disposition '
             'co-sale with parcels later recorded to a company is only a lead to investigate those transfers. '
             'Exchanges move parcels in both directions and give no lead. Rebuilt by '
             '`python scripts/build_echezeaux_sale_records.py`.', '',
             '| Date | Deed | Échezeaux parcels | Parcels outside the cru | Lead for parcels without a company record |',
             '| --- | --- | --- | ---: | --- |']
    for (date, deed, nature, dispositions, others), pids in sorted(deeds.items()):
        leads = '; '.join(f"{rows[p]['reference']}: {c['name']}" for p in sorted(pids) for c in rows[p]['candidateLeads']
                          if c['basis'] == 'co-sale-with-later-company-holder') or '—'
        label = f"{SALE_LABELS[nature]}, {dispositions} disposition{'s' if dispositions > 1 else ''} ({deed[:10]})"
        lines.append(f"| {date} | {label} | {', '.join(rows[p]['reference'] for p in sorted(pids))} | {others} | {cell(leads)} |")
    return lines + ['']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    curation = json.loads(CURATION.read_text(encoding='utf-8'))
    history = json.loads(HISTORY.read_text(encoding='utf-8'))
    sales = json.loads(SALES.read_text(encoding='utf-8'))
    named_areas = json.loads(NAMED_AREAS.read_text(encoding='utf-8'))
    asset = (ROOT / 'public' / manifest['dataUrl'].lstrip('/')).read_bytes()
    register = build_register(manifest, asset, curation, history, sales, named_areas)
    outputs = {OUTPUT: json.dumps(register, ensure_ascii=False, indent=2) + '\n',
               REPORT: render_report(register, curation, history),
               # Compact per-parcel evidence the app loads on demand; never read by the register itself.
               EVIDENCE: json.dumps(build_evidence(register, curation, history, json.loads(asset)['features']),
                                    ensure_ascii=False, separators=(',', ':'), sort_keys=True) + '\n'}
    for path, content in outputs.items():
        if args.check:
            require(path.exists() and path.read_text(encoding='utf-8') == content, f'Stale output: {path}')
        else:
            path.write_text(content, encoding='utf-8', newline='\n')
    print(json.dumps(register['counts']))


if __name__ == '__main__':
    main()
