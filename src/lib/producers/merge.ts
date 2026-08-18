import { buildResearchTargets,scopeIsComplete,type ResearchScope } from '../research/cache';
import { normalizeProducerAlias } from './entities';

type Source={title:string;url:string};
type ProducerRow={
  id:string;canonical_name:string;match_key:string;home_country:string|null;home_region:string|null;home_locality:string|null;
  official_website_url?:string|null;instagram_url?:string|null;contact_email?:string|null;contact_phone?:string|null;contact_sources_json?:string|null;
  hero_image_object_key?:string|null;hero_image_source_url?:string|null;
  profile:string;winemaking_practices?:string|null;catalog_json:string;sources_json:string;research_model:string|null;researched_at:string|null;created_at:string;updated_at:string
};
type CacheRow={scope:ResearchScope;cache_key:string;subject_json:string;result_json:string;sources_json:string;model:string;researched_at:string;created_at:string;updated_at:string};
type AliasRow={normalized_alias:string;display_alias:string};
type HistoryRow={origin_producer_id:string;origin_name:string;research_type:string;payload_json:string;sources_json:string;model:string|null;researched_at:string|null};
type MergeRow={id:string;destination_producer_id:string;source_producer_id:string;source_canonical_name:string;source_match_key:string;destination_snapshot_json:string;source_snapshot_json:string;source_aliases_json:string;source_wine_ids_json:string;merged_at:string;undone_at:string|null};
type ArchivedCache={subjectJson:string;resultJson:string;createdAt:string;updatedAt:string};
type ArchiveInput={mergeId:string;originId:string;originName:string;type:string;payload:string;sources:string;model:string|null;researchedAt:string|null};

const parseJson=<T>(raw:unknown,fallback:T):T=>{try{return JSON.parse(String(raw)) as T}catch{return fallback}};
const time=(value:string|null|undefined)=>{const parsed=value?Date.parse(value):NaN;return Number.isFinite(parsed)?parsed:0};
const producerColumns='id,canonical_name,match_key,home_country,home_region,home_locality,official_website_url,instagram_url,contact_email,contact_phone,contact_sources_json,hero_image_object_key,hero_image_source_url,profile,winemaking_practices,catalog_json,sources_json,research_model,researched_at,created_at,updated_at';

export function mergeSources(...lists:Source[][]){
  const seen=new Set<string>();
  return lists.flat().filter(source=>{if(!source?.url||seen.has(source.url))return false;seen.add(source.url);return true}).slice(0,40);
}

export function pickNewestResearch<T extends {researched_at:string|null}>(rows:T[]){
  return [...rows].sort((a,b)=>time(b.researched_at)-time(a.researched_at))[0]??null;
}

export function shouldRestorePreMerge(updatedAt:string|null|undefined,mergedAt:string){
  return time(updatedAt)<=time(mergedAt);
}

function archiveStatement(db:D1Database,owner:string,destinationId:string,archive:ArchiveInput,now:string){
  return db.prepare(`INSERT INTO producer_research_history(id,owner_id,producer_id,origin_producer_id,origin_name,research_type,payload_json,sources_json,model,researched_at,archived_at,merge_id)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),owner,destinationId,archive.originId,archive.originName,archive.type,archive.payload,archive.sources,archive.model,archive.researchedAt,now,archive.mergeId);
}

function producerHasResearch(row:ProducerRow){return Boolean(row.researched_at&&row.profile.trim())}
const producerSnapshot=(row:ProducerRow)=>JSON.stringify(row);
const cacheSnapshot=(row:CacheRow)=>JSON.stringify({subjectJson:row.subject_json,resultJson:row.result_json,createdAt:row.created_at,updatedAt:row.updated_at} satisfies ArchivedCache);

function targetFor(scope:ResearchScope,producer:ProducerRow,subjectJson:string){
  const subject=parseJson<Record<string,unknown>>(subjectJson,{});
  return buildResearchTargets({producer:producer.canonical_name,producerId:producer.id,wineName:subject.wineName,vintage:subject.vintage,country:subject.country,region:subject.region,appellation:subject.appellation}).find(x=>x.scope===scope)??null;
}

function cacheUpsert(db:D1Database,owner:string,target:ReturnType<typeof buildResearchTargets>[number],producer:ProducerRow,archive:HistoryRow,stored:ArchivedCache,now:string){
  const subject={...target.subject,producer:producer.canonical_name,producerId:producer.id};
  return db.prepare(`INSERT INTO research_cache(owner_id,scope,cache_key,subject_json,result_json,sources_json,model,researched_at,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(owner_id,scope,cache_key) DO UPDATE SET subject_json=excluded.subject_json,result_json=excluded.result_json,sources_json=excluded.sources_json,model=excluded.model,researched_at=excluded.researched_at,updated_at=excluded.updated_at`)
    .bind(owner,target.scope,target.cacheKey,JSON.stringify(subject),stored.resultJson,archive.sources_json,archive.model??'unknown',archive.researched_at??now,stored.createdAt||now,now);
}

export async function mergeProducerEntities(db:D1Database,owner:string,destinationId:string,sourceId:string){
  if(!destinationId||!sourceId||destinationId===sourceId)throw new Error('Choose a different producer to link');
  const [destination,source]=await Promise.all([
    db.prepare(`SELECT ${producerColumns} FROM producers WHERE owner_id=? AND id=?`).bind(owner,destinationId).first<ProducerRow>(),
    db.prepare(`SELECT ${producerColumns} FROM producers WHERE owner_id=? AND id=?`).bind(owner,sourceId).first<ProducerRow>()
  ]);
  if(!destination||!source)throw new Error('Producer not found');

  const [destinationAliases,sourceAliases,sourceWines,cacheRows]=await Promise.all([
    db.prepare('SELECT normalized_alias,display_alias FROM producer_aliases WHERE owner_id=? AND producer_id=?').bind(owner,destinationId).all<AliasRow>(),
    db.prepare('SELECT normalized_alias,display_alias FROM producer_aliases WHERE owner_id=? AND producer_id=?').bind(owner,sourceId).all<AliasRow>(),
    db.prepare('SELECT id FROM wines WHERE owner_id=? AND producer_id=?').bind(owner,sourceId).all<{id:string}>(),
    db.prepare(`SELECT scope,cache_key,subject_json,result_json,sources_json,model,researched_at,created_at,updated_at
      FROM research_cache WHERE owner_id=? AND scope IN ('producer','terroir','wine_vintage')`).bind(owner).all<CacheRow>()
  ]);

  const destinationNames=new Set(destinationAliases.results.map(x=>x.normalized_alias));
  destinationNames.add(normalizeProducerAlias(destination.canonical_name));
  const sourceNames=new Set(sourceAliases.results.map(x=>x.normalized_alias));
  sourceNames.add(normalizeProducerAlias(source.canonical_name));
  const now=new Date().toISOString(),mergeId=crypto.randomUUID();
  const statements:D1PreparedStatement[]=[
    db.prepare(`INSERT INTO producer_merges(id,owner_id,destination_producer_id,source_producer_id,source_canonical_name,source_match_key,destination_snapshot_json,source_snapshot_json,source_aliases_json,source_wine_ids_json,merged_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(mergeId,owner,destinationId,sourceId,source.canonical_name,source.match_key,producerSnapshot(destination),producerSnapshot(source),JSON.stringify(sourceAliases.results),JSON.stringify(sourceWines.results.map(x=>x.id)),now)
  ];

  const producerResearch=[destination,source].filter(producerHasResearch);
  for(const row of producerResearch){
    statements.push(archiveStatement(db,owner,destinationId,{mergeId,originId:row.id,originName:row.canonical_name,type:'producer_record',payload:JSON.stringify({homeCountry:row.home_country,homeRegion:row.home_region,homeLocality:row.home_locality,officialWebsiteUrl:row.official_website_url??null,instagramUrl:row.instagram_url??null,contactEmail:row.contact_email??null,contactPhone:row.contact_phone??null,contactSources:parseJson(row.contact_sources_json,[]),heroImageObjectKey:row.hero_image_object_key??null,heroImageSourceUrl:row.hero_image_source_url??null,profile:row.profile,winemakingPractices:row.winemaking_practices??'',catalog:parseJson(row.catalog_json,[])}),sources:row.sources_json,model:row.research_model,researchedAt:row.researched_at},now));
  }
  const activeProducer=pickNewestResearch(producerResearch);
  if(activeProducer){
    const combined=mergeSources(parseJson<Source[]>(destination.sources_json,[]),parseJson<Source[]>(source.sources_json,[]));
    const combinedContactSources=mergeSources(parseJson<Source[]>(destination.contact_sources_json,[]),parseJson<Source[]>(source.contact_sources_json,[]));
    const mediaProducer=activeProducer.hero_image_object_key?activeProducer:destination.hero_image_object_key?destination:source.hero_image_object_key?source:activeProducer;
    const officialWebsite=activeProducer.official_website_url??mediaProducer.official_website_url??destination.official_website_url??source.official_website_url??null;
    const instagram=activeProducer.instagram_url??destination.instagram_url??source.instagram_url??null;
    const contactEmail=activeProducer.contact_email??destination.contact_email??source.contact_email??null;
    const contactPhone=activeProducer.contact_phone??destination.contact_phone??source.contact_phone??null;
    statements.push(db.prepare(`UPDATE producers SET home_country=?,home_region=?,home_locality=?,official_website_url=?,instagram_url=?,contact_email=?,contact_phone=?,contact_sources_json=?,hero_image_object_key=?,hero_image_source_url=?,profile=?,winemaking_practices=?,catalog_json=?,sources_json=?,research_model=?,researched_at=?,updated_at=? WHERE owner_id=? AND id=?`).bind(activeProducer.home_country,activeProducer.home_region,activeProducer.home_locality,officialWebsite,instagram,contactEmail,contactPhone,JSON.stringify(combinedContactSources),mediaProducer.hero_image_object_key??null,mediaProducer.hero_image_source_url??null,activeProducer.profile,activeProducer.winemaking_practices??'',activeProducer.catalog_json,JSON.stringify(combined),activeProducer.research_model,activeProducer.researched_at,now,owner,destinationId));
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
    const target=targetFor(row.scope,destination,row.subject_json);if(!target)continue;
    const key=`${row.scope}:${target.cacheKey}`;
    const group=groups.get(key)??{target,rows:[]};group.rows.push({...row,originId,originName});groups.set(key,group);
  }

  for(const group of groups.values()){
    for(const row of group.rows){
      statements.push(archiveStatement(db,owner,destinationId,{mergeId,originId:row.originId,originName:row.originName,type:`cache:${row.scope}`,payload:cacheSnapshot(row),sources:row.sources_json,model:row.model,researchedAt:row.researched_at},now));
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
  return {mergeId,destinationId,canonicalName:destination.canonical_name,mergedName:source.canonical_name};
}

export async function unlinkProducerMerge(db:D1Database,owner:string,destinationId:string,mergeId:string){
  const merge=await db.prepare(`SELECT id,destination_producer_id,source_producer_id,source_canonical_name,source_match_key,destination_snapshot_json,source_snapshot_json,source_aliases_json,source_wine_ids_json,merged_at,undone_at
    FROM producer_merges WHERE owner_id=? AND id=? AND destination_producer_id=? AND undone_at IS NULL`).bind(owner,mergeId,destinationId).first<MergeRow>();
  if(!merge)throw new Error('Linked producer record not found or already unlinked');
  const source=parseJson<ProducerRow|null>(merge.source_snapshot_json,null),destinationBefore=parseJson<ProducerRow|null>(merge.destination_snapshot_json,null);
  if(!source||!destinationBefore)throw new Error('Merge history is incomplete and cannot be safely reversed');

  const [destination,currentSource,matchConflict,history,currentCaches]=await Promise.all([
    db.prepare(`SELECT ${producerColumns} FROM producers WHERE owner_id=? AND id=?`).bind(owner,destinationId).first<ProducerRow>(),
    db.prepare('SELECT id FROM producers WHERE owner_id=? AND id=?').bind(owner,source.id).first<{id:string}>(),
    db.prepare('SELECT id FROM producers WHERE owner_id=? AND match_key=? AND id<>? LIMIT 1').bind(owner,source.match_key,source.id).first<{id:string}>(),
    db.prepare('SELECT origin_producer_id,origin_name,research_type,payload_json,sources_json,model,researched_at FROM producer_research_history WHERE owner_id=? AND merge_id=?').bind(owner,mergeId).all<HistoryRow>(),
    db.prepare(`SELECT scope,cache_key,subject_json,result_json,sources_json,model,researched_at,created_at,updated_at FROM research_cache WHERE owner_id=? AND scope IN ('producer','terroir','wine_vintage')`).bind(owner).all<CacheRow>()
  ]);
  if(!destination)throw new Error('Canonical producer no longer exists');
  if(currentSource||matchConflict)throw new Error('The original producer identity now conflicts with an existing producer; resolve that producer first');

  const aliases=parseJson<AliasRow[]>(merge.source_aliases_json,[]);
  if(!aliases.some(x=>x.normalized_alias===normalizeProducerAlias(source.canonical_name)))aliases.push({normalized_alias:normalizeProducerAlias(source.canonical_name),display_alias:source.canonical_name});
  for(const alias of aliases){
    const existing=await db.prepare('SELECT producer_id FROM producer_aliases WHERE owner_id=? AND normalized_alias=?').bind(owner,alias.normalized_alias).first<{producer_id:string}>();
    if(existing&&existing.producer_id!==destinationId)throw new Error(`Alias “${alias.display_alias}” is now linked elsewhere and cannot be safely restored`);
  }

  const now=new Date().toISOString(),statements:D1PreparedStatement[]=[];
  statements.push(db.prepare(`INSERT INTO producers(id,owner_id,canonical_name,match_key,home_country,home_region,home_locality,official_website_url,instagram_url,contact_email,contact_phone,contact_sources_json,hero_image_object_key,hero_image_source_url,profile,winemaking_practices,catalog_json,sources_json,research_model,researched_at,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(source.id,owner,source.canonical_name,source.match_key,source.home_country,source.home_region,source.home_locality,source.official_website_url??null,source.instagram_url??null,source.contact_email??null,source.contact_phone??null,source.contact_sources_json??'[]',source.hero_image_object_key??null,source.hero_image_source_url??null,source.profile,source.winemaking_practices??'',source.catalog_json,source.sources_json,source.research_model,source.researched_at,source.created_at||now,now));

  for(const alias of aliases){
    statements.push(db.prepare(`INSERT INTO producer_aliases(owner_id,normalized_alias,producer_id,display_alias,created_at) VALUES(?,?,?,?,?)
      ON CONFLICT(owner_id,normalized_alias) DO UPDATE SET producer_id=excluded.producer_id,display_alias=excluded.display_alias`).bind(owner,alias.normalized_alias,source.id,alias.display_alias,now));
  }

  for(const wineId of parseJson<string[]>(merge.source_wine_ids_json,[])){
    statements.push(db.prepare('UPDATE wines SET producer_id=? WHERE owner_id=? AND id=? AND producer_id=?').bind(source.id,owner,wineId,destinationId));
  }

  const cacheHistory=history.results.filter(x=>x.research_type.startsWith('cache:'));
  const currentMap=new Map(currentCaches.results.map(row=>[`${row.scope}:${row.cache_key}`,row]));
  const groups=new Map<string,{target:ReturnType<typeof buildResearchTargets>[number];destinationArchive?:HistoryRow;sourceArchives:HistoryRow[]}>();
  for(const archive of cacheHistory){
    const scope=archive.research_type.slice(6) as ResearchScope;
    if(!['producer','terroir','wine_vintage'].includes(scope))continue;
    const stored=parseJson<ArchivedCache|null>(archive.payload_json,null);if(!stored?.subjectJson||!stored.resultJson)continue;
    const target=targetFor(scope,destination,stored.subjectJson);if(!target)continue;
    const key=`${scope}:${target.cacheKey}`;
    const group=groups.get(key)??{target,sourceArchives:[]};
    if(archive.origin_producer_id===destinationId)group.destinationArchive=archive;
    if(archive.origin_producer_id===source.id)group.sourceArchives.push(archive);
    groups.set(key,group);
  }

  for(const group of groups.values()){
    for(const archive of group.sourceArchives){
      const stored=parseJson<ArchivedCache|null>(archive.payload_json,null);if(!stored)continue;
      const sourceTarget=targetFor(group.target.scope,source,stored.subjectJson);if(sourceTarget)statements.push(cacheUpsert(db,owner,sourceTarget,source,archive,stored,now));
    }
    const current=currentMap.get(`${group.target.scope}:${group.target.cacheKey}`);
    if(!current||shouldRestorePreMerge(current.updated_at,merge.merged_at)){
      if(group.destinationArchive){
        const stored=parseJson<ArchivedCache|null>(group.destinationArchive.payload_json,null);
        if(stored)statements.push(cacheUpsert(db,owner,group.target,destinationBefore,group.destinationArchive,stored,now));
      }else if(current){
        statements.push(db.prepare('DELETE FROM research_cache WHERE owner_id=? AND scope=? AND cache_key=?').bind(owner,group.target.scope,group.target.cacheKey));
      }
    }
  }

  if(shouldRestorePreMerge(destination.updated_at,merge.merged_at)){
    statements.push(db.prepare(`UPDATE producers SET canonical_name=?,match_key=?,home_country=?,home_region=?,home_locality=?,official_website_url=?,instagram_url=?,contact_email=?,contact_phone=?,contact_sources_json=?,hero_image_object_key=?,hero_image_source_url=?,profile=?,winemaking_practices=?,catalog_json=?,sources_json=?,research_model=?,researched_at=?,updated_at=? WHERE owner_id=? AND id=?`).bind(destinationBefore.canonical_name,destinationBefore.match_key,destinationBefore.home_country,destinationBefore.home_region,destinationBefore.home_locality,destinationBefore.official_website_url??null,destinationBefore.instagram_url??null,destinationBefore.contact_email??null,destinationBefore.contact_phone??null,destinationBefore.contact_sources_json??'[]',destinationBefore.hero_image_object_key??null,destinationBefore.hero_image_source_url??null,destinationBefore.profile,destinationBefore.winemaking_practices??'',destinationBefore.catalog_json,destinationBefore.sources_json,destinationBefore.research_model,destinationBefore.researched_at,now,owner,destinationId));
  }

  statements.push(db.prepare('UPDATE producer_merges SET undone_at=? WHERE owner_id=? AND id=? AND undone_at IS NULL').bind(now,owner,mergeId));
  await db.batch(statements);
  return {destinationId,restoredProducerId:source.id,canonicalName:destination.canonical_name,unlinkedName:source.canonical_name};
}
