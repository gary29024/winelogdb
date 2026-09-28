"""Build a research register, never an operator overlay, from the pinned pilot.

Run from any directory; --check verifies committed outputs without writing.
Only the standard library is required. No network access or source-asset edits.
"""
import argparse
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


def require(condition, message):
    if not condition:
        raise ValueError(message)


EVENT_KINDS = {'historical-application': 'Application received', 'authorisation': 'Authorisation decision',
               'suspended-application': 'Application suspended'}
EXTERNAL_BASES = {'critic-named-cadastral-reference', 'critic-attribution-area-reconstructed', 'critic-holding-description'}


def build_register(manifest, asset, curation, history):
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
        check_lineage(item, 'External research')
    rows = []
    for p in parcels:
        holder_ids = sorted({r['holderId'] for r in p['recordedRights']})
        events = [e for e in curation['exactParcelEvents'] if p['id'] in e['parcelIds']]
        inherited = [(e, retired) for e in curation['exactParcelEvents']
                     for retired, current in e.get('predecessorReferences', {}).items() if p['id'] in current]
        external = [x for x in curation['externalResearch'] if p['id'] in x['parcelIds']]
        external_inherited = [(x, retired) for x in curation['externalResearch']
                              for retired, current in x.get('predecessorReferences', {}).items() if p['id'] in current]
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
        rows.append({
            'parcelId': p['id'], 'reference': p['reference'], 'commune': p['commune'],
            'cruOverlapM2': next(o['areaM2'] for o in p['overlaps'] if o['parentFeatureId'] == parent),
            'recordedRights': p['recordedRights'], 'recordMatch': p['recordMatch'],
            'holderResearchIds': holder_ids, 'candidateLeads': leads + event_leads + external_leads,
            'historicalEvents': events + [{**e, 'viaPredecessor': r} for e, r in inherited],
            'externalResearchIds': [x['id'] for x in external] + [x['id'] for x, _ in external_inherited],
            # Dated legal-entity rights since 2019 and cadastral splits: context for who to ask, not farming.
            'rightsChanges': [{k: c[k] for k in ('from', 'to', 'kind', 'before', 'after')}
                              for c in lineage[p['id']]['rightsChanges']],
            'cadastreFirstSeen': lineage[p['id']]['firstSeenCadastre'],
            'predecessorIds': lineage[p['id']]['predecessorIds'],
            'historyFindingIds': [f['id'] for f in curation['historyFindings'] if p['id'] in f['parcelIds']],
            'researchStatus': ('historical-authorisation' if any(e['kind'] == 'authorisation' for e in events) else
                               'historical-application' if events or inherited else
                               'holder-lead' if leads or external_leads else 'unresolved'),
            'researchDepth': ('exact-reference-event-reviewed' if events or inherited else
                              'external-research-reviewed' if external or external_inherited else
                              'holder-group-triage' if holder_ids else 'inventory-only'),
            'currentFarmer': None, 'verifiedAsOf': None, 'operationScope': 'unconfirmed',
            'nextEvidenceNeeded': ('Confirm actual operation, scope and continuation since the decision.'
                                   if any(e['kind'] == 'authorisation' for e in events) else
                                   'Check the decision after the suspension ends, and who farms meanwhile.'
                                   if any(e['kind'] == 'suspended-application' for e in events) else
                                   'Resolve application outcome, actual operation and cadastral continuity.'
                                   if events or inherited else 'Obtain dated parcel-specific operation evidence and scope.'
                                   if leads else 'Identify operator through a shareable parcel-specific record; do not infer from neighbours.'),
        })
    statuses = Counter(r['researchStatus'] for r in rows)
    return {
        'schemaVersion': 1, 'reviewedAt': curation['reviewedAt'], 'targetSeason': curation['targetSeason'],
        'status': curation['status'], 'scope': curation['scope'], 'parentFeatureId': parent,
        'inputs': {'curation': 'docs/research/echezeaux-farming-curation.json',
                   'dataUrl': manifest['dataUrl'], 'sha256': manifest['sha256'],
                   'cadastreDate': manifest['cadastreDate'], 'rightsAsOf': manifest['rightsAsOf'],
                   'rightsHistory': 'docs/research/echezeaux-rights-history.json',
                   'rightsHistoryYears': [r['asOf'] for r in history['inputs']['rights']]},
        'counts': {'parcels': len(rows), 'recordedHolders': len(holders),
                   'withRecordedRights': sum(bool(r['recordedRights']) for r in rows),
                   'withoutMatchedRights': sum(not r['recordedRights'] for r in rows),
                   'holderLead': statuses['holder-lead'], 'historicalApplication': statuses['historical-application'],
                   'historicalAuthorisation': statuses['historical-authorisation'],
                   'unresolved': statuses['unresolved'], 'currentFarmerConfirmed': 0,
                   'withRightsChangeSince2019': sum(bool(r['rightsChanges']) for r in rows),
                   'withCadastralPredecessor': sum(bool(r['predecessorIds']) for r in rows)},
        'parcels': rows,
    }


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
        f"exact-reference application or suspended application, {counts['historicalAuthorisation']} have an authorisation decision, and "
        f"{counts['unresolved']} remain without a named candidate. These are mutually exclusive research categories, not farmer counts.", '',
        f"{sum(r['researchDepth'] == 'inventory-only' for r in register['parcels'])} parcels have inventory records only, not individual source investigations. "
        'Historical application references can also lack matched rights.', '',
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
    lines += ['## Every mapped parcel', '',
              'All references are in commune 21267 (Flagey-Échezeaux). Full IDs and evidence links are in the JSON register. '
              '“Holder” points to the investigations above. “None” means no matched record, not no farmer.', '',
              '| Reference | Cru overlap (m²) | Holder research ID | Candidate to investigate — never verified | Current farmer |',
              '| --- | ---: | --- | --- | --- |']
    for r in register['parcels']:
        # Explicit anchors below avoid renderer-specific slug rules for accented holder names.
        holders = ', '.join(f"[{h}](#holder-{h.lower()})" for h in r['holderResearchIds']) or 'None'
        leads = '; '.join(f"{c['name']} ({c['basis']})" for c in r['candidateLeads']) or 'Unresolved'
        lines.append(f"| {cell(r['reference'])} | {r['cruOverlapM2']:.2f} | {holders} | {cell(leads)} | Unconfirmed |")
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
    lines += ['', '## Independent research', '',
              'Published vineyard research can name cadastral references or describe holdings. It is dated secondary '
              'evidence of ownership or production, cross-checked here against the recorded rights; it never establishes '
              'current farming. "Area-reconstructed" rows are this register\'s inference: the published area equals an exact '
              'sum of parcel areas, which the source itself does not state.', '']
    for x in curation['externalResearch']:
        via = '; '.join(f"{ref(r)} (retired) → {', '.join(ref(c) for c in cs)}" for r, cs in x.get('predecessorReferences', {}).items())
        refs = ', '.join(ref(i) for i in x['parcelIds']) + (('; via lineage: ' if x['parcelIds'] else 'via lineage: ') + via if via else '')
        refs = refs or 'no cadastral reference'
        cited = ', '.join(f"[{cell(sources[s]['title'])}]({sources[s]['url']})" for s in x['sourceIds'])
        lines.append(f"- **{cell(x['title'])}** ({refs}; {x['basis']}). {x['finding']} Sources: {cited}.")
    lines.append('')
    lines += render_history(register, curation, history, sources)
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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    curation = json.loads(CURATION.read_text(encoding='utf-8'))
    history = json.loads(HISTORY.read_text(encoding='utf-8'))
    asset = (ROOT / 'public' / manifest['dataUrl'].lstrip('/')).read_bytes()
    register = build_register(manifest, asset, curation, history)
    outputs = {OUTPUT: json.dumps(register, ensure_ascii=False, indent=2) + '\n',
               REPORT: render_report(register, curation, history)}
    for path, content in outputs.items():
        if args.check:
            require(path.exists() and path.read_text(encoding='utf-8') == content, f'Stale output: {path}')
        else:
            path.write_text(content, encoding='utf-8', newline='\n')
    print(json.dumps(register['counts']))


if __name__ == '__main__':
    main()
