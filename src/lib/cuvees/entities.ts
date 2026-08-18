import { buildResearchTargets, type ResearchSource } from '../research/cache';

export type CuveeEntity={
  id:string;
  producerId:string;
  canonicalName:string;
  appellation:string|null;
  wineStyle:string|null;
  catalogBacked:boolean;
};

export type CuveeResolution=CuveeEntity&{
  matchedName:string;
  matchType:'canonical'|'alias'|'structured';
  tastedCount:number;
  vintages:number[];
};

type CatalogWine={name?:unknown;category?:unknown;appellation?:unknown;style?:unknown};
type CuveeRow={id:string;producer_id:string;canonical_name:string;signature_key:string;appellation:string|null;wine_style:string|null;catalog_backed:number;created_at?:string;display_alias?:string|null;wine_count?:number};
type ResearchRow={scope:'terroir'|'wine_vintage';cache_key:string;subject_json:string;result_json:string;sources_json:string;model:string;researched_at:string;created_at:string;updated_at:string};
const parseJson=<T>(value:unknown,fallback:T):T=>{try{return JSON.parse(String(value)) as T}catch{return fallback}};
const escapeRegExp=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

export function normalizeCuveeAlias(value:string){
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/\b1(?:er|ère|ere)\b/g,'premier')
    .replace(/&/g,' and ').replace(/[’'`]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
}

export function stripKnownProducerPrefix(value:string,producerNames:string[]){
  const input=value.trim();
  for(const producer of [...new Set(producerNames.map(x=>x.trim()).filter(Boolean))].sort((a,b)=>b.length-a.length)){
    const pattern=new RegExp(`^${escapeRegExp(producer)}(?:\\s+|\\s*[-–—:]\\s*)`,'i');
    const stripped=input.replace(pattern,'').trim();
    if(stripped&&stripped!==input)return stripped;
  }
  return input;
}

export function cuveeSignature(name:string,appellation:string|null|undefined,producerNames:string[]=[]){
  const stripped=stripKnownProducerPrefix(name,producerNames);
  const normalized=normalizeCuveeAlias(`${stripped} ${appellation??''}`);
  const tokens=normalized.split(/\s+/).filter(Boolean).filter(token=>{
    if(/^\d{4}$/.test(token))return false;
    // These are generic descriptors, not the identity of the named wine/site.
    // Keep them in the display name/alias, but ignore them for stable matching.
    return !['monopole','aoc','cuvee'].includes(token);
  });
  return [...new Set(tokens)].sort().join(' ');
}

async function producerNames(db:D1Database,owner:string,producerId:string){
  const [producer,aliases]=await Promise.all([
    db.prepare('SELECT canonical_name FROM producers WHERE owner_id=? AND id=?').bind(owner,producerId).first<{canonical_name:string}>(),
    db.prepare('SELECT display_alias FROM producer_aliases WHERE owner_id=? AND producer_id=?').bind(owner,producerId).all<{display_alias:string}>()
  ]);
  return [producer?.canonical_name??'',...aliases.results.map(x=>x.display_alias)].filter(Boolean);
}

const styleCompatible=(stored:string|null|undefined,incoming:string|null|undefined)=>!stored||!incoming||normalizeCuveeAlias(stored)===normalizeCuveeAlias(incoming);
const appellationCompatible=(stored:string|null|undefined,incoming:string|null|undefined)=>!stored||!incoming||normalizeCuveeAlias(stored)===normalizeCuveeAlias(incoming);
const mapEntity=(row:CuveeRow):CuveeEntity=>({id:row.id,producerId:row.producer_id,canonicalName:row.canonical_name,appellation:row.appellation??null,wineStyle:row.wine_style??null,catalogBacked:Boolean(row.catalog_backed)});

async function aliasMatch(db:D1Database,owner:string,producerId:string,normalizedAlias:string,appellation?:string|null){
  const appKey=normalizeCuveeAlias(appellation??'');
  if(appKey){
    return (await db.prepare(`SELECT c.*,a.display_alias FROM cuvee_aliases a JOIN cuvees c ON c.owner_id=a.owner_id AND c.id=a.cuvee_id
      WHERE a.owner_id=? AND a.producer_id=? AND a.normalized_alias=? AND a.appellation_key=? LIMIT 1`).bind(owner,producerId,normalizedAlias,appKey).first<CuveeRow>())??null;
  }
  const rows=await db.prepare(`SELECT c.*,a.display_alias FROM cuvee_aliases a JOIN cuvees c ON c.owner_id=a.owner_id AND c.id=a.cuvee_id
    WHERE a.owner_id=? AND a.producer_id=? AND a.normalized_alias=? LIMIT 2`).bind(owner,producerId,normalizedAlias).all<CuveeRow>();
  return rows.results.length===1?rows.results[0]:null;
}

function mergeSources(a:ResearchSource[],b:ResearchSource[]){
  const seen=new Set<string>();return [...a,...b].filter(source=>Boolean(source?.url)&&!seen.has(source.url)&&Boolean(seen.add(source.url))).slice(0,20);
}

async function moveCuveeResearch(db:D1Database,owner:string,sourceId:string,survivor:CuveeRow){
  const rows=await db.prepare(`SELECT scope,cache_key,subject_json,result_json,sources_json,model,researched_at,created_at,updated_at
    FROM research_cache WHERE owner_id=? AND scope IN ('terroir','wine_vintage') AND json_extract(subject_json,'$.cuveeId')=?`).bind(owner,sourceId).all<ResearchRow>();
  for(const row of rows.results){
    const subject=parseJson<Record<string,string|number|null>>(row.subject_json,{});subject.cuveeId=survivor.id;subject.wineName=survivor.canonical_name;
    const target=buildResearchTargets(subject).find(item=>item.scope===row.scope);if(!target)continue;
    const existing=await db.prepare(`SELECT scope,cache_key,subject_json,result_json,sources_json,model,researched_at,created_at,updated_at
      FROM research_cache WHERE owner_id=? AND scope=? AND cache_key=?`).bind(owner,row.scope,target.cacheKey).first<ResearchRow>();
    const sourceTime=Date.parse(row.researched_at)||0,existingTime=Date.parse(existing?.researched_at??'')||0;
    const newest=existing&&existingTime>sourceTime?existing:row;
    const sources=mergeSources(parseJson<ResearchSource[]>(existing?.sources_json,[]),parseJson<ResearchSource[]>(row.sources_json,[]));
    const now=new Date().toISOString();
    await db.prepare(`INSERT INTO research_cache(owner_id,scope,cache_key,subject_json,result_json,sources_json,model,researched_at,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(owner_id,scope,cache_key) DO UPDATE SET subject_json=excluded.subject_json,result_json=excluded.result_json,sources_json=excluded.sources_json,model=excluded.model,researched_at=excluded.researched_at,updated_at=excluded.updated_at`)
      .bind(owner,row.scope,target.cacheKey,JSON.stringify(target.subject),newest.result_json,JSON.stringify(sources),newest.model,newest.researched_at,existing?.created_at??row.created_at??now,now).run();
    if(row.cache_key!==target.cacheKey)await db.prepare('DELETE FROM research_cache WHERE owner_id=? AND scope=? AND cache_key=?').bind(owner,row.scope,row.cache_key).run();
  }
}

async function mergeCuveeEntities(db:D1Database,owner:string,survivor:CuveeRow,source:CuveeRow,newSignature:string){
  await moveCuveeResearch(db,owner,source.id,survivor);
  const aliases=await db.prepare('SELECT normalized_alias,appellation_key,display_alias,created_at FROM cuvee_aliases WHERE owner_id=? AND producer_id=? AND cuvee_id=?')
    .bind(owner,source.producer_id,source.id).all<{normalized_alias:string;appellation_key:string;display_alias:string;created_at:string}>();
  for(const alias of aliases.results){
    await db.prepare(`INSERT INTO cuvee_aliases(owner_id,producer_id,normalized_alias,appellation_key,cuvee_id,display_alias,created_at) VALUES(?,?,?,?,?,?,?)
      ON CONFLICT(owner_id,producer_id,normalized_alias,appellation_key) DO UPDATE SET cuvee_id=excluded.cuvee_id,display_alias=excluded.display_alias`)
      .bind(owner,survivor.producer_id,alias.normalized_alias,alias.appellation_key,survivor.id,alias.display_alias,alias.created_at).run();
  }
  await db.prepare('UPDATE wines SET cuvee_id=?,wine_name=? WHERE owner_id=? AND cuvee_id=?').bind(survivor.id,survivor.canonical_name,owner,source.id).run();
  await db.prepare('DELETE FROM cuvee_aliases WHERE owner_id=? AND producer_id=? AND cuvee_id=?').bind(owner,source.producer_id,source.id).run();
  await db.prepare('DELETE FROM cuvees WHERE owner_id=? AND id=?').bind(owner,source.id).run();
  await db.prepare('UPDATE cuvees SET signature_key=?,updated_at=? WHERE owner_id=? AND id=?').bind(newSignature,new Date().toISOString(),owner,survivor.id).run();
}

export async function reconcileProducerCuvees(db:D1Database,owner:string,producerId:string){
  const names=await producerNames(db,owner,producerId);
  const rows=await db.prepare(`SELECT c.*,(SELECT count(*) FROM wines w WHERE w.owner_id=c.owner_id AND w.cuvee_id=c.id) AS wine_count
    FROM cuvees c WHERE c.owner_id=? AND c.producer_id=? ORDER BY c.created_at ASC`).bind(owner,producerId).all<CuveeRow>();
  const grouped=new Map<string,CuveeRow[]>();
  for(const row of rows.results){
    const signature=cuveeSignature(row.canonical_name,row.appellation,names);if(!signature)continue;
    const compatible=(grouped.get(signature)??[]).find(candidate=>styleCompatible(candidate.wine_style,row.wine_style)&&appellationCompatible(candidate.appellation,row.appellation));
    if(compatible){grouped.get(signature)!.push(row)}else grouped.set(`${signature}::${row.id}`,[row]);
  }
  // Rebuild groups without the unique suffix for compatible rows while keeping incompatible wines separate.
  const logical=new Map<string,CuveeRow[]>();
  for(const row of rows.results){
    const signature=cuveeSignature(row.canonical_name,row.appellation,names);if(!signature)continue;
    let key=signature;
    const existing=logical.get(key);
    if(existing&&!existing.every(candidate=>styleCompatible(candidate.wine_style,row.wine_style)&&appellationCompatible(candidate.appellation,row.appellation)))key=`${signature}::${row.id}`;
    logical.set(key,[...(logical.get(key)??[]),row]);
  }
  for(const group of logical.values()){
    const signature=cuveeSignature(group[0].canonical_name,group[0].appellation,names);
    if(group.length===1){if(group[0].signature_key!==signature)await db.prepare('UPDATE cuvees SET signature_key=?,updated_at=? WHERE owner_id=? AND id=?').bind(signature,new Date().toISOString(),owner,group[0].id).run();continue}
    const ranked=[...group].sort((a,b)=>Number(b.catalog_backed)-Number(a.catalog_backed)||Number(b.wine_count??0)-Number(a.wine_count??0)||String(a.created_at??'').localeCompare(String(b.created_at??'')));
    const survivor=ranked[0];
    for(const source of ranked.slice(1))await mergeCuveeEntities(db,owner,survivor,source,signature);
    await db.prepare('UPDATE wines SET wine_name=? WHERE owner_id=? AND cuvee_id=?').bind(survivor.canonical_name,owner,survivor.id).run();
  }
}

export async function cleanupOrphanCuvee(db:D1Database,owner:string,cuveeId:string|null|undefined){
  if(!cuveeId)return false;
  const row=await db.prepare('SELECT id,producer_id,catalog_backed FROM cuvees WHERE owner_id=? AND id=?').bind(owner,cuveeId).first<{id:string;producer_id:string;catalog_backed:number}>();
  if(!row)return false;
  const count=await db.prepare('SELECT count(*) AS count FROM wines WHERE owner_id=? AND cuvee_id=?').bind(owner,cuveeId).first<{count:number}>();
  if(Number(count?.count)>0||Boolean(row.catalog_backed))return false;
  await db.prepare(`DELETE FROM research_cache WHERE owner_id=? AND scope IN ('terroir','wine_vintage') AND json_extract(subject_json,'$.cuveeId')=?`).bind(owner,cuveeId).run();
  await db.prepare('DELETE FROM cuvee_aliases WHERE owner_id=? AND producer_id=? AND cuvee_id=?').bind(owner,row.producer_id,cuveeId).run();
  await db.prepare('DELETE FROM cuvees WHERE owner_id=? AND id=?').bind(owner,cuveeId).run();
  return true;
}

export async function resolveExistingCuvee(db:D1Database,owner:string,producerId:string,name:string,appellation?:string|null,wineStyle?:string|null):Promise<CuveeResolution|null>{
  const candidate=name.trim();if(!candidate)return null;
  const names=await producerNames(db,owner,producerId),cleaned=stripKnownProducerPrefix(candidate,names),aliasKey=normalizeCuveeAlias(cleaned);
  let row=await aliasMatch(db,owner,producerId,aliasKey,appellation),matchType:CuveeResolution['matchType']='alias';
  if(row&&(!styleCompatible(row.wine_style,wineStyle)||!appellationCompatible(row.appellation,appellation)))row=null;
  if(!row){
    const signature=cuveeSignature(cleaned,appellation,names);
    row=(await db.prepare('SELECT * FROM cuvees WHERE owner_id=? AND producer_id=? AND signature_key=? LIMIT 1').bind(owner,producerId,signature).first<CuveeRow>())??null;
    matchType='structured';
  }
  if(!row||!styleCompatible(row.wine_style,wineStyle))return null;
  if(normalizeCuveeAlias(row.canonical_name)===aliasKey)matchType='canonical';
  const vintages=await db.prepare('SELECT DISTINCT vintage FROM wines WHERE owner_id=? AND cuvee_id=? AND vintage IS NOT NULL ORDER BY vintage DESC').bind(owner,row.id).all<{vintage:number}>();
  const count=await db.prepare('SELECT count(*) AS count FROM wines WHERE owner_id=? AND cuvee_id=?').bind(owner,row.id).first<{count:number}>();
  return {...mapEntity(row),matchedName:row.display_alias||cleaned,matchType,tastedCount:Number(count?.count)||0,vintages:vintages.results.map(x=>Number(x.vintage)).filter(Number.isFinite)};
}

export async function ensureCuveeEntity(db:D1Database,owner:string,producerId:string,name:string,appellation?:string|null,wineStyle?:string|null,catalogBacked=false){
  const raw=name.trim();if(!raw)throw new Error('Wine name is required');
  const names=await producerNames(db,owner,producerId),canonical=stripKnownProducerPrefix(raw,names),aliasKey=normalizeCuveeAlias(canonical),signature=cuveeSignature(canonical,appellation,names),now=new Date().toISOString();
  let row=await aliasMatch(db,owner,producerId,aliasKey,appellation);
  if(row&&(!styleCompatible(row.wine_style,wineStyle)||!appellationCompatible(row.appellation,appellation)))row=null;
  if(!row)row=(await db.prepare('SELECT * FROM cuvees WHERE owner_id=? AND producer_id=? AND signature_key=? LIMIT 1').bind(owner,producerId,signature).first<CuveeRow>())??null;
  if(row&&!styleCompatible(row.wine_style,wineStyle))row=null;
  if(!row){
    const id=crypto.randomUUID();
    try{
      await db.prepare(`INSERT INTO cuvees(id,owner_id,producer_id,canonical_name,signature_key,appellation,wine_style,catalog_backed,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(id,owner,producerId,canonical,signature,appellation??null,wineStyle??null,catalogBacked?1:0,now,now).run();
      row={id,producer_id:producerId,canonical_name:canonical,signature_key:signature,appellation:appellation??null,wine_style:wineStyle??null,catalog_backed:catalogBacked?1:0,created_at:now};
    }catch{
      row=(await db.prepare('SELECT * FROM cuvees WHERE owner_id=? AND producer_id=? AND signature_key=? LIMIT 1').bind(owner,producerId,signature).first<CuveeRow>())??null;
    }
  }
  if(!row)throw new Error('Could not resolve cuvee entity');
  if(catalogBacked&&!row.catalog_backed){
    await db.prepare('UPDATE cuvees SET canonical_name=?,appellation=coalesce(?,appellation),wine_style=coalesce(?,wine_style),catalog_backed=1,updated_at=? WHERE owner_id=? AND id=?')
      .bind(canonical,appellation??null,wineStyle??null,now,owner,row.id).run();
    await db.prepare('UPDATE wines SET wine_name=? WHERE owner_id=? AND cuvee_id=?').bind(canonical,owner,row.id).run();
    row={...row,canonical_name:canonical,appellation:appellation??row.appellation,wine_style:wineStyle??row.wine_style,catalog_backed:1};
  }
  const appKey=normalizeCuveeAlias(appellation??row.appellation??'');
  for(const alias of new Set([raw,canonical])){
    const normalized=normalizeCuveeAlias(stripKnownProducerPrefix(alias,names));if(!normalized)continue;
    await db.prepare(`INSERT INTO cuvee_aliases(owner_id,producer_id,normalized_alias,appellation_key,cuvee_id,display_alias,created_at) VALUES(?,?,?,?,?,?,?)
      ON CONFLICT(owner_id,producer_id,normalized_alias,appellation_key) DO UPDATE SET cuvee_id=excluded.cuvee_id,display_alias=excluded.display_alias`)
      .bind(owner,producerId,normalized,appKey,row.id,alias,now).run();
  }
  return mapEntity(row);
}

export async function syncProducerCatalogCuvees(db:D1Database,owner:string,producerId:string){
  const row=await db.prepare('SELECT catalog_json FROM producers WHERE owner_id=? AND id=?').bind(owner,producerId).first<{catalog_json:string}>();
  const catalog=parseJson<CatalogWine[]>(row?.catalog_json,[]);
  for(const item of catalog){
    const name=typeof item.name==='string'?item.name.trim():'';if(!name)continue;
    const appellation=typeof item.appellation==='string'&&item.appellation.trim()?item.appellation.trim():null;
    const style=typeof item.category==='string'&&item.category.trim()?item.category.trim():typeof item.style==='string'&&item.style.trim()?item.style.trim():null;
    await ensureCuveeEntity(db,owner,producerId,name,appellation,style,true);
  }
}

export async function linkWineCuvee(db:D1Database,owner:string,wineId:string){
  const wine=await db.prepare(`SELECT id,producer_id,wine_name,recognized_wine_name,appellation,wine_style FROM wines WHERE owner_id=? AND id=?`).bind(owner,wineId).first<{id:string;producer_id:string|null;wine_name:string;recognized_wine_name:string|null;appellation:string|null;wine_style:string|null}>();
  if(!wine?.producer_id||!wine.wine_name?.trim())return null;
  const sourceName=wine.recognized_wine_name?.trim()||wine.wine_name.trim();
  const entity=await ensureCuveeEntity(db,owner,wine.producer_id,sourceName,wine.appellation,wine.wine_style,false);
  await db.prepare(`UPDATE wines SET cuvee_id=?,recognized_wine_name=coalesce(recognized_wine_name,?),wine_name=? WHERE owner_id=? AND id=?`)
    .bind(entity.id,wine.wine_name,entity.canonicalName,owner,wineId).run();
  return entity;
}

export async function ensureAllCuveeLinksForProducer(db:D1Database,owner:string,producerId:string){
  await syncProducerCatalogCuvees(db,owner,producerId);
  const rows=await db.prepare('SELECT id FROM wines WHERE owner_id=? AND producer_id=? ORDER BY created_at ASC').bind(owner,producerId).all<{id:string}>();
  for(const row of rows.results)await linkWineCuvee(db,owner,row.id);
  await reconcileProducerCuvees(db,owner,producerId);
}

export async function ensureMissingCuveeLinks(db:D1Database,owner:string){
  const producers=await db.prepare(`SELECT DISTINCT producer_id FROM wines WHERE owner_id=? AND producer_id IS NOT NULL AND producer_id<>'' AND (cuvee_id IS NULL OR cuvee_id='')`).bind(owner).all<{producer_id:string}>();
  for(const producer of producers.results){
    await syncProducerCatalogCuvees(db,owner,producer.producer_id);
    const wines=await db.prepare(`SELECT id FROM wines WHERE owner_id=? AND producer_id=? AND (cuvee_id IS NULL OR cuvee_id='') ORDER BY created_at ASC`).bind(owner,producer.producer_id).all<{id:string}>();
    for(const wine of wines.results)await linkWineCuvee(db,owner,wine.id);
  }
  const all=await db.prepare(`SELECT DISTINCT producer_id FROM cuvees WHERE owner_id=? AND producer_id IS NOT NULL AND producer_id<>''`).bind(owner).all<{producer_id:string}>();
  for(const producer of all.results)await reconcileProducerCuvees(db,owner,producer.producer_id);
}
