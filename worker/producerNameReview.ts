import { ApiError,hash } from '../src/lib/credits/primitives';
import { normalizeProducerAlias,producerMatchKey } from '../src/lib/producers/entities';
import { normalizeReferenceText } from '../src/lib/wine/referenceCatalog';
import type { ReferenceSuggestion } from '../src/lib/wine/referenceSuggestions';

type Wine={id:string;producer:string;wine_name:string;vintage:number|null;reference_suggestions_json:string|null;updated_at:string};
type Producer={id:string;canonical_name:string;match_key:string;updated_at:string};
const wineColumns='id,producer,wine_name,vintage,reference_suggestions_json,updated_at';
const snapshotSql=`SELECT json_group_array(json_array(${wineColumns})) FROM (SELECT ${wineColumns} FROM wines WHERE owner_id=? AND producer_id=? ORDER BY id)`;
function suggestions(raw:string|null):ReferenceSuggestion[]{
 try{const value=JSON.parse(raw??'[]');if(value===null)return [];if(Array.isArray(value)&&value.every(item=>item&&typeof item.field==='string'&&typeof item.suggested==='string'))return value}catch{/* malformed saved data needs review */}
 throw new ApiError(409,'A wine has invalid saved suggestions. Refresh its LWIN review before changing this producer.');
}

export async function previewProducerNameReview(db:D1Database,owner:string,wineId:string){
 const source=await db.prepare('SELECT producer_id FROM wines WHERE owner_id=? AND id=?').bind(owner,wineId).first<{producer_id:string|null}>();
 if(!source)throw new ApiError(404,'Wine not found.');
 if(!source.producer_id)throw new ApiError(409,'Open this wine to finish linking its producer, then try again.');
 const producer=await db.prepare('SELECT id,canonical_name,match_key,updated_at FROM producers WHERE owner_id=? AND id=?').bind(owner,source.producer_id).first<Producer>();
 if(!producer)throw new ApiError(409,'Producer unavailable. Refresh the wine and try again.');
 const {results:wines}=await db.prepare(`SELECT ${wineColumns} FROM wines WHERE owner_id=? AND producer_id=? ORDER BY id`).bind(owner,producer.id).all<Wine>();
 const wine=wines.find(row=>row.id===wineId),suggestion=wine&&suggestions(wine.reference_suggestions_json).find(item=>item.field==='producer');
 if(!wine||!suggestion?.suggested?.trim())throw new ApiError(409,'This producer suggestion is no longer available. Refresh the review.');
 if(normalizeReferenceText(suggestion.current)!==normalizeReferenceText(wine.producer))throw new ApiError(409,'The producer changed. Recheck LWIN before applying it.');
 const name=suggestion.suggested.trim(),names=[...new Set([producer.canonical_name,...wines.map(row=>row.producer),name])].filter(value=>value.trim());
 const aliases=[...new Map(names.map(display=>[normalizeProducerAlias(display),display])).entries()];
 const keys=JSON.stringify(aliases.map(([key])=>key));
 const conflict=await db.prepare(`SELECT producer_id AS id FROM producer_aliases WHERE owner_id=? AND normalized_alias IN (SELECT value FROM json_each(?)) AND producer_id<>?
  UNION SELECT id FROM producers WHERE owner_id=? AND match_key IN (SELECT value FROM json_each(?)) AND id<>? LIMIT 1`)
  .bind(owner,keys,producer.id,owner,keys,producer.id).first<{id:string}>();
 const snapshot=JSON.stringify(wines.map(row=>[row.id,row.producer,row.wine_name,row.vintage,row.reference_suggestions_json,row.updated_at]));
 const previewToken=await hash(JSON.stringify({owner,wineId,producer,snapshot,name,conflict}));
 const preview={producerId:producer.id,currentName:producer.canonical_name,name,wineCount:wines.length,previousNames:names.filter(value=>value!==name),sample:wines.slice(0,5).map(row=>({id:row.id,wineName:row.wine_name,vintage:row.vintage})),conflictProducerId:conflict?.id??null,previewToken};
 return {preview,producer,wines,aliases,keys,snapshot};
}

export async function applyProducerNameReview(db:D1Database,owner:string,wineId:string,token:unknown){
 if(typeof token!=='string'||!token)throw new ApiError(400,'Preview the producer-wide change first.');
 const {preview,producer,wines,aliases,keys,snapshot}=await previewProducerNameReview(db,owner,wineId);
 if(preview.previewToken!==token)throw new ApiError(409,'The producer or its wines changed. Preview the change again.');
 if(preview.conflictProducerId)throw new ApiError(409,'A name already belongs to another producer. Link those producers in Identity & aliases first.');
 const now=new Date().toISOString(),name=preview.name;
 const changes=wines.map(wine=>{
  const remaining=suggestions(wine.reference_suggestions_json).flatMap(item=>item.field!=='producer'?[item]:normalizeReferenceText(item.suggested)===normalizeReferenceText(name)?[]:[{...item,current:name}]);
  const next=remaining.length?JSON.stringify(remaining):null;
  return {id:wine.id,suggestions:next,changed:next!==wine.reference_suggestions_json};
 });
 // D1 batch is transactional. This first statement asserts the entire preview
 // snapshot and alias ownership inside that transaction. An invalid JSON value
 // deliberately aborts the batch on a race, before any names or aliases change.
 const guard=db.prepare(`SELECT json(CASE WHEN
  EXISTS(SELECT 1 FROM producers WHERE owner_id=? AND id=? AND canonical_name=? AND match_key=? AND updated_at=?)
  AND (${snapshotSql})=?
  AND NOT EXISTS(SELECT 1 FROM producer_aliases WHERE owner_id=? AND normalized_alias IN (SELECT value FROM json_each(?)) AND producer_id<>?)
  AND NOT EXISTS(SELECT 1 FROM producers WHERE owner_id=? AND match_key IN (SELECT value FROM json_each(?)) AND id<>?)
  THEN 'true' ELSE 'stale producer review' END)`)
  .bind(owner,producer.id,producer.canonical_name,producer.match_key,producer.updated_at,owner,producer.id,snapshot,owner,keys,producer.id,owner,keys,producer.id);
 try{
  await db.batch([
   guard,
   db.prepare(`INSERT INTO producer_aliases(owner_id,normalized_alias,producer_id,display_alias,created_at)
    SELECT ?,json_extract(value,'$[0]'),?,json_extract(value,'$[1]'),? FROM json_each(?) WHERE 1
    ON CONFLICT(owner_id,normalized_alias) DO UPDATE SET display_alias=excluded.display_alias`)
    .bind(owner,producer.id,now,JSON.stringify(aliases)),
   db.prepare(`INSERT OR IGNORE INTO producer_alias_pool(owner_id,normalized_alias,producer_key)
    SELECT ?,json_extract(value,'$[0]'),? FROM json_each(?) WHERE json_extract(value,'$[0]')<>?`)
    .bind(owner,normalizeProducerAlias(name),JSON.stringify(aliases),normalizeProducerAlias(name)),
   db.prepare('UPDATE producers SET canonical_name=?,match_key=?,updated_at=? WHERE owner_id=? AND id=?').bind(name,producerMatchKey(name),now,owner,producer.id),
   db.prepare(`UPDATE wines SET producer=?,reference_suggestions_json=json_extract(review.value,'$.suggestions'),
    reference_suggestions_updated_at=CASE WHEN json_extract(review.value,'$.changed') THEN CASE WHEN json_extract(review.value,'$.suggestions') IS NULL THEN NULL ELSE ? END ELSE reference_suggestions_updated_at END,
    updated_at=? FROM json_each(?) AS review WHERE owner_id=? AND producer_id=? AND wines.id=json_extract(review.value,'$.id')`)
    .bind(name,now,now,JSON.stringify(changes),owner,producer.id)
  ]);
 }catch(error){
  if(/malformed JSON/i.test(String(error)))throw new ApiError(409,'The producer or its wines changed. Preview the change again.');
  throw error;
 }
 return {ok:true,producerId:producer.id,name,updated:wines.length};
}
