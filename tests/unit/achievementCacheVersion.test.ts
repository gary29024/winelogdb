import { describe,expect,it } from 'vitest';
import { ACHIEVEMENT_DEFINITION_VERSION } from '../../worker/achievementHandler';
import { achievementDefinitions } from '../../src/features/achievements/curatedLaunch';

/**
 * A stable summary of the curated set: which collections exist, and which
 * targets each holds in which order.
 *
 * The order is part of it because the cached payload carries it. Counting items
 * was not enough: reordering the Graves estates by what they are classified for
 * changed no count, so this stayed green while the cache kept serving the old
 * order under new headings.
 */
/** Every field of a selector, in a stable order, so a reordered object is not a change. */
const stableJson=(value:unknown):string=>{
  if(Array.isArray(value))return `[${value.map(stableJson).join(',')}]`;
  if(value&&typeof value==='object')
    return `{${Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([key,entry])=>`${key}:${stableJson(entry)}`).join(',')}}`;
  return String(value);
};

function curatedCollectionFingerprint(){
  const shape=achievementDefinitions.map(definition=>
    `${definition.id}:${definition.items.map(item=>`${item.id}=${stableJson(item.selector)}`).join(',')}`).sort().join('|');
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
    // It also has to move when only a selector changes: adding "Marchesi
    // Antinori" beside "Antinori" ticks wines that were unchecked before, while
    // touching no id and no count, so an id-only fingerprint would have let that
    // ship into a cache that keeps serving the old answer.
    //
    // The version also has to move when the cached payload changes shape
    // rather than its contents - per-vintage links were added to every
    // checklist item, which the fingerprint cannot see because no collection
    // gained or lost a target.
    //
    // If this fails: the curated set changed, or the payload did. Bump
    // ACHIEVEMENT_DEFINITION_VERSION, then put the new pair here.
    expect({version:ACHIEVEMENT_DEFINITION_VERSION,fingerprint:curatedCollectionFingerprint()})
      .toEqual({version:9,fingerprint:'5b959383'});
  });

  it('changes the fingerprint when a collection is added or resized',()=>{
    // The guard is only worth having if it actually moves.
    const before=curatedCollectionFingerprint();
    const extra=[...achievementDefinitions.map(definition=>
      `${definition.id}:${definition.items.map(item=>`${item.id}=${stableJson(item.selector)}`).join(',')}`),'new-collection:a,b'].sort().join('|');
    let hash=0;for(const character of extra)hash=(Math.imul(hash,31)+character.charCodeAt(0))|0;
    expect((hash>>>0).toString(16)).not.toBe(before);
  });
});
