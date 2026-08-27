import { createQueuedProducerResearchRun } from './research';

/**
 * Batch producer research.
 *
 * One producer's research is already a queued job that submits a Gemini batch
 * of six grounded requests (a profile plus five catalogue slices) and polls it
 * to completion. What does not scale is doing that one click at a time across
 * a library of hundreds.
 *
 * A campaign is a list of producers plus a tick. The tick reconciles what has
 * finished, starts enough producers to keep `concurrency` of them in flight,
 * and re-queues itself until the list is done - so the whole library is never
 * submitted at once, and closing the app does not stop it.
 */
export const CAMPAIGN_CONCURRENCY=2;
export const CAMPAIGN_TICK_SECONDS=30;
export const CAMPAIGN_MAX_PRODUCERS=200;
/**
 * How long a producer may hold a lane without its run saying anything.
 *
 * A healthy run touches producer_research_runs on every poll, and the widest
 * poll gap in the retry policy is fifteen minutes, so three times that is well
 * clear of a slow Gemini batch. Past it the run is not slow, it is gone - a
 * queue message that never arrived - and without this the campaign would tick
 * every thirty seconds forever waiting for a status that will never change.
 */
export const CAMPAIGN_STALE_RUN_MS=45*60*1000;
/**
 * A profile request plus one whole-range catalogue request. A range that does
 * not fit one answer is split and re-asked, so this is the floor rather than a
 * promise.
 */
export const GEMINI_REQUESTS_PER_PRODUCER=2;
/**
 * Searches per grounded request when this library has never measured any.
 *
 * Grounding is billed per search the model runs, not per request. Measured on
 * this app's own traffic before the prompts asked it to search sparingly, a
 * request averaged around seven; the estimate prefers the owner's own recent
 * numbers and only falls back to this.
 */
export const ASSUMED_SEARCHES_PER_REQUEST=4;

export type CampaignItemStatus='pending'|'running'|'complete'|'failed'|'skipped';
export type CampaignItem={producerId:string;producerName:string;status:CampaignItemStatus;message:string|null};
export type Campaign={
  id:string;status:'running'|'complete'|'cancelled';requested:number;concurrency:number;
  createdAt:string;updatedAt:string;finishedAt:string|null;dismissedAt:string|null;
  counts:Record<CampaignItemStatus,number>;
  /** Every producer in the run, so a finished run can show what it did, not only what it could not do. */
  items:CampaignItem[];
  failures:CampaignItem[];
  running:CampaignItem[];
};
/** A past run as it appears in the list of runs: counts, not producers. */
export type CampaignSummary={
  id:string;status:'running'|'complete'|'cancelled';requested:number;
  createdAt:string;finishedAt:string|null;counts:Record<CampaignItemStatus,number>;
};
export type CampaignEnv={DB:D1Database;RESEARCH_QUEUE:Queue<unknown>};

const now=()=>new Date().toISOString();
const emptyCounts=():Record<CampaignItemStatus,number>=>({pending:0,running:0,complete:0,failed:0,skipped:0});

/** Producers that have never completed a research run, oldest additions first. */
export async function unresearchedProducers(db:D1Database,owner:string,limit:number){
  const capped=Math.max(1,Math.min(CAMPAIGN_MAX_PRODUCERS,Math.floor(limit)||0));
  const {results}=await db.prepare(
    `SELECT id,canonical_name FROM producers WHERE owner_id=? AND researched_at IS NULL ORDER BY canonical_name COLLATE NOCASE LIMIT ?`
  ).bind(owner,capped).all<{id:string;canonical_name:string}>();
  return (results??[]).map(row=>({id:row.id,name:row.canonical_name}));
}

export async function countUnresearchedProducers(db:D1Database,owner:string){
  const row=await db.prepare(`SELECT COUNT(*) AS n FROM producers WHERE owner_id=? AND researched_at IS NULL`)
    .bind(owner).first<{n:number}>();
  return Number(row?.n??0);
}

/**
 * How long one producer takes, from this owner's own completed runs. A median
 * rather than a mean: a single stalled run that retried for an hour should not
 * set the expectation for the next twenty.
 */
export async function typicalProducerRunMs(db:D1Database,owner:string){
  const {results}=await db.prepare(
    `SELECT duration_ms FROM producer_research_runs WHERE owner_id=? AND status='complete' AND duration_ms IS NOT NULL
     ORDER BY updated_at DESC LIMIT 25`
  ).bind(owner).all<{duration_ms:number}>();
  const values=(results??[]).map(row=>Number(row.duration_ms)).filter(value=>Number.isFinite(value)&&value>0).sort((a,b)=>a-b);
  if(!values.length)return null;
  return values[Math.floor(values.length/2)];
}

/**
 * Searches per grounded request, from this owner's own completed submissions.
 * Only jobs that recorded a count are considered - a zero means the column
 * predates the metering, not that nothing was searched.
 */
export async function measuredSearchesPerRequest(db:D1Database,owner:string){
  const row=await db.prepare(
    `SELECT SUM(search_queries) AS searches, SUM(json_array_length(keys_json)) AS requests
     FROM research_batch_jobs WHERE owner_id=? AND search_queries>0 AND created_at>datetime('now','-30 days')`
  ).bind(owner).first<{searches:number|null;requests:number|null}>();
  const searches=Number(row?.searches??0),requests=Number(row?.requests??0);
  return requests>0&&searches>0?searches/requests:null;
}

export async function activeCampaignId(db:D1Database,owner:string){
  const row=await db.prepare(`SELECT id FROM producer_research_campaigns WHERE owner_id=? AND status='running' ORDER BY created_at DESC LIMIT 1`)
    .bind(owner).first<{id:string}>();
  return row?.id??null;
}

export async function createCampaign(env:CampaignEnv,owner:string,producers:Array<{id:string;name:string}>){
  if(!producers.length)return null;
  const id=crypto.randomUUID(),stamp=now();
  await env.DB.prepare(
    `INSERT INTO producer_research_campaigns(id,owner_id,status,requested,concurrency,created_at,updated_at,finished_at,dismissed_at)
     VALUES(?,?,'running',?,?,?,?,NULL,NULL)`
  ).bind(id,owner,producers.length,CAMPAIGN_CONCURRENCY,stamp,stamp).run();
  await env.DB.batch(producers.map(producer=>env.DB.prepare(
    `INSERT INTO producer_research_campaign_items(campaign_id,producer_id,producer_name,request_id,status,message,updated_at)
     VALUES(?,?,?,NULL,'pending',NULL,?)`
  ).bind(id,producer.id,producer.name,stamp)));
  return id;
}

async function readItems(db:D1Database,campaignId:string){
  const {results}=await db.prepare(
    `SELECT producer_id,producer_name,request_id,status,message FROM producer_research_campaign_items WHERE campaign_id=? ORDER BY producer_name COLLATE NOCASE`
  ).bind(campaignId).all<{producer_id:string;producer_name:string;request_id:string|null;status:CampaignItemStatus;message:string|null}>();
  return results??[];
}

export async function readCampaign(db:D1Database,owner:string,campaignId?:string):Promise<Campaign|null>{
  const head=campaignId
    ?await db.prepare(`SELECT * FROM producer_research_campaigns WHERE owner_id=? AND id=?`).bind(owner,campaignId).first<Record<string,unknown>>()
    :await db.prepare(`SELECT * FROM producer_research_campaigns WHERE owner_id=? ORDER BY created_at DESC LIMIT 1`).bind(owner).first<Record<string,unknown>>();
  if(!head)return null;
  const items=await readItems(db,String(head.id));
  const counts=emptyCounts();
  for(const item of items)counts[item.status]=(counts[item.status]??0)+1;
  const shape=(item:typeof items[number]):CampaignItem=>({producerId:item.producer_id,producerName:item.producer_name,status:item.status,message:item.message});
  const shaped=items.map(shape);
  return {
    id:String(head.id),status:head.status as Campaign['status'],requested:Number(head.requested),concurrency:Number(head.concurrency),
    createdAt:String(head.created_at),updatedAt:String(head.updated_at),
    finishedAt:head.finished_at?String(head.finished_at):null,dismissedAt:head.dismissed_at?String(head.dismissed_at):null,
    counts,
    items:shaped,
    failures:shaped.filter(item=>item.status==='failed'),
    running:shaped.filter(item=>item.status==='running')
  };
}

/**
 * Recent runs, newest first. Counts are aggregated in SQL rather than by
 * reading every run's producers: the list says how each run went, and only the
 * run someone opens needs its producers.
 */
export async function listCampaigns(db:D1Database,owner:string,limit=10):Promise<CampaignSummary[]>{
  const capped=Math.max(1,Math.min(50,Math.floor(limit)||10));
  const {results}=await db.prepare(
    `SELECT c.id,c.status,c.requested,c.created_at,c.finished_at,
       SUM(CASE WHEN i.status='complete' THEN 1 ELSE 0 END) AS complete,
       SUM(CASE WHEN i.status='failed' THEN 1 ELSE 0 END) AS failed,
       SUM(CASE WHEN i.status='skipped' THEN 1 ELSE 0 END) AS skipped,
       SUM(CASE WHEN i.status='running' THEN 1 ELSE 0 END) AS running,
       SUM(CASE WHEN i.status='pending' THEN 1 ELSE 0 END) AS pending
     FROM producer_research_campaigns c
     LEFT JOIN producer_research_campaign_items i ON i.campaign_id=c.id
     WHERE c.owner_id=? GROUP BY c.id ORDER BY c.created_at DESC LIMIT ?`
  ).bind(owner,capped).all<Record<string,unknown>>();
  return (results??[]).map(row=>({
    id:String(row.id),status:row.status as CampaignSummary['status'],requested:Number(row.requested),
    createdAt:String(row.created_at),finishedAt:row.finished_at?String(row.finished_at):null,
    counts:{
      pending:Number(row.pending??0),running:Number(row.running??0),complete:Number(row.complete??0),
      failed:Number(row.failed??0),skipped:Number(row.skipped??0)
    }
  }));
}

/**
 * One pass of the campaign: settle what finished, start what fits, and say
 * whether another tick is needed.
 *
 * Everything it needs is in the database, so a tick that is delivered twice or
 * out of order costs nothing - it re-reads the same state and reaches the same
 * conclusion.
 */
export async function advanceCampaign(env:CampaignEnv,owner:string,campaignId:string){
  const head=await env.DB.prepare(`SELECT status FROM producer_research_campaigns WHERE owner_id=? AND id=?`)
    .bind(owner,campaignId).first<{status:string}>();
  if(!head||head.status!=='running')return {done:true,started:0,running:0,pending:0};

  const items=await readItems(env.DB,campaignId);
  const stamp=now();

  // Settle anything that has reached a terminal state in producer_research_runs.
  for(const item of items.filter(row=>row.status==='running'&&row.request_id)){
    const run=await env.DB.prepare(
      `SELECT status,message,updated_at FROM producer_research_runs WHERE owner_id=? AND request_id=?`
    ).bind(owner,item.request_id).first<{status:string;message:string|null;updated_at:string}>();
    if(!run){
      await setItem(env.DB,campaignId,item.producer_id,'failed','The research run disappeared before it finished.',stamp);
      item.status='failed';continue;
    }
    if(run.status==='running'){
      const last=Date.parse(run.updated_at??'');
      if(Number.isFinite(last)&&Date.now()-last>CAMPAIGN_STALE_RUN_MS){
        await setItem(env.DB,campaignId,item.producer_id,'failed',
          'The research run stopped reporting, so the batch moved on. Research this producer on its own to see what happened.',stamp);
        item.status='failed';
      }
      continue;
    }
    const status:CampaignItemStatus=run.status==='complete'?'complete':'failed';
    await setItem(env.DB,campaignId,item.producer_id,status,run.message,stamp);
    item.status=status;
  }

  // Start enough to fill the lane.
  let running=items.filter(item=>item.status==='running').length;
  let started=0;
  for(const item of items.filter(row=>row.status==='pending')){
    if(running>=CAMPAIGN_CONCURRENCY)break;
    const queued=await createQueuedProducerResearchRun(env.DB,owner,item.producer_id);
    if(!queued){
      await setItem(env.DB,campaignId,item.producer_id,'skipped','The producer was removed before its turn came.',stamp);
      item.status='skipped';continue;
    }
    try{
      if(queued.created)await env.RESEARCH_QUEUE.send({kind:'producer',owner,producerId:item.producer_id,requestId:queued.requestId});
      await env.DB.prepare(`UPDATE producer_research_campaign_items SET status='running',request_id=?,message=NULL,updated_at=? WHERE campaign_id=? AND producer_id=?`)
        .bind(queued.requestId,stamp,campaignId,item.producer_id).run();
      item.status='running';running++;started++;
    }catch(e){
      await setItem(env.DB,campaignId,item.producer_id,'failed',(e as Error).message||'Could not queue this producer.',stamp);
      item.status='failed';
    }
  }

  const pending=items.filter(item=>item.status==='pending').length;
  const done=running===0&&pending===0;
  if(done){
    const failed=items.some(item=>item.status==='failed');
    // A clean run has nothing to tell anyone, so it closes itself. One with
    // failures stays until it has been read.
    await env.DB.prepare(`UPDATE producer_research_campaigns SET status='complete',updated_at=?,finished_at=?,dismissed_at=? WHERE owner_id=? AND id=?`)
      .bind(stamp,stamp,failed?null:stamp,owner,campaignId).run();
  }else{
    await env.DB.prepare(`UPDATE producer_research_campaigns SET updated_at=? WHERE owner_id=? AND id=?`).bind(stamp,owner,campaignId).run();
  }
  return {done,started,running,pending};
}

async function setItem(db:D1Database,campaignId:string,producerId:string,status:CampaignItemStatus,message:string|null,stamp:string){
  await db.prepare(`UPDATE producer_research_campaign_items SET status=?,message=?,updated_at=? WHERE campaign_id=? AND producer_id=?`)
    .bind(status,message,stamp,campaignId,producerId).run();
}

/** Stops starting new producers. Anything already submitted is left to finish. */
export async function cancelCampaign(db:D1Database,owner:string,campaignId:string){
  const stamp=now();
  await db.prepare(`UPDATE producer_research_campaign_items SET status='skipped',message='Cancelled before it started.',updated_at=? WHERE campaign_id=? AND status='pending'`)
    .bind(stamp,campaignId).run();
  await db.prepare(`UPDATE producer_research_campaigns SET status='cancelled',updated_at=?,finished_at=? WHERE owner_id=? AND id=? AND status='running'`)
    .bind(stamp,stamp,owner,campaignId).run();
}

export async function dismissCampaign(db:D1Database,owner:string,campaignId:string){
  await db.prepare(`UPDATE producer_research_campaigns SET dismissed_at=?,updated_at=? WHERE owner_id=? AND id=?`)
    .bind(now(),now(),owner,campaignId).run();
}
