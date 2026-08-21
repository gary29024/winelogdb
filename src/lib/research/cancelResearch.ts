import { discardProducerCatalogStage } from '../producers/catalogResearchStage';
import { fetchGeminiBatch } from './geminiBatch';

export type ResearchTargetKind='producer'|'wine';

type Env={DB:D1Database;GEMINI_API_KEY:string};
type BatchRow={id:string;google_batch_name:string;status:string;error:string|null};

const CANCEL_MESSAGE='Cancelled by user';
const CANCEL_TIMEOUT_MS=8_000;
const now=()=>new Date().toISOString();

const targetConfig={
  producer:{table:'producer_research_runs',targetColumn:'producer_id'},
  wine:{table:'wine_research_runs',targetColumn:'wine_id'}
} as const;

export function geminiBatchCancelUrl(name:string){
  if(!/^batches\/[A-Za-z0-9._~-]+$/.test(name))throw new Error('Invalid Gemini batch name');
  return `https://generativelanguage.googleapis.com/v1beta/${name}:cancel`;
}

export function nextCancelSweepDelay(pass:number){
  if(pass===0)return 30;
  if(pass===1)return 120;
  return null;
}

export async function cancelGeminiBatch(apiKey:string,name:string){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),CANCEL_TIMEOUT_MS);
  try{
    const response=await fetch(geminiBatchCancelUrl(name),{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},body:'{}',signal:controller.signal});
    if(response.ok)return {name,ok:true as const,status:response.status};
    return {name,ok:false as const,status:response.status,error:(await response.text().catch(()=>'' )).slice(0,500)||`Gemini cancel failed (${response.status})`};
  }catch(e){return {name,ok:false as const,status:0,error:controller.signal.aborted?'Gemini cancel request timed out':(e as Error).message||'Gemini cancel request failed'}}
  finally{clearTimeout(timer)}
}

async function trackedBatches(db:D1Database,owner:string,kind:ResearchTargetKind,targetId:string,requestId:string){
  const rows=await db.prepare(`SELECT id,google_batch_name,status,error FROM research_batch_jobs
    WHERE owner_id=? AND request_id=? AND target_kind=? AND target_id=?
      AND (status='running' OR error=?) ORDER BY attempt DESC`).bind(owner,requestId,kind,targetId,CANCEL_MESSAGE).all<BatchRow>();
  return rows.results;
}

async function markRunCancelled(db:D1Database,owner:string,kind:ResearchTargetKind,targetId:string,requestId:string,force=false){
  const config=targetConfig[kind],stamp=now(),statusClause=force?'':" AND status='running'";
  return db.prepare(`UPDATE ${config.table} SET status='failed',stage='failed',message=?,updated_at=?,completed_at=?,duration_ms=cast((julianday(?)-julianday(started_at))*86400000 as integer)
    WHERE owner_id=? AND request_id=? AND ${config.targetColumn}=?${statusClause}`).bind(CANCEL_MESSAGE,stamp,stamp,stamp,owner,requestId,targetId).run();
}

async function cancelTrackedBatches(env:Env,owner:string,kind:ResearchTargetKind,targetId:string,requestId:string){
  const rows=await trackedBatches(env.DB,owner,kind,targetId,requestId),stamp=now(),harvestJobIds:string[]=[],cancelRows:BatchRow[]=[];
  for(const row of rows){
    if(row.status!=='running'){cancelRows.push(row);continue}
    const fetched=await fetchGeminiBatch(env.GEMINI_API_KEY,row.google_batch_name).catch(()=>null);
    if(fetched?.ok&&fetched.state==='JOB_STATE_SUCCEEDED'){harvestJobIds.push(row.id);continue}
    cancelRows.push(row);
  }
  for(const row of cancelRows.filter(row=>row.status==='running')){
    await env.DB.prepare(`UPDATE research_batch_jobs SET status='failed',error=?,updated_at=? WHERE owner_id=? AND id=? AND status='running'`)
      .bind(CANCEL_MESSAGE,stamp,owner,row.id).run();
  }
  const names=[...new Set(cancelRows.map(row=>row.google_batch_name).filter(Boolean))];
  const remote=await Promise.all(names.map(name=>cancelGeminiBatch(env.GEMINI_API_KEY,name)));
  return {tracked:rows.length,remote,harvestJobIds};
}

export async function isResearchRunRunning(db:D1Database,owner:string,kind:ResearchTargetKind,targetId:string,requestId:string){
  const config=targetConfig[kind];
  const row=await db.prepare(`SELECT status FROM ${config.table} WHERE owner_id=? AND request_id=? AND ${config.targetColumn}=?`).bind(owner,requestId,targetId).first<{status:string}>();
  return row?.status==='running';
}

export async function cancelResearchRun(env:Env,owner:string,kind:ResearchTargetKind,targetId:string,requestId:string){
  const config=targetConfig[kind];
  const row=await env.DB.prepare(`SELECT status FROM ${config.table} WHERE owner_id=? AND request_id=? AND ${config.targetColumn}=?`).bind(owner,requestId,targetId).first<{status:string}>();
  if(!row)return {status:404 as const,body:{error:'Research run not found'}};
  if(row.status!=='running')return {status:200 as const,body:{ok:true,cancelled:false,alreadyTerminal:true,requestId,harvestJobIds:[] as string[]}};
  await markRunCancelled(env.DB,owner,kind,targetId,requestId);
  const batches=await cancelTrackedBatches(env,owner,kind,targetId,requestId);
  if(kind==='producer')await discardProducerCatalogStage(env.DB,owner,requestId).catch(()=>undefined);
  return {status:200 as const,body:{ok:true,cancelled:true,alreadyTerminal:false,requestId,trackedBatches:batches.tracked,remoteCancellation:batches.remote,harvestJobIds:batches.harvestJobIds}};
}

export async function sweepCancelledResearch(env:Env,owner:string,kind:ResearchTargetKind,targetId:string,requestId:string){
  await markRunCancelled(env.DB,owner,kind,targetId,requestId,true).catch(()=>undefined);
  if(kind==='producer')await discardProducerCatalogStage(env.DB,owner,requestId).catch(()=>undefined);
  return cancelTrackedBatches(env,owner,kind,targetId,requestId);
}
