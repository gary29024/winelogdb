import { requireSession } from '../src/lib/auth/session';
import { groupRecognitionWineSchema,type GroupRecognitionWine } from '../src/features/recognition/groupSchema';

type Env={DB:D1Database;WINE_IMAGES:R2Bucket;AUTH_SECRET:string;MAX_FILE_BYTES?:string};
type PhotoMetadata={capturedAt?:string|null;latitude?:number|null;longitude?:number|null;source?:string|null};
type IncomingItem={key?:unknown;recognition?:unknown;savedId?:unknown;removed?:unknown;manual?:unknown;cropWidth?:unknown;cropHeight?:unknown};
type IncomingSession={createdAt?:unknown;updatedAt?:unknown;metadata?:unknown;width?:unknown;height?:unknown;unresolvedCount?:unknown;items?:unknown};
type SessionRow={id:string;owner_id:string;status:string;original_object_key:string;preview_object_key:string;original_content_type:string;metadata_json:string;width:number;height:number;unresolved_count:number;retained:number;created_at:string;updated_at:string;expires_at:string|null};
type ItemRow={id:string;client_key:string;position:number;recognition_json:string|null;crop_object_key:string|null;crop_content_type:string|null;crop_width:number|null;crop_height:number|null;saved_wine_id:string|null;removed:number;manual:number};

const SESSION_TTL_MS=7*24*60*60*1000;
const MAX_ITEMS=20;
const MAX_CROP_BYTES=4*1024*1024;
const now=()=>new Date().toISOString();
const parseJson=<T>(raw:unknown,fallback:T):T=>{try{return JSON.parse(String(raw)) as T}catch{return fallback}};
const safeOwner=(owner:string)=>owner.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,128);
function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})}
async function owner(request:Request,env:Env){return (await requireSession(request.headers.get('Authorization')??undefined,env.AUTH_SECRET)).userId}
function asMetadata(value:unknown):PhotoMetadata{
  if(!value||typeof value!=='object')return {};
  const row=value as Record<string,unknown>;
  const capturedAt=typeof row.capturedAt==='string'&&!Number.isNaN(Date.parse(row.capturedAt))?row.capturedAt:null;
  const latitude=typeof row.latitude==='number'&&row.latitude>=-90&&row.latitude<=90?row.latitude:null;
  const longitude=typeof row.longitude==='number'&&row.longitude>=-180&&row.longitude<=180?row.longitude:null;
  return {capturedAt,latitude,longitude,source:typeof row.source==='string'?row.source:null};
}
function normalizeIncoming(value:unknown){
  const raw=(value&&typeof value==='object'?value:{}) as IncomingSession,items=Array.isArray(raw.items)?raw.items.slice(0,MAX_ITEMS):[];
  return {
    createdAt:typeof raw.createdAt==='string'&&!Number.isNaN(Date.parse(raw.createdAt))?raw.createdAt:now(),
    updatedAt:typeof raw.updatedAt==='string'&&!Number.isNaN(Date.parse(raw.updatedAt))?raw.updatedAt:now(),
    metadata:asMetadata(raw.metadata),width:Math.max(1,Math.round(Number(raw.width)||1)),height:Math.max(1,Math.round(Number(raw.height)||1)),
    unresolvedCount:Math.max(0,Math.min(30,Math.round(Number(raw.unresolvedCount)||0))),
    items:items.map((entry,index)=>{
      const item=(entry&&typeof entry==='object'?entry:{}) as IncomingItem,key=typeof item.key==='string'&&item.key.trim()?item.key.trim():crypto.randomUUID();
      const recognition=item.recognition==null?null:groupRecognitionWineSchema.parse(item.recognition);
      return {key,position:index,recognition,removed:item.removed===true,manual:item.manual===true,cropWidth:Math.max(1,Math.round(Number(item.cropWidth)||1)),cropHeight:Math.max(1,Math.round(Number(item.cropHeight)||1))};
    })
  };
}

async function deleteSessionObjects(env:Pick<Env,'DB'|'WINE_IMAGES'>,ownerId:string,sessionId:string){
  const session=await env.DB.prepare('SELECT original_object_key,preview_object_key FROM group_recognition_sessions WHERE owner_id=? AND id=?').bind(ownerId,sessionId).first<{original_object_key:string;preview_object_key:string}>();
  if(!session)return;
  const crops=await env.DB.prepare('SELECT crop_object_key FROM group_recognition_items WHERE owner_id=? AND session_id=? AND crop_object_key IS NOT NULL').bind(ownerId,sessionId).all<{crop_object_key:string}>();
  const keys=[session.original_object_key,session.preview_object_key,...crops.results.map(x=>x.crop_object_key)].filter(Boolean);
  await Promise.all(keys.map(key=>env.WINE_IMAGES.delete(key).catch(()=>undefined)));
}
async function cleanupExpired(env:Pick<Env,'DB'|'WINE_IMAGES'>,ownerId:string){
  const stamp=now(),rows=await env.DB.prepare('SELECT id FROM group_recognition_sessions WHERE owner_id=? AND retained=0 AND expires_at IS NOT NULL AND expires_at<=? LIMIT 24').bind(ownerId,stamp).all<{id:string}>();
  for(const row of rows.results){await deleteSessionObjects(env,ownerId,row.id);await env.DB.prepare('DELETE FROM group_recognition_items WHERE owner_id=? AND session_id=?').bind(ownerId,row.id).run();await env.DB.prepare('DELETE FROM group_recognition_sessions WHERE owner_id=? AND id=?').bind(ownerId,row.id).run()}
}
function mapItem(row:ItemRow){return {key:row.client_key,recognition:row.recognition_json?parseJson<GroupRecognitionWine|null>(row.recognition_json,null):null,savedId:row.saved_wine_id??null,removed:Boolean(row.removed),manual:Boolean(row.manual),hasCrop:Boolean(row.crop_object_key),cropWidth:Number(row.crop_width)||1,cropHeight:Number(row.crop_height)||1,position:Number(row.position)||0}}
async function loadItems(db:D1Database,ownerId:string,sessionId:string){return (await db.prepare('SELECT id,client_key,position,recognition_json,crop_object_key,crop_content_type,crop_width,crop_height,saved_wine_id,removed,manual FROM group_recognition_items WHERE owner_id=? AND session_id=? ORDER BY position,id').bind(ownerId,sessionId).all<ItemRow>()).results}
async function sessionDetail(db:D1Database,ownerId:string,sessionId:string){
  const row=await db.prepare('SELECT * FROM group_recognition_sessions WHERE owner_id=? AND id=?').bind(ownerId,sessionId).first<SessionRow>();if(!row)return null;
  const items=await loadItems(db,ownerId,sessionId);
  return {id:row.id,status:row.status,createdAt:row.created_at,updatedAt:row.updated_at,expiresAt:row.expires_at,retained:Boolean(row.retained),metadata:parseJson<PhotoMetadata>(row.metadata_json,{}),width:Number(row.width)||1,height:Number(row.height)||1,unresolvedCount:Number(row.unresolved_count)||0,items:items.map(mapItem)};
}
async function listSessions(db:D1Database,ownerId:string){
  const rows=await db.prepare(`SELECT s.*,
    (SELECT count(*) FROM group_recognition_items i WHERE i.owner_id=s.owner_id AND i.session_id=s.id AND i.removed=0) AS total_items,
    (SELECT count(*) FROM group_recognition_items i WHERE i.owner_id=s.owner_id AND i.session_id=s.id AND i.removed=0 AND i.saved_wine_id IS NOT NULL) AS saved_items,
    (SELECT recognition_json FROM group_recognition_items i WHERE i.owner_id=s.owner_id AND i.session_id=s.id AND i.removed=0 AND i.recognition_json IS NOT NULL ORDER BY i.position LIMIT 1) AS first_recognition
    FROM group_recognition_sessions s WHERE s.owner_id=? ORDER BY s.updated_at DESC LIMIT 12`).bind(ownerId).all<Record<string,unknown>>();
  return {items:rows.results.map(row=>{const total=Number(row.total_items)||0,saved=Number(row.saved_items)||0,first=parseJson<{wineName?:string}|null>(row.first_recognition,null);return {id:String(row.id),createdAt:String(row.created_at),updatedAt:String(row.updated_at),expiresAt:row.expires_at?String(row.expires_at):null,retained:Boolean(row.retained),totalItems:total,savedItems:saved,pendingItems:Math.max(0,total-saved),firstWineName:first?.wineName??null}})};
}
async function putImage(bucket:R2Bucket,key:string,file:File,kind:string,sessionId:string){await bucket.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:file.type||'application/octet-stream'},customMetadata:{kind,sessionId}})}

async function createOrReplaceSession(request:Request,env:Env,ownerId:string,sessionId:string){
  const form=await request.formData().catch(()=>null);if(!form)return json({error:'Could not read Group Photo session'},400);
  const original=form.get('original'),preview=form.get('recognitionImage');if(!(original instanceof File)||!(preview instanceof File))return json({error:'Group Photo session needs original and recognition images'},400);
  const maxOriginal=Number(env.MAX_FILE_BYTES)||10*1024*1024;if(original.size>maxOriginal)return json({error:`Group photo must be ${Math.round(maxOriginal/1048576)} MB or smaller`},413);
  if(!original.type.startsWith('image/')||preview.type!=='image/jpeg'||preview.size>3*1024*1024)return json({error:'Group Photo recognition copy must be a JPEG no larger than 3 MB'},400);
  let data:ReturnType<typeof normalizeIncoming>;try{data=normalizeIncoming(parseJson(form.get('session'),{}))}catch(e){return json({error:(e as Error).message||'Invalid Group Photo session data'},400)}
  const cropKeys=parseJson<Array<{key?:unknown;width?:unknown;height?:unknown}>>(form.get('cropKeys'),[]),crops=form.getAll('crops').filter((x):x is File=>x instanceof File);
  if(crops.length!==cropKeys.length||crops.some(file=>file.type!=='image/jpeg'||file.size>MAX_CROP_BYTES))return json({error:'Group Photo crops are incomplete or too large'},400);
  const existing=await env.DB.prepare('SELECT id FROM group_recognition_sessions WHERE owner_id=? AND id=?').bind(ownerId,sessionId).first<{id:string}>();
  if(existing){await updateSessionState(env.DB,ownerId,sessionId,data);return json(await sessionDetail(env.DB,ownerId,sessionId))}
  const prefix=`owners/${safeOwner(ownerId)}/group-recognition/${sessionId}`,originalKey=`${prefix}/source-original`,previewKey=`${prefix}/source-preview.jpg`,stored:string[]=[];
  try{
    await putImage(env.WINE_IMAGES,originalKey,original,'group-recognition-source',sessionId);stored.push(originalKey);
    await putImage(env.WINE_IMAGES,previewKey,preview,'group-recognition-preview',sessionId);stored.push(previewKey);
    const expiry=new Date(Date.now()+SESSION_TTL_MS).toISOString();
    await env.DB.prepare(`INSERT INTO group_recognition_sessions(id,owner_id,status,original_object_key,preview_object_key,original_content_type,metadata_json,width,height,unresolved_count,retained,created_at,updated_at,expires_at)
      VALUES(?,?,'ready',?,?,?,?,?,?,?,0,?,?,?)`).bind(sessionId,ownerId,originalKey,previewKey,original.type||'application/octet-stream',JSON.stringify(data.metadata),data.width,data.height,data.unresolvedCount,data.createdAt,data.updatedAt,expiry).run();
    const cropByKey=new Map<string,{file:File;width:number;height:number}>();
    cropKeys.forEach((entry,index)=>{const key=typeof entry.key==='string'?entry.key:'';if(key)cropByKey.set(key,{file:crops[index],width:Math.max(1,Math.round(Number(entry.width)||1)),height:Math.max(1,Math.round(Number(entry.height)||1))})});
    for(const item of data.items){
      const crop=cropByKey.get(item.key),itemId=crypto.randomUUID(),cropKey=crop?`${prefix}/items/${itemId}.jpg`:null;
      if(crop&&cropKey){await putImage(env.WINE_IMAGES,cropKey,crop.file,'group-recognition-crop',sessionId);stored.push(cropKey)}
      await env.DB.prepare(`INSERT INTO group_recognition_items(id,owner_id,session_id,client_key,position,recognition_json,crop_object_key,crop_content_type,crop_width,crop_height,saved_wine_id,removed,manual,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(itemId,ownerId,sessionId,item.key,item.position,item.recognition?JSON.stringify(item.recognition):null,cropKey,crop?'image/jpeg':null,crop?.width??null,crop?.height??null,null,item.removed?1:0,item.manual?1:0,data.createdAt,data.updatedAt).run();
    }
    return json(await sessionDetail(env.DB,ownerId,sessionId),201);
  }catch(e){await Promise.all(stored.map(key=>env.WINE_IMAGES.delete(key).catch(()=>undefined)));await env.DB.prepare('DELETE FROM group_recognition_items WHERE owner_id=? AND session_id=?').bind(ownerId,sessionId).run().catch(()=>undefined);await env.DB.prepare('DELETE FROM group_recognition_sessions WHERE owner_id=? AND id=?').bind(ownerId,sessionId).run().catch(()=>undefined);return json({error:(e as Error).message||'Could not save Group Photo session'},500)}
}
async function updateSessionState(db:D1Database,ownerId:string,sessionId:string,data:ReturnType<typeof normalizeIncoming>){
  const exists=await db.prepare('SELECT id FROM group_recognition_sessions WHERE owner_id=? AND id=?').bind(ownerId,sessionId).first<{id:string}>();if(!exists)throw new Error('Group Photo session not found');
  await db.prepare('UPDATE group_recognition_sessions SET metadata_json=?,width=?,height=?,unresolved_count=?,updated_at=? WHERE owner_id=? AND id=?').bind(JSON.stringify(data.metadata),data.width,data.height,data.unresolvedCount,data.updatedAt,ownerId,sessionId).run();
  for(const item of data.items){
    const existing=await db.prepare('SELECT id FROM group_recognition_items WHERE owner_id=? AND session_id=? AND client_key=?').bind(ownerId,sessionId,item.key).first<{id:string}>();
    if(existing){await db.prepare('UPDATE group_recognition_items SET position=?,recognition_json=coalesce(?,recognition_json),removed=?,manual=?,updated_at=? WHERE owner_id=? AND id=?').bind(item.position,item.recognition?JSON.stringify(item.recognition):null,item.removed?1:0,item.manual?1:0,data.updatedAt,ownerId,existing.id).run()}
    else await db.prepare(`INSERT INTO group_recognition_items(id,owner_id,session_id,client_key,position,recognition_json,removed,manual,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),ownerId,sessionId,item.key,item.position,item.recognition?JSON.stringify(item.recognition):null,item.removed?1:0,item.manual?1:0,data.updatedAt,data.updatedAt).run();
  }
}
async function updateJsonSession(request:Request,env:Env,ownerId:string,sessionId:string){
  let data:ReturnType<typeof normalizeIncoming>;try{data=normalizeIncoming(await request.json())}catch(e){return json({error:(e as Error).message||'Invalid Group Photo session state'},400)}
  try{await updateSessionState(env.DB,ownerId,sessionId,data);return json(await sessionDetail(env.DB,ownerId,sessionId))}catch(e){return json({error:(e as Error).message||'Could not update Group Photo session'},404)}
}
async function imageResponse(env:Env,ownerId:string,sessionId:string,kind:'preview'|'original',clientKey?:string){
  let key:string|null=null,contentType='image/jpeg';
  if(clientKey){const row=await env.DB.prepare('SELECT crop_object_key,crop_content_type FROM group_recognition_items WHERE owner_id=? AND session_id=? AND client_key=?').bind(ownerId,sessionId,clientKey).first<{crop_object_key:string|null;crop_content_type:string|null}>();key=row?.crop_object_key??null;contentType=row?.crop_content_type||'image/jpeg'}
  else{const row=await env.DB.prepare('SELECT original_object_key,preview_object_key,original_content_type FROM group_recognition_sessions WHERE owner_id=? AND id=?').bind(ownerId,sessionId).first<{original_object_key:string;preview_object_key:string;original_content_type:string}>();if(row){key=kind==='original'?row.original_object_key:row.preview_object_key;contentType=kind==='original'?row.original_content_type:'image/jpeg'}}
  if(!key)return null;const object=await env.WINE_IMAGES.get(key);if(!object)return null;return new Response(object.body,{headers:{'Content-Type':contentType,'Cache-Control':'private, max-age=3600'}})
}
async function linkWine(request:Request,env:Env,ownerId:string,sessionId:string,clientKey:string){
  const body=await request.json().catch(()=>({})) as {wineId?:unknown},wineId=typeof body.wineId==='string'?body.wineId.trim():'';if(!wineId)return json({error:'Wine ID is required'},400);
  const [wine,session]=await Promise.all([env.DB.prepare('SELECT id FROM wines WHERE owner_id=? AND id=?').bind(ownerId,wineId).first<{id:string}>(),env.DB.prepare('SELECT id FROM group_recognition_sessions WHERE owner_id=? AND id=?').bind(ownerId,sessionId).first<{id:string}>()]);
  if(!wine)return json({error:'Wine not found'},404);if(!session)return json({error:'Group Photo session not found'},404);
  let item=await env.DB.prepare('SELECT id FROM group_recognition_items WHERE owner_id=? AND session_id=? AND client_key=?').bind(ownerId,sessionId,clientKey).first<{id:string}>();
  const stamp=now();
  if(!item){const id=crypto.randomUUID();await env.DB.prepare(`INSERT INTO group_recognition_items(id,owner_id,session_id,client_key,position,recognition_json,saved_wine_id,removed,manual,created_at,updated_at) VALUES(?,?,?,?,999,NULL,?,0,1,?,?)`).bind(id,ownerId,sessionId,clientKey,wineId,stamp,stamp).run();item={id}}
  await env.DB.batch([env.DB.prepare('UPDATE group_recognition_items SET saved_wine_id=?,updated_at=? WHERE owner_id=? AND id=?').bind(wineId,stamp,ownerId,item.id),env.DB.prepare("UPDATE group_recognition_sessions SET retained=1,status='retained',expires_at=NULL,updated_at=? WHERE owner_id=? AND id=?").bind(stamp,ownerId,sessionId)]);return json({ok:true,wineId,sessionId,clientKey})
}
async function removeSession(env:Env,ownerId:string,sessionId:string){
  const linked=await env.DB.prepare('SELECT count(*) AS count FROM group_recognition_items WHERE owner_id=? AND session_id=? AND saved_wine_id IS NOT NULL').bind(ownerId,sessionId).first<{count:number}>();if(Number(linked?.count)>0)return json({error:'This Group Photo is linked to saved wines and is retained as source context.'},409);
  const exists=await env.DB.prepare('SELECT id FROM group_recognition_sessions WHERE owner_id=? AND id=?').bind(ownerId,sessionId).first<{id:string}>();if(!exists)return json({error:'Group Photo session not found'},404);
  await deleteSessionObjects(env,ownerId,sessionId);await env.DB.prepare('DELETE FROM group_recognition_items WHERE owner_id=? AND session_id=?').bind(ownerId,sessionId).run();await env.DB.prepare('DELETE FROM group_recognition_sessions WHERE owner_id=? AND id=?').bind(ownerId,sessionId).run();return json({ok:true})
}

export async function groupSourcePhotosForWine(db:D1Database,ownerId:string,wineId:string){
  const rows=await db.prepare(`SELECT DISTINCT s.id,s.created_at FROM group_recognition_sessions s JOIN group_recognition_items i ON i.owner_id=s.owner_id AND i.session_id=s.id WHERE s.owner_id=? AND i.saved_wine_id=? AND i.removed=0 ORDER BY s.created_at DESC`).bind(ownerId,wineId).all<{id:string;created_at:string}>();
  return rows.results.map(row=>({sessionId:row.id,createdAt:row.created_at}));
}

export async function handleGroupRecognitionSessionRequest(request:Request,env:Env){
  const url=new URL(request.url);if(!url.pathname.startsWith('/api/group-recognition/sessions'))return null;
  let ownerId:string;try{ownerId=await owner(request,env)}catch{return json({error:'Unauthorized'},401)}
  await cleanupExpired(env,ownerId).catch(()=>undefined);
  const parts=url.pathname.split('/').filter(Boolean),sessionId=parts[3]??'',tail=parts.slice(4);
  if(request.method==='GET'&&!sessionId)return json(await listSessions(env.DB,ownerId));
  if(request.method==='PUT'&&sessionId){const type=request.headers.get('Content-Type')||'';return type.includes('multipart/form-data')?createOrReplaceSession(request,env,ownerId,sessionId):updateJsonSession(request,env,ownerId,sessionId)}
  if(request.method==='GET'&&sessionId&&!tail.length){const detail=await sessionDetail(env.DB,ownerId,sessionId);return detail?json(detail):json({error:'Group Photo session not found'},404)}
  if(request.method==='DELETE'&&sessionId&&!tail.length)return removeSession(env,ownerId,sessionId);
  if(request.method==='GET'&&sessionId&&tail[0]==='image'&&(tail[1]==='preview'||tail[1]==='original')){const image=await imageResponse(env,ownerId,sessionId,tail[1]);return image??json({error:'Group Photo image not found'},404)}
  if(request.method==='GET'&&sessionId&&tail[0]==='items'&&tail[1]&&tail[2]==='crop'){const image=await imageResponse(env,ownerId,sessionId,'preview',decodeURIComponent(tail[1]));return image??json({error:'Group Photo crop not found'},404)}
  if(request.method==='POST'&&sessionId&&tail[0]==='items'&&tail[1]&&tail[2]==='link')return linkWine(request,env,ownerId,sessionId,decodeURIComponent(tail[1]));
  return json({error:'Group Photo route not found'},404)
}
