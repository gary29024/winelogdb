import { Hono } from 'hono';
import app from './cuveeEntry';
import { requireSession } from '../src/lib/auth/session';
import { pollProducerBatchResearch,startProducerBatchResearch } from '../src/lib/producers/batchResearch';
import { createQueuedProducerResearchRun,getProducerResearchRun } from '../src/lib/producers/research';
import { activeCampaignId,advanceCampaign,cancelCampaign,countUnresearchedProducers,createCampaign,dismissCampaign,readCampaign,typicalProducerRunMs,unresearchedProducers,
  CAMPAIGN_CONCURRENCY,CAMPAIGN_MAX_PRODUCERS,CAMPAIGN_TICK_SECONDS,GEMINI_REQUESTS_PER_PRODUCER } from '../src/lib/producers/researchCampaign';
import { createWineResearchRun,getLatestWineResearchRun,getWineResearchRun,updateWineResearchRun } from '../src/lib/research/backgroundJobs';
import { getResearchBatchJob } from '../src/lib/research/batchJobStore';
import { pollWineBatchResearch,startWineBatchResearch } from '../src/lib/research/batchWineResearch';
import { cancelResearchRun,isResearchRunRunning,nextCancelSweepDelay,sweepCancelledResearch,type ResearchTargetKind } from '../src/lib/research/cancelResearch';
import { bypassPrimaryGeminiBatchOnce,clearPrimaryGeminiBatchBypass } from '../src/lib/research/geminiBatch';
import { markPrimaryResearchUnavailable,shouldBypassPrimaryResearch } from '../src/lib/research/modelHealth';
import { createBatchSession,getBatchImage,getBatchSession,listBatchSessions,markSessionSubmitted,processBatchCleanupJob,processBatchPollJob,processBatchSubmitJob,rejectBatchItem,removeBatchSession,stageBatchItem,type BatchRecognitionJob } from './batchRecognition';
import { attachConfirmedItemWithMetadata } from './batchPromotion';

type ProducerJob={kind:'producer';owner:string;producerId:string;requestId:string};
type ProducerBatchPollJob={kind:'producer_batch_poll';owner:string;producerId:string;requestId:string;jobId:string;pollCount:number};
type WineJob={kind:'wine';owner:string;wineId:string;requestId:string;refresh:'none'|'vintage'|'all'};
type WineBatchPollJob={kind:'wine_batch_poll';owner:string;wineId:string;requestId:string;jobId:string;pollCount:number};
type ProducerCampaignTickJob={kind:'producer_campaign_tick';owner:string;campaignId:string};
type CancelResearchSweepJob={kind:'research_cancel_sweep';owner:string;targetKind:ResearchTargetKind;targetId:string;requestId:string;pass:number};
type ResearchJob=ProducerJob|ProducerBatchPollJob|ProducerCampaignTickJob|WineJob|WineBatchPollJob|CancelResearchSweepJob|BatchRecognitionJob;
type Bindings={DB:D1Database;WINE_IMAGES:R2Bucket;ASSETS:Fetcher;GEMINI_API_KEY:string;AUTH_SECRET:string;APP_PASSWORD:string;APP_URL:string;MAX_FILE_BYTES?:string;MAX_BATCH_FILES?:string;RESEARCH_QUEUE:Queue<ResearchJob>};
type AppEnv={Bindings:Bindings};
const router=new Hono<AppEnv>();

function cors(c:{req:{header:(name:string)=>string|undefined};env:Bindings;header:(name:string,value:string)=>void}){const origin=c.req.header('Origin');if(origin&&origin===c.env.APP_URL){c.header('Access-Control-Allow-Origin',origin);c.header('Vary','Origin')}}
async function user(c:{req:{header:(name:string)=>string|undefined};env:Bindings}){return (await requireSession(c.req.header('Authorization'),c.env.AUTH_SECRET)).userId}

function mapProducerRun(row:Record<string,unknown>){return {requestId:String(row.request_id),producerId:String(row.producer_id),status:String(row.status),stage:String(row.stage),attempt:Number(row.attempt)||0,message:row.message?String(row.message):null,startedAt:String(row.started_at),updatedAt:String(row.updated_at),completedAt:row.completed_at?String(row.completed_at):null,durationMs:row.duration_ms==null?null:Number(row.duration_ms)}}
async function latestProducerRun(db:D1Database,owner:string,producerId:string){const row=await db.prepare(`SELECT request_id,producer_id,status,stage,attempt,message,started_at,updated_at,completed_at,duration_ms FROM producer_research_runs WHERE owner_id=? AND producer_id=? ORDER BY updated_at DESC LIMIT 1`).bind(owner,producerId).first<Record<string,unknown>>();return row?mapProducerRun(row):null}
async function failProducerQueue(db:D1Database,owner:string,requestId:string,message:string){const stamp=new Date().toISOString();await db.prepare(`UPDATE producer_research_runs SET status='failed',stage='failed',message=?,updated_at=?,completed_at=?,duration_ms=cast((julianday(?)-julianday(started_at))*86400000 as integer) WHERE owner_id=? AND request_id=?`).bind(message,stamp,stamp,stamp,owner,requestId).run().catch(()=>undefined)}
async function scheduleCancelSweep(env:Bindings,owner:string,targetKind:ResearchTargetKind,targetId:string,requestId:string){
  await env.RESEARCH_QUEUE.send({kind:'research_cancel_sweep',owner,targetKind,targetId,requestId,pass:0},{delaySeconds:5}).catch(e=>console.error(JSON.stringify({event:'research_cancel_sweep_schedule_failed',targetKind,targetId,requestId,error:(e as Error).message})))
}
async function preparePrimaryRouting(env:Bindings,owner:string,requestId:string){
  const bypass=await shouldBypassPrimaryResearch(env.DB,owner);if(bypass){bypassPrimaryGeminiBatchOnce(requestId);console.warn(JSON.stringify({event:'research_model_route',requestId,stage:'primary_cooldown',route:'gemini-3.6-flash'}))}return bypass;
}
async function noteFallbackUse(env:Bindings,owner:string,jobId:string,requestId:string,kind:'producer'|'wine',pollCount:number){
  if(pollCount!==0)return;const tracked=await getResearchBatchJob(env.DB,owner,jobId).catch(()=>null);if(!tracked||tracked.attempt!==2)return;
  if(!(await shouldBypassPrimaryResearch(env.DB,owner)))await markPrimaryResearchUnavailable(env.DB,owner,`${kind} research fell back from Gemini 3.7 to Gemini 3.6`);
  console.warn(JSON.stringify({event:'research_model_route',requestId,stage:'fallback_active',kind,route:'gemini-3.6-flash'}));
}
async function harvestProducerJobs(env:Bindings,owner:string,producerId:string,requestId:string,jobIds:string[]){
  for(const jobId of jobIds)await pollProducerBatchResearch(env,owner,producerId,requestId,jobId,0).catch(e=>console.error(JSON.stringify({event:'research_cancel_harvest_failed',kind:'producer',requestId,jobId,error:(e as Error).message})));
}
async function harvestWineJobs(env:Bindings,owner:string,wineId:string,requestId:string,jobIds:string[]){
  for(const jobId of jobIds)await pollWineBatchResearch(env,owner,wineId,requestId,jobId,0).catch(e=>console.error(JSON.stringify({event:'research_cancel_harvest_failed',kind:'wine',requestId,jobId,error:(e as Error).message})));
}

router.post('/api/producers/:id/research',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const body=await c.req.json().catch(()=>({})) as {confirmation?:string;requestId?:string};if(body.confirmation!=='RUN_PRODUCER_RESEARCH')return c.json({error:'Producer research requires explicit confirmation'},400);
  const queued=await createQueuedProducerResearchRun(c.env.DB,owner,c.req.param('id'),body.requestId);if(!queued)return c.json({error:'Producer not found'},404);
  if(queued.created){try{await c.env.RESEARCH_QUEUE.send({kind:'producer',owner,producerId:c.req.param('id'),requestId:queued.requestId})}catch(e){const error=(e as Error).message||'Could not queue producer research';await failProducerQueue(c.env.DB,owner,queued.requestId,error);return c.json({error,researchRequestId:queued.requestId},503)}}
  return c.json({accepted:true,researchRequestId:queued.requestId,existing:!queued.created},202);
});

// Batch producer research. The plan is shown before anything is queued: how
// many producers have never been researched, how many this run would take, and
// what that costs in grounded Gemini requests and wall-clock time.
router.get('/api/producers/research-batch/plan',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const requested=Number(c.req.query('limit')??0);
  const unresearched=await countUnresearchedProducers(c.env.DB,owner);
  const willRun=Math.max(0,Math.min(unresearched,CAMPAIGN_MAX_PRODUCERS,Number.isFinite(requested)&&requested>0?Math.floor(requested):unresearched));
  const perProducerMs=await typicalProducerRunMs(c.env.DB,owner);
  return c.json({
    unresearched,willRun,maxPerRun:CAMPAIGN_MAX_PRODUCERS,concurrency:CAMPAIGN_CONCURRENCY,
    geminiRequests:willRun*GEMINI_REQUESTS_PER_PRODUCER,
    perProducerMs,
    estimatedMs:perProducerMs==null?null:Math.round(perProducerMs*willRun/CAMPAIGN_CONCURRENCY),
    active:await activeCampaignId(c.env.DB,owner)
  });
});

router.get('/api/producers/research-batch',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  return c.json({campaign:await readCampaign(c.env.DB,owner)});
});

router.post('/api/producers/research-batch',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const body=await c.req.json().catch(()=>({})) as {confirmation?:string;limit?:number};
  if(body.confirmation!=='RUN_PRODUCER_RESEARCH_BATCH')return c.json({error:'Batch producer research requires explicit confirmation'},400);
  if(await activeCampaignId(c.env.DB,owner))return c.json({error:'A batch producer research run is already in progress'},409);
  const producers=await unresearchedProducers(c.env.DB,owner,Number(body.limit)||CAMPAIGN_MAX_PRODUCERS);
  if(!producers.length)return c.json({error:'Every producer has been researched already'},400);
  const campaignId=await createCampaign(c.env,owner,producers);
  if(!campaignId)return c.json({error:'Could not start the batch'},500);
  try{await c.env.RESEARCH_QUEUE.send({kind:'producer_campaign_tick',owner,campaignId})}
  catch(e){await cancelCampaign(c.env.DB,owner,campaignId);return c.json({error:(e as Error).message||'Could not queue the batch'},503)}
  return c.json({accepted:true,campaign:await readCampaign(c.env.DB,owner,campaignId)},202);
});

router.post('/api/producers/research-batch/:id/cancel',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  await cancelCampaign(c.env.DB,owner,c.req.param('id'));
  return c.json({campaign:await readCampaign(c.env.DB,owner,c.req.param('id'))});
});

router.post('/api/producers/research-batch/:id/dismiss',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  await dismissCampaign(c.env.DB,owner,c.req.param('id'));
  return c.json({campaign:await readCampaign(c.env.DB,owner,c.req.param('id'))});
});

router.get('/api/producers/:id/research-status',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const requestId=(c.req.query('requestId')||'').trim();try{const run=requestId?await getProducerResearchRun(c.env.DB,owner,c.req.param('id'),requestId):await latestProducerRun(c.env.DB,owner,c.req.param('id'));return run?c.json(run):c.json({error:'Research run not found'},404)}catch(e){return c.json({error:(e as Error).message||'Could not load research status'},500)}
});

router.post('/api/producers/:id/research-cancel',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const body=await c.req.json().catch(()=>({})) as {confirmation?:string;requestId?:string},requestId=String(body.requestId||'').trim(),producerId=c.req.param('id');
  if(body.confirmation!=='CANCEL_PRODUCER_RESEARCH'||!requestId)return c.json({error:'Producer research cancellation requires the active request ID'},400);
  const result=await cancelResearchRun(c.env,owner,'producer',producerId,requestId);
  if(result.status===200&&result.body.harvestJobIds.length)await harvestProducerJobs(c.env,owner,producerId,requestId,result.body.harvestJobIds);
  if(result.status===200&&result.body.cancelled)void scheduleCancelSweep(c.env,owner,'producer',producerId,requestId);
  return c.json(result.body,result.status);
});

router.post('/api/wines/:id/deep-search',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const body=await c.req.json().catch(()=>({})) as {confirmation?:string;refresh?:'none'|'vintage'|'all';requestId?:string};if(body.confirmation!=='RUN_DEEP_SEARCH')return c.json({error:'Deep Search requires explicit confirmation'},400);
  const refresh=body.refresh==='all'||body.refresh==='vintage'?body.refresh:'none',queued=await createWineResearchRun(c.env.DB,owner,c.req.param('id'),refresh,body.requestId);if(!queued)return c.json({error:'Wine not found'},404);
  if(queued.created){try{await c.env.RESEARCH_QUEUE.send({kind:'wine',owner,wineId:c.req.param('id'),requestId:queued.run.requestId,refresh})}catch(e){const error=(e as Error).message||'Could not queue Deep Search';await updateWineResearchRun(c.env.DB,owner,queued.run.requestId,'failed',error,'failed');return c.json({error,researchRequestId:queued.run.requestId},503)}}
  return c.json({accepted:true,researchRequestId:queued.run.requestId,existing:!queued.created},202);
});

router.get('/api/wines/:id/deep-search-status',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const requestId=(c.req.query('requestId')||'').trim();try{const run=requestId?await getWineResearchRun(c.env.DB,owner,c.req.param('id'),requestId):await getLatestWineResearchRun(c.env.DB,owner,c.req.param('id'));return run?c.json(run):c.json({error:'Research run not found'},404)}catch(e){return c.json({error:(e as Error).message||'Could not load Deep Search status'},500)}
});

router.post('/api/wines/:id/deep-search-cancel',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const body=await c.req.json().catch(()=>({})) as {confirmation?:string;requestId?:string},requestId=String(body.requestId||'').trim(),wineId=c.req.param('id');
  if(body.confirmation!=='CANCEL_DEEP_SEARCH'||!requestId)return c.json({error:'Deep Search cancellation requires the active request ID'},400);
  const result=await cancelResearchRun(c.env,owner,'wine',wineId,requestId);
  if(result.status===200&&result.body.harvestJobIds.length)await harvestWineJobs(c.env,owner,wineId,requestId,result.body.harvestJobIds);
  if(result.status===200&&result.body.cancelled)void scheduleCancelSweep(c.env,owner,'wine',wineId,requestId);
  return c.json(result.body,result.status);
});

router.get('/api/batch-recognition/sessions',async c=>{cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}return c.json(await listBatchSessions(c.env.DB,owner))});
router.post('/api/batch-recognition/sessions',async c=>{cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}const body=await c.req.json().catch(()=>({})) as {expectedItems?:unknown},expectedItems=Math.floor(Number(body.expectedItems)||0);if(expectedItems<2||expectedItems>500)return c.json({error:'Batch Scan requires 2–500 wines'},400);const session=await createBatchSession(c.env.DB,owner,expectedItems);c.env.RESEARCH_QUEUE.send({kind:'recognition_batch_cleanup',owner,sessionId:session.id},{delaySeconds:86400}).catch(e=>console.error(JSON.stringify({event:'batch-recognition-cleanup-schedule-failed',sessionId:session.id,error:(e as Error).message})));return c.json(session,201)});
router.get('/api/batch-recognition/sessions/:id',async c=>{cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}const session=await getBatchSession(c.env.DB,owner,c.req.param('id'));return session?c.json(session):c.json({error:'Batch session not found'},404)});
router.delete('/api/batch-recognition/sessions/:id',async c=>{cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}const result=await removeBatchSession(c.env,owner,c.req.param('id'));return c.json(result.body,result.status)});
router.get('/api/batch-recognition/images/:id',async c=>{cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}const image=await getBatchImage(c.env,owner,c.req.param('id'));return image??c.json({error:'Image not found'},404)});

router.post('/api/batch-recognition/sessions/:id/items',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const form=await c.req.formData().catch(()=>null);if(!form)return c.json({error:'Could not read staged wine photos'},400);
  const result=await stageBatchItem(c.env,owner,c.req.param('id'),form);return c.json(result.body,result.status);
});

router.post('/api/batch-recognition/sessions/:id/submit',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}const sessionId=c.req.param('id'),marked=await markSessionSubmitted(c.env.DB,owner,sessionId);if(!marked.ok)return c.json({error:marked.error},409);
  try{await c.env.RESEARCH_QUEUE.send({kind:'recognition_batch_submit',owner,sessionId});return c.json({accepted:true,sessionId},202)}catch(e){await c.env.DB.prepare("UPDATE batch_recognition_sessions SET status='failed',updated_at=? WHERE id=? AND owner_id=?").bind(new Date().toISOString(),sessionId,owner).run();return c.json({error:(e as Error).message||'Could not queue batch recognition'},503)}
});

router.post('/api/batch-recognition/sessions/:sessionId/items/:itemId/confirm',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const body=await c.req.json().catch(()=>null) as {wine?:unknown}|null;if(!body?.wine)return c.json({error:'Wine data is required'},400);
  const headers=new Headers({'Content-Type':'application/json'});const authorization=c.req.header('Authorization');if(authorization)headers.set('Authorization',authorization);
  const createRequest=new Request(new URL('/api/wines',c.req.url),{method:'POST',headers,body:JSON.stringify(body.wine)}),created=await app.fetch(createRequest,c.env,c.executionCtx);
  if(!created.ok)return new Response(created.body,{status:created.status,headers:created.headers});
  const result=await created.json() as {id?:string};if(!result.id)return c.json({error:'Wine save did not return an ID'},500);
  try{await attachConfirmedItemWithMetadata(c.env,owner,c.req.param('sessionId'),c.req.param('itemId'),result.id);return c.json({id:result.id})}catch(e){const rollback=new Request(new URL(`/api/wines/${result.id}`,c.req.url),{method:'DELETE',headers:new Headers(authorization?{Authorization:authorization}:undefined)});await Promise.resolve(app.fetch(rollback,c.env,c.executionCtx)).catch(()=>undefined);return c.json({error:(e as Error).message||'Could not attach staged photos'},500)}
});

router.post('/api/batch-recognition/sessions/:sessionId/items/:itemId/reject',async c=>{cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}await rejectBatchItem(c.env,owner,c.req.param('sessionId'),c.req.param('itemId'));return c.json({ok:true})});

router.all('*',c=>app.fetch(c.req.raw,c.env,c.executionCtx));

async function consume(batch:MessageBatch<ResearchJob>,env:Bindings){
  for(const message of batch.messages){const job=message.body;try{
    console.log(JSON.stringify({event:'research_queue',stage:'start',kind:job.kind,...('requestId' in job?{requestId:job.requestId}:'sessionId' in job?{sessionId:job.sessionId}:{campaignId:job.campaignId})}));
    if(job.kind==='producer'){
      if(!(await isResearchRunRunning(env.DB,job.owner,'producer',job.producerId,job.requestId)))console.log(JSON.stringify({event:'research_queue',stage:'cancelled_before_submit',kind:job.kind,requestId:job.requestId}));
      else{await preparePrimaryRouting(env,job.owner,job.requestId);try{const result=await startProducerBatchResearch(env,job.owner,job.producerId,job.requestId);console.log(JSON.stringify({event:'research_queue',stage:result.ok?'batch_submitted':'failed',kind:job.kind,requestId:job.requestId,...(!result.ok?{error:result.error}:{})}))}finally{clearPrimaryGeminiBatchBypass(job.requestId)}}
    }
    else if(job.kind==='producer_campaign_tick'){
      const progress=await advanceCampaign(env,job.owner,job.campaignId);
      console.log(JSON.stringify({event:'research_queue',stage:progress.done?'campaign_complete':'campaign_tick',kind:job.kind,campaignId:job.campaignId,...progress}));
      if(!progress.done)await env.RESEARCH_QUEUE.send(job,{delaySeconds:CAMPAIGN_TICK_SECONDS});
    }
    else if(job.kind==='producer_batch_poll'){await noteFallbackUse(env,job.owner,job.jobId,job.requestId,'producer',job.pollCount);await pollProducerBatchResearch(env,job.owner,job.producerId,job.requestId,job.jobId,job.pollCount)}
    else if(job.kind==='wine'){
      if(!(await isResearchRunRunning(env.DB,job.owner,'wine',job.wineId,job.requestId)))console.log(JSON.stringify({event:'research_queue',stage:'cancelled_before_submit',kind:job.kind,requestId:job.requestId}));
      else{await preparePrimaryRouting(env,job.owner,job.requestId);try{const result=await startWineBatchResearch(env,job.owner,job.wineId,job.requestId,job.refresh);console.log(JSON.stringify({event:'research_queue',stage:result.ok?(result.cached?'cache_complete':'batch_submitted'):'failed',kind:job.kind,requestId:job.requestId,...(!result.ok?{error:result.error}:{})}))}finally{clearPrimaryGeminiBatchBypass(job.requestId)}}
    }
    else if(job.kind==='wine_batch_poll'){await noteFallbackUse(env,job.owner,job.jobId,job.requestId,'wine',job.pollCount);await pollWineBatchResearch(env,job.owner,job.wineId,job.requestId,job.jobId,job.pollCount)}
    else if(job.kind==='research_cancel_sweep'){
      const swept=await sweepCancelledResearch(env,job.owner,job.targetKind,job.targetId,job.requestId);
      if(swept.harvestJobIds.length){if(job.targetKind==='producer')await harvestProducerJobs(env,job.owner,job.targetId,job.requestId,swept.harvestJobIds);else await harvestWineJobs(env,job.owner,job.targetId,job.requestId,swept.harvestJobIds)}
      const delay=nextCancelSweepDelay(job.pass);if(delay!=null)await env.RESEARCH_QUEUE.send({...job,pass:job.pass+1},{delaySeconds:delay});
    }
    else if(job.kind==='recognition_batch_submit')await processBatchSubmitJob(env,job.owner,job.sessionId);
    else if(job.kind==='recognition_batch_poll')await processBatchPollJob(env,job.owner,job.sessionId,job.jobId,job.pollCount);
    else if(job.kind==='recognition_batch_cleanup')await processBatchCleanupJob(env,job.owner,job.sessionId);
    message.ack();
  }catch(e){console.error(JSON.stringify({event:'research_queue',stage:'consumer_error',kind:job.kind,error:(e as Error).message||String(e)}));message.retry()}}
}

export default {fetch(request:Request,env:Bindings,ctx:ExecutionContext){return router.fetch(request,env,ctx)},queue(batch:MessageBatch<ResearchJob>,env:Bindings){return consume(batch,env)}};
