import { describe,expect,it } from 'vitest';
import { createD1Stub } from './support/d1Stub';
import { getProducerResearchRun,isStalledRun,settleIfStalled,STALLED_RUN_MESSAGE,STALLED_RUN_MS,
  type ProducerResearchRun } from '../../src/lib/producers/research';
import { reviveCampaignIfStalled,tickLooksLost,CAMPAIGN_TICK_LOST_MS,type Campaign } from '../../src/lib/producers/researchCampaign';

const ago=(ms:number)=>new Date(Date.now()-ms).toISOString();

const runRow=(overrides:Record<string,unknown>={})=>({
  request_id:'r-1',producer_id:'p-1',status:'running',stage:'searching',attempt:1,message:'Searching',
  started_at:ago(STALLED_RUN_MS+90*60_000),updated_at:ago(STALLED_RUN_MS+60_000),completed_at:null,duration_ms:null,...overrides
});

const run=(overrides:Partial<ProducerResearchRun>={}):ProducerResearchRun=>({
  requestId:'r-1',producerId:'p-1',status:'running',stage:'searching',attempt:1,message:'Searching',
  startedAt:ago(STALLED_RUN_MS+90*60_000),updatedAt:ago(STALLED_RUN_MS+60_000),completedAt:null,durationMs:null,...overrides
});

describe('a run that stopped reporting',()=>{
  it('is stalled once it has been silent past the widest retry gap',()=>{
    expect(isStalledRun({status:'running',updated_at:ago(STALLED_RUN_MS+1000)})).toBe(true);
    expect(isStalledRun({status:'running',updated_at:ago(STALLED_RUN_MS-60_000)})).toBe(false);
  });

  it('never touches a run that already ended, however old',()=>{
    expect(isStalledRun({status:'complete',updated_at:ago(STALLED_RUN_MS*10)})).toBe(false);
    expect(isStalledRun({status:'failed',updated_at:ago(STALLED_RUN_MS*10)})).toBe(false);
  });

  it('is failed on the way out, so reading the status is what repairs it',async()=>{
    // Reported as a Deep Search still "researching in the background" after six
    // hours: the queue message that would have advanced it never arrived, and
    // nothing else ever wrote to the row.
    const stub=createD1Stub(sql=>/SELECT request_id,producer_id,status/.test(sql)?{first:runRow()}:undefined);
    const settled=await getProducerResearchRun(stub.db,'owner','p-1','r-1');
    expect(settled?.status).toBe('failed');
    expect(settled?.stage).toBe('failed');
    expect(settled?.message).toBe(STALLED_RUN_MESSAGE);
    expect(settled?.completedAt).not.toBeNull();
    expect(settled?.durationMs).toBeGreaterThan(0);
    const write=stub.writes()[0];
    expect(write).toBeDefined();
    // Guarded on 'running', so a run that finished between the read and the
    // write is left exactly as it finished.
    expect(write.sql.replace(/\s+/g,' ')).toContain("status='running'");
  });

  it('leaves a healthy run alone and writes nothing',async()=>{
    const stub=createD1Stub(sql=>/SELECT request_id,producer_id,status/.test(sql)
      ?{first:runRow({updated_at:ago(60_000),started_at:ago(120_000)})}:undefined);
    const live=await getProducerResearchRun(stub.db,'owner','p-1','r-1');
    expect(live?.status).toBe('running');
    expect(stub.writes()).toEqual([]);
  });

  it('passes a finished run straight through',async()=>{
    const stub=createD1Stub();
    const done=run({status:'complete',stage:'complete'});
    expect(await settleIfStalled(stub.db,'owner',done)).toBe(done);
    expect(stub.writes()).toEqual([]);
  });
});

const campaign=(overrides:Partial<Campaign>={}):Campaign=>({
  id:'c-1',status:'running',requested:3,concurrency:2,createdAt:ago(CAMPAIGN_TICK_LOST_MS*3),
  updatedAt:ago(CAMPAIGN_TICK_LOST_MS+30_000),finishedAt:null,dismissedAt:null,
  counts:{pending:1,running:1,complete:1,failed:0,skipped:0},items:[],failures:[],running:[],...overrides
});

describe('a campaign whose tick was lost',()=>{
  it('re-queues the tick when it has been silent for four intervals',async()=>{
    const queued:Array<Record<string,unknown>>=[];
    const stub=createD1Stub();
    const env={DB:stub.db,RESEARCH_QUEUE:{send:async(job:Record<string,unknown>)=>{queued.push(job)}} as unknown as Queue<unknown>};
    const revived=await reviveCampaignIfStalled(env,'owner',campaign());
    expect(queued).toEqual([{kind:'producer_campaign_tick',owner:'owner',campaignId:'c-1'}]);
    // The timestamp moves with it, so a page polling every few seconds cannot
    // queue a second tick before the next interval is up.
    expect(tickLooksLost({status:'running',updatedAt:revived!.updatedAt})).toBe(false);
  });

  it('leaves a ticking campaign and a finished one alone',async()=>{
    const queued:Array<Record<string,unknown>>=[];
    const stub=createD1Stub();
    const env={DB:stub.db,RESEARCH_QUEUE:{send:async(job:Record<string,unknown>)=>{queued.push(job)}} as unknown as Queue<unknown>};
    await reviveCampaignIfStalled(env,'owner',campaign({updatedAt:ago(20_000)}));
    await reviveCampaignIfStalled(env,'owner',campaign({status:'complete'}));
    await reviveCampaignIfStalled(env,'owner',null);
    expect(queued).toEqual([]);
    expect(stub.writes()).toEqual([]);
  });
});
