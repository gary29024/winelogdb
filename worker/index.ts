import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { requireSession } from '../src/lib/auth/session';
import { createObjectKey } from '../src/lib/r2/keys';
import { wineInputSchema, type WineInput } from '../src/lib/db/schema';
import { dimensionsSchema, validateBatch } from '../src/features/uploads/validation';
import { parseRecognition } from '../src/features/recognition/schema';

type Bindings={DB:D1Database;WINE_IMAGES:R2Bucket;ASSETS:Fetcher;GEMINI_API_KEY:string;AUTH_SECRET:string;APP_URL:string;MAX_FILE_BYTES?:string;MAX_BATCH_FILES?:string};
type Variables={userId:string};
type AppContext={Bindings:Bindings;Variables:Variables};
type PhotoMetadata={capturedAt?:string|null;latitude?:number|null;longitude?:number|null;source?:'exif'|'file_fallback'|'none'};

const app=new Hono<AppContext>();
app.use('/api/*',cors({origin:(origin,c)=>origin===c.env.APP_URL?origin:null,credentials:true}));
app.use('/api/*',async(c,next)=>{try{const s=await requireSession(c.req.header('Authorization'),c.env.AUTH_SECRET);c.set('userId',s.userId);await next();}catch{return c.json({error:'Unauthorized'},401)}});

const wineSelect=`SELECT w.*,
 (SELECT t.name FROM wine_experiences we LEFT JOIN tastings t ON t.id=we.tasting_id WHERE we.wine_id=w.id AND we.owner_id=w.owner_id ORDER BY we.created_at DESC LIMIT 1) AS tasting_name,
 (SELECT we.consumed_at FROM wine_experiences we WHERE we.wine_id=w.id AND we.owner_id=w.owner_id ORDER BY we.created_at DESC LIMIT 1) AS experience_date,
 (SELECT we.location_name FROM wine_experiences we WHERE we.wine_id=w.id AND we.owner_id=w.owner_id ORDER BY we.created_at DESC LIMIT 1) AS location_name,
 (SELECT we.latitude FROM wine_experiences we WHERE we.wine_id=w.id AND we.owner_id=w.owner_id ORDER BY we.created_at DESC LIMIT 1) AS latitude,
 (SELECT we.longitude FROM wine_experiences we WHERE we.wine_id=w.id AND we.owner_id=w.owner_id ORDER BY we.created_at DESC LIMIT 1) AS longitude,
 (SELECT we.rating FROM wine_experiences we WHERE we.wine_id=w.id AND we.owner_id=w.owner_id ORDER BY we.created_at DESC LIMIT 1) AS experience_rating,
 (SELECT we.tasting_notes FROM wine_experiences we WHERE we.wine_id=w.id AND we.owner_id=w.owner_id ORDER BY we.created_at DESC LIMIT 1) AS experience_notes
 FROM wines w`;

const mapWine=(r:Record<string,unknown>)=>({
 id:r.id,ownerId:r.owner_id,producer:r.producer,wineName:r.wine_name,vintage:r.vintage,country:r.country,region:r.region,appellation:r.appellation,
 grapes:JSON.parse(String(r.grapes_json)),wineStyle:r.wine_style,alcoholPercentage:r.alcohol_percentage,
 tastingNotes:r.experience_notes??r.tasting_notes,rating:r.experience_rating??r.rating,tastingDate:r.experience_date??r.tasting_date,event:r.event,venue:r.venue,
 tastingName:r.tasting_name,locationName:r.location_name,latitude:r.latitude,longitude:r.longitude,
 price:r.price,currency:r.currency,tags:JSON.parse(String(r.tags_json)),imageObjectKeys:[],recognitionStatus:r.recognition_status,recognitionConfidence:r.recognition_confidence,
 createdAt:r.created_at,updatedAt:r.updated_at
});

async function resolveTasting(db:D1Database,owner:string,w:WineInput){
 if(!w.tastingName?.trim())return null;
 const name=w.tastingName.trim(),date=w.tastingDate??null;
 const existing=await db.prepare("SELECT id FROM tastings WHERE owner_id=? AND name=? AND coalesce(tasting_date,'')=coalesce(?,'')").bind(owner,name,date).first<{id:string}>();
 if(existing?.id)return existing.id;
 const id=crypto.randomUUID(),now=new Date().toISOString();
 await db.prepare('INSERT INTO tastings(id,owner_id,name,tasting_date,venue,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(id,owner,name,date,w.venue??null,now,now).run();
 return id;
}

function hasExperience(w:WineInput){return Boolean(w.tastingName||w.tastingDate||w.venue||w.locationName||w.latitude!=null||w.longitude!=null||w.rating!=null||w.tastingNotes)}

async function saveExperience(db:D1Database,owner:string,wineId:string,w:WineInput,updateExisting=false){
 if(!hasExperience(w))return;
 const tastingId=await resolveTasting(db,owner,w),now=new Date().toISOString();
 if(updateExisting){
  const existing=await db.prepare('SELECT id FROM wine_experiences WHERE owner_id=? AND wine_id=? ORDER BY created_at DESC LIMIT 1').bind(owner,wineId).first<{id:string}>();
  if(existing?.id){
   await db.prepare('UPDATE wine_experiences SET tasting_id=?,consumed_at=?,latitude=?,longitude=?,location_name=?,rating=?,tasting_notes=?,updated_at=? WHERE id=? AND owner_id=?').bind(tastingId,w.tastingDate??null,w.latitude??null,w.longitude??null,w.locationName??w.venue??null,w.rating??null,w.tastingNotes??'',now,existing.id,owner).run();
   return;
  }
 }
 await db.prepare('INSERT INTO wine_experiences(id,owner_id,wine_id,tasting_id,consumed_at,latitude,longitude,location_name,rating,tasting_notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),owner,wineId,tastingId,w.tastingDate??null,w.latitude??null,w.longitude??null,w.locationName??w.venue??null,w.rating??null,w.tastingNotes??'',now,now).run();
}

app.get('/api/wines',async c=>{
 const q=c.req.query(),owner=c.get('userId'),args:unknown[]=[owner];let where='w.owner_id=?';
 const filters:[string,string][]=[['vintage','w.vintage'],['country','w.country'],['region','w.region'],['style','w.wine_style'],['tastingDate','w.tasting_date']];
 for(const [key,col] of filters)if(q[key]){where+=` AND ${col}=?`;args.push(q[key])}
 if(q.rating){where+=' AND w.rating>=?';args.push(Number(q.rating))}
 if(q.grape){where+=' AND EXISTS (SELECT 1 FROM json_each(w.grapes_json) WHERE value=?)';args.push(q.grape)}
 if(q.tasting){where+=' AND EXISTS (SELECT 1 FROM wine_experiences we JOIN tastings t ON t.id=we.tasting_id WHERE we.wine_id=w.id AND we.owner_id=? AND lower(t.name) LIKE lower(?))';args.push(owner,`%${q.tasting}%`)}
 if(q.query){const clean=q.query.replace(/[^\p{L}\p{N}\s]/gu,' ').trim();if(clean){where+=' AND (w.id IN (SELECT wine_id FROM wine_search WHERE wine_search MATCH ? AND owner_id=?) OR EXISTS (SELECT 1 FROM wine_experiences we JOIN tastings t ON t.id=we.tasting_id WHERE we.wine_id=w.id AND we.owner_id=? AND lower(t.name) LIKE lower(?)))';args.push(clean+'*',owner,owner,`%${q.query}%`)}}
 const orders:Record<string,string>={newest:'w.created_at DESC',oldest:'w.created_at ASC',rating:'w.rating DESC',producer:'w.producer COLLATE NOCASE',vintage:'w.vintage DESC'};
 const limit=Math.min(Number(q.limit)||24,100),offset=Math.max(Number(q.offset)||0,0);args.push(limit,offset);
 const rows=await c.env.DB.prepare(`${wineSelect} WHERE ${where} ORDER BY ${orders[q.sort]||orders.newest} LIMIT ? OFFSET ?`).bind(...args).all();
 return c.json({items:rows.results.map(r=>mapWine(r as Record<string,unknown>)),nextOffset:rows.results.length===limit?offset+limit:null});
});

app.get('/api/wines/:id',async c=>{const row=await c.env.DB.prepare(`${wineSelect} WHERE w.id=? AND w.owner_id=?`).bind(c.req.param('id'),c.get('userId')).first();return row?c.json(mapWine(row)):c.json({error:'Not found'},404)});

app.post('/api/wines',async c=>{
 const parsed=wineInputSchema.safeParse(await c.req.json());if(!parsed.success)return c.json({error:'Invalid wine',issues:parsed.error.issues},400);
 const w=parsed.data,id=crypto.randomUUID(),owner=c.get('userId'),now=new Date().toISOString();
 await c.env.DB.prepare(`INSERT INTO wines(id,owner_id,producer,wine_name,vintage,country,region,appellation,grapes_json,wine_style,alcohol_percentage,tasting_notes,rating,tasting_date,event,venue,price,currency,tags_json,recognition_status,recognition_confidence,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,owner,w.producer,w.wineName,w.vintage,w.country,w.region,w.appellation,JSON.stringify(w.grapes),w.wineStyle,w.alcoholPercentage,w.tastingNotes,w.rating,w.tastingDate,w.event,w.venue,w.price,w.currency,JSON.stringify(w.tags),w.recognitionStatus,w.recognitionConfidence,now,now).run();
 await saveExperience(c.env.DB,owner,id,w);
 return c.json({id},201);
});

app.put('/api/wines/:id',async c=>{
 const parsed=wineInputSchema.safeParse(await c.req.json());if(!parsed.success)return c.json({error:'Invalid wine',issues:parsed.error.issues},400);
 const x=parsed.data,id=c.req.param('id'),owner=c.get('userId');
 const res=await c.env.DB.prepare(`UPDATE wines SET producer=?,wine_name=?,vintage=?,country=?,region=?,appellation=?,grapes_json=?,wine_style=?,alcohol_percentage=?,tasting_notes=?,rating=?,tasting_date=?,event=?,venue=?,price=?,currency=?,tags_json=?,recognition_status=?,recognition_confidence=?,updated_at=? WHERE id=? AND owner_id=?`).bind(x.producer,x.wineName,x.vintage,x.country,x.region,x.appellation,JSON.stringify(x.grapes),x.wineStyle,x.alcoholPercentage,x.tastingNotes,x.rating,x.tastingDate,x.event,x.venue,x.price,x.currency,JSON.stringify(x.tags),x.recognitionStatus,x.recognitionConfidence,new Date().toISOString(),id,owner).run();
 if(!res.meta.changes)return c.json({error:'Not found'},404);
 await saveExperience(c.env.DB,owner,id,x,true);
 return c.json({ok:true});
});

app.delete('/api/wines/:id',async c=>{const id=c.req.param('id'),owner=c.get('userId');const images=await c.env.DB.prepare('SELECT object_key FROM wine_images WHERE wine_id=? AND owner_id=?').bind(id,owner).all<{object_key:string}>();const deleted=await c.env.DB.prepare('DELETE FROM wines WHERE id=? AND owner_id=?').bind(id,owner).run();if(!deleted.meta.changes)return c.json({error:'Not found'},404);for(const image of images.results){const refs=await c.env.DB.prepare('SELECT COUNT(*) n FROM wine_images WHERE object_key=? AND wine_id IS NOT NULL').bind(image.object_key).first<{n:number}>();if(!refs?.n){await c.env.WINE_IMAGES.delete(image.object_key);await c.env.DB.prepare('DELETE FROM wine_images WHERE object_key=? AND wine_id IS NULL').bind(image.object_key).run()}}return c.body(null,204)});

app.post('/api/uploads',async c=>{
 const form=await c.req.formData(),files=form.getAll('images').filter((x):x is File=>x instanceof File);
 try{validateBatch(files,{maxFiles:Number(c.env.MAX_BATCH_FILES)||12,maxBytes:Number(c.env.MAX_FILE_BYTES)||10485760,minDimension:300,maxDimension:12000})}catch(e){return c.json({error:(e as Error).message},400)}
 const dimensions=JSON.parse(String(form.get('dimensions')||'[]')) as unknown[],metadata=JSON.parse(String(form.get('metadata')||'[]')) as PhotoMetadata[];
 if(dimensions.length!==files.length)return c.json({error:'Dimensions required for every image'},400);
 const results=[];
 for(let i=0;i<files.length;i++){
  const dim=dimensionsSchema.safeParse(dimensions[i]);if(!dim.success){results.push({name:files[i].name,status:'failed',error:'Invalid image dimensions'});continue}
  const meta=metadata[i]??{},lat=typeof meta.latitude==='number'&&meta.latitude>=-90&&meta.latitude<=90?meta.latitude:null,lon=typeof meta.longitude==='number'&&meta.longitude>=-180&&meta.longitude<=180?meta.longitude:null;
  const capturedAt=typeof meta.capturedAt==='string'&&!Number.isNaN(Date.parse(meta.capturedAt))?new Date(meta.capturedAt).toISOString():null;
  const source=['exif','file_fallback'].includes(String(meta.source))?String(meta.source):'none';
  const file=files[i],key=createObjectKey(c.get('userId'),file.type),imageId=crypto.randomUUID();
  try{
   await c.env.WINE_IMAGES.put(key,file.stream(),{httpMetadata:{contentType:file.type},customMetadata:{ownerId:c.get('userId')}});
   await c.env.DB.prepare(`INSERT INTO wine_images(id,owner_id,object_key,content_type,byte_size,width,height,upload_status,captured_at,latitude,longitude,metadata_source,created_at) VALUES(?,?,?,?,?,?,?,'uploaded',?,?,?,?,?)`).bind(imageId,c.get('userId'),key,file.type,file.size,dim.data.width,dim.data.height,capturedAt,lat,lon,source,new Date().toISOString()).run();
   results.push({id:imageId,name:file.name,status:'uploaded',objectKey:key});
  }catch(e){await c.env.WINE_IMAGES.delete(key);results.push({name:file.name,status:'failed',error:(e as Error).message})}
 }
 return c.json({results},207);
});

app.get('/api/images/:id',async c=>{const row=await c.env.DB.prepare('SELECT object_key FROM wine_images WHERE id=? AND owner_id=?').bind(c.req.param('id'),c.get('userId')).first<{object_key:string}>();if(!row)return c.json({error:'Not found'},404);const obj=await c.env.WINE_IMAGES.get(row.object_key);if(!obj)return c.json({error:'Not found'},404);return new Response(obj.body,{headers:{'Content-Type':obj.httpMetadata?.contentType||'application/octet-stream','Cache-Control':'private, max-age=300','Content-Security-Policy':"default-src 'none'"}})});

app.post('/api/recognition/:id',async c=>{
 const image=await c.env.DB.prepare('SELECT * FROM wine_images WHERE id=? AND owner_id=?').bind(c.req.param('id'),c.get('userId')).first<Record<string,unknown>>();if(!image)return c.json({error:'Not found'},404);
 await c.env.DB.prepare("UPDATE wine_images SET recognition_status='processing',error=NULL WHERE id=?").bind(image.id).run();
 try{
  const obj=await c.env.WINE_IMAGES.get(String(image.object_key));if(!obj)throw new Error('Image missing');
  const bytes=new Uint8Array(await obj.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
  const capturedAt=typeof image.captured_at==='string'?image.captured_at:null,tastingDate=capturedAt?capturedAt.slice(0,10):null;
  const latitude=typeof image.latitude==='number'?image.latitude:null,longitude=typeof image.longitude==='number'?image.longitude:null;
  const context=[capturedAt?`Photo captured at ${capturedAt}.`:'No reliable photo timestamp.',latitude!=null&&longitude!=null?`Photo GPS is ${latitude}, ${longitude}. Infer a concise human-readable location only if reasonably confident.`:'No GPS metadata.'].join(' ');
  const genAI=new GoogleGenerativeAI(c.env.GEMINI_API_KEY);
  const model=genAI.getGenerativeModel({model:'gemini-2.5-flash',generationConfig:{responseMimeType:'application/json',responseSchema:{type:SchemaType.OBJECT,properties:{producer:{type:SchemaType.STRING,nullable:true},wineName:{type:SchemaType.STRING,nullable:true},vintage:{type:SchemaType.NUMBER,nullable:true},country:{type:SchemaType.STRING,nullable:true},region:{type:SchemaType.STRING,nullable:true},appellation:{type:SchemaType.STRING,nullable:true},grapes:{type:SchemaType.ARRAY,items:{type:SchemaType.STRING}},style:{type:SchemaType.STRING,nullable:true},alcoholPercentage:{type:SchemaType.NUMBER,nullable:true},locationName:{type:SchemaType.STRING,nullable:true},confidence:{type:SchemaType.NUMBER}},required:['grapes','confidence']}}});
  let last:Error|undefined;
  for(let attempt=0;attempt<3;attempt++){
   try{
    const timeout=new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('Recognition timed out')),20000));
    const response=await Promise.race([model.generateContent([`Extract the wine label fields. Use null when unknown. Confidence is 0 to 1. ${context} Do not invent a tasting date; the application derives it from photo metadata.`,{inlineData:{data:btoa(binary),mimeType:String(image.content_type)}}]),timeout]);
    const result=parseRecognition(response.response.text());
    await c.env.DB.prepare("UPDATE wine_images SET recognition_status='review',location_name=? WHERE id=?").bind(result.locationName??null,image.id).run();
    return c.json({...result,tastingDate,latitude,longitude,metadataSource:(image.metadata_source||'none') as string});
   }catch(e){last=e as Error;if(attempt<2)await new Promise(r=>setTimeout(r,500*2**attempt))}
  }
  throw last;
 }catch(e){await c.env.DB.prepare("UPDATE wine_images SET recognition_status='failed',error=? WHERE id=?").bind((e as Error).message,image.id).run();return c.json({error:(e as Error).message},502)}
});

app.all('*',c=>c.env.ASSETS.fetch(c.req.raw));
export default app;
