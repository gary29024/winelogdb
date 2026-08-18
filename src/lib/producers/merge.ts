import { buildResearchTargets,scopeIsComplete,type ResearchScope } from '../research/cache';
import { normalizeProducerAlias } from './entities';

type Source={title:string;url:string};
type ProducerRow={id:string;canonical_name:string;home_country:string|null;home_region:string|null;home_locality:string|null;profile:string;catalog_json:string;sources_json:string;research_model:string|null;researched_at:string|null};
type CacheRow={scope:ResearchScope;cache_key:string;subject_json:string;result_json:string;sources_json:string;model:string;researched_at:string;created_at:string;updated_at:string};
type AliasRow={normalized_alias:string;display_alias:string};

type ArchiveInput={originId:string;originName:string;type:string;payload:string;sources:string;model:string|null;researchedAt:string|null};

const parseJson=<T>(raw:unknown,fallback:T):T=>{try{return JSON.parse(String(raw)) as T}catch{return fallback}};
const time=(value:string|null|undefined)=>{const parsed=value?Date.parse(value):NaN;return Number.isFinite(parsed)?parsed:0};

export function mergeSources(...lists:Source[][]){
  const seen=new Set<string>();
  return lists.flat().filter(source=>{if(!source?.url||seen.has(source.url))return false;seen.add(source.url);return true}).slice(0,40);
}

export function pickNewestResearch<T extends {researched_at:string|null}>(rows:T[]){
  return [...rows].sort((a,b)=>time(b.researched_at)-time(a.researched_at))[0]??null;
}

function archiveStatement(db:D1Database,owner:string,destinationId:string,archive:ArchiveInput,now:string){
  return db.prepare(`INSERT INTO producer_research_history(id,owner_id,producer_id,origin_producer_id,origin_name,research_type,payload_json,sources_json,model,researched_at,archived_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),owner,destinationId,archive.originId,archive.originName,archive.type,archive.payload,archive.sources,archive.model,archive.researchedAt,now);
}

function producerHasResearch(row:ProducerRow){return Boolean(row.researched_at&&row.profile.trim())}

export async function mergeProducerEntities(db:D1Database,owner:string,destinationId:string,sourceId:string){
  if(!destinationId||!sourceId||destinationId===sourceId)throw new Error('Choose a different producer to link');
  const [destination,source]=await Promise.all([
    db.prepare('SELECT id,canonical_name,home_country,home_region,home_locality,profile,catalog_json,sources_json,research_model,researched_at FROM producers WHERE owner_id=? AND id=?').bind(owner,destinationId).first<ProducerRow>(),
    db.prepare('SELECT id,canonical_name,home_country,home_region,home_locality,profile,catalog_json,sources_json,research_model,researched_at FROM producers WHERE owner_id=? AND id=?').bind(owner,sourceId).first<ProducerRow>()
  ]);
  if(!destination||!source)throw new Error('Producer not found');

  const [destinationAliases,sourceAliases,cacheRows]=await Promise.all([
    db.prepare('SELECT normalized_alias,display_alias FROM producer_aliases WHERE owner_id=? AND producer_id=?').bind(owner,destinationId).all<AliasRow>(),
    db.prepare('SELECT normalized_alias,display_alias FROM producer_aliases WHERE owner_id=? AND producer_id=?').bind(owner,sourceId).all<AliasRow>(),
    db.prepare(`SELECT scope,cache_key,subject_json,result_json,sources_json,model,researched_at,created_at,updated_at
      FROM research_cache WHERE owner_id=? AND scope IN ('producer','terroir','wine_vintage')`).bind(owner).all<CacheRow>()
  ]);

  const destinationNames=new Set(destinationAliases.results.map(x=>x.normalized_alias));
  destinationNames.add(normalizeProducerAlias(destination.canonical_name));
  const sourceNames=new Set(sourceAliases.results.map(x=>x.normalized_alias));
  sourceNames.add(normalizeProducerAlias(source.canonical_name));
  const now=new Date().toISOString();
  const statements:D1PreparedStatement[]=[];

  const producerResearch=[destination,source].filter(producerHasResearch);
  for(const row of producerResearch){
    statements.push(archiveStatement(db,owner,destinationId,{originId:row.id,originName:row.canonical_name,type:'producer_record',payload:JSON.stringify({homeCountry:row.home_country,homeRegion:row.home_region,homeLocality:row.home_locality,profile:row.profile,catalog:parseJson(row.catalog_json,[])}),sources:row.sources_json,model:row.research_model,researchedAt:row.researched_at},now));
  }
  const activeProducer=pickNewestResearch(producerResearch);
  if(activeProducer){
    const combined=mergeSources(parseJson<Source[]>(destination.sources_json,[]),parseJson<Source[]>(source.sources_json,[]));
    statements.push(db.prepare(`UPDATE producers SET home_country=?,home_region=?,home_locality=?,profile=?,catalog_json=?,sources_json=?,research_model=?,researched_at=?,updated_at=? WHERE owner_id=? AND id=?`).bind(activeProducer.home_country,activeProducer.home_region,activeProducer.home_locality,activeProducer.profile,activeProducer.catalog_json,JSON.stringify(combined),activeProducer.research_model,activeProducer.researched_at,now,owner,destinationId));
  }

  const groups=new Map<string,{target:ReturnType<typeof buildResearchTargets>[number];rows:Array<CacheRow&{originId:string;originName:string}>}>();
  for(const row of cacheRows.results){
    const subject=parseJson<Record<string,unknown>>(row.subject_json,{});
    const producerId=typeof subject.producerId==='string'?subject.producerId:'';
    const producerName=typeof subject.producer==='string'?normalizeProducerAlias(subject.producer):'';
    let originId='',originName='';
    if(producerId===sourceId||(!producerId&&sourceNames.has(producerName))){originId=sourceId;originName=source.canonical_name}
    else if(producerId===destinationId||(!producerId&&destinationNames.has(producerName))){originId=destinationId;originName=destination.canonical_name}
    else continue;
    const targets=buildResearchTargets({producer:destination.canonical_name,producerId:destinationId,wineName:subject.wineName,vintage:subject.vintage,country:subject.country,region:subject.region,appellation:subject.appellation});
    const target=targets.find(x=>x.scope===row.scope);if(!target)continue;
    const key=`${row.scope}:${target.cacheKey}`;
    const group=groups.get(key)??{target,rows:[]};group.rows.push({...row,originId,originName});groups.set(key,group);
  }

  for(const group of groups.values()){
    for(const row of group.rows){
      statements.push(archiveStatement(db,owner,destinationId,{originId:row.originId,originName:row.originName,type:`cache:${row.scope}`,payload:row.result_json,sources:row.sources_json,model:row.model,researchedAt:row.researched_at},now));
    }
    const complete=group.rows.filter(row=>scopeIsComplete(row.scope,parseJson<Record<string,string>>(row.result_json,{})));
    const active=pickNewestResearch(complete);
    if(active){
      const sources=mergeSources(...group.rows.map(row=>parseJson<Source[]>(row.sources_json,[])));
      const subject={...group.target.subject,producer:destination.canonical_name,producerId:destinationId};
      statements.push(db.prepare(`INSERT INTO research_cache(owner_id,scope,cache_key,subject_json,result_json,sources_json,model,researched_at,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(owner_id,scope,cache_key) DO UPDATE SET subject_json=excluded.subject_json,result_json=excluded.result_json,sources_json=excluded.sources_json,model=excluded.model,researched_at=excluded.researched_at,updated_at=excluded.updated_at`).bind(owner,group.target.scope,group.target.cacheKey,JSON.stringify(subject),active.result_json,JSON.stringify(sources),active.model,active.researched_at,active.created_at||now,now));
    }
    for(const row of group.rows){if(row.cache_key!==group.target.cacheKey)statements.push(db.prepare('DELETE FROM research_cache WHERE owner_id=? AND scope=? AND cache_key=?').bind(owner,row.scope,row.cache_key))}
  }

  for(const alias of sourceAliases.results){statements.push(db.prepare(`INSERT INTO producer_aliases(owner_id,normalized_alias,producer_id,display_alias,created_at) VALUES(?,?,?,?,?)
    ON CONFLICT(owner_id,normalized_alias) DO UPDATE SET producer_id=excluded.producer_id,display_alias=excluded.display_alias`).bind(owner,alias.normalized_alias,destinationId,alias.display_alias,now))}
  statements.push(db.prepare(`INSERT INTO producer_aliases(owner_id,normalized_alias,producer_id,display_alias,created_at) VALUES(?,?,?,?,?)
    ON CONFLICT(owner_id,normalized_alias) DO UPDATE SET producer_id=excluded.producer_id,display_alias=excluded.display_alias`).bind(owner,normalizeProducerAlias(source.canonical_name),destinationId,source.canonical_name,now));
  statements.push(db.prepare('UPDATE wines SET producer_id=? WHERE owner_id=? AND producer_id=?').bind(destinationId,owner,sourceId));
  statements.push(db.prepare('DELETE FROM producer_aliases WHERE owner_id=? AND producer_id=?').bind(owner,sourceId));
  statements.push(db.prepare('DELETE FROM producers WHERE owner_id=? AND id=?').bind(owner,sourceId));
  statements.push(db.prepare('UPDATE producers SET updated_at=? WHERE owner_id=? AND id=?').bind(now,owner,destinationId));

  await db.batch(statements);
  return {destinationId,canonicalName:destination.canonical_name,mergedName:source.canonical_name};
}
