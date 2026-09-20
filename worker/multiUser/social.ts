import { friendRequestRoute } from './friendRequests';
import { ApiError,body,json,ownerOnly,stamp,type IdentityEnv,type Member } from './common';
import { similarFriendProducers } from '../../src/lib/research/similarProducers';
import { rememberProducerAlias } from '../../src/lib/research/aliasBridge';
import type { SharedDeepSearch,SharedWine } from '../../src/lib/wine/shared';
import { deepSearchSchema } from '../../src/lib/db/schema';
import { tastingStructureSchema,type TastingStructure } from '../../src/lib/wine/tastingStructure';
import { hasSparklingDetails,sparklingDetailsSchema,type SparklingDetails } from '../../src/lib/wine/sparklingDetails';
import { serveWineImageObject } from '../wineImageHandler';
import { sharedProducerId } from '../../src/lib/producers/sharedRef';

// Explicit allowlist: never serialize the private WineRecord into a shared response.
export function sharedWine(row:Record<string,unknown>):SharedWine{
 const text=(value:unknown)=>typeof value==='string'?value:'';
 const number=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?value:null;
 let grapes:string[]=[];try{const data:unknown=JSON.parse(String(row.grapes_json||'[]'));if(Array.isArray(data))grapes=data.filter((value):value is string=>typeof value==='string')}catch{/* Invalid legacy grapes must not expose another field. */}
 let grapeBlend:SharedWine['grapeBlend']=[];
 try{
  const data:unknown=JSON.parse(String(row.grape_blend_json||'[]'));
  // Read field by field rather than spreading: a legacy row is not a contract,
  // and spreading it would put whatever else it holds into a shared response.
  if(Array.isArray(data))grapeBlend=data.flatMap(part=>{
   if(!part||typeof part!=='object')return [];
   const entry=part as Record<string,unknown>,grape=text(entry.grape);
   return grape?[{grape,percentage:number(entry.percentage)}]:[];
  });
 }catch{/* Invalid legacy blend falls back to the plain grape names. */}
 const tier=text(row.classification),classification=tier==='grand_cru'||tier==='premier_cru'||tier==='village'?tier:null;
 const deepSearch=publishedDeepSearch(row.deep_search_json);
 return {
  id:text(row.id),ownerName:text(row.display_name),
  producer:text(row.producer),producerId:text(row.viewer_producer_id)||(text(row.producer_id)&&text(row.owner_id)?sharedProducerId(text(row.owner_id),text(row.producer_id)):null),
  wineName:text(row.wine_name),vintage:number(row.vintage),vintageKind:(['vintage','non_vintage','multi_vintage','unknown'].includes(text(row.vintage_kind))?text(row.vintage_kind):null) as SharedWine['vintageKind'],releaseDesignation:text(row.release_designation)||null,
  lwin7:text(row.lwin7)||null,lwin11:text(row.lwin11)||null,elid:text(row.elid)||null,referenceSite:text(row.reference_site)||null,referenceParcel:text(row.reference_parcel)||null,colour:text(row.colour)||null,productType:text(row.product_type)||null,productSubtype:text(row.product_subtype)||null,
  identityMatchStatus:row.identity_match_status==='conflict'?'conflict':null,
  country:text(row.country)||null,region:text(row.region)||null,appellation:text(row.appellation)||null,
  recognizedRegion:text(row.recognized_region)||null,recognizedAppellation:text(row.recognized_appellation)||null,
  wineStyle:text(row.wine_style)||null,grapes,grapeBlend,classification,
  alcoholPercentage:number(row.alcohol_percentage),deepSearch,
  favorite:Boolean(Number(row.viewer_favorite)||0),
  tastingNotes:text(row.viewer_tasting_notes),rating:number(row.viewer_rating),
  tastingDate:text(row.viewer_tasting_date)||null,tastingName:text(row.viewer_tasting_name)||null,
  venue:text(row.viewer_venue)||null,locationName:text(row.viewer_location_name)||null,
  price:number(row.viewer_price),currency:text(row.viewer_currency)||null,
  structure:viewerStructure(row.viewer_structure_json),
  sparklingDetails:sharedSparkling(row.sparkling_details_json),
  updatedAt:text(row.updated_at)
 };
}

/**
 * The research a friend receives. Copied field by field from the validated
 * result, never handed over whole: deepSearchSchema also parses model, quality
 * and provenance, and this PR's rule is that those stay with the owner. Listing
 * the fields here makes the JSON the boundary rather than the page's markup, so
 * a new diagnostic added to the schema does not quietly cross accounts.
 */
export function publishedDeepSearch(raw:unknown):SharedDeepSearch|null{
 if(typeof raw!=='string'||!raw)return null;
 try{
  const parsed=deepSearchSchema.safeParse(JSON.parse(raw));
  if(!parsed.success)return null;
  const deep=parsed.data;
  return {
   summary:deep.summary,
   ...deep.expectedProfile?{expectedProfile:deep.expectedProfile}:{},
   vintageQuality:deep.vintageQuality,
   producerDetails:deep.producerDetails,
   producerWinemakingPractices:deep.producerWinemakingPractices,
   winemakingTechniques:deep.winemakingTechniques,
   terroir:deep.terroir,
   drinkingWindow:deep.drinkingWindow,
   sources:deep.sources,
   researchedAt:deep.researchedAt,
   ...deep.oldestResearchedAt?{oldestResearchedAt:deep.oldestResearchedAt}:{}
  };
 }catch{/* Unparseable research is simply not shared. */return null}
}

/**
 * The bottle's release details. sparklingDetailsSchema is strict and every one
 * of its fields is a release fact, so the parsed object crosses whole; the
 * boundary is the schema, and a test asserts the shared payload's keys are
 * exactly its keys, which fails the day a private field is added to it.
 */
export function sharedSparkling(raw:unknown):SparklingDetails|null{
 if(typeof raw!=='string'||!raw)return null;
 try{
  const parsed=sparklingDetailsSchema.safeParse(JSON.parse(raw));
  return parsed.success&&hasSparklingDetails(parsed.data)?parsed.data:null;
 }catch{return null}
}

/** The viewer's own structure, validated: a stored blob is not a contract. */
export function viewerStructure(raw:unknown):TastingStructure|null{
 if(typeof raw!=='string'||!raw)return null;
 try{const parsed=tastingStructureSchema.safeParse(JSON.parse(raw));return parsed.success?parsed.data:null}catch{return null}
}

/**
 * Prefer the viewer's own producer row when one exists for the same match_key.
 * Otherwise sharedWine() falls back to an authorised synthetic producer ref,
 * which opens the read-only source profile without copying it into this account.
 */
const VIEWER_PRODUCER_SQL=`(SELECT vp.id FROM producers op JOIN producers vp ON vp.owner_id=? AND vp.match_key=op.match_key
  WHERE op.owner_id=w.owner_id AND op.id=w.producer_id) AS viewer_producer_id`;

export async function canReadShared(db:D1Database,viewer:string,wineId:string){
 return db.prepare(`SELECT w.*,u.display_name,
   coalesce(pref.favorite,0) AS viewer_favorite,
   coalesce(pref.tasting_notes,'') AS viewer_tasting_notes,
   pref.rating AS viewer_rating,pref.tasting_date AS viewer_tasting_date,pref.tasting_name AS viewer_tasting_name,
   pref.venue AS viewer_venue,pref.location_name AS viewer_location_name,pref.price AS viewer_price,pref.currency AS viewer_currency,
   pref.structure_json AS viewer_structure_json,
   sd.details_json AS sparkling_details_json,
   ${VIEWER_PRODUCER_SQL}
 FROM wines w
 LEFT JOIN wine_sparkling_details sd ON sd.owner_id=w.owner_id AND sd.wine_id=w.id
 JOIN friendships f ON f.user_id=? AND f.friend_id=w.owner_id
 JOIN app_users u ON u.id=w.owner_id AND u.status='active'
 LEFT JOIN shared_wine_preferences pref ON pref.recipient_id=? AND pref.owner_id=w.owner_id AND pref.wine_id=w.id
 WHERE w.id=? AND (
   EXISTS(SELECT 1 FROM wine_shares s WHERE s.wine_id=w.id AND s.owner_id=w.owner_id AND s.recipient_id=?)
   OR EXISTS(
     SELECT 1 FROM tasting_shares ts
     JOIN wine_experiences we ON we.owner_id=ts.owner_id AND we.tasting_id=ts.tasting_id AND we.wine_id=w.id
     WHERE ts.owner_id=w.owner_id AND ts.recipient_id=?
   )
 )`).bind(viewer,viewer,viewer,wineId,viewer,viewer).first<Record<string,unknown>>();
}

async function acceptedFriendIds(db:D1Database,owner:string,ids:string[]){
 if(ids.length>24)throw new ApiError(400,'Choose up to 24 friends');
 const unique=[...new Set(ids)];
 if(!unique.length)return unique;
 const friends=(await db.prepare('SELECT friend_id FROM friendships WHERE user_id=?').bind(owner).all<{friend_id:string}>()).results;
 if(unique.some(id=>!friends.some(friend=>friend.friend_id===id)))throw new ApiError(400,'Only accepted friends can receive this wine');
 return unique;
}
export type SocialEnv=IdentityEnv&{WINE_IMAGES:R2Bucket;IMAGES?:ImagesBinding};

const detachedImageContext:Pick<ExecutionContext,'waitUntil'>={
 waitUntil(promise){void promise.catch(error=>console.warn(JSON.stringify({event:'shared-image-background-failed',error:String(error)})))}
};

/**
 * Shared photos deliberately reuse the owner's canonical R2 objects. Access is
 * checked against the shared wine first, then this route verifies that the
 * requested image belongs to that wine. The normal image helper then serves the
 * same original or permanent thumb/v1 derivative used by the owner.
 */
export const SHARED_WINES_LIST_SQL=`WITH accessible(wine_id,owner_id,shared_at) AS (
 SELECT s.wine_id,s.owner_id,s.created_at FROM wine_shares s WHERE s.recipient_id=?
 UNION ALL
 SELECT we.wine_id,ts.owner_id,ts.created_at
 FROM tasting_shares ts
 JOIN wine_experiences we ON we.owner_id=ts.owner_id AND we.tasting_id=ts.tasting_id
 WHERE ts.recipient_id=?
), latest AS (
 SELECT wine_id,owner_id,max(shared_at) AS shared_at
 FROM accessible GROUP BY wine_id,owner_id
), page AS MATERIALIZED (
 SELECT a.wine_id,a.owner_id,a.shared_at,u.display_name
 FROM latest a
 JOIN friendships f ON f.user_id=? AND f.friend_id=a.owner_id
 JOIN app_users u ON u.id=a.owner_id AND u.status='active'
 ORDER BY a.shared_at DESC,a.wine_id LIMIT 25 OFFSET ?
)
SELECT w.*,p.display_name,p.shared_at,
  coalesce(pref.favorite,0) AS viewer_favorite,
  coalesce(pref.tasting_notes,'') AS viewer_tasting_notes,
  pref.rating AS viewer_rating,pref.tasting_date AS viewer_tasting_date,pref.tasting_name AS viewer_tasting_name,
  pref.venue AS viewer_venue,pref.location_name AS viewer_location_name,pref.price AS viewer_price,pref.currency AS viewer_currency,
  pref.structure_json AS viewer_structure_json,
  sd.details_json AS sparkling_details_json,
  ${VIEWER_PRODUCER_SQL}
FROM page p
JOIN wines w ON w.id=p.wine_id AND w.owner_id=p.owner_id
LEFT JOIN wine_sparkling_details sd ON sd.owner_id=w.owner_id AND sd.wine_id=w.id
LEFT JOIN shared_wine_preferences pref ON pref.recipient_id=? AND pref.owner_id=p.owner_id AND pref.wine_id=p.wine_id
ORDER BY p.shared_at DESC,w.id`;

export async function socialRoute(request:Request,env:SocialEnv,member:Member,ctx?:Pick<ExecutionContext,'waitUntil'>):Promise<Response|null>{
 const url=new URL(request.url),path=url.pathname;
 const friendRequest=await friendRequestRoute(request,env,member);if(friendRequest)return friendRequest;

 // A friend's research is filed under the producer name they wrote. When this
 // account writes it differently the two never meet, so the name is offered as a
 // suggestion. Confirming records the equivalence in this account's own alias
 // pool only: it changes no producer row, no wine, and nobody else's lookups.
 const suggestions=path.match(/^\/api\/producers\/([^/]+)\/name-suggestions$/);
 if(suggestions){
  const producer=await env.DB.prepare('SELECT canonical_name FROM producers WHERE id=? AND owner_id=?').bind(suggestions[1],member.id).first<{canonical_name:string}>();
  if(!producer)throw new ApiError(404,'Producer not found');
  if(request.method==='GET')return json({items:await similarFriendProducers(env.DB,member.id,producer.canonical_name)});
  if(request.method==='POST'){
   const data=await body(request),name=typeof data.name==='string'?data.name:'';
   // Re-derived rather than trusted: a posted name that is not currently a
   // suggestion must not be able to map this producer onto arbitrary research.
   const offered=await similarFriendProducers(env.DB,member.id,producer.canonical_name);
   if(!offered.some(item=>item.name===name))throw new ApiError(409,'That name is no longer a suggestion for this producer');
   await rememberProducerAlias(env.DB,member.id,producer.canonical_name,name);
   return json({ok:true,name});
  }
 }
 if(path==='/api/friends'&&request.method==='GET')return json({items:(await env.DB.prepare(`SELECT u.id,u.display_name,
   CASE WHEN d.recipient_id IS NULL THEN 0 ELSE 1 END AS defaultShare
   FROM friendships f JOIN app_users u ON u.id=f.friend_id AND u.status='active'
   LEFT JOIN member_share_defaults d ON d.owner_id=f.user_id AND d.recipient_id=f.friend_id
   WHERE f.user_id=? ORDER BY u.display_name`).bind(member.id).all()).results.map(row=>({...row,defaultShare:Boolean(Number((row as Record<string,unknown>).defaultShare)||0)}))});
 const defaultShare=path.match(/^\/api\/friends\/([^/]+)\/default-share$/);
 if(defaultShare&&request.method==='PUT'){
  const data=await body(request),friendId=defaultShare[1];
  if(!await env.DB.prepare('SELECT 1 FROM friendships WHERE user_id=? AND friend_id=?').bind(member.id,friendId).first())throw new ApiError(400,'Only accepted friends can be a default tag');
  if(data.enabled===true)await env.DB.prepare('INSERT OR IGNORE INTO member_share_defaults(owner_id,recipient_id) SELECT ?,? WHERE EXISTS(SELECT 1 FROM friendships WHERE user_id=? AND friend_id=?)').bind(member.id,friendId,member.id,friendId).run();
  else if(data.enabled===false)await env.DB.prepare('DELETE FROM member_share_defaults WHERE owner_id=? AND recipient_id=?').bind(member.id,friendId).run();
  else throw new ApiError(400,'Choose whether this friend is tagged by default');
  return json({ok:true});
 }
 const shareExisting=path.match(/^\/api\/friends\/([^/]+)\/share-existing-wines$/);
 if(shareExisting&&request.method==='POST'){
  // Deliberate pilot guardrail: members can tag selected Journal wines, but only
  // the owner can fan out an unbounded whole-journal share from Account & friends.
  ownerOnly(member);
  const friendId=shareExisting[1];
  if(!await env.DB.prepare('SELECT 1 FROM friendships WHERE user_id=? AND friend_id=?').bind(member.id,friendId).first())throw new ApiError(400,'Only accepted friends can receive shared wines');
  const result=await env.DB.prepare(`INSERT OR IGNORE INTO wine_shares(wine_id,owner_id,recipient_id)
    SELECT id,?,? FROM wines WHERE owner_id=?`).bind(member.id,friendId,member.id).run();
  return json({ok:true,count:Number(result.meta.changes??0)});
 }
 const friend=path.match(/^\/api\/friends\/([^/]+)$/);
 if(friend&&request.method==='DELETE'){
  await env.DB.batch([
   env.DB.prepare('DELETE FROM friendships WHERE (user_id=? AND friend_id=?) OR (user_id=? AND friend_id=?)').bind(member.id,friend[1],friend[1],member.id),
   env.DB.prepare('DELETE FROM wine_shares WHERE (owner_id=? AND recipient_id=?) OR (owner_id=? AND recipient_id=?)').bind(member.id,friend[1],friend[1],member.id),
   env.DB.prepare('DELETE FROM member_share_defaults WHERE (owner_id=? AND recipient_id=?) OR (owner_id=? AND recipient_id=?)').bind(member.id,friend[1],friend[1],member.id),
   env.DB.prepare('DELETE FROM shared_wine_preferences WHERE (owner_id=? AND recipient_id=?) OR (owner_id=? AND recipient_id=?)').bind(member.id,friend[1],friend[1],member.id),
   env.DB.prepare('DELETE FROM tasting_shares WHERE (owner_id=? AND recipient_id=?) OR (owner_id=? AND recipient_id=?)').bind(member.id,friend[1],friend[1],member.id)
  ]);return json({ok:true});
 }
 const bulkShares=path==='/api/wines/shares'&&request.method==='PUT';
 if(bulkShares){
  const data=await body(request);
  if(!Array.isArray(data.wineIds)||!data.wineIds.length||data.wineIds.length>500||data.wineIds.some(id=>typeof id!=='string'))throw new ApiError(400,'Choose between 1 and 500 wines');
  if(!Array.isArray(data.recipientIds)||data.recipientIds.some(id=>typeof id!=='string'))throw new ApiError(400,'Choose valid friends');
  if(data.mode!=='add'&&data.mode!=='set')throw new ApiError(400,'Unknown tagging mode');
  const wineIds=[...new Set(data.wineIds as string[])],ids=await acceptedFriendIds(env.DB,member.id,data.recipientIds as string[]);
  const owned=await env.DB.prepare('SELECT count(*) AS count FROM wines WHERE owner_id=? AND id IN (SELECT value FROM json_each(?))').bind(member.id,JSON.stringify(wineIds)).first<{count:number}>();
  if(Number(owned?.count)!==wineIds.length)throw new ApiError(404,'One or more wines were not found');
  const statements:D1PreparedStatement[]=[];
  if(data.mode==='set')statements.push(env.DB.prepare('DELETE FROM wine_shares WHERE owner_id=? AND wine_id IN (SELECT value FROM json_each(?))').bind(member.id,JSON.stringify(wineIds)));
  if(ids.length)statements.push(env.DB.prepare(`INSERT OR IGNORE INTO wine_shares(wine_id,owner_id,recipient_id)
    SELECT w.id,?,f.friend_id FROM wines w
    JOIN json_each(?) selected ON selected.value=w.id
    JOIN friendships f ON f.user_id=? AND f.friend_id IN (SELECT value FROM json_each(?))
    WHERE w.owner_id=?`).bind(member.id,JSON.stringify(wineIds),member.id,JSON.stringify(ids),member.id));
  if(statements.length)await env.DB.batch(statements);return json({ok:true,count:wineIds.length});
 }
 const tastingShares=path.match(/^\/api\/tastings\/([^/]+)\/shares$/);
 if(tastingShares){
  const tasting=await env.DB.prepare('SELECT id FROM tastings WHERE id=? AND owner_id=?').bind(tastingShares[1],member.id).first();
  if(!tasting)throw new ApiError(404,'Tasting not found');
  if(request.method==='GET')return json({recipientIds:(await env.DB.prepare('SELECT recipient_id FROM tasting_shares WHERE tasting_id=? AND owner_id=?').bind(tastingShares[1],member.id).all<{recipient_id:string}>()).results.map(item=>item.recipient_id)});
  if(request.method==='PUT'){
   const data=await body(request);if(!Array.isArray(data.recipientIds)||data.recipientIds.some(id=>typeof id!=='string'))throw new ApiError(400,'Choose valid friends');
   const ids=await acceptedFriendIds(env.DB,member.id,data.recipientIds as string[]);
   await env.DB.batch([env.DB.prepare('DELETE FROM tasting_shares WHERE tasting_id=? AND owner_id=?').bind(tastingShares[1],member.id),...ids.map(id=>env.DB.prepare('INSERT INTO tasting_shares(tasting_id,owner_id,recipient_id) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM friendships WHERE user_id=? AND friend_id=?)').bind(tastingShares[1],member.id,id,member.id,id))]);
   return json({ok:true});
  }
 }
 const shares=path.match(/^\/api\/wines\/([^/]+)\/shares$/);
 if(shares){
  const wine=await env.DB.prepare('SELECT id FROM wines WHERE id=? AND owner_id=?').bind(shares[1],member.id).first();if(!wine)throw new ApiError(404,'Wine not found');
  if(request.method==='GET')return json({recipientIds:(await env.DB.prepare('SELECT recipient_id FROM wine_shares WHERE wine_id=? AND owner_id=?').bind(shares[1],member.id).all<{recipient_id:string}>()).results.map(x=>x.recipient_id)});
  if(request.method==='PUT'){
   const data=await body(request);if(!Array.isArray(data.recipientIds)||data.recipientIds.some(x=>typeof x!=='string'))throw new ApiError(400,'Choose valid friends');
   const ids=await acceptedFriendIds(env.DB,member.id,data.recipientIds as string[]);
   await env.DB.batch([env.DB.prepare('DELETE FROM wine_shares WHERE wine_id=? AND owner_id=?').bind(shares[1],member.id),...ids.map(id=>env.DB.prepare('INSERT INTO wine_shares(wine_id,owner_id,recipient_id) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM friendships WHERE user_id=? AND friend_id=?)').bind(shares[1],member.id,id,member.id,id))]);return json({ok:true});
  }
 }
 if(path==='/api/shared/wines'&&request.method==='GET'){
  const offset=Math.max(0,Math.min(100000,Number(url.searchParams.get('offset'))||0));
  const rows=await env.DB.prepare(SHARED_WINES_LIST_SQL).bind(member.id,member.id,member.id,offset,member.id,member.id).all<Record<string,unknown>>();return json({items:rows.results.map(sharedWine),nextOffset:rows.results.length===25?offset+25:null});
 }
 const sharedExperience=path.match(/^\/api\/shared\/wines\/([^/]+)\/experience$/);
 if(sharedExperience&&request.method==='PUT'){
  const wine=await canReadShared(env.DB,member.id,sharedExperience[1]);if(!wine)throw new ApiError(404,'Shared wine not found');
  const data=await body(request);
  const optionalText=(value:unknown,max:number,label:string)=>{
   if(value==null||value==='')return null;if(typeof value!=='string')throw new ApiError(400,`${label} must be text`);
   const trimmed=value.trim();if(!trimmed)return null;if(trimmed.length>max)throw new ApiError(400,`${label} is too long`);return trimmed;
  };
  const optionalNumber=(value:unknown,min:number,max:number,label:string)=>{
   if(value==null||value==='')return null;if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new ApiError(400,`${label} is invalid`);return value;
  };
  const tastingNotes=optionalText(data.tastingNotes,10000,'Sensory notes')??'',rating=optionalNumber(data.rating,0,100,'Rating');
  const tastingDate=optionalText(data.tastingDate,10,'Drinking date');
  if(tastingDate){const parsed=new Date(`${tastingDate}T00:00:00Z`);if(!/^\d{4}-\d{2}-\d{2}$/.test(tastingDate)||Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==tastingDate)throw new ApiError(400,'Drinking date is invalid')}
  const tastingName=optionalText(data.tastingName,500,'Tasting / event'),venue=optionalText(data.venue,500,'Venue'),locationName=optionalText(data.locationName,500,'Location');
  const price=optionalNumber(data.price,0,Number.MAX_SAFE_INTEGER,'Price');
  const rawCurrency=optionalText(data.currency,3,'Currency'),currency=rawCurrency?.toUpperCase()??null;
  if(currency&&!/^[A-Z]{3}$/.test(currency))throw new ApiError(400,'Use a 3-letter currency code such as USD, EUR or HKD');
  // The viewer's own perceived structure. Parsed against the same schema the
  // owner's form uses, so an unknown key or an out-of-scale value is a 400
  // rather than a blob stored now and silently dropped when it is read back.
  let structure:TastingStructure|null=null;
  if(data.structure!=null){
   const parsed=tastingStructureSchema.safeParse(data.structure);
   if(!parsed.success)throw new ApiError(400,'Structure is invalid');
   structure=Object.values(parsed.data).some(value=>value!=null)?parsed.data:null;
  }
  const structureJson=structure?JSON.stringify(structure):null;
  const now=stamp();
  await env.DB.prepare(`INSERT INTO shared_wine_preferences(
    recipient_id,owner_id,wine_id,favorite,tasting_notes,rating,tasting_date,tasting_name,venue,location_name,price,currency,structure_json,created_at,updated_at
   ) VALUES(?,?,?,0,?,?,?,?,?,?,?,?,?,?,?)
   ON CONFLICT(recipient_id,owner_id,wine_id) DO UPDATE SET
    tasting_notes=excluded.tasting_notes,rating=excluded.rating,tasting_date=excluded.tasting_date,tasting_name=excluded.tasting_name,
    venue=excluded.venue,location_name=excluded.location_name,price=excluded.price,currency=excluded.currency,
    structure_json=excluded.structure_json,updated_at=excluded.updated_at`)
   .bind(member.id,String(wine.owner_id),sharedExperience[1],tastingNotes,rating,tastingDate,tastingName,venue,locationName,price,currency,structureJson,now,now).run();
  return json({ok:true,experience:{tastingNotes,rating,tastingDate,tastingName,venue,locationName,price,currency,structure}});
 }
 const shared=path.match(/^\/api\/shared\/wines\/([^/]+)(?:\/photos\/([^/]+))?$/);
 if(shared&&request.method==='GET'){
  const wine=await canReadShared(env.DB,member.id,shared[1]);if(!wine)throw new ApiError(404,'Shared wine not found');
  const owner=String(wine.owner_id);
  if(shared[2]){
   // canReadShared authorizes the wine; this second predicate prevents an image
   // id from another wine owned by the same friend being substituted into the URL.
   const image=await env.DB.prepare('SELECT object_key FROM wine_images WHERE id=? AND wine_id=? AND owner_id=?')
    .bind(shared[2],shared[1],owner).first<{object_key:string}>();
   if(!image)throw new ApiError(404,'Photo not found');
   return serveWineImageObject(request,env,owner,String(shared[2]),image.object_key,ctx??detachedImageContext);
  }
  const photos=(await env.DB.prepare('SELECT id FROM wine_images WHERE wine_id=? AND owner_id=? ORDER BY rowid')
   .bind(shared[1],owner).all<{id:string}>()).results;
  return json({...sharedWine(wine),photos:photos.map(photo=>({id:photo.id,url:`/api/shared/wines/${shared[1]}/photos/${photo.id}`}))});
 }
 return null;
}
