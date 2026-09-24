import { adoptFriendResearch,loadResearchCache,loadWineResearchCache,wineRowResearchTargets,type CachedResearch,type ResearchScope,type ResearchTarget } from './cache';
import { resolveExistingProducer } from '../producers/entities';
import { resolveExistingCuvee } from '../cuvees/entities';

/**
 * A wine the reader may run Deep Search on: their own, or one an active friend
 * shared with them directly or through a shared tasting. The access rule is the
 * one canReadShared and member_visible_wines apply, written as indexed point
 * lookups. It is for the research pipeline only. The wine endpoints keep
 * answering "not found" to anyone but the owner, so this widens no read path.
 *
 * The reader's own row wins if both exist. Research always runs and is billed as
 * the reader. A shared row's owner_id is only where the wine lives and whose
 * saved research already covers it.
 */
export async function readableWine<T extends Record<string,unknown>>(db:D1Database,reader:string,wineId:string,columns='w.*'){
  return db.prepare(`SELECT ${columns},w.owner_id AS source_owner_id FROM wines w
    WHERE w.id=? AND (w.owner_id=? OR (
      EXISTS(SELECT 1 FROM friendships f WHERE f.user_id=? AND f.friend_id=w.owner_id)
      AND EXISTS(SELECT 1 FROM app_users u WHERE u.id=w.owner_id AND u.status='active')
      AND (EXISTS(SELECT 1 FROM wine_shares s WHERE s.wine_id=w.id AND s.owner_id=w.owner_id AND s.recipient_id=?)
        OR EXISTS(SELECT 1 FROM tasting_shares ts JOIN wine_experiences we
          ON we.owner_id=ts.owner_id AND we.tasting_id=ts.tasting_id AND we.wine_id=w.id
          WHERE ts.owner_id=w.owner_id AND ts.recipient_id=?))))
    ORDER BY w.owner_id=? DESC LIMIT 1`).bind(wineId,reader,reader,reader,reader,reader).first<T&{source_owner_id:string}>();
}

type IdentityRow={producer?:unknown;producer_id?:unknown;cuvee_id?:unknown;wine_name?:unknown;appellation?:unknown;wine_style?:unknown;source_owner_id:string};
export type ResearchWineRow<T>=T&{source_owner_id:string;source_producer_id:string|null;source_cuvee_id:string|null;source_deep_search_json:string|null};

/**
 * The wine as the reader's research sees it.
 *
 * Research cache keys carry producer and cuvée IDs, and those are per account:
 * the same house has one ID in the owner's library and another in the reader's.
 * Keying a recipient's research by the owner's IDs missed research the reader
 * already paid for, and quoted it again. So a shared row's IDs become the
 * reader's own matching producer and cuvée, or none (a name key), exactly as a
 * bottle of their own would be keyed. The owner's IDs and snapshot are kept
 * alongside, for reading the owner's research.
 */
export async function researchWine<T extends IdentityRow>(db:D1Database,reader:string,row:T,sourceSnapshot:unknown=null):Promise<ResearchWineRow<T>>{
  const sourceProducerId=typeof row.producer_id==='string'?row.producer_id:null,sourceCuveeId=typeof row.cuvee_id==='string'?row.cuvee_id:null;
  const snapshot=typeof sourceSnapshot==='string'?sourceSnapshot:null;
  if(row.source_owner_id===reader)return {...row,source_producer_id:sourceProducerId,source_cuvee_id:sourceCuveeId,source_deep_search_json:snapshot};
  const producerId=(await resolveExistingProducer(db,reader,String(row.producer??'')))?.id??null;
  const cuvee=producerId&&row.wine_name?await resolveExistingCuvee(db,reader,producerId,String(row.wine_name),row.appellation==null?null:String(row.appellation),row.wine_style==null?null:String(row.wine_style)):null;
  return {...row,producer_id:producerId,cuvee_id:cuvee?.id??null,source_producer_id:sourceProducerId,source_cuvee_id:sourceCuveeId,source_deep_search_json:snapshot};
}

const sourceTargets=(row:Record<string,unknown>&{source_producer_id:string|null;source_cuvee_id:string|null})=>
  wineRowResearchTargets({...row,producer_id:row.source_producer_id,cuvee_id:row.source_cuvee_id});
const bySourceScope=(targets:ResearchTarget[],scopes:ReadonlySet<ResearchScope>)=>targets.filter(target=>scopes.has(target.scope));

/**
 * Fill a reader's research for a shared wine from the owner's saved scopes for
 * that exact wine, as the shared page shows them. A recipient is not charged to
 * research a section they can already read. Scopes the reader is refreshing
 * are skipped, so a refresh never falls back to the old answer.
 *
 * The owner's entries are re-targeted onto the reader's keys, and every one
 * keeps the account that paid for it: the owner, or whoever the owner adopted
 * it from. Adoption then files it under that name, so the owner's research is
 * never credited to the recipient.
 */
export async function withSourceResearch<R extends Record<string,unknown>>(db:D1Database,reader:string,row:ResearchWineRow<R>,targets:ResearchTarget[],cache:Map<ResearchScope,CachedResearch>,skip:ReadonlySet<ResearchScope>=new Set()){
  const sourceOwner=row.source_owner_id;
  if(!sourceOwner||sourceOwner===reader)return cache;
  const missing=new Set(targets.filter(target=>!cache.has(target.scope)&&!skip.has(target.scope)).map(target=>target.scope));
  if(!missing.size)return cache;
  const source=await loadWineResearchCache(db,sourceOwner,bySourceScope(sourceTargets(row),missing),false,row.source_deep_search_json);
  for(const [scope,entry] of source){
    const target=targets.find(item=>item.scope===scope);
    if(target)cache.set(scope,{...entry,target,contributorId:entry.contributorId??sourceOwner});
  }
  return cache;
}

/**
 * Hand what a recipient paid for back to the owner's copy of the wine.
 *
 * The owner otherwise meets it only through the friends' pool, which is keyed
 * by generic identity and deliberately never carries exact-wine research for a
 * non-vintage bottle. This writes to that one wine's keys instead. It adds a
 * section the owner is missing, credited to the recipient. It never replaces
 * the owner's own research, and never republishes it as the owner's.
 */
export async function offerToSourceOwner<R extends Record<string,unknown>>(db:D1Database,reader:string,row:ResearchWineRow<R>,cache:Map<ResearchScope,CachedResearch>){
  const sourceOwner=row.source_owner_id;
  if(!sourceOwner||sourceOwner===reader)return;
  const targets=sourceTargets(row),offered=new Map<ResearchScope,CachedResearch>();
  for(const [scope,entry] of cache){
    if(entry.contributorId&&entry.contributorId!==reader)continue;
    const target=targets.find(item=>item.scope===scope);
    if(target)offered.set(scope,{...entry,target,contributorId:reader});
  }
  if(offered.size)await adoptFriendResearch(db,sourceOwner,offered);
}

/**
 * Every section a reader can see on a shared wine, from the same sources the
 * quote treats as already paid for: the reader's own, friends' published
 * research, and the owner's research for this exact wine. Showing a friend's
 * research makes it the reader's own, as on the owner's page, so a quote that
 * came back free always has something on the page to show for it.
 */
export async function sharedResearchForReader(db:D1Database,reader:string,sourceRow:Record<string,unknown>&{owner_id:unknown;deep_search_json?:unknown}){
  const row=await researchWine(db,reader,{...sourceRow,source_owner_id:String(sourceRow.owner_id)} as IdentityRow&Record<string,unknown>,sourceRow.deep_search_json);
  const targets=wineRowResearchTargets(row);
  const own=await loadResearchCache(db,reader,targets,true);
  const owner=await withSourceResearch(db,reader,row,targets,new Map());
  const cache=new Map(own);
  // The reader's own scope wins when it is newer: a recipient who refreshes the
  // vintage on their own credits sees that refresh, not the owner's older one.
  for(const [scope,entry] of owner){
    const current=cache.get(scope),mine=current&&(!current.contributorId||current.contributorId===reader);
    if(!current||!mine||Date.parse(entry.researchedAt)>Date.parse(current.researchedAt))cache.set(scope,entry);
  }
  return {targets,cache};
}
