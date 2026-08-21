import { ensureCuveeEntity,reconcileProducerCuvees } from '../cuvees/entities';
import { createResearchBatchJob,finishResearchBatchJob,getResearchBatchJob,touchResearchBatchJob,type ResearchBatchJob } from '../research/batchJobStore';
import { cancelGeminiBatch } from '../research/cancelResearch';
import { createGeminiBatch,fetchGeminiBatch,inlineFinishReason,inlineGroundingMetadata,inlineResponseText,isTerminalBatchState,responsesByKey,type GeminiBatchRequest,type GroundingMetadata } from '../research/geminiBatch';
import { researchBatchErrorPollDelay,researchBatchPollDelay,researchBatchStallAction,researchBatchTransientAction } from '../research/batchRetryPolicy';
import { mergeCatalogRanges } from './researchQuality';
import { parseStructuredJsonText } from './structuredJson';
import { pollProducerBatchResearch as pollProducerBatchResearchV2,startProducerBatchResearch as startProducerBatchResearchV2 } from './batchResearchV2';

type Env={DB:D1Database;WINE_IMAGES:R2Bucket;GEMINI_API_KEY:string;RESEARCH_QUEUE:Queue<unknown>};
type CatalogCategory='red'|'white'|'rose'|'sparkling'|'dessert'|'fortified'|'orange'|'other';
type CatalogWine={name:string;category:CatalogCategory;appellation?:string|null;classification?:string|null;style?:string|null;notes?:string|null};
type CatalogResult={range:CatalogWine[]};
type ResearchSource={title:string;url:string};
type CatalogSaveSummary={catalogCount:number;researchedCount:number;retainedCount:number;syncIssues:string[]};

const CATEGORIES=new Set<CatalogCategory>(['red','white','rose','sparkling','dessert','fortified','orange','other']);
const CATALOG_RECOVERY_ATTEMPT=3;
const CATALOG_RECOVERY_CHUNKS=[
  {key:'catalog_chunk_a_e',label:'A–E',rule:'A through E'},
  {key:'catalog_chunk_f_j',label:'F–J',rule:'F through J'},
  {key:'catalog_chunk_k_o',label:'K–O',rule:'K through O'},
  {key:'catalog_chunk_p_t',label:'P–T',rule:'P through T'},
  {key:'catalog_chunk_u_z_other',label:'U–Z / other',rule:'U through Z, plus digits, symbols and non-Latin initials not covered by the other slices'}
] as const;
export const catalogRecoveryChunkKeys=CATALOG_RECOVERY_CHUNKS.map(chunk=>chunk.key);
const now=()=>new Date().toISOString();
const parseJson=<T>(value:unknown,fallback:T):T=>{try{return JSON.parse(String(value)) as T}catch{return fallback}};

function log(level:'log'|'warn'|'error',data:Record<string,unknown>){console[level](JSON.stringify({event:'producer_catalog_recovery',...data}))}
function isRecoveryChunkKey(value:string){return catalogRecoveryChunkKeys.includes(value as (typeof catalogRecoveryChunkKeys)[number])}
function isRecoveryChunkJob(job:ResearchBatchJob){return job.keys.length===CATALOG_RECOVERY_CHUNKS.length&&job.keys.every(isRecoveryChunkKey)}

export function shouldUseChunkedCatalogRecovery(error:string|null|undefined){
  const parts=String(error??'').split(';').map(part=>part.trim()).filter(Boolean);
  if(!parts.length||parts.some(part=>!part.toLowerCase().startsWith('catalog:')))return false;
  return parts.some(part=>part.includes('MAX_TOKENS')||part.includes('Structured JSON contains an embedded record fragment'));
}

async function setRunState(db:D1Database,owner:string,requestId:string,status:'running'|'complete'|'failed',stage:string,attempt:number,message:string){
  const row=await db.prepare('SELECT started_at FROM producer_research_runs WHERE owner_id=? AND request_id=?').bind(owner,requestId).first<{started_at:string}>();
  const stamp=now(),done=status==='running'?null:stamp,duration=done&&row?.started_at?Math.max(0,Date.parse(done)-Date.parse(row.started_at)):null;
  await db.prepare('UPDATE producer_research_runs SET status=?,stage=?,attempt=?,message=?,updated_at=?,completed_at=?,duration_ms=? WHERE owner_id=? AND request_id=?')
    .bind(status,stage,attempt,message,stamp,done,duration,owner,requestId).run();
}

function safeSourceUrl(value:unknown){
  if(typeof value!=='string'||!value.trim())return null;
  try{const url=new URL(value.trim());if(url.protocol!=='https:'||url.username||url.password||!url.hostname)return null;url.hash='';return url.toString()}catch{return null}
}
function sourcesFrom(metadata?:GroundingMetadata){
  const seen=new Set<string>(),out:ResearchSource[]=[];
  for(const chunk of metadata?.groundingChunks??[]){const web=chunk.web,url=safeSourceUrl(web?.uri);if(!url||seen.has(url))continue;seen.add(url);out.push({title:web?.title?.trim()||new URL(url).hostname,url});if(out.length>=20)break}
  return out;
}
function mergeSources(...lists:ResearchSource[][]){const seen=new Set<string>();return lists.flat().filter(item=>{if(!item.url||seen.has(item.url))return false;seen.add(item.url);return true}).slice(0,30)}

const catalogSchema={type:'OBJECT',properties:{range:{type:'ARRAY',items:{type:'OBJECT',properties:{name:{type:'STRING'},category:{type:'STRING',enum:['red','white','rose','sparkling','dessert','fortified','orange','other']},appellation:{type:'STRING',nullable:true},classification:{type:'STRING',nullable:true},style:{type:'STRING',nullable:true},notes:{type:'STRING',nullable:true}},required:['name','category']}}},required:['range']};
function catalogChunkPrompt(name:string,label:string,rule:string){
  return `Recover one bounded slice of the current or most recently documented wine range of ${JSON.stringify(name)} using reliable public web sources. This request is intentionally split because a previous full-range structured response was too large or structurally malformed.\n\nSLICE: return ONLY wines whose first significant wine/cuvee-name initial falls in ${label} (${rule}). Determine the initial after removing the producer name and a leading generic Domaine, Maison, Château/Chateau or Estate prefix when it merely repeats the producer identity. Treat accented Latin initials as their base letter. Do not return wines belonging to another slice.\n\nSearch across complementary sources where available: official producer range/product pages and technical sheets; recent official importer/distributor portfolios; reputable regional or specialist wine references. Cross-check omissions and alternate spellings. Preserve official wine and appellation spellings. Do not invent cuvees.\n\nFor every returned wine use exactly the fields name, category, appellation, classification, style and notes. category must be one of red, white, rose, sparkling, dessert, fortified, orange, other. Keep style to a very short plain phrase such as Still dry red, Still dry white or Sparkling brut; do not put labels such as classification:, notes:, JSON fragments, braces or quoted field names inside style. notes must be null unless a single short current-status caveat is genuinely necessary. Return JSON only as {"range":[...]}.`;
}
function catalogChunkEntries(name:string):GeminiBatchRequest[]{
  return CATALOG_RECOVERY_CHUNKS.map(chunk=>({key:chunk.key,request:{contents:[{role:'user',parts:[{text:catalogChunkPrompt(name,chunk.label,chunk.rule)}]}],tools:[{google_search:{}}],generationConfig:{responseMimeType:'application/json',responseSchema:catalogSchema,maxOutputTokens:8192}}}));
}

function normalizeCatalogRange(catalog:CatalogResult){
  if(!catalog||!Array.isArray(catalog.range))throw new Error('Producer catalogue recovery returned invalid fields');
  const out:CatalogWine[]=[];
  for(const raw of catalog.range as unknown[]){
    if(!raw||typeof raw!=='object')continue;const item=raw as Record<string,unknown>,name=typeof item.name==='string'?item.name.trim():'';if(!name)continue;
    const categoryText=typeof item.category==='string'?item.category.trim().toLowerCase():'other',category=CATEGORIES.has(categoryText as CatalogCategory)?categoryText as CatalogCategory:'other';
    const optional=(value:unknown,max:number)=>typeof value==='string'&&value.trim()?value.trim().slice(0,max):null;
    out.push({name,category,appellation:optional(item.appellation,160),classification:optional(item.classification,120),style:optional(item.style,80),notes:optional(item.notes,300)});
  }
  return out;
}

async function saveChunkedCatalog(env:Env,owner:string,producerId:string,catalogs:CatalogResult[],metadata:GroundingMetadata[],model:string):Promise<CatalogSaveSummary>{
  const researched=catalogs.flatMap(normalizeCatalogRange);
  const row=await env.DB.prepare('SELECT catalog_json,sources_json FROM producers WHERE owner_id=? AND id=?').bind(owner,producerId).first<{catalog_json:string;sources_json:string}>();
  const parsedPrevious=parseJson<unknown>(row?.catalog_json,[]),previous=(Array.isArray(parsedPrevious)?parsedPrevious:[]).filter(item=>item&&typeof item==='object'&&typeof (item as {name?:unknown}).name==='string') as CatalogWine[];
  const merged=mergeCatalogRanges(previous,researched,150),sources=mergeSources(parseJson<ResearchSource[]>(row?.sources_json,[]),...metadata.map(sourcesFrom)),stamp=now();
  await env.DB.prepare('UPDATE producers SET catalog_json=?,sources_json=?,research_model=?,researched_at=?,updated_at=? WHERE owner_id=? AND id=?')
    .bind(JSON.stringify(merged.range),JSON.stringify(sources),`${model} (batch chunk recovery)`,stamp,stamp,owner,producerId).run();
  const syncIssues:string[]=[];
  for(const item of merged.range){
    try{await ensureCuveeEntity(env.DB,owner,producerId,item.name,item.appellation??null,item.category??item.style??null,true)}
    catch(e){const error=(e as Error).message||'Unknown cuvée identity error';syncIssues.push(`${item.name}: ${error}`);log('warn',{producerId,stage:'catalog_cuvee_sync_skipped',wine:item.name,error})}
  }
  try{await reconcileProducerCuvees(env.DB,owner,producerId)}catch(e){const error=(e as Error).message||'Cuvée reconciliation failed';syncIssues.push(`reconciliation: ${error}`);log('warn',{producerId,stage:'catalog_reconcile_skipped',error})}
  return {catalogCount:merged.range.length,researchedCount:merged.researchedCount,retainedCount:merged.retainedCount,syncIssues};
}

async function jobForAttempt(db:D1Database,owner:string,requestId:string,attempt:number){
  const row=await db.prepare('SELECT id FROM research_batch_jobs WHERE owner_id=? AND request_id=? AND attempt=?').bind(owner,requestId,attempt).first<{id:string}>();
  return row?.id?getResearchBatchJob(db,owner,row.id):null;
}
async function supersedeAutomaticFallback(env:Env,owner:string,requestId:string){
  const fallback=await jobForAttempt(env.DB,owner,requestId,2);if(!fallback||fallback.status!=='running')return;
  const cancelled=await cancelGeminiBatch(env.GEMINI_API_KEY,fallback.googleBatchName);if(!cancelled.ok)log('warn',{requestId,stage:'superseded_fallback_cancel_failed',jobId:fallback.id,error:cancelled.error??`HTTP ${cancelled.status}`});
  await env.DB.prepare('DELETE FROM research_batch_jobs WHERE owner_id=? AND id=?').bind(owner,fallback.id).run();
  log('log',{requestId,stage:'superseded_full_fallback',jobId:fallback.id});
}

async function scheduleChunkedCatalogRecovery(env:Env,owner:string,producerId:string,requestId:string,sourceJob:ResearchBatchJob){
  const existing=await jobForAttempt(env.DB,owner,requestId,CATALOG_RECOVERY_ATTEMPT);if(existing){if(existing.status==='running')return;throw new Error('A prior chunked catalogue recovery already reached a terminal state')}
  if(sourceJob.attempt===1)await supersedeAutomaticFallback(env,owner,requestId);
  const producer=await env.DB.prepare('SELECT canonical_name FROM producers WHERE owner_id=? AND id=?').bind(owner,producerId).first<{canonical_name:string}>();if(!producer)throw new Error('Producer not found');
  const entries=catalogChunkEntries(producer.canonical_name),model=sourceJob.model;let googleName:string|undefined,jobId:string|undefined;
  try{
    googleName=await createGeminiBatch(env.GEMINI_API_KEY,model,`winelog-producer-${requestId}-catalog-chunks`,entries);
    jobId=await createResearchBatchJob(env.DB,{owner,requestId,targetKind:'producer',targetId:producerId,googleBatchName:googleName,model,attempt:CATALOG_RECOVERY_ATTEMPT,keys:[...catalogRecoveryChunkKeys]});
    await setRunState(env.DB,owner,requestId,'running','retrying',CATALOG_RECOVERY_ATTEMPT,`Catalogue output was too large or structurally malformed; retrying ${CATALOG_RECOVERY_CHUNKS.length} smaller alphabetical slices with ${model}`);
    await env.RESEARCH_QUEUE.send({kind:'producer_batch_poll',owner,producerId,requestId,jobId,pollCount:0},{delaySeconds:researchBatchPollDelay(0)});
    log('log',{requestId,producerId,stage:'chunk_recovery_submitted',sourceAttempt:sourceJob.attempt,model,jobId});
  }catch(e){
    const error=(e as Error).message||'Could not submit chunked catalogue recovery';
    if(jobId)await finishResearchBatchJob(env.DB,owner,jobId,'failed',error).catch(()=>undefined);
    if(googleName)await cancelGeminiBatch(env.GEMINI_API_KEY,googleName).catch(()=>undefined);
    await setRunState(env.DB,owner,requestId,'failed','failed',CATALOG_RECOVERY_ATTEMPT,`Producer profile was saved, but catalogue recovery could not be submitted: ${error}`).catch(()=>undefined);
    throw e;
  }
}

async function failChunkRecovery(env:Env,owner:string,requestId:string,job:ResearchBatchJob,error:string){
  await finishResearchBatchJob(env.DB,owner,job.id,'failed',error).catch(()=>undefined);
  await setRunState(env.DB,owner,requestId,'failed','failed',job.attempt,`Producer profile was saved, but chunked catalog recovery failed: ${error}`).catch(()=>undefined);
  log('error',{requestId,stage:'chunk_recovery_failed',jobId:job.id,error});
}

async function pollChunkedCatalogRecovery(env:Env,owner:string,producerId:string,requestId:string,job:ResearchBatchJob,pollCount:number){
  if(job.status!=='running')return;
  const fetched=await fetchGeminiBatch(env.GEMINI_API_KEY,job.googleBatchName);
  if(!fetched.ok){
    if(fetched.status===429||fetched.status>=500){const action=researchBatchTransientAction(job.attempt,pollCount);if(action==='retry'){await touchResearchBatchJob(env.DB,owner,job.id);await env.RESEARCH_QUEUE.send({kind:'producer_batch_poll',owner,producerId,requestId,jobId:job.id,pollCount:pollCount+1},{delaySeconds:researchBatchErrorPollDelay(pollCount)});return}}
    await failChunkRecovery(env,owner,requestId,job,fetched.error);return;
  }
  if(!isTerminalBatchState(fetched.state)){
    const action=researchBatchStallAction(job.attempt,pollCount);if(action==='retry'){await touchResearchBatchJob(env.DB,owner,job.id);await setRunState(env.DB,owner,requestId,'running','retrying',job.attempt,`Gemini is processing ${CATALOG_RECOVERY_CHUNKS.length} bounded catalogue slices`);await env.RESEARCH_QUEUE.send({kind:'producer_batch_poll',owner,producerId,requestId,jobId:job.id,pollCount:pollCount+1},{delaySeconds:researchBatchPollDelay(pollCount)});return}
    await cancelGeminiBatch(env.GEMINI_API_KEY,job.googleBatchName).catch(()=>undefined);await failChunkRecovery(env,owner,requestId,job,`Chunked Gemini Batch did not complete within WineLog's recovery window (last state ${fetched.state||'unknown'})`);return;
  }
  if(fetched.state!=='JOB_STATE_SUCCEEDED'){await failChunkRecovery(env,owner,requestId,job,String((fetched.payload.error as {message?:unknown}|undefined)?.message||`Gemini chunked batch ended with ${fetched.state}`));return}

  const byKey=responsesByKey(fetched.responses),catalogs:CatalogResult[]=[],metadata:GroundingMetadata[]=[],errors:string[]=[];
  for(const chunk of CATALOG_RECOVERY_CHUNKS){
    const inline=byKey.get(chunk.key);if(!inline?.response){errors.push(`${chunk.label}: ${inline?.error?.message||'Gemini returned no result'}`);continue}
    const text=inlineResponseText(inline),finishReason=inlineFinishReason(inline);if(finishReason==='MAX_TOKENS'){errors.push(`${chunk.label}: output still reached MAX_TOKENS`);continue}
    try{const parsed=parseStructuredJsonText(text) as CatalogResult;if(!parsed||!Array.isArray(parsed.range))throw new Error('invalid catalogue fields');catalogs.push(parsed);const grounding=inlineGroundingMetadata(inline);if(grounding)metadata.push(grounding)}
    catch(e){errors.push(`${chunk.label}: ${(e as Error).message}${finishReason?` (${finishReason})`:''}`)}
  }
  if(errors.length){await failChunkRecovery(env,owner,requestId,job,errors.join('; '));return}
  await setRunState(env.DB,owner,requestId,'running','saving',job.attempt,'Saving recovered producer catalogue slices');
  try{
    const summary=await saveChunkedCatalog(env,owner,producerId,catalogs,metadata,job.model);await finishResearchBatchJob(env.DB,owner,job.id,'complete');
    let detail=`${summary.catalogCount} catalogue wine${summary.catalogCount===1?'':'s'} (${summary.researchedCount} found across recovery slices${summary.retainedCount?`, ${summary.retainedCount} retained from earlier research`:''})`;if(summary.syncIssues.length)detail+=`; ${summary.syncIssues.length} local cuvée identity link${summary.syncIssues.length===1?'':'s'} skipped`;
    await setRunState(env.DB,owner,requestId,'complete','complete',job.attempt,`Producer Batch research complete; saved ${detail}`);
    log('log',{requestId,producerId,stage:'chunk_recovery_complete',jobId:job.id,summary});
  }catch(e){await failChunkRecovery(env,owner,requestId,job,(e as Error).message||'Could not save recovered catalogue')}
}

export const startProducerBatchResearch=startProducerBatchResearchV2;
export async function pollProducerBatchResearch(env:Env,owner:string,producerId:string,requestId:string,jobId:string,pollCount:number){
  const tracked=await getResearchBatchJob(env.DB,owner,jobId);if(!tracked)return;
  if(isRecoveryChunkJob(tracked)){await pollChunkedCatalogRecovery(env,owner,producerId,requestId,tracked,pollCount);return}
  await pollProducerBatchResearchV2(env,owner,producerId,requestId,jobId,pollCount);
  const finished=await getResearchBatchJob(env.DB,owner,jobId);if(!finished||finished.status!=='failed'||!finished.keys.includes('catalog')||!shouldUseChunkedCatalogRecovery(finished.error))return;
  try{await scheduleChunkedCatalogRecovery(env,owner,producerId,requestId,finished)}catch(e){log('error',{requestId,producerId,stage:'chunk_recovery_schedule_failed',sourceAttempt:finished.attempt,error:(e as Error).message})}
}
