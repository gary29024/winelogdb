import { deepSearchSchema, type DeepSearchResult } from '../db/schema';
import { ensureProducerEntity } from '../producers/entities';
import {
  assembleDeepSearch,
  buildResearchTargets,
  loadResearchCache,
  scopeIsComplete,
  seedResearchCache,
  splitDeepSearchResult,
  upsertResearchCache,
  type CachedResearch,
  type ResearchScope,
  type ResearchTarget
} from './cache';

type ResearchEnv={DB:D1Database;GEMINI_API_KEY:string};
type DeepSearchRequest={confirmation?:string;refresh?:'none'|'vintage'|'all'};
type WineRow={producer:string;producer_id:string|null;cuvee_id:string|null;wine_name:string;vintage:number|null;country:string|null;region:string|null;appellation:string|null;grapes_json:string;grape_blend_json:string};
type ApiResult={status:200|400|404|502;body:DeepSearchResult|{error:string}};
type GeminiResponse={candidates?:Array<{content?:{parts?:Array<{text?:string}>};groundingMetadata?:{groundingChunks?:Array<{web?:{title?:string;uri?:string}}>} }>};

const DEEP_SEARCH_MODEL='gemini-3.7-flash';
const DEEP_SEARCH_ATTEMPT_TIMEOUT_MS=360_000;
const parseJson=<T>(raw:unknown,fallback:T):T=>{try{return JSON.parse(String(raw)) as T}catch{return fallback}};
const scopeNames:Record<ResearchScope,string>={producer:'producer profile and general practices',terroir:'wine/cru terroir',vintage_context:'appellation/region vintage context',wine_vintage:'exact wine + vintage'};
const scopeFields:Record<ResearchScope,string>={producer:'producerDetails, producerWinemakingPractices',terroir:'terroir',vintage_context:'vintageQuality',wine_vintage:'summary, winemakingTechniques, drinkingWindow'};

async function saveSnapshot(db:D1Database,owner:string,id:string,result:DeepSearchResult){
  const now=new Date().toISOString();
  await db.prepare('UPDATE wines SET deep_search_json=?,deep_search_model=?,deep_search_updated_at=?,updated_at=? WHERE id=? AND owner_id=?').bind(JSON.stringify(result),result.model,now,now,id,owner).run();
}

async function seedFromLegacy(db:D1Database,owner:string,wine:WineRow,targets:ReturnType<typeof buildResearchTargets>,cache:Map<ResearchScope,CachedResearch>){
  if(cache.size===targets.length)return cache;
  const row=await db.prepare(`SELECT deep_search_json FROM wines WHERE owner_id=? AND producer=? AND wine_name=? AND coalesce(vintage,-1)=coalesce(?,-1) AND coalesce(appellation,'')=coalesce(?,'') AND deep_search_json IS NOT NULL ORDER BY deep_search_updated_at DESC LIMIT 1`).bind(owner,wine.producer,wine.wine_name,wine.vintage,wine.appellation).first<{deep_search_json:string}>();
  if(!row?.deep_search_json)return cache;
  const legacy=deepSearchSchema.safeParse(parseJson(row.deep_search_json,null));
  if(!legacy.success)return cache;
  const seedEntries=splitDeepSearchResult(legacy.data,targets).filter(entry=>!cache.has(entry.target.scope));
  await Promise.all(seedEntries.map(entry=>seedResearchCache(db,owner,entry)));
  return seedEntries.length?loadResearchCache(db,owner,targets):cache;
}

async function bridgePriorCaches(db:D1Database,owner:string,wine:WineRow,stableTargets:ResearchTarget[],cache:Map<ResearchScope,CachedResearch>){
  if(cache.size===stableTargets.length)return cache;
  const priorTargetSets=[
    buildResearchTargets({producer:wine.producer,producerId:wine.producer_id,wineName:wine.wine_name,vintage:wine.vintage,country:wine.country,region:wine.region,appellation:wine.appellation}),
    buildResearchTargets({producer:wine.producer,wineName:wine.wine_name,vintage:wine.vintage,country:wine.country,region:wine.region,appellation:wine.appellation})
  ];
  const additions:CachedResearch[]=[];
  for(const oldTargets of priorTargetSets){
    const oldCache=await loadResearchCache(db,owner,oldTargets);
    for(const stableTarget of stableTargets){
      if(cache.has(stableTarget.scope)||additions.some(x=>x.target.scope===stableTarget.scope))continue;
      const old=oldCache.get(stableTarget.scope);if(old)additions.push({...old,target:stableTarget});
    }
  }
  if(additions.length){
    await Promise.all(additions.map(entry=>seedResearchCache(db,owner,entry)));
    return loadResearchCache(db,owner,stableTargets);
  }
  return cache;
}

function cachedContext(cache:Map<ResearchScope,CachedResearch>){
  const get=(scope:ResearchScope,field:string)=>cache.get(scope)?.payload[field]?.trim()||'';
  return [
    get('producer','producerDetails')&&`Cached producer profile: ${get('producer','producerDetails')}`,
    get('producer','producerWinemakingPractices')&&`Cached producer-wide winemaking practices: ${get('producer','producerWinemakingPractices')}`,
    get('terroir','terroir')&&`Cached stable terroir: ${get('terroir','terroir')}`,
    get('vintage_context','vintageQuality')&&`Cached vintage context: ${get('vintage_context','vintageQuality')}`,
    get('wine_vintage','summary')&&`Cached exact-wine summary: ${get('wine_vintage','summary')}`
  ].filter(Boolean).join('\n');
}

const researchTargets=(wine:WineRow)=>buildResearchTargets({producer:wine.producer,producerId:wine.producer_id,cuveeId:wine.cuvee_id,wineName:wine.wine_name,vintage:wine.vintage,country:wine.country,region:wine.region,appellation:wine.appellation});

async function seedProducerProfileResearch(db:D1Database,owner:string,wine:WineRow,targets:ResearchTarget[]){
  if(!wine.producer_id)return;
  const target=targets.find(x=>x.scope==='producer');if(!target)return;
  const row=await db.prepare('SELECT profile,winemaking_practices,sources_json,research_model,researched_at FROM producers WHERE owner_id=? AND id=?').bind(owner,wine.producer_id).first<{profile:string;winemaking_practices:string;sources_json:string;research_model:string|null;researched_at:string|null}>();
  if(!row?.profile?.trim()||!row.winemaking_practices?.trim())return;
  await upsertResearchCache(db,owner,{target,payload:{producerDetails:row.profile.trim(),producerWinemakingPractices:row.winemaking_practices.trim()},sources:parseJson(row.sources_json,[]),model:row.research_model||'producer-research',researchedAt:row.researched_at||new Date().toISOString()});
}

async function syncProducerScope(db:D1Database,owner:string,wine:WineRow,entry:CachedResearch){
  if(!wine.producer_id||entry.target.scope!=='producer')return;
  const details=entry.payload.producerDetails?.trim()||'',practices=entry.payload.producerWinemakingPractices?.trim()||'';
  if(!details&&!practices)return;
  await db.prepare(`UPDATE producers SET
    profile=CASE WHEN trim(coalesce(profile,''))='' THEN ? ELSE profile END,
    winemaking_practices=CASE WHEN trim(coalesce(winemaking_practices,''))='' THEN ? ELSE winemaking_practices END,
    updated_at=? WHERE owner_id=? AND id=?`).bind(details,practices,new Date().toISOString(),owner,wine.producer_id).run();
}

async function fetchGemini(url:string,body:string){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),DEEP_SEARCH_ATTEMPT_TIMEOUT_MS);
  try{return await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body,signal:controller.signal})}
  catch(e){if(controller.signal.aborted)throw new Error(`Deep Search timed out after ${DEEP_SEARCH_ATTEMPT_TIMEOUT_MS/60000} minutes while waiting for Gemini 3.7`);throw e}
  finally{clearTimeout(timer)}
}

async function researchMissing(env:ResearchEnv,wine:WineRow,missing:ResearchScope[],cache:Map<ResearchScope,CachedResearch>){
  const grapes=parseJson<string[]>(wine.grapes_json,[]),blend=parseJson<Array<{grape:string;percentage?:number|null}>>(wine.grape_blend_json,[]);
  const identity=[wine.producer,wine.wine_name,wine.vintage,wine.appellation,wine.region,wine.country].filter(x=>x!=null&&x!=='').join(' | ');
  const requested=missing.map(scope=>`${scopeNames[scope]} -> ${scopeFields[scope]}`).join('; ');
  const existing=cachedContext(cache)||'No reusable cached research is available yet.';
  const prompt=`Research only the missing reusable scopes for this wine using reliable public web sources. Wine: ${identity}. Grapes: ${grapes.join(', ')||'unknown'}. Known blend: ${blend.map(x=>`${x.grape}${x.percentage!=null?` ${x.percentage}%`:''}`).join(', ')||'unknown'}.

Missing scopes: ${requested}.

Scope boundaries are strict:
- producer profile and general practices: producerDetails covers stable history, ownership, philosophy and producer-wide facts. producerWinemakingPractices covers only general domaine-wide viticulture/cellar practices and philosophy. Explicitly note when practices vary by cuvee or vintage. Do not present a vintage-specific percentage or technique here.
- wine/cru terroir: stable facts about this exact wine, cru, vineyard or site such as classification, parcel/site identity, soils, exposition and enduring terroir. Do not include vintage weather.
- appellation/region vintage context: for the stated vintage only, research growing-season weather, harvest conditions and quality at the most specific reliable appellation/region level. Do not include producer history.
- exact wine + vintage: summary, winemakingTechniques and drinkingWindow belong to this producer + cuvee + vintage combination. winemakingTechniques must contain only techniques verified for this exact wine/vintage (for example actual whole-cluster use, oak/elevage, extraction or blend). Do not copy a general producer habit into this field as though it were verified for this vintage. If exact-vintage technique cannot be verified, say that clearly and refer to the separate producer-wide practices only as context.

Already cached facts must be reused as context rather than researched again:
${existing}

Return JSON only with exactly these seven string fields: summary, vintageQuality, producerDetails, producerWinemakingPractices, winemakingTechniques, terroir, drinkingWindow. For fields belonging to scopes that are NOT listed as missing, return an empty string. For a requested field where a precise claim cannot be verified, state the uncertainty rather than substituting another vintage.

Make each non-empty field readable in the WineLog detail page without losing research depth. Preserve important names, dates, classifications, site details, weather context, technical winemaking terms, drinking-window assumptions and uncertainty. Use short paragraphs separated by blank lines. When several discrete facts are clearer as a list, put each item on its own line prefixed with "- ". Do not add Markdown headings inside the field because the application already supplies section headings.`;
  const requestBody=JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],tools:[{google_search:{}}],generationConfig:{responseMimeType:'application/json',responseSchema:{type:'OBJECT',properties:{summary:{type:'STRING'},vintageQuality:{type:'STRING'},producerDetails:{type:'STRING'},producerWinemakingPractices:{type:'STRING'},winemakingTechniques:{type:'STRING'},terroir:{type:'STRING'},drinkingWindow:{type:'STRING'}},required:['summary','vintageQuality','producerDetails','producerWinemakingPractices','winemakingTechniques','terroir','drinkingWindow']}}});
  let lastError='Deep Search failed';
  for(let attempt=0;attempt<2;attempt++){
    try{
      const response=await fetchGemini(`https://generativelanguage.googleapis.com/v1beta/models/${DEEP_SEARCH_MODEL}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`,requestBody);
      if(!response.ok){lastError=`Deep Search failed (${response.status})`;if(attempt===0&&(response.status===429||response.status>=500)){await new Promise(r=>setTimeout(r,1200));continue}throw new Error(lastError)}
      const gemini=await response.json() as GeminiResponse,candidate=gemini.candidates?.[0],text=candidate?.content?.parts?.map(x=>x.text??'').join('')??'';
      const cleaned=text.replace(/^```(?:json)?\s*|\s*```$/g,'');
      let research:Record<string,unknown>;try{research=JSON.parse(cleaned) as Record<string,unknown>}catch{throw new Error('Deep Search returned an invalid structured response')}
      const seen=new Set<string>(),sources=(candidate?.groundingMetadata?.groundingChunks??[]).flatMap(x=>x.web?.uri?[{title:x.web.title??x.web.uri,url:x.web.uri}]:[]).filter(x=>{if(seen.has(x.url))return false;seen.add(x.url);return true}).slice(0,20);
      const parsed=deepSearchSchema.safeParse({...research,sources,model:DEEP_SEARCH_MODEL,researchedAt:new Date().toISOString()});
      if(!parsed.success)throw new Error(`Deep Search returned invalid fields: ${parsed.error.issues.map(x=>x.path.join('.')||x.message).join(', ')}`);
      const entries=splitDeepSearchResult(parsed.data,researchTargets(wine)).filter(entry=>missing.includes(entry.target.scope));
      const incomplete=missing.filter(scope=>!entries.some(entry=>entry.target.scope===scope&&scopeIsComplete(scope,entry.payload)));
      if(incomplete.length)throw new Error(`Deep Search did not return complete ${incomplete.map(scope=>scopeNames[scope]).join(', ')} research`);
      return entries;
    }catch(e){lastError=(e as Error).message||'Deep Search failed';if(attempt===0){await new Promise(r=>setTimeout(r,1200));continue}}
  }
  throw new Error(lastError);
}

export async function runLayeredDeepSearch(env:ResearchEnv,owner:string,id:string,body:DeepSearchRequest):Promise<ApiResult>{
  if(body.confirmation!=='RUN_DEEP_SEARCH')return {status:400,body:{error:'Deep Search requires explicit confirmation'}};
  const wine=await env.DB.prepare('SELECT producer,producer_id,cuvee_id,wine_name,vintage,country,region,appellation,grapes_json,grape_blend_json FROM wines WHERE id=? AND owner_id=?').bind(id,owner).first<WineRow>();
  if(!wine)return {status:404,body:{error:'Not found'}};
  if(!wine.producer_id){
    const entity=await ensureProducerEntity(env.DB,owner,wine.producer);
    wine.producer_id=entity.id;
    await env.DB.prepare('UPDATE wines SET producer_id=? WHERE id=? AND owner_id=?').bind(entity.id,id,owner).run();
  }else{
    await ensureProducerEntity(env.DB,owner,wine.producer);
  }
  const targets=researchTargets(wine);
  await seedProducerProfileResearch(env.DB,owner,wine,targets);
  let cache=await loadResearchCache(env.DB,owner,targets);
  cache=await bridgePriorCaches(env.DB,owner,wine,targets,cache);
  cache=await seedFromLegacy(env.DB,owner,wine,targets,cache);
  const refresh=body.refresh??'none';
  const forceScopes=new Set<ResearchScope>(refresh==='all'?targets.map(x=>x.scope):refresh==='vintage'?(['vintage_context','wine_vintage'] as ResearchScope[]):[]);
  for(const scope of forceScopes)cache.delete(scope);
  const missingScopes=targets.filter(target=>!cache.has(target.scope)).map(target=>target.scope);
  if(missingScopes.length){
    try{
      const researched=await researchMissing(env,wine,missingScopes,cache);
      await Promise.all(researched.map(entry=>upsertResearchCache(env.DB,owner,entry)));
      for(const entry of researched){cache.set(entry.target.scope,entry);if(entry.target.scope==='producer')await syncProducerScope(env.DB,owner,wine,entry)}
    }catch(e){return {status:502,body:{error:(e as Error).message||'Deep Search failed'}}}
  }
  const stillMissing=targets.filter(target=>!cache.has(target.scope));
  if(stillMissing.length)return {status:502,body:{error:`Deep Search cache is incomplete: ${stillMissing.map(x=>scopeNames[x.scope]).join(', ')}`}};
  const result=assembleDeepSearch(cache,targets);
  await saveSnapshot(env.DB,owner,id,result);
  return {status:200,body:result};
}
