import { describe,expect,it } from 'vitest';
import { ACHIEVEMENT_DEFINITION_VERSION } from '../../worker/achievementHandler';
import { achievementDefinitions } from '../../src/features/achievements/curatedLaunch';

/** A stable summary of the curated set: which collections exist and how big each is. */
function curatedCollectionFingerprint(){
  const shape=achievementDefinitions.map(definition=>`${definition.id}:${definition.items.length}`).sort().join('|');
  let hash=0;
  for(const character of shape)hash=(Math.imul(hash,31)+character.charCodeAt(0))|0;
  return (hash>>>0).toString(16);
}

describe('the curated set and its cache key',()=>{
  it('moves the definition version whenever the collections change',()=>{
    // Achievement progress is cached per owner against (data revision,
    // definition version), and the same pair is the ETag. Adding a collection
    // touches neither the owner's data nor their revision, so five new
    // collections shipped and the page kept showing twenty from cache.
    //
    // If this fails: the curated set changed. Bump
    // ACHIEVEMENT_DEFINITION_VERSION, then put the new fingerprint here.
    expect({version:ACHIEVEMENT_DEFINITION_VERSION,fingerprint:curatedCollectionFingerprint()})
      .toEqual({version:4,fingerprint:'7d77c626'});
  });

  it('changes the fingerprint when a collection is added or resized',()=>{
    // The guard is only worth having if it actually moves.
    const before=curatedCollectionFingerprint();
    const extra=[...achievementDefinitions.map(definition=>`${definition.id}:${definition.items.length}`),'new-collection:5'].sort().join('|');
    let hash=0;for(const character of extra)hash=(Math.imul(hash,31)+character.charCodeAt(0))|0;
    expect((hash>>>0).toString(16)).not.toBe(before);
  });
});
