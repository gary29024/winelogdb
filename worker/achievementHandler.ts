import { achievementDefinitions } from '../src/features/achievements/curatedLaunch';
import { buildAllAchievementProgress,normalizeAchievementIdentity } from '../src/features/achievements/engine';
import {
  achievementCatalogueRuleSchema,customAchievementInputSchema,materializeCatalogueAchievementItems,materializeCustomAchievementDefinition,materializeManualAchievementItems,normalizedCustomAchievementInput,
  type StoredCustomAchievementCollection
} from '../src/features/achievements/customCollections';
import { currentOwnerRevision,missingTable } from '../src/lib/db/ownerRevision';
import type {
  AchievementCatalogueOptions,AchievementCatalogueRule,AchievementCuveeIdentity,AchievementIconKey,AchievementMatchMode,AchievementProducerIdentity,AchievementProgress,AchievementWine,CustomAchievementManualItem
} from '../src/features/achievements/types';

type WineRow={id:string;producer_id:string|null;cuvee_id:string|null;producer:string;wine_name:string;vintage:number|null;appellation:string|null};
type ProducerRow={id:string;canonical_name:string;home_country:string|null;home_region:string|null};
type ProducerAliasRow={producer_id:string;display_alias:string};
type CuveeRow={id:string;producer_id:string;canonical_name:string;appellation:string|null;wine_style:string|null;catalog_backed:number};
type CuveeAliasRow={cuvee_id:string;display_alias:string};
type CustomCollectionRow={id:string;title:string;subtitle:string;icon:string;mode:string;items_json:string;rule_json:string|null};
type CacheRow={revision:number;definition_version:number;result_json:string};
type PreferenceRow={collection_id:string;match_mode:string};

type AchievementContext={
  producers:AchievementProducerIdentity[];
  cuvees:AchievementCuveeIdentity[];
  wines:AchievementWine[];
  options:AchievementCatalogueOptions;
};

export const ACHIEVEMENT_DEFINITION_VERSION=3;
const parseJson=<T>(value:unknown,fallback:T):T=>{try{return JSON.parse(String(value)) as T}catch{return fallback}};

function groupedAliases<T extends {display_alias:string}>(rows:T[],id:(row:T)=>string){
  const result=new Map<string,string[]>();
  for(const row of rows){const key=id(row),values=result.get(key)??[];if(row.display_alias&&!values.includes(row.display_alias))values.push(row.display_alias);result.set(key,values)}
  return result;
}

async function loadAchievementContext(db:D1Database,owner:string):Promise<AchievementContext>{
  const [winesResult,producersResult,producerAliasesResult,cuveesResult,cuveeAliasesResult]=await Promise.all([
    db.prepare(`SELECT id,producer_id,cuvee_id,producer,wine_name,vintage,NULLIF(trim(appellation),'') appellation FROM wines WHERE owner_id=?`).bind(owner).all<WineRow>(),
    db.prepare(`SELECT id,canonical_name,NULLIF(trim(home_country),'') home_country,NULLIF(trim(home_region),'') home_region FROM producers WHERE owner_id=?`).bind(owner).all<ProducerRow>(),
    db.prepare(`SELECT producer_id,display_alias FROM producer_aliases WHERE owner_id=?`).bind(owner).all<ProducerAliasRow>(),
    db.prepare(`SELECT id,producer_id,canonical_name,NULLIF(trim(appellation),'') appellation,NULLIF(trim(wine_style),'') wine_style,catalog_backed FROM cuvees WHERE owner_id=?`).bind(owner).all<CuveeRow>(),
    db.prepare(`SELECT cuvee_id,display_alias FROM cuvee_aliases WHERE owner_id=?`).bind(owner).all<CuveeAliasRow>()
  ]);
  const producerAliases=groupedAliases(producerAliasesResult.results,row=>row.producer_id),cuveeAliases=groupedAliases(cuveeAliasesResult.results,row=>row.cuvee_id);
  const producers:AchievementProducerIdentity[]=producersResult.results.map(row=>({id:row.id,canonicalName:row.canonical_name,aliases:producerAliases.get(row.id)??[],country:row.home_country,region:row.home_region}));
  const cuvees:AchievementCuveeIdentity[]=cuveesResult.results.map(row=>({id:row.id,producerId:row.producer_id,canonicalName:row.canonical_name,aliases:cuveeAliases.get(row.id)??[],appellation:row.appellation,wineStyle:row.wine_style,catalogBacked:Boolean(row.catalog_backed)}));
  const wines:AchievementWine[]=winesResult.results.map(row=>({id:row.id,producerId:row.producer_id,cuveeId:row.cuvee_id,producer:row.producer,wineName:row.wine_name,vintage:row.vintage,appellation:row.appellation}));
  const catalogCount=new Map<string,number>();for(const cuvee of cuvees){if(cuvee.catalogBacked)catalogCount.set(cuvee.producerId,(catalogCount.get(cuvee.producerId)??0)+1)}
  const producerOptions=producers.map(producer=>({id:producer.id,name:producer.canonicalName,country:producer.country??null,region:producer.region??null,catalogCount:catalogCount.get(producer.id)??0})).sort((a,b)=>a.name.localeCompare(b.name));
  const producerName=new Map(producerOptions.map(item=>[item.id,item.name]));
  const cuveeOptions=cuvees.map(cuvee=>({id:cuvee.id,producerId:cuvee.producerId,producerName:producerName.get(cuvee.producerId)??'Unknown producer',name:cuvee.canonicalName,appellation:cuvee.appellation??null,wineStyle:cuvee.wineStyle??null,catalogBacked:Boolean(cuvee.catalogBacked)})).sort((a,b)=>a.producerName.localeCompare(b.producerName)||a.name.localeCompare(b.name));
  const appellationMap=new Map<string,{name:string;producers:Set<string>;cuvees:number}>();
  for(const cuvee of cuveeOptions){if(!cuvee.catalogBacked||!cuvee.appellation)continue;const key=normalizeAchievementIdentity(cuvee.appellation),entry=appellationMap.get(key)??{name:cuvee.appellation,producers:new Set<string>(),cuvees:0};entry.producers.add(cuvee.producerId);entry.cuvees+=1;appellationMap.set(key,entry)}
  const appellations=[...appellationMap.values()].map(entry=>({name:entry.name,producerCount:entry.producers.size,cuveeCount:entry.cuvees})).sort((a,b)=>a.name.localeCompare(b.name));
  const regionMap=new Map<string,{name:string;country:string|null;producers:Set<string>}>();
  for(const producer of producerOptions){if(!producer.region||producer.catalogCount<=0)continue;const key=`${normalizeAchievementIdentity(producer.country??'')}::${normalizeAchievementIdentity(producer.region)}`,entry=regionMap.get(key)??{name:producer.region,country:producer.country,producers:new Set<string>()};entry.producers.add(producer.id);regionMap.set(key,entry)}
  const regions=[...regionMap.values()].map(entry=>({name:entry.name,country:entry.country,producerCount:entry.producers.size})).sort((a,b)=>(a.country??'').localeCompare(b.country??'')||a.name.localeCompare(b.name));
  return {producers,cuvees,wines,options:{producers:producerOptions,cuvees:cuveeOptions,appellations,regions}};
}

async function loadCustomRows(db:D1Database,owner:string){
  try{return (await db.prepare(`SELECT id,title,subtitle,icon,mode,items_json,rule_json FROM achievement_custom_collections WHERE owner_id=? ORDER BY created_at ASC`).bind(owner).all<CustomCollectionRow>()).results}
  catch(error){if(missingTable(error))return [];throw error}
}
function rowToStored(row:CustomCollectionRow):StoredCustomAchievementCollection|null{
  const icon=row.icon as AchievementIconKey;if(!['first-growth','judgment-paris','beaujolais-crus','bordeaux-classification','sauternes','graves','saint-emilion','burgundy-grand-cru','gevrey-grand-cru','rhone-crus','michelin-grapes'].includes(icon))return null;
  const mode=row.mode==='catalogue'?'catalogue':row.mode==='manual'?'manual':null;if(!mode)return null;
  const items=parseJson<CustomAchievementManualItem[]>(row.items_json,[]),ruleRaw=row.rule_json?parseJson<unknown>(row.rule_json,null):null,parsedRule=ruleRaw?achievementCatalogueRuleSchema.safeParse(ruleRaw):null;
  return {id:row.id,title:row.title,subtitle:row.subtitle,icon,mode,items,rule:parsedRule?.success?parsedRule.data:null};
}

async function cachedAchievementProgress(db:D1Database,owner:string,revision:number):Promise<AchievementProgress[]|null>{
  try{
    const row=await db.prepare('SELECT revision,definition_version,result_json FROM achievement_progress_cache WHERE owner_id=?').bind(owner).first<CacheRow>();
    if(!row||Number(row.revision)!==revision||Number(row.definition_version)!==ACHIEVEMENT_DEFINITION_VERSION)return null;
    const parsed=parseJson<AchievementProgress[]|null>(row.result_json,null);return Array.isArray(parsed)?parsed:null;
  }catch(error){if(missingTable(error))return null;throw error}
}
async function storeAchievementProgress(db:D1Database,owner:string,revision:number,result:AchievementProgress[]){
  try{await db.prepare(`INSERT INTO achievement_progress_cache(owner_id,revision,definition_version,result_json,updated_at) VALUES(?,?,?,?,?)
    ON CONFLICT(owner_id) DO UPDATE SET revision=excluded.revision,definition_version=excluded.definition_version,result_json=excluded.result_json,updated_at=excluded.updated_at
    WHERE achievement_progress_cache.revision<>excluded.revision OR achievement_progress_cache.definition_version<>excluded.definition_version`)
    .bind(owner,revision,ACHIEVEMENT_DEFINITION_VERSION,JSON.stringify(result),new Date().toISOString()).run()}
  catch(error){if(!missingTable(error))throw error}
}
async function loadMatchModes(db:D1Database,owner:string):Promise<Record<string,AchievementMatchMode>>{
  try{
    const rows=(await db.prepare('SELECT collection_id,match_mode FROM achievement_collection_preferences WHERE owner_id=?').bind(owner).all<PreferenceRow>()).results,result:Record<string,AchievementMatchMode>={};
    for(const row of rows){if(row.match_mode==='exact'||row.match_mode==='cuvee'||row.match_mode==='producer')result[row.collection_id]=row.match_mode}
    return result;
  }catch(error){if(missingTable(error))return {};throw error}
}
async function computeAchievementProgress(db:D1Database,owner:string){
  const [context,customRows,matchModes]=await Promise.all([loadAchievementContext(db,owner),loadCustomRows(db,owner),loadMatchModes(db,owner)]);
  const customDefinitions=customRows.map(rowToStored).filter((row):row is StoredCustomAchievementCollection=>Boolean(row)).map(row=>materializeCustomAchievementDefinition(row,context.options));
  return buildAllAchievementProgress([...achievementDefinitions,...customDefinitions],{producers:context.producers,cuvees:context.cuvees},context.wines,matchModes);
}

// The revision travels with the result so the route can turn it into an ETag and
// answer an unchanged client with 304 rather than re-serializing the whole payload.
export async function loadAchievementProgress(db:D1Database,owner:string,attempt=0):Promise<{revision:number|null;progress:AchievementProgress[]}>{
  const revision=await currentOwnerRevision(db,owner);
  if(revision!==null){const cached=await cachedAchievementProgress(db,owner,revision);if(cached)return {revision,progress:cached}}
  const result=await computeAchievementProgress(db,owner),after=await currentOwnerRevision(db,owner);
  if(revision!==null&&after!==null&&after!==revision&&attempt===0)return loadAchievementProgress(db,owner,1);
  if(after!==null)await storeAchievementProgress(db,owner,after,result);
  return {revision:after,progress:result};
}

export async function loadAchievementCatalogueOptions(db:D1Database,owner:string){return (await loadAchievementContext(db,owner)).options}

function validateManualSelections(items:CustomAchievementManualItem[],options:AchievementCatalogueOptions){
  for(const item of items){
    if(item.type==='producer'&&!options.producers.some(option=>option.id===item.producerId))throw new Error('One selected producer is no longer available');
    if(item.type==='cuvee'&&!options.cuvees.some(option=>option.id===item.cuveeId))throw new Error('One selected cuvée is no longer available');
    if(item.type==='appellation'&&!options.appellations.some(option=>normalizeAchievementIdentity(option.name)===normalizeAchievementIdentity(item.appellation)))throw new Error('One selected appellation is no longer available');
  }
  if(!materializeManualAchievementItems(items,options).length)throw new Error('Choose at least one available catalogue target');
}
function validateRule(rule:AchievementCatalogueRule,options:AchievementCatalogueOptions){if(!materializeCatalogueAchievementItems(rule,options).length)throw new Error('That catalogue rule currently has no available targets')}
async function validatedInput(db:D1Database,owner:string,input:unknown){
  const parsed=customAchievementInputSchema.safeParse(input);if(!parsed.success)return {ok:false as const,error:'Invalid collection',issues:parsed.error.issues};
  const normalized=normalizedCustomAchievementInput(parsed.data),options=await loadAchievementCatalogueOptions(db,owner);
  try{if(normalized.mode==='manual')validateManualSelections(normalized.items??[],options);else if(normalized.rule)validateRule(normalized.rule,options)}catch(error){return {ok:false as const,error:(error as Error).message,issues:[]}}
  return {ok:true as const,input:normalized};
}

export async function createCustomAchievementCollection(db:D1Database,owner:string,input:unknown){
  const validated=await validatedInput(db,owner,input);if(!validated.ok)return validated;
  const id=crypto.randomUUID(),now=new Date().toISOString(),value=validated.input;
  await db.prepare(`INSERT INTO achievement_custom_collections(id,owner_id,title,subtitle,icon,mode,items_json,rule_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)`)
    .bind(id,owner,value.title,value.subtitle,value.icon,value.mode,JSON.stringify(value.items??[]),value.rule?JSON.stringify(value.rule):null,now,now).run();
  return {ok:true as const,id};
}

export async function updateCustomAchievementCollection(db:D1Database,owner:string,id:string,input:unknown){
  const exists=await db.prepare('SELECT id FROM achievement_custom_collections WHERE owner_id=? AND id=?').bind(owner,id).first<{id:string}>();if(!exists)return {ok:false as const,notFound:true as const,error:'Collection not found',issues:[]};
  const validated=await validatedInput(db,owner,input);if(!validated.ok)return validated;
  const value=validated.input,now=new Date().toISOString();
  await db.prepare(`UPDATE achievement_custom_collections SET title=?,subtitle=?,icon=?,mode=?,items_json=?,rule_json=?,updated_at=? WHERE owner_id=? AND id=?`)
    .bind(value.title,value.subtitle,value.icon,value.mode,JSON.stringify(value.items??[]),value.rule?JSON.stringify(value.rule):null,now,owner,id).run();
  return {ok:true as const,id};
}

export async function deleteCustomAchievementCollection(db:D1Database,owner:string,id:string){
  const result=await db.prepare('DELETE FROM achievement_custom_collections WHERE owner_id=? AND id=?').bind(owner,id).run();
  return {deleted:Boolean(result.meta.changes)};
}

export async function setAchievementMatchMode(db:D1Database,owner:string,id:string,input:unknown){
  const body=input as {matchMode?:unknown}|null,mode=body?.matchMode;
  if(mode!=='exact'&&mode!=='cuvee'&&mode!=='producer')return {ok:false as const,error:'Match mode must be exact, cuvee or producer'};
  const definition=achievementDefinitions.find(item=>item.id===id);
  if(!definition)return {ok:false as const,notFound:true as const,error:'Collection not found'};
  if(!definition.items.some(item=>item.selector.type==='wine_vintage'))return {ok:false as const,error:'This collection does not have vintage-specific targets'};
  if(mode==='exact'){
    try{await db.prepare('DELETE FROM achievement_collection_preferences WHERE owner_id=? AND collection_id=?').bind(owner,id).run()}
    catch(error){if(!missingTable(error))throw error}
    return {ok:true as const,matchMode:mode};
  }
  const now=new Date().toISOString();
  try{await db.prepare(`INSERT INTO achievement_collection_preferences(owner_id,collection_id,match_mode,created_at,updated_at) VALUES(?,?,?,?,?)
    ON CONFLICT(owner_id,collection_id) DO UPDATE SET match_mode=excluded.match_mode,updated_at=excluded.updated_at`).bind(owner,id,mode,now,now).run()}
  catch(error){if(missingTable(error))return {ok:false as const,error:'Achievement preference migration is not applied yet'};throw error}
  return {ok:true as const,matchMode:mode};
}
