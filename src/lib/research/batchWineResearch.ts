import { deepSearchSchema,type DeepSearchResult } from '../db/schema';
import { ensureProducerEntity } from '../producers/entities';
import { parseStructuredJsonText } from '../producers/structuredJson';
import { assembleDeepSearch,buildResearchTargets,fieldsForScope,loadResearchCache,scopeIsComplete,scopeRetryFeedback,seedResearchCache,splitDeepSearchResult,upsertResearchCache,type CachedResearch,type ResearchScope,type ResearchSource,type ResearchTarget } from './cache';
import { createResearchBatchJob,finishResearchBatchJob,getResearchBatchJob,touchResearchBatchJob } from './batchJobStore';
import { cancelGeminiBatch } from './cancelResearch';
import { createGeminiBatch,fetchGeminiBatch,inlineFinishReason,inlineGroundingMetadata,inlineResponseText,isTerminalBatchState,responsesByKey,type GeminiBatchRequest,type GroundingMetadata } from './geminiBatch';
import { buildDeepSearchProvenance } from './provenance';
import { researchBatchErrorPollDelay,researchBatchPollDelay,researchBatchStallAction,researchBatchTransientAction } from './batchRetryPolicy';
import { highRiskTechnicalFailureMessage } from './technicalClaimGate';
import { auditTechnicalContradictions,technicalContradictionFailureMessage } from './technicalContradictions';
import { updateWineResearchRun } from './backgroundJobs';

type Env={DB:D1Database;GEMINI_API_KEY:string;RESEARCH_QUEUE:Queue<unknown>};
type WineRow={producer:string;producer_id:string|null;cuvee_id:string|null;wine_name:string;vintage:number|null;country:string|null;region:string|null;appellation:string|null;grapes_json:string;grape_blend_json:string};
type ResearchRow={deep_search_json:string};
const PRIMARY_MODEL='gemini-3.7-flash';
const FALLBACK_MODEL='gemini-3.6-flash';
const BATCH_KEY='wine-research';
const now=()=>new Date().toISOString();
const parseJson=<T>(raw:unknown,fallback:T):T=>{try{return JSON.parse(String(raw)) as T}catch{return fallback}};
const scopeNames:Record<ResearchScope,string>={producer:'producer profile and general practices',terroir:'wine/cru terroir',vintage_context:'appellation/region vintage context',wine_vintage:'exact wine + vintage'};
const scopeFields:Record<ResearchScope,string>={producer:'producerDetails, producerWinemakingPractices',terroir:'terroir',vintage_context:'vintageQuality',wine_vintage:'summary, winemakingTechniques, drinkingWindow'};

function log(level:'log'|'warn'|'error',data:Record<string,unknown>){console[level](JSON.stringify({event:'wine_batch_research',...data}))}
function researchTargets(wine:WineRow){return buildResearchTargets({producer:wine.producer,producerId:wine.producer_id,cuveeId:wine.cuvee_id,wineName:wine.wine_name,vintage:wine.vintage,country:wine.country,region:wine.region,appellation:wine.appellation})}
async function saveSnapshot(db:D1Database,owner:string,id:string,result:DeepSearchResult){const stamp=now();await db.prepare('UPDATE wines SET deep_search_json=?,deep_search_model=?,deep_search_updated_at=?,updated_at=? WHERE id=? AND owner_id=?').bind(JSON.stringify(result),result.model,stamp,stamp,id,owner).run()}

async function seedProducerProfileResearch(db:D1Database,owner:string,wine:WineRow,targets:ResearchTarget[]){
  if(!wine.producer_id)return;const target=targets.find(x=>x.scope==='producer');if(!target)return;
  const row=await db.prepare('SELECT profile,winemaking_practices,sources_json,research_model,researched_at FROM producers WHERE owner_id=? AND id=?').bind(owner,wine.producer_id).first<{profile:string;winemaking_practices:string;sources_json:string;research_model:string|null;researched_at:string|null}>();
  if(!row?.profile?.trim()||!row.winemaking_practices?.trim())return;
  await upsertResearchCache(db,owner,{target,payload:{producerDetails:row.profile.trim(),producerWinemakingPractices:row.winemaking_practices.trim()},sources:parseJson(row.sources_json,[]),model:row.research_model||'producer-research',researchedAt:row.researched_at||now()});
}

async function seedFromLegacy(db:D1Database,owner:string,wine:WineRow,targets:ResearchTarget[],cache:Map<ResearchScope,CachedResearch>){
  if(cache.size===targets.length)return cache;
  const row=await db.prepare(`SELECT deep_search_json FROM wines WHERE owner_id=? AND producer=? AND wine_name=? AND coalesce(vintage,-1)=coalesce(?,-1) AND coalesce(appellation,'')=coalesce(?,'') AND deep_search_json IS NOT NULL ORDER BY deep_search_updated_at DESC LIMIT 1`).bind(owner,wine.producer,wine.wine_name,wine.vintage,wine.appellation).first<ResearchRow>();
  if(!row?.deep_search_json)return cache;const legacy=deepSearchSchema.safeParse(parseJson(row.deep_search_json,null));if(!legacy.success)return cache;
  const entries=splitDeepSearchResult(legacy.data,targets).filter(entry=>!cache.has(entry.target.scope));await Promise.all(entries.map(entry=>seedResearchCache(db,owner,entry)));return entries.length?loadResearchCache(db,owner,targets):cache;
}

async function bridgePriorCaches(db:D1Database,owner:string,wine:WineRow,stableTargets:ResearchTarget[],cache:Map<ResearchScope,CachedResearch>){
  if(cache.size===stableTargets.length)return cache;
  const priorTargetSets=[buildResearchTargets({producer:wine.producer,producerId:wine.producer_id,wineName:wine.wine_name,vintage:wine.vintage,country:wine.country,region:wine.region,appellation:wine.appellation}),buildResearchTargets({producer:wine.producer,wineName:wine.wine_name,vintage:wine.vintage,country:wine.country,region:wine.region,appellation:wine.appellation})];
  const additions:CachedResearch[]=[];for(const oldTargets of priorTargetSets){const oldCache=await loadResearchCache(db,owner,oldTargets);for(const target of stableTargets){if(cache.has(target.scope)||additions.some(x=>x.target.scope===target.scope))continue;const old=oldCache.get(target.scope);if(old)additions.push({...old,target})}}
  if(additions.length){await Promise.all(additions.map(entry=>seedResearchCache(db,owner,entry)));return loadResearchCache(db,owner,stableTargets)}return cache;
}

function cachedContext(cache:Map<ResearchScope,CachedResearch>){
  const get=(scope:ResearchScope,field:string)=>cache.get(scope)?.payload[field]?.trim()||'';
  return [get('producer','producerDetails')&&`Cached producer profile: ${get('producer','producerDetails')}`,get('producer','producerWinemakingPractices')&&`Cached producer-wide winemaking practices: ${get('producer','producerWinemakingPractices')}`,get('terroir','terroir')&&`Cached stable terroir: ${get('terroir','terroir')}`,get('vintage_context','vintageQuality')&&`Cached vintage context: ${get('vintage_context','vintageQuality')}`,get('wine_vintage','summary')&&`Cached exact-wine summary: ${get('wine_vintage','summary')}`].filter(Boolean).join('\n');
}

async function loadWine(db:D1Database,owner:string,wineId:string){
  const wine=await db.prepare('SELECT producer,producer_id,cuvee_id,wine_name,vintage,country,region,appellation,grapes_json,grape_blend_json FROM wines WHERE id=? AND owner_id=?').bind(wineId,owner).first<WineRow>();if(!wine)return null;
  if(!wine.producer_id){const entity=await ensureProducerEntity(db,owner,wine.producer);wine.producer_id=entity.id;await db.prepare('UPDATE wines SET producer_id=? WHERE id=? AND owner_id=?').bind(entity.id,wineId,owner).run()}else await ensureProducerEntity(db,owner,wine.producer);
  return wine;
}

async function prepare(env:Env,owner:string,wineId:string,refresh:'none'|'vintage'|'all'){
  const wine=await loadWine(env.DB,owner,wineId);if(!wine)throw new Error('Wine not found');const targets=researchTargets(wine);await seedProducerProfileResearch(env.DB,owner,wine,targets);
  let cache=await loadResearchCache(env.DB,owner,targets);cache=await bridgePriorCaches(env.DB,owner,wine,targets,cache);cache=await seedFromLegacy(env.DB,owner,wine,targets,cache);
  const force=new Set<ResearchScope>(refresh==='all'?targets.map(x=>x.scope):refresh==='vintage'?(['vintage_context','wine_vintage'] as ResearchScope[]):[]);
  if(force.size){for(const target of targets.filter(x=>force.has(x.scope))){await env.DB.prepare('DELETE FROM research_cache WHERE owner_id=? AND scope=? AND cache_key=?').bind(owner,target.scope,target.cacheKey).run();cache.delete(target.scope)}}
  const missing=targets.filter(target=>!cache.has(target.scope)).map(target=>target.scope);return {wine,targets,cache,missing};
}

function sourcesFrom(metadata?:GroundingMetadata){
  const seen=new Set<string>(),sources:ResearchSource[]=[];for(const chunk of metadata?.groundingChunks??[]){const web=chunk.web;if(!web?.uri||seen.has(web.uri))continue;seen.add(web.uri);sources.push({title:web.title??web.uri,url:web.uri});if(sources.length>=20)break}return sources;
}

type ScopeFeedback=Partial<Record<ResearchScope,string[]>>;
function buildRequest(wine:WineRow,missing:ResearchScope[],cache:Map<ResearchScope,CachedResearch>,feedback:ScopeFeedback={}):GeminiBatchRequest{
  const grapes=parseJson<string[]>(wine.grapes_json,[]),blend=parseJson<Array<{grape:string;percentage?:number|null}>>(wine.grape_blend_json,[]),identity=[wine.producer,wine.wine_name,wine.vintage,wine.appellation,wine.region,wine.country].filter(x=>x!=null&&x!=='').join(' | '),requested=missing.map(scope=>`${scopeNames[scope]} -> ${scopeFields[scope]}`).join('; '),existing=cachedContext(cache)||'No reusable cached research is available yet.';
  const rejected=missing.flatMap(scope=>{const notes=feedback[scope]??[];return notes.length?[`${scopeNames[scope]}:\n${notes.map(note=>`  - ${note}`).join('\n')}`]:[]});
  const correction=rejected.length?`\n\nA previous attempt at these scopes was rejected by WineLog's research quality gate. Fix each stated problem rather than repeating the earlier answer:\n${rejected.join('\n')}\n`:'';
  const prompt=`Research only the missing reusable scopes for this wine using reliable public web sources. Wine: ${identity}. Grapes: ${grapes.join(', ')||'unknown'}. Known blend: ${blend.map(x=>`${x.grape}${x.percentage!=null?` ${x.percentage}%`:''}`).join(', ')||'unknown'}.\n\nMissing scopes: ${requested}.${correction}\n\nScope boundaries are strict:\n- producer profile and general practices: producerDetails covers stable history, ownership, philosophy and producer-wide facts. producerWinemakingPractices covers only general domaine-wide viticulture/cellar practices and philosophy. Explicitly note when practices vary by cuvee or vintage. Do not present a vintage-specific percentage or technique here.\n- wine/cru terroir: stable facts about this exact wine, cru, vineyard or site such as classification, parcel/site identity, soils, exposition and enduring terroir. Do not include vintage weather.\n- appellation/region vintage context: for the stated vintage only, research growing-season weather, harvest conditions and quality at the most specific reliable appellation/region level. Do not include producer history.\n- exact wine + vintage: summary, winemakingTechniques and drinkingWindow belong to this producer + cuvee + vintage combination. winemakingTechniques must contain only techniques verified for this exact wine/vintage. Do not copy a general producer habit into this field as though it were verified for this vintage. If exact-vintage technique cannot be verified, say that clearly and refer to the separate producer-wide practices only as context.\n\nFor precise exact-wine technical facts, compare credible sources instead of silently choosing one figure. If reliable sources disagree on the same percentage, dosage, fermentation/maceration/elevage duration, temperature, yield, density, bottling/disgorgement date or other exact technical value, keep each source-specific value as a separate atomic sentence or bullet and then explicitly state that the sources conflict or differ. If the discrepancy may reflect different lots, bottlings, releases or disgorgements, say so rather than treating either value as universally correct. Never average conflicting figures or hide the disagreement.\n\nAlready cached facts must be reused as context rather than researched again:\n${existing}\n\nReturn JSON only with exactly these seven string fields: summary, vintageQuality, producerDetails, producerWinemakingPractices, winemakingTechniques, terroir, drinkingWindow. For fields belonging to scopes that are NOT listed as missing, return an empty string. For a requested field where a precise claim cannot be verified, state the uncertainty rather than substituting another vintage.\n\nMake each non-empty field readable in the WineLog detail page without losing research depth. Preserve important names, dates, classifications, site details, weather context, technical winemaking terms, drinking-window assumptions and uncertainty. Keep independently supportable factual claims atomic: use one factual proposition per sentence or bullet instead of combining unrelated facts. Use short paragraphs separated by blank lines. When several discrete facts are clearer as a list, put each item on its own line prefixed with "- ". Do not add Markdown headings inside the field because the application already supplies section headings.`;
  const responseSchema={type:'OBJECT',properties:{summary:{type:'STRING'},vintageQuality:{type:'STRING'},producerDetails:{type:'STRING'},producerWinemakingPractices:{type:'STRING'},winemakingTechniques:{type:'STRING'},terroir:{type:'STRING'},drinkingWindow:{type:'STRING'}},required:['summary','vintageQuality','producerDetails','producerWinemakingPractices','winemakingTechniques','terroir','drinkingWindow']};
  return {key:BATCH_KEY,request:{contents:[{role:'user',parts:[{text:prompt}]}],tools:[{google_search:{}}],generationConfig:{responseMimeType:'application/json',responseSchema,maxOutputTokens:12288}}};
}

async function syncProducerScope(db:D1Database,owner:string,wine:WineRow,entry:CachedResearch){
  if(!wine.producer_id||entry.target.scope!=='producer')return;const details=entry.payload.producerDetails?.trim()||'',practices=entry.payload.producerWinemakingPractices?.trim()||'';if(!details&&!practices)return;
  await db.prepare(`UPDATE producers SET profile=CASE WHEN trim(coalesce(profile,''))='' THEN ? ELSE profile END,winemaking_practices=CASE WHEN trim(coalesce(winemaking_practices,''))='' THEN ? ELSE winemaking_practices END,updated_at=? WHERE owner_id=? AND id=?`).bind(details,practices,now(),owner,wine.producer_id).run();
}

async function finalize(env:Env,owner:string,wineId:string,wine:WineRow,targets:ResearchTarget[]){
  const cache=await loadResearchCache(env.DB,owner,targets),missing=targets.filter(target=>!cache.has(target.scope));if(missing.length)throw new Error(`Deep Search cache is incomplete: ${missing.map(x=>scopeNames[x.scope]).join(', ')}`);
  const result=assembleDeepSearch(cache,targets);await saveSnapshot(env.DB,owner,wineId,result);return result;
}

async function cancelAttemptBatch(env:Env,requestId:string,wineId:string,attempt:number,googleName:string,reason:string){
  const cancelled=await cancelGeminiBatch(env.GEMINI_API_KEY,googleName);
  if(!cancelled.ok)log('warn',{requestId,wineId,stage:'batch_cancel_failed',attempt,googleName,reason,status:cancelled.status,error:cancelled.error});
}

async function submitAttempt(env:Env,owner:string,wineId:string,requestId:string,attempt:number,scopes:ResearchScope[],feedback:ScopeFeedback={}){
  const wine=await loadWine(env.DB,owner,wineId);if(!wine)throw new Error('Wine not found');const targets=researchTargets(wine),cache=await loadResearchCache(env.DB,owner,targets),entry=buildRequest(wine,scopes,cache,feedback),model=attempt===1?PRIMARY_MODEL:FALLBACK_MODEL;let googleName:string|undefined,jobId:string|undefined;
  try{
    googleName=await createGeminiBatch(env.GEMINI_API_KEY,model,`winelog-wine-${requestId}-${attempt}`,[entry]);
    jobId=await createResearchBatchJob(env.DB,{owner,requestId,targetKind:'wine',targetId:wineId,googleBatchName:googleName,model,attempt,keys:scopes});
    await updateWineResearchRun(env.DB,owner,requestId,'researching',attempt===1?`Submitted ${scopes.length} missing Deep Search scope${scopes.length===1?'':'s'} to Gemini 3.7 Batch`:`Switching ${scopes.length} unfinished Deep Search scope${scopes.length===1?'':'s'} to Gemini 3.6 Batch`,'running',attempt);
    await env.RESEARCH_QUEUE.send({kind:'wine_batch_poll',owner,wineId,requestId,jobId,pollCount:0},{delaySeconds:researchBatchPollDelay(0)});log('log',{requestId,wineId,stage:'batch_submitted',attempt,model,scopes,googleName});
  }catch(e){
    const error=(e as Error).message||'Wine Batch submission failed';
    if(jobId)await finishResearchBatchJob(env.DB,owner,jobId,'failed',`Batch setup failed: ${error}`).catch(()=>undefined);
    if(googleName)await cancelAttemptBatch(env,requestId,wineId,attempt,googleName,'submission setup failed');
    throw e;
  }
}

export async function startWineBatchResearch(env:Env,owner:string,wineId:string,requestId:string,refresh:'none'|'vintage'|'all'){
  let prepared:Awaited<ReturnType<typeof prepare>>;
  try{prepared=await prepare(env,owner,wineId,refresh)}catch(e){const error=(e as Error).message||'Could not prepare wine research';await updateWineResearchRun(env.DB,owner,requestId,'failed',error,'failed').catch(()=>undefined);return {ok:false as const,error}}
  if(!prepared.missing.length){try{await finalize(env,owner,wineId,prepared.wine,prepared.targets);await updateWineResearchRun(env.DB,owner,requestId,'complete','Deep Search already complete from reusable cached research','complete',0);return {ok:true as const,cached:true}}catch(e){const error=(e as Error).message||'Could not finalize cached wine research';await updateWineResearchRun(env.DB,owner,requestId,'failed',error,'failed').catch(()=>undefined);return {ok:false as const,error}}}
  try{await submitAttempt(env,owner,wineId,requestId,1,prepared.missing);return {ok:true as const,cached:false}}
  catch(e){
    const primaryError=(e as Error).message||'Gemini 3.7 Batch submission failed';log('warn',{requestId,wineId,stage:'primary_submit_failed',attempt:1,error:primaryError});
    try{await submitAttempt(env,owner,wineId,requestId,2,prepared.missing);return {ok:true as const,cached:false}}
    catch(fallback){const error=`Gemini 3.7 submission failed (${primaryError}); Gemini 3.6 fallback also failed: ${(fallback as Error).message||'unknown error'}`;await updateWineResearchRun(env.DB,owner,requestId,'failed',error,'failed',2).catch(()=>undefined);return {ok:false as const,error}}
  }
}

async function retryOrFail(env:Env,owner:string,wineId:string,requestId:string,attempt:number,failed:ResearchScope[],errors:string[],feedback:ScopeFeedback={}){
  if(attempt===1&&failed.length){
    try{await submitAttempt(env,owner,wineId,requestId,2,failed,feedback);return}
    catch(e){
      const fallbackError=(e as Error).message||'Fallback Gemini Batch submission failed';
      await updateWineResearchRun(env.DB,owner,requestId,'failed',`Deep Search saved any successful scopes, but the retry for ${failed.map(scope=>scopeNames[scope]).join(', ')} could not be submitted: ${fallbackError}`,'failed',2);
      log('error',{requestId,wineId,stage:'fallback_submit_failed',attempt:2,failed,error:fallbackError});
      return;
    }
  }
  await updateWineResearchRun(env.DB,owner,requestId,'failed',`Deep Search saved any successful scopes but could not complete ${failed.map(scope=>scopeNames[scope]).join(', ')}: ${errors.join('; ')}`,'failed',attempt);
}

export async function pollWineBatchResearch(env:Env,owner:string,wineId:string,requestId:string,jobId:string,pollCount:number){
  const job=await getResearchBatchJob(env.DB,owner,jobId);if(!job||job.status!=='running')return;const scopes=job.keys as ResearchScope[],fetched=await fetchGeminiBatch(env.GEMINI_API_KEY,job.googleBatchName);
  if(!fetched.ok){
    if(fetched.status===429||fetched.status>=500){
      const action=researchBatchTransientAction(job.attempt,pollCount);
      if(action==='retry'){await touchResearchBatchJob(env.DB,owner,jobId);await env.RESEARCH_QUEUE.send({kind:'wine_batch_poll',owner,wineId,requestId,jobId,pollCount:pollCount+1},{delaySeconds:researchBatchErrorPollDelay(pollCount)});return}
      const error=`${job.model} Batch status remained unavailable after ${pollCount+1} checks: ${fetched.error}`;
      await finishResearchBatchJob(env.DB,owner,jobId,'failed',error);await cancelAttemptBatch(env,requestId,wineId,job.attempt,job.googleBatchName,'status endpoint repeatedly unavailable');
      log('warn',{requestId,wineId,stage:action==='fallback'?'primary_status_failover':'fallback_status_failed',attempt:job.attempt,model:job.model,pollCount,error});
      await retryOrFail(env,owner,wineId,requestId,job.attempt,scopes,[error]);return;
    }
    await finishResearchBatchJob(env.DB,owner,jobId,'failed',fetched.error);await retryOrFail(env,owner,wineId,requestId,job.attempt,scopes,[fetched.error]);return;
  }
  if(!isTerminalBatchState(fetched.state)){
    const action=researchBatchStallAction(job.attempt,pollCount);
    if(action==='retry'){await touchResearchBatchJob(env.DB,owner,jobId);await updateWineResearchRun(env.DB,owner,requestId,'researching',`Gemini ${job.attempt===1?'3.7':'3.6'} Batch is processing ${scopes.length} Deep Search scope${scopes.length===1?'':'s'}`,'running',job.attempt);await env.RESEARCH_QUEUE.send({kind:'wine_batch_poll',owner,wineId,requestId,jobId,pollCount:pollCount+1},{delaySeconds:researchBatchPollDelay(pollCount)});return}
    const error=`${job.model} Batch did not complete within WineLog's ${job.attempt===1?'primary failover':'fallback'} window (last state ${fetched.state||'unknown'})`;
    await finishResearchBatchJob(env.DB,owner,jobId,'failed',error);await cancelAttemptBatch(env,requestId,wineId,job.attempt,job.googleBatchName,'batch exceeded failover window');
    log('warn',{requestId,wineId,stage:action==='fallback'?'primary_stall_failover':'fallback_stall_failed',attempt:job.attempt,model:job.model,pollCount,state:fetched.state,error});
    await retryOrFail(env,owner,wineId,requestId,job.attempt,scopes,[error]);return;
  }
  if(fetched.state!=='JOB_STATE_SUCCEEDED'){const error=String((fetched.payload.error as {message?:unknown}|undefined)?.message||`Gemini batch ended with ${fetched.state}`);await finishResearchBatchJob(env.DB,owner,jobId,'failed',error);await retryOrFail(env,owner,wineId,requestId,job.attempt,scopes,[error]);return}
  await updateWineResearchRun(env.DB,owner,requestId,'saving','Saving completed Gemini Batch Deep Search scopes','running',job.attempt);
  const inline=responsesByKey(fetched.responses).get(BATCH_KEY)??fetched.responses[0];if(!inline?.response){const error=inline?.error?.message||'Gemini returned no wine research result';await finishResearchBatchJob(env.DB,owner,jobId,'failed',error);await retryOrFail(env,owner,wineId,requestId,job.attempt,scopes,[error]);return}
  const text=inlineResponseText(inline),finishReason=inlineFinishReason(inline);let failed=[...scopes],errors:string[]=[],feedback:ScopeFeedback={};
  try{
    const metadata=inlineGroundingMetadata(inline),raw=parseStructuredJsonText(text) as Record<string,unknown>,parsed=deepSearchSchema.safeParse({...raw,sources:sourcesFrom(metadata),model:`${job.model} (batch)`,researchedAt:now()});if(!parsed.success)throw new Error(`Deep Search returned invalid fields: ${parsed.error.issues.map(x=>x.path.join('.')||x.message).join(', ')}`);
    const rawProvenance=buildDeepSearchProvenance(parsed.data,metadata),conflictAudit=auditTechnicalContradictions(parsed.data,rawProvenance),provenance=conflictAudit.provenance,researched:DeepSearchResult={...parsed.data,provenance};
    const wine=await loadWine(env.DB,owner,wineId);if(!wine)throw new Error('Wine not found');const targets=researchTargets(wine),entries=splitDeepSearchResult(researched,targets).filter(entry=>scopes.includes(entry.target.scope));failed=scopes.filter(scope=>!entries.some(entry=>entry.target.scope===scope&&scopeIsComplete(scope,entry.payload)));
    const completeEntries=entries.filter(entry=>scopeIsComplete(entry.target.scope,entry.payload));for(const entry of completeEntries){await upsertResearchCache(env.DB,owner,entry);if(entry.target.scope==='producer')await syncProducerScope(env.DB,owner,wine,entry)}
    if(failed.length){
      // Carry the gate's reasons into the retry: the fallback model is asked to
      // fix what was actually wrong instead of re-answering the same prompt.
      const payloadFor=(scope:ResearchScope)=>Object.fromEntries(fieldsForScope(scope).map(field=>[field,String((researched as unknown as Record<string,unknown>)[field]??'')]));
      feedback=Object.fromEntries(failed.flatMap(scope=>{
        const target=targets.find(item=>item.scope===scope);if(!target)return [];
        const notes=scopeRetryFeedback(scope,payloadFor(scope),target,researched.sources,provenance);
        return notes.length?[[scope,notes] as const]:[];
      }));
      const exactPayload={summary:parsed.data.summary,winemakingTechniques:parsed.data.winemakingTechniques,drinkingWindow:parsed.data.drinkingWindow},conflictError=failed.includes('wine_vintage')?technicalContradictionFailureMessage(exactPayload,rawProvenance):null,technicalError=failed.includes('wine_vintage')?highRiskTechnicalFailureMessage(exactPayload,provenance):null;
      errors=[conflictError??technicalError??`Gemini response was incomplete or failed the research quality gate for ${failed.map(scope=>scopeNames[scope]).join(', ')}`];
    }else await finalize(env,owner,wineId,wine,targets);
  }catch(e){errors=[`${(e as Error).message}${finishReason?` (${finishReason})`:''}`];log('warn',{requestId,wineId,stage:'batch_result_failed',attempt:job.attempt,model:job.model,finishReason,textLength:text.length,textPreview:text.slice(0,500),error:(e as Error).message})}
  await finishResearchBatchJob(env.DB,owner,jobId,failed.length?'failed':'complete',failed.length?errors.join('; '):null);
  if(failed.length){await retryOrFail(env,owner,wineId,requestId,job.attempt,failed,errors,feedback);return}
  await updateWineResearchRun(env.DB,owner,requestId,'complete','Gemini Batch Deep Search complete with claim evidence and contradiction audit','complete',job.attempt);log('log',{requestId,wineId,stage:'complete',attempt:job.attempt,model:job.model,scopes});
}
