import type { WineInput } from './schema';
import { OPEN } from '../tastings/session';
import { hasTastingStructure,type TastingStructure } from '../wine/tastingStructure';
import { hasSparklingDetails,type SparklingDetails } from '../wine/sparklingDetails';
import { referenceIdentityStatements,type StoredReferenceIdentity } from '../wine/referenceIdentity';

export function sparklingDetailsStatement(db:D1Database,owner:string,wineId:string,details:SparklingDetails|null,stamp=new Date().toISOString()){
  if(!hasSparklingDetails(details))return db.prepare('DELETE FROM wine_sparkling_details WHERE owner_id=? AND wine_id=?').bind(owner,wineId);
  return db.prepare(`INSERT INTO wine_sparkling_details(owner_id,wine_id,details_json,updated_at)
    SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM wines WHERE owner_id=? AND id=?)
    ON CONFLICT(owner_id,wine_id) DO UPDATE SET details_json=excluded.details_json,updated_at=excluded.updated_at`)
    .bind(owner,wineId,JSON.stringify(details),stamp,owner,wineId);
}

export function tastingStructureStatement(db:D1Database,owner:string,wineId:string,structure:TastingStructure|null,stamp=new Date().toISOString()){
  if(!structure||!hasTastingStructure(structure))return db.prepare('DELETE FROM wine_tasting_structures WHERE owner_id=? AND wine_id=?').bind(owner,wineId);
  return db.prepare(`INSERT INTO wine_tasting_structures(owner_id,wine_id,structure_json,created_at,updated_at)
    SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM wines WHERE owner_id=? AND id=?)
    ON CONFLICT(owner_id,wine_id) DO UPDATE SET structure_json=excluded.structure_json,updated_at=excluded.updated_at`)
    .bind(owner,wineId,JSON.stringify(structure),stamp,stamp,owner,wineId);
}

/** Append to the wine write's D1 batch. Nothing is committed while preparing it. */
export function wineSaveStatements(db:D1Database,owner:string,wineId:string,w:WineInput,updateExisting=false,previous?:StoredReferenceIdentity){
  const statements:D1PreparedStatement[]=[],stamp=new Date().toISOString();
  const hasExperience=Boolean(w.tastingName||w.tastingDate||w.venue||w.locationName||w.latitude!=null||w.longitude!=null||w.rating!=null||w.tastingNotes);
  const name=w.tastingName?.trim()||null,date=w.tastingDate??null;
  const tastingId="(SELECT id FROM tastings WHERE owner_id=? AND name=? AND coalesce(tasting_date,'')=coalesce(?,''))";
  if(name)statements.push(db.prepare(`INSERT INTO tastings(id,owner_id,name,tasting_date,venue,created_at,updated_at)
    SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM wines WHERE owner_id=? AND id=?)
    ON CONFLICT DO NOTHING`).bind(crypto.randomUUID(),owner,name,date,w.venue??null,stamp,stamp,owner,wineId));
  if(updateExisting){
    // Keep the latest experience as an empty record when explicitly cleared.
    // Deleting it would expose an older experience on the next detail read.
    statements.push(db.prepare(`UPDATE wine_experiences SET tasting_id=${tastingId},consumed_at=?,latitude=?,longitude=?,location_name=?,rating=?,tasting_notes=?,updated_at=?
      WHERE owner_id=? AND id=(SELECT id FROM wine_experiences WHERE owner_id=? AND wine_id=? ORDER BY created_at DESC LIMIT 1)`)
      .bind(owner,name,date,date,w.latitude??null,w.longitude??null,w.locationName??w.venue??null,w.rating??null,w.tastingNotes??'',stamp,owner,owner,wineId));
  }
  if(hasExperience){
    statements.push(db.prepare(`INSERT INTO wine_experiences(id,owner_id,wine_id,tasting_id,consumed_at,latitude,longitude,location_name,rating,tasting_notes,created_at,updated_at)
      SELECT ?,?,?,${tastingId},?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM wines WHERE owner_id=? AND id=?)
      ${updateExisting?'AND NOT EXISTS (SELECT 1 FROM wine_experiences WHERE owner_id=? AND wine_id=?)':''}`)
      .bind(crypto.randomUUID(),owner,wineId,owner,name,date,date,w.latitude??null,w.longitude??null,w.locationName??w.venue??null,w.rating??null,w.tastingNotes??'',stamp,stamp,owner,wineId,...(updateExisting?[owner,wineId]:[])));
    // Only creation updates the live tasting; historical edits must not close it.
    if(!updateExisting){
      if(date)statements.push(db.prepare(`UPDATE tastings SET ended_at=?,updated_at=? WHERE owner_id=? AND ${OPEN} AND coalesce(tasting_date,'')<>?`).bind(stamp,stamp,owner,date));
      if(name)statements.push(db.prepare(`UPDATE tastings SET last_wine_at=?,updated_at=? WHERE owner_id=? AND id=${tastingId} AND ${OPEN}`).bind(stamp,stamp,owner,owner,name,date));
    }
  }
  // New wines either use the explicit selection made on this save, or inherit
  // the account default when the form was left untouched. Keeping this in the
  // same D1 batch as wine creation prevents a sharing failure from making a
  // successfully saved wine look unsaved and inviting a duplicate retry.
  if(!updateExisting){
    if(w.shareRecipientIds!==undefined)statements.push(db.prepare(`INSERT OR IGNORE INTO wine_shares(wine_id,owner_id,recipient_id)
      SELECT ?,?,f.friend_id FROM friendships f
      WHERE f.user_id=? AND f.friend_id IN (SELECT value FROM json_each(?))`).bind(wineId,owner,owner,JSON.stringify(w.shareRecipientIds)));
    else statements.push(db.prepare(`INSERT OR IGNORE INTO wine_shares(wine_id,owner_id,recipient_id)
      SELECT ?,?,d.recipient_id FROM member_share_defaults d
      JOIN friendships f ON f.user_id=d.owner_id AND f.friend_id=d.recipient_id
      WHERE d.owner_id=?`).bind(wineId,owner,owner));
  }
  // Omitted means preserve, null means clear. Older clients need not send it.
  if(w.tastingStructure!==undefined)statements.push(tastingStructureStatement(db,owner,wineId,w.tastingStructure,stamp));
  if(w.sparklingDetails!==undefined)statements.push(sparklingDetailsStatement(db,owner,wineId,w.sparklingDetails,stamp));
  statements.push(...referenceIdentityStatements(db,owner,wineId,w,stamp,updateExisting,previous));
  return statements;
}
