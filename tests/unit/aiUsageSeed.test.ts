import { describe,expect,it } from 'vitest';
import { createD1Stub } from './support/d1Stub';
import { AI_USAGE_SEED_KEY,seedAiUsageOnce } from '../../src/lib/usage/seedFromResearchJobs';

type Job={request_id:string;target_kind:string;target_id:string;model:string;search_queries:number;created_at:string};
type Row=Record<string,unknown>;

/**
 * The seed reads one table and writes two, and the whole point is that it does
 * so exactly once - so the double keeps the claim row as well, and a test can
 * call it twice and see the second call do nothing.
 */
function world(jobs:Job[],firstEvent:string|null=null){
  const events:Row[]=[],monthly:Row[]=[],claims=new Set<string>();
  const stub=createD1Stub((raw,args)=>{
    const sql=raw.replace(/\s+/g,' ').trim();
    if(/^INSERT INTO maintenance_state/.test(sql)){
      const key=String(args[1]);
      if(claims.has(key))return {changes:0};
      claims.add(key);return {changes:1};
    }
    if(/^DELETE FROM maintenance_state/.test(sql)){claims.delete(String(args[1]));return undefined}
    if(/min\(created_at\) AS first FROM ai_usage_events/.test(sql))return {first:{first:firstEvent}};
    if(/FROM research_batch_jobs/.test(sql))
      return {all:jobs.filter(job=>job.created_at<String(args[1])).map(job=>({...job}))};
    if(/^INSERT INTO ai_usage_events/.test(sql)){
      // Tokens are literal zeros in the statement, not bound, so created_at
      // is the last parameter.
      events.push({kind:args[2],run_id:args[3],model:args[5],requests:Number(args[6]),search_queries:Number(args[7]),
        created_at:args[8],tokensAreLiteralZero:/,0,0,\?\)/.test(sql)});
      return undefined;
    }
    if(/^INSERT INTO ai_usage_monthly/.test(sql)){
      const [,month,kind,requests,searches]=args as [string,string,string,number,number];
      const row=monthly.find(item=>item.month===month&&item.kind===kind);
      if(row){row.requests=Number(row.requests)+requests;row.search_queries=Number(row.search_queries)+searches}
      else monthly.push({month,kind,requests,search_queries:searches});
      return undefined;
    }
    return undefined;
  });
  return {db:stub.db,events,monthly,claims,stub};
}

const job=(overrides:Partial<Job>={}):Job=>({
  request_id:'r-1',target_kind:'producer',target_id:'p-1',model:'gemini-3.7-flash',search_queries:14,
  created_at:'2026-08-20T10:00:00.000Z',...overrides
});

describe('seeding the ledger from research jobs',()=>{
  it('folds recorded search counts into the month and the per-run detail',async()=>{
    const {db,events,monthly}=world([
      job({request_id:'r-1',search_queries:14}),
      job({request_id:'r-2',search_queries:9}),
      job({request_id:'w-1',target_kind:'wine',target_id:'wine-1',search_queries:7})
    ]);
    const seeded=await seedAiUsageOnce(db,'owner');
    expect(seeded).toMatchObject({events:3,searchQueries:30});
    expect(monthly.find(row=>row.kind==='producer_research')).toMatchObject({month:'2026-08',requests:2,search_queries:23});
    expect(monthly.find(row=>row.kind==='wine_research')).toMatchObject({month:'2026-08',requests:1,search_queries:7});
    // Tokens were never recorded against these jobs, so they seed as zero
    // rather than as a guess.
    expect(events.every(row=>row.tokensAreLiteralZero)).toBe(true);
    // The run id is carried over, so per-run figures include this history.
    expect(events.map(row=>row.run_id)).toEqual(['r-1','r-2','w-1']);
  });

  it('buckets by the Pacific month the allowance resets in',async()=>{
    // 22:00 on 31 July in Los Angeles: still July's allowance, though UTC has
    // already turned over.
    const {db,monthly}=world([
      job({request_id:'r-july',created_at:'2026-08-01T05:00:00.000Z',search_queries:5}),
      job({request_id:'r-aug',created_at:'2026-08-01T08:00:00.000Z',search_queries:3})
    ]);
    await seedAiUsageOnce(db,'owner');
    expect(monthly.find(row=>row.month==='2026-07')).toMatchObject({search_queries:5});
    expect(monthly.find(row=>row.month==='2026-08')).toMatchObject({search_queries:3});
  });

  it('never double counts what the live meter already recorded',async()=>{
    // Metering began at the first event; jobs from then on are already counted.
    const {db,events}=world([
      job({request_id:'before',created_at:'2026-08-20T10:00:00.000Z'}),
      job({request_id:'after',created_at:'2026-08-26T10:00:00.000Z'})
    ],'2026-08-25T00:00:00.000Z');
    await seedAiUsageOnce(db,'owner');
    expect(events.map(row=>row.run_id)).toEqual(['before']);
  });

  it('runs once and only once',async()=>{
    const {db,events}=world([job()]);
    expect(await seedAiUsageOnce(db,'owner')).toMatchObject({events:1});
    expect(await seedAiUsageOnce(db,'owner')).toBeNull();
    expect(events).toHaveLength(1);
  });

  it('releases its claim when it fails, so it is retried rather than lost',async()=>{
    const claims=new Set<string>();
    const stub=createD1Stub((raw,args)=>{
      const sql=raw.replace(/\s+/g,' ').trim();
      if(/^INSERT INTO maintenance_state/.test(sql)){
        const key=String(args[1]);if(claims.has(key))return {changes:0};claims.add(key);return {changes:1};
      }
      if(/^DELETE FROM maintenance_state/.test(sql)){claims.delete(String(args[1]));return undefined}
      throw new Error('D1 fell over mid-seed');
    });
    expect(await seedAiUsageOnce(stub.db,'owner')).toBeNull();
    expect(claims.has(AI_USAGE_SEED_KEY),'the claim should be released for the next attempt').toBe(false);
  });

  it('is a no-op for a library with nothing recorded',async()=>{
    const {db,stub}=world([]);
    expect(await seedAiUsageOnce(db,'owner')).toMatchObject({events:0,months:0});
    expect(stub.writes().filter(call=>/ai_usage/.test(call.sql))).toEqual([]);
  });
});
