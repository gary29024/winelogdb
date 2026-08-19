import type { RecognitionPhotoMetadata } from '../src/lib/uploads/metadataSelection';

type Env={DB:D1Database;WINE_IMAGES:R2Bucket};
type ImageRow={id:string;original_object_key:string;recognition_object_key:string;content_type:string;byte_size:number;width:number;height:number};
type RecognitionSummary={locationName?:unknown};

const now=()=>new Date().toISOString();
const parseJson=<T>(value:unknown,fallback:T):T=>{try{return JSON.parse(String(value)) as T}catch{return fallback}};
const validLatitude=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=-90&&value<=90;
const validLongitude=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=-180&&value<=180;

export function permanentBatchPhotoMetadata(meta:RecognitionPhotoMetadata|undefined,locationName:string|null){
  const capturedAt=typeof meta?.capturedAt==='string'&&!Number.isNaN(Date.parse(meta.capturedAt))?new Date(meta.capturedAt).toISOString():null;
  const latitude=validLatitude(meta?.latitude)?meta.latitude:null;
  const longitude=validLongitude(meta?.longitude)?meta.longitude:null;
  const source=meta?.source==='exif'||meta?.source==='file_fallback'?meta.source:'none';
  return {capturedAt,latitude,longitude,locationName,metadataSource:source};
}

async function finishSessionIfTerminal(db:D1Database,owner:string,sessionId:string){
  const active=await db.prepare("SELECT count(*) AS count FROM batch_recognition_jobs WHERE owner_id=? AND session_id=? AND status IN ('queued','running')").bind(owner,sessionId).first<{count:number}>();if(Number(active?.count))return;
  const counts=await db.prepare(`SELECT sum(status='ready') AS ready,sum(status='failed') AS failed,sum(status='confirmed') AS confirmed,sum(status='rejected') AS rejected,count(*) AS total FROM batch_recognition_items WHERE owner_id=? AND session_id=?`).bind(owner,sessionId).first<Record<string,number>>();
  const ready=Number(counts?.ready)||0,failed=Number(counts?.failed)||0,total=Number(counts?.total)||0,confirmed=Number(counts?.confirmed)||0,rejected=Number(counts?.rejected)||0;
  const status=ready?(failed?'partial':'ready'):(confirmed+rejected>=total&&total?'complete':'failed');
  await db.prepare('UPDATE batch_recognition_sessions SET status=?,confirmed_items=?,updated_at=? WHERE id=? AND owner_id=?').bind(status,confirmed,now(),sessionId,owner).run();
}

export async function attachConfirmedItemWithMetadata(env:Env,owner:string,sessionId:string,itemId:string,wineId:string){
  const item=await env.DB.prepare("SELECT status,metadata_json,recognition_json FROM batch_recognition_items WHERE id=? AND owner_id=? AND session_id=?").bind(itemId,owner,sessionId).first<{status:string;metadata_json:string;recognition_json:string|null}>();
  if(!item||item.status!=='ready')throw new Error('This identification is no longer awaiting confirmation');
  const images=await env.DB.prepare('SELECT id,original_object_key,recognition_object_key,content_type,byte_size,width,height FROM batch_recognition_images WHERE owner_id=? AND item_id=? ORDER BY rowid ASC').bind(owner,itemId).all<ImageRow>();
  const metadata=parseJson<RecognitionPhotoMetadata[]>(item.metadata_json,[]),recognition=item.recognition_json?parseJson<RecognitionSummary>(item.recognition_json,{}):{};
  const locationName=typeof recognition.locationName==='string'&&recognition.locationName.trim()?recognition.locationName.trim():null,stamp=now(),statements:D1PreparedStatement[]=[];
  for(let index=0;index<images.results.length;index++){
    const image=images.results[index],photo=permanentBatchPhotoMetadata(metadata[index],locationName);
    statements.push(env.DB.prepare(`INSERT INTO wine_images(id,owner_id,wine_id,object_key,content_type,byte_size,width,height,upload_status,recognition_status,error,captured_at,latitude,longitude,location_name,metadata_source,created_at)
      VALUES(?,?,?,?,?,?,?,?, 'uploaded','complete',NULL,?,?,?,?,?,?)`).bind(crypto.randomUUID(),owner,wineId,image.original_object_key,image.content_type,image.byte_size,image.width,image.height,photo.capturedAt,photo.latitude,photo.longitude,photo.locationName,photo.metadataSource,stamp));
  }
  statements.push(env.DB.prepare("UPDATE batch_recognition_items SET status='confirmed',confirmed_wine_id=?,updated_at=? WHERE id=? AND owner_id=?").bind(wineId,stamp,itemId,owner));
  await env.DB.batch(statements);
  await Promise.all(images.results.map(image=>env.WINE_IMAGES.delete(image.recognition_object_key).catch(()=>undefined)));
  await env.DB.prepare('DELETE FROM batch_recognition_images WHERE owner_id=? AND item_id=?').bind(owner,itemId).run();
  await finishSessionIfTerminal(env.DB,owner,sessionId);
}
