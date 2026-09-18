import { friendRequestRoute } from './friendRequests';
import { ApiError,body,boundedBytes,json,stamp,type IdentityEnv,type Member } from './common';
import { similarFriendProducers } from '../../src/lib/research/similarProducers';
import { rememberProducerAlias } from '../../src/lib/research/aliasBridge';
import type { SharedWine } from '../../src/lib/wine/shared';

// Explicit allowlist: never serialize the private WineRecord into a shared response.
export function sharedWine(row:Record<string,unknown>):SharedWine{
 const text=(value:unknown)=>typeof value==='string'?value:'';
 const number=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?value:null;
 let grapes:string[]=[];try{const data:unknown=JSON.parse(String(row.grapes_json||'[]'));if(Array.isArray(data))grapes=data.filter((value):value is string=>typeof value==='string')}catch{/* Invalid legacy grapes must not expose another field. */}
 return {id:text(row.id),ownerName:text(row.display_name),producer:text(row.producer),wineName:text(row.wine_name),vintage:number(row.vintage),country:text(row.country)||null,region:text(row.region)||null,appellation:text(row.appellation)||null,wineStyle:text(row.wine_style)||null,grapes,tastingNotes:text(row.tasting_notes),rating:number(row.rating),tastingDate:text(row.tasting_date)||null,updatedAt:text(row.updated_at)};
}
export async function canReadShared(db:D1Database,viewer:string,wineId:string){
 return db.prepare(`SELECT w.*,u.display_name FROM wines w
 JOIN friendships f ON f.user_id=? AND f.friend_id=w.owner_id
 JOIN app_users u ON u.id=w.owner_id AND u.status='active'
 WHERE w.id=? AND (
   EXISTS(SELECT 1 FROM wine_shares s WHERE s.wine_id=w.id AND s.owner_id=w.owner_id AND s.recipient_id=?)
   OR EXISTS(
     SELECT 1 FROM tasting_shares ts
     JOIN wine_experiences we ON we.owner_id=ts.owner_id AND we.tasting_id=ts.tasting_id AND we.wine_id=w.id
     WHERE ts.owner_id=w.owner_id AND ts.recipient_id=?
   )
 )`).bind(viewer,wineId,viewer,viewer).first<Record<string,unknown>>();
}

async function acceptedFriendIds(db:D1Database,owner:string,ids:string[]){
 if(ids.length>24)throw new ApiError(400,'Choose up to 24 friends');
 const unique=[...new Set(ids)];
 if(!unique.length)return unique;
 const friends=(await db.prepare('SELECT friend_id FROM friendships WHERE user_id=?').bind(owner).all<{friend_id:string}>()).results;
 if(unique.some(id=>!friends.some(friend=>friend.friend_id===id)))throw new ApiError(400,'Only accepted friends can receive this wine');
 return unique;
}
/** Accept only baseline JPEG derivatives and remove all application/comment metadata. */
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
  if(marker===0xc2)throw new ApiError(400,'Use a baseline JPEG sharing copy');
  const length=(bytes[p+2]<<8)|bytes[p+3];if(length<2||p+2+length>bytes.length)throw new ApiError(400,'Invalid JPEG segment');
  if(!(marker>=0xe0&&marker<=0xef)&&marker!==0xfe)parts.push(bytes.slice(p,p+2+length));p+=2+length;
 }
 if(!scan||!ended)throw new ApiError(400,'Invalid JPEG scan');
 const result=new Uint8Array(parts.reduce((sum,x)=>sum+x.length,0));let pos=0;for(const part of parts){result.set(part,pos);pos+=part.length}return result;
}
export async function socialRoute(request:Request,env:IdentityEnv&{WINE_IMAGES:R2Bucket},member:Member):Promise<Response|null>{
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
  if(data.enabled===true)await env.DB.prepare('INSERT OR IGNORE INTO member_share_defaults(owner_id,recipient_id) VALUES(?,?)').bind(member.id,friendId).run();
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
   env.DB.prepare('DELETE FROM tasting_shares WHERE (owner_id=? AND recipient_id=?) OR (owner_id=? AND recipient_id=?)').bind(member.id,friend[1],friend[1],member.id)
  ]);return json({ok:true});
 }
 const bulkShares=path==='/api/wines/shares'&&request.method==='PUT';
 if(bulkShares){
  const data=await body(request);
  if(!Array.isArray(data.wineIds)||!data.wineIds.length||data.wineIds.length>100||data.wineIds.some(id=>typeof id!=='string'))throw new ApiError(400,'Choose between 1 and 100 wines');
  if(!Array.isArray(data.recipientIds)||data.recipientIds.some(id=>typeof id!=='string'))throw new ApiError(400,'Choose valid friends');
  const wineIds=[...new Set(data.wineIds as string[])],ids=await acceptedFriendIds(env.DB,member.id,data.recipientIds as string[]);
  const owned=await env.DB.prepare('SELECT count(*) AS count FROM wines WHERE owner_id=? AND id IN (SELECT value FROM json_each(?))').bind(member.id,JSON.stringify(wineIds)).first<{count:number}>();
  if(Number(owned?.count)!==wineIds.length)throw new ApiError(404,'One or more wines were not found');
  if(data.mode!=='add'&&data.mode!=='set')throw new ApiError(400,'Unknown tagging mode');
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
   await env.DB.batch([env.DB.prepare('DELETE FROM tasting_shares WHERE tasting_id=? AND owner_id=?').bind(tastingShares[1],member.id),...ids.map(id=>env.DB.prepare('INSERT INTO tasting_shares(tasting_id,owner_id,recipient_id) VALUES(?,?,?)').bind(tastingShares[1],member.id,id))]);
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
   await env.DB.batch([env.DB.prepare('DELETE FROM wine_shares WHERE wine_id=? AND owner_id=?').bind(shares[1],member.id),...ids.map(id=>env.DB.prepare('INSERT INTO wine_shares(wine_id,owner_id,recipient_id) VALUES(?,?,?)').bind(shares[1],member.id,id))]);return json({ok:true});
  }
 }
 const derivative=path.match(/^\/api\/images\/([^/]+)\/sharing-copy$/);
 if(derivative&&request.method==='PUT'){
  const row=await env.DB.prepare('SELECT id FROM wine_images WHERE id=? AND owner_id=? AND wine_id IS NOT NULL').bind(derivative[1],member.id).first();if(!row)throw new ApiError(404,'Photo not found');
  if(Number(request.headers.get('Content-Length'))>2_000_000)throw new ApiError(413,'Sharing copy is too large');
  const raw=await boundedBytes(request.body,2_000_000);
  const bytes=stripJpegMetadata(raw),key=`shared/${member.id}/${derivative[1]}.jpg`;
  await env.WINE_IMAGES.put(key,bytes,{httpMetadata:{contentType:'image/jpeg'}});
  await env.DB.prepare('INSERT INTO shared_photos(image_id,owner_id,object_key,byte_size) VALUES(?,?,?,?) ON CONFLICT(image_id) DO UPDATE SET byte_size=excluded.byte_size,created_at=?').bind(derivative[1],member.id,key,bytes.length,stamp()).run();return json({ok:true});
 }
 if(path==='/api/shared/wines'&&request.method==='GET'){
  const offset=Math.max(0,Math.min(100000,Number(url.searchParams.get('offset'))||0));
  const rows=await env.DB.prepare(`SELECT w.*,u.display_name,
   max(
     coalesce((SELECT max(s.created_at) FROM wine_shares s WHERE s.wine_id=w.id AND s.owner_id=w.owner_id AND s.recipient_id=?),''),
     coalesce((SELECT max(ts.created_at) FROM tasting_shares ts JOIN wine_experiences we ON we.owner_id=ts.owner_id AND we.tasting_id=ts.tasting_id AND we.wine_id=w.id WHERE ts.owner_id=w.owner_id AND ts.recipient_id=?),'')
   ) AS shared_at
  FROM wines w
  JOIN friendships f ON f.user_id=? AND f.friend_id=w.owner_id
  JOIN app_users u ON u.id=w.owner_id AND u.status='active'
  WHERE EXISTS(SELECT 1 FROM wine_shares s WHERE s.wine_id=w.id AND s.owner_id=w.owner_id AND s.recipient_id=?)
     OR EXISTS(SELECT 1 FROM tasting_shares ts JOIN wine_experiences we ON we.owner_id=ts.owner_id AND we.tasting_id=ts.tasting_id AND we.wine_id=w.id
       WHERE ts.owner_id=w.owner_id AND ts.recipient_id=?)
  ORDER BY shared_at DESC,w.id LIMIT 25 OFFSET ?`).bind(member.id,member.id,member.id,member.id,member.id,offset).all<Record<string,unknown>>();return json({items:rows.results.map(sharedWine),nextOffset:rows.results.length===25?offset+25:null});
 }
 const shared=path.match(/^\/api\/shared\/wines\/([^/]+)(?:\/photos\/([^/]+))?$/);
 if(shared&&request.method==='GET'){
  const wine=await canReadShared(env.DB,member.id,shared[1]);if(!wine)throw new ApiError(404,'Shared wine not found');
  if(shared[2]){
   const row=await env.DB.prepare('SELECT p.object_key FROM shared_photos p JOIN wine_images i ON i.id=p.image_id AND i.owner_id=p.owner_id WHERE i.wine_id=? AND i.id=? AND i.owner_id=?').bind(shared[1],shared[2],wine.owner_id).first<{object_key:string}>();if(!row)throw new ApiError(404,'Photo not found');
   const object=await env.WINE_IMAGES.get(row.object_key);if(!object)throw new ApiError(404,'Photo not found');return new Response(object.body,{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }
  const photos=(await env.DB.prepare('SELECT p.image_id FROM shared_photos p JOIN wine_images i ON i.id=p.image_id AND i.owner_id=p.owner_id WHERE i.wine_id=? AND i.owner_id=?').bind(shared[1],wine.owner_id).all<{image_id:string}>()).results;
  return json({...sharedWine(wine),photos:photos.map(p=>({id:p.image_id,url:`/api/shared/wines/${shared[1]}/photos/${p.image_id}`}))});
 }
 return null;
}
