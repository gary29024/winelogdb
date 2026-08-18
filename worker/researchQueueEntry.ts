import { Hono } from 'hono';
import app from './cuveeEntry';
import { requireSession } from '../src/lib/auth/session';
import { createQueuedProducerResearchRun,processProducerResearchJob } from '../src/lib/producers/backgroundResearch';
import { getProducerResearchRun } from '../src/lib/producers/research';
import { createWineResearchRun,getLatestWineResearchRun,getWineResearchRun,processWineResearchJob,updateWineResearchRun } from '../src/lib/research/backgroundJobs';

type ProducerJob={kind:'producer';owner:string;producerId:string;requestId:string};
type WineJob={kind:'wine';owner:string;wineId:string;requestId:string;refresh:'none'|'vintage'|'all'};
type ResearchJob=ProducerJob|WineJob;
type Bindings={DB:D1Database;WINE_IMAGES:R2Bucket;ASSETS:Fetcher;GEMINI_API_KEY:string;AUTH_SECRET:string;APP_PASSWORD:string;APP_URL:string;MAX_FILE_BYTES?:string;MAX_BATCH_FILES?:string;RESEARCH_QUEUE:Queue<ResearchJob>};
type AppEnv={Bindings:Bindings};
const router=new Hono<AppEnv>();

function cors(c:{req:{header:(name:string)=>string|undefined};env:Bindings;header:(name:string,value:string)=>void}){const origin=c.req.header('Origin');if(origin&&origin===c.env.APP_URL){c.header('Access-Control-Allow-Origin',origin);c.header('Vary','Origin')}}
async function user(c:{req:{header:(name:string)=>string|undefined};env:Bindings}){return (await requireSession(c.req.header('Authorization'),c.env.AUTH_SECRET)).userId}

function mapProducerRun(row:Record<string,unknown>){return {requestId:String(row.request_id),producerId:String(row.producer_id),status:String(row.status),stage:String(row.stage),attempt:Number(row.attempt)||0,message:row.message?String(row.message):null,startedAt:String(row.started_at),updatedAt:String(row.updated_at),completedAt:row.completed_at?String(row.completed_at):null,durationMs:row.duration_ms==null?null:Number(row.duration_ms)}}
async function latestProducerRun(db:D1Database,owner:string,producerId:string){const row=await db.prepare(`SELECT request_id,producer_id,status,stage,attempt,message,started_at,updated_at,completed_at,duration_ms FROM producer_research_runs WHERE owner_id=? AND producer_id=? ORDER BY updated_at DESC LIMIT 1`).bind(owner,producerId).first<Record<string,unknown>>();return row?mapProducerRun(row):null}
async function failProducerQueue(db:D1Database,owner:string,requestId:string,message:string){const stamp=new Date().toISOString();await db.prepare(`UPDATE producer_research_runs SET status='failed',stage='failed',message=?,updated_at=?,completed_at=?,duration_ms=cast((julianday(?)-julianday(started_at))*86400000 as integer) WHERE owner_id=? AND request_id=?`).bind(message,stamp,stamp,stamp,owner,requestId).run().catch(()=>undefined)}

router.post('/api/producers/:id/research',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const body=await c.req.json().catch(()=>({})) as {confirmation?:string;requestId?:string};if(body.confirmation!=='RUN_PRODUCER_RESEARCH')return c.json({error:'Producer research requires explicit confirmation'},400);
  const queued=await createQueuedProducerResearchRun(c.env.DB,owner,c.req.param('id'),body.requestId);if(!queued)return c.json({error:'Producer not found'},404);
  if(queued.created){
    try{await c.env.RESEARCH_QUEUE.send({kind:'producer',owner,producerId:c.req.param('id'),requestId:queued.requestId})}
    catch(e){const error=(e as Error).message||'Could not queue producer research';await failProducerQueue(c.env.DB,owner,queued.requestId,error);return c.json({error,researchRequestId:queued.requestId},503)}
  }
  return c.json({accepted:true,researchRequestId:queued.requestId,existing:!queued.created},202);
});

router.get('/api/producers/:id/research-status',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const requestId=(c.req.query('requestId')||'').trim();
  try{const run=requestId?await getProducerResearchRun(c.env.DB,owner,c.req.param('id'),requestId):await latestProducerRun(c.env.DB,owner,c.req.param('id'));return run?c.json(run):c.json({error:'Research run not found'},404)}catch(e){return c.json({error:(e as Error).message||'Could not load research status'},500)}
});

router.post('/api/wines/:id/deep-search',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const body=await c.req.json().catch(()=>({})) as {confirmation?:string;refresh?:'none'|'vintage'|'all';requestId?:string};if(body.confirmation!=='RUN_DEEP_SEARCH')return c.json({error:'Deep Search requires explicit confirmation'},400);
  const refresh=body.refresh==='all'||body.refresh==='vintage'?body.refresh:'none',queued=await createWineResearchRun(c.env.DB,owner,c.req.param('id'),refresh,body.requestId);if(!queued)return c.json({error:'Wine not found'},404);
  if(queued.created){
    try{await c.env.RESEARCH_QUEUE.send({kind:'wine',owner,wineId:c.req.param('id'),requestId:queued.run.requestId,refresh})}
    catch(e){const error=(e as Error).message||'Could not queue Deep Search';await updateWineResearchRun(c.env.DB,owner,queued.run.requestId,'failed',error,'failed');return c.json({error,researchRequestId:queued.run.requestId},503)}
  }
  return c.json({accepted:true,researchRequestId:queued.run.requestId,existing:!queued.created},202);
});

router.get('/api/wines/:id/deep-search-status',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const requestId=(c.req.query('requestId')||'').trim();
  try{const run=requestId?await getWineResearchRun(c.env.DB,owner,c.req.param('id'),requestId):await getLatestWineResearchRun(c.env.DB,owner,c.req.param('id'));return run?c.json(run):c.json({error:'Research run not found'},404)}catch(e){return c.json({error:(e as Error).message||'Could not load Deep Search status'},500)}
});

router.all('*',c=>app.fetch(c.req.raw,c.env,c.executionCtx));

async function consume(batch:MessageBatch<ResearchJob>,env:Bindings){
  for(const message of batch.messages){
    const job=message.body;
    try{
      console.log(JSON.stringify({event:'research_queue',stage:'start',kind:job.kind,requestId:job.requestId}));
      const result=job.kind==='producer'?await processProducerResearchJob(env,job.owner,job.producerId,job.requestId):await processWineResearchJob(env,job.owner,job.wineId,job.requestId,job.refresh);
      console.log(JSON.stringify({event:'research_queue',stage:result.ok?'complete':'failed',kind:job.kind,requestId:job.requestId,...(!result.ok?{error:result.error}:{})}));
      message.ack();
    }catch(e){console.error(JSON.stringify({event:'research_queue',stage:'consumer_error',kind:job.kind,requestId:job.requestId,error:(e as Error).message||String(e)}));message.retry()}
  }
}

export default {
  fetch(request:Request,env:Bindings,ctx:ExecutionContext){return router.fetch(request,env,ctx)},
  queue(batch:MessageBatch<ResearchJob>,env:Bindings){return consume(batch,env)}
};
