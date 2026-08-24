import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { createSession, requireSession } from '../src/lib/auth/session';
import { createObjectKey } from '../src/lib/r2/keys';
import { deepSearchSchema, wineInputSchema, type WineInput } from '../src/lib/db/schema';
import { dimensionsSchema, validateBatch } from '../src/features/uploads/validation';
import { parseRecognition } from '../src/features/recognition/schema';

type Bindings={DB:D1Database;WINE_IMAGES:R2Bucket;ASSETS:Fetcher;GEMINI_API_KEY:string;AUTH_SECRET:string;APP_PASSWORD:string;APP_URL:string;MAX_FILE_BYTES?:string;MAX_BATCH_FILES?:string};
type Variables={userId:string};
type AppContext={Bindings:Bindings;Variables:Variables};
type PhotoMetadata={capturedAt?:string|null;latitude?:number|null;longitude?:number|null;source?:'exif'|'file_fallback'|'none'};

const app=new Hono<AppContext>();
app.use('/api/*',cors({origin:(origin,c)=>origin===c.env.APP_URL?origin:null,credentials:true}));
app.use('/api/*',async(c,next)=>{
 if(c.req.path==='/api/auth/login')return next();
 try{const s=await requireSession(c.req.header('Authorization'),c.env.AUTH_SECRET);c.set('userId',s.userId);await next()}catch{return c.json({error:'Unauthorized'},401)}
});

async function sameSecret(a:string,b:string){
 const enc=new TextEncoder(),[ah,bh]=await Promise.all([crypto.subtle.digest('SHA-256',enc.encode(a)),crypto.subtle.digest('SHA-256',enc.encode(b))]);
 const av=new Uint8Array(ah),bv=new Uint8Array(bh);let diff=0;for(let i=0;i<av.length;i++)diff|=av[i]^bv[i];return diff===0;
}
app.post('/api/auth/login',async c=>{
 c.header('Cache-Control','no-store');
 const body=await c.req.json().catch(()=>({})) as {password?:unknown};
 const password=typeof body.password==='string'?body.password:'';
 if(!password||!c.env.APP_PASSWORD||!(await sameSecret(password,c.env.APP_PASSWORD))){await new Promise(r=>setTimeout(r,400));return c.json({error:'Invalid password'},401)}
 const token=await createSession('owner',c.env.AUTH_SECRET);
 return c.json({token});
});

const parseJson=<T>(value:unknown,fallback:T):T=>{try{return JSON.parse(String(value)) as T}catch{return fallback}};
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

const mapWine=(r:Record<string,unknown>,imageIds:string[]=[])=>({
 id:r.id,ownerId:r.owner_id,producer:r.producer,wineName:r.wine_name,vintage:r.vintage,country:r.country,region:r.region,appellation:r.appellation,
 grapes:parseJson<string[]>(r.grapes_json,[]),grapeBlend:parseJson<Array<{grape:string;percentage?:number|null}>>(r.grape_blend_json,[]),wineStyle:r.wine_style,alcoholPercentage:r.alcohol_percentage,
 tastingNotes:r.experience_notes??r.tasting_notes,rating:r.experience_rating??r.rating,tastingDate:r.experience_date??r.tasting_date,event:r.event,venue:r.venue,
 tastingName:r.tasting_name,locationName:r.location_name,latitude:r.latitude,longitude:r.longitude,
 producerId:r.producer_id??null,favorite:Boolean(r.favorite),
 deepSearch:r.deep_search_json?parseJson(r.deep_search_json,null):null,
 price:r.price,currency:r.currency,tags:parseJson<string[]>(r.tags_json,[]),imageIds,imageObjectKeys:[],recognitionStatus:r.recognition_status,recognitionConfidence:r.recognition_confidence,
 createdAt:r.created_at,updatedAt:r.updated_at
});

async function mapWinesWithImages(db:D1Database,owner:string,rows:Record<string,unknown>[]){
 if(!rows.length)return [];
 const wineIds=rows.map(r=>String(r.id)),placeholders=wineIds.map(()=>'?').join(',');
 const images=await db.prepare(`SELECT id,wine_id FROM wine_images WHERE owner_id=? AND wine_id IN (${placeholders}) ORDER BY rowid ASC`).bind(owner,...wineIds).all<{id:string;wine_id:string}>();
 const byWine=new Map<string,string[]>();
 for(const image of images.results){const list=byWine.get(image.wine_id)??[];list.push(image.id);byWine.set(image.wine_id,list)}
 return rows.map(row=>mapWine(row,byWine.get(String(row.id))??[]));
}

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
 const items=await mapWinesWithImages(c.env.DB,owner,rows.results as Record<string,unknown>[]);
 return c.json({items,nextOffset:rows.results.length===limit?offset+limit:null});
});

app.get('/api/wines/:id',async c=>{
 const id=c.req.param('id'),owner=c.get('userId');
 const [row,images]=await Promise.all([
  c.env.DB.prepare(`${wineSelect} WHERE w.id=? AND w.owner_id=?`).bind(id,owner).first(),
  c.env.DB.prepare('SELECT id FROM wine_images WHERE wine_id=? AND owner_id=? ORDER BY rowid ASC').bind(id,owner).all<{id:string}>()
 ]);
 return row?c.json(mapWine(row as Record<string,unknown>,images.results.map(x=>x.id))):c.json({error:'Not found'},404)
});

app.post('/api/wines/:id/deep-search',async c=>{
 const body=await c.req.json().catch(()=>({})) as {confirmation?:string};
 if(body.confirmation!=='RUN_DEEP_SEARCH')return c.json({error:'Deep Search requires explicit confirmation'},400);
 const owner=c.get('userId'),id=c.req.param('id');
 const wine=await c.env.DB.prepare('SELECT producer,wine_name,vintage,country,region,appellation,grapes_json,grape_blend_json FROM wines WHERE id=? AND owner_id=?').bind(id,owner).first<Record<string,unknown>>();
 if(!wine)return c.json({error:'Not found'},404);
 const grapes=parseJson<string[]>(wine.grapes_json,[]),blend=parseJson<Array<{grape:string;percentage?:number|null}>>(wine.grape_blend_json,[]);
 const identity=[wine.producer,wine.wine_name,wine.vintage,wine.appellation,wine.region,wine.country].filter(Boolean).join(' | ');
 const prompt=`Research this exact wine using reliable public web sources and distinguish producer facts from vintage-specific facts. Wine: ${identity}. Grapes: ${grapes.join(', ')}. Known blend: ${blend.map(x=>`${x.grape}${x.percentage!=null?` ${x.percentage}%`:''}`).join(', ')||'unknown'}. Return JSON only with these string fields: summary, vintageQuality, producerDetails, winemakingTechniques, terroir, drinkingWindow. Be cautious: if a vintage-specific technique or blend cannot be verified, say so rather than generalizing from another vintage. Focus on factual producer history, vineyard/terroir, vintage conditions and quality, élevage/fermentation/vinification, and likely drinking window.`;
 const requestBody=JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],tools:[{google_search:{}}],generationConfig:{responseMimeType:'application/json',responseSchema:{type:'OBJECT',properties:{summary:{type:'STRING'},vintageQuality:{type:'STRING'},producerDetails:{type:'STRING'},winemakingTechniques:{type:'STRING'},terroir:{type:'STRING'},drinkingWindow:{type:'STRING'}},required:['summary','vintageQuality','producerDetails','winemakingTechniques','terroir','drinkingWindow']}}});
 let lastError='Deep Search failed';
 for(let attempt=0;attempt<2;attempt++){
  try{
   const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${encodeURIComponent(c.env.GEMINI_API_KEY)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:requestBody});
   if(!response.ok){
    lastError=`Deep Search failed (${response.status})`;
    if(attempt===0&&(response.status===429||response.status>=500)){await new Promise(r=>setTimeout(r,900));continue}
    return c.json({error:lastError},502);
   }
   const gemini=await response.json() as {candidates?:Array<{content?:{parts?:Array<{text?:string}>};groundingMetadata?:{groundingChunks?:Array<{web?:{title?:string;uri?:string}}>} }>};
   const candidate=gemini.candidates?.[0],text=candidate?.content?.parts?.map(x=>x.text??'').join('')??'';
   const cleaned=text.replace(/^```(?:json)?\s*|\s*```$/g,'');
   let research:Record<string,unknown>;try{research=JSON.parse(cleaned) as Record<string,unknown>}catch{throw new Error('Deep Search returned an invalid structured response')}
   const seen=new Set<string>(),sources=(candidate?.groundingMetadata?.groundingChunks??[]).flatMap(x=>x.web?.uri?[{title:x.web.title??x.web.uri,url:x.web.uri}]:[]).filter(x=>{if(seen.has(x.url))return false;seen.add(x.url);return true}).slice(0,20);
   const parsed=deepSearchSchema.safeParse({...research,sources,model:'gemini-3.6-flash',researchedAt:new Date().toISOString()});
   if(!parsed.success)throw new Error(`Deep Search returned invalid fields: ${parsed.error.issues.map(x=>x.path.join('.')||x.message).join(', ')}`);
   const result=parsed.data;
   await c.env.DB.prepare('UPDATE wines SET deep_search_json=?,deep_search_model=?,deep_search_updated_at=?,updated_at=? WHERE id=? AND owner_id=?').bind(JSON.stringify(result),result.model,result.researchedAt,new Date().toISOString(),id,owner).run();
   return c.json(result);
  }catch(e){
   lastError=(e as Error).message||'Deep Search failed';
   if(attempt===0){await new Promise(r=>setTimeout(r,900));continue}
  }
 }
 return c.json({error:lastError},502);
});

app.post('/api/wines',async c=>{
 const owner=c.get('userId'),id=crypto.randomUUID(),now=new Date().toISOString();
 const multipart=(c.req.header('Content-Type')||'').includes('multipart/form-data');
 if(!multipart){
  const parsed=wineInputSchema.safeParse(await c.req.json());if(!parsed.success)return c.json({error:'Invalid wine',issues:parsed.error.issues},400);
  const w=parsed.data;
  await c.env.DB.prepare(`INSERT INTO wines(id,owner_id,producer,wine_name,vintage,country,region,appellation,grapes_json,grape_blend_json,wine_style,alcohol_percentage,tasting_notes,rating,tasting_date,event,venue,price,currency,tags_json,recognition_status,recognition_confidence,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,owner,w.producer,w.wineName,w.vintage,w.country,w.region,w.appellation,JSON.stringify(w.grapes),JSON.stringify(w.grapeBlend),w.wineStyle,w.alcoholPercentage,w.tastingNotes,w.rating,w.tastingDate,w.event,w.venue,w.price,w.currency,JSON.stringify(w.tags),w.recognitionStatus,w.recognitionConfidence,now,now).run();
  await saveExperience(c.env.DB,owner,id,w);return c.json({id},201);
 }
 const form=await c.req.formData();
 const parsed=wineInputSchema.safeParse(parseJson(form.get('wine'),null));if(!parsed.success)return c.json({error:'Invalid wine',issues:parsed.error.issues},400);
 const w=parsed.data,files=form.getAll('images').filter((x):x is File=>x instanceof File);
 try{validateBatch(files,{maxFiles:Number(c.env.MAX_BATCH_FILES)||12,maxBytes:Number(c.env.MAX_FILE_BYTES)||10485760,minDimension:300,maxDimension:12000})}catch(e){return c.json({error:(e as Error).message},400)}
 const dimensions=parseJson<unknown[]>(form.get('dimensions'),[]),metadata=parseJson<PhotoMetadata[]>(form.get('metadata'),[]);
 if(dimensions.length!==files.length||metadata.length!==files.length)return c.json({error:'Dimensions and metadata are required for every saved photo'},400);
 const uploaded:Array<{key:string;imageId:string;file:File;dim:{width:number;height:number};meta:ReturnType<typeof normalizeMeta>}>=[];
 try{
  for(let i=0;i<files.length;i++){
   const dim=dimensionsSchema.parse(dimensions[i]),meta=normalizeMeta(metadata[i]),file=files[i],key=createObjectKey(owner,file.type),imageId=crypto.randomUUID();
   await c.env.WINE_IMAGES.put(key,file.stream(),{httpMetadata:{contentType:file.type},customMetadata:{ownerId:owner,wineId:id}});
   uploaded.push({key,imageId,file,dim,meta});
  }
  const statements=[c.env.DB.prepare(`INSERT INTO wines(id,owner_id,producer,wine_name,vintage,country,region,appellation,grapes_json,grape_blend_json,wine_style,alcohol_percentage,tasting_notes,rating,tasting_date,event,venue,price,currency,tags_json,recognition_status,recognition_confidence,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,owner,w.producer,w.wineName,w.vintage,w.country,w.region,w.appellation,JSON.stringify(w.grapes),JSON.stringify(w.grapeBlend),w.wineStyle,w.alcoholPercentage,w.tastingNotes,w.rating,w.tastingDate,w.event,w.venue,w.price,w.currency,JSON.stringify(w.tags),w.recognitionStatus,w.recognitionConfidence,now,now),...uploaded.map(x=>c.env.DB.prepare(`INSERT INTO wine_images(id,owner_id,wine_id,object_key,content_type,byte_size,width,height,upload_status,recognition_status,captured_at,latitude,longitude,location_name,metadata_source,created_at) VALUES(?,?,?,?,?,?,?,?,'uploaded','complete',?,?,?,?,?,?)`).bind(x.imageId,owner,id,x.key,x.file.type,x.file.size,x.dim.width,x.dim.height,x.meta.capturedAt,x.meta.latitude,x.meta.longitude,w.locationName??null,x.meta.source,now))];
  await c.env.DB.batch(statements);
  await saveExperience(c.env.DB,owner,id,w);
  return c.json({id},201);
 }catch(e){
  try{await c.env.DB.batch([c.env.DB.prepare('DELETE FROM wine_images WHERE wine_id=? AND owner_id=?').bind(id,owner),c.env.DB.prepare('DELETE FROM wines WHERE id=? AND owner_id=?').bind(id,owner)])}catch{}
  await Promise.allSettled(uploaded.map(x=>c.env.WINE_IMAGES.delete(x.key)));
  return c.json({error:(e as Error).message||'Could not save wine and photos'},500);
 }
});

app.put('/api/wines/:id',async c=>{
 const parsed=wineInputSchema.safeParse(await c.req.json());if(!parsed.success)return c.json({error:'Invalid wine',issues:parsed.error.issues},400);
 const x=parsed.data,id=c.req.param('id'),owner=c.get('userId');
 const res=await c.env.DB.prepare(`UPDATE wines SET producer=?,wine_name=?,vintage=?,country=?,region=?,appellation=?,grapes_json=?,grape_blend_json=?,wine_style=?,alcohol_percentage=?,tasting_notes=?,rating=?,tasting_date=?,event=?,venue=?,price=?,currency=?,tags_json=?,recognition_status=?,recognition_confidence=?,updated_at=? WHERE id=? AND owner_id=?`).bind(x.producer,x.wineName,x.vintage,x.country,x.region,x.appellation,JSON.stringify(x.grapes),JSON.stringify(x.grapeBlend),x.wineStyle,x.alcoholPercentage,x.tastingNotes,x.rating,x.tastingDate,x.event,x.venue,x.price,x.currency,JSON.stringify(x.tags),x.recognitionStatus,x.recognitionConfidence,new Date().toISOString(),id,owner).run();
 if(!res.meta.changes)return c.json({error:'Not found'},404);
 await saveExperience(c.env.DB,owner,id,x,true);
 return c.json({ok:true});
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
  await Promise.allSettled(images.results.map(image=>c.env.WINE_IMAGES.delete(image.object_key)));
 }
 return c.body(null,204);
});

app.get('/api/images/:id',async c=>{const row=await c.env.DB.prepare('SELECT object_key FROM wine_images WHERE id=? AND owner_id=?').bind(c.req.param('id'),c.get('userId')).first<{object_key:string}>();if(!row)return c.json({error:'Not found'},404);const obj=await c.env.WINE_IMAGES.get(row.object_key);if(!obj)return c.json({error:'Not found'},404);return new Response(obj.body,{headers:{'Content-Type':obj.httpMetadata?.contentType||'application/octet-stream','Cache-Control':'private, max-age=300','Content-Security-Policy':"default-src 'none'"}})});

app.post('/api/recognition',async c=>{
 const form=await c.req.formData(),files=form.getAll('images').filter((x):x is File=>x instanceof File);
 try{validateBatch(files,{maxFiles:Number(c.env.MAX_BATCH_FILES)||12,maxBytes:3*1024*1024,minDimension:300,maxDimension:2000})}catch(e){return c.json({error:(e as Error).message},400)}
 const metadata=parseJson<PhotoMetadata[]>(form.get('metadata'),[]),normalized=files.map((_,i)=>normalizeMeta(metadata[i]));
 const ranked=[...normalized].sort((a,b)=>(b.source==='exif'?2:b.source==='file_fallback'?1:0)-(a.source==='exif'?2:a.source==='file_fallback'?1:0));
 const best=ranked[0]??normalizeMeta(undefined),tastingDate=best.capturedAt?.slice(0,10)??null;
 const context=[best.capturedAt?`The strongest photo timestamp is ${best.capturedAt}.`:'No reliable photo timestamp.',best.latitude!=null&&best.longitude!=null?`The strongest photo GPS is ${best.latitude}, ${best.longitude}. Infer a concise human-readable location only if reasonably confident.`:'No reliable GPS metadata.'].join(' ');
 try{
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