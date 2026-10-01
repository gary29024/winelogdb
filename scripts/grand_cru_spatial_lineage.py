"""The #411 spatial rule, labelled inference and kept apart from official DFI.

Candidates are compared between consecutive obtained commune vintages, including
intermediate retired references. A next-vintage first appearance and >=95% inside
are necessary. Existing neighbours and later descendants are rejected candidates.
"""
from collections import defaultdict


def observed_geometry(geometry, cru_shape, parcel_id, date):
    """Ignore disjoint invalid geometry; never silently repair a source polygon."""
    from shapely.geometry import box

    if not geometry.is_valid:
        if not box(*geometry.bounds).intersects(box(*cru_shape.bounds)):
            return None
        raise ValueError(f'Invalid historical geometry requires source review: {parcel_id} at {date}')
    return geometry


def spatial_candidates(vintages, communes_by_date, *, cru_shape, minimum_overlap, inside_share):
    from shapely.strtree import STRtree

    first_seen = {}
    for date, geometries in vintages:
        for pid in geometries:
            first_seen.setdefault(pid, date)
    candidates = []
    all_communes = sorted({c for values in communes_by_date.values() for c in values})
    for commune in all_communes:
        observed = [(d, {p: g for p, g in geometries.items() if p[:5] == commune})
                    for d, geometries in vintages if commune in communes_by_date[d]]
        for (before_date, before), (after_date, after) in zip(observed, observed[1:]):
            ids = sorted(after)
            if not ids:
                continue
            geometries = [after[p] for p in ids]
            tree = STRtree(geometries)
            for mother in sorted(set(before) - set(after)):
                geometry = observed_geometry(before[mother], cru_shape, mother, before_date)
                if geometry is None:
                    continue
                if geometry.intersection(cru_shape).area <= minimum_overlap:
                    continue
                for index in tree.query(geometry, predicate='intersects'):
                    daughter, successor = ids[index], geometries[index]
                    shared = geometry.intersection(successor).area
                    if shared <= minimum_overlap:
                        continue
                    share = shared / successor.area
                    accepted = first_seen[daughter] == after_date and share >= inside_share
                    candidates.append({
                        'id': f'spatial:{before_date}:{after_date}:{mother}:{daughter}',
                        'method': 'spatial-inference', 'motherId': mother, 'daughterId': daughter,
                        'lastMotherObservation': before_date, 'firstSuccessorObservation': first_seen[daughter],
                        'nextObtainedVintage': after_date, 'dateRole': 'cadastral-release-observation',
                        'sharedAreaM2': round(shared, 4), 'shareOfSuccessor': round(share, 6),
                        'shareOfMother': round(shared / geometry.area, 6), 'accepted': accepted,
                        'reason': 'next-vintage-first-appearance-and-inside-threshold' if accepted else
                                  'successor-already-observed' if first_seen[daughter] != after_date else 'below-inside-threshold',
                    })
    return sorted(candidates, key=lambda c: c['id'])


def trace_spatial_ancestry(current_ids, candidates, documented_events):
    """Fallback paths stop where a documented correspondence is available.

    All candidates remain in the audit. Accepted conflicts are explicitly flagged
    and never override an official group, including an unresolved DFI group.
    """
    official, inferred = defaultdict(list), defaultdict(list)
    conflicts = []
    for event in documented_events:
        for daughter in event['daughterIds']:
            official[daughter].append(event)
    for candidate in candidates:
        if not candidate['accepted']:
            continue
        daughter, mother = candidate['daughterId'], candidate['motherId']
        if daughter in official:
            if not any(mother in e['motherIds'] for e in official[daughter]):
                conflicts.append({'candidateId': candidate['id'], 'motherId': mother, 'daughterId': daughter,
                                  'officialEventIds': sorted(e['id'] for e in official[daughter]),
                                  'kind': 'spatial-candidate-conflicts-with-dfi', 'assignment': 'unassigned'})
        inferred[daughter].append(candidate)
    rows = []
    for root in sorted(current_ids):
        paths, terminals = [], []
        stack = [(root, [], [root], None)]
        while stack:
            pid, event_path, references, before = stack.pop()
            if pid in official:
                terminals.append({'referenceId': pid, 'referencePath': references, 'candidatePath': event_path,
                                  'reason': 'documented-dfi-correspondence-takes-precedence',
                                  'officialEventIds': sorted(e['id'] for e in official[pid])})
                continue
            parents = inferred.get(pid, [])
            if not parents:
                terminals.append({'referenceId': pid, 'referencePath': references, 'candidatePath': event_path,
                                  'reason': 'no-accepted-spatial-predecessor'})
            for candidate in parents:
                mother = candidate['motherId']
                reason = ('cycle' if mother in references else 'impossible-observation-chronology'
                          if before and candidate['nextObtainedVintage'] > before else None)
                if reason:
                    terminals.append({'referenceId': pid, 'referencePath': references, 'candidatePath': event_path,
                                      'reason': reason, 'candidateId': candidate['id']})
                    continue
                refs, next_path = references + [mother], event_path + [candidate['id']]
                paths.append({'referenceId': mother, 'referencePath': refs, 'candidatePath': next_path,
                              'method': 'spatial-inference', 'scope': 'inferred-former-reference-context',
                              'observationDate': candidate['nextObtainedVintage'],
                              'limitation': 'A spatial inference does not establish official filiation, creation or transfer of rights or farming.'})
                stack.append((mother, next_path, refs, candidate['lastMotherObservation']))
        rows.append({'parcelId': root, 'paths': sorted(paths, key=lambda p: (p['referenceId'], p['candidatePath'])),
                     'terminals': terminals})
    return rows, sorted(conflicts, key=lambda c: c['candidateId'])
