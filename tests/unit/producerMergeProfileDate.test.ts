import { describe,expect,it } from 'vitest';
import { createD1Stub } from './support/d1Stub';
import { mergeProducerEntities } from '../../src/lib/producers/merge';

/**
 * A merge moves one producer's profile onto another producer's row.
 *
 * The date has to travel with it. Leaving it behind pairs the winner's text
 * with the loser's date, and a recent date on a stale profile is exactly what
 * stops it ever being researched again - the fault profile_researched_at was
 * added to fix, surviving in the one path that moves profiles about.
 */
const producer=(id:string,overrides:Record<string,unknown>={})=>({
  id,canonical_name:`Producer ${id}`,match_key:id,home_country:'France',home_region:null,home_locality:null,
  official_website_url:null,instagram_url:null,contact_email:null,contact_phone:null,contact_sources_json:'[]',
  hero_image_object_key:null,hero_image_source_url:null,
  profile:`Profile of ${id}`,winemaking_practices:'',catalog_json:'[]',sources_json:'[]',
  research_model:'model (atomic bounded catalog)',researched_at:'2026-09-01T00:00:00.000Z',
  profile_researched_at:'2026-08-01T00:00:00.000Z',created_at:'2026-01-01T00:00:00.000Z',updated_at:'2026-09-01T00:00:00.000Z',
  ...overrides
});

/** The row the merge writes back, as (column, value) pairs. */
function mergedRow(calls:Array<{sql:string;args:unknown[]}>){
  const write=calls.find(call=>/^UPDATE producers SET home_country=/.test(call.sql.trim()));
  if(!write)throw new Error('the merge wrote no producer row');
  const columns=[...write.sql.matchAll(/(\w+)=\?/g)].map(match=>match[1]);
  return new Map(columns.map((column,index)=>[column,write.args[index]]));
}

async function merge(destination:Record<string,unknown>,source:Record<string,unknown>){
  const stub=createD1Stub((sql,args)=>{
    if(/FROM producers WHERE owner_id=\? AND id=\?/.test(sql))
      return {first:args[1]==='dest'?destination:source};
    if(/FROM producer_aliases|FROM wines|FROM research_cache|FROM producer_research_history/.test(sql))return {all:[]};
    return undefined;
  });
  await mergeProducerEntities(stub.db,'owner','dest','src');
  return mergedRow(stub.calls);
}

describe('merging two producers',()=>{
  it('carries the profile date with the profile it dates',async()=>{
    // The source was researched more recently, so its profile is the one kept.
    const row=await merge(
      producer('dest',{researched_at:'2026-01-01T00:00:00.000Z',profile_researched_at:'2026-09-06T00:00:00.000Z'}),
      producer('src',{researched_at:'2026-09-05T00:00:00.000Z',profile_researched_at:'2024-02-02T00:00:00.000Z'})
    );
    expect(row.get('profile'),'the newer research wins the profile').toBe('Profile of src');
    expect(row.get('profile_researched_at'),
      'and its own date comes with it, rather than the destination\'s recent one certifying it')
      .toBe('2024-02-02T00:00:00.000Z');
  });

  it('writes a null rather than nothing for a producer whose profile was never dated',async()=>{
    // Every row is undated until its next research run, and D1 refuses an
    // undefined binding - so a merge in that window must not throw.
    const row=await merge(
      producer('dest',{profile_researched_at:null}),
      producer('src',{researched_at:'2026-09-05T00:00:00.000Z',profile_researched_at:undefined})
    );
    expect(row.has('profile_researched_at')).toBe(true);
    expect(row.get('profile_researched_at')).toBeNull();
  });
});
