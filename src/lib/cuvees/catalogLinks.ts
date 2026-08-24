import { z } from 'zod';
import { cuveeStyleFamily,ensureCuveeEntity,normalizeCuveeAlias,stripKnownProducerPrefix } from './entities';
import { canonicalCatalogEntries,catalogHierarchyLabel,catalogPresentationKey,type CatalogPresentationLike } from './catalogPresentation';

const uuid=z.string().uuid();
export const createCuveeCatalogLinkSchema=z.object({
  confirmation:z.literal('LINK_CUVEE_TO_CATALOG'),
  sourceCuveeId:uuid,
  catalogCuveeId:uuid
}).superRefine((value,ctx)=>{if(value.sourceCuveeId===value.catalogCuveeId)ctx.addIssue({code:'custom',path:['catalogCuveeId'],message:'Choose a different catalog wine'})});
export const changeCuveeCatalogLinkSchema=z.object({
  confirmation:z.literal('CHANGE_CUVEE_CATALOG_LINK'),
  catalogCuveeId:uuid
});
export const unlinkCuveeCatalogLinkSchema=z.object({confirmation:z.literal('UNLINK_CUVEE_FROM_CATALOG')});

export type CatalogCuveeSummary={
  id:string;
  canonicalName:string;
  appellation:string|null;
  wineStyle:string|null;
  tastedCount:number;
  tastedVintages:number[];
};
export type CatalogChoice={
  key:string;
  id:string|null;
  canonicalName:string;
  appellation:string|null;
  wineStyle:string|null;
  classification:string|null;
  hierarchy:string;
  issue:string|null;
};
export type CuveeCatalogLink={
  id:string;
  sourceCuveeId:string;
  sourceName:string;
  sourceAppellation:string|null;
  catalogCuveeId:string;
  catalogName:string;
  catalogAppellation:string|null;
  createdAt:string;
};

type CuveeRow={id:string;producer_id:string;canonical_name:string;signature_key:string;appellation:string|null;wine_style:string|null;catalog_backed:number};
type LinkRow={id:string;source_cuvee_id:string;catalog_cuvee_id:string;source_name:string;source_appellation:string|null;catalog_name:string;catalog_appellation:string|null;created_at:string};
type WineCuveeRow={id:string;cuvee_id:string|null;vintage:number|null};
type CatalogWine=CatalogPresentationLike;
type FailedResearchRun={request_id:string;message:string|null};
const parseJson=<T>(value:unknown,fallback:T):T=>{try{return JSON.parse(String(value)) as T}catch{return fallback}};

function mapLink(row:LinkRow):CuveeCatalogLink{return {id:row.id,sourceCuveeId:row.source_cuvee_id,sourceName:row.source_name,sourceAppellation:row.source_appellation??null,catalogCuveeId:row.catalog_cuvee_id,catalogName:row.catalog_name,catalogAppellation:row.catalog_appellation??null,createdAt:row.created_at}}

export function catalogTargetForCuvee(cuveeId:string|null|undefined,catalogIds:ReadonlySet<string>,linkedTargets:ReadonlyMap<string,string>){
  if(!cuveeId)return null;
  if(catalogIds.has(cuveeId))return cuveeId;
  return linkedTargets.get(cuveeId)??null;
}

async function getCuvee(db:D1Database,owner:string,id:string){
  return db.prepare('SELECT id,producer_id,canonical_name,signature_key,appellation,wine_style,catalog_backed FROM cuvees WHERE owner_id=? AND id=?').bind(owner,id).first<CuveeRow>();
}
async function requireCatalogPair(db:D1Database,owner:string,producerId:string,sourceId:string,catalogId:string){
  const [source,catalog]=await Promise.all([getCuvee(db,owner,sourceId),getCuvee(db,owner,catalogId)]);
  if(!source||!catalog)throw new Error('Cuvée not found');
  if(source.producer_id!==producerId||catalog.producer_id!==producerId)throw new Error('Both cuvées must belong to this producer');
  if(source.id===catalog.id)throw new Error('This tasted wine is already the selected catalog cuvée');
  if(source.catalog_backed)throw new Error('A catalog-backed cuvée does not need a manual catalog link');
  if(!catalog.catalog_backed)throw new Error('Choose an existing wine from this producer’s catalog');
  return {source,catalog};
}

export async function createCuveeCatalogLink(db:D1Database,owner:string,producerId:string,sourceId:string,catalogId:string){
  const {source,catalog}=await requireCatalogPair(db,owner,producerId,sourceId,catalogId);
  const existing=await db.prepare(`SELECT id,catalog_cuvee_id FROM cuvee_catalog_links WHERE owner_id=? AND producer_id=? AND source_cuvee_id=? AND unlinked_at IS NULL LIMIT 1`)
    .bind(owner,producerId,sourceId).first<{id:string;catalog_cuvee_id:string}>();
  if(existing){
    if(existing.catalog_cuvee_id===catalogId)return {id:existing.id,sourceCuveeId:source.id,catalogCuveeId:catalog.id,existing:true};
    throw new Error('This tasted cuvée is already linked to another catalog wine. Use Change link instead.');
  }
  const tasted=await db.prepare('SELECT count(*) AS count FROM wines WHERE owner_id=? AND producer_id=? AND cuvee_id=?').bind(owner,producerId,sourceId).first<{count:number}>();
  if(!Number(tasted?.count))throw new Error('No tasted wines are currently attached to this cuvée');
  const id=crypto.randomUUID(),now=new Date().toISOString();
  await db.prepare(`INSERT INTO cuvee_catalog_links(id,owner_id,producer_id,source_cuvee_id,catalog_cuvee_id,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?)`).bind(id,owner,producerId,sourceId,catalogId,now,now).run();
  return {id,sourceCuveeId:source.id,catalogCuveeId:catalog.id,existing:false};
}

export async function changeCuveeCatalogLink(db:D1Database,owner:string,producerId:string,linkId:string,catalogId:string){
  const link=await db.prepare(`SELECT source_cuvee_id,catalog_cuvee_id FROM cuvee_catalog_links WHERE owner_id=? AND producer_id=? AND id=? AND unlinked_at IS NULL`)
    .bind(owner,producerId,linkId).first<{source_cuvee_id:string;catalog_cuvee_id:string}>();
  if(!link)throw new Error('Cuvée catalog link not found');
  const {catalog}=await requireCatalogPair(db,owner,producerId,link.source_cuvee_id,catalogId);
  if(link.catalog_cuvee_id===catalog.id)return {id:linkId,sourceCuveeId:link.source_cuvee_id,catalogCuveeId:catalog.id,changed:false};
  await db.prepare('UPDATE cuvee_catalog_links SET catalog_cuvee_id=?,updated_at=? WHERE owner_id=? AND producer_id=? AND id=? AND unlinked_at IS NULL')
    .bind(catalog.id,new Date().toISOString(),owner,producerId,linkId).run();
  return {id:linkId,sourceCuveeId:link.source_cuvee_id,catalogCuveeId:catalog.id,changed:true};
}

export async function unlinkCuveeCatalogLink(db:D1Database,owner:string,producerId:string,linkId:string){
  const link=await db.prepare(`SELECT source_cuvee_id,catalog_cuvee_id FROM cuvee_catalog_links WHERE owner_id=? AND producer_id=? AND id=? AND unlinked_at IS NULL`)
    .bind(owner,producerId,linkId).first<{source_cuvee_id:string;catalog_cuvee_id:string}>();
  if(!link)throw new Error('Cuvée catalog link not found');
  const now=new Date().toISOString();
  await db.prepare('UPDATE cuvee_catalog_links SET unlinked_at=?,updated_at=? WHERE owner_id=? AND producer_id=? AND id=? AND unlinked_at IS NULL')
    .bind(now,now,owner,producerId,linkId).run();
  return {id:linkId,sourceCuveeId:link.source_cuvee_id,catalogCuveeId:link.catalog_cuvee_id,unlinked:true};
}

async function loadCatalogRows(db:D1Database,owner:string,producerId:string){
  return db.prepare(`SELECT id,producer_id,canonical_name,signature_key,appellation,wine_style,catalog_backed FROM cuvees
    WHERE owner_id=? AND producer_id=? AND catalog_backed=1 ORDER BY canonical_name COLLATE NOCASE`).bind(owner,producerId).all<CuveeRow>();
}

async function loadCatalogDefinition(db:D1Database,owner:string,producerId:string){
  const [producer,aliases]=await Promise.all([
    db.prepare('SELECT canonical_name,catalog_json FROM producers WHERE owner_id=? AND id=?').bind(owner,producerId).first<{canonical_name:string;catalog_json:string}>(),
    db.prepare('SELECT display_alias FROM producer_aliases WHERE owner_id=? AND producer_id=?').bind(owner,producerId).all<{display_alias:string}>()
  ]);
  const producerNames=[producer?.canonical_name??'',...aliases.results.map(x=>x.display_alias)].filter(Boolean);
  const catalog=canonicalCatalogEntries(parseJson<CatalogWine[]>(producer?.catalog_json,[]),producerNames);
  return {catalog,producerNames};
}

function rowMatchesCatalog(row:CuveeRow,item:CatalogWine,producerNames:string[]){
  const expected=catalogPresentationKey(item,producerNames);if(!expected||row.signature_key!==expected)return false;
  const incomingStyle=cuveeStyleFamily(item.category??item.style),storedStyle=cuveeStyleFamily(row.wine_style);
  if(incomingStyle&&storedStyle&&incomingStyle!==storedStyle)return false;
  const incomingApp=normalizeCuveeAlias(item.appellation??''),storedApp=normalizeCuveeAlias(row.appellation??'');
  return !incomingApp||!storedApp||incomingApp===storedApp;
}

function missingCatalogEntries(catalog:CatalogWine[],producerNames:string[],rows:CuveeRow[]){
  return catalog.filter(item=>!rows.some(row=>rowMatchesCatalog(row,item,producerNames)));
}

async function repairCatalogEntries(db:D1Database,owner:string,producerId:string,catalog:CatalogWine[],producerNames:string[],rows:CuveeRow[]){
  const issues=new Map<string,string>();
  for(const item of missingCatalogEntries(catalog,producerNames,rows)){
    const key=catalogPresentationKey(item,producerNames),name=String(item.name??'').trim();if(!name||!key)continue;
    const appellation=typeof item.appellation==='string'&&item.appellation.trim()?item.appellation.trim():null;
    const style=typeof item.category==='string'&&item.category.trim()?item.category.trim():typeof item.style==='string'&&item.style.trim()?item.style.trim():null;
    try{await ensureCuveeEntity(db,owner,producerId,name,appellation,style,true)}
    catch(e){const message=(e as Error).message||'Could not create catalog identity';issues.set(key,message);console.warn(JSON.stringify({event:'producer-catalog-choice-repair-failed',producerId,wine:name,appellation,style,error:message}))}
  }
  return issues;
}

function isRecoverableCatalogIndexingFailure(message:string|null|undefined){
  const text=String(message??'').toLowerCase();
  return text.includes('catalog')&&text.includes('like or glob pattern too complex');
}

async function markRecoveredCatalogIndexingRun(db:D1Database,owner:string,producerId:string){
  const run=await db.prepare(`SELECT request_id,message FROM producer_research_runs
    WHERE owner_id=? AND producer_id=? AND status='failed' ORDER BY updated_at DESC LIMIT 1`).bind(owner,producerId).first<FailedResearchRun>();
  if(!run||!isRecoverableCatalogIndexingFailure(run.message))return false;
  const stamp=new Date().toISOString();
  const result=await db.prepare(`UPDATE producer_research_runs SET status='complete',stage='complete',message=?,updated_at=?
    WHERE owner_id=? AND producer_id=? AND request_id=? AND status='failed'`)
    .bind('Producer research completed. Saved catalogue identities were repaired.',stamp,owner,producerId,run.request_id).run();
  return Boolean(result.meta.changes);
}

export async function getProducerCuveeCatalogState(db:D1Database,owner:string,producerId:string){
  const definition=await loadCatalogDefinition(db,owner,producerId);
  let catalogRows=await loadCatalogRows(db,owner,producerId),repairIssues=new Map<string,string>();
  if(missingCatalogEntries(definition.catalog,definition.producerNames,catalogRows.results).length){
    repairIssues=await repairCatalogEntries(db,owner,producerId,definition.catalog,definition.producerNames,catalogRows.results);
    catalogRows=await loadCatalogRows(db,owner,producerId);
    if(!missingCatalogEntries(definition.catalog,definition.producerNames,catalogRows.results).length)await markRecoveredCatalogIndexingRun(db,owner,producerId);
  }
  const catalogChoices:CatalogChoice[]=definition.catalog.map(item=>{
    const key=catalogPresentationKey(item,definition.producerNames),row=catalogRows.results.find(candidate=>rowMatchesCatalog(candidate,item,definition.producerNames));
    return {
      key,
      id:row?.id??null,
      canonicalName:row?.canonical_name??stripKnownProducerPrefix(item.name,definition.producerNames),
      appellation:(item.appellation??row?.appellation??null)||null,
      wineStyle:(item.category??item.style??row?.wine_style??null)||null,
      classification:item.classification??null,
      hierarchy:catalogHierarchyLabel(item),
      issue:row?null:(repairIssues.get(key)||'Catalog identity needs repair')
    };
  });
  const [linkRows,wines]=await Promise.all([
    db.prepare(`SELECT l.id,l.source_cuvee_id,l.catalog_cuvee_id,s.canonical_name AS source_name,s.appellation AS source_appellation,
      d.canonical_name AS catalog_name,d.appellation AS catalog_appellation,l.created_at
      FROM cuvee_catalog_links l
      JOIN cuvees s ON s.owner_id=l.owner_id AND s.id=l.source_cuvee_id
      JOIN cuvees d ON d.owner_id=l.owner_id AND d.id=l.catalog_cuvee_id
      WHERE l.owner_id=? AND l.producer_id=? AND l.unlinked_at IS NULL ORDER BY l.created_at DESC`).bind(owner,producerId).all<LinkRow>(),
    db.prepare('SELECT id,cuvee_id,vintage FROM wines WHERE owner_id=? AND producer_id=?').bind(owner,producerId).all<WineCuveeRow>()
  ]);
  const catalogIds=new Set(catalogRows.results.map(row=>row.id));
  const linkedTargets=new Map(linkRows.results.map(row=>[row.source_cuvee_id,row.catalog_cuvee_id] as const));
  const stats=new Map<string,{count:number;vintages:Set<number>}>();
  const wineCatalogTargets:Record<string,string|null>={};
  for(const wine of wines.results){
    const target=catalogTargetForCuvee(wine.cuvee_id,catalogIds,linkedTargets);wineCatalogTargets[wine.id]=target;
    if(!target)continue;
    const item=stats.get(target)??{count:0,vintages:new Set<number>()};item.count+=1;if(wine.vintage!=null&&Number.isFinite(Number(wine.vintage)))item.vintages.add(Number(wine.vintage));stats.set(target,item);
  }
  const catalogCuvees:CatalogCuveeSummary[]=catalogRows.results.map(row=>{const stat=stats.get(row.id);return {id:row.id,canonicalName:row.canonical_name,appellation:row.appellation??null,wineStyle:row.wine_style??null,tastedCount:stat?.count??0,tastedVintages:[...(stat?.vintages??new Set<number>())].sort((a,b)=>b-a)}});
  return {catalogCuvees,catalogChoices,cuveeCatalogLinks:linkRows.results.map(mapLink),wineCatalogTargets};
}
