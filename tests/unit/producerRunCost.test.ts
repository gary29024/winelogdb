import { describe,expect,it,vi } from 'vitest';
import { createD1Stub } from './support/d1Stub';
import { PROFILE_FRESH_DAYS,profileIsFresh,startProducerBatchResearch } from '../../src/lib/producers/batchResearch';

const day=24*60*60*1000;
const now=Date.parse('2026-09-07T00:00:00.000Z');
const known=(overrides:Record<string,unknown>={})=>
  ({profile:'A Saint-Emilion estate.',home_country:'France',researched_at:'2026-08-01T00:00:00.000Z',...overrides});

describe('what a producer run asks for',()=>{
  /**
   * Measured on a real month: a producer Deep Search costs about twice a wine's
   * and is the more frequent of the two. Half of it is a second grounded
   * request asking again where the estate is and how it farms - facts that do
   * not move. The range does, and is why anyone presses refresh.
   */
  it('keeps a profile that exists, knows its country and is recent',()=>{
    expect(profileIsFresh(known(),now)).toBe(true);
    expect(profileIsFresh(known({researched_at:new Date(now-(PROFILE_FRESH_DAYS-1)*day).toISOString()}),now)).toBe(true);
  });

  it('researches one that is thin, unplaced, undated or old',()=>{
    expect(profileIsFresh(null,now),'a producer with no row at all').toBe(false);
    expect(profileIsFresh(known({profile:'   '}),now),'nothing written').toBe(false);
    expect(profileIsFresh(known({home_country:null}),now),'never placed').toBe(false);
    expect(profileIsFresh(known({researched_at:null}),now),'never researched').toBe(false);
    expect(profileIsFresh(known({researched_at:'not a date'}),now)).toBe(false);
    expect(profileIsFresh(known({researched_at:new Date(now-(PROFILE_FRESH_DAYS+1)*day).toISOString()}),now),
      'old enough that an estate may have changed hands').toBe(false);
    expect(profileIsFresh(known({researched_at:new Date(now+day).toISOString()}),now),'a clock in the future proves nothing').toBe(false);
  });
});

describe('the request a run actually submits',()=>{
  const run=async(row:Record<string,unknown>|null)=>{
    const stub=createD1Stub(sql=>{
      if(/SELECT profile,home_country,researched_at FROM producers/.test(sql))return {first:row};
      if(/SELECT canonical_name FROM producers/.test(sql))return {first:{canonical_name:'Chateau Cheval Blanc'}};
      return undefined;
    });
    const batches:Array<{model:string;entries:Array<{key:string}>}>=[];
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({name:'batches/x'}),{status:200,headers:{'content-type':'application/json'}})));
    const env={DB:stub.db,GEMINI_API_KEY:'k',RESEARCH_QUEUE:{send:async()=>undefined}} as never;
    const module=await import('../../src/lib/research/geminiBatch');
    const spy=vi.spyOn(module,'createGeminiBatch').mockImplementation(async(_key,model,_name,entries)=>{
      batches.push({model,entries:entries as Array<{key:string}>});return 'batches/x';
    });
    const result=await startProducerBatchResearch(env,'owner','p1','r1');
    spy.mockRestore();vi.unstubAllGlobals();
    return {result,keys:batches[0]?.entries.map(entry=>entry.key)??[]};
  };

  it('sends the range alone when the profile is still current',async()=>{
    const {result,keys}=await run(known({researched_at:new Date(Date.now()-day).toISOString()}));
    expect(result.ok).toBe(true);
    expect(keys,'one grounded request, not two').toEqual(['catalog_slice_a_z_other']);
  });

  it('sends both halves for a producer it has never placed',async()=>{
    const {keys}=await run(known({home_country:null}));
    expect(keys).toEqual(['profile','catalog_slice_a_z_other']);
  });

  it('sends both halves for a producer it has never seen',async()=>{
    const {keys}=await run(null);
    expect(keys).toEqual(['profile','catalog_slice_a_z_other']);
  });
});
