import { AI_MODELS } from '../ai/policy';
import { deepSearchProvenanceSchema,deepSearchSchema,type DeepSearchProvenance,type DeepSearchResult } from '../db/schema';
import { assessResearchScope,buildDeepResearchQuality,legacyOptionalFieldMissing } from './qualityGate';
import { highRiskTechnicalScopePasses } from './technicalClaimGate';
import { auditTechnicalContradictions,disputedTechnicalClaimCount,technicalContradictionScopePasses } from './technicalContradictions';
import { friendResearchBatch,publishResearch } from './shared';

export const researchScopes=['producer','terroir','vintage_context','wine_vintage'] as const;
export type ResearchScope=typeof researchScopes[number];
export type ResearchSource={title:string;url:string};
/** What the sharing key is built from. Kept apart from `subject`, which is the
 * quality gate's input and is persisted as subject_json, so widening one cannot
 * quietly change the other. */
export type ResearchIdentity={producer:string;wineName:string;country:string|null;region:string|null;appellation:string|null;wineStyle:string|null;vintage:number|null;
  /** A non-vintage release: its edition name, base year and disgorgement. */
  releaseDesignation?:string|null;baseVintage?:number|null;disgorgement?:string|null};
export type ResearchTarget={scope:ResearchScope;cacheKey:string;subject:Record<string,string|number|null>;identity?:ResearchIdentity};
export type CachedResearch={target:ResearchTarget;payload:Record<string,string>;sources:ResearchSource[];provenance?:DeepSearchProvenance;model:string;researchedAt:string;contributorId?:string};
export type ResearchWine={producer?:unknown;producerId?:unknown;cuveeId?:unknown;wineName?:unknown;vintage?:unknown;country?:unknown;region?:unknown;appellation?:unknown;wineStyle?:unknown;releaseDesignation?:unknown;baseVintage?:unknown;disgorgement?:unknown};

type CacheRow={scope:ResearchScope;cache_key:string;subject_json:string;result_json:string;sources_json:string;provenance_json:string;model:string;researched_at:string;source_user_id?:string|null};

const parseJson=<T>(raw:unknown,fallback:T):T=>{try{return JSON.parse(String(raw)) as T}catch{return fallback}};
const text=(value:unknown)=>typeof value==='string'?value.trim():value==null?'':String(value).trim();
const normalized=(value:unknown)=>text(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’'`]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
/**
 * The normalizer cache keys were built with before Unicode letters were kept.
 *
 * `[^a-z0-9]` erased every non-Latin character, so a producer written in Chinese,
 * Cyrillic or Greek normalized to the empty string. Widening it to `\p{L}\p{N}`
 * was right, but it also changed the key of every row already written for such a
 * wine. Those rows are still perfectly good research; without this they would be
 * orphaned and re-bought at full price. Only ever read from - nothing new is
 * written under a legacy key.
 */
const legacyNormalized=(value:unknown)=>text(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’'`]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const makeKey=(...parts:unknown[])=>JSON.stringify(parts.map(normalized));
const makeLegacyKey=(...parts:unknown[])=>JSON.stringify(parts.map(legacyNormalized));
const parseProvenance=(raw:unknown)=>{const parsed=deepSearchProvenanceSchema.safeParse(parseJson(raw,null));return parsed.success?parsed.data:undefined};

/**
 * What tells one release of a non-vintage wine from another: an edition name
 * ("171ème Édition", "Iteration 25"), a base year, a disgorgement. Krug 169 and
 * 171 are different blends, so each gets its own exact-wine research. A wine
 * with a vintage is already identified by it, and one with none of these keeps
 * the single generic non-vintage key it always had.
 */
function editionOf(wine:ResearchWine,vintage:number|null){
  if(vintage!=null)return null;
  const releaseDesignation=text(wine.releaseDesignation)||null,disgorgement=text(wine.disgorgement)||null;
  const baseVintage=typeof wine.baseVintage==='number'&&Number.isFinite(wine.baseVintage)?wine.baseVintage:null;
  return releaseDesignation||baseVintage!=null||disgorgement?{releaseDesignation,baseVintage,disgorgement}:null;
}

function researchTargetsWith(wine:ResearchWine,key:(...parts:unknown[])=>string):ResearchTarget[]{
  const producer=text(wine.producer),producerId=text(wine.producerId),cuveeId=text(wine.cuveeId),wineName=text(wine.wineName),country=text(wine.country),region=text(wine.region),appellation=text(wine.appellation),wineStyle=text(wine.wineStyle);
  const vintage=typeof wine.vintage==='number'&&Number.isFinite(wine.vintage)?wine.vintage:null,edition=editionOf(wine,vintage);
  const producerIdentity=producerId?`producer:${producerId}`:producer;
  const wineIdentity=cuveeId?`cuvee:${cuveeId}`:wineName;
  const identity:ResearchIdentity={producer,wineName,country:country||null,region:region||null,appellation:appellation||null,wineStyle:wineStyle||null,vintage,...edition??{}};
  const targets:ResearchTarget[]=[
    {scope:'producer',cacheKey:key(producerIdentity),subject:{producer,producerId:producerId||null},identity},
    {scope:'terroir',cacheKey:key(producerIdentity,wineIdentity,appellation,region,country),subject:{producer,producerId:producerId||null,cuveeId:cuveeId||null,wineName,appellation:appellation||null,region:region||null,country:country||null},identity}
  ];
  if(vintage!=null)targets.push({scope:'vintage_context',cacheKey:key(country,region,appellation,vintage),subject:{country:country||null,region:region||null,appellation:appellation||null,vintage},identity});
  // A non-vintage release with a known base year: that year's growing season
  // shaped the blend, so its regional vintage context is researched too. It is
  // the same key and subject as that year's vintage context, so research already
  // held for the year is reused rather than bought again.
  else if(edition?.baseVintage!=null)targets.push({scope:'vintage_context',cacheKey:key(country,region,appellation,edition.baseVintage),subject:{country:country||null,region:region||null,appellation:appellation||null,vintage:edition.baseVintage},identity:{...identity,vintage:edition.baseVintage}});
  const exactKey=edition
    ?key(producerIdentity,wineIdentity,'NV',appellation,region,country,edition.releaseDesignation,edition.baseVintage,edition.disgorgement)
    :key(producerIdentity,wineIdentity,vintage??'NV',appellation,region,country);
  targets.push({scope:'wine_vintage',cacheKey:exactKey,subject:{producer,producerId:producerId||null,cuveeId:cuveeId||null,wineName,vintage,appellation:appellation||null,region:region||null,country:country||null,...edition??{}},identity});
  return targets;
}
export const buildResearchTargets=(wine:ResearchWine)=>researchTargetsWith(wine,makeKey);
/**
 * A wine row's targets. Edition details come from wines.release_designation and
 * the sparkling details' base year and disgorgement, when the row carries them
 * (see RESEARCH_EDITION_COLUMNS); a row read without them keys as before.
 */
export const wineRowResearchTargets=(row:Record<string,unknown>)=>{
  const sparkling=parseJson<Record<string,unknown>>(row.sparkling_details_json,{})??{};
  return buildResearchTargets({producer:row.producer,producerId:row.producer_id,cuveeId:row.cuvee_id,wineName:row.wine_name,vintage:row.vintage,country:row.country,region:row.region,appellation:row.appellation,wineStyle:row.wine_style,
    releaseDesignation:row.release_designation,baseVintage:sparkling.baseVintage,disgorgement:sparkling.disgorgement});
};
/** Select these alongside a wines row aliased `w` so its research targets know the release. */
export const RESEARCH_EDITION_COLUMNS="w.release_designation,(SELECT sd.details_json FROM wine_sparkling_details sd WHERE sd.owner_id=w.owner_id AND sd.wine_id=w.id) AS sparkling_details_json";
/** The same targets keyed the way they were before non-Latin names stopped
 * collapsing to the empty string. Read-only: used to recover rows written then. */
export const buildLegacyResearchTargets=(wine:ResearchWine)=>researchTargetsWith(wine,makeLegacyKey);

export function fieldsForScope(scope:ResearchScope){
  if(scope==='producer')return ['producerDetails','producerWinemakingPractices'] as const;
  if(scope==='terroir')return ['terroir'] as const;
  if(scope==='vintage_context')return ['vintageQuality'] as const;
  return ['summary','expectedProfile','winemakingTechniques','drinkingWindow'] as const;
}
function fieldIsMissing(field:string,payload:Record<string,string>){
  return !legacyOptionalFieldMissing(field,payload)&&!payload[field]?.trim();
}
export function scopeIsComplete(scope:ResearchScope,payload:Record<string,string>){return fieldsForScope(scope).every(field=>!fieldIsMissing(field,payload));}
export function scopePassesQuality(scope:ResearchScope,payload:Record<string,string>,target:ResearchTarget,sources:ResearchSource[],provenance?:DeepSearchProvenance){
  return scopeIsComplete(scope,payload)&&assessResearchScope(scope,payload,target.subject,sources).pass&&highRiskTechnicalScopePasses(scope,payload,provenance)&&technicalContradictionScopePasses(scope,payload,provenance);
}
const RETRY_INSTRUCTIONS:Record<string,string>={
  'missing-field':'a required field was empty — return substantive text for every field of this scope, or an explicit statement that the fact could not be verified',
  'no-grounding-source':'no web source backed this scope — ground every claim in a retrievable public source rather than answering from memory',
  'wrong-vintage-reference':'the text asserted a year other than the requested vintage without ever naming it — write about the requested vintage, and mark any other year clearly as historical or comparative context',
  'general-practice-presented-as-exact-vintage':'a general domaine habit was presented as verified for this exact vintage — either cite the technique for this vintage specifically, or say plainly that exact-vintage technique could not be verified',
  'vintage-specific-detail-in-producer-scope':'a vintage-specific figure appeared in the producer-wide scope — keep producerWinemakingPractices to habits that hold across vintages, and note where practice varies'
};

/** The gate warnings a scope's content raises, as codes rather than prose. */
export function scopeQualityWarnings(scope:ResearchScope,payload:Record<string,string>,target:ResearchTarget,sources:ResearchSource[]){
  const missing=fieldsForScope(scope).some(field=>fieldIsMissing(field,payload))?['missing-field']:[];
  return [...new Set([...missing,...assessResearchScope(scope,payload,target.subject,sources).warnings])];
}

/**
 * Turn a scope's quality-gate rejection into instructions the model can act on.
 * A retry that re-sends a byte-identical prompt asks the same question the same
 * way and tends to fail the same way, so the retry carries the gate's reasons.
 */
export function scopeRetryFeedback(scope:ResearchScope,payload:Record<string,string>,target:ResearchTarget,sources:ResearchSource[],provenance?:DeepSearchProvenance){
  const notes:string[]=[];
  for(const field of fieldsForScope(scope))if(fieldIsMissing(field,payload))notes.push(RETRY_INSTRUCTIONS['missing-field']);
  for(const warning of assessResearchScope(scope,payload,target.subject,sources).warnings){
    const instruction=RETRY_INSTRUCTIONS[warning];if(instruction&&!notes.includes(instruction))notes.push(instruction);
  }
  if(!highRiskTechnicalScopePasses(scope,payload,provenance))notes.push('a high-risk exact technical value was not directly supported by a cited source — either attribute the figure to the source that states it, or omit it and say it could not be verified');
  if(!technicalContradictionScopePasses(scope,payload,provenance))notes.push('sources disagreed on an exact technical value and the disagreement was hidden — keep each source-specific value as its own sentence and state explicitly that the sources conflict');
  return [...new Set(notes)];
}

function provenanceForScope(provenance:DeepSearchProvenance|undefined,scope:ResearchScope){
  if(!provenance)return undefined;const fields:DeepSearchProvenance['fields']={};
  for(const field of fieldsForScope(scope)){const item=provenance.fields[field];if(item)fields[field]=item}
  return Object.keys(fields).length?{version:1 as const,fields}:undefined;
}
function auditedProvenance(scope:ResearchScope,payload:Record<string,string>,provenance?:DeepSearchProvenance){return scope==='wine_vintage'?auditTechnicalContradictions(payload,provenance).provenance:provenance}

function priorResearchTargets(target:ResearchTarget){
  if(!target.identity)return [];
  const wine={...target.identity,producerId:target.subject.producerId,cuveeId:target.subject.cuveeId};
  // Exact-wine research saved before a release's edition was part of its key
  // stays readable under the generic non-vintage key until it is refreshed.
  const generic={...wine,releaseDesignation:null,baseVintage:null,disgorgement:null};
  const shapes=[wine,{...wine,cuveeId:null},{...wine,producerId:null,cuveeId:null},...(editionOf(wine,wine.vintage)?[generic,{...generic,cuveeId:null},{...generic,producerId:null,cuveeId:null}]:[])];
  const candidates=[...shapes.slice(1).flatMap(buildResearchTargets),...shapes.flatMap(buildLegacyResearchTargets)];
  return [...new Map(candidates.filter(item=>item.scope===target.scope&&item.cacheKey!==target.cacheKey).map(item=>[item.cacheKey,item])).values()];
}

// Old ASCII keys can collide for unrelated non-Latin names. Confirm the saved
// subject before recovering a prior key; a matching key alone is not evidence.
function samePriorSubject(row:CacheRow,target:ResearchTarget){
  const subject=parseJson<Record<string,unknown>>(row.subject_json,{});
  return Object.entries(target.subject).every(([key,value])=>{
    if(key==='producer'&&target.subject.producerId)return true;
    if(key==='wineName'&&target.subject.cuveeId)return true;
    return normalized(subject[key])===normalized(value);
  });
}

function recoverSnapshotProvenance(scope:ResearchScope,payload:Record<string,string>,provenance:DeepSearchProvenance|undefined,snapshot?:DeepSearchResult){
  if(Object.keys(provenance?.fields??{}).length||!snapshot?.provenance)return provenance;
  // Older producer merges dropped provenance while copying the text. Restore
  // evidence only from the same scope's exact text, never from a renamed wine's
  // unrelated/stale snapshot or by inventing support from a list of URLs.
  if(!fieldsForScope(scope).every(field=>(payload[field]??'')===(snapshot[field]??'')))return provenance;
  return provenanceForScope(snapshot.provenance,scope);
}

async function readResearchCache(db:D1Database,owner:string,targets:ResearchTarget[],includeFriends:boolean,includePriorKeys:boolean,snapshot?:DeepSearchResult){
  const candidates=targets.map(target=>[target,...(includePriorKeys?priorResearchTargets(target):[])]);
  const lookups=[...new Map(candidates.flat().map(target=>[JSON.stringify([target.scope,target.cacheKey]),{scope:target.scope,cacheKey:target.cacheKey}])).values()];
  const rows=lookups.length?(await db.prepare(`SELECT scope,cache_key,subject_json,result_json,sources_json,provenance_json,model,researched_at,source_user_id
    FROM research_cache WHERE owner_id=? AND (scope,cache_key) IN
      (SELECT json_extract(value,'$.scope'),json_extract(value,'$.cacheKey') FROM json_each(?))`)
    .bind(owner,JSON.stringify(lookups)).all<CacheRow>()).results:[];
  const byKey=new Map(rows.map(row=>[JSON.stringify([row.scope,row.cache_key]),row]));
  const found=targets.map((target,index)=>{
    for(const candidate of candidates[index]){
      const row=byKey.get(JSON.stringify([candidate.scope,candidate.cacheKey]));
      if(!row||(candidate!==target&&!samePriorSubject(row,candidate)))continue;
      const payload=parseJson<Record<string,string>>(row.result_json,{}),sources=parseJson<ResearchSource[]>(row.sources_json,[]),provenance=auditedProvenance(target.scope,payload,recoverSnapshotProvenance(target.scope,payload,parseProvenance(row.provenance_json),snapshot));if(!scopePassesQuality(target.scope,payload,target,sources,provenance))continue;
      return {scope:target.scope,entry:{target,payload,sources,provenance,model:row.model,researchedAt:row.researched_at,...(row.source_user_id?{contributorId:row.source_user_id}:{})} as CachedResearch};
    }
    return null;
  });
  const cache=new Map<ResearchScope,CachedResearch>();for(const item of found)if(item)cache.set(item.scope,item.entry);
  if(includeFriends){
    // One query for every missing scope, rather than one per scope and one per
    // alias key inside it. A wine view used to pay for up to eight sequential
    // round trips here.
    const missing=targets.filter(target=>!cache.has(target.scope));
    if(missing.length){
      const byScope=await friendResearchBatch(db,owner,missing);
      for(const target of missing)for(const entry of byScope.get(target.scope)??[]){
        if(scopePassesQuality(target.scope,entry.payload,target,entry.sources,entry.provenance)){cache.set(target.scope,{...entry,target});break}
      }
    }
  }
  return cache;
}

// Execution after an explicit refresh must only see the new, current-key rows.
export const loadResearchCache=(db:D1Database,owner:string,targets:ResearchTarget[],includeFriends=false)=>readResearchCache(db,owner,targets,includeFriends,false);
// Views, quotes and initial preparation must agree on research saved before
// producer/cuvée IDs were assigned. Recovery is read-only and uses one query.
export function loadWineResearchCache(db:D1Database,owner:string,targets:ResearchTarget[],includeFriends=false,snapshot?:unknown){
  const parsed=deepSearchSchema.safeParse(typeof snapshot==='string'?parseJson(snapshot,null):snapshot);
  return readResearchCache(db,owner,targets,includeFriends,true,parsed.success?parsed.data:undefined);
}

/** Copy already owned scopes to their current identity without republishing an
 * adopted friend's work or overwriting a current result. */
export async function seedResolvedResearch(db:D1Database,owner:string,cache:Map<ResearchScope,CachedResearch>){
  await adoptFriendResearch(db,owner,cache);
  await Promise.all([...cache.values()].filter(entry=>!entry.contributorId||entry.contributorId===owner).map(entry=>seedResearchCache(db,owner,entry)));
  for(const entry of cache.values())if(entry.provenance){
    // Repair missing evidence in place only if the stored text still matches.
    await db.prepare(`UPDATE research_cache SET provenance_json=? WHERE owner_id=? AND scope=? AND cache_key=? AND result_json=? AND model=? AND researched_at=? AND coalesce(provenance_json,'{}') IN ('{}','null','')`)
      .bind(JSON.stringify(entry.provenance),owner,entry.target.scope,entry.target.cacheKey,JSON.stringify(entry.payload),entry.model,entry.researchedAt).run();
  }
}

async function writeCache(db:D1Database,owner:string,entry:CachedResearch,replace:boolean){
  if(entry.contributorId&&entry.contributorId!==owner)return;
  const now=new Date().toISOString();
  const sql=replace?`INSERT INTO research_cache(owner_id,scope,cache_key,subject_json,result_json,sources_json,provenance_json,model,researched_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(owner_id,scope,cache_key) DO UPDATE SET subject_json=excluded.subject_json,result_json=excluded.result_json,sources_json=excluded.sources_json,provenance_json=excluded.provenance_json,model=excluded.model,researched_at=excluded.researched_at,updated_at=excluded.updated_at`:`INSERT INTO research_cache(owner_id,scope,cache_key,subject_json,result_json,sources_json,provenance_json,model,researched_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(owner_id,scope,cache_key) DO NOTHING`;
  await db.prepare(sql).bind(owner,entry.target.scope,entry.target.cacheKey,JSON.stringify(entry.target.subject),JSON.stringify(entry.payload),JSON.stringify(entry.sources),JSON.stringify(entry.provenance??{}),entry.model,entry.researchedAt,now,now).run();
  if(scopePassesQuality(entry.target.scope,entry.payload,entry.target,entry.sources,entry.provenance))await publishResearch(db,owner,entry);
}
export const seedResearchCache=(db:D1Database,owner:string,entry:CachedResearch)=>writeCache(db,owner,entry,false);

/**
 * Keep a friend's research as the reader's own.
 *
 * Assembling a contributor's scopes on every view made the text disappear the
 * moment a friendship ended, and made each repeat view pay for a friendship
 * join. Once a reader has actually been shown a scope it is written to their
 * own cache, tagged with who paid for it.
 *
 * Deliberately not published back to reusable_research: only the account that
 * paid for research offers it to its friends, so a copy cannot spread on the
 * contributor's behalf and attribution cannot drift as it is passed along.
 */
export async function adoptFriendResearch(db:D1Database,owner:string,cache:Map<ResearchScope,CachedResearch>){
  const now=new Date().toISOString();
  for(const entry of cache.values()){
    const contributor=entry.contributorId;
    if(!contributor||contributor===owner)continue;
    await db.prepare(`INSERT INTO research_cache(owner_id,scope,cache_key,subject_json,result_json,sources_json,provenance_json,model,researched_at,source_user_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(owner_id,scope,cache_key) DO NOTHING`)
      .bind(owner,entry.target.scope,entry.target.cacheKey,JSON.stringify(entry.target.subject),JSON.stringify(entry.payload),JSON.stringify(entry.sources),JSON.stringify(entry.provenance??{}),entry.model,entry.researchedAt,contributor,now,now)
      .run().catch(error=>{console.error(JSON.stringify({event:'research_adopt_failed',scope:entry.target.scope,error:(error as Error).message}))});
  }
  return cache;
}
export const upsertResearchCache=(db:D1Database,owner:string,entry:CachedResearch)=>writeCache(db,owner,entry,true);

export function splitDeepSearchResult(result:DeepSearchResult,targets:ResearchTarget[]){
  const byScope:Record<ResearchScope,Record<string,string>>={producer:{producerDetails:result.producerDetails,producerWinemakingPractices:result.producerWinemakingPractices},terroir:{terroir:result.terroir},vintage_context:{vintageQuality:result.vintageQuality},wine_vintage:{summary:result.summary,expectedProfile:result.expectedProfile??'',winemakingTechniques:result.winemakingTechniques,drinkingWindow:result.drinkingWindow}};
  return targets.map(target=>{const raw=provenanceForScope(result.provenance,target.scope),provenance=auditedProvenance(target.scope,byScope[target.scope],raw);return {target,payload:byScope[target.scope],sources:result.sources,provenance,model:result.model,researchedAt:result.researchedAt} satisfies CachedResearch}).filter(entry=>scopePassesQuality(entry.target.scope,entry.payload,entry.target,entry.sources,entry.provenance));
}

export function assembleDeepSearch(cache:Map<ResearchScope,CachedResearch>,targets:ResearchTarget[]):DeepSearchResult{
  const payload=(scope:ResearchScope)=>cache.get(scope)?.payload??{};
  const entries=targets.map(target=>cache.get(target.scope)).filter((x):x is CachedResearch=>Boolean(x));
  const seen=new Set<string>();const sources=entries.flatMap(x=>x.sources).filter(source=>{if(!source.url||seen.has(source.url))return false;seen.add(source.url);return true}).slice(0,20);
  const timestamps=entries.map(x=>Date.parse(x.researchedAt)).filter(Number.isFinite);const researchedAt=timestamps.length?new Date(Math.max(...timestamps)).toISOString():new Date().toISOString();
  // A vintage refresh must not make older reusable producer/terroir scopes look fresh.
  const oldestResearchedAt=timestamps.length?new Date(Math.min(...timestamps)).toISOString():undefined;
  const latestEntry=[...entries].sort((a,b)=>Date.parse(b.researchedAt)-Date.parse(a.researchedAt))[0];
  const provenanceFields:DeepSearchProvenance['fields']={};for(const entry of entries)if(entry.provenance)Object.assign(provenanceFields,entry.provenance.fields);const provenance=Object.keys(provenanceFields).length?{version:1 as const,fields:provenanceFields}:undefined;
  const baseQuality=buildDeepResearchQuality(entries.map(entry=>({scope:entry.target.scope,payload:entry.payload,subject:entry.target.subject,sources:entry.sources}))),disputedCount=disputedTechnicalClaimCount(provenance),quality=disputedCount?{...baseQuality,status:'mixed' as const,scoreNote:undefined,warnings:[...new Set([...baseQuality.warnings,'cross-source-technical-conflict'])].slice(0,20)}:baseQuality;
  return {summary:payload('wine_vintage').summary??'',expectedProfile:payload('wine_vintage').expectedProfile??'',vintageQuality:payload('vintage_context').vintageQuality??'',producerDetails:payload('producer').producerDetails??'',producerWinemakingPractices:payload('producer').producerWinemakingPractices??'',winemakingTechniques:payload('wine_vintage').winemakingTechniques??'',terroir:payload('terroir').terroir??'',drinkingWindow:payload('wine_vintage').drinkingWindow??'',sources,model:latestEntry?.model??AI_MODELS.groundedResearchPrimary,researchedAt,oldestResearchedAt,quality,provenance};
}
