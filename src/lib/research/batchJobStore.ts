export type ResearchBatchKind='producer'|'wine';
export type ResearchBatchJob={id:string;owner:string;requestId:string;targetKind:ResearchBatchKind;targetId:string;googleBatchName:string;model:string;attempt:number;keys:string[];status:'running'|'complete'|'failed';error:string|null};
const now=()=>new Date().toISOString();
const parseJson=<T>(value:unknown,fallback:T):T=>{try{return JSON.parse(String(value)) as T}catch{return fallback}};

export async function createResearchBatchJob(db:D1Database,input:{owner:string;requestId:string;targetKind:ResearchBatchKind;targetId:string;googleBatchName:string;model:string;attempt:number;keys:string[]}){
  const existing=await db.prepare('SELECT id FROM research_batch_jobs WHERE owner_id=? AND request_id=? AND attempt=?').bind(input.owner,input.requestId,input.attempt).first<{id:string}>();
  if(existing?.id)return existing.id;
  const id=crypto.randomUUID(),stamp=now();
  await db.prepare(`INSERT INTO research_batch_jobs(id,owner_id,request_id,target_kind,target_id,google_batch_name,model,attempt,keys_json,status,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,'running',?,?)`).bind(id,input.owner,input.requestId,input.targetKind,input.targetId,input.googleBatchName,input.model,input.attempt,JSON.stringify(input.keys),stamp,stamp).run();
  await db.prepare("DELETE FROM research_batch_jobs WHERE owner_id=? AND status<>'running' AND updated_at<datetime('now','-30 days')").bind(input.owner).run().catch(()=>undefined);
  return id;
}

export async function getResearchBatchJob(db:D1Database,owner:string,id:string):Promise<ResearchBatchJob|null>{
  const row=await db.prepare('SELECT * FROM research_batch_jobs WHERE owner_id=? AND id=?').bind(owner,id).first<Record<string,unknown>>();
  if(!row)return null;
  return {id:String(row.id),owner:String(row.owner_id),requestId:String(row.request_id),targetKind:String(row.target_kind) as ResearchBatchKind,targetId:String(row.target_id),googleBatchName:String(row.google_batch_name),model:String(row.model),attempt:Number(row.attempt)||1,keys:parseJson<string[]>(row.keys_json,[]),status:String(row.status) as ResearchBatchJob['status'],error:row.error?String(row.error):null};
}

export async function finishResearchBatchJob(db:D1Database,owner:string,id:string,status:'complete'|'failed',error?:string|null){
  await db.prepare('UPDATE research_batch_jobs SET status=?,error=?,updated_at=? WHERE owner_id=? AND id=?').bind(status,error??null,now(),owner,id).run();
}

/** Records the billed unit for a completed submission. Never fatal: a missing count costs visibility, not correctness. */
export async function recordResearchSearchQueries(db:D1Database,owner:string,id:string,count:number){
  if(!Number.isFinite(count)||count<=0)return;
  await db.prepare('UPDATE research_batch_jobs SET search_queries=? WHERE owner_id=? AND id=?').bind(Math.round(count),owner,id).run();
}

export async function touchResearchBatchJob(db:D1Database,owner:string,id:string){await db.prepare('UPDATE research_batch_jobs SET updated_at=? WHERE owner_id=? AND id=?').bind(now(),owner,id).run()}
