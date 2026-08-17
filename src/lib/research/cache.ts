import type { DeepSearchResult } from '../db/schema';

export const researchScopes=['producer','terroir','vintage_context','wine_vintage'] as const;
export type ResearchScope=typeof researchScopes[number];
export type ResearchSource={title:string;url:string};
export type ResearchTarget={scope:ResearchScope;cacheKey:string;subject:Record<string,string|number|null>};
export type CachedResearch={target:ResearchTarget;payload:Record<string,string>;sources:ResearchSource[];model:string;researchedAt:string};
export type ResearchWine={producer?:unknown;wineName?:unknown;vintage?:unknown;country?:unknown;region?:unknown;appellation?:unknown};

type CacheRow={scope:ResearchScope;cache_key:string;subject_json:string;result_json:string;sources_json:string;model:string;researched_at:string};

const parseJson=<T>(raw:unknown,fallback:T):T=>{try{return JSON.parse(String(raw)) as T}catch{return fallback}};
const text=(value:unknown)=>typeof value==='string'?value.trim():value==null?'':String(value).trim();
const normalized=(value:unknown)=>text(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’'`]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const makeKey=(...parts:unknown[])=>JSON.stringify(parts.map(normalized));

export function buildResearchTargets(wine:ResearchWine):ResearchTarget[]{
  const producer=text(wine.producer),wineName=text(wine.wineName),country=text(wine.country),region=text(wine.region),appellation=text(wine.appellation);
  const vintage=typeof wine.vintage==='number'&&Number.isFinite(wine.vintage)?wine.vintage:null;
  const targets:ResearchTarget[]=[
    {scope:'producer',cacheKey:makeKey(producer),subject:{producer}},
    {scope:'terroir',cacheKey:makeKey(producer,wineName,appellation,region,country),subject:{producer,wineName,appellation:appellation||null,region:region||null,country:country||null}}
  ];
  if(vintage!=null)targets.push({scope:'vintage_context',cacheKey:makeKey(country,region,appellation,vintage),subject:{country:country||null,region:region||null,appellation:appellation||null,vintage}});
  targets.push({scope:'wine_vintage',cacheKey:makeKey(producer,wineName,vintage??'NV',appellation,region,country),subject:{producer,wineName,vintage,appellation:appellation||null,region:region||null,country:country||null}});
  return targets;
}

export function fieldsForScope(scope:ResearchScope){
  if(scope==='producer')return ['producerDetails'] as const;
  if(scope==='terroir')return ['terroir'] as const;
  if(scope==='vintage_context')return ['vintageQuality'] as const;
  return ['summary','winemakingTechniques','drinkingWindow'] as const;
}

export function scopeIsComplete(scope:ResearchScope,payload:Record<string,string>){return fieldsForScope(scope).every(field=>Boolean(payload[field]?.trim()));}

export async function loadResearchCache(db:D1Database,owner:string,targets:ResearchTarget[]){
  const found=await Promise.all(targets.map(async target=>{
    const row=await db.prepare('SELECT scope,cache_key,subject_json,result_json,sources_json,model,researched_at FROM research_cache WHERE owner_id=? AND scope=? AND cache_key=?').bind(owner,target.scope,target.cacheKey).first<CacheRow>();
    if(!row)return null;
    const payload=parseJson<Record<string,string>>(row.result_json,{});
    if(!scopeIsComplete(target.scope,payload))return null;
    return {scope:target.scope,entry:{target,payload,sources:parseJson<ResearchSource[]>(row.sources_json,[]),model:row.model,researchedAt:row.researched_at} as CachedResearch};
  }));
  const cache=new Map<ResearchScope,CachedResearch>();
  for(const item of found)if(item)cache.set(item.scope,item.entry);
  return cache;
}

async function writeCache(db:D1Database,owner:string,entry:CachedResearch,replace:boolean){
  const now=new Date().toISOString();
  const sql=replace
    ?`INSERT INTO research_cache(owner_id,scope,cache_key,subject_json,result_json,sources_json,model,researched_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(owner_id,scope,cache_key) DO UPDATE SET subject_json=excluded.subject_json,result_json=excluded.result_json,sources_json=excluded.sources_json,model=excluded.model,researched_at=excluded.researched_at,updated_at=excluded.updated_at`
    :`INSERT INTO research_cache(owner_id,scope,cache_key,subject_json,result_json,sources_json,model,researched_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(owner_id,scope,cache_key) DO NOTHING`;
  await db.prepare(sql).bind(owner,entry.target.scope,entry.target.cacheKey,JSON.stringify(entry.target.subject),JSON.stringify(entry.payload),JSON.stringify(entry.sources),entry.model,entry.researchedAt,now,now).run();
}
export const seedResearchCache=(db:D1Database,owner:string,entry:CachedResearch)=>writeCache(db,owner,entry,false);
export const upsertResearchCache=(db:D1Database,owner:string,entry:CachedResearch)=>writeCache(db,owner,entry,true);

export function splitDeepSearchResult(result:DeepSearchResult,targets:ResearchTarget[]){
  const byScope:Record<ResearchScope,Record<string,string>>={
    producer:{producerDetails:result.producerDetails},
    terroir:{terroir:result.terroir},
    vintage_context:{vintageQuality:result.vintageQuality},
    wine_vintage:{summary:result.summary,winemakingTechniques:result.winemakingTechniques,drinkingWindow:result.drinkingWindow}
  };
  return targets.map(target=>({target,payload:byScope[target.scope],sources:result.sources,model:result.model,researchedAt:result.researchedAt} satisfies CachedResearch)).filter(entry=>scopeIsComplete(entry.target.scope,entry.payload));
}

export function assembleDeepSearch(cache:Map<ResearchScope,CachedResearch>,targets:ResearchTarget[]):DeepSearchResult{
  const payload=(scope:ResearchScope)=>cache.get(scope)?.payload??{};
  const entries=targets.map(target=>cache.get(target.scope)).filter((x):x is CachedResearch=>Boolean(x));
  const seen=new Set<string>();
  const sources=entries.flatMap(x=>x.sources).filter(source=>{if(!source.url||seen.has(source.url))return false;seen.add(source.url);return true}).slice(0,20);
  const timestamps=entries.map(x=>Date.parse(x.researchedAt)).filter(Number.isFinite);
  const researchedAt=timestamps.length?new Date(Math.max(...timestamps)).toISOString():new Date().toISOString();
  return {
    summary:payload('wine_vintage').summary??'',
    vintageQuality:payload('vintage_context').vintageQuality??'',
    producerDetails:payload('producer').producerDetails??'',
    winemakingTechniques:payload('wine_vintage').winemakingTechniques??'',
    terroir:payload('terroir').terroir??'',
    drinkingWindow:payload('wine_vintage').drinkingWindow??'',
    sources,
    model:entries.find(x=>x.model)?.model??'gemini-3.6-flash',
    researchedAt
  };
}
