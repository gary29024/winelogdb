import { cuveeIdentitySignature,normalizeCuveeAlias,resolveExistingCuvee,stripKnownProducerPrefix } from './entities';

export async function setCuveePrimaryName(db:D1Database,owner:string,cuveeId:string,requestedName:string){
  const row=await db.prepare(`SELECT id,producer_id,canonical_name,appellation,wine_style,catalog_backed FROM cuvees WHERE owner_id=? AND id=?`)
    .bind(owner,cuveeId).first<{id:string;producer_id:string;canonical_name:string;appellation:string|null;wine_style:string|null;catalog_backed:number}>();
  if(!row)throw new Error('Cuvée not found');
  const [producer,aliases]=await Promise.all([
    db.prepare('SELECT canonical_name FROM producers WHERE owner_id=? AND id=?').bind(owner,row.producer_id).first<{canonical_name:string}>(),
    db.prepare('SELECT display_alias FROM producer_aliases WHERE owner_id=? AND producer_id=?').bind(owner,row.producer_id).all<{display_alias:string}>()
  ]);
  const producerNames=[producer?.canonical_name??'',...aliases.results.map(x=>x.display_alias)].filter(Boolean);
  /**
   * Taken as typed. Stripping a known producer prefix is right when a name is
   * being canonicalised automatically - nobody wants the domaine repeated in
   * front of every cuvée it makes - but this is someone asking, in as many
   * words, for this wording. Reducing it silently made the request a no-op
   * reported as a success: Cusumano's Etna wines are labelled Alta Mora, the
   * journal knows Alta Mora as a producer alias, and so "Alta Mora Feudo di
   * Mezzo" came back out as the "Feudo di Mezzo" the cuvée was already called.
   *
   * Identity is unaffected: resolveExistingCuvee and cuveeIdentitySignature
   * strip the prefix for themselves, so the cuvée still answers to both names
   * and still keys on the same signature.
   */
  const canonicalName=requestedName.trim();
  if(!canonicalName||!stripKnownProducerPrefix(canonicalName,producerNames).trim())throw new Error('Primary cuvée name is required');
  if(canonicalName===row.canonical_name)return {id:row.id,canonicalName};

  const resolved=await resolveExistingCuvee(db,owner,row.producer_id,canonicalName,row.appellation,row.wine_style);
  if(!resolved||resolved.id!==row.id)throw new Error('The requested primary name does not resolve to this cuvée');

  const signature=cuveeIdentitySignature(canonicalName,row.appellation,row.wine_style,producerNames);
  const collision=await db.prepare('SELECT id FROM cuvees WHERE owner_id=? AND producer_id=? AND signature_key=? AND id<>? LIMIT 1')
    .bind(owner,row.producer_id,signature,row.id).first<{id:string}>();
  if(collision)throw new Error('Another cuvée already uses this primary identity');

  const stamp=new Date().toISOString(),appellationKey=normalizeCuveeAlias(row.appellation??'');
  const aliasStatement=(displayAlias:string)=>db.prepare(`INSERT INTO cuvee_aliases(owner_id,producer_id,normalized_alias,appellation_key,cuvee_id,display_alias,created_at)
    VALUES(?,?,?,?,?,?,?) ON CONFLICT(owner_id,producer_id,normalized_alias,appellation_key)
    DO UPDATE SET cuvee_id=excluded.cuvee_id,display_alias=excluded.display_alias`)
    .bind(owner,row.producer_id,normalizeCuveeAlias(stripKnownProducerPrefix(displayAlias,producerNames)),appellationKey,row.id,displayAlias,stamp);

  await db.batch([
    aliasStatement(row.canonical_name),
    aliasStatement(canonicalName),
    db.prepare('UPDATE cuvees SET canonical_name=?,signature_key=?,updated_at=? WHERE owner_id=? AND id=?').bind(canonicalName,signature,stamp,owner,row.id),
    db.prepare('UPDATE wines SET wine_name=?,updated_at=? WHERE owner_id=? AND cuvee_id=?').bind(canonicalName,stamp,owner,row.id),
    db.prepare(`UPDATE research_cache SET subject_json=json_set(subject_json,'$.wineName',?),updated_at=?
      WHERE owner_id=? AND scope IN ('terroir','wine_vintage') AND json_extract(subject_json,'$.cuveeId')=?`).bind(canonicalName,stamp,owner,row.id)
  ]);
  return {id:row.id,canonicalName};
}
