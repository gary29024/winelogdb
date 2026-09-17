import { ensureCuveeEntity,reconcileProducerCuvees } from '../cuvees/entities';
import { catalogPresentationKey } from '../cuvees/catalogPresentation';
import { applyCatalogDecisions,listCatalogDecisions } from './catalogDecisions';
import { stripProducerCatalogPrefix } from './catalogName';
import { assertCatalogTextQuality,mergeCatalogRanges,type CatalogLike } from './researchQuality';

export type CatalogRangeWine=CatalogLike&{name:string;category:string;sourceUrl?:string|null};
export type ManualCatalogEntry={id:string;name:string;category:string;appellation:string|null;classification:string|null;style:string|null;notes:string|null;sourceUrl:string|null;createdAt:string;updatedAt:string};
export type MissingCatalogCandidate=ManualCatalogEntry&{status:'suggested'|'ignored'|'added';lastSeenAt:string};
export type ManualCatalogInput={name?:unknown;category?:unknown;appellation?:unknown;classification?:unknown;style?:unknown;notes?:unknown;sourceUrl?:unknown};

type ProducerRow={canonical_name:string;catalog_json:string;catalog_researched_json:string;sources_json:string;catalog_sources_json:string};
type ManualRow={id:string;name:string;category:string;appellation:string|null;classification:string|null;style:string|null;notes:string|null;source_url:string|null;created_at:string;updated_at:string};
type CandidateRow=ManualRow&{status:'suggested'|'ignored'|'added';last_seen_at:string};
const CATEGORIES=new Set(['red','white','rose','sparkling','dessert','fortified','orange','other']);
const parse=<T>(value:unknown,fallback:T):T=>{try{return JSON.parse(String(value)) as T}catch{return fallback}};
const stamp=()=>new Date().toISOString();
const clean=(value:unknown,max:number)=>{const text=typeof value==='string'?value.trim():'';if(text)assertCatalogTextQuality(text,'manual catalogue field',max);return text||null};
const safeUrl=(value:unknown)=>{const text=typeof value==='string'?value.trim():'';if(!text)return null;try{const url=new URL(text);if(url.protocol!=='https:'||url.username||url.password)return null;return url.toString()}catch{return null}};
const sourceList=(value:unknown)=>{const parsed=parse<unknown>(value,[]);if(!Array.isArray(parsed))return [] as Array<{title:string;url:string}>;return parsed.flatMap(raw=>{if(!raw||typeof raw!=='object')return [];const item=raw as {title?:unknown;url?:unknown},url=safeUrl(item.url);return url?[{title:String(item.title??new URL(url).hostname).trim()||new URL(url).hostname,url}]:[]})};
const mergeSources=(...lists:Array<Array<{title:string;url:string}>>)=>{const seen=new Set<string>();return lists.flat().filter(item=>item.url&&!seen.has(item.url)&&Boolean(seen.add(item.url))).slice(0,30)};

async function namesFor(db:D1Database,owner:string,producerId:string){
  const [producer,aliases]=await Promise.all([
    db.prepare('SELECT canonical_name FROM producers WHERE owner_id=? AND id=?').bind(owner,producerId).first<{canonical_name:string}>(),
    db.prepare('SELECT display_alias FROM producer_aliases WHERE owner_id=? AND producer_id=?').bind(owner,producerId).all<{display_alias:string}>()
  ]);
  if(!producer)throw new Error('Producer not found');
  return [producer.canonical_name,...aliases.results.map(row=>row.display_alias)].filter(Boolean);
}
function normalizeInput(input:ManualCatalogInput,names:string[]):CatalogRangeWine{
  const rawName=clean(input.name,220);if(!rawName)throw new Error('Wine name is required');
  const name=stripProducerCatalogPrefix(rawName,names).trim();if(!name)throw new Error('Wine name is required');
  const categoryText=String(input.category??'other').trim().toLowerCase(),category=CATEGORIES.has(categoryText)?categoryText:'other';
  return {name,category,appellation:clean(input.appellation,180),classification:clean(input.classification,120),style:clean(input.style,80),notes:clean(input.notes,320),sourceUrl:safeUrl(input.sourceUrl)};
}
function manualWine(row:ManualRow):CatalogRangeWine{return {name:row.name,category:row.category,appellation:row.appellation,classification:row.classification,style:row.style,notes:row.notes,sourceUrl:row.source_url}}
function mapManual(row:ManualRow):ManualCatalogEntry{return {id:row.id,name:row.name,category:row.category,appellation:row.appellation,classification:row.classification,style:row.style,notes:row.notes,sourceUrl:row.source_url,createdAt:row.created_at,updatedAt:row.updated_at}}
function mapCandidate(row:CandidateRow):MissingCatalogCandidate{return {...mapManual(row),status:row.status,lastSeenAt:row.last_seen_at}}

async function manualRows(db:D1Database,owner:string,producerId:string){return (await db.prepare(`SELECT id,name,category,appellation,classification,style,notes,source_url,created_at,updated_at FROM producer_catalog_manual_entries WHERE owner_id=? AND producer_id=? ORDER BY created_at,name COLLATE NOCASE`).bind(owner,producerId).all<ManualRow>()).results}

export async function rebuildVisibleCatalog(db:D1Database,owner:string,producerId:string,syncAllCuvees=true){
  const row=await db.prepare('SELECT canonical_name,catalog_json,catalog_researched_json,sources_json,catalog_sources_json FROM producers WHERE owner_id=? AND id=?').bind(owner,producerId).first<ProducerRow>();
  if(!row)throw new Error('Producer not found');
  const names=await namesFor(db,owner,producerId),baseRaw=parse<unknown>(row.catalog_researched_json,[]),base=(Array.isArray(baseRaw)?baseRaw:[]).filter(item=>item&&typeof item==='object'&&typeof (item as {name?:unknown}).name==='string') as CatalogRangeWine[];
  const manuals=(await manualRows(db,owner,producerId)).map(manualWine);
  // Manual rows are the researched side of this merge, so a deliberate user
  // correction wins any same-identity machine row without creating a duplicate.
  const overlaid=mergeCatalogRanges(base,manuals,150,names).range;
  const decisions=await listCatalogDecisions(db,owner,producerId),visible=applyCatalogDecisions(overlaid,decisions,names).range;
  await db.prepare('UPDATE producers SET catalog_json=?,updated_at=? WHERE owner_id=? AND id=?').bind(JSON.stringify(visible),stamp(),owner,producerId).run();
  // Full research is already a background operation and still synchronizes the
  // whole range. Interactive one-row corrections opt out and synchronize only
  // their delta below, avoiding up to 150 sequential D1 identity lookups.
  if(syncAllCuvees){
    for(const item of visible){const identity=stripProducerCatalogPrefix(item.name,names);if(!identity)continue;await ensureCuveeEntity(db,owner,producerId,identity,item.appellation??null,item.category??item.style??null,true).catch(()=>undefined)}
    await reconcileProducerCuvees(db,owner,producerId).catch(()=>undefined);
  }
  return visible;
}

export async function saveResearchedCatalog(db:D1Database,owner:string,producerId:string,range:CatalogRangeWine[],sources:Array<{title:string;url:string}>,model:string){
  const row=await db.prepare('SELECT canonical_name,catalog_json,catalog_researched_json,sources_json,catalog_sources_json FROM producers WHERE owner_id=? AND id=?').bind(owner,producerId).first<ProducerRow>();if(!row)throw new Error('Producer not found');
  const names=await namesFor(db,owner,producerId),researched=mergeCatalogRanges([],range,150,names).range,cleanSources=mergeSources(sources),allSources=mergeSources(sourceList(row.sources_json),cleanSources),now=stamp();
  await db.prepare('UPDATE producers SET catalog_researched_json=?,catalog_sources_json=?,sources_json=?,research_model=?,researched_at=?,updated_at=? WHERE owner_id=? AND id=?')
    .bind(JSON.stringify(researched),JSON.stringify(cleanSources),JSON.stringify(allSources),model,now,now,owner,producerId).run();
  const visible=await rebuildVisibleCatalog(db,owner,producerId);
  return {researchedCount:researched.length,catalogCount:visible.length};
}

/** Capture the grounded pipeline's freshly committed catalogue as the new base, then replay manual additions. */
export async function captureGroundedCatalogAndOverlay(db:D1Database,owner:string,producerId:string,requestId:string){
  const run=await db.prepare("SELECT status FROM producer_research_runs WHERE owner_id=? AND producer_id=? AND request_id=?").bind(owner,producerId,requestId).first<{status:string}>();if(run?.status!=='complete')return false;
  const row=await db.prepare('SELECT catalog_json FROM producers WHERE owner_id=? AND id=?').bind(owner,producerId).first<{catalog_json:string}>();if(!row)return false;
  await db.prepare('UPDATE producers SET catalog_researched_json=? WHERE owner_id=? AND id=?').bind(row.catalog_json,owner,producerId).run();
  await rebuildVisibleCatalog(db,owner,producerId);return true;
}

export async function listCatalogRangeCorrections(db:D1Database,owner:string,producerId:string){
  const [manual,candidates,row,names]=await Promise.all([
    manualRows(db,owner,producerId),
    db.prepare(`SELECT id,name,category,appellation,classification,style,notes,source_url,status,first_seen_at AS created_at,last_seen_at AS updated_at,last_seen_at FROM producer_catalog_missing_candidates WHERE owner_id=? AND producer_id=? AND status='suggested' ORDER BY last_seen_at DESC,name COLLATE NOCASE`).bind(owner,producerId).all<CandidateRow>(),
    db.prepare('SELECT catalog_json FROM producers WHERE owner_id=? AND id=?').bind(owner,producerId).first<{catalog_json:string}>(),
    namesFor(db,owner,producerId)
  ]);
  const visible=parse<CatalogRangeWine[]>(row?.catalog_json,[]),known=new Set(visible.map(item=>catalogPresentationKey(item,names)).filter(Boolean));
  const missingCandidates=candidates.results.filter(item=>!known.has(catalogPresentationKey(manualWine(item),names))).map(mapCandidate);
  return {manualEntries:manual.map(mapManual),missingCandidates};
}

export async function addManualCatalogEntry(db:D1Database,owner:string,producerId:string,input:ManualCatalogInput){
  const names=await namesFor(db,owner,producerId),wine=normalizeInput(input,names),key=catalogPresentationKey(wine,names);if(!key)throw new Error('The wine could not be identified');
  const now=stamp(),id=crypto.randomUUID();
  await db.prepare(`INSERT INTO producer_catalog_manual_entries(id,owner_id,producer_id,entry_key,name,category,appellation,classification,style,notes,source_url,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(owner_id,producer_id,entry_key) DO UPDATE SET name=excluded.name,category=excluded.category,appellation=excluded.appellation,classification=excluded.classification,style=excluded.style,notes=excluded.notes,source_url=coalesce(excluded.source_url,producer_catalog_manual_entries.source_url),updated_at=excluded.updated_at`)
    .bind(id,owner,producerId,key,wine.name,wine.category,wine.appellation??null,wine.classification??null,wine.style??null,wine.notes??null,wine.sourceUrl??null,now,now).run();
  await rebuildVisibleCatalog(db,owner,producerId,false);
  await ensureCuveeEntity(db,owner,producerId,wine.name,wine.appellation??null,wine.category??wine.style??null,true).catch(()=>undefined);
  await reconcileProducerCuvees(db,owner,producerId).catch(()=>undefined);
  const row=await db.prepare('SELECT id,name,category,appellation,classification,style,notes,source_url,created_at,updated_at FROM producer_catalog_manual_entries WHERE owner_id=? AND producer_id=? AND entry_key=?').bind(owner,producerId,key).first<ManualRow>();if(!row)throw new Error('Could not save the missing wine');return mapManual(row);
}

export async function deleteManualCatalogEntry(db:D1Database,owner:string,producerId:string,id:string){
  const [manual,names]=await Promise.all([
    db.prepare('SELECT id,name,category,appellation,classification,style,notes,source_url,created_at,updated_at FROM producer_catalog_manual_entries WHERE owner_id=? AND producer_id=? AND id=?').bind(owner,producerId,id).first<ManualRow>(),
    namesFor(db,owner,producerId)
  ]);if(!manual)throw new Error('Manual catalogue wine not found');
  const removedKey=catalogPresentationKey(manualWine(manual),names);
  await db.prepare('DELETE FROM producer_catalog_manual_entries WHERE owner_id=? AND producer_id=? AND id=?').bind(owner,producerId,id).run();
  const visible=await rebuildVisibleCatalog(db,owner,producerId,false),replacement=removedKey?visible.find(item=>catalogPresentationKey(item,names)===removedKey):undefined;
  // If removing the manual override reveals the machine-researched version of
  // the same wine, only that identity needs to be refreshed.
  if(replacement)await ensureCuveeEntity(db,owner,producerId,replacement.name,replacement.appellation??null,replacement.category??replacement.style??null,true).catch(()=>undefined);
  await reconcileProducerCuvees(db,owner,producerId).catch(()=>undefined);
  return {id,deleted:true as const};
}

export async function syncMissingCandidates(db:D1Database,owner:string,producerId:string,found:CatalogRangeWine[]){
  if(!found.length)return 0;const names=await namesFor(db,owner,producerId),row=await db.prepare('SELECT catalog_json FROM producers WHERE owner_id=? AND id=?').bind(owner,producerId).first<{catalog_json:string}>();if(!row)return 0;
  const current=parse<CatalogRangeWine[]>(row.catalog_json,[]),known=new Set(current.map(item=>catalogPresentationKey(item,names)).filter(Boolean)),decisions=await listCatalogDecisions(db,owner,producerId),blocked=new Set(decisions.map(item=>item.sourceKey)),now=stamp();
  const writes=found.flatMap(raw=>{const wine=normalizeInput(raw,names),key=catalogPresentationKey(wine,names);if(!key||known.has(key)||blocked.has(key))return [];return [db.prepare(`INSERT INTO producer_catalog_missing_candidates(id,owner_id,producer_id,candidate_key,name,category,appellation,classification,style,notes,source_url,status,first_seen_at,last_seen_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(owner_id,producer_id,candidate_key) DO UPDATE SET name=excluded.name,category=excluded.category,appellation=excluded.appellation,classification=excluded.classification,style=excluded.style,notes=excluded.notes,source_url=coalesce(excluded.source_url,producer_catalog_missing_candidates.source_url),last_seen_at=excluded.last_seen_at`)
    .bind(crypto.randomUUID(),owner,producerId,key,wine.name,wine.category,wine.appellation??null,wine.classification??null,wine.style??null,wine.notes??null,wine.sourceUrl??null,'suggested',now,now)]});
  if(writes.length)await db.batch(writes);
  return writes.length;
}

export async function addMissingCandidate(db:D1Database,owner:string,producerId:string,id:string){
  const row=await db.prepare(`SELECT id,name,category,appellation,classification,style,notes,source_url,status,first_seen_at AS created_at,last_seen_at AS updated_at,last_seen_at FROM producer_catalog_missing_candidates WHERE owner_id=? AND producer_id=? AND id=?`).bind(owner,producerId,id).first<CandidateRow>();if(!row)throw new Error('Missing-wine suggestion not found');
  const saved=await addManualCatalogEntry(db,owner,producerId,{name:row.name,category:row.category,appellation:row.appellation,classification:row.classification,style:row.style,notes:row.notes,sourceUrl:row.source_url});
  await db.prepare("UPDATE producer_catalog_missing_candidates SET status='added',last_seen_at=? WHERE owner_id=? AND producer_id=? AND id=?").bind(stamp(),owner,producerId,id).run();return saved;
}
export async function ignoreMissingCandidate(db:D1Database,owner:string,producerId:string,id:string){
  const result=await db.prepare("UPDATE producer_catalog_missing_candidates SET status='ignored',last_seen_at=? WHERE owner_id=? AND producer_id=? AND id=?").bind(stamp(),owner,producerId,id).run();if(!result.meta.changes)throw new Error('Missing-wine suggestion not found');return {id,ignored:true as const};
}