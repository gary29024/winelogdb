import { describe,expect,it } from 'vitest';
import { createD1Stub } from './support/d1Stub';
import { advanceCampaign,CAMPAIGN_CONCURRENCY,typicalProducerRunMs,unresearchedProducers,
  type CampaignItemStatus } from '../../src/lib/producers/researchCampaign';

type Item={producer_id:string;producer_name:string;request_id:string|null;status:CampaignItemStatus;message:string|null};
type Run={status:'running'|'complete'|'failed';message:string|null};

/**
 * A campaign is a small state machine over two tables, so the double keeps
 * those two tables rather than recording statements: a tick has to see what the
 * previous tick wrote, and the interesting assertions are about the state it
 * leaves behind.
 */
function world(items:Item[],runs:Record<string,Run>={},campaignStatus='running'){
  const queued:Array<Record<string,unknown>>=[];
  const state={campaignStatus,items,runs:{...runs} as Record<string,Run>,producers:new Set(items.map(item=>item.producer_id))};
  const stub=createD1Stub((sql,args)=>{
    const text=sql.replace(/\s+/g,' ').trim();
    if(/^SELECT status FROM producer_research_campaigns/.test(text))return {first:{status:state.campaignStatus}};
    if(/FROM producer_research_campaign_items WHERE campaign_id=\? ORDER BY/.test(text))return {all:state.items.map(item=>({...item}))};
    if(/SELECT status,message FROM producer_research_runs/.test(text)){
      const run=state.runs[String(args[1])];
      return {first:run?{status:run.status,message:run.message}:null};
    }
    if(/SELECT request_id FROM producer_research_runs/.test(text))return {first:null};
    if(/SELECT id FROM producers WHERE owner_id=\? AND id=\?/.test(text))
      return {first:state.producers.has(String(args[1]))?{id:String(args[1])}:null};
    if(/^UPDATE producer_research_campaign_items SET status=\?,message=\?/.test(text)){
      const item=state.items.find(row=>row.producer_id===args[4]);
      if(item){item.status=args[0] as CampaignItemStatus;item.message=args[1] as string|null}
      return undefined;
    }
    if(/^UPDATE producer_research_campaign_items SET status='running'/.test(text)){
      const item=state.items.find(row=>row.producer_id===args[3]);
      if(item){item.status='running';item.request_id=String(args[0]);state.runs[String(args[0])]={status:'running',message:null}}
      return undefined;
    }
    if(/^UPDATE producer_research_campaigns SET status=\?/.test(text)||/SET status='complete'/.test(text))
      {state.campaignStatus='complete';return undefined}
    return undefined;
  });
  const env={DB:stub.db,RESEARCH_QUEUE:{send:async(job:Record<string,unknown>)=>{queued.push(job)}} as unknown as Queue<unknown>};
  return {env,state,queued,stub};
}

const pending=(id:string):Item=>({producer_id:id,producer_name:id,request_id:null,status:'pending',message:null});

describe('a batch producer research run',()=>{
  it('starts only as many producers as the lane allows',async()=>{
    // The whole point of the campaign: a library of 500 producers must not
    // become 500 grounded batch submissions the moment someone clicks once.
    const {env,state,queued}=world([pending('a'),pending('b'),pending('c'),pending('d')]);
    const progress=await advanceCampaign(env,'owner','c1');
    expect(progress.started).toBe(CAMPAIGN_CONCURRENCY);
    expect(progress.done).toBe(false);
    expect(state.items.filter(item=>item.status==='running')).toHaveLength(CAMPAIGN_CONCURRENCY);
    expect(state.items.filter(item=>item.status==='pending')).toHaveLength(4-CAMPAIGN_CONCURRENCY);
    expect(queued.map(job=>job.kind)).toEqual(Array(CAMPAIGN_CONCURRENCY).fill('producer'));
  });

  it('settles finished producers and refills the lane on the next tick',async()=>{
    const {env,state}=world(
      [{producer_id:'a',producer_name:'A',request_id:'r-a',status:'running',message:null},
       {producer_id:'b',producer_name:'B',request_id:'r-b',status:'running',message:null},
       pending('c'),pending('d')],
      {'r-a':{status:'complete',message:'Researched 12 wines'},'r-b':{status:'failed',message:'Gemini returned nothing'}});
    const progress=await advanceCampaign(env,'owner','c1');
    expect(state.items.find(item=>item.producer_id==='a')?.status).toBe('complete');
    expect(state.items.find(item=>item.producer_id==='b')).toMatchObject({status:'failed',message:'Gemini returned nothing'});
    expect(progress.started).toBe(CAMPAIGN_CONCURRENCY);
    expect(state.items.filter(item=>item.status==='running').map(item=>item.producer_id)).toEqual(['c','d']);
  });

  it('leaves a producer that is still running alone',async()=>{
    // Ticks arrive every thirty seconds; research takes minutes. A tick that
    // re-queued a running producer would double-submit it.
    const {env,state,queued}=world(
      [{producer_id:'a',producer_name:'A',request_id:'r-a',status:'running',message:null},pending('b'),pending('c')],
      {'r-a':{status:'running',message:'Searching'}});
    const progress=await advanceCampaign(env,'owner','c1');
    expect(state.items.find(item=>item.producer_id==='a')?.status).toBe('running');
    expect(progress.started).toBe(CAMPAIGN_CONCURRENCY-1);
    expect(queued).toHaveLength(CAMPAIGN_CONCURRENCY-1);
  });

  it('finishes when nothing is left, and reports how it ended',async()=>{
    const {env,stub}=world(
      [{producer_id:'a',producer_name:'A',request_id:'r-a',status:'running',message:null}],
      {'r-a':{status:'complete',message:'done'}});
    const progress=await advanceCampaign(env,'owner','c1');
    expect(progress).toMatchObject({done:true,started:0,running:0,pending:0});
    const closing=stub.matching(/UPDATE producer_research_campaigns SET status='complete'/)[0];
    // A clean run dismisses itself; there is nothing to tell anyone.
    expect(closing.args[2]).not.toBeNull();
  });

  it('keeps a run with failures until it has been read',async()=>{
    const {env,stub}=world(
      [{producer_id:'a',producer_name:'A',request_id:'r-a',status:'running',message:null},
       {producer_id:'b',producer_name:'B',request_id:'r-b',status:'failed',message:'earlier failure'}],
      {'r-a':{status:'complete',message:'done'}});
    await advanceCampaign(env,'owner','c1');
    const closing=stub.matching(/UPDATE producer_research_campaigns SET status='complete'/)[0];
    expect(closing.args[2]).toBeNull();
  });

  it('does nothing to a campaign that was stopped',async()=>{
    const {env,queued}=world([pending('a'),pending('b')],{},'cancelled');
    expect(await advanceCampaign(env,'owner','c1')).toMatchObject({done:true,started:0});
    expect(queued).toEqual([]);
  });

  it('skips a producer that no longer exists rather than failing the batch',async()=>{
    const {env,state}=world([pending('a'),pending('gone')]);
    state.producers.delete('gone');
    await advanceCampaign(env,'owner','c1');
    expect(state.items.find(item=>item.producer_id==='gone')?.status).toBe('skipped');
    expect(state.items.find(item=>item.producer_id==='a')?.status).toBe('running');
  });
});

describe('choosing what a batch run covers',()=>{
  it('only ever picks producers that have never been researched',async()=>{
    const {stub}=world([]);
    await unresearchedProducers(stub.db,'owner',25);
    const query=stub.matching(/FROM producers/)[0];
    expect(query.sql.replace(/\s+/g,' ')).toContain('researched_at IS NULL');
    expect(query.args).toEqual(['owner',25]);
  });

  it('caps a single run so one click cannot queue the whole library',async()=>{
    const {stub}=world([]);
    await unresearchedProducers(stub.db,'owner',5000);
    expect(stub.matching(/FROM producers/)[0].args[1]).toBe(200);
    await unresearchedProducers(stub.db,'owner',0);
    expect(stub.matching(/FROM producers/)[1].args[1]).toBe(1);
  });
});

describe('how long a batch run will take',()=>{
  it('takes the median of this library\'s own completed runs',async()=>{
    // A mean would let one stalled run that retried for an hour set the
    // expectation for the next twenty.
    const durations=[120000,140000,160000,180000,3600000];
    const stub=createD1Stub(sql=>/duration_ms/.test(sql)?{all:durations.map(duration_ms=>({duration_ms}))}:undefined);
    expect(await typicalProducerRunMs(stub.db,'owner')).toBe(160000);
  });

  it('claims nothing when there is nothing to measure',async()=>{
    const stub=createD1Stub(()=>({all:[]}));
    expect(await typicalProducerRunMs(stub.db,'owner')).toBeNull();
  });
});
