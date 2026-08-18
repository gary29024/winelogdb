import { z } from 'zod';

const optionalPatchText=z.preprocess(value=>{
  if(value===undefined)return undefined;
  if(value===null)return null;
  if(typeof value==='string')return value.trim()||null;
  return value;
},z.string().trim().max(500).nullable().optional());

export const batchExperienceSchema=z.object({
  ids:z.array(z.string().uuid()).min(1).max(500).transform(ids=>[...new Set(ids)]),
  tastingName:optionalPatchText,
  venue:optionalPatchText
}).superRefine((value,ctx)=>{
  if(value.tastingName===undefined&&value.venue===undefined)ctx.addIssue({code:'custom',message:'Choose event and/or venue to update'});
});

export type BatchExperienceUpdate=z.infer<typeof batchExperienceSchema>;

const normalized=(value:string|null|undefined)=>String(value??'').trim().toLocaleLowerCase();
export function shouldReplaceVenueFallback(locationName:string|null|undefined,previousVenue:string|null|undefined){
  const location=normalized(locationName),venue=normalized(previousVenue);
  return !location||Boolean(venue&&location===venue);
}

export async function applyBatchExperienceUpdate(db:D1Database,owner:string,patch:BatchExperienceUpdate){
  const idsJson=JSON.stringify(patch.ids),now=new Date().toISOString();
  const owned=await db.prepare(`SELECT count(*) AS count FROM wines w JOIN json_each(?) picked ON picked.value=w.id WHERE w.owner_id=?`).bind(idsJson,owner).first<{count:number}>();
  if(Number(owned?.count)!==patch.ids.length)throw new Error('One or more selected wines no longer exist');

  const statements:D1PreparedStatement[]=[];
  const hasEvent=patch.tastingName!==undefined,hasVenue=patch.venue!==undefined;
  const eventName=patch.tastingName??null,venue=patch.venue??null;

  if(hasEvent&&eventName){
    statements.push(db.prepare(`INSERT OR IGNORE INTO tastings(id,owner_id,name,tasting_date,venue,created_at,updated_at)
      SELECT lower(hex(randomblob(16))), ?, ?, w.tasting_date, ?, ?, ?
      FROM wines w JOIN json_each(?) picked ON picked.value=w.id
      WHERE w.owner_id=?
      GROUP BY w.tasting_date`).bind(owner,eventName,hasVenue?venue:null,now,now,idsJson,owner));
  }

  const needsMissingExperience=(hasEvent&&Boolean(eventName))||(hasVenue&&Boolean(venue));
  if(needsMissingExperience){
    const tastingExpression=hasEvent&&eventName
      ? `(SELECT t.id FROM tastings t WHERE t.owner_id=w.owner_id AND t.name=? AND coalesce(t.tasting_date,'')=coalesce(w.tasting_date,'') LIMIT 1)`
      : 'NULL';
    const sql=`INSERT INTO wine_experiences(id,owner_id,wine_id,tasting_id,consumed_at,latitude,longitude,location_name,rating,tasting_notes,created_at,updated_at)
      SELECT lower(hex(randomblob(16))),w.owner_id,w.id,${tastingExpression},w.tasting_date,NULL,NULL,${hasVenue?'?':'NULL'},w.rating,coalesce(w.tasting_notes,''),?,?
      FROM wines w JOIN json_each(?) picked ON picked.value=w.id
      WHERE w.owner_id=? AND NOT EXISTS(SELECT 1 FROM wine_experiences we WHERE we.owner_id=w.owner_id AND we.wine_id=w.id)`;
    const binds:unknown[]=[];
    if(hasEvent&&eventName)binds.push(eventName);
    if(hasVenue)binds.push(venue);
    binds.push(now,now,idsJson,owner);
    statements.push(db.prepare(sql).bind(...binds));
  }

  if(hasVenue){
    statements.push(db.prepare(`UPDATE wine_experiences AS we SET
      location_name=CASE
        WHEN trim(coalesce(we.location_name,''))=''
          OR lower(trim(we.location_name))=lower(trim(coalesce((SELECT w.venue FROM wines w WHERE w.owner_id=we.owner_id AND w.id=we.wine_id),'')))
        THEN ? ELSE we.location_name END,
      updated_at=?
      WHERE we.owner_id=? AND we.id IN (
        SELECT (SELECT latest.id FROM wine_experiences latest WHERE latest.owner_id=w.owner_id AND latest.wine_id=w.id ORDER BY latest.created_at DESC LIMIT 1)
        FROM wines w JOIN json_each(?) picked ON picked.value=w.id WHERE w.owner_id=?
      )`).bind(venue,now,owner,idsJson,owner));
  }

  if(hasEvent){
    const target=eventName
      ? `(SELECT t.id FROM tastings t JOIN wines w ON w.owner_id=we.owner_id AND w.id=we.wine_id WHERE t.owner_id=we.owner_id AND t.name=? AND coalesce(t.tasting_date,'')=coalesce(w.tasting_date,'') LIMIT 1)`
      : 'NULL';
    const sql=`UPDATE wine_experiences AS we SET tasting_id=${target},updated_at=?
      WHERE we.owner_id=? AND we.id IN (
        SELECT (SELECT latest.id FROM wine_experiences latest WHERE latest.owner_id=w.owner_id AND latest.wine_id=w.id ORDER BY latest.created_at DESC LIMIT 1)
        FROM wines w JOIN json_each(?) picked ON picked.value=w.id WHERE w.owner_id=?
      )`;
    const binds:unknown[]=[];
    if(eventName)binds.push(eventName);
    binds.push(now,owner,idsJson,owner);
    statements.push(db.prepare(sql).bind(...binds));
  }

  if(hasVenue){
    statements.push(db.prepare(`UPDATE wines SET venue=?,updated_at=? WHERE owner_id=? AND id IN (SELECT value FROM json_each(?))`).bind(venue,now,owner,idsJson));
  }

  if(statements.length)await db.batch(statements);
  return {updated:patch.ids.length,tastingName:hasEvent?eventName:undefined,venue:hasVenue?venue:undefined};
}
