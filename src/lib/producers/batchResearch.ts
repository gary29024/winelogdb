import { createObjectKey } from '../r2/keys';
import { createResearchBatchJob,finishResearchBatchJob,getResearchBatchJob,touchResearchBatchJob } from '../research/batchJobStore';
import { createGeminiBatch,fetchGeminiBatch,inlineFinishReason,inlineGroundingMetadata,inlineResponseText,isTerminalBatchState,responsesByKey,type GeminiBatchRequest,type GroundingMetadata } from '../research/geminiBatch';
import { reconcileProducerCuvees,syncProducerCatalogCuvees } from '../cuvees/entities';
import { extractContactGrounding,normalizeProducerEmail,normalizeProducerPhone,safeInstagramUrl } from './research';
import { parseStructuredJsonText } from './structuredJson';

type Env={DB:D1Database;WINE_IMAGES:R2Bucket;GEMINI_API_KEY:string;RESEARCH_QUEUE:Queue<unknown>};
type CatalogCategory='red'|'white'|'rose'|'sparkling'|'dessert'|'fortified'|'orange'|'other';
type ProfileResult={homeCountry:string;homeRegion:string;homeLocality:string;officialWebsiteUrl:string|null;instagramUrl:string|null;contactEmail:string|null;contactPhone:string|null;profile:string;winemakingPractices:string};
type CatalogWine={name:string;category:CatalogCategory;appellation?:string|null;classification?:string|null;style?:string|null;notes?:string|null};
type CatalogResult={range:CatalogWine[]};
type ResearchSource={title:string;url:string};
type ProducerBatchKey='profile'|'catalog';

const PRIMARY_MODEL='gemini-3.7-flash';
const FALLBACK_MODEL='gemini-3.6-flash';
const CATEGORIES=new Set<CatalogCategory>(['red','white','rose','sparkling','dessert','fortified','orange','other']);
const PAGE_TIMEOUT_MS=8_000,IMAGE_TIMEOUT_MS=10_000,MAX_PAGE_BYTES=384*1024,MAX_HERO_BYTES=5*1024*1024;
const now=()=>new Date().toISOString();
const parseJson=<T>(value:unknown,fallback:T):T=>{try{return JSON.parse(String(value)) as T}catch{return fallback}};
const sleepDelay=(pollCount:number)=>Math.min(300,15*Math.pow(2,Math.min(pollCount,4)));

function log(level:'log'|'warn'|'error',data:Record<string,unknown>){console[level](JSON.stringify({event:'producer_batch_research',...data}))}
async function updateRun(db:D1Database,owner:string,requestId:string,stage:string,attempt:number,message:string,status:'running'|'complete'|'failed'='running'){
  const row=await db.prepare('SELECT started_at FROM producer_research_runs WHERE owner_id=? AND request_id=?').bind(owner,requestId).first<{started_at:string}>();
  const stamp=now(),done=status==='running'?null:stamp,duration=done&&row?.started_at?Math.max(0,Date.parse(done)-Date.parse(row.started_at)):null;
  await db.prepare('UPDATE producer_research_runs SET status=?,stage=?,attempt=?,message=?,updated_at=?,completed_at=?,duration_ms=? WHERE owner_id=? AND request_id=?')
    .bind(status,stage,attempt,message,stamp,done,duration,owner,requestId).run();
}

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

function prompts(name:string){
  const profilePrompt=`Research the wine producer ${JSON.stringify(name)} using reliable public web sources. Prioritize the official producer website for identity, physical location, business contacts and producer-wide winemaking information. Return concise factual research only.\n\nLOCATION: homeCountry is the physical country; homeRegion is a broad wine region such as Burgundy, Champagne, Bordeaux, Tuscany, Piedmont, Mosel or Napa Valley; homeLocality is the commune/town where the producer is based. Do not use the regions where its wines happen to be produced.\n\nWINEMAKING PRACTICES: winemakingPractices is for stable producer-wide philosophy and practices only: farming approach, whole-bunch/de-stemming philosophy, fermentation approach, extraction philosophy, oak/elevage policy, filtration/fining approach, etc. State variability where practices differ by cuvee or vintage. Do NOT claim a percentage or technique for a specific wine/vintage unless it is genuinely a producer-wide rule.\n\nCONTACTS: return only verified public business contacts. officialWebsiteUrl must be the official HTTPS site. instagramUrl must clearly be the official producer account. Prefer official sources; LARVF is acceptable as a secondary source for French domaines. Return null when uncertain. Keep Google Search grounding enabled because WineLog derives contact references from grounding metadata.\n\nReturn JSON only with homeCountry, homeRegion, homeLocality, officialWebsiteUrl, instagramUrl, contactEmail, contactPhone, profile, winemakingPractices.`;
  const profileSchema={type:'OBJECT',properties:{homeCountry:{type:'STRING'},homeRegion:{type:'STRING'},homeLocality:{type:'STRING'},officialWebsiteUrl:{type:'STRING',nullable:true},instagramUrl:{type:'STRING',nullable:true},contactEmail:{type:'STRING',nullable:true},contactPhone:{type:'STRING',nullable:true},profile:{type:'STRING'},winemakingPractices:{type:'STRING'}},required:['homeCountry','homeRegion','homeLocality','officialWebsiteUrl','instagramUrl','contactEmail','contactPhone','profile','winemakingPractices']};
  const catalogPrompt=`Research the current or most recently documented wine range of ${JSON.stringify(name)} using reliable public web sources. Return the producer's range as completely as reliable sources allow, but keep every entry compact. Do not invent cuvees. Preserve official wine and appellation spellings. Categorize every wine as exactly red, white, rose, sparkling, dessert, fortified, orange, or other.\n\nFor each wine return only: name; category; appellation; classification; style (maximum a short phrase such as "Still dry white" or "Sparkling brut"); notes (at most one concise sentence, used only for uncertainty/current-status distinctions).\n\nDo NOT put tasting notes, food pairings, storage advice, critic scores, drinking windows, detailed vinification, bottle sizes, closures, serving temperatures or vintage-by-vintage commentary in the catalogue. Those belong to wine-level Deep Search. Return JSON only as {"range":[...]}.`;
  const catalogSchema={type:'OBJECT',properties:{range:{type:'ARRAY',items:{type:'OBJECT',properties:{name:{type:'STRING'},category:{type:'STRING',enum:['red','white','rose','sparkling','dessert','fortified','orange','other']},appellation:{type:'STRING',nullable:true},classification:{type:'STRING',nullable:true},style:{type:'STRING',nullable:true},notes:{type:'STRING',nullable:true}},required:['name','category']}}},required:['range']};
  return {profile:{prompt:profilePrompt,schema:profileSchema,maxOutputTokens:8192},catalog:{prompt:catalogPrompt,schema:catalogSchema,maxOutputTokens:16384}};
}

function batchEntries(name:string,keys:ProducerBatchKey[]):GeminiBatchRequest[]{
  const definitions=prompts(name);
  return keys.map(key=>{const definition=definitions[key];return {key,request:{contents:[{role:'user',parts:[{text:definition.prompt}]}],tools:[{google_search:{}}],generationConfig:{responseMimeType:'application/json',responseSchema:definition.schema,maxOutputTokens:definition.maxOutputTokens}}}});
}

async function submitAttempt(env:Env,owner:string,producerId:string,requestId:string,attempt:number,keys:ProducerBatchKey[]){
  const producer=await env.DB.prepare('SELECT canonical_name FROM producers WHERE owner_id=? AND id=?').bind(owner,producerId).first<{canonical_name:string}>();
  if(!producer)throw new Error('Producer not found');
  const model=attempt===1?PRIMARY_MODEL:FALLBACK_MODEL,entries=batchEntries(producer.canonical_name,keys),googleName=await createGeminiBatch(env.GEMINI_API_KEY,model,`winelog-producer-${requestId}-${attempt}`,entries);
  const jobId=await createResearchBatchJob(env.DB,{owner,requestId,targetKind:'producer',targetId:producerId,googleBatchName:googleName,model,attempt,keys});
  await updateRun(env.DB,owner,requestId,'searching',attempt,attempt===1?'Producer profile and catalogue submitted to Gemini Batch':'Retrying only failed producer research with the fallback Gemini Batch model');
  await env.RESEARCH_QUEUE.send({kind:'producer_batch_poll',owner,producerId,requestId,jobId,pollCount:0},{delaySeconds:15});
  log('log',{requestId,producerId,stage:'batch_submitted',attempt,model,keys,googleName});
  return jobId;
}

export async function startProducerBatchResearch(env:Env,owner:string,producerId:string,requestId:string){
  try{await submitAttempt(env,owner,producerId,requestId,1,['profile','catalog']);return {ok:true as const}}
  catch(e){const error=(e as Error).message||'Could not submit producer research batch';await updateRun(env.DB,owner,requestId,'failed',1,error,'failed').catch(()=>undefined);return {ok:false as const,error}}
}

async function saveProfile(env:Env,owner:string,producerId:string,requestId:string,profile:ProfileResult,text:string,metadata:GroundingMetadata|undefined,model:string){
  if(!profile||typeof profile.profile!=='string'||typeof profile.winemakingPractices!=='string')throw new Error('Producer profile research returned invalid fields');
  const row=await env.DB.prepare('SELECT * FROM producers WHERE owner_id=? AND id=?').bind(owner,producerId).first<Record<string,unknown>>();if(!row)throw new Error('Producer not found');
  const contactGrounding=extractContactGrounding(text,metadata),grounded=new Set(contactGrounding.fields),parsedOfficial=safeHttpsUrl(profile.officialWebsiteUrl)?.toString()??null,parsedInstagram=safeInstagramUrl(profile.instagramUrl),parsedEmail=normalizeProducerEmail(profile.contactEmail),parsedPhone=normalizeProducerPhone(profile.contactPhone);
  const official=(parsedOfficial&&grounded.has('officialWebsiteUrl')?parsedOfficial:null)||(row.official_website_url?String(row.official_website_url):null),instagram=(parsedInstagram&&grounded.has('instagramUrl')?parsedInstagram:null)||(row.instagram_url?String(row.instagram_url):null),email=(parsedEmail&&grounded.has('contactEmail')?parsedEmail:null)||(row.contact_email?String(row.contact_email):null),phone=(parsedPhone&&grounded.has('contactPhone')?parsedPhone:null)||(row.contact_phone?String(row.contact_phone):null);
  const accepted=Boolean((parsedOfficial&&grounded.has('officialWebsiteUrl'))||(parsedInstagram&&grounded.has('instagramUrl'))||(parsedEmail&&grounded.has('contactEmail'))||(parsedPhone&&grounded.has('contactPhone'))),contactSources=accepted?contactGrounding.sources:cleanContactSources(parseJson(row.contact_sources_json,[]));
  const sources=mergeSources(parseJson<ResearchSource[]>(row.sources_json,[]),sourcesFrom(metadata)),stamp=now();
  await env.DB.prepare('UPDATE producers SET home_country=?,home_region=?,home_locality=?,official_website_url=?,instagram_url=?,contact_email=?,contact_phone=?,contact_sources_json=?,profile=?,winemaking_practices=?,sources_json=?,research_model=?,researched_at=?,updated_at=? WHERE owner_id=? AND id=?')
    .bind(profile.homeCountry?.trim()||null,profile.homeRegion?.trim()||null,profile.homeLocality?.trim()||null,official,instagram,email,phone,JSON.stringify(contactSources),profile.profile.trim(),profile.winemakingPractices.trim(),JSON.stringify(sources),`${model} (batch)`,stamp,stamp,owner,producerId).run();
  if(official){try{const hero=await heroImage(env,owner,official);if(hero){const old=row.hero_image_object_key?String(row.hero_image_object_key):null;await env.DB.prepare('UPDATE producers SET hero_image_object_key=?,hero_image_source_url=?,updated_at=? WHERE owner_id=? AND id=?').bind(hero.objectKey,hero.sourceUrl,now(),owner,producerId).run();if(old&&old!==hero.objectKey)await env.WINE_IMAGES.delete(old).catch(()=>undefined)}}catch(e){log('warn',{requestId,producerId,stage:'hero_skipped',error:(e as Error).message})}}
}

async function saveCatalog(env:Env,owner:string,producerId:string,catalog:CatalogResult,metadata:GroundingMetadata|undefined,model:string){
  if(!catalog||!Array.isArray(catalog.range))throw new Error('Producer catalogue research returned invalid fields');
  const range=catalog.range.filter(x=>x&&typeof x.name==='string'&&x.name.trim()).slice(0,150).map(x=>({...x,name:x.name.trim(),category:CATEGORIES.has(x.category)?x.category:'other' as CatalogCategory,style:typeof x.style==='string'?x.style.trim().slice(0,80):null,notes:typeof x.notes==='string'?x.notes.trim().slice(0,300):null}));
  const row=await env.DB.prepare('SELECT sources_json FROM producers WHERE owner_id=? AND id=?').bind(owner,producerId).first<{sources_json:string}>();const sources=mergeSources(parseJson<ResearchSource[]>(row?.sources_json,[]),sourcesFrom(metadata)),stamp=now();
  await env.DB.prepare('UPDATE producers SET catalog_json=?,sources_json=?,research_model=?,researched_at=?,updated_at=? WHERE owner_id=? AND id=?').bind(JSON.stringify(range),JSON.stringify(sources),`${model} (batch)`,stamp,stamp,owner,producerId).run();
  await syncProducerCatalogCuvees(env.DB,owner,producerId);await reconcileProducerCuvees(env.DB,owner,producerId);
  return range.length;
}

async function retryOrFail(env:Env,owner:string,producerId:string,requestId:string,attempt:number,failed:ProducerBatchKey[],errors:string[]){
  if(attempt===1&&failed.length){await submitAttempt(env,owner,producerId,requestId,2,failed);return}
  const saved=failed.length===1?(failed[0]==='profile'?'catalogue':'profile'):null;
  const message=saved?`Producer ${saved} was saved, but ${failed[0]} research failed: ${errors.join('; ')}`:`Producer research failed: ${errors.join('; ')}`;
  await updateRun(env.DB,owner,requestId,'failed',attempt,message,'failed');
}

export async function pollProducerBatchResearch(env:Env,owner:string,producerId:string,requestId:string,jobId:string,pollCount:number){
  const job=await getResearchBatchJob(env.DB,owner,jobId);if(!job||job.status!=='running')return;
  const fetched=await fetchGeminiBatch(env.GEMINI_API_KEY,job.googleBatchName);
  if(!fetched.ok){
    if(fetched.status===429||fetched.status>=500){await touchResearchBatchJob(env.DB,owner,jobId);await env.RESEARCH_QUEUE.send({kind:'producer_batch_poll',owner,producerId,requestId,jobId,pollCount:pollCount+1},{delaySeconds:Math.min(300,30*Math.max(1,pollCount+1))});return}
    await finishResearchBatchJob(env.DB,owner,jobId,'failed',fetched.error);await retryOrFail(env,owner,producerId,requestId,job.attempt,job.keys as ProducerBatchKey[],[fetched.error]);return;
  }
  if(!isTerminalBatchState(fetched.state)){await touchResearchBatchJob(env.DB,owner,jobId);await updateRun(env.DB,owner,requestId,'searching',job.attempt,`Gemini Batch is processing producer ${job.keys.join(' + ')} research`);await env.RESEARCH_QUEUE.send({kind:'producer_batch_poll',owner,producerId,requestId,jobId,pollCount:pollCount+1},{delaySeconds:sleepDelay(pollCount)});return}
  if(fetched.state!=='JOB_STATE_SUCCEEDED'){
    const error=String((fetched.payload.error as {message?:unknown}|undefined)?.message||`Gemini batch ended with ${fetched.state}`);await finishResearchBatchJob(env.DB,owner,jobId,'failed',error);await retryOrFail(env,owner,producerId,requestId,job.attempt,job.keys as ProducerBatchKey[],[error]);return;
  }
  await updateRun(env.DB,owner,requestId,'saving',job.attempt,'Saving completed producer Batch results');
  const byKey=responsesByKey(fetched.responses),failed:ProducerBatchKey[]=[],errors:string[]=[];let catalogCount:number|null=null;
  for(const key of job.keys as ProducerBatchKey[]){
    const inline=byKey.get(key);if(!inline?.response){failed.push(key);errors.push(`${key}: ${inline?.error?.message||'Gemini returned no result'}`);continue}
    const text=inlineResponseText(inline),finishReason=inlineFinishReason(inline);
    try{
      const parsed=parseStructuredJsonText(text);
      if(key==='profile')await saveProfile(env,owner,producerId,requestId,parsed as ProfileResult,text,inlineGroundingMetadata(inline),job.model);
      else catalogCount=await saveCatalog(env,owner,producerId,parsed as CatalogResult,inlineGroundingMetadata(inline),job.model);
    }catch(e){failed.push(key);errors.push(`${key}: ${(e as Error).message}${finishReason?` (${finishReason})`:''}`);log('warn',{requestId,producerId,stage:'batch_result_failed',key,attempt:job.attempt,model:job.model,finishReason,textLength:text.length,textPreview:text.slice(0,500),error:(e as Error).message})}
  }
  await finishResearchBatchJob(env.DB,owner,jobId,failed.length?'failed':'complete',failed.length?errors.join('; '):null);
  if(failed.length){await retryOrFail(env,owner,producerId,requestId,job.attempt,failed,errors);return}
  const detail=catalogCount==null?'requested producer research':`${catalogCount} catalogue wine${catalogCount===1?'':'s'}`;
  await updateRun(env.DB,owner,requestId,'complete',job.attempt,`Producer Batch research complete; saved ${detail}`,'complete');
  log('log',{requestId,producerId,stage:'complete',attempt:job.attempt,model:job.model,keys:job.keys,catalogCount});
}
