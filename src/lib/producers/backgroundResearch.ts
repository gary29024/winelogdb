import { createObjectKey } from '../r2/keys';
import { extractContactGrounding,normalizeProducerEmail,normalizeProducerPhone,safeInstagramUrl } from './research';
import { mapProducerRow } from './entities';

type Env={DB:D1Database;WINE_IMAGES:R2Bucket;GEMINI_API_KEY:string};
type ResearchSource={title:string;url:string};
type CatalogCategory='red'|'white'|'rose'|'sparkling'|'dessert'|'fortified'|'orange'|'other';
type ProfileResult={
  homeCountry:string;homeRegion:string;homeLocality:string;officialWebsiteUrl:string|null;instagramUrl:string|null;
  contactEmail:string|null;contactPhone:string|null;profile:string;winemakingPractices:string;
};
type CatalogWine={name:string;category:CatalogCategory;appellation?:string|null;classification?:string|null;style?:string|null;notes?:string|null};
type CatalogResult={range:CatalogWine[]};
type GroundingMetadata={groundingChunks?:Array<{web?:{title?:string;uri?:string}}> ;groundingSupports?:Array<{segment?:{startIndex?:number;endIndex?:number;text?:string};groundingChunkIndices?:number[]}>};
type GeminiResponse={candidates?:Array<{content?:{parts?:Array<{text?:string}>};groundingMetadata?:GroundingMetadata}>;usageMetadata?:Record<string,unknown>;error?:{message?:string}};

type Phase='profile'|'catalog';
const CATEGORIES=new Set<CatalogCategory>(['red','white','rose','sparkling','dessert','fortified','orange','other']);
const MODEL_PRIMARY='gemini-3.7-flash';
const MODEL_FALLBACK='gemini-3.6-flash';
const PROFILE_TIMEOUTS=[180_000,90_000] as const;
const CATALOG_TIMEOUTS=[300_000,120_000] as const;
const PAGE_TIMEOUT_MS=8_000,IMAGE_TIMEOUT_MS=10_000,MAX_PAGE_BYTES=384*1024,MAX_HERO_BYTES=5*1024*1024;
const now=()=>new Date().toISOString();
const parseJson=<T>(value:unknown,fallback:T):T=>{try{return JSON.parse(String(value)) as T}catch{return fallback}};
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

function log(level:'log'|'warn'|'error',data:Record<string,unknown>){console[level](JSON.stringify({event:'producer_background_research',...data}))}
function safeHttpsUrl(value:unknown,base?:string){
  if(typeof value!=='string'||!value.trim())return null;
  try{const url=new URL(value.trim(),base),host=url.hostname.toLowerCase();if(url.protocol!=='https:'||url.username||url.password||!host||host==='localhost'||host.endsWith('.local')||host.endsWith('.internal')||/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)||host.includes(':'))return null;url.hash='';return url}catch{return null}
}
function sourcesFrom(metadata?:GroundingMetadata){
  const seen=new Set<string>(),sources:ResearchSource[]=[];
  for(const chunk of metadata?.groundingChunks??[]){const web=chunk.web,url=safeHttpsUrl(web?.uri)?.toString();if(!url||seen.has(url))continue;seen.add(url);sources.push({title:web?.title?.trim()||new URL(url).hostname,url});if(sources.length>=20)break}
  return sources;
}
function mergeSources(...lists:ResearchSource[][]){const seen=new Set<string>();return lists.flat().filter(x=>{if(!x.url||seen.has(x.url))return false;seen.add(x.url);return true}).slice(0,30)}
function cleanContactSources(value:unknown){
  if(!Array.isArray(value))return [] as ResearchSource[];const seen=new Set<string>(),out:ResearchSource[]=[];
  for(const x of value){if(!x||typeof x!=='object')continue;const item=x as {title?:unknown;url?:unknown},url=safeHttpsUrl(item.url)?.toString();if(!url||seen.has(url))continue;seen.add(url);out.push({title:typeof item.title==='string'&&item.title.trim()?item.title.trim():new URL(url).hostname,url})}
  return out.slice(0,10);
}

async function updateRun(db:D1Database,owner:string,requestId:string,stage:string,attempt:number,message:string,status:'running'|'complete'|'failed'='running'){
  const row=await db.prepare('SELECT started_at FROM producer_research_runs WHERE owner_id=? AND request_id=?').bind(owner,requestId).first<{started_at:string}>();
  const stamp=now(),done=status==='running'?null:stamp,duration=done&&row?.started_at?Math.max(0,Date.parse(done)-Date.parse(row.started_at)):null;
  await db.prepare('UPDATE producer_research_runs SET status=?,stage=?,attempt=?,message=?,updated_at=?,completed_at=?,duration_ms=? WHERE owner_id=? AND request_id=?')
    .bind(status,stage,attempt,message,stamp,done,duration,owner,requestId).run();
}

export async function getActiveProducerResearchRun(db:D1Database,owner:string,producerId:string){
  return db.prepare(`SELECT request_id FROM producer_research_runs WHERE owner_id=? AND producer_id=? AND status='running'
    AND updated_at>datetime('now','-20 minutes') ORDER BY updated_at DESC LIMIT 1`).bind(owner,producerId).first<{request_id:string}>();
}
export async function createQueuedProducerResearchRun(db:D1Database,owner:string,producerId:string,requestedId?:string){
  const active=await getActiveProducerResearchRun(db,owner,producerId);if(active)return {requestId:active.request_id,created:false};
  const exists=await db.prepare('SELECT id FROM producers WHERE owner_id=? AND id=?').bind(owner,producerId).first<{id:string}>();if(!exists)return null;
  const requestId=requestedId&&/^[A-Za-z0-9_-]{8,64}$/.test(requestedId)?requestedId:crypto.randomUUID(),stamp=now();
  await db.prepare(`INSERT INTO producer_research_runs(owner_id,request_id,producer_id,status,stage,attempt,message,started_at,updated_at,completed_at,duration_ms)
    VALUES(?,?,?,'running','preparing',0,'Queued for background producer research',?,?,NULL,NULL)
    ON CONFLICT(owner_id,request_id) DO UPDATE SET producer_id=excluded.producer_id,status='running',stage='preparing',attempt=0,message=excluded.message,started_at=excluded.started_at,updated_at=excluded.updated_at,completed_at=NULL,duration_ms=NULL`)
    .bind(owner,requestId,producerId,stamp,stamp).run();
  return {requestId,created:true};
}

async function phaseWithStatus(env:Env,owner:string,requestId:string,producerId:string,phase:Phase,prompt:string,schema:Record<string,unknown>){
  const models=[MODEL_PRIMARY,MODEL_FALLBACK] as const,timeouts=phase==='profile'?PROFILE_TIMEOUTS:CATALOG_TIMEOUTS;let lastError=`${phase} research failed`;
  for(let index=0;index<models.length;index++){
    const model=models[index],timeoutMs=timeouts[index],controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs),started=Date.now();
    await updateRun(env.DB,owner,requestId,'searching',index+1,index===0?`Researching producer ${phase} with ${model}`:`Trying ${model} for producer ${phase} after the 3.7 attempt did not complete`);
    try{
      const body=JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],tools:[{google_search:{}}],generationConfig:{responseMimeType:'application/json',responseSchema:schema}});
      log('log',{requestId,producerId,phase,stage:'gemini_start',model,attempt:index+1,timeoutMs});
      const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`,{method:'POST',headers:{'Content-Type':'application/json'},body,signal:controller.signal});
      const elapsedMs=Date.now()-started;
      if(!response.ok){const errorText=(await response.text().catch(()=>'' )).slice(0,800);lastError=`${phase} research failed (${response.status})`;log('warn',{requestId,producerId,phase,stage:'gemini_error',model,httpStatus:response.status,elapsedMs,errorText});if(index===0&&(response.status===404||response.status===408||response.status===429||response.status>=500)){await sleep(1200);continue}throw new Error(lastError)}
      const json=await response.json() as GeminiResponse,candidate=json.candidates?.[0],text=candidate?.content?.parts?.map(p=>p.text??'').join('')??'';
      let parsed:unknown;try{parsed=JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g,''))}catch{throw new Error(`${phase} research returned invalid JSON`)}
      log('log',{requestId,producerId,phase,stage:'gemini_complete',model,elapsedMs});
      return {parsed,text,metadata:candidate?.groundingMetadata,model,sources:sourcesFrom(candidate?.groundingMetadata)};
    }catch(e){
      if(controller.signal.aborted)lastError=`${phase} research timed out after ${Math.round(timeoutMs/1000)} seconds on ${model}`;else lastError=(e as Error).message||lastError;
      log(index===0?'warn':'error',{requestId,producerId,phase,stage:'gemini_request_error',model,error:lastError});
      if(index===0){await sleep(1200);continue}throw new Error(lastError);
    }finally{clearTimeout(timer)}
  }
  throw new Error(lastError);
}

const attr=(tag:string,name:string)=>tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,'i'))?.slice(1).find(Boolean)??null;
async function limited(response:Response,max:number){if(!response.body)return null;const reader=response.body.getReader(),chunks:Uint8Array[]=[];let total=0;try{while(true){const {done,value}=await reader.read();if(done)break;if(!value)continue;total+=value.byteLength;if(total>max){await reader.cancel();return null}chunks.push(value)}}finally{reader.releaseLock()}const out=new Uint8Array(total);let offset=0;for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.byteLength}return out}
async function safeFetch(url:URL,timeout:number,accept:string){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);try{return await fetch(url,{headers:{Accept:accept},signal:controller.signal})}finally{clearTimeout(timer)}}
async function heroImage(env:Env,owner:string,official:string){
  const site=safeHttpsUrl(official);if(!site)return null;const page=await safeFetch(site,PAGE_TIMEOUT_MS,'text/html,application/xhtml+xml');if(!page.ok||!(page.headers.get('Content-Type')||'').includes('text/html'))return null;
  const pageBytes=await limited(page,MAX_PAGE_BYTES);if(!pageBytes)return null;const html=new TextDecoder().decode(pageBytes);let image:URL|null=null;
  for(const tag of html.match(/<meta\b[^>]*>/gi)??[]){const key=String(attr(tag,'property')||attr(tag,'name')||'').toLowerCase();if(!['og:image','og:image:secure_url','twitter:image','twitter:image:src'].includes(key))continue;image=safeHttpsUrl(String(attr(tag,'content')||'').replace(/&amp;/g,'&'),site.toString());if(image)break}
  if(!image)return null;const response=await safeFetch(image,IMAGE_TIMEOUT_MS,'image/avif,image/webp,image/png,image/jpeg');if(!response.ok)return null;const contentType=(response.headers.get('Content-Type')||'').split(';')[0].trim().toLowerCase();if(!['image/jpeg','image/png','image/webp','image/avif'].includes(contentType))return null;
  const bytes=await limited(response,MAX_HERO_BYTES);if(!bytes||bytes.byteLength<1024)return null;const objectKey=createObjectKey(owner,contentType);await env.WINE_IMAGES.put(objectKey,bytes,{httpMetadata:{contentType},customMetadata:{kind:'producer-hero',source:image.toString()}});return {objectKey,sourceUrl:image.toString()};
}

export async function processProducerResearchJob(env:Env,owner:string,producerId:string,requestId:string){
  const row=await env.DB.prepare('SELECT * FROM producers WHERE owner_id=? AND id=?').bind(owner,producerId).first<Record<string,unknown>>();if(!row){await updateRun(env.DB,owner,requestId,'failed',0,'Producer no longer exists','failed');return {ok:false,error:'Producer not found'}};
  const name=String(row.canonical_name),started=Date.now();
  const profilePrompt=`Research the wine producer ${JSON.stringify(name)} using reliable public web sources. Prioritize the official producer website for identity, physical location, business contacts and producer-wide winemaking information. Return concise factual research only.\n\nLOCATION: homeCountry is the physical country; homeRegion is a broad wine region such as Burgundy, Champagne, Bordeaux, Tuscany, Piedmont, Mosel or Napa Valley; homeLocality is the commune/town where the producer is based. Do not use the regions where its wines happen to be produced.\n\nWINEMAKING PRACTICES: winemakingPractices is for stable producer-wide philosophy and practices only: farming approach, whole-bunch/de-stemming philosophy, fermentation approach, extraction philosophy, oak/elevage policy, filtration/fining approach, etc. State variability where practices differ by cuvee or vintage. Do NOT claim a percentage or technique for a specific wine/vintage unless it is genuinely a producer-wide rule.\n\nCONTACTS: return only verified public business contacts. officialWebsiteUrl must be the official HTTPS site. instagramUrl must clearly be the official producer account. Prefer official sources; LARVF is acceptable as a secondary source for French domaines. Return null when uncertain. Keep Google Search grounding enabled because WineLog derives contact references from grounding metadata.\n\nReturn JSON only with homeCountry, homeRegion, homeLocality, officialWebsiteUrl, instagramUrl, contactEmail, contactPhone, profile, winemakingPractices.`;
  const profileSchema={type:'OBJECT',properties:{homeCountry:{type:'STRING'},homeRegion:{type:'STRING'},homeLocality:{type:'STRING'},officialWebsiteUrl:{type:'STRING',nullable:true},instagramUrl:{type:'STRING',nullable:true},contactEmail:{type:'STRING',nullable:true},contactPhone:{type:'STRING',nullable:true},profile:{type:'STRING'},winemakingPractices:{type:'STRING'}},required:['homeCountry','homeRegion','homeLocality','officialWebsiteUrl','instagramUrl','contactEmail','contactPhone','profile','winemakingPractices']};
  const catalogPrompt=`Research the current or most recently documented wine range of ${JSON.stringify(name)} using reliable public web sources. Return the producer's range as completely as reliable sources allow, but keep every entry compact. Do not invent cuvees. Preserve official wine and appellation spellings. Categorize every wine as exactly red, white, rose, sparkling, dessert, fortified, orange, or other.\n\nFor each wine return only: name; category; appellation; classification; style (maximum a short phrase such as "Still dry white" or "Sparkling brut"); notes (at most one concise sentence, used only for uncertainty/current-status distinctions).\n\nDo NOT put tasting notes, food pairings, storage advice, critic scores, drinking windows, detailed vinification, bottle sizes, closures, serving temperatures or vintage-by-vintage commentary in the catalogue. Those belong to wine-level Deep Search. Return JSON only as {"range":[...]}.`;
  const catalogSchema={type:'OBJECT',properties:{range:{type:'ARRAY',items:{type:'OBJECT',properties:{name:{type:'STRING'},category:{type:'STRING',enum:['red','white','rose','sparkling','dessert','fortified','orange','other']},appellation:{type:'STRING',nullable:true},classification:{type:'STRING',nullable:true},style:{type:'STRING',nullable:true},notes:{type:'STRING',nullable:true}},required:['name','category']}}},required:['range']};
  try{
    const profilePhase=await phaseWithStatus(env,owner,requestId,producerId,'profile',profilePrompt,profileSchema),profile=profilePhase.parsed as ProfileResult;
    if(!profile||typeof profile.profile!=='string'||typeof profile.winemakingPractices!=='string')throw new Error('Producer profile research returned invalid fields');
    await updateRun(env.DB,owner,requestId,'searching',1,'Producer profile complete; researching the compact wine catalogue');
    const catalogPhase=await phaseWithStatus(env,owner,requestId,producerId,'catalog',catalogPrompt,catalogSchema),catalog=catalogPhase.parsed as CatalogResult;
    if(!catalog||!Array.isArray(catalog.range))throw new Error('Producer catalogue research returned invalid fields');
    const range=catalog.range.filter(x=>x&&typeof x.name==='string'&&x.name.trim()).slice(0,150).map(x=>({...x,name:x.name.trim(),category:CATEGORIES.has(x.category)?x.category:'other' as CatalogCategory,style:typeof x.style==='string'?x.style.trim().slice(0,80):null,notes:typeof x.notes==='string'?x.notes.trim().slice(0,300):null}));
    const contactGrounding=extractContactGrounding(profilePhase.text,profilePhase.metadata),grounded=new Set(contactGrounding.fields),parsedOfficial=safeHttpsUrl(profile.officialWebsiteUrl)?.toString()??null,parsedInstagram=safeInstagramUrl(profile.instagramUrl),parsedEmail=normalizeProducerEmail(profile.contactEmail),parsedPhone=normalizeProducerPhone(profile.contactPhone);
    const official=(parsedOfficial&&grounded.has('officialWebsiteUrl')?parsedOfficial:null)||(row.official_website_url?String(row.official_website_url):null),instagram=(parsedInstagram&&grounded.has('instagramUrl')?parsedInstagram:null)||(row.instagram_url?String(row.instagram_url):null),email=(parsedEmail&&grounded.has('contactEmail')?parsedEmail:null)||(row.contact_email?String(row.contact_email):null),phone=(parsedPhone&&grounded.has('contactPhone')?parsedPhone:null)||(row.contact_phone?String(row.contact_phone):null);
    const accepted=Boolean((parsedOfficial&&grounded.has('officialWebsiteUrl'))||(parsedInstagram&&grounded.has('instagramUrl'))||(parsedEmail&&grounded.has('contactEmail'))||(parsedPhone&&grounded.has('contactPhone'))),contactSources=accepted?contactGrounding.sources:cleanContactSources(parseJson(row.contact_sources_json,[])),sources=mergeSources(profilePhase.sources,catalogPhase.sources),model=profilePhase.model===catalogPhase.model?profilePhase.model:`${profilePhase.model} + ${catalogPhase.model}`,stamp=now();
    await updateRun(env.DB,owner,requestId,'saving',1,`Saving producer profile, practices, contacts and ${range.length} catalogue wine${range.length===1?'':'s'}`);
    await env.DB.prepare('UPDATE producers SET home_country=?,home_region=?,home_locality=?,official_website_url=?,instagram_url=?,contact_email=?,contact_phone=?,contact_sources_json=?,profile=?,winemaking_practices=?,catalog_json=?,sources_json=?,research_model=?,researched_at=?,updated_at=? WHERE owner_id=? AND id=?')
      .bind(profile.homeCountry?.trim()||null,profile.homeRegion?.trim()||null,profile.homeLocality?.trim()||null,official,instagram,email,phone,JSON.stringify(contactSources),profile.profile.trim(),profile.winemakingPractices.trim(),JSON.stringify(range),JSON.stringify(sources),model,stamp,stamp,owner,producerId).run();
    let heroStored=false;if(official){await updateRun(env.DB,owner,requestId,'image',1,'Looking for a domaine image on the verified official website');try{const hero=await heroImage(env,owner,official);if(hero){const old=row.hero_image_object_key?String(row.hero_image_object_key):null;await env.DB.prepare('UPDATE producers SET hero_image_object_key=?,hero_image_source_url=?,updated_at=? WHERE owner_id=? AND id=?').bind(hero.objectKey,hero.sourceUrl,now(),owner,producerId).run();heroStored=true;if(old&&old!==hero.objectKey)await env.WINE_IMAGES.delete(old).catch(()=>undefined)}}catch(e){log('warn',{requestId,producerId,stage:'hero_skipped',error:(e as Error).message})}}
    await updateRun(env.DB,owner,requestId,'complete',1,`Research complete: profile, producer practices and ${range.length} catalogue wine${range.length===1?'':'s'}${heroStored?', domaine image saved':''}`,'complete');
    log('log',{requestId,producerId,stage:'complete',durationMs:Date.now()-started,profileModel:profilePhase.model,catalogModel:catalogPhase.model,catalogCount:range.length});
    const updated=await env.DB.prepare('SELECT * FROM producers WHERE owner_id=? AND id=?').bind(owner,producerId).first<Record<string,unknown>>();return {ok:true,producer:updated?mapProducerRow(updated):null};
  }catch(e){const error=(e as Error).message||'Producer research failed';await updateRun(env.DB,owner,requestId,'failed',1,error,'failed').catch(()=>undefined);log('error',{requestId,producerId,stage:'failed',error,durationMs:Date.now()-started});return {ok:false,error}}
}
