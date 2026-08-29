import { z } from 'zod';

/**
 * Putting wines that already exist into a tasting.
 *
 * Deliberately not applyBatchExperienceUpdate: that resolves a tasting by name
 * and creates one row per distinct wines.tasting_date in the selection, which
 * is right for "retag these wines with this event text" and wrong for "these
 * bottles were poured at this evening", where the evening is already a row with
 * an id.
 *
 * It also touches only wine_experiences - never the wines row, not venue and
 * not date. Where a bottle was poured is a fact about the pour: keeping it
 * there makes detach a clean reversal, and keeps a fourteen-wine attach at zero
 * achievement-cache invalidations, since 0031 deliberately leaves experiences
 * out of the owner revision while writing wines.venue would bump it.
 */
export const attachTastingWinesSchema=z.object({
  ids:z.array(z.string().uuid()).min(1).max(500).transform(ids=>[...new Set(ids)])
});
export type AttachTastingWines=z.infer<typeof attachTastingWinesSchema>;

export async function attachWinesToTasting(db:D1Database,owner:string,tastingId:string,ids:string[]){
  const tasting=await db.prepare('SELECT id FROM tastings WHERE owner_id=? AND id=?').bind(owner,tastingId).first<{id:string}>();
  // Attaching works on a closed tasting as much as an open one: the printed
  // wine list usually turns up after everyone has gone home.
  if(!tasting)throw new Error('That tasting no longer exists');

  const idsJson=JSON.stringify(ids),now=new Date().toISOString();
  const owned=await db.prepare('SELECT count(*) AS count FROM wines w JOIN json_each(?) picked ON picked.value=w.id WHERE w.owner_id=?')
    .bind(idsJson,owner).first<{count:number}>();
  if(Number(owned?.count)!==ids.length)throw new Error('One or more selected wines no longer exist');

  await db.batch([
    // A wine saved before experiences existed has none, so give it one rather
    // than silently skipping it. Same shape as the batch editor's backfill, but
    // with the tasting bound directly instead of matched by name.
    // The id has to be generated per row by SQL: one bound value would be
    // reused for every wine and collide on the primary key. Same expression the
    // batch editor's backfill uses.
    db.prepare(`INSERT INTO wine_experiences(id,owner_id,wine_id,tasting_id,consumed_at,latitude,longitude,location_name,rating,tasting_notes,created_at,updated_at)
      SELECT lower(hex(randomblob(16))),w.owner_id,w.id,?,w.tasting_date,NULL,NULL,NULL,w.rating,coalesce(w.tasting_notes,''),?,?
      FROM wines w JOIN json_each(?) picked ON picked.value=w.id
      WHERE w.owner_id=? AND NOT EXISTS(SELECT 1 FROM wine_experiences we WHERE we.owner_id=w.owner_id AND we.wine_id=w.id)`)
      .bind(tastingId,now,now,idsJson,owner),
    db.prepare(`UPDATE wine_experiences AS we SET tasting_id=?,updated_at=?
      WHERE we.owner_id=? AND we.id IN (
        SELECT (SELECT latest.id FROM wine_experiences latest WHERE latest.owner_id=w.owner_id AND latest.wine_id=w.id ORDER BY latest.created_at DESC LIMIT 1)
        FROM wines w JOIN json_each(?) picked ON picked.value=w.id WHERE w.owner_id=?
      )`).bind(tastingId,now,owner,idsJson,owner)
  ]);
  return {attached:ids.length};
}

export async function detachWineFromTasting(db:D1Database,owner:string,tastingId:string,wineId:string){
  const result=await db.prepare('UPDATE wine_experiences SET tasting_id=NULL,updated_at=? WHERE owner_id=? AND tasting_id=? AND wine_id=?')
    .bind(new Date().toISOString(),owner,tastingId,wineId).run();
  return {detached:Boolean(result.meta.changes)};
}
