import { catalogPresentationKey,type CatalogPresentationLike } from '../cuvees/catalogPresentation';
import { stripProducerCatalogPrefix } from './catalogName';

export type CatalogDecisionKind='merge'|'hide';
export type CatalogDecision={
  id:string;decision:CatalogDecisionKind;sourceKey:string;sourceName:string;
  targetKey:string|null;targetName:string|null;createdAt:string;updatedAt:string;
};
export type CatalogDecisionInput={decision?:unknown;sourceKey?:unknown;sourceName?:unknown;targetKey?:unknown;targetName?:unknown};

type Row={id:string;decision:CatalogDecisionKind;source_key:string;source_name:string;target_key:string|null;target_name:string|null;created_at:string;updated_at:string};
const KINDS=new Set<CatalogDecisionKind>(['merge','hide']);
const MAX_CHAIN=8;

/** The identity a manual decision is recorded against. */
export const catalogDecisionKey=(wine:CatalogPresentationLike,producerNames:string[]=[])=>catalogPresentationKey(wine,producerNames);

const mapRow=(row:Row):CatalogDecision=>({id:row.id,decision:row.decision,sourceKey:row.source_key,sourceName:row.source_name,targetKey:row.target_key,targetName:row.target_name,createdAt:row.created_at,updatedAt:row.updated_at});
const cleanText=(value:unknown,max:number)=>{const text=typeof value==='string'?value.trim():'';return text?text.slice(0,max):''};

export function normalizeCatalogDecision(input:CatalogDecisionInput){
  const decision=String(input.decision??'').trim().toLowerCase() as CatalogDecisionKind;
  if(!KINDS.has(decision))throw new Error('Choose either merge or hide');
  const sourceKey=cleanText(input.sourceKey,400);if(!sourceKey)throw new Error('The duplicate wine could not be identified');
  const sourceName=cleanText(input.sourceName,220)||sourceKey;
  if(decision==='hide')return {decision,sourceKey,sourceName,targetKey:null,targetName:null};
  const targetKey=cleanText(input.targetKey,400);if(!targetKey)throw new Error('Choose the wine to keep');
  if(targetKey===sourceKey)throw new Error('A wine cannot be merged into itself');
  return {decision,sourceKey,sourceName,targetKey,targetName:cleanText(input.targetName,220)||targetKey};
}

/**
 * Resolve where a key ends up once merges are followed. Merge chains are
 * possible (A→B, B→C), and a cycle introduced by two independent decisions must
 * not hang the request, so the walk is bounded and falls back to the input.
 */
export function resolveCatalogDecisionTarget(sourceKey:string,decisions:CatalogDecision[]){
  const byKey=new Map(decisions.map(item=>[item.sourceKey,item]));
  const seen=new Set<string>();let key=sourceKey;
  for(let step=0;step<MAX_CHAIN;step++){
    const decision=byKey.get(key);if(!decision)return {key,hidden:false};
    if(decision.decision==='hide')return {key,hidden:true};
    if(!decision.targetKey||seen.has(decision.targetKey))return {key,hidden:false};
    seen.add(key);key=decision.targetKey;
  }
  return {key,hidden:false};
}

/**
 * Apply the owner's manual corrections to a researched range. Hidden wines are
 * dropped; a merged wine is folded into its target, contributing any field the
 * surviving row left blank rather than being silently thrown away. A merge
 * whose target is absent from this range degrades to a hide, so a decision
 * still holds when research stops returning the wine that was kept.
 */
export function applyCatalogDecisions<T extends CatalogPresentationLike>(catalog:T[],decisions:CatalogDecision[],producerNames:string[]=[]){
  if(!decisions.length)return {range:catalog,hiddenCount:0,mergedCount:0};
  const byKey=new Map<string,T>();
  for(const wine of catalog){const key=catalogDecisionKey(wine,producerNames);if(key&&!byKey.has(key))byKey.set(key,wine)}
  const output:T[]=[],pending:Array<{target:string;wine:T}>=[];let hiddenCount=0,mergedCount=0;
  for(const wine of catalog){
    const key=catalogDecisionKey(wine,producerNames);
    if(!key){output.push(wine);continue}
    const resolved=resolveCatalogDecisionTarget(key,decisions);
    if(resolved.hidden){hiddenCount++;continue}
    if(resolved.key===key){output.push(wine);continue}
    if(!byKey.has(resolved.key)){hiddenCount++;continue}
    mergedCount++;pending.push({target:resolved.key,wine});
  }
  if(!pending.length)return {range:output,hiddenCount,mergedCount};
  const donors=new Map<string,T[]>();
  for(const item of pending){const list=donors.get(item.target)??[];list.push(item.wine);donors.set(item.target,list)}
  const merged=output.map(wine=>{
    const list=donors.get(catalogDecisionKey(wine,producerNames));if(!list?.length)return wine;
    let result=wine;
    for(const donor of list)result={...result,
      appellation:result.appellation??donor.appellation,
      classification:result.classification??donor.classification,
      style:result.style??donor.style,
      notes:result.notes??donor.notes
    };
    return result;
  });
  return {range:merged,hiddenCount,mergedCount};
}

/** Display label for a range row, used when recording and listing decisions. */
export const catalogDecisionLabel=(wine:CatalogPresentationLike,producerNames:string[]=[])=>{
  const name=stripProducerCatalogPrefix(String(wine.name??''),producerNames).trim()||String(wine.name??'').trim();
  const appellation=String(wine.appellation??'').trim();
  return appellation&&appellation.toLowerCase()!==name.toLowerCase()?`${name} · ${appellation}`:name;
};

async function producerExists(db:D1Database,owner:string,producerId:string){
  return Boolean(await db.prepare('SELECT id FROM producers WHERE owner_id=? AND id=?').bind(owner,producerId).first<{id:string}>());
}

export async function listCatalogDecisions(db:D1Database,owner:string,producerId:string){
  const rows=await db.prepare(`SELECT id,decision,source_key,source_name,target_key,target_name,created_at,updated_at
    FROM producer_catalog_decisions WHERE owner_id=? AND producer_id=? ORDER BY created_at ASC,id ASC`).bind(owner,producerId).all<Row>();
  return rows.results.map(mapRow);
}

export async function saveCatalogDecision(db:D1Database,owner:string,producerId:string,input:CatalogDecisionInput){
  if(!await producerExists(db,owner,producerId))throw new Error('Producer not found');
  const decision=normalizeCatalogDecision(input);
  if(decision.decision==='merge'){
    const existing=await listCatalogDecisions(db,owner,producerId);
    const resolved=resolveCatalogDecisionTarget(decision.targetKey!,existing.filter(item=>item.sourceKey!==decision.sourceKey));
    if(resolved.key===decision.sourceKey)throw new Error('That merge would point the two wines at each other');
  }
  const stamp=new Date().toISOString(),id=crypto.randomUUID();
  await db.prepare(`INSERT INTO producer_catalog_decisions(id,owner_id,producer_id,decision,source_key,source_name,target_key,target_name,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(owner_id,producer_id,source_key) DO UPDATE SET decision=excluded.decision,source_name=excluded.source_name,target_key=excluded.target_key,target_name=excluded.target_name,updated_at=excluded.updated_at`)
    .bind(id,owner,producerId,decision.decision,decision.sourceKey,decision.sourceName,decision.targetKey,decision.targetName,stamp,stamp).run();
  const saved=(await listCatalogDecisions(db,owner,producerId)).find(item=>item.sourceKey===decision.sourceKey);
  if(!saved)throw new Error('Could not save the catalogue correction');
  return saved;
}

export async function deleteCatalogDecision(db:D1Database,owner:string,producerId:string,decisionId:string){
  const existing=await db.prepare('SELECT id FROM producer_catalog_decisions WHERE owner_id=? AND producer_id=? AND id=?').bind(owner,producerId,decisionId).first<{id:string}>();
  if(!existing)throw new Error('Catalogue correction not found');
  await db.prepare('DELETE FROM producer_catalog_decisions WHERE owner_id=? AND id=?').bind(owner,decisionId).run();
  return {id:decisionId,deleted:true as const};
}
