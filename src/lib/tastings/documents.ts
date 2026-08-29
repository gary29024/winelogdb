import { createObjectKey } from '../r2/keys';
import { ALLOWED_IMAGE_TYPES, uploadLimits } from '../../features/uploads/validation';

/**
 * The printed wine list handed out at a tasting.
 *
 * It carries what the parsed wines never will - prices, importer, flight order,
 * the organiser's notes - so it is worth keeping whether or not anything is
 * ever read off it. Storing it now also means the paper is already captured
 * when the parsing arrives, rather than needing to be photographed again.
 *
 * Unlike batch recognition images these have no TTL. Those are working files;
 * a wine list is the record of an evening, and goes only when its tasting does.
 */
export type TastingDocument={id:string;contentType:string;byteSize:number;createdAt:string};
export type DocumentEnv={DB:D1Database;WINE_IMAGES:R2Bucket};

const mapDocument=(row:Record<string,unknown>):TastingDocument=>({
  id:String(row.id),contentType:String(row.content_type),
  byteSize:Number(row.byte_size)||0,createdAt:String(row.created_at)
});

export async function listTastingDocuments(db:D1Database,owner:string,tastingId:string){
  const {results}=await db.prepare(`SELECT id,content_type,byte_size,created_at FROM tasting_documents
    WHERE owner_id=? AND tasting_id=? ORDER BY created_at ASC`).bind(owner,tastingId).all<Record<string,unknown>>();
  return (results??[]).map(mapDocument);
}

/** Several pages of one list arrive together, so this takes the whole set. */
export async function addTastingDocuments(env:DocumentEnv,owner:string,tastingId:string,files:File[]){
  const tasting=await env.DB.prepare('SELECT id FROM tastings WHERE owner_id=? AND id=?').bind(owner,tastingId).first<{id:string}>();
  if(!tasting)throw new Error('That tasting no longer exists');
  if(!files.length)throw new Error('No wine list photo was supplied');
  if(files.length>uploadLimits.maxFiles)throw new Error(`A wine list can be at most ${uploadLimits.maxFiles} pages at a time`);
  for(const file of files){
    if(!ALLOWED_IMAGE_TYPES.has(file.type))throw new Error('A wine list page must be a JPEG, PNG, WebP or HEIC image');
    if(file.size>uploadLimits.maxBytes)throw new Error('A wine list page is larger than 10MB');
  }

  const stamp=new Date().toISOString();
  const stored=await Promise.all(files.map(async file=>{
    const objectKey=createObjectKey(owner,file.type);
    await env.WINE_IMAGES.put(objectKey,await file.arrayBuffer(),{httpMetadata:{contentType:file.type},
      customMetadata:{kind:'tasting-document',tasting:tastingId}});
    return {id:crypto.randomUUID(),objectKey,contentType:file.type,byteSize:file.size};
  }));
  await env.DB.batch(stored.map(document=>env.DB.prepare(
    `INSERT INTO tasting_documents(id,owner_id,tasting_id,object_key,content_type,byte_size,created_at) VALUES(?,?,?,?,?,?,?)`)
    .bind(document.id,owner,tastingId,document.objectKey,document.contentType,document.byteSize,stamp)));
  return stored.map(document=>({id:document.id,contentType:document.contentType,byteSize:document.byteSize,createdAt:stamp}));
}

export async function readTastingDocument(env:DocumentEnv,owner:string,documentId:string){
  const row=await env.DB.prepare('SELECT object_key,content_type FROM tasting_documents WHERE owner_id=? AND id=?')
    .bind(owner,documentId).first<{object_key:string;content_type:string}>();
  if(!row)return null;
  const object=await env.WINE_IMAGES.get(row.object_key);
  if(!object)return null;
  return new Response(object.body,{headers:{'Content-Type':row.content_type,'Cache-Control':'private, max-age=31536000'}});
}

export async function deleteTastingDocument(env:DocumentEnv,owner:string,documentId:string){
  const row=await env.DB.prepare('SELECT object_key FROM tasting_documents WHERE owner_id=? AND id=?')
    .bind(owner,documentId).first<{object_key:string}>();
  if(!row)return false;
  await env.DB.prepare('DELETE FROM tasting_documents WHERE owner_id=? AND id=?').bind(owner,documentId).run();
  await env.WINE_IMAGES.delete(row.object_key).catch(()=>undefined);
  return true;
}

/**
 * The objects behind a tasting's documents, read before the row is deleted -
 * the FK cascades the rows away, so R2 has to be told separately, the same way
 * deleting a wine batches its images.
 */
export async function tastingDocumentKeys(db:D1Database,owner:string,tastingId:string){
  const {results}=await db.prepare('SELECT object_key FROM tasting_documents WHERE owner_id=? AND tasting_id=?')
    .bind(owner,tastingId).all<{object_key:string}>();
  return (results??[]).map(row=>row.object_key);
}
