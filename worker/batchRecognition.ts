import { parseRecognition } from '../src/features/recognition/schema';
import { buildRecognitionPrompt,recognitionResponseSchema,RECOGNITION_MODEL } from '../src/lib/recognition/geminiRequest';
import type { RecognitionPhotoMetadata } from '../src/lib/uploads/metadataSelection';

export type BatchRecognitionJob=
  |{kind:'recognition_batch_submit';owner:string;sessionId:string}
  |{kind:'recognition_batch_poll';owner:string;sessionId:string;jobId:string;pollCount:number}
  |{kind:'recognition_batch_cleanup';owner:string;sessionId:string};

type Env={DB:D1Database;WINE_IMAGES:R2Bucket;GEMINI_API_KEY:string;MAX_FILE_BYTES?:string;RESEARCH_QUEUE:Queue<unknown>};
type ItemRow={id:string;position:number;status:string;metadata_json:string;recognition_json:string|null;error:string|null;confirmed_wine_id:string|null};
type ImageRow={id:string;item_id:string;original_object_key:string;recognition_object_key:string;content_type:string;byte_size:number;recognition_byte_size:number;width:number;height:number};
type GoogleInlineResponse={metadata?:{key?:string};response?:{candidates?:Array<{content?:{parts?:Array<{text?:string}>};finishReason?:string}>};error?:{message?:string}};

const INLINE_PREPARED_TARGET=12*1024*1024;
const INLINE_JSON_HARD_LIMIT=19_000_000;
const MAX_ITEM_PREPARED_BYTES=10*1024*1024;
const SESSION_TTL_MS=7*24*60*60*1000;
const now=()=>new Date().toISOString();
const parseJson=<T>(raw:unknown,fallback:T):T=>{try{return JSON.parse(String(raw)) as T}catch{return fallback}};
const safeOwner=(owner:string)=>owner.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,128);

export function chunkItemsByPreparedBytes<T extends {preparedBytes:number}>(items:T[],limit=INLINE_PREPARED_TARGET){
  const chunks:T[][]=[];let current:T[]=[],bytes=0;
  for(const item of items){
    if(current.length&&bytes+item.preparedBytes>limit){chunks.push(current);current=[];bytes=0}
    current.push(item);bytes+=item.preparedBytes;
  }
  if(current.length)chunks.push(current);
  return chunks;
}

export function isBatchUploadComplete(totalItems:number,expectedItems:number){return expectedItems<=0?totalItems>=2:totalItems===expectedItems&&expectedItems>=2}

export async function createBatchSession(db:D1Database,owner:string,expectedItems=0){
  const expected=Math.max(0,Math.floor(Number(expectedItems)||0)),id=crypto.randomUUID(),stamp=now(),expiresAt=new Date(Date.now()+SESSION_TTL_MS).toISOString();
  await db.prepare(`INSERT INTO batch_recognition_sessions(id,owner_id,status,total_items,expected_items,confirmed_items,created_at,updated_at,expires_at) VALUES(?,?,'uploading',0,?,0,?,?,?)`).bind(id,owner,expected,stamp,stamp,expiresAt).run();
  return {id,status:'uploading',expectedItems:expected,createdAt:stamp,expiresAt};
}

async function existingStagedItem(db:D1Database,owner:string,sessionId:string,position:number){
  return db.prepare(`SELECT i.id,count(bri.id) AS photo_count,coalesce(sum(bri.recognition_byte_size),0) AS prepared_bytes
    FROM batch_recognition_items i LEFT JOIN batch_recognition_images bri ON bri.owner_id=i.owner_id AND bri.item_id=i.id
    WHERE i.owner_id=? AND i.session_id=? AND i.position=? GROUP BY i.id LIMIT 1`).bind(owner,sessionId,position).first<{id:string;photo_count:number;prepared_bytes:number}>();
}

export async function stageBatchItem(env:Pick<Env,'DB'|'WINE_IMAGES'|'MAX_FILE_BYTES'>,owner:string,sessionId:string,form:FormData){
  const session=await env.DB.prepare("SELECT status,expected_items FROM batch_recognition_sessions WHERE id=? AND owner_id=?").bind(sessionId,owner).first<{status:string;expected_items:number}>();
  if(!session)return {status:404 as const,body:{error:'Batch session not found'}};
  if(session.status!=='uploading')return {status:409 as const,body:{error:'This batch has already been submitted'}};
  const originals=form.getAll('originals').filter((x):x is File=>x instanceof File),prepared=form.getAll('recognitionImages').filter((x):x is File=>x instanceof File);
  if(!originals.length||originals.length!==prepared.length||originals.length>12)return {status:400 as const,body:{error:'Each wine needs 1–12 matching original and recognition images'}};
  const maxOriginalBytes=Number(env.MAX_FILE_BYTES)||10*1024*1024;
  if(originals.some(file=>file.size>maxOriginalBytes))return {status:413 as const,body:{error:`Each original photo must be ${Math.round(maxOriginalBytes/1024/1024)} MB or smaller`}};
  const position=Math.max(0,Number(form.get('position'))||0),metadata=String(form.get('metadata')||'[]'),dimensions=parseJson<Array<{width?:number;height?:number}>>(form.get('dimensions'),[]),expected=Math.max(0,Number(session.expected_items)||0);
  if(expected&&position>=expected)return {status:400 as const,body:{error:'This wine position is outside the expected batch size'}};
  const existing=await existingStagedItem(env.DB,owner,sessionId,position);if(existing)return {status:200 as const,body:{id:existing.id,position,photoCount:Number(existing.photo_count)||0,preparedBytes:Number(existing.prepared_bytes)||0,resumed:true}};
  const preparedBytes=prepared.reduce((sum,file)=>sum+file.size,0);
  if(preparedBytes>MAX_ITEM_PREPARED_BYTES)return {status:413 as const,body:{error:'This wine has too many prepared label bytes for inline Batch API recognition. Use fewer label photos.'}};
  const itemId=crypto.randomUUID(),stamp=now(),stored:Array<{originalKey:string;recognitionKey:string}>=[];
  try{
    await env.DB.prepare(`INSERT INTO batch_recognition_items(id,owner_id,session_id,position,status,metadata_json,created_at,updated_at) VALUES(?,?,?,?,'staged',?,?,?)`).bind(itemId,owner,sessionId,position,metadata,stamp,stamp).run();
    for(let i=0;i<originals.length;i++){
      const original=originals[i],recognition=prepared[i];
      if(!original.type.startsWith('image/')||recognition.type!=='image/jpeg')throw new Error('Batch recognition images must be image originals with JPEG recognition copies');
      const imageId=crypto.randomUUID(),prefix=`owners/${safeOwner(owner)}/batch-recognition/${sessionId}/${itemId}/${imageId}`;
      const originalKey=`${prefix}-original`,recognitionKey=`${prefix}-recognition.jpg`;
      await env.WINE_IMAGES.put(originalKey,await original.arrayBuffer(),{httpMetadata:{contentType:original.type},customMetadata:{kind:'batch-recognition-original',sessionId,itemId}});
      await env.WINE_IMAGES.put(recognitionKey,await recognition.arrayBuffer(),{httpMetadata:{contentType:'image/jpeg'},customMetadata:{kind:'batch-recognition-copy',sessionId,itemId}});
      stored.push({originalKey,recognitionKey});
      const d=dimensions[i]??{},width=Math.max(1,Math.round(Number(d.width)||1)),height=Math.max(1,Math.round(Number(d.height)||1));
      await env.DB.prepare(`INSERT INTO batch_recognition_images(id,owner_id,item_id,original_object_key,recognition_object_key,content_type,byte_size,recognition_byte_size,width,height,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(imageId,owner,itemId,originalKey,recognitionKey,original.type,original.size,recognition.size,width,height,stamp).run();
    }
    await env.DB.prepare('UPDATE batch_recognition_sessions SET total_items=(SELECT count(*) FROM batch_recognition_items WHERE owner_id=? AND session_id=?),updated_at=? WHERE id=? AND owner_id=?').bind(owner,sessionId,stamp,sessionId,owner).run();
    return {status:201 as const,body:{id:itemId,position,photoCount:originals.length,preparedBytes}};
  }catch(e){
    await Promise.all(stored.flatMap(x=>[env.WINE_IMAGES.delete(x.originalKey),env.WINE_IMAGES.delete(x.recognitionKey)]).map(p=>p.catch(()=>undefined)));
    await env.DB.prepare('DELETE FROM batch_recognition_items WHERE id=? AND owner_id=?').bind(itemId,owner).run().catch(()=>undefined);
    const raced=await existingStagedItem(env.DB,owner,sessionId,position).catch(()=>null);if(raced)return {status:200 as const,body:{id:raced.id,position,photoCount:Number(raced.photo_count)||0,preparedBytes:Number(raced.prepared_bytes)||0,resumed:true}};
    return {status:500 as const,body:{error:(e as Error).message||'Could not stage this wine'}};
  }
}

async function loadItems(db:D1Database,owner:string,sessionId:string){
  const items=await db.prepare('SELECT id,position,status,metadata_json,recognition_json,error,confirmed_wine_id FROM batch_recognition_items WHERE owner_id=? AND session_id=? ORDER BY position,id').bind(owner,sessionId).all<ItemRow>();
  const images=await db.prepare(`SELECT bri.* FROM batch_recognition_images bri JOIN batch_recognition_items i ON i.id=bri.item_id WHERE bri.owner_id=? AND i.session_id=? ORDER BY i.position,bri.created_at`).bind(owner,sessionId).all<ImageRow>();
  const byItem=new Map<string,ImageRow[]>();for(const image of images.results){const list=byItem.get(image.item_id)??[];list.push(image);byItem.set(image.item_id,list)}
  return {items:items.results,byItem};
}

export async function getBatchSession(db:D1Database,owner:string,sessionId:string){
  const session=await db.prepare('SELECT id,status,total_items,expected_items,confirmed_items,created_at,updated_at,expires_at FROM batch_recognition_sessions WHERE id=? AND owner_id=?').bind(sessionId,owner).first<Record<string,unknown>>();
  if(!session)return null;const {items,byItem}=await loadItems(db,owner,sessionId);
  return {id:String(session.id),status:String(session.status),totalItems:Number(session.total_items)||0,expectedItems:Number(session.expected_items)||0,confirmedItems:Number(session.confirmed_items)||0,createdAt:String(session.created_at),updatedAt:String(session.updated_at),expiresAt:String(session.expires_at),items:items.map(item=>({id:item.id,position:item.position,status:item.status,recognition:item.recognition_json?parseJson(item.recognition_json,null):null,error:item.error,confirmedWineId:item.confirmed_wine_id,imageIds:(byItem.get(item.id)??[]).map(x=>x.id)}))};
}

export async function listBatchSessions(db:D1Database,owner:string){
  const rows=await db.prepare(`SELECT id,status,total_items,expected_items,confirmed_items,created_at,updated_at,expires_at FROM batch_recognition_sessions WHERE owner_id=? ORDER BY updated_at DESC LIMIT 12`).bind(owner).all<Record<string,unknown>>();
  return {items:rows.results.map(r=>({id:String(r.id),status:String(r.status),totalItems:Number(r.total_items)||0,expectedItems:Number(r.expected_items)||0,confirmedItems:Number(r.confirmed_items)||0,createdAt:String(r.created_at),updatedAt:String(r.updated_at),expiresAt:String(r.expires_at)}))};
}

export async function getBatchImage(env:Pick<Env,'DB'|'WINE_IMAGES'>,owner:string,imageId:string){
  const row=await env.DB.prepare(`SELECT bri.recognition_object_key FROM batch_recognition_images bri JOIN batch_recognition_items i ON i.id=bri.item_id WHERE bri.id=? AND bri.owner_id=? AND i.owner_id=?`).bind(imageId,owner,owner).first<{recognition_object_key:string}>();
  if(!row)return null;const object=await env.WINE_IMAGES.get(row.recognition_object_key);if(!object)return null;
  return new Response(object.body,{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, max-age=3600'}});
}

export async function markSessionSubmitted(db:D1Database,owner:string,sessionId:string){
  const session=await db.prepare('SELECT status,total_items,expected_items FROM batch_recognition_sessions WHERE id=? AND owner_id=?').bind(sessionId,owner).first<{status:string;total_items:number;expected_items:number}>();
  if(!session)return {ok:false,error:'Batch session not found'};
  if(session.status!=='uploading')return {ok:false,error:'This batch has already been submitted'};
  const total=Number(session.total_items)||0,expected=Number(session.expected_items)||0;
  if(!isBatchUploadComplete(total,expected))return {ok:false,error:expected?`Only ${total} of ${expected} wines have uploaded. Resume or cancel this batch before submitting.`:'Batch Scan requires at least two wines'};
  const stamp=now();
  await db.batch([
    db.prepare("UPDATE batch_recognition_items SET status='submitted',updated_at=? WHERE owner_id=? AND session_id=? AND status='staged'").bind(stamp,owner,sessionId),
    db.prepare("UPDATE batch_recognition_sessions SET status='queued',updated_at=? WHERE id=? AND owner_id=?").bind(stamp,sessionId,owner)
  ]);
  return {ok:true};
}

export async function removeBatchSession(env:Pick<Env,'DB'|'WINE_IMAGES'>,owner:string,sessionId:string){
  const session=await env.DB.prepare('SELECT status,confirmed_items FROM batch_recognition_sessions WHERE id=? AND owner_id=?').bind(sessionId,owner).first<{status:string;confirmed_items:number}>();
  if(!session)return {status:404 as const,body:{error:'Batch session not found'}};
  if(session.status==='queued'||session.status==='running')return {status:409 as const,body:{error:'This batch is already processing with Gemini. It can be removed after processing finishes.'}};
  const images=await env.DB.prepare(`SELECT bri.original_object_key,bri.recognition_object_key FROM batch_recognition_images bri JOIN batch_recognition_items i ON i.id=bri.item_id WHERE bri.owner_id=? AND i.owner_id=? AND i.session_id=?`).bind(owner,owner,sessionId).all<{original_object_key:string;recognition_object_key:string}>();
  await Promise.all(images.results.flatMap(image=>[env.WINE_IMAGES.delete(image.original_object_key),env.WINE_IMAGES.delete(image.recognition_object_key)]).map(request=>request.catch(()=>undefined)));
  await env.DB.prepare('DELETE FROM batch_recognition_sessions WHERE id=? AND owner_id=?').bind(sessionId,owner).run();
  return {status:200 as const,body:{ok:true,confirmedItems:Number(session.confirmed_items)||0}};
}

async function r2Base64(bucket:R2Bucket,key:string){const object=await bucket.get(key);if(!object)throw new Error('A staged recognition image is missing');const bytes=new Uint8Array(await object.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(binary)}

async function buildGoogleRequest(env:Env,item:ItemRow,images:ImageRow[]){
  const metadata=parseJson<RecognitionPhotoMetadata[]>(item.metadata_json,[]),{prompt}=buildRecognitionPrompt(metadata);
  const parts:Array<Record<string,unknown>>=[{text:prompt}];
  for(const image of images)parts.push({inlineData:{data:await r2Base64(env.WINE_IMAGES,image.recognition_object_key),mimeType:'image/jpeg'}});
  return {request:{contents:[{role:'user',parts}],generationConfig:{responseMimeType:'application/json',responseSchema:recognitionResponseSchema}},metadata:{key:item.id}};
}

async function createGoogleBatch(env:Env,sessionId:string,index:number,entries:Array<{item:ItemRow;images:ImageRow[]}>){
  const requests=[] as unknown[];for(const entry of entries)requests.push(await buildGoogleRequest(env,entry.item,entry.images));
  const body=JSON.stringify({batch:{display_name:`winelog-${sessionId}-${index}`,input_config:{requests:{requests}}}});
  if(new TextEncoder().encode(body).byteLength>=INLINE_JSON_HARD_LIMIT)throw new Error('INLINE_BATCH_TOO_LARGE');
  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${RECOGNITION_MODEL}:batchGenerateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},body});
  if(!response.ok)throw new Error(`Gemini Batch API create failed (${response.status}): ${(await response.text()).slice(0,500)}`);
  const created=await response.json() as {name?:string;metadata?:{name?:string};response?:{name?:string}};
  const name=[created.name,created.metadata?.name,created.response?.name].find(value=>value?.startsWith('batches/'));
  if(!name)throw new Error('Gemini Batch API did not return a batch name');return name;
}

async function createChunkRecursively(env:Env,owner:string,sessionId:string,indexRef:{value:number},entries:Array<{item:ItemRow;images:ImageRow[]}>){
  try{
    const googleName=await createGoogleBatch(env,sessionId,indexRef.value,entries),jobId=crypto.randomUUID(),stamp=now();indexRef.value++;
    await env.DB.prepare(`INSERT INTO batch_recognition_jobs(id,owner_id,session_id,google_batch_name,item_ids_json,status,created_at,updated_at) VALUES(?,?,?,?,?,'running',?,?)`).bind(jobId,owner,sessionId,googleName,JSON.stringify(entries.map(x=>x.item.id)),stamp,stamp).run();
    await env.RESEARCH_QUEUE.send({kind:'recognition_batch_poll',owner,sessionId,jobId,pollCount:0},{delaySeconds:15});
  }catch(e){
    if((e as Error).message==='INLINE_BATCH_TOO_LARGE'&&entries.length>1){const mid=Math.ceil(entries.length/2);await createChunkRecursively(env,owner,sessionId,indexRef,entries.slice(0,mid));await createChunkRecursively(env,owner,sessionId,indexRef,entries.slice(mid));return}
    const error=(e as Error).message||'Could not create Gemini batch';const stamp=now();
    await env.DB.prepare(`UPDATE batch_recognition_items SET status='failed',error=?,updated_at=? WHERE owner_id=? AND id IN (SELECT value FROM json_each(?))`).bind(error,stamp,owner,JSON.stringify(entries.map(x=>x.item.id))).run();
  }
}

export async function processBatchSubmitJob(env:Env,owner:string,sessionId:string){
  const {items,byItem}=await loadItems(env.DB,owner,sessionId),submitted=items.filter(x=>x.status==='submitted');if(!submitted.length)return;
  const entries=submitted.map(item=>({item,images:byItem.get(item.id)??[],preparedBytes:(byItem.get(item.id)??[]).reduce((sum,x)=>sum+Number(x.recognition_byte_size),0)}));
  const chunks=chunkItemsByPreparedBytes(entries);const indexRef={value:1};for(const chunk of chunks)await createChunkRecursively(env,owner,sessionId,indexRef,chunk);
  const active=await env.DB.prepare("SELECT count(*) AS count FROM batch_recognition_jobs WHERE owner_id=? AND session_id=? AND status='running'").bind(owner,sessionId).first<{count:number}>();
  await env.DB.prepare("UPDATE batch_recognition_sessions SET status=?,updated_at=? WHERE id=? AND owner_id=?").bind(Number(active?.count)?'running':'failed',now(),sessionId,owner).run();
}

function batchState(payload:Record<string,unknown>){
  const raw=String(payload.state??(payload.metadata as Record<string,unknown>|undefined)?.state??'');
  return raw.startsWith('BATCH_STATE_')?`JOB_STATE_${raw.slice('BATCH_STATE_'.length)}`:raw;
}
function unwrapInlineResponses(value:unknown):GoogleInlineResponse[]{
  if(Array.isArray(value))return value as GoogleInlineResponse[];
  if(value&&typeof value==='object'&&Array.isArray((value as {inlinedResponses?:unknown}).inlinedResponses))return (value as {inlinedResponses:GoogleInlineResponse[]}).inlinedResponses;
  return [];
}
function batchResponses(payload:Record<string,unknown>):GoogleInlineResponse[]{
  const direct=unwrapInlineResponses((payload.dest as {inlinedResponses?:unknown}|undefined)?.inlinedResponses);if(direct.length)return direct;
  const operation=payload.response as {inlinedResponses?:unknown;dest?:{inlinedResponses?:unknown}}|undefined;
  const responseDirect=unwrapInlineResponses(operation?.inlinedResponses);if(responseDirect.length)return responseDirect;
  return unwrapInlineResponses(operation?.dest?.inlinedResponses);
}

async function finishSessionIfTerminal(db:D1Database,owner:string,sessionId:string){
  const active=await db.prepare("SELECT count(*) AS count FROM batch_recognition_jobs WHERE owner_id=? AND session_id=? AND status IN ('queued','running')").bind(owner,sessionId).first<{count:number}>();if(Number(active?.count))return;
  const counts=await db.prepare(`SELECT sum(status='ready') AS ready,sum(status='failed') AS failed,sum(status='confirmed') AS confirmed,sum(status='rejected') AS rejected,count(*) AS total FROM batch_recognition_items WHERE owner_id=? AND session_id=?`).bind(owner,sessionId).first<Record<string,number>>();
  const ready=Number(counts?.ready)||0,failed=Number(counts?.failed)||0,total=Number(counts?.total)||0,confirmed=Number(counts?.confirmed)||0,rejected=Number(counts?.rejected)||0;
  const status=ready?(failed?'partial':'ready'):(confirmed+rejected>=total&&total?'complete':'failed');
  await db.prepare('UPDATE batch_recognition_sessions SET status=?,confirmed_items=?,updated_at=? WHERE id=? AND owner_id=?').bind(status,confirmed,now(),sessionId,owner).run();
}

export async function processBatchPollJob(env:Env,owner:string,sessionId:string,jobId:string,pollCount:number){
  const job=await env.DB.prepare('SELECT google_batch_name,item_ids_json,status FROM batch_recognition_jobs WHERE id=? AND owner_id=? AND session_id=?').bind(jobId,owner,sessionId).first<{google_batch_name:string;item_ids_json:string;status:string}>();if(!job||job.status!=='running')return;
  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/${job.google_batch_name}`,{headers:{'x-goog-api-key':env.GEMINI_API_KEY}});
  if(!response.ok){if(response.status===429||response.status>=500){await env.RESEARCH_QUEUE.send({kind:'recognition_batch_poll',owner,sessionId,jobId,pollCount:pollCount+1},{delaySeconds:Math.min(300,30*Math.max(1,pollCount+1))});return}throw new Error(`Gemini batch status failed (${response.status})`)}
  const payload=await response.json() as Record<string,unknown>,state=batchState(payload),terminal=new Set(['JOB_STATE_SUCCEEDED','JOB_STATE_FAILED','JOB_STATE_CANCELLED','JOB_STATE_EXPIRED']);
  if(!terminal.has(state)){const delay=Math.min(300,15*Math.pow(2,Math.min(pollCount,4)));await env.RESEARCH_QUEUE.send({kind:'recognition_batch_poll',owner,sessionId,jobId,pollCount:pollCount+1},{delaySeconds:delay});return}
  const ids=parseJson<string[]>(job.item_ids_json,[]),stamp=now();
  if(state==='JOB_STATE_SUCCEEDED'){
    const responses=batchResponses(payload),byMetadata=new Map(responses.map(response=>[response.metadata?.key,response]).filter((x):x is [string,GoogleInlineResponse]=>Boolean(x[0])));
    for(let i=0;i<ids.length;i++){
      const itemId=ids[i],inline=byMetadata.get(itemId)??responses[i];
      if(!inline?.response){await env.DB.prepare("UPDATE batch_recognition_items SET status='failed',error=?,updated_at=? WHERE id=? AND owner_id=?").bind(inline?.error?.message||'Gemini returned no batch result',stamp,itemId,owner).run();continue}
      try{
        const text=inline.response.candidates?.[0]?.content?.parts?.map(x=>x.text??'').join('')??'';if(!text)throw new Error('Gemini returned an empty recognition');
        const base=parseRecognition(text),item=await env.DB.prepare('SELECT metadata_json FROM batch_recognition_items WHERE id=? AND owner_id=?').bind(itemId,owner).first<{metadata_json:string}>(),metadata=parseJson<RecognitionPhotoMetadata[]>(item?.metadata_json,[]),{selected}=buildRecognitionPrompt(metadata);
        const result={...base,locationName:selected.gpsSource==='exif'&&base.locationName?.trim()?base.locationName.trim():null,tastingDate:selected.capturedAt?.slice(0,10)??null,latitude:selected.latitude,longitude:selected.longitude,metadataSource:selected.gpsSource==='exif'?'exif':selected.timestampSource,requestId:itemId};
        await env.DB.prepare("UPDATE batch_recognition_items SET status='ready',recognition_json=?,error=NULL,updated_at=? WHERE id=? AND owner_id=?").bind(JSON.stringify(result),stamp,itemId,owner).run();
      }catch(e){await env.DB.prepare("UPDATE batch_recognition_items SET status='failed',error=?,updated_at=? WHERE id=? AND owner_id=?").bind((e as Error).message,stamp,itemId,owner).run()}
    }
    await env.DB.prepare("UPDATE batch_recognition_jobs SET status='complete',updated_at=? WHERE id=? AND owner_id=?").bind(stamp,jobId,owner).run();
  }else{
    const error=String((payload.error as {message?:unknown}|undefined)?.message||`Gemini batch ended with ${state}`);
    await env.DB.batch([
      env.DB.prepare("UPDATE batch_recognition_jobs SET status='failed',error=?,updated_at=? WHERE id=? AND owner_id=?").bind(error,stamp,jobId,owner),
      env.DB.prepare("UPDATE batch_recognition_items SET status='failed',error=?,updated_at=? WHERE owner_id=? AND id IN (SELECT value FROM json_each(?))").bind(error,stamp,owner,JSON.stringify(ids))
    ]);
  }
  await finishSessionIfTerminal(env.DB,owner,sessionId);
}

export async function attachConfirmedItem(env:Pick<Env,'DB'|'WINE_IMAGES'>,owner:string,sessionId:string,itemId:string,wineId:string){
  const item=await env.DB.prepare("SELECT status FROM batch_recognition_items WHERE id=? AND owner_id=? AND session_id=?").bind(itemId,owner,sessionId).first<{status:string}>();if(!item||item.status!=='ready')throw new Error('This identification is no longer awaiting confirmation');
  const images=await env.DB.prepare('SELECT * FROM batch_recognition_images WHERE owner_id=? AND item_id=? ORDER BY created_at').bind(owner,itemId).all<ImageRow>(),stamp=now();
  const statements:D1PreparedStatement[]=[];for(const image of images.results)statements.push(env.DB.prepare(`INSERT INTO wine_images(id,owner_id,wine_id,object_key,content_type,byte_size,width,height,upload_status,recognition_status,error,created_at) VALUES(?,?,?,?,?,?,?,?, 'uploaded','complete',NULL,?)`).bind(crypto.randomUUID(),owner,wineId,image.original_object_key,image.content_type,image.byte_size,image.width,image.height,stamp));
  statements.push(env.DB.prepare("UPDATE batch_recognition_items SET status='confirmed',confirmed_wine_id=?,updated_at=? WHERE id=? AND owner_id=?").bind(wineId,stamp,itemId,owner));
  if(statements.length)await env.DB.batch(statements);
  await Promise.all(images.results.map(x=>env.WINE_IMAGES.delete(x.recognition_object_key).catch(()=>undefined)));
  await env.DB.prepare('DELETE FROM batch_recognition_images WHERE owner_id=? AND item_id=?').bind(owner,itemId).run();
  await finishSessionIfTerminal(env.DB,owner,sessionId);
}

export async function rejectBatchItem(env:Pick<Env,'DB'|'WINE_IMAGES'>,owner:string,sessionId:string,itemId:string){
  const images=await env.DB.prepare('SELECT * FROM batch_recognition_images WHERE owner_id=? AND item_id=?').bind(owner,itemId).all<ImageRow>();
  await Promise.all(images.results.flatMap(x=>[env.WINE_IMAGES.delete(x.original_object_key),env.WINE_IMAGES.delete(x.recognition_object_key)]).map(p=>p.catch(()=>undefined)));
  await env.DB.batch([
    env.DB.prepare('DELETE FROM batch_recognition_images WHERE owner_id=? AND item_id=?').bind(owner,itemId),
    env.DB.prepare("UPDATE batch_recognition_items SET status='rejected',updated_at=? WHERE id=? AND owner_id=? AND session_id=? AND status IN ('ready','failed')").bind(now(),itemId,owner,sessionId)
  ]);
  await finishSessionIfTerminal(env.DB,owner,sessionId);
}

export async function processBatchCleanupJob(env:Env,owner:string,sessionId:string){
  const session=await env.DB.prepare('SELECT expires_at,status FROM batch_recognition_sessions WHERE id=? AND owner_id=?').bind(sessionId,owner).first<{expires_at:string;status:string}>();if(!session||session.status==='complete'||session.status==='expired')return;
  const remaining=Date.parse(session.expires_at)-Date.now();if(remaining>0){await env.RESEARCH_QUEUE.send({kind:'recognition_batch_cleanup',owner,sessionId},{delaySeconds:Math.max(60,Math.min(86400,Math.ceil(remaining/1000)))});return}
  const {items,byItem}=await loadItems(env.DB,owner,sessionId),disposable=items.filter(x=>!['confirmed','rejected'].includes(x.status));
  for(const item of disposable){for(const image of byItem.get(item.id)??[]){await env.WINE_IMAGES.delete(image.original_object_key).catch(()=>undefined);await env.WINE_IMAGES.delete(image.recognition_object_key).catch(()=>undefined)}await env.DB.prepare('DELETE FROM batch_recognition_images WHERE owner_id=? AND item_id=?').bind(owner,item.id).run();}
  const stamp=now();await env.DB.batch([
    env.DB.prepare("UPDATE batch_recognition_jobs SET status='failed',error='Staging expired',updated_at=? WHERE owner_id=? AND session_id=? AND status IN ('queued','running')").bind(stamp,owner,sessionId),
    env.DB.prepare("UPDATE batch_recognition_items SET status='expired',updated_at=? WHERE owner_id=? AND session_id=? AND status NOT IN ('confirmed','rejected')").bind(stamp,owner,sessionId),
    env.DB.prepare("UPDATE batch_recognition_sessions SET status='expired',updated_at=? WHERE id=? AND owner_id=?").bind(stamp,sessionId,owner)
  ]);
}
