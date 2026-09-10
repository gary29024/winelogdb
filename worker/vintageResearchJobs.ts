import { vintageCacheKey,type VintageSubject,type VintageWindow } from '../src/lib/maturity/vintageWindow';
import type { VintageResearchStatus } from '../src/lib/maturity/vintageResearch';
import { researchVintageWindow,type VintageWindowBindings } from './vintageWindowHandler';

export type VintageResearchMessage={kind:'vintage_window';owner:string;requestId:string};
type Bindings=VintageWindowBindings&{RESEARCH_QUEUE?:Queue<VintageResearchMessage>};
type Row={id:string;status:VintageResearchStatus['status'];subject_json:string;result_json:string|null;error:string|null;updated_at:string};
const now=()=>new Date().toISOString();
// Much longer than the two model budgets combined. An abandoned job is failed
// on an explicit retry, never silently replayed as another paid model request.
const STALE_MS=10*60*1000;
const fields='id,status,subject_json,result_json,error,updated_at';
const status=(row:Row):VintageResearchStatus=>({id:row.id,status:row.status,
  window:row.result_json?JSON.parse(row.result_json) as VintageWindow:null,error:row.error});

export async function readVintageResearch(db:D1Database,owner:string,id:string){
  const row=await db.prepare(`SELECT ${fields} FROM vintage_research_jobs WHERE owner_id=? AND id=?`).bind(owner,id).first<Row>();
  return row?status(row):null;
}

export async function failVintageResearch(db:D1Database,owner:string,id:string,error:string){
  await db.prepare("UPDATE vintage_research_jobs SET status='failed',error=?,updated_at=? WHERE owner_id=? AND id=? AND status IN ('queued','running')")
    .bind(error.slice(0,700),now(),owner,id).run();
}

export async function queueVintageResearch(env:Bindings,owner:string,subject:VintageSubject){
  if(!env.RESEARCH_QUEUE)throw new Error('Vintage research is temporarily unavailable');
  const key=vintageCacheKey(subject),stamp=now(),id=crypto.randomUUID();
  await env.DB.prepare("UPDATE vintage_research_jobs SET status='failed',error='Previous lookup stopped. A new lookup was requested.',updated_at=? WHERE owner_id=? AND cache_key=? AND status IN ('queued','running') AND updated_at<?")
    .bind(stamp,owner,key,new Date(Date.now()-STALE_MS).toISOString()).run();
  // The partial unique index makes two tabs requesting the same cell share a job.
  const inserted=await env.DB.prepare("INSERT INTO vintage_research_jobs(id,owner_id,cache_key,subject_json,status,created_at,updated_at) VALUES(?,?,?,?,'queued',?,?) ON CONFLICT DO NOTHING")
    .bind(id,owner,key,JSON.stringify(subject),stamp,stamp).run();
  if(!Number(inserted.meta.changes)){
    const active=await env.DB.prepare(`SELECT ${fields} FROM vintage_research_jobs WHERE owner_id=? AND cache_key=? AND status IN ('queued','running')`)
      .bind(owner,key).first<Row>();
    if(active)return status(active);
    // A concurrent job just finished between the insert and read. The caller
    // can retry explicitly; do not create a second paid lookup here.
    throw new Error('Vintage research just changed. Please retry to load its result.');
  }
  try{await env.RESEARCH_QUEUE.send({kind:'vintage_window',owner,requestId:id})}
  catch(e){await failVintageResearch(env.DB,owner,id,'Could not queue vintage research. Please retry.');throw e}
  return {id,status:'queued',window:null,error:null} satisfies VintageResearchStatus;
}

export async function processVintageResearch(env:VintageWindowBindings,message:VintageResearchMessage){
  const {owner,requestId}=message;
  // A failed read can be retried by the queue before any model call is claimed.
  const row=await env.DB.prepare(`SELECT ${fields} FROM vintage_research_jobs WHERE owner_id=? AND id=?`).bind(owner,requestId).first<Row>();
  if(!row||row.status!=='queued')return;
  const claimed=await env.DB.prepare("UPDATE vintage_research_jobs SET status='running',updated_at=? WHERE owner_id=? AND id=? AND status='queued'")
    .bind(now(),owner,requestId).run();
  // Queue delivery is at least once. A redelivery must not buy another answer.
  if(!Number(claimed.meta.changes))return;
  try{
    const found=await researchVintageWindow(env,owner,JSON.parse(row.subject_json) as VintageSubject,requestId);
    if(!found)throw new Error('Could not load the saved vintage research');
    await env.DB.prepare("UPDATE vintage_research_jobs SET status='complete',result_json=?,error=NULL,updated_at=? WHERE owner_id=? AND id=? AND status='running'")
      .bind(JSON.stringify(found),now(),owner,requestId).run();
  }catch(e){
    const error=e instanceof Error?e.message:'Could not look up that vintage';
    console.error(JSON.stringify({event:'vintage-window-job-failed',requestId,error}));
    // researchVintageWindow already has its primary/escalation policy. Terminal
    // model failures are visible to the user, not retried as more paid lookups.
    await failVintageResearch(env.DB,owner,requestId,error);
  }
}
