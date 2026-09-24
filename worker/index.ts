import { lwinDisplayWineName,sameWineDisplayName,wineNameNeedsReview } from '../src/lib/wine/lwinDisplayName';
import { readLwinReference } from '../src/lib/wine/lwinMetadata';
import { Hono } from 'hono';
import { apiErrorHandler } from '../src/lib/credits/primitives';
import { serveWineImage } from './wineImageHandler';
import { photoObjectKeys } from '../src/lib/r2/thumbnails';
import { grapeGroup } from '../src/lib/wine/grapes';
import { cors } from 'hono/cors';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { requireSession } from '../src/lib/auth/session';
import { createObjectKey } from '../src/lib/r2/keys';
import { wineInputSchema,type WineInput } from '../src/lib/db/schema';
import { dimensionsSchema, validateBatch } from '../src/features/uploads/validation';
import { parseRecognition } from '../src/features/recognition/schema';
import { wineSaveStatements } from '../src/lib/db/wineSave';
import { enrichRecognitionReference,type StoredReferenceIdentity } from '../src/lib/wine/referenceIdentity';
import { previewLoggingReference,resolveLoggingReference } from './wineLoggingReference';
import { normalizeReferenceText } from '../src/lib/wine/referenceCatalog';
import { appClassification,classificationLabel,referenceSuggestionFields,type ReferenceSuggestion,type ReferenceSuggestionField } from '../src/lib/wine/referenceSuggestions';
import { ensureWineIdentity } from '../src/lib/wine/identity';
import { loadWineResearchCache,RESEARCH_EDITION_COLUMNS,seedResolvedResearch,wineRowResearchTargets } from '../src/lib/research/cache';
import { recheckWineReference } from './wineReferenceReview';
import { linkWineReference,previewWineReference,rejectWineReference } from './manualWineReference';
import { applyProducerNameReview,previewProducerNameReview } from './producerNameReview';

type Bindings={IMAGES?:ImagesBinding;DB:D1Database;WINE_IMAGES:R2Bucket;REFERENCE_DATA:R2Bucket;ASSETS:Fetcher;GEMINI_API_KEY?:string;AUTH_SECRET:string;APP_PASSWORD:string;APP_URL:string;MAX_FILE_BYTES?:string;MAX_BATCH_FILES?:string};
type Variables={userId:string};
type AppContext={Bindings:Bindings;Variables:Variables};
type PhotoMetadata={capturedAt?:string|null;latitude?:number|null;longitude?:number|null;source?:'exif'|'file_fallback'|'none'};

const app=new Hono<AppContext>();
app.onError(apiErrorHandler);
app.use('/api/*',cors({origin:(origin,c)=>origin===c.env.APP_URL?origin:null,credentials:true}));
app.use('/api/*',async(c,next)=>{
 if(c.req.path==='/api/auth/login')return next();
 try{const s=await requireSession(c.req.header('Authorization'),c.env.AUTH_SECRET);c.set('userId',s.userId)}catch{return c.json({error:'Unauthorized'},401)}
 // Only session verification can expire a login. Route/database failures must
 // reach the API error handler instead of logging a valid user out.
 await next();
});

app.post('/api/auth/login',c=>c.json({error:'Password login has been retired. Use Google login.'},410));

const parseJson=<T>(value:unknown,fallback:T):T=>{try{return JSON.parse(String(value)) as T}catch{return fallback}};
// Same column order for JSON/multipart INSERT and PUT; absent optional inputs
// become SQL null only at this binding boundary, never JavaScript undefined.
function wineRowValues(w:WineInput){
 return [w.producer,w.wineName,w.vintage,w.country,w.region,w.appellation,
  w.recognizedRegion,w.recognizedAppellation,w.classification,w.classificationOverride,
  JSON.stringify(w.grapes),JSON.stringify(w.grapeBlend),w.wineStyle,w.alcoholPercentage,
  w.tastingNotes,w.rating,w.tastingDate,w.event,w.venue,w.price,w.currency,
  JSON.stringify(w.tags),w.recognitionStatus,w.recognitionConfidence].map(value=>value??null);
}
const normalizeMeta=(meta:PhotoMetadata|undefined)=>{
 const latitude=typeof meta?.latitude==='number'&&meta.latitude>=-90&&meta.latitude<=90?meta.latitude:null;
 const longitude=typeof meta?.longitude==='number'&&meta.longitude>=-180&&meta.longitude<=180?meta.longitude:null;
 const capturedAt=typeof meta?.capturedAt==='string'&&!Number.isNaN(Date.parse(meta.capturedAt))?new Date(meta.capturedAt).toISOString():null;
 const source:PhotoMetadata['source']=meta?.source==='exif'||meta?.source==='file_fallback'?meta.source:'none';
 return {capturedAt,latitude,longitude,source};
};
async function fileToBase64(file:File){const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(binary)}
const wineSelect=`SELECT w.*,
 t.name AS tasting_name,
 we.consumed_at AS experience_date,
 we.location_name AS location_name,
 we.latitude AS latitude,
 we.longitude AS longitude,
 we.rating AS experience_rating,
 we.tasting_notes AS experience_notes
 FROM wines w
 LEFT JOIN wine_experiences we ON we.id=(SELECT le.id FROM wine_experiences le WHERE le.owner_id=w.owner_id AND le.wine_id=w.id ORDER BY le.created_at DESC LIMIT 1)
 LEFT JOIN tastings t ON t.owner_id=we.owner_id AND t.id=we.tasting_id`;

export const mapWine=(r:Record<string,unknown>,imageIds:string[]=[])=>({
 id:r.id,ownerId:r.owner_id,producer:r.producer,wineName:r.wine_name,vintage:r.vintage,
 recognizedProducer:r.recognized_producer??null,recognizedWineName:r.recognized_wine_name??null,recognizedVintageText:r.recognized_vintage_text??null,vintageKind:r.vintage_kind??(r.vintage==null?'unknown':'vintage'),releaseDesignation:r.release_designation??null,
 country:r.country,region:r.region,appellation:r.appellation,recognizedRegion:r.recognized_region??null,recognizedAppellation:r.recognized_appellation??null,classification:r.classification??null,classificationOverride:r.classification_override??null,
 grapes:parseJson<string[]>(r.grapes_json,[]),grapeBlend:parseJson<Array<{grape:string;percentage?:number|null}>>(r.grape_blend_json,[]),wineStyle:r.wine_style,alcoholPercentage:r.alcohol_percentage,
 lwinReference:readLwinReference(r.lwin_reference_json),colour:r.colour??null,productType:r.product_type??null,productSubtype:r.product_subtype??null,referenceProductKey:r.reference_product_key??null,lwin7:r.lwin7??null,lwin11:r.lwin11??null,elid:r.elid??null,referenceSite:r.reference_site??null,referenceParcel:r.reference_parcel??null,referenceSuggestions:parseJson<ReferenceSuggestion[]>(r.reference_suggestions_json,[]),identityMatchStatus:r.identity_match_status??null,identityMatchConfidence:r.identity_match_confidence??null,identityMatchCandidates:parseJson<string[]>(r.identity_match_candidates_json,[]),identityMatchedAt:r.identity_matched_at??null,identityCheckedAt:r.identity_checked_at??null,
 tastingNotes:r.experience_notes??r.tasting_notes,rating:r.experience_rating??r.rating,tastingDate:r.experience_date??r.tasting_date,event:r.event,venue:r.venue,
 tastingName:r.tasting_name,locationName:r.location_name,latitude:r.latitude,longitude:r.longitude,
 producerId:r.producer_id??null,favorite:Boolean(r.favorite),
 deepSearch:r.deep_search_json?parseJson(r.deep_search_json,null):null,
 price:r.price,currency:r.currency,tags:parseJson<string[]>(r.tags_json,[]),imageIds,imageObjectKeys:[],recognitionStatus:r.recognition_status,recognitionConfidence:r.recognition_confidence,
 createdAt:r.created_at,updatedAt:r.updated_at
});

async function mapWinesWithImages(db:D1Database,owner:string,rows:Record<string,unknown>[]){
 if(!rows.length)return [];
 const wineIds=rows.map(r=>String(r.id));
 const images=await db.prepare('SELECT id,wine_id FROM wine_images WHERE owner_id=? AND wine_id IN (SELECT CAST(value AS TEXT) FROM json_each(?)) ORDER BY rowid ASC').bind(owner,JSON.stringify(wineIds)).all<{id:string;wine_id:string}>();
 const byWine=new Map<string,string[]>();
 for(const image of images.results){const list=byWine.get(image.wine_id)??[];list.push(image.id);byWine.set(image.wine_id,list)}
 return rows.map(row=>mapWine(row,byWine.get(String(row.id))??[]));
}

app.get('/api/wines',async c=>{
 const q=c.req.query(),owner=c.get('userId'),args:unknown[]=[owner];let where='w.owner_id=?';
 const filters:[string,string][]=[['vintage','w.vintage'],['country','w.country'],['region','w.region'],['style','w.wine_style'],['tastingDate','w.tasting_date']];
 for(const [key,col] of filters)if(q[key]){where+=` AND ${col}=?`;args.push(q[key])}
 if(q.rating){where+=' AND w.rating>=?';args.push(Number(q.rating))}
 // Every name the grape answers to; the label keeps its own spelling.
 if(q.grape){const names=grapeGroup(q.grape);where+=` AND EXISTS (SELECT 1 FROM json_each(w.grapes_json) WHERE lower(trim(CAST(value AS TEXT))) IN (${names.map(()=>'?').join(',')}))`;args.push(...names.map(name=>name.toLowerCase()))}
 if(q.tasting){where+=' AND EXISTS (SELECT 1 FROM wine_experiences we JOIN tastings t ON t.id=we.tasting_id WHERE we.wine_id=w.id AND we.owner_id=? AND lower(t.name) LIKE lower(?))';args.push(owner,`%${q.tasting}%`)}
 if(q.query){const clean=q.query.replace(/[^\p{L}\p{N}\s]/gu,' ').trim();if(clean){where+=' AND (w.id IN (SELECT wine_id FROM wine_search WHERE wine_search MATCH ? AND owner_id=?) OR EXISTS (SELECT 1 FROM wine_experiences we JOIN tastings t ON t.id=we.tasting_id WHERE we.wine_id=w.id AND we.owner_id=? AND lower(t.name) LIKE lower(?)))';args.push(clean+'*',owner,owner,`%${q.query}%`)}}
 const orders:Record<string,string>={newest:'w.created_at DESC',oldest:'w.created_at ASC',rating:'w.rating DESC',producer:'w.producer COLLATE NOCASE',vintage:'w.vintage DESC'};
 const limit=Math.min(Number(q.limit)||24,100),offset=Math.max(Number(q.offset)||0,0);args.push(limit,offset);
 const rows=await c.env.DB.prepare(`${wineSelect} WHERE ${where} ORDER BY ${orders[q.sort]||orders.newest} LIMIT ? OFFSET ?`).bind(...args).all();
 const items=await mapWinesWithImages(c.env.DB,owner,rows.results as Record<string,unknown>[]);
 return c.json({items,nextOffset:rows.results.length===limit?offset+limit:null});
});

app.get('/api/wines/:id',async c=>{
 const id=c.req.param('id'),owner=c.get('userId');
 // The detail page shows whether the bottle is shared, which used to cost a
 // second round trip per wine opened. It rides along here instead. The count,
 // not the recipients: naming them is the sharing sheet's job, and it asks
 // only when someone opens it. wineSelect is shared with the journal list,
 // where nothing shows this, so the count stays out of it.
 const [row,images,shares]=await Promise.all([
  c.env.DB.prepare(`${wineSelect} WHERE w.id=? AND w.owner_id=?`).bind(id,owner).first(),
  c.env.DB.prepare('SELECT id FROM wine_images WHERE wine_id=? AND owner_id=? ORDER BY rowid ASC').bind(id,owner).all<{id:string}>(),
  c.env.DB.prepare('SELECT count(*) AS total FROM wine_shares WHERE wine_id=? AND owner_id=?').bind(id,owner).first<{total:number}>()
 ]);
 return row?c.json({...mapWine(row as Record<string,unknown>,images.results.map(x=>x.id)),friendTagCount:Number(shares?.total??0)}):c.json({error:'Not found'},404)
});

app.post('/api/wines/reference-check',async c=>{
 const parsed=wineInputSchema.safeParse(await c.req.json());if(!parsed.success)return c.json({error:'Invalid wine',issues:parsed.error.issues},400);
 return c.json(await previewLoggingReference(c.env.REFERENCE_DATA,parsed.data));
});

app.post('/api/wines',async c=>{
 const owner=c.get('userId'),id=crypto.randomUUID(),now=new Date().toISOString();
 const multipart=(c.req.header('Content-Type')||'').includes('multipart/form-data');
 if(!multipart){
  const parsed=wineInputSchema.safeParse(await c.req.json());if(!parsed.success)return c.json({error:'Invalid wine',issues:parsed.error.issues},400);
  const w=await resolveLoggingReference(c.env.REFERENCE_DATA,parsed.data);
  const wineStatement=c.env.DB.prepare(`INSERT INTO wines(id,owner_id,producer,wine_name,vintage,country,region,appellation,recognized_region,recognized_appellation,classification,classification_override,grapes_json,grape_blend_json,wine_style,alcohol_percentage,tasting_notes,rating,tasting_date,event,venue,price,currency,tags_json,recognition_status,recognition_confidence,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,owner,...wineRowValues(w),now,now);
  try{await c.env.DB.batch([wineStatement,...wineSaveStatements(c.env.DB,owner,id,w)]);return c.json({id},201)}
  catch(error){console.error('wine-save-failed',error);return c.json({error:'Could not save wine. Please retry.'},500)}
 }
 const form=await c.req.formData();
 const parsed=wineInputSchema.safeParse(parseJson(form.get('wine'),null));if(!parsed.success)return c.json({error:'Invalid wine',issues:parsed.error.issues},400);
 const w=await resolveLoggingReference(c.env.REFERENCE_DATA,parsed.data),files=form.getAll('images').filter((x):x is File=>x instanceof File);
 try{validateBatch(files,{maxFiles:Number(c.env.MAX_BATCH_FILES)||12,maxBytes:Number(c.env.MAX_FILE_BYTES)||10485760,minDimension:300,maxDimension:12000})}catch(e){return c.json({error:(e as Error).message},400)}
 const dimensions=parseJson<unknown[]>(form.get('dimensions'),[]),metadata=parseJson<PhotoMetadata[]>(form.get('metadata'),[]);
 if(dimensions.length!==files.length||metadata.length!==files.length)return c.json({error:'Dimensions and metadata are required for every saved photo'},400);
 // Checked here rather than inside the upload loop: parsing there threw a raw
 // ZodError into the 500 handler, so a crop one pixel under the floor reached
 // the screen as [{"origin":"number","code":"too_small",...}] with nothing to
 // say which photo or what to do. Same shape as the wine body above.
 for(const entry of dimensions){const size=dimensionsSchema.safeParse(entry);if(!size.success)return c.json({error:'Invalid photo dimensions',issues:size.error.issues},400)}
 const uploaded:Array<{key:string;imageId:string;file:File;dim:{width:number;height:number};meta:ReturnType<typeof normalizeMeta>}>=[];
 try{
  for(let i=0;i<files.length;i++){
   const dim=dimensionsSchema.parse(dimensions[i]),meta=normalizeMeta(metadata[i]),file=files[i],key=createObjectKey(owner,file.type),imageId=crypto.randomUUID();
   await c.env.WINE_IMAGES.put(key,file.stream(),{httpMetadata:{contentType:file.type},customMetadata:{ownerId:owner,wineId:id}});
   uploaded.push({key,imageId,file,dim,meta});
  }
  const statements=[c.env.DB.prepare(`INSERT INTO wines(id,owner_id,producer,wine_name,vintage,country,region,appellation,recognized_region,recognized_appellation,classification,classification_override,grapes_json,grape_blend_json,wine_style,alcohol_percentage,tasting_notes,rating,tasting_date,event,venue,price,currency,tags_json,recognition_status,recognition_confidence,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,owner,...wineRowValues(w),now,now),...uploaded.map(x=>c.env.DB.prepare(`INSERT INTO wine_images(id,owner_id,wine_id,object_key,content_type,byte_size,width,height,upload_status,recognition_status,captured_at,latitude,longitude,location_name,metadata_source,created_at) VALUES(?,?,?,?,?,?,?,?,'uploaded','complete',?,?,?,?,?,?)`).bind(x.imageId,owner,id,x.key,x.file.type,x.file.size,x.dim.width,x.dim.height,x.meta.capturedAt,x.meta.latitude,x.meta.longitude,w.locationName??null,x.meta.source,now))];
  await c.env.DB.batch([...statements,...wineSaveStatements(c.env.DB,owner,id,w)]);
  return c.json({id,imageIds:uploaded.map(item=>item.imageId)},201);
 }catch(e){
  await Promise.allSettled(uploaded.map(x=>c.env.WINE_IMAGES.delete(x.key)));
  return c.json({error:(e as Error).message||'Could not save wine and photos'},500);
 }
});

/**
 * Photographs for a wine that already exists.
 *
 * Until now a photo could only arrive when the wine did: POST /api/wines takes
 * multipart, PUT /api/wines/:id never touched wine_images, and the form had no
 * file input at all. So a wine created any other way - read off a printed wine
 * list, typed in by hand - could never have a picture, and the only way to get
 * one was to delete it and scan the bottle, losing the price and the evening it
 * was attached to.
 *
 * Same contract as creation, minus the wine: the originals are stored, capped
 * the same way, with their dimensions and capture metadata. R2 objects written
 * before a failing insert are deleted again, or a rolled-back upload would be
 * billed storage nothing points at.
 */
app.post('/api/wines/:id/images',async c=>{
 const id=c.req.param('id'),owner=c.get('userId'),now=new Date().toISOString();
 let wine:{id:string}|null,existing:{count:number;location_name:string|null}|null;
 // Both reads are guarded: a throw out here escapes into a bare 500 whose body
 // is not JSON, so the browser shows a generic failure instead of the reason.
 // That is exactly how selecting a column wines does not have - location_name
 // lives on wine_images - surfaced as "could not add the photos".
 try{
  wine=await c.env.DB.prepare('SELECT id FROM wines WHERE id=? AND owner_id=?').bind(id,owner).first<{id:string}>();
  // The place is carried from the photos the wine already has rather than from
  // the wine, which does not record one.
  existing=await c.env.DB.prepare('SELECT count(*) AS count,max(location_name) AS location_name FROM wine_images WHERE wine_id=? AND owner_id=?')
    .bind(id,owner).first<{count:number;location_name:string|null}>();
 }catch(e){return c.json({error:(e as Error).message||'Could not read that wine'},500)}
 if(!wine)return c.json({error:'That wine no longer exists'},404);
 let form:FormData;
 try{form=await c.req.formData()}catch{return c.json({error:'Could not read the photos'},400)}
 const files=form.getAll('images').filter((x):x is File=>x instanceof File);
 if(!files.length)return c.json({error:'Choose at least one photo'},400);
 const maxFiles=Number(c.env.MAX_BATCH_FILES)||12;
 // Counted against what the wine already has, not against this upload alone,
 // or the cap is one that any number of uploads walks straight past.
 if(Number(existing?.count??0)+files.length>maxFiles)return c.json({error:`A wine can hold ${maxFiles} photos, and this one already has ${Number(existing?.count??0)}`},400);
 try{validateBatch(files,{maxFiles,maxBytes:Number(c.env.MAX_FILE_BYTES)||10485760,minDimension:300,maxDimension:12000})}catch(e){return c.json({error:(e as Error).message},400)}
 const dimensions=parseJson<unknown[]>(form.get('dimensions'),[]),metadata=parseJson<PhotoMetadata[]>(form.get('metadata'),[]);
 if(dimensions.length!==files.length||metadata.length!==files.length)return c.json({error:'Dimensions and metadata are required for every saved photo'},400);
 // Checked here rather than inside the upload loop: parsing there threw a raw
 // ZodError into the 500 handler, so a crop one pixel under the floor reached
 // the screen as [{"origin":"number","code":"too_small",...}] with nothing to
 // say which photo or what to do. Same shape as the wine body above.
 for(const entry of dimensions){const size=dimensionsSchema.safeParse(entry);if(!size.success)return c.json({error:'Invalid photo dimensions',issues:size.error.issues},400)}
 const uploaded:Array<{key:string;imageId:string;file:File;dim:{width:number;height:number};meta:ReturnType<typeof normalizeMeta>}>=[];
 try{
  for(let i=0;i<files.length;i++){
   const dim=dimensionsSchema.parse(dimensions[i]),meta=normalizeMeta(metadata[i]),file=files[i],key=createObjectKey(owner,file.type),imageId=crypto.randomUUID();
   await c.env.WINE_IMAGES.put(key,file.stream(),{httpMetadata:{contentType:file.type},customMetadata:{ownerId:owner,wineId:id}});
   uploaded.push({key,imageId,file,dim,meta});
  }
  await c.env.DB.batch([
   ...uploaded.map(x=>c.env.DB.prepare(`INSERT INTO wine_images(id,owner_id,wine_id,object_key,content_type,byte_size,width,height,upload_status,recognition_status,captured_at,latitude,longitude,location_name,metadata_source,created_at) VALUES(?,?,?,?,?,?,?,?,'uploaded','complete',?,?,?,?,?,?)`)
     .bind(x.imageId,owner,id,x.key,x.file.type,x.file.size,x.dim.width,x.dim.height,x.meta.capturedAt,x.meta.latitude,x.meta.longitude,existing?.location_name??null,x.meta.source,now)),
   c.env.DB.prepare('UPDATE wines SET updated_at=? WHERE id=? AND owner_id=?').bind(now,id,owner)
  ]);
  return c.json({imageIds:uploaded.map(x=>x.imageId)},201);
 }catch(e){
  await Promise.allSettled(uploaded.map(x=>c.env.WINE_IMAGES.delete(x.key)));
  return c.json({error:(e as Error).message||'Could not save the photos'},500);
 }
});

/**
 * One photograph removed, rather than all of them.
 *
 * Deleting a wine has always taken its images with it, but there was no way to
 * drop a single bad frame - and now that a photo is easy to add to an existing
 * wine, it is just as easy to add the wrong one. The R2 object goes with the
 * row: an object nothing points at is storage billed forever for a photo nobody
 * can see, and the row is what points at it.
 */
app.delete('/api/wines/:id/images/:imageId',async c=>{
 const id=c.req.param('id'),imageId=c.req.param('imageId'),owner=c.get('userId');
 const image=await c.env.DB.prepare('SELECT object_key FROM wine_images WHERE id=? AND wine_id=? AND owner_id=?')
   .bind(imageId,id,owner).first<{object_key:string}>();
 if(!image)return c.json({error:'That photo no longer exists'},404);
 await c.env.DB.prepare('DELETE FROM wine_images WHERE id=? AND wine_id=? AND owner_id=?').bind(imageId,id,owner).run();
 // After the row, and forgiving: a bucket delete that fails leaves an orphan
 // worth pennies, while failing the request would leave a photo the owner has
 // already been told is gone.
 await c.env.WINE_IMAGES.delete(photoObjectKeys(image.object_key)).catch(()=>undefined);
 await c.env.DB.prepare('UPDATE wines SET updated_at=? WHERE id=? AND owner_id=?').bind(new Date().toISOString(),id,owner).run();
 return c.json({ok:true});
});

app.get('/api/wines/:id/producer-name-review',async c=>c.json((await previewProducerNameReview(c.env.DB,c.get('userId'),c.req.param('id'))).preview));
app.post('/api/wines/:id/producer-name-review',async c=>{
 const payload=await c.req.json().catch(()=>null) as {previewToken?:unknown}|null;
 return c.json(await applyProducerNameReview(c.env.DB,c.get('userId'),c.req.param('id'),payload?.previewToken));
});

app.put('/api/wines/:id/reference-suggestion',async c=>{
 const owner=c.get('userId'),id=c.req.param('id'),payload=await c.req.json().catch(()=>null) as {field?:unknown;action?:unknown}|null,field=String(payload?.field??'') as ReferenceSuggestionField;
 if(payload?.action!==undefined&&payload.action!=='keep'&&payload.action!=='apply')return c.json({error:'Unknown review action'},400);
 const keep=payload?.action==='keep';
 if(!referenceSuggestionFields.includes(field))return c.json({error:'Unknown LWIN suggestion field'},400);
 const row=await c.env.DB.prepare(`SELECT producer,producer_id,cuvee_id,wine_name,vintage,appellation,wine_style,country,region,classification,deep_search_json,lwin7,identity_match_status,lwin_reference_json,reference_suggestions_json,updated_at,${RESEARCH_EDITION_COLUMNS} FROM wines w WHERE w.owner_id=? AND w.id=?`).bind(owner,id).first<Record<string,unknown>>();
 if(!row)return c.json({error:'Not found'},404);
 const suggestions=parseJson<ReferenceSuggestion[]>(row.reference_suggestions_json,[]),suggestion=suggestions.find(item=>item.field===field);
 if(!suggestion)return c.json({error:'That LWIN suggestion is no longer available'},409);
 const reference=readLwinReference(row.lwin_reference_json),displayWine=reference?.lwin7===row.lwin7&&reference?lwinDisplayWineName(reference):null;
 if(!keep&&field==='wineName'&&displayWine&&(!sameWineDisplayName(suggestion.suggested,displayWine)||!wineNameNeedsReview(String(row.wine_name??''),displayWine)))return c.json({error:'This wine-name suggestion is outdated. Recheck LWIN to review the full catalogue name before applying it.'},409);
 const columns:Record<ReferenceSuggestionField,string>={producer:'producer',wineName:'wine_name',country:'country',region:'region',classification:'classification'},column=columns[field];
 const rawCurrent=field==='wineName'?row.wine_name:row[field],current=field==='classification'?classificationLabel(rawCurrent==null?null:String(rawCurrent)):(rawCurrent==null?null:String(rawCurrent));
 // Suggestions and entity aliases already ignore accents and formatting. Use
 // the same comparison here; the write below still guards the exact raw value
 // read from D1 so an edit during this request cannot be overwritten.
 if(normalizeReferenceText(suggestion.current)!==normalizeReferenceText(current))return c.json({error:'This wine changed since the LWIN suggestion was created. Re-run matching before applying it.'},409);
 let value:string|null=keep?(rawCurrent==null?null:String(rawCurrent)):suggestion.suggested;
 if(!keep&&field==='classification')value=suggestion.suggestedValue??appClassification(suggestion.suggested);
 if(!keep&&!value)return c.json({error:'Unsupported LWIN value'},400);
 // Cuvee relinking uses recognized_wine_name as its input. Like an explicit
 // edit, accepting a name must update that input in the same guarded write;
 // otherwise ensureWineIdentity immediately restores the previous name.
 // Reviewed naming choices retain the accepted match and its current input.
 // A disputed identity still requires explicit identity confirmation.
 const reviewedReference=reference&&reference.lwin7===row.lwin7&&['matched','manual'].includes(String(row.identity_match_status))&&(field==='producer'||field==='wineName')
  ?{...reference,input:{producer:field==='producer'?value:String(row.producer??''),wineName:field==='wineName'?value:String(row.wine_name??'')}}:null;
 const rename=!keep&&field==='wineName';
 // Capture the old keys before the reviewed naming change clears entity IDs.
 // Only an accepted identity proves these names refer to the same bottle.
 const savedResearch=!keep&&reviewedReference?await loadWineResearchCache(c.env.DB,owner,wineRowResearchTargets(row),false,row.deep_search_json):null;
 const remaining=suggestions.filter(item=>item.field!==field),now=new Date().toISOString(),identityReset=keep?'':field==='producer'?',producer_id=NULL,cuvee_id=NULL':rename?',recognized_wine_name=?,cuvee_id=NULL':'';
 const result=await c.env.DB.prepare(`UPDATE wines SET ${column}=?${identityReset},lwin_reference_json=?,reference_suggestions_json=?,reference_suggestions_updated_at=?,updated_at=? WHERE owner_id=? AND id=? AND reference_suggestions_json IS ? AND ${column} IS ? AND lwin7 IS ? AND identity_match_status IS ? AND lwin_reference_json IS ? AND updated_at IS ?`)
  .bind(value,...(rename?[value]:[]),reviewedReference?JSON.stringify(reviewedReference):row.lwin_reference_json??null,remaining.length?JSON.stringify(remaining):null,remaining.length?now:null,now,owner,id,row.reference_suggestions_json??null,rawCurrent??null,row.lwin7??null,row.identity_match_status??null,row.lwin_reference_json??null,row.updated_at??null).run();
 if(!result.meta.changes)return c.json({error:'This wine changed. Refresh and review it again.'},409);
 if(!keep&&(field==='producer'||field==='wineName'))await ensureWineIdentity(c.env.DB,owner,id);
 if(savedResearch?.size){
  const current=await c.env.DB.prepare(`SELECT producer,producer_id,cuvee_id,wine_name,vintage,appellation,wine_style,country,region,${RESEARCH_EDITION_COLUMNS} FROM wines w WHERE w.owner_id=? AND w.id=? AND w.updated_at=? AND w.lwin7 IS ? AND w.lwin_reference_json IS ?`)
   .bind(owner,id,now,row.lwin7??null,JSON.stringify(reviewedReference)).first<Record<string,unknown>>();
  if(current){
   const targets=wineRowResearchTargets(current);
   await seedResolvedResearch(c.env.DB,owner,new Map(targets.flatMap(target=>{const old=savedResearch.get(target.scope);return old?[[target.scope,{...old,target}] as const]:[]})));
  }
 }
 await recheckWineReference(c.env.DB,c.env.REFERENCE_DATA,owner,id,false);
 return c.json({ok:true,referenceSuggestions:remaining});
});

app.get('/api/wines/:id/reference-preview',async c=>{
 const result=await previewWineReference(c.env,c.get('userId'),c.req.param('id'),c.req.query('lwin7'));
 return c.json(result.preview);
});

app.post('/api/wines/:id/reference-review',async c=>{
 const owner=c.get('userId'),id=c.req.param('id'),payload=await c.req.json().catch(()=>null) as {action?:unknown;lwin7?:unknown;updatedAt?:unknown;previewToken?:unknown}|null;
 if(payload?.action==='link')return c.json(await linkWineReference(c.env,owner,id,payload));
 if(payload?.action==='reject')return c.json(await rejectWineReference(c.env,owner,id,payload));
 if(payload?.action==='recheck'){
  if(!await recheckWineReference(c.env.DB,c.env.REFERENCE_DATA,owner,id))return c.json({error:'Wine changed or is unavailable. Refresh and try again.'},409);
  return c.json({ok:true});
 }
 if(payload?.action==='confirm'&&typeof payload.lwin7==='string'&&/^\d{7}$/.test(payload.lwin7)&&typeof payload.updatedAt==='string'){
  const now=new Date().toISOString();
  const saved=await c.env.DB.prepare("UPDATE wines SET identity_match_status='manual',identity_match_candidates_json=NULL,identity_match_confidence=NULL,identity_checked_at=?,updated_at=? WHERE owner_id=? AND id=? AND lwin7=? AND updated_at=? AND identity_match_status='conflict'")
   .bind(now,now,owner,id,payload.lwin7,payload.updatedAt).run();
  if(!saved.meta.changes)return c.json({error:'Wine changed. Refresh before confirming its LWIN.'},409);
  return c.json({ok:true});
 }
 return c.json({error:'Unknown review action'},400);
});

app.put('/api/wines/:id',async c=>{
 const parsed=wineInputSchema.safeParse(await c.req.json());if(!parsed.success)return c.json({error:'Invalid wine',issues:parsed.error.issues},400);
 try{
  const id=c.req.param('id'),owner=c.get('userId');
  const previous=await c.env.DB.prepare('SELECT * FROM wines WHERE owner_id=? AND id=?').bind(owner,id).first<StoredReferenceIdentity>();
  // Refuse another account's wine before enrichment or binding optional update
  // fields. A valid partial payload must still produce the normal not-found result.
  if(!previous)return c.json({error:'Not found'},404);
  const x=await enrichRecognitionReference(c.env.REFERENCE_DATA,parsed.data);
  const wineStatement=c.env.DB.prepare(`UPDATE wines SET producer=?,wine_name=?,vintage=?,country=?,region=?,appellation=?,recognized_region=?,recognized_appellation=?,classification=?,classification_override=?,grapes_json=?,grape_blend_json=?,wine_style=?,alcohol_percentage=?,tasting_notes=?,rating=?,tasting_date=?,event=?,venue=?,price=?,currency=?,tags_json=?,recognition_status=?,recognition_confidence=?,updated_at=? WHERE id=? AND owner_id=?`).bind(...wineRowValues(x),new Date().toISOString(),id,owner);
  const [res]=await c.env.DB.batch([wineStatement,...wineSaveStatements(c.env.DB,owner,id,x,true,previous)]);
  if(!res.meta.changes)return c.json({error:'Not found'},404);
  return c.json({ok:true});
 }catch(error){console.error('wine-save-failed',error);return c.json({error:'Could not save wine. Please retry.'},500)}
});

app.delete('/api/wines/:id',async c=>{
 const id=c.req.param('id'),owner=c.get('userId');
 const images=await c.env.DB.prepare('SELECT object_key FROM wine_images WHERE wine_id=? AND owner_id=?').bind(id,owner).all<{object_key:string}>();
 const deleted=await c.env.DB.prepare('DELETE FROM wines WHERE id=? AND owner_id=?').bind(id,owner).run();
 if(!deleted.meta.changes)return c.json({error:'Not found'},404);
 // One statement and one R2 batch for the whole set: deleting a twelve-photo wine
 // used to cost twelve serial D1 round trips.
 if(images.results.length){
  await c.env.DB.batch(images.results.map(image=>c.env.DB.prepare('DELETE FROM wine_images WHERE object_key=?').bind(image.object_key)));
  await Promise.allSettled(images.results.map(image=>c.env.WINE_IMAGES.delete(photoObjectKeys(image.object_key))));
 }
 return c.body(null,204);
});

app.get('/api/images/:id',c=>serveWineImage(c.req.raw,c.env,c.get('userId'),c.req.param('id'),c.executionCtx));

app.post('/api/recognition',async c=>{
 const form=await c.req.formData(),files=form.getAll('images').filter((x):x is File=>x instanceof File);
 try{validateBatch(files,{maxFiles:Number(c.env.MAX_BATCH_FILES)||12,maxBytes:3*1024*1024,minDimension:300,maxDimension:2000})}catch(e){return c.json({error:(e as Error).message},400)}
 const metadata=parseJson<PhotoMetadata[]>(form.get('metadata'),[]),normalized=files.map((_,i)=>normalizeMeta(metadata[i]));
 const ranked=[...normalized].sort((a,b)=>(b.source==='exif'?2:b.source==='file_fallback'?1:0)-(a.source==='exif'?2:a.source==='file_fallback'?1:0));
 const best=ranked[0]??normalizeMeta(undefined),tastingDate=best.capturedAt?.slice(0,10)??null;
 const context=[best.capturedAt?`The strongest photo timestamp is ${best.capturedAt}.`:'No reliable photo timestamp.',best.latitude!=null&&best.longitude!=null?`The strongest photo GPS is ${best.latitude}, ${best.longitude}. Infer a concise human-readable location only if reasonably confident.`:'No reliable GPS metadata.'].join(' ');
 try{
  // Shadowed: entry.ts answers /api/recognition through the shared transport and
  // never delegates here. Kept because deleting a route is not this change's job,
  // but it now says what it would need rather than sending an undefined key and
  // failing as an unreadable 401.
  if(!c.env.GEMINI_API_KEY?.trim())return c.json({error:'This path needs GEMINI_API_KEY; recognition runs through AI Gateway instead.'},501);
  const genAI=new GoogleGenerativeAI(c.env.GEMINI_API_KEY);
  const model=genAI.getGenerativeModel({model:'gemini-3.1-flash-lite',generationConfig:{responseMimeType:'application/json',responseSchema:{type:SchemaType.OBJECT,properties:{producer:{type:SchemaType.STRING,nullable:true},wineName:{type:SchemaType.STRING,nullable:true},vintage:{type:SchemaType.NUMBER,nullable:true},country:{type:SchemaType.STRING,nullable:true},region:{type:SchemaType.STRING,nullable:true},appellation:{type:SchemaType.STRING,nullable:true},grapes:{type:SchemaType.ARRAY,items:{type:SchemaType.STRING}},grapeBlend:{type:SchemaType.ARRAY,items:{type:SchemaType.OBJECT,properties:{grape:{type:SchemaType.STRING},percentage:{type:SchemaType.NUMBER,nullable:true}},required:['grape']}},style:{type:SchemaType.STRING,nullable:true},alcoholPercentage:{type:SchemaType.NUMBER,nullable:true},locationName:{type:SchemaType.STRING,nullable:true},confidence:{type:SchemaType.NUMBER}},required:['grapes','grapeBlend','confidence']}}});
  const imageParts=await Promise.all(files.map(async file=>({inlineData:{data:await fileToBase64(file),mimeType:file.type}})));
  const prompt=`All supplied images are labels or views of the SAME wine bottle. Analyze them jointly in one identification. Reconcile front, back, neck and supplementary labels rather than treating them as separate wines. First prioritize facts visible anywhere in the supplied images. After identifying the bottle, you may fill high-confidence canonical facts from general wine knowledge even when not printed verbatim: country, region, appellation, grape varieties, and broad wine style. Use null or an empty array when not reasonably confident. For style, return only one of: red, white, rose, sparkling, dessert, fortified, orange, other. Capture grape blend percentages only when explicitly visible in the supplied images; never invent vintage-specific percentages. Keep plain grape names in grapes and percentages in grapeBlend. Do not add producer history, vintage quality, terroir commentary, winemaking techniques, drinking windows, tasting notes, scores, or detailed research here; those belong to Deep Search. Confidence is 0 to 1 and should reflect confidence in the bottle identification. ${context} Do not invent a tasting date; the application derives it from photo metadata.`;
  let last:Error|undefined;
  for(let attempt=0;attempt<2;attempt++){
   try{
    const timeout=new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('Recognition timed out')),25000));
    const response=await Promise.race([model.generateContent([prompt,...imageParts]),timeout]);
    const result=parseRecognition(response.response.text());
    return c.json({...result,tastingDate,latitude:best.latitude,longitude:best.longitude,metadataSource:best.source});
   }catch(e){last=e as Error;if(attempt===0)await new Promise(r=>setTimeout(r,500))}
  }
  throw last;
 }catch(e){return c.json({error:(e as Error).message||'Recognition failed'},502)}
});

app.all('*',c=>c.env.ASSETS.fetch(c.req.raw));
export default app;
