import { mapProducerRow } from './entities';

type Env={DB:D1Database;GEMINI_API_KEY:string};
type ProducerResearch={homeCountry:string;homeRegion:string;homeLocality:string;profile:string;range:Array<{name:string;appellation?:string|null;classification?:string|null;style?:string|null;notes?:string|null}>};
type GeminiResponse={candidates?:Array<{content?:{parts?:Array<{text?:string}>};groundingMetadata?:{groundingChunks?:Array<{web?:{title?:string;uri?:string}}>} }>};
export type ProducerResearchStage='preparing'|'searching'|'retrying'|'parsing'|'saving'|'complete'|'failed';
export type ProducerResearchRun={requestId:string;producerId:string;status:'running'|'complete'|'failed';stage:ProducerResearchStage;attempt:number;message:string|null;startedAt:string;updatedAt:string;completedAt:string|null;durationMs:number|null};
const MODEL='gemini-3.7-flash';
const ATTEMPT_TIMEOUT_MS=45_000;

class ResearchError extends Error{constructor(message:string,readonly retryable:boolean){super(message)}}
const cleanRequestId=(value?:string)=>value&&/^[A-Za-z0-9_-]{8,64}$/.test(value)?value:crypto.randomUUID();
const now=()=>new Date().toISOString();
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

function log(level:'log'|'warn'|'error',data:Record<string,unknown>){
  console[level](JSON.stringify({event:'producer_research',...data}));
}

async function startRun(db:D1Database,owner:string,producerId:string,requestId:string){
  const stamp=now();
  await db.prepare(`INSERT INTO producer_research_runs(owner_id,request_id,producer_id,status,stage,attempt,message,started_at,updated_at,completed_at,duration_ms)
    VALUES(?,?,?,'running','preparing',0,?,?,?,NULL,NULL)
    ON CONFLICT(owner_id,request_id) DO UPDATE SET producer_id=excluded.producer_id,status='running',stage='preparing',attempt=0,message=excluded.message,started_at=excluded.started_at,updated_at=excluded.updated_at,completed_at=NULL,duration_ms=NULL`)
    .bind(owner,requestId,producerId,'Preparing producer research',stamp,stamp).run();
  // Keep the operational table bounded without affecting research/cache history.
  await db.prepare("DELETE FROM producer_research_runs WHERE owner_id=? AND updated_at<datetime('now','-30 days')").bind(owner).run().catch(()=>undefined);
  return stamp;
}

async function updateRun(db:D1Database,owner:string,requestId:string,stage:ProducerResearchStage,attempt:number,message:string,status:'running'|'complete'|'failed'='running',startedAt?:string){
  const stamp=now(),done=status==='running'?null:stamp,duration=done&&startedAt?Math.max(0,Date.parse(done)-Date.parse(startedAt)):null;
  await db.prepare('UPDATE producer_research_runs SET status=?,stage=?,attempt=?,message=?,updated_at=?,completed_at=?,duration_ms=? WHERE owner_id=? AND request_id=?')
    .bind(status,stage,attempt,message,stamp,done,duration,owner,requestId).run();
}

export async function getProducerResearchRun(db:D1Database,owner:string,producerId:string,requestId:string):Promise<ProducerResearchRun|null>{
  const row=await db.prepare(`SELECT request_id,producer_id,status,stage,attempt,message,started_at,updated_at,completed_at,duration_ms
    FROM producer_research_runs WHERE owner_id=? AND producer_id=? AND request_id=?`).bind(owner,producerId,requestId).first<Record<string,unknown>>();
  if(!row)return null;
  return {requestId:String(row.request_id),producerId:String(row.producer_id),status:String(row.status) as ProducerResearchRun['status'],stage:String(row.stage) as ProducerResearchStage,attempt:Number(row.attempt)||0,message:row.message?String(row.message):null,startedAt:String(row.started_at),updatedAt:String(row.updated_at),completedAt:row.completed_at?String(row.completed_at):null,durationMs:row.duration_ms==null?null:Number(row.duration_ms)};
}

async function fetchGemini(url:string,requestBody:string){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),ATTEMPT_TIMEOUT_MS);
  try{
    return await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:requestBody,signal:controller.signal});
  }catch(e){
    if(controller.signal.aborted)throw new ResearchError(`Producer research timed out after ${ATTEMPT_TIMEOUT_MS/1000} seconds while waiting for Gemini`,false);
    throw new ResearchError((e as Error).message||'Network error while contacting Gemini',true);
  }finally{clearTimeout(timer)}
}

export async function runProducerResearch(env:Env,owner:string,id:string,confirmation?:string,requestedId?:string){
  if(confirmation!=='RUN_PRODUCER_RESEARCH')return {status:400 as const,body:{error:'Producer research requires explicit confirmation'}};
  const row=await env.DB.prepare('SELECT * FROM producers WHERE owner_id=? AND id=?').bind(owner,id).first<Record<string,unknown>>();
  if(!row)return {status:404 as const,body:{error:'Producer not found'}};
  const requestId=cleanRequestId(requestedId),startedAt=await startRun(env.DB,owner,id,requestId),startedMs=Date.now(),name=String(row.canonical_name);
  log('log',{requestId,producerId:id,producer:name,stage:'preparing',model:MODEL});
  const prompt=`Research the wine producer ${JSON.stringify(name)} using reliable public web sources, prioritizing the producer's official website and reputable importer/distributor pages.

Return the producer's PHYSICAL HOME/BASE location, not the regions or appellations where its wines are produced. For example, homeRegion means where the domaine/estate/company is based.

Also identify the producer's current or most recently documented wine range as completely as reliable public sources allow. Do not invent cuvees. If a wine is seasonal, discontinued, uncertain, negociant-only, or not clearly current, explain that briefly in notes. Preserve official spellings and appellation names.

Return JSON only with:
- homeCountry: country where the producer is based
- homeRegion: administrative/wine region where the producer is based
- homeLocality: village/town/city where the producer is based
- profile: concise but substantive producer overview
- range: array of objects with name, appellation, classification, style, notes

Use empty strings or nulls when a field cannot be verified. The range may be empty if reliable sources do not support a catalog.`;
  const requestBody=JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],tools:[{google_search:{}}],generationConfig:{responseMimeType:'application/json',responseSchema:{type:'OBJECT',properties:{homeCountry:{type:'STRING'},homeRegion:{type:'STRING'},homeLocality:{type:'STRING'},profile:{type:'STRING'},range:{type:'ARRAY',items:{type:'OBJECT',properties:{name:{type:'STRING'},appellation:{type:'STRING',nullable:true},classification:{type:'STRING',nullable:true},style:{type:'STRING',nullable:true},notes:{type:'STRING',nullable:true}},required:['name']}}},required:['homeCountry','homeRegion','homeLocality','profile','range']}}});
  let lastError='Producer research failed';
  for(let attempt=1;attempt<=2;attempt++){
    try{
      await updateRun(env.DB,owner,requestId,'searching',attempt,attempt===1?'Searching reliable web sources with Gemini':'Retrying Gemini web research', 'running',startedAt);
      log('log',{requestId,producerId:id,stage:'searching',attempt,elapsedMs:Date.now()-startedMs,model:MODEL});
      const response=await fetchGemini(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`,requestBody);
      log('log',{requestId,producerId:id,stage:'gemini_response',attempt,httpStatus:response.status,elapsedMs:Date.now()-startedMs});
      if(!response.ok){
        const retryable=response.status===429||response.status>=500;
        throw new ResearchError(`Producer research failed (${response.status})`,retryable);
      }
      await updateRun(env.DB,owner,requestId,'parsing',attempt,'Gemini responded; validating the researched producer profile and range','running',startedAt);
      const gemini=await response.json() as GeminiResponse,candidate=gemini.candidates?.[0],text=candidate?.content?.parts?.map(x=>x.text??'').join('')??'';
      let parsed:ProducerResearch;
      try{parsed=JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g,'')) as ProducerResearch}catch{throw new ResearchError('Producer research returned invalid JSON',true)}
      if(!parsed||typeof parsed.profile!=='string'||!Array.isArray(parsed.range))throw new ResearchError('Producer research returned an invalid structured response',true);
      const range=parsed.range.filter(x=>x&&typeof x.name==='string'&&x.name.trim()).slice(0,120);
      const seen=new Set<string>(),sources=(candidate?.groundingMetadata?.groundingChunks??[]).flatMap(x=>x.web?.uri?[{title:x.web.title??x.web.uri,url:x.web.uri}]:[]).filter(x=>{if(seen.has(x.url))return false;seen.add(x.url);return true}).slice(0,20);
      await updateRun(env.DB,owner,requestId,'saving',attempt,`Saving producer profile, ${range.length} catalog wine${range.length===1?'':'s'} and ${sources.length} source${sources.length===1?'':'s'}`,'running',startedAt);
      const stamp=now();
      await env.DB.prepare('UPDATE producers SET home_country=?,home_region=?,home_locality=?,profile=?,catalog_json=?,sources_json=?,research_model=?,researched_at=?,updated_at=? WHERE owner_id=? AND id=?').bind(parsed.homeCountry?.trim()||null,parsed.homeRegion?.trim()||null,parsed.homeLocality?.trim()||null,parsed.profile.trim(),JSON.stringify(range),JSON.stringify(sources),MODEL,stamp,stamp,owner,id).run();
      const updated=await env.DB.prepare('SELECT * FROM producers WHERE owner_id=? AND id=?').bind(owner,id).first<Record<string,unknown>>();
      await updateRun(env.DB,owner,requestId,'complete',attempt,`Research complete: ${range.length} catalog wine${range.length===1?'':'s'}, ${sources.length} source${sources.length===1?'':'s'}`,'complete',startedAt);
      log('log',{requestId,producerId:id,stage:'complete',attempt,durationMs:Date.now()-startedMs,catalogCount:range.length,sourceCount:sources.length,model:MODEL});
      return {status:200 as const,body:{...mapProducerRow(updated!),researchRequestId:requestId}};
    }catch(e){
      const err=e instanceof ResearchError?e:new ResearchError((e as Error).message||lastError,true);lastError=err.message;
      const canRetry=attempt===1&&err.retryable;
      log(canRetry?'warn':'error',{requestId,producerId:id,stage:canRetry?'retrying':'failed',attempt,elapsedMs:Date.now()-startedMs,error:lastError,retryable:err.retryable,model:MODEL});
      if(canRetry){await updateRun(env.DB,owner,requestId,'retrying',attempt,`${lastError}. Retrying once…`,'running',startedAt);await sleep(900);continue}
      await updateRun(env.DB,owner,requestId,'failed',attempt,lastError,'failed',startedAt);
      return {status:502 as const,body:{error:lastError,researchRequestId:requestId}};
    }
  }
  await updateRun(env.DB,owner,requestId,'failed',2,lastError,'failed',startedAt);
  return {status:502 as const,body:{error:lastError,researchRequestId:requestId}};
}
