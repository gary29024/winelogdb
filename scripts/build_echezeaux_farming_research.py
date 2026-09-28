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


def require(condition, message):
    if not condition:
        raise ValueError(message)


def build_register(manifest, asset, curation):
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
    for event in curation['exactParcelEvents']:
        require(set(event['parcelIds']) <= ids, 'Event reference outside research cru')
        require(event['sourceId'] in sources, 'Unknown event source')
        require(event['currentFarmer'] is None, 'Historical event cannot establish current farming')
    rows = []
    for p in parcels:
        holder_ids = sorted({r['holderId'] for r in p['recordedRights']})
        events = [e for e in curation['exactParcelEvents'] if p['id'] in e['parcelIds']]
        leads = [{'name': name, 'holderId': hid, 'basis': holders[hid]['basis'],
                  'sourceIds': holders[hid]['sourceIds']}
                 for hid in holder_ids for name in holders[hid]['candidateNames']]
        event_leads = [{'name': e['applicant'], 'basis': e['kind'], 'sourceIds': [e['sourceId']]}
                       for e in events]
        rows.append({
            'parcelId': p['id'], 'reference': p['reference'], 'commune': p['commune'],
            'cruOverlapM2': next(o['areaM2'] for o in p['overlaps'] if o['parentFeatureId'] == parent),
            'recordedRights': p['recordedRights'], 'recordMatch': p['recordMatch'],
            'holderResearchIds': holder_ids, 'candidateLeads': leads + event_leads,
            'historicalEvents': events,
            'researchStatus': ('historical-application' if events else 'holder-lead' if leads else 'unresolved'),
            'researchDepth': ('exact-reference-event-reviewed' if events else
                              'holder-group-triage' if holder_ids else 'inventory-only'),
            'currentFarmer': None, 'verifiedAsOf': None, 'operationScope': 'unconfirmed',
            'nextEvidenceNeeded': ('Resolve application outcome, actual operation and cadastral continuity.'
                                   if events else 'Obtain dated parcel-specific operation evidence and scope.'
                                   if leads else 'Identify operator through a shareable parcel-specific record; do not infer from neighbours.'),
        })
    statuses = Counter(r['researchStatus'] for r in rows)
    return {
        'schemaVersion': 1, 'reviewedAt': curation['reviewedAt'], 'targetSeason': curation['targetSeason'],
        'status': curation['status'], 'scope': curation['scope'], 'parentFeatureId': parent,
        'inputs': {'curation': 'docs/research/echezeaux-farming-curation.json',
                   'dataUrl': manifest['dataUrl'], 'sha256': manifest['sha256'],
                   'cadastreDate': manifest['cadastreDate'], 'rightsAsOf': manifest['rightsAsOf']},
        'counts': {'parcels': len(rows), 'recordedHolders': len(holders),
                   'withRecordedRights': sum(bool(r['recordedRights']) for r in rows),
                   'withoutMatchedRights': sum(not r['recordedRights'] for r in rows),
                   'holderLead': statuses['holder-lead'], 'historicalApplication': statuses['historical-application'],
                   'unresolved': statuses['unresolved'], 'currentFarmerConfirmed': 0},
        'parcels': rows,
    }


def cell(value):
    return str(value).replace('|', '\\|').replace('\n', ' ')


def render_report(register, curation):
    counts = register['counts']
    sources = {s['id']: s for s in curation['sources']}
    lines = [
        '# Échezeaux parcel farming research register', '',
        f"Reviewed {register['reviewedAt']}; target season {register['targetSeason']}.", '',
        '**Current farmer identification remains incomplete: no parcel has confirmed current-operation evidence.**', '',
        register['scope'], '',
        f"Of {counts['parcels']} mapped parcels, {counts['withRecordedRights']} have recorded rights and "
        f"{counts['withoutMatchedRights']} have no matched right holder. All {counts['recordedHolders']} holder groups were triaged. "
        f"{counts['holderLead']} parcels have holder-derived research leads, {counts['historicalApplication']} have an exact-reference "
        f"historical application, and {counts['unresolved']} remain without a named candidate. These are mutually exclusive research categories, not farmer counts.", '',
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
    lines += ['', '## Exact-reference historical event', '',
              'D 0177 and D 0178: Anne Gros application received 24 November 2022, dossier 2022-204, '
              'previous operator Domaine Gros Frère et Sœur. The receipt does not authorise cultivation. '
              'Outcome, actual current operation and cadastral continuity remain unconfirmed. Printed D01776 is unresolved. '
              'D0093 belongs to Grands-Échezeaux and is outside this register. '
              f"[Official receipt, pages 74–75]({sources['anne-application']['url']}).", '',
              '## Source log', '',
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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    curation = json.loads(CURATION.read_text(encoding='utf-8'))
    asset = (ROOT / 'public' / manifest['dataUrl'].lstrip('/')).read_bytes()
    register = build_register(manifest, asset, curation)
    outputs = {OUTPUT: json.dumps(register, ensure_ascii=False, indent=2) + '\n',
               REPORT: render_report(register, curation)}
    for path, content in outputs.items():
        if args.check:
            require(path.exists() and path.read_text(encoding='utf-8') == content, f'Stale output: {path}')
        else:
            path.write_text(content, encoding='utf-8', newline='\n')
    print(json.dumps(register['counts']))


if __name__ == '__main__':
    main()
