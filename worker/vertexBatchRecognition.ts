import { parseRecognition } from '../src/features/recognition/schema';
import { buildRecognitionPrompt,recognitionResponseJsonSchema,RECOGNITION_MODEL } from '../src/lib/recognition/geminiRequest';
import { preferEscalatedRecognition,recognitionEscalationReasons,RECOGNITION_ESCALATION_MODEL } from '../src/lib/recognition/escalation';
import type { RecognitionPhotoMetadata } from '../src/lib/uploads/metadataSelection';
import { shouldRetryRecognitionFailure } from '../src/lib/recognition/retryPolicy';
import { postGeminiGenerateContent,type GeminiTransportBindings } from './geminiTransport';

type Env=GeminiTransportBindings&{DB:D1Database;WINE_IMAGES:R2Bucket;RESEARCH_QUEUE:Queue<unknown>};
type ItemRow={id:string;metadata_json:string;status:string};
type ImageRow={recognition_object_key:string};
type JobRow={id:string;google_batch_name:string|null;item_ids_json:string;status:string;updated_at:string};
type GeminiResponse={candidates?:Array<{content?:{parts?:Array<{text?:string}>};finishReason?:string}>;usageMetadata?:{promptTokenCount?:number;candidatesTokenCount?:number;totalTokenCount?:number;trafficType?:string}};

const JOB_PREFIX='vertex-item/';
const HARD_TIMEOUT_MS=600_000;
const STALE_RUNNING_MS=12*60*1000;
const now=()=>new Date().toISOString();
const parseJson=<T>(raw:unknown,fallback:T):T=>{try{return JSON.parse(String(raw)) as T}catch{return fallback}};

export function shouldRequeueVertexJob(status:string,updatedAt:string,at=Date.now()){
  if(status==='queued')return true;
  if(status!=='running')return false;
  const age=at-Date.parse(updatedAt);return !Number.isFinite(age)||age>=STALE_RUNNING_MS;
}

async function r2Base64(bucket:R2Bucket,key:string){
  const object=await bucket.get(key);if(!object)throw new Error('A staged recognition image is missing');
  const bytes=new Uint8Array(await object.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(binary);
}

function errorMessage(raw:string,status:number){
  try{
    const parsed=JSON.parse(raw) as {error?:{message?:unknown;status?:unknown}},message=typeof parsed.error?.message==='string'?parsed.error.message.trim():'';
    const providerStatus=typeof parsed.error?.status==='string'?parsed.error.status.trim():'';if(message)return `${providerStatus?`${providerStatus}: `:''}${message}`.replace(/\s+/g,' ').slice(0,700);
  }catch{/* plain text */}
  return raw.replace(/\s+/g,' ').trim().slice(0,700)||`HTTP ${status}`;
}

async function tryEscalatedBatchRecognition(env:Env,sessionId:string,itemId:string,body:string,primary:ReturnType<typeof parseRecognition>,reasons:string[]){
  const startedAt=Date.now(),controller=new AbortController();let timedOut=false;const timer=setTimeout(()=>{timedOut=true;controller.abort()},HARD_TIMEOUT_MS);
  console.log(JSON.stringify({event:'vertex-flex-batch-recognition-escalation-start',sessionId,itemId,fromModel:RECOGNITION_MODEL,toModel:RECOGNITION_ESCALATION_MODEL,reasons,primaryConfidence:primary.confidence}));
  try{
    const transport=await postGeminiGenerateContent(env,RECOGNITION_ESCALATION_MODEL,body,controller.signal,{feature:'recognition',mode:'batch-escalation',session:sessionId,item:itemId,tier:'flex'},{serviceTier:'flex',serverTimeoutSeconds:600}),response=transport.response,provider=transport.provider;
    clearTimeout(timer);
    if(!response.ok){const raw=(await response.text().catch(()=>'' )).slice(0,2000);console.warn(JSON.stringify({event:'vertex-flex-batch-recognition-escalation-skipped',sessionId,itemId,model:RECOGNITION_ESCALATION_MODEL,provider,status:response.status,reasons,error:errorMessage(raw,response.status)}));return {result:primary,used:false,trafficType:null}}
    const payload=await response.json() as GeminiResponse,candidate=payload.candidates?.[0],text=candidate?.content?.parts?.map(part=>part.text??'').join('')??'';if(!text)throw new Error('Vertex Gemini 3.7 returned an empty recognition');
    const escalated=parseRecognition(text),result=preferEscalatedRecognition(primary,escalated),used=result===escalated;
    console.log(JSON.stringify({event:'vertex-flex-batch-recognition-escalation-complete',sessionId,itemId,model:RECOGNITION_ESCALATION_MODEL,provider,reasons,used,trafficType:payload.usageMetadata?.trafficType??null,primaryConfidence:primary.confidence,escalatedConfidence:escalated.confidence,latencyMs:Date.now()-startedAt,finishReason:candidate?.finishReason??null,promptTokens:payload.usageMetadata?.promptTokenCount??null,outputTokens:payload.usageMetadata?.candidatesTokenCount??null,totalTokens:payload.usageMetadata?.totalTokenCount??null}));
    return {result,used,trafficType:payload.usageMetadata?.trafficType??null};
  }catch(e){clearTimeout(timer);console.warn(JSON.stringify({event:'vertex-flex-batch-recognition-escalation-skipped',sessionId,itemId,model:RECOGNITION_ESCALATION_MODEL,reasons,timedOut,latencyMs:Date.now()-startedAt,error:(e as Error).message||'Escalation failed'}));return {result:primary,used:false,trafficType:null}}
}

async function finishSessionIfTerminal(db:D1Database,owner:string,sessionId:string){
  const active=await db.prepare("SELECT count(*) AS count FROM batch_recognition_jobs WHERE owner_id=? AND session_id=? AND status IN ('queued','running')").bind(owner,sessionId).first<{count:number}>();
  if(Number(active?.count))return;
  const orphaned=await db.prepare("SELECT count(*) AS count FROM batch_recognition_items WHERE owner_id=? AND session_id=? AND status='submitted'").bind(owner,sessionId).first<{count:number}>();
  if(Number(orphaned?.count))await db.prepare("UPDATE batch_recognition_items SET status='failed',error='Queued Vertex recognition job was not available',updated_at=? WHERE owner_id=? AND session_id=? AND status='submitted'").bind(now(),owner,sessionId).run();
  const counts=await db.prepare(`SELECT sum(status='ready') AS ready,sum(status='failed') AS failed,sum(status='confirmed') AS confirmed,sum(status='rejected') AS rejected,count(*) AS total FROM batch_recognition_items WHERE owner_id=? AND session_id=?`).bind(owner,sessionId).first<Record<string,number>>();
  const ready=Number(counts?.ready)||0,failed=Number(counts?.failed)||0,total=Number(counts?.total)||0,confirmed=Number(counts?.confirmed)||0,rejected=Number(counts?.rejected)||0;
  const status=ready?(failed?'partial':'ready'):(confirmed+rejected>=total&&total?'complete':'failed');
  await db.prepare('UPDATE batch_recognition_sessions SET status=?,confirmed_items=?,updated_at=? WHERE id=? AND owner_id=?').bind(status,confirmed,now(),sessionId,owner).run();
}

async function enqueueJobs(env:Env,owner:string,sessionId:string,jobs:Array<{id:string}>) {
  for(let start=0;start<jobs.length;start+=40){
    const chunk=jobs.slice(start,start+40);
    const settled=await Promise.allSettled(chunk.map(job=>env.RESEARCH_QUEUE.send({kind:'recognition_batch_poll',owner,sessionId,jobId:job.id,pollCount:0},{delaySeconds:1})));
    for(let i=0;i<settled.length;i++)if(settled[i].status==='rejected'){
      const job=chunk[i],error='Could not queue Vertex recognition item',stamp=now();
      const row=await env.DB.prepare('SELECT item_ids_json FROM batch_recognition_jobs WHERE id=? AND owner_id=?').bind(job.id,owner).first<{item_ids_json:string}>(),itemId=parseJson<string[]>(row?.item_ids_json,[])[0];
      await env.DB.batch([
        env.DB.prepare("UPDATE batch_recognition_jobs SET status='failed',error=?,updated_at=? WHERE id=? AND owner_id=?").bind(error,stamp,job.id,owner),
        env.DB.prepare("UPDATE batch_recognition_items SET status='failed',error=?,updated_at=? WHERE id=? AND owner_id=? AND status='submitted'").bind(error,stamp,itemId??'',owner)
      ]);
    }
  }
}

export async function processVertexBatchSubmitJob(env:Env,owner:string,sessionId:string){
  const items=await env.DB.prepare("SELECT id,metadata_json,status FROM batch_recognition_items WHERE owner_id=? AND session_id=? AND status='submitted' ORDER BY position,id").bind(owner,sessionId).all<ItemRow>();
  if(!items.results.length){await finishSessionIfTerminal(env.DB,owner,sessionId);return}
  const existingRows=await env.DB.prepare("SELECT id,google_batch_name,item_ids_json,status,updated_at FROM batch_recognition_jobs WHERE owner_id=? AND session_id=? AND google_batch_name LIKE 'vertex-item/%'").bind(owner,sessionId).all<JobRow>();
  const existingByItem=new Map<string,JobRow>();for(const row of existingRows.results){const itemId=parseJson<string[]>(row.item_ids_json,[])[0];if(itemId&&!existingByItem.has(itemId))existingByItem.set(itemId,row)}
  const toQueue:Array<{id:string}>=[],stamp=now();
  for(const item of items.results){
    const existing=existingByItem.get(item.id);
    if(existing){
      if(existing.status==='queued'){toQueue.push({id:existing.id});continue}
      if(shouldRequeueVertexJob(existing.status,existing.updated_at)){
        const reset=await env.DB.prepare("UPDATE batch_recognition_jobs SET status='queued',error='Recovered stale running recognition lease',updated_at=? WHERE id=? AND owner_id=? AND status='running' AND updated_at=?").bind(stamp,existing.id,owner,existing.updated_at).run();
        if(Number(reset.meta.changes||0)){toQueue.push({id:existing.id});console.warn(JSON.stringify({event:'vertex-flex-batch-recognition-stale-requeued',sessionId,itemId:item.id,jobId:existing.id,previousUpdatedAt:existing.updated_at}))}
      }
      continue;
    }
    const id=crypto.randomUUID();
    await env.DB.prepare("INSERT INTO batch_recognition_jobs(id,owner_id,session_id,google_batch_name,item_ids_json,status,error,created_at,updated_at) VALUES(?,?,?,?,?,'queued',NULL,?,?)").bind(id,owner,sessionId,`${JOB_PREFIX}${item.id}`,JSON.stringify([item.id]),stamp,stamp).run();
    toQueue.push({id});
  }
  await env.DB.prepare("UPDATE batch_recognition_sessions SET status='running',updated_at=? WHERE id=? AND owner_id=?").bind(stamp,sessionId,owner).run();
  await enqueueJobs(env,owner,sessionId,toQueue);
  await finishSessionIfTerminal(env.DB,owner,sessionId);
}

async function retryLater(env:Env,owner:string,sessionId:string,jobId:string,pollCount:number,error:string){
  const stamp=now();await env.DB.prepare("UPDATE batch_recognition_jobs SET status='queued',error=?,updated_at=? WHERE id=? AND owner_id=?").bind(error,stamp,jobId,owner).run();
  await env.RESEARCH_QUEUE.send({kind:'recognition_batch_poll',owner,sessionId,jobId,pollCount:pollCount+1},{delaySeconds:Math.min(90,15*(pollCount+1))});
}

async function failJob(env:Env,owner:string,sessionId:string,jobId:string,itemId:string,error:string){
  const stamp=now();await env.DB.batch([
    env.DB.prepare("UPDATE batch_recognition_jobs SET status='failed',error=?,updated_at=? WHERE id=? AND owner_id=?").bind(error,stamp,jobId,owner),
    env.DB.prepare("UPDATE batch_recognition_items SET status='failed',error=?,updated_at=? WHERE id=? AND owner_id=? AND status='submitted'").bind(error,stamp,itemId,owner)
  ]);await finishSessionIfTerminal(env.DB,owner,sessionId);
}

export async function processVertexBatchPollJob(env:Env,owner:string,sessionId:string,jobId:string,pollCount:number):Promise<boolean>{
  let job=await env.DB.prepare('SELECT id,google_batch_name,item_ids_json,status,updated_at FROM batch_recognition_jobs WHERE id=? AND owner_id=? AND session_id=?').bind(jobId,owner,sessionId).first<JobRow>();
  if(!job||!job.google_batch_name?.startsWith(JOB_PREFIX))return false;
  if(job.status==='complete'||job.status==='failed')return true;
  if(job.status==='running'){
    const age=Date.now()-Date.parse(job.updated_at||now());if(age<STALE_RUNNING_MS)return true;
    await env.DB.prepare("UPDATE batch_recognition_jobs SET status='queued',updated_at=? WHERE id=? AND owner_id=? AND status='running'").bind(now(),jobId,owner).run();job={...job,status:'queued'};
  }
  const claimed=await env.DB.prepare("UPDATE batch_recognition_jobs SET status='running',error=NULL,updated_at=? WHERE id=? AND owner_id=? AND status='queued'").bind(now(),jobId,owner).run();
  if(Number(claimed.meta.changes||0)===0)return true;
  const itemId=parseJson<string[]>(job.item_ids_json,[])[0];if(!itemId){await failJob(env,owner,sessionId,jobId,'','Vertex recognition job has no item');return true}
  const item=await env.DB.prepare('SELECT id,metadata_json,status FROM batch_recognition_items WHERE id=? AND owner_id=? AND session_id=?').bind(itemId,owner,sessionId).first<ItemRow>();
  if(!item||item.status!=='submitted'){await env.DB.prepare("UPDATE batch_recognition_jobs SET status='complete',updated_at=? WHERE id=? AND owner_id=?").bind(now(),jobId,owner).run();await finishSessionIfTerminal(env.DB,owner,sessionId);return true}
  const images=await env.DB.prepare('SELECT recognition_object_key FROM batch_recognition_images WHERE owner_id=? AND item_id=? ORDER BY created_at').bind(owner,itemId).all<ImageRow>();
  if(!images.results.length){await failJob(env,owner,sessionId,jobId,itemId,'No staged recognition image is available');return true}
  const metadata=parseJson<RecognitionPhotoMetadata[]>(item.metadata_json,[]),{prompt,selected}=buildRecognitionPrompt(metadata),parts:Array<Record<string,unknown>>=[{text:prompt}];
  try{
    for(const image of images.results)parts.push({inlineData:{data:await r2Base64(env.WINE_IMAGES,image.recognition_object_key),mimeType:'image/jpeg'}});
    const body=JSON.stringify({contents:[{role:'user',parts}],generationConfig:{responseMimeType:'application/json',responseJsonSchema:recognitionResponseJsonSchema}}),controller=new AbortController();let timedOut=false;
    const timer=setTimeout(()=>{timedOut=true;controller.abort()},HARD_TIMEOUT_MS);
    let response:Response;
    console.log(JSON.stringify({event:'vertex-flex-batch-recognition-gateway-start',sessionId,itemId,jobId,model:RECOGNITION_MODEL,route:'cloudflare-ai-gateway'}));
    try{({response}=await postGeminiGenerateContent(env,RECOGNITION_MODEL,body,controller.signal,{feature:'recognition',mode:'batch',session:sessionId,item:itemId,tier:'flex'},{serviceTier:'flex',serverTimeoutSeconds:600}))}catch(e){
      clearTimeout(timer);const message=timedOut?'Batch recognition Flex request timed out':(e as Error).message||'Batch recognition Flex request failed';
      if(pollCount<2&&shouldRetryRecognitionFailure({status:null,timedOut,networkError:!timedOut})){await retryLater(env,owner,sessionId,jobId,pollCount,message);return true}
      await failJob(env,owner,sessionId,jobId,itemId,message);return true;
    }
    clearTimeout(timer);
    console.log(JSON.stringify({event:'vertex-flex-batch-recognition-gateway-response',sessionId,itemId,jobId,model:RECOGNITION_MODEL,status:response.status,route:'cloudflare-ai-gateway'}));
    if(!response.ok){
      const raw=(await response.text().catch(()=>'' )).slice(0,2000),message=`Vertex Flex batch recognition failed (${response.status}): ${errorMessage(raw,response.status)}`;
      if(pollCount<2&&shouldRetryRecognitionFailure({status:response.status,timedOut:false,networkError:false})){await retryLater(env,owner,sessionId,jobId,pollCount,message);return true}
      await failJob(env,owner,sessionId,jobId,itemId,message);return true;
    }
    const payload=await response.json() as GeminiResponse,candidate=payload.candidates?.[0],text=candidate?.content?.parts?.map(part=>part.text??'').join('')??'';if(!text)throw new Error('Vertex returned an empty recognition');
    const primary=parseRecognition(text),escalationReasons=recognitionEscalationReasons(primary),escalation=escalationReasons.length?await tryEscalatedBatchRecognition(env,sessionId,itemId,body,primary,escalationReasons):{result:primary,used:false,trafficType:null},base=escalation.result,result={...base,locationName:selected.gpsSource==='exif'&&base.locationName?.trim()?base.locationName.trim():null,tastingDate:selected.capturedAt?.slice(0,10)??null,latitude:selected.latitude,longitude:selected.longitude,metadataSource:selected.gpsSource==='exif'?'exif':selected.timestampSource,requestId:itemId},stamp=now();
    await env.DB.batch([
      env.DB.prepare("UPDATE batch_recognition_items SET status='ready',recognition_json=?,error=NULL,updated_at=? WHERE id=? AND owner_id=? AND status='submitted'").bind(JSON.stringify(result),stamp,itemId,owner),
      env.DB.prepare("UPDATE batch_recognition_jobs SET status='complete',error=NULL,updated_at=? WHERE id=? AND owner_id=?").bind(stamp,jobId,owner)
    ]);
    console.log(JSON.stringify({event:'vertex-flex-batch-recognition-complete',sessionId,itemId,model:escalation.used?RECOGNITION_ESCALATION_MODEL:RECOGNITION_MODEL,primaryModel:RECOGNITION_MODEL,escalated:escalation.used,escalationReasons,trafficType:escalation.used?(escalation.trafficType??null):(payload.usageMetadata?.trafficType??null),finishReason:candidate?.finishReason??null,promptTokens:payload.usageMetadata?.promptTokenCount??null,outputTokens:payload.usageMetadata?.candidatesTokenCount??null,totalTokens:payload.usageMetadata?.totalTokenCount??null}));
    await finishSessionIfTerminal(env.DB,owner,sessionId);return true;
  }catch(e){await failJob(env,owner,sessionId,jobId,itemId,(e as Error).message||'Could not process Vertex Flex batch recognition');return true}
}