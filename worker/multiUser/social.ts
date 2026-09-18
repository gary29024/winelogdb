import { friendRequestRoute } from './friendRequests';
import { ApiError,body,boundedBytes,json,stamp,type IdentityEnv,type Member } from './common';
import { similarFriendProducers } from '../../src/lib/research/similarProducers';
import { rememberProducerAlias } from '../../src/lib/research/aliasBridge';
import type { SharedDeepSearch,SharedWine } from '../../src/lib/wine/shared';
import { deepSearchSchema } from '../../src/lib/db/schema';
import { tastingStructureSchema,type TastingStructure } from '../../src/lib/wine/tastingStructure';
import { meteredBucket } from './storage';

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
  producer:text(row.producer),producerId:text(row.viewer_producer_id)||null,
  wineName:text(row.wine_name),vintage:number(row.vintage),
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

/** The viewer's own structure, validated: a stored blob is not a contract. */
export function viewerStructure(raw:unknown):TastingStructure|null{
 if(typeof raw!=='string'||!raw)return null;
 try{const parsed=tastingStructureSchema.safeParse(JSON.parse(raw));return parsed.success?parsed.data:null}catch{return null}
}

/**
 * Producers are keyed (owner_id, id), so the source owner's producer id means
 * nothing in the viewer's account. Their shared match_key does: this resolves
 * to the viewer's OWN producer row for the same producer, and hands back null
 * when they have never logged it, rather than a link that would 404.
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
   ${VIEWER_PRODUCER_SQL}
 FROM wines w
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
/** Accept JPEG derivatives (baseline or progressive) and remove application/comment metadata. */
export function stripJpegMetadata(bytes:Uint8Array):Uint8Array{
 if(bytes[0]!==0xff||bytes[1]!==0xd8)throw new ApiError(400,'A JPEG sharing copy is required');
 const parts:Uint8Array[]=[bytes.slice(0,2)];let p=2,scan=false,ended=false;
 while(p<bytes.length){
  if(bytes[p]!==0xff)throw new ApiError(400,'Invalid JPEG');
  const marker=bytes[p+1];
  if(marker===0xd9){parts.push(bytes.slice(p,p+2));ended=true;break}
  if(marker===0xda){
   const size=(bytes[p+2]<<8)|bytes[p+3];if(size<2||p+size+2>bytes.length)throw new ApiError(400,'Invalid JPEG scan');
   let end=p+size+2;
   while(end<bytes.length){if(bytes[end]!==0xff){end++;continue}const next=bytes[end+1];if(next===0||next>=0xd0&&next<=0xd7){end+=2;continue}break}
   parts.push(bytes.slice(p,end));p=end;scan=true;continue;
  }
  const length=(bytes[p+2]<<8)|bytes[p+3];if(length<2||p+2+length>bytes.length)throw new ApiError(400,'Invalid JPEG segment');
  if(!(marker>=0xe0&&marker<=0xef)&&marker!==0xfe)parts.push(bytes.slice(p,p+2+length));p+=2+length;
 }
 if(!scan||!ended)throw new ApiError(400,'Invalid JPEG scan');
 const result=new Uint8Array(parts.reduce((sum,x)=>sum+x.length,0));let pos=0;for(const part of parts){result.set(part,pos);pos+=part.length}return result;
}
type SocialEnv=IdentityEnv&{WINE_IMAGES:R2Bucket;IMAGES?:ImagesBinding};

function sharingBucket(env:SocialEnv,owner:string){
 return meteredBucket(env.WINE_IMAGES,env.DB,owner,{skipMemberLimit:true,countsTowardMemberLimit:false});
}

/**
 * A derivative is generated once per photo and reused by every friend and every
 * view, so the steady-state cost is zero. These bounds exist only for the moments
 * that are not steady state: a photo that cannot be derived at all, and the first
 * two viewers arriving together.
 */
const SHARING_LEASE_MS=60_000;
/** Backoff by attempt number: ~15m, 1h, 6h, then daily. */
const SHARING_BACKOFF_MS=[15*60_000,60*60_000,6*60*60_000,24*60*60_000];
/**
 * Derivatives generated per request. A wine may carry up to 30 photos, but a real
 * set is front/back/neck/additional, so this completes an ordinary wine on its
 * first view while keeping one GET's transform work bounded. Anything beyond it
 * arrives on the next view.
 */
const SHARING_MAX_PER_REQUEST=8;

/** `priorAttempts` is the number of failures before this one, so 0 gives the first rung. */
const sharingRetryAfter=(priorAttempts:number)=>
 new Date(Date.now()+SHARING_BACKOFF_MS[Math.min(priorAttempts,SHARING_BACKOFF_MS.length-1)]).toISOString();

/**
 * Takes the one attempt slot for this photo, or reports that another request
 * already holds it. Concurrent first views would otherwise both pay for a
 * transform of the same photo before either wrote its shared_photos row.
 */
async function claimSharingPhoto(env:SocialEnv,owner:string,imageId:string){
 const now=stamp(),lease=new Date(Date.now()+SHARING_LEASE_MS).toISOString();
 const claimed=await env.DB.prepare(`INSERT INTO shared_photo_attempts(image_id,owner_id,attempts,retry_after,updated_at)
   VALUES(?,?,0,?,?)
   ON CONFLICT(image_id) DO UPDATE SET retry_after=excluded.retry_after,updated_at=excluded.updated_at,error=NULL
   WHERE shared_photo_attempts.retry_after<=?`).bind(imageId,owner,lease,now,now).run();
 return Boolean(claimed.meta.changes);
}

type SharingPhotoAttempt='ready'|'busy'|'failed';

async function ensureSharingPhoto(env:SocialEnv,owner:string,image:{id:string;object_key:string;attempts:number}):Promise<SharingPhotoAttempt>{
 if(!env.IMAGES)return 'failed';
 if(!await claimSharingPhoto(env,owner,image.id))return 'busy';
 try{
  const original=await env.WINE_IMAGES.get(image.object_key);if(!original)throw new Error('Original photo is no longer stored');
  const output=await env.IMAGES.input(original.body).transform({width:1600,height:1600,fit:'scale-down'}).output({format:'image/jpeg',quality:80,anim:false});
  const response=output.response();if(!response.ok)throw new Error(`Sharing image transform returned ${response.status}`);
  const bytes=stripJpegMetadata(new Uint8Array(await response.arrayBuffer())),key=`shared/${owner}/${image.id}.jpg`;
  await sharingBucket(env,owner).put(key,bytes,{httpMetadata:{contentType:'image/jpeg'},storageClass:'Standard'});
  await env.DB.batch([
   env.DB.prepare('INSERT INTO shared_photos(image_id,owner_id,object_key,byte_size) VALUES(?,?,?,?) ON CONFLICT(image_id) DO UPDATE SET object_key=excluded.object_key,byte_size=excluded.byte_size,created_at=?').bind(image.id,owner,key,bytes.length,stamp()),
   env.DB.prepare('DELETE FROM shared_photo_attempts WHERE image_id=? AND owner_id=?').bind(image.id,owner)
  ]);
  return 'ready';
 }catch(error){
  const message=(error as Error).message;
  await env.DB.prepare('UPDATE shared_photo_attempts SET attempts=attempts+1,error=?,retry_after=?,updated_at=? WHERE image_id=? AND owner_id=?')
   .bind(message.slice(0,300),sharingRetryAfter(image.attempts),stamp(),image.id,owner).run().catch(()=>undefined);
  console.warn(JSON.stringify({event:'sharing-photo-prepare-failed',imageId:image.id,attempts:image.attempts+1,error:message}));
  return 'failed';
 }
}

const SHARING_CONTENTION_DELAYS_MS=[100,200,400,800];

/**
 * A concurrent viewer that loses the lease should not get a misleading
 * photo-less first render while the winner is still finishing the derivative.
 * Poll only the contended image ids, and only for a short bounded window.
 */
async function waitForSharingPhotoContention(env:SocialEnv,owner:string,imageIds:string[]){
 let pending=[...new Set(imageIds)];
 for(const delay of SHARING_CONTENTION_DELAYS_MS){
  if(!pending.length)return;
  await new Promise(resolve=>setTimeout(resolve,delay));
  const placeholders=pending.map(()=>'?').join(',');
  const rows=(await env.DB.prepare(`SELECT image_id FROM shared_photos WHERE owner_id=? AND image_id IN (${placeholders})`).bind(owner,...pending).all<{image_id:string}>()).results;
  const ready=new Set(rows.map(row=>row.image_id));
  pending=pending.filter(id=>!ready.has(id));
 }
}

async function ensureSharingPhotos(env:SocialEnv,owner:string,images:Array<{id:string;object_key:string;attempts:number}>){
 if(!images.length)return [] as string[];
 if(!env.IMAGES){
  console.warn(JSON.stringify({event:'sharing-photo-images-binding-missing',imageCount:images.length}));
  return [] as string[];
 }
 // Capped so one shared-wine GET cannot fan a 30-photo wine into 30 transforms.
 // Each derivative commits on its own, so the next view resumes where this left off.
 const candidates=images.slice(0,SHARING_MAX_PER_REQUEST);
 const states=await Promise.all(candidates.map(image=>ensureSharingPhoto(env,owner,image)));
 return candidates.flatMap((image,index)=>states[index]==='busy'?[image.id]:[]);
}

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
  ${VIEWER_PRODUCER_SQL}
FROM page p
JOIN wines w ON w.id=p.wine_id AND w.owner_id=p.owner_id
LEFT JOIN shared_wine_preferences pref ON pref.recipient_id=? AND pref.owner_id=p.owner_id AND pref.wine_id=p.wine_id
ORDER BY p.shared_at DESC,w.id`;

export async function socialRoute(request:Request,env:SocialEnv,member:Member):Promise<Response|null>{
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
 const derivative=path.match(/^\/api\/images\/([^/]+)\/sharing-copy$/);
 if(derivative&&request.method==='PUT'){
  const row=await env.DB.prepare('SELECT id FROM wine_images WHERE id=? AND owner_id=? AND wine_id IS NOT NULL').bind(derivative[1],member.id).first();if(!row)throw new ApiError(404,'Photo not found');
  if(Number(request.headers.get('Content-Length'))>2_000_000)throw new ApiError(413,'Sharing copy is too large');
  const raw=await boundedBytes(request.body,2_000_000);
  const bytes=stripJpegMetadata(raw),key=`shared/${member.id}/${derivative[1]}.jpg`;
  await sharingBucket(env,member.id).put(key,bytes,{httpMetadata:{contentType:'image/jpeg'},storageClass:'Standard'});
  await env.DB.prepare('INSERT INTO shared_photos(image_id,owner_id,object_key,byte_size) VALUES(?,?,?,?) ON CONFLICT(image_id) DO UPDATE SET byte_size=excluded.byte_size,created_at=?').bind(derivative[1],member.id,key,bytes.length,stamp()).run();return json({ok:true});
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
  if(shared[2]){
   const row=await env.DB.prepare('SELECT p.object_key FROM shared_photos p JOIN wine_images i ON i.id=p.image_id AND i.owner_id=p.owner_id WHERE i.wine_id=? AND i.id=? AND i.owner_id=?').bind(shared[1],shared[2],wine.owner_id).first<{object_key:string}>();if(!row)throw new ApiError(404,'Photo not found');
   const object=await env.WINE_IMAGES.get(row.object_key);if(!object)throw new ApiError(404,'Photo not found');return new Response(object.body,{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }
  // Keep active leases visible: a second viewer that arrives after the winner
  // has claimed the photo should wait briefly instead of returning an empty first
  // render. Failure backoffs remain visible too, but are not retried until due.
  const images=(await env.DB.prepare(`SELECT i.id,i.object_key,coalesce(a.attempts,0) AS attempts,
    a.error AS attempt_error,a.retry_after
   FROM wine_images i
   LEFT JOIN shared_photos p ON p.image_id=i.id AND p.owner_id=i.owner_id
   LEFT JOIN shared_photo_attempts a ON a.image_id=i.id AND a.owner_id=i.owner_id
   WHERE i.wine_id=? AND i.owner_id=? AND p.image_id IS NULL
   ORDER BY i.rowid`).bind(shared[1],wine.owner_id).all<{id:string;object_key:string;attempts:number;attempt_error:string|null;retry_after:string|null}>()).results;
  const now=stamp();
  const due=images.filter(image=>image.retry_after===null||image.retry_after<=now);
  const leased=images.filter(image=>image.retry_after!==null&&image.retry_after>now&&image.attempt_error===null)
   .slice(0,SHARING_MAX_PER_REQUEST).map(image=>image.id);
  const raced=await ensureSharingPhotos(env,String(wine.owner_id),due);
  const contended=[...new Set([...leased,...raced])].slice(0,SHARING_MAX_PER_REQUEST);
  if(contended.length)await waitForSharingPhotoContention(env,String(wine.owner_id),contended);
  const photos=(await env.DB.prepare('SELECT p.image_id FROM shared_photos p JOIN wine_images i ON i.id=p.image_id AND i.owner_id=p.owner_id WHERE i.wine_id=? AND i.owner_id=? ORDER BY i.rowid').bind(shared[1],wine.owner_id).all<{image_id:string}>()).results;
  return json({...sharedWine(wine),photos:photos.map(p=>({id:p.image_id,url:`/api/shared/wines/${shared[1]}/photos/${p.image_id}`}))});
 }
 return null;
}
