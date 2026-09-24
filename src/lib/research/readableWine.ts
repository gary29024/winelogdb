import { loadWineResearchCache,type CachedResearch,type ResearchScope,type ResearchTarget } from './cache';

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

/**
 * Fill a reader's research for a shared wine from the owner's saved scopes for
 * that exact wine, exactly as the shared page shows them. A recipient is not
 * charged to research a section they can already read. Scopes the reader is
 * refreshing are skipped, so a refresh never falls back to the old answer.
 *
 * Every borrowed entry keeps the account that paid for it: the owner, or
 * whoever the owner adopted it from. Adoption then files it under that name,
 * so the owner's research is never credited to the recipient.
 */
export async function withSourceResearch(db:D1Database,reader:string,sourceOwner:string|null|undefined,targets:ResearchTarget[],cache:Map<ResearchScope,CachedResearch>,skip:ReadonlySet<ResearchScope>=new Set()){
  if(!sourceOwner||sourceOwner===reader)return cache;
  const missing=targets.filter(target=>!cache.has(target.scope)&&!skip.has(target.scope));
  if(!missing.length)return cache;
  const source=await loadWineResearchCache(db,sourceOwner,missing);
  for(const [scope,entry] of source)cache.set(scope,{...entry,contributorId:entry.contributorId??sourceOwner});
  return cache;
}
