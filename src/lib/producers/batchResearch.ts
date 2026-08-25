import { createObjectKey } from '../r2/keys';
import { ensureCuveeEntity,reconcileProducerCuvees } from '../cuvees/entities';
import { createResearchBatchJob,finishResearchBatchJob,getResearchBatchJob,touchResearchBatchJob,type ResearchBatchJob } from '../research/batchJobStore';
import { cancelGeminiBatch } from '../research/cancelResearch';
import { createGeminiBatch,describeResponseSchema,fetchGeminiBatch,groundedGenerationConfig,inlineFinishReason,inlineGroundingMetadata,inlineResponseText,isTerminalBatchState,responsesByKey,type GeminiBatchRequest,type GroundingMetadata } from '../research/geminiBatch';
import { researchBatchErrorPollDelay,researchBatchPollDelay,researchBatchStallAction,researchBatchTransientAction } from '../research/batchRetryPolicy';
import { clearProducerCatalogSliceStage,discardProducerCatalogStage,listProducerCatalogStage,prepareProducerCatalogStage,stageProducerCatalogParts } from './catalogResearchStage';
import { extractContactGrounding,normalizeProducerEmail,normalizeProducerPhone,safeInstagramUrl } from './research';
import { assertCatalogTextQuality,extractOfficialContactCandidates,mergeCatalogRanges,suspiciousCatalogShrink } from './researchQuality';
import { applyCatalogDecisions,listCatalogDecisions } from './catalogDecisions';
import { catalogNameInitial,stripProducerCatalogPrefix } from './catalogName';
import { parseStructuredJsonText } from './structuredJson';

type Env={DB:D1Database;WINE_IMAGES:R2Bucket;GEMINI_API_KEY:string;RESEARCH_QUEUE:Queue<unknown>};
type CatalogCategory='red'|'white'|'rose'|'sparkling'|'dessert'|'fortified'|'orange'|'other';
type ProfileResult={homeCountry:string;homeRegion:string;homeLocality:string;officialWebsiteUrl:string|null;instagramUrl:string|null;contactEmail:string|null;contactPhone:string|null;profile:string;winemakingPractices:string};
type CatalogWine={name:string;category:CatalogCategory;appellation?:string|null;classification?:string|null;style?:string|null;notes?:string|null};
type CatalogResult={range:CatalogWine[]};
type ResearchSource={title:string;url:string};
type CatalogSaveSummary={catalogCount:number;researchedCount:number;retainedCount:number;syncIssues:string[]};
type CatalogSlice={key:string;start:string|null;end:string|null;includeOther:boolean;label:string};
type ParsedCatalogPart={range:CatalogWine[];slice:CatalogSlice;metadata?:GroundingMetadata};

const PRIMARY_MODEL='gemini-3.7-flash';
const FALLBACK_MODEL='gemini-3.6-flash';
const MAX_CATALOG_ATTEMPT=6;
const PROFILE_SOURCE_KEY='__profile_sources__';
const CATEGORIES=new Set<CatalogCategory>(['red','white','rose','sparkling','dessert','fortified','orange','other']);
const PAGE_TIMEOUT_MS=8_000,IMAGE_TIMEOUT_MS=10_000,MAX_PAGE_BYTES=384*1024,MAX_HERO_BYTES=5*1024*1024;
const now=()=>new Date().toISOString();
const parseJson=<T>(value:unknown,fallback:T):T=>{try{return JSON.parse(String(value)) as T}catch{return fallback}};
const sliceKey=(start:string|null,end:string|null,includeOther=false)=>start&&end?`catalog_slice_${start.toLowerCase()}_${end.toLowerCase()}${includeOther?'_other':''}`:'catalog_slice_other';
const makeSlice=(start:string|null,end:string|null,includeOther=false):CatalogSlice=>({key:sliceKey(start,end,includeOther),start,end,includeOther,label:start&&end?(start===end?start:`${start}–${end}`)+(includeOther?' / other':''):'Other / non-letter'});
const BASE_SLICES=[makeSlice('A','E'),makeSlice('F','J'),makeSlice('K','O'),makeSlice('P','T'),makeSlice('U','Z',true)] as const;
export const catalogDefaultChunkKeys=BASE_SLICES.map(slice=>slice.key);
export const catalogRecoveryChunkKeys=catalogDefaultChunkKeys;

function log(level:'log'|'warn'|'error',data:Record<string,unknown>){console[level](JSON.stringify({event:'producer_chunked_research',...data}))}
function parseSliceKey(key:string):CatalogSlice|null{
  if(key==='catalog_slice_other')return makeSlice(null,null,true);
  const match=key.match(/^catalog_slice_([a-z])_([a-z])(_other)?$/);if(!match)return null;
  return makeSlice(match[1].toUpperCase(),match[2].toUpperCase(),Boolean(match[3]));
}
function splitSlice(slice:CatalogSlice):CatalogSlice[]{
  if(!slice.start||!slice.end)return [];
  const start=slice.start.charCodeAt(0),end=slice.end.charCodeAt(0);
  if(start===end)return slice.includeOther?[makeSlice(slice.start,slice.end,false),makeSlice(null,null,true)]:[];
  const mid=Math.floor((start+end)/2),leftEnd=String.fromCharCode(mid),rightStart=String.fromCharCode(mid+1);
  return [makeSlice(slice.start,leftEnd,false),makeSlice(rightStart,slice.end,slice.includeOther)];
}
export function catalogSubsliceKeysFor(key:string){const slice=parseSliceKey(key);return slice?splitSlice(slice).map(item=>item.key):[]}
export function shouldUseChunkedCatalogRecovery(error:string|null|undefined){
  const parts=String(error??'').split(';').map(part=>part.trim()).filter(Boolean);if(!parts.length)return false;
  return parts.every(part=>part.toLowerCase().startsWith('catalog'))&&parts.some(part=>/MAX_TOKENS|Invalid structured JSON|embedded record fragment/i.test(part));
}
export function catalogStageCoverageComplete(keys:string[]){
  const letters=new Set<string>();let other=false;
  for(const key of keys){const slice=parseSliceKey(key);if(!slice)continue;if(slice.start&&slice.end){for(let code=slice.start.charCodeAt(0);code<=slice.end.charCodeAt(0);code++)letters.add(String.fromCharCode(code))}if(slice.includeOther)other=true}
  return letters.size===26&&other;
}
function catalogSliceContains(slice:CatalogSlice,name:string,producerNames:string[]){
  const initial=catalogNameInitial(name,producerNames);if(!initial)return slice.includeOther&&!slice.start;
  if(!slice.start||!slice.end)return false;return initial>=slice.start&&initial<=slice.end;
}
function deterministicCatalogError(error:string){return /MAX_TOKENS|Invalid structured JSON|embedded record fragment|invalid catalogue fields|slice returned no usable|Catalogue quality check failed/i.test(error)}

async function setRunState(db:D1Database,owner:string,requestId:string,status:'running'|'complete'|'failed',stage:string,attempt:number,message:string){
  const row=await db.prepare('SELECT started_at FROM producer_research_runs WHERE owner_id=? AND request_id=?').bind(owner,requestId).first<{started_at:string}>();
  const stamp=now(),done=status==='running'?null:stamp,duration=done&&row?.started_at?Math.max(0,Date.parse(done)-Date.parse(row.started_at)):null;
  await db.prepare('UPDATE producer_research_runs SET status=?,stage=?,attempt=?,message=?,updated_at=?,completed_at=?,duration_ms=? WHERE owner_id=? AND request_id=?')
    .bind(status,stage,attempt,message,stamp,done,duration,owner,requestId).run();
}

function safeHttpsUrl(value:unknown,base?:string){
  if(typeof value!=='string'||!value.trim())return null;
  try{const url=new URL(value.trim(),base),host=url.hostname.toLowerCase();if(url.protocol!=='https:'||url.username||url.password||!host||host==='localhost'||host.endsWith('.local')||host.endsWith('.internal')||/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)||host.includes(':'))return null;url.hash='';return url}catch{return null}
}
const hostKey=(value:string)=>{try{return new URL(value).hostname.toLowerCase().replace(/^www\./,'')}catch{return ''}};
function sourcesFrom(metadata?:GroundingMetadata){
  const seen=new Set<string>(),sources:ResearchSource[]=[];
  for(const chunk of metadata?.groundingChunks??[]){const web=chunk.web,url=safeHttpsUrl(web?.uri)?.toString();if(!url||seen.has(url))continue;seen.add(url);sources.push({title:web?.title?.trim()||new URL(url).hostname,url});if(sources.length>=20)break}
  return sources;
}
function metadataGroundsUrl(url:string,metadata?:GroundingMetadata){const host=hostKey(url);return Boolean(host)&&sourcesFrom(metadata).some(source=>hostKey(source.url)===host)}
function mergeSources(...lists:ResearchSource[][]){const seen=new Set<string>();return lists.flat().filter(source=>{if(!source.url||seen.has(source.url))return false;seen.add(source.url);return true}).slice(0,30)}
function cleanContactSources(value:unknown){
  if(!Array.isArray(value))return [] as ResearchSource[];const seen=new Set<string>(),out:ResearchSource[]=[];
  for(const raw of value){if(!raw||typeof raw!=='object')continue;const item=raw as {title?:unknown;url?:unknown},url=safeHttpsUrl(item.url)?.toString();if(!url||seen.has(url))continue;seen.add(url);out.push({title:typeof item.title==='string'&&item.title.trim()?item.title.trim():new URL(url).hostname,url})}
  return out.slice(0,10);
}
export const htmlAttribute=(tag:string,name:string)=>tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,'i'))?.slice(1).find(Boolean)??null;
async function limited(response:Response,max:number){if(!response.body)return null;const reader=response.body.getReader(),chunks:Uint8Array[]=[];let total=0;try{while(true){const {done,value}=await reader.read();if(done)break;if(!value)continue;total+=value.byteLength;if(total>max){await reader.cancel();return null}chunks.push(value)}}finally{reader.releaseLock()}const out=new Uint8Array(total);let offset=0;for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.byteLength}return out}
async function safeFetch(url:URL,timeout:number,accept:string){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);try{return await fetch(url,{headers:{Accept:accept},signal:controller.signal})}finally{clearTimeout(timer)}}
async function htmlPage(url:URL){
  const response=await safeFetch(url,PAGE_TIMEOUT_MS,'text/html,application/xhtml+xml');if(!response.ok||!(response.headers.get('Content-Type')||'').toLowerCase().includes('text/html'))return null;
  const bytes=await limited(response,MAX_PAGE_BYTES);if(!bytes)return null;const finalUrl=safeHttpsUrl(response.url||url.toString())?.toString()??url.toString();return {html:new TextDecoder().decode(bytes),url:finalUrl};
}
async function officialWebsiteContacts(official:string){
  const start=safeHttpsUrl(official);if(!start)return {email:null as string|null,phone:null as string|null,instagram:null as string|null,sources:[] as ResearchSource[]};
  const visited=new Set<string>(),queue=[start.toString()],emails:string[]=[],phones:string[]=[],instagrams:string[]=[],sources:ResearchSource[]=[];
  while(queue.length&&visited.size<5){
    const requested=queue.shift()!;if(visited.has(requested))continue;visited.add(requested);const page=await htmlPage(new URL(requested)).catch(()=>null);if(!page)continue;
    const candidates=extractOfficialContactCandidates(page.html,page.url),before=emails.length+phones.length+instagrams.length;
    for(const value of candidates.emails){const email=normalizeProducerEmail(value);if(email&&!emails.includes(email))emails.push(email)}
    for(const value of candidates.phones){const phone=normalizeProducerPhone(value);if(phone&&!phones.includes(phone))phones.push(phone)}
    for(const value of candidates.instagramUrls){const instagram=safeInstagramUrl(value);if(instagram&&!instagrams.includes(instagram))instagrams.push(instagram)}
    if(emails.length+phones.length+instagrams.length>before&&!sources.some(source=>source.url===page.url))sources.push({title:'Official website contact page',url:page.url});
    for(const link of candidates.contactLinks){if(queue.length+visited.size>=5)break;if(!visited.has(link)&&!queue.includes(link))queue.push(link)}
  }
  return {email:emails[0]??null,phone:phones[0]??null,instagram:instagrams[0]??null,sources};
}
async function heroImage(env:Env,owner:string,official:string){
  const site=safeHttpsUrl(official);if(!site)return null;const page=await safeFetch(site,PAGE_TIMEOUT_MS,'text/html,application/xhtml+xml');if(!page.ok||!(page.headers.get('Content-Type')||'').includes('text/html'))return null;
  const pageBytes=await limited(page,MAX_PAGE_BYTES);if(!pageBytes)return null;const html=new TextDecoder().decode(pageBytes);let image:URL|null=null;
  for(const tag of html.match(/<meta\b[^>]*>/gi)??[]){const key=String(htmlAttribute(tag,'property')||htmlAttribute(tag,'name')||'').toLowerCase();if(!['og:image','og:image:secure_url','twitter:image','twitter:image:src'].includes(key))continue;image=safeHttpsUrl(String(htmlAttribute(tag,'content')||'').replace(/&amp;/g,'&'),site.toString());if(image)break}
  if(!image)return null;const response=await safeFetch(image,IMAGE_TIMEOUT_MS,'image/avif,image/webp,image/png,image/jpeg');if(!response.ok)return null;const contentType=(response.headers.get('Content-Type')||'').split(';')[0].trim().toLowerCase();if(!['image/jpeg','image/png','image/webp','image/avif'].includes(contentType))return null;
  const bytes=await limited(response,MAX_HERO_BYTES);if(!bytes||bytes.byteLength<1024)return null;const objectKey=createObjectKey(owner,contentType);await env.WINE_IMAGES.put(objectKey,bytes,{httpMetadata:{contentType},customMetadata:{kind:'producer-hero',source:image.toString()}});return {objectKey,sourceUrl:image.toString()};
}

const profileSchema={type:'OBJECT',properties:{homeCountry:{type:'STRING'},homeRegion:{type:'STRING'},homeLocality:{type:'STRING'},officialWebsiteUrl:{type:'STRING',nullable:true},instagramUrl:{type:'STRING',nullable:true},contactEmail:{type:'STRING',nullable:true},contactPhone:{type:'STRING',nullable:true},profile:{type:'STRING'},winemakingPractices:{type:'STRING'}},required:['homeCountry','homeRegion','homeLocality','officialWebsiteUrl','instagramUrl','contactEmail','contactPhone','profile','winemakingPractices']};
const catalogSchema={type:'OBJECT',properties:{range:{type:'ARRAY',items:{type:'OBJECT',properties:{name:{type:'STRING'},category:{type:'STRING',enum:['red','white','rose','sparkling','dessert','fortified','orange','other']},appellation:{type:'STRING',nullable:true},classification:{type:'STRING',nullable:true},style:{type:'STRING',nullable:true},notes:{type:'STRING',nullable:true}},required:['name','category']}}},required:['range']};
function profilePrompt(name:string){return `You must use the Google Search tool before answering, and every factual claim must come from a page you actually retrieved in this request. Do not answer from prior knowledge, and do not reconstruct a plausible answer for something you did not find. If the search tool is unavailable or returns nothing usable, say exactly that in the affected fields rather than writing an ungrounded answer: WineLog rejects an ungrounded response outright, so an honest "could not be verified" is worth more than confident prose.\n\nResearch the wine producer ${JSON.stringify(name)} using reliable public web sources. Prioritize the official producer website for identity, physical location, business contacts and producer-wide winemaking information. Return concise factual research only.\n\nLOCATION: homeCountry is the physical country; homeRegion is a broad wine region such as Burgundy, Champagne, Bordeaux, Tuscany, Piedmont, Mosel or Napa Valley; homeLocality is the commune/town where the producer is based. Do not use the regions where its wines happen to be produced.\n\nWINEMAKING PRACTICES: winemakingPractices is for stable producer-wide philosophy and practices only. State variability where practices differ by cuvee or vintage.\n\nCONTACTS: return only verified public business contacts. officialWebsiteUrl must be the official HTTPS site. instagramUrl must clearly be the official producer account. Prefer official first-party sources; return null when uncertain. WineLog will independently inspect the official site, including plain-text public email/phone information.\n\nReturn JSON only with homeCountry, homeRegion, homeLocality, officialWebsiteUrl, instagramUrl, contactEmail, contactPhone, profile, winemakingPractices.`}
function slicePrompt(name:string,slice:CatalogSlice){
  const rule=slice.start&&slice.end?`${slice.start} through ${slice.end}${slice.includeOther?', plus non-letter/digit/symbol initials':''}`:'non-letter/digit/symbol initials only';
  return `You must use the Google Search tool before answering, and every catalogue entry must come from a page you actually retrieved in this request. Do not answer from prior knowledge and do not invent cuvees. If the search tool is unavailable or returns nothing usable, return an empty range rather than a remembered one.\n\nResearch one bounded alphabetical slice of the current or most recently documented wine range of ${JSON.stringify(name)} using reliable public web sources. WineLog stages every slice and only replaces the visible catalogue after the complete range passes validation.\n\nSLICE: return ONLY wines whose first significant wine/cuvee-name initial belongs to ${slice.label} (${rule}). Determine the initial after removing a repeated producer name and a leading generic Domaine, Maison, Château/Chateau, Estate, Winery, Weingut, Bodega, Tenuta or Azienda Agricola prefix when it merely repeats the producer identity. Treat accented Latin initials as their base letter.\n\nNAME FIELD: return the wine/cuvee name only. NEVER prepend the producer, domaine, estate or house name. For example, return "Volnay 1er Cru Le Ronceret", not "Domaine Example Volnay 1er Cru Le Ronceret".\n\nSearch across complementary sources where available: official producer range/product pages and technical sheets; recent official importer/distributor portfolios; reputable regional or specialist wine references. Cross-check omissions and alternate spellings. Preserve official wine and appellation spellings and do not invent cuvees.\n\nFor every wine return exactly name, category, appellation, classification, style and notes. category must be one of red, white, rose, sparkling, dessert, fortified, orange, other. Keep style to a very short phrase such as Still dry red, Still dry white or Sparkling brut. notes must be null unless one short current-status caveat is genuinely necessary. Do not pad fields with repeated characters or filler. Return JSON only as {"range":[...]}.`;
}
function requestForKey(name:string,key:string):GeminiBatchRequest{
  if(key==='profile')return {key,request:{contents:[{role:'user',parts:[{text:`${profilePrompt(name)}\n\n${describeResponseSchema(profileSchema)}`}]}],tools:[{google_search:{}}],generationConfig:groundedGenerationConfig(8192)}};
  const slice=parseSliceKey(key);if(!slice)throw new Error(`Unknown producer research key ${key}`);
  return {key,request:{contents:[{role:'user',parts:[{text:`${slicePrompt(name,slice)}\n\n${describeResponseSchema(catalogSchema)}`}]}],tools:[{google_search:{}}],generationConfig:groundedGenerationConfig(8192)}};
}

async function producerNames(db:D1Database,owner:string,producerId:string){
  const [producer,aliases]=await Promise.all([
    db.prepare('SELECT canonical_name FROM producers WHERE owner_id=? AND id=?').bind(owner,producerId).first<{canonical_name:string}>(),
    db.prepare('SELECT display_alias FROM producer_aliases WHERE owner_id=? AND producer_id=?').bind(owner,producerId).all<{display_alias:string}>()
  ]);return [producer?.canonical_name??'',...aliases.results.map(row=>row.display_alias)].filter(Boolean);
}
async function saveProfile(env:Env,owner:string,producerId:string,requestId:string,profile:ProfileResult,text:string,metadata:GroundingMetadata|undefined,model:string){
  if(!profile||typeof profile.profile!=='string'||typeof profile.winemakingPractices!=='string')throw new Error('Producer profile research returned invalid fields');
  const row=await env.DB.prepare('SELECT * FROM producers WHERE owner_id=? AND id=?').bind(owner,producerId).first<Record<string,unknown>>();if(!row)throw new Error('Producer not found');
  const contactGrounding=extractContactGrounding(text,metadata),grounded=new Set(contactGrounding.fields),parsedOfficial=safeHttpsUrl(profile.officialWebsiteUrl)?.toString()??null,parsedInstagram=safeInstagramUrl(profile.instagramUrl),parsedEmail=normalizeProducerEmail(profile.contactEmail),parsedPhone=normalizeProducerPhone(profile.contactPhone);
  const priorOfficial=row.official_website_url?String(row.official_website_url):null;
  const official=(parsedOfficial&&(grounded.has('officialWebsiteUrl')||metadataGroundsUrl(parsedOfficial,metadata))?parsedOfficial:null)||priorOfficial;
  let siteContacts={email:null as string|null,phone:null as string|null,instagram:null as string|null,sources:[] as ResearchSource[]};
  if(official){try{siteContacts=await officialWebsiteContacts(official)}catch(e){log('warn',{requestId,producerId,stage:'official_contact_lookup_skipped',error:(e as Error).message})}}
  const instagram=siteContacts.instagram||(parsedInstagram&&grounded.has('instagramUrl')?parsedInstagram:null)||(row.instagram_url?String(row.instagram_url):null);
  const email=siteContacts.email||(parsedEmail&&grounded.has('contactEmail')?parsedEmail:null)||(row.contact_email?String(row.contact_email):null);
  const phone=siteContacts.phone||(parsedPhone&&grounded.has('contactPhone')?parsedPhone:null)||(row.contact_phone?String(row.contact_phone):null);
  const contactSources=mergeSources(cleanContactSources(parseJson(row.contact_sources_json,[])),contactGrounding.sources,siteContacts.sources).slice(0,10);
  const profileSources=sourcesFrom(metadata),sources=mergeSources(parseJson<ResearchSource[]>(row.sources_json,[]),profileSources),stamp=now();
  await stageProducerCatalogParts<CatalogWine>(env.DB,[{owner,requestId,producerId,sliceKey:PROFILE_SOURCE_KEY,range:[],sources:profileSources,model}]);
  await env.DB.prepare('UPDATE producers SET home_country=?,home_region=?,home_locality=?,official_website_url=?,instagram_url=?,contact_email=?,contact_phone=?,contact_sources_json=?,profile=?,winemaking_practices=?,sources_json=?,research_model=?,researched_at=?,updated_at=? WHERE owner_id=? AND id=?')
    .bind(profile.homeCountry?.trim()||null,profile.homeRegion?.trim()||null,profile.homeLocality?.trim()||null,official,instagram,email,phone,JSON.stringify(contactSources),profile.profile.trim(),profile.winemakingPractices.trim(),JSON.stringify(sources),`${model} (batch profile)`,stamp,stamp,owner,producerId).run();
  if(official){try{const hero=await heroImage(env,owner,official);if(hero){const old=row.hero_image_object_key?String(row.hero_image_object_key):null;await env.DB.prepare('UPDATE producers SET hero_image_object_key=?,hero_image_source_url=?,updated_at=? WHERE owner_id=? AND id=?').bind(hero.objectKey,hero.sourceUrl,now(),owner,producerId).run();if(old&&old!==hero.objectKey)await env.WINE_IMAGES.delete(old).catch(()=>undefined)}}catch(e){log('warn',{requestId,producerId,stage:'hero_skipped',error:(e as Error).message})}}
}
function normalizeCatalogRange(catalog:CatalogResult,slice:CatalogSlice,names:string[]){
  if(!catalog||!Array.isArray(catalog.range))throw new Error('Producer catalogue slice returned invalid fields');
  const out:CatalogWine[]=[];let namedRecords=0;
  const optional=(value:unknown,field:string,max:number)=>{if(value==null)return null;if(typeof value!=='string')throw new Error(`Catalogue quality check failed: ${field} is not text`);const text=value.trim();if(!text)return null;assertCatalogTextQuality(text,field,max);return text};
  for(const raw of catalog.range as unknown[]){
    if(!raw||typeof raw!=='object')continue;const item=raw as Record<string,unknown>,rawName=typeof item.name==='string'?item.name.trim():'';if(!rawName)continue;namedRecords++;
    assertCatalogTextQuality(rawName,'name',220);const name=stripProducerCatalogPrefix(rawName,names);assertCatalogTextQuality(name,'name',220);if(!name||!catalogSliceContains(slice,name,names))continue;
    const categoryText=typeof item.category==='string'?item.category.trim().toLowerCase():'other',category=CATEGORIES.has(categoryText as CatalogCategory)?categoryText as CatalogCategory:'other';
    out.push({name,category,appellation:optional(item.appellation,'appellation',180),classification:optional(item.classification,'classification',120),style:optional(item.style,'style',80),notes:optional(item.notes,'notes',320)});
  }
  if(namedRecords>0&&out.length===0)throw new Error('Producer catalogue slice returned no usable in-slice wines');
  return mergeCatalogRanges([],out,150,names).range;
}
async function stageCatalogParts(env:Env,owner:string,producerId:string,requestId:string,parts:ParsedCatalogPart[],model:string){
  if(!parts.length)return;
  await stageProducerCatalogParts(env.DB,parts.map(part=>({owner,requestId,producerId,sliceKey:part.slice.key,range:part.range,sources:sourcesFrom(part.metadata),model})));
}
async function finalizeCatalogStage(env:Env,owner:string,producerId:string,requestId:string):Promise<CatalogSaveSummary|null>{
  const staged=await listProducerCatalogStage<CatalogWine>(env.DB,owner,producerId,requestId),catalogRows=staged.filter(row=>parseSliceKey(row.sliceKey));
  if(!catalogStageCoverageComplete(catalogRows.map(row=>row.sliceKey)))return null;
  const names=await producerNames(env.DB,owner,producerId),researched=catalogRows.flatMap(row=>row.range);
  const row=await env.DB.prepare('SELECT catalog_json,sources_json FROM producers WHERE owner_id=? AND id=?').bind(owner,producerId).first<{catalog_json:string;sources_json:string}>();
  const parsedPrevious=parseJson<unknown>(row?.catalog_json,[]),previous=(Array.isArray(parsedPrevious)?parsedPrevious:[]).filter(item=>item&&typeof item==='object'&&typeof (item as {name?:unknown}).name==='string') as CatalogWine[];
  // Manual corrections are re-applied to the freshly researched range, so a
  // duplicate the owner already resolved cannot return. The completeness guard
  // then compares like with like: both sides are counted after the same
  // decisions, so resolving duplicates never reads as a suspicious shrink.
  const decisions=await listCatalogDecisions(env.DB,owner,producerId);
  const corrected=applyCatalogDecisions(mergeCatalogRanges([],researched,150,names).range,decisions,names),deduped=corrected.range;
  const previousCount=applyCatalogDecisions(mergeCatalogRanges([],previous,150,names).range,decisions,names).range.length;
  if(suspiciousCatalogShrink(previousCount,deduped.length))throw new Error(`Catalogue completeness guard rejected a suspicious shrink from ${previousCount} to ${deduped.length} wines`);
  const profileStage=staged.find(item=>item.sliceKey===PROFILE_SOURCE_KEY),baseSources=profileStage?profileStage.sources:parseJson<ResearchSource[]>(row?.sources_json,[]),sources=mergeSources(baseSources,...catalogRows.map(item=>item.sources));
  const models=[...new Set(catalogRows.map(item=>item.model).filter(Boolean))],stamp=now();
  await env.DB.prepare('UPDATE producers SET catalog_json=?,sources_json=?,research_model=?,researched_at=?,updated_at=? WHERE owner_id=? AND id=?').bind(JSON.stringify(deduped),JSON.stringify(sources),`${models.join(' + ')||FALLBACK_MODEL} (atomic bounded catalog)`,stamp,stamp,owner,producerId).run();
  const syncIssues:string[]=[];
  for(const item of deduped){const identityName=stripProducerCatalogPrefix(item.name,names);try{await ensureCuveeEntity(env.DB,owner,producerId,identityName,item.appellation??null,item.category??item.style??null,true)}catch(e){const error=(e as Error).message||'Unknown cuvée identity error';syncIssues.push(`${identityName}: ${error}`);log('warn',{producerId,stage:'catalog_cuvee_sync_skipped',wine:identityName,error})}}
  try{await reconcileProducerCuvees(env.DB,owner,producerId)}catch(e){const error=(e as Error).message||'Cuvée reconciliation failed';syncIssues.push(`reconciliation: ${error}`);log('warn',{producerId,stage:'catalog_reconcile_skipped',error})}
  if(corrected.hiddenCount||corrected.mergedCount)log('log',{producerId,stage:'catalog_decisions_applied',hidden:corrected.hiddenCount,merged:corrected.mergedCount});
  return {catalogCount:deduped.length,researchedCount:deduped.length,retainedCount:0,syncIssues};
}

async function submitBatch(env:Env,owner:string,producerId:string,requestId:string,attempt:number,model:string,keys:string[]){
  const producer=await env.DB.prepare('SELECT canonical_name FROM producers WHERE owner_id=? AND id=?').bind(owner,producerId).first<{canonical_name:string}>();if(!producer)throw new Error('Producer not found');
  const entries=keys.map(key=>requestForKey(producer.canonical_name,key));let googleName:string|undefined,jobId:string|undefined;
  try{
    googleName=await createGeminiBatch(env.GEMINI_API_KEY,model,`winelog-producer-${requestId}-${attempt}`,entries);
    jobId=await createResearchBatchJob(env.DB,{owner,requestId,targetKind:'producer',targetId:producerId,googleBatchName:googleName,model,attempt,keys});
    const baseCount=keys.filter(key=>parseSliceKey(key)).length,message=attempt===1?`Producer profile plus ${baseCount} bounded catalogue slices submitted to Gemini 3.7 Batch`:`Retrying only ${keys.length} failed producer research part${keys.length===1?'':'s'} with ${model}`;
    await setRunState(env.DB,owner,requestId,'running',attempt===1?'searching':'retrying',attempt,message);
    await env.RESEARCH_QUEUE.send({kind:'producer_batch_poll',owner,producerId,requestId,jobId,pollCount:0},{delaySeconds:researchBatchPollDelay(0)});log('log',{requestId,producerId,stage:'batch_submitted',attempt,model,keys,googleName});return jobId;
  }catch(e){const error=(e as Error).message||'Producer Batch submission failed';if(jobId)await finishResearchBatchJob(env.DB,owner,jobId,'failed',`Batch setup failed: ${error}`).catch(()=>undefined);if(googleName)await cancelGeminiBatch(env.GEMINI_API_KEY,googleName).catch(()=>undefined);throw e}
}
export async function startProducerBatchResearch(env:Env,owner:string,producerId:string,requestId:string){
  const keys=['profile',...catalogDefaultChunkKeys];
  try{await prepareProducerCatalogStage(env.DB,owner,producerId,requestId);await submitBatch(env,owner,producerId,requestId,1,PRIMARY_MODEL,keys);return {ok:true as const}}
  catch(e){const primaryError=(e as Error).message||'Gemini 3.7 Batch submission failed';log('warn',{requestId,producerId,stage:'primary_submit_failed',error:primaryError});try{await submitBatch(env,owner,producerId,requestId,2,FALLBACK_MODEL,keys);return {ok:true as const}}catch(fallback){const error=`Gemini 3.7 submission failed (${primaryError}); Gemini 3.6 fallback also failed: ${(fallback as Error).message||'unknown error'}`;await discardProducerCatalogStage(env.DB,owner,requestId).catch(()=>undefined);await setRunState(env.DB,owner,requestId,'failed','failed',2,error).catch(()=>undefined);return {ok:false as const,error}}}
}

async function completionMessage(db:D1Database,owner:string,producerId:string){
  const row=await db.prepare('SELECT catalog_json,profile,official_website_url,instagram_url,contact_email,contact_phone FROM producers WHERE owner_id=? AND id=?').bind(owner,producerId).first<Record<string,unknown>>();
  const catalog=parseJson<unknown>(row?.catalog_json,[]),count=Array.isArray(catalog)?catalog.length:0,profileSaved=Boolean(String(row?.profile??'').trim()),hasContact=Boolean(row?.official_website_url||row?.instagram_url||row?.contact_email||row?.contact_phone);
  return `Producer research complete · Profile ${profileSaved?'saved':'not available'} · Contacts ${hasContact?'verified':'no verified public contact found'} · Catalogue ${count} wine${count===1?'':'s'} committed atomically from bounded slices`;
}
async function failRun(env:Env,owner:string,producerId:string,requestId:string,job:ResearchBatchJob,error:string){
  await finishResearchBatchJob(env.DB,owner,job.id,'failed',error).catch(()=>undefined);await discardProducerCatalogStage(env.DB,owner,requestId).catch(()=>undefined);await setRunState(env.DB,owner,requestId,'failed','failed',job.attempt,error).catch(()=>undefined);log('error',{requestId,producerId,stage:'research_failed',attempt:job.attempt,error});
}
async function retryTransportFailure(env:Env,owner:string,producerId:string,requestId:string,job:ResearchBatchJob,error:string){
  await finishResearchBatchJob(env.DB,owner,job.id,'failed',error).catch(()=>undefined);
  if(job.attempt===1){try{await submitBatch(env,owner,producerId,requestId,2,FALLBACK_MODEL,job.keys);return}catch(e){error+=`; fallback submission failed: ${(e as Error).message}`}}
  await discardProducerCatalogStage(env.DB,owner,requestId).catch(()=>undefined);await setRunState(env.DB,owner,requestId,'failed','failed',job.attempt,error).catch(()=>undefined);log('error',{requestId,producerId,stage:'transport_failed',attempt:job.attempt,error});
}

export async function pollProducerBatchResearch(env:Env,owner:string,producerId:string,requestId:string,jobId:string,pollCount:number){
  const job=await getResearchBatchJob(env.DB,owner,jobId);if(!job||job.status!=='running')return;
  const fetched=await fetchGeminiBatch(env.GEMINI_API_KEY,job.googleBatchName);
  if(!fetched.ok){
    if(fetched.status===429||fetched.status>=500){const action=researchBatchTransientAction(job.attempt,pollCount);if(action==='retry'){await touchResearchBatchJob(env.DB,owner,job.id);await env.RESEARCH_QUEUE.send({kind:'producer_batch_poll',owner,producerId,requestId,jobId:job.id,pollCount:pollCount+1},{delaySeconds:researchBatchErrorPollDelay(pollCount)});return}}
    await retryTransportFailure(env,owner,producerId,requestId,job,fetched.error);return;
  }
  if(!isTerminalBatchState(fetched.state)){
    const action=researchBatchStallAction(job.attempt,pollCount);if(action==='retry'){await touchResearchBatchJob(env.DB,owner,job.id);await setRunState(env.DB,owner,requestId,'running',job.attempt===1?'searching':'retrying',job.attempt,`Gemini is processing ${job.keys.length} producer research part${job.keys.length===1?'':'s'}`);await env.RESEARCH_QUEUE.send({kind:'producer_batch_poll',owner,producerId,requestId,jobId:job.id,pollCount:pollCount+1},{delaySeconds:researchBatchPollDelay(pollCount)});return}
    await cancelGeminiBatch(env.GEMINI_API_KEY,job.googleBatchName).catch(()=>undefined);await retryTransportFailure(env,owner,producerId,requestId,job,`${job.model} Batch did not complete within WineLog's bounded polling window (last state ${fetched.state||'unknown'})`);return;
  }
  if(fetched.state!=='JOB_STATE_SUCCEEDED'){await retryTransportFailure(env,owner,producerId,requestId,job,String((fetched.payload.error as {message?:unknown}|undefined)?.message||`Gemini batch ended with ${fetched.state}`));return}

  await setRunState(env.DB,owner,requestId,'running','parsing',job.attempt,'Validating producer profile and staging independent catalogue slices');
  const byKey=responsesByKey(fetched.responses),failed:string[]=[],errors=new Map<string,string>(),parts:ParsedCatalogPart[]=[],names=await producerNames(env.DB,owner,producerId);
  for(const key of job.keys){
    const inline=byKey.get(key);if(!inline?.response){failed.push(key);errors.set(key,`${key}: ${inline?.error?.message||'Gemini returned no result'}`);continue}
    const text=inlineResponseText(inline),finishReason=inlineFinishReason(inline);if(finishReason==='MAX_TOKENS'){failed.push(key);errors.set(key,`${key}: output reached MAX_TOKENS`);continue}
    try{
      const parsed=parseStructuredJsonText(text);
      if(key==='profile')await saveProfile(env,owner,producerId,requestId,parsed as ProfileResult,text,inlineGroundingMetadata(inline),job.model);
      else{const slice=parseSliceKey(key);if(!slice)throw new Error('Unknown catalogue slice');const catalog=parsed as CatalogResult;if(!catalog||!Array.isArray(catalog.range))throw new Error('invalid catalogue fields');parts.push({range:normalizeCatalogRange(catalog,slice,names),slice,metadata:inlineGroundingMetadata(inline)})}
    }catch(e){failed.push(key);errors.set(key,`${key}: ${(e as Error).message}${finishReason?` (${finishReason})`:''}`);log('warn',{requestId,producerId,stage:'result_failed',key,attempt:job.attempt,finishReason,error:(e as Error).message,textLength:text.length,textPreview:text.slice(0,300)})}
  }
  if(parts.length){await setRunState(env.DB,owner,requestId,'running','saving',job.attempt,`Staging ${parts.length} validated catalogue slice${parts.length===1?'':'s'}; the visible range remains unchanged until coverage is complete`);try{await stageCatalogParts(env,owner,producerId,requestId,parts,job.model)}catch(e){const error=`catalog stage: ${(e as Error).message}`;for(const part of parts){failed.push(part.slice.key);errors.set(part.slice.key,error)}}}

  let catalogSummary:CatalogSaveSummary|null=null,finalizeError='';
  try{catalogSummary=await finalizeCatalogStage(env,owner,producerId,requestId)}catch(e){finalizeError=(e as Error).message||'Catalogue finalization failed'}
  if(finalizeError){
    await finishResearchBatchJob(env.DB,owner,job.id,'failed',finalizeError).catch(()=>undefined);
    if(job.attempt===1){
      try{await clearProducerCatalogSliceStage(env.DB,owner,requestId);const retryKeys=[...new Set([...failed.filter(key=>key==='profile'),...catalogDefaultChunkKeys])];await submitBatch(env,owner,producerId,requestId,2,FALLBACK_MODEL,retryKeys);return}
      catch(e){await failRun(env,owner,producerId,requestId,job,`${finalizeError}; focused full-catalog fallback could not be submitted: ${(e as Error).message}`);return}
    }
    await discardProducerCatalogStage(env.DB,owner,requestId).catch(()=>undefined);await setRunState(env.DB,owner,requestId,'failed','failed',job.attempt,`${finalizeError}. The previous visible catalogue was kept unchanged.`);return;
  }

  const uniqueFailed=[...new Set(failed)];await finishResearchBatchJob(env.DB,owner,job.id,uniqueFailed.length?'failed':'complete',uniqueFailed.length?uniqueFailed.map(key=>errors.get(key)).filter(Boolean).join('; '):null);
  if(!uniqueFailed.length){
    if(!catalogSummary){await discardProducerCatalogStage(env.DB,owner,requestId).catch(()=>undefined);await setRunState(env.DB,owner,requestId,'failed','failed',job.attempt,'Producer research ended without complete A–Z catalogue coverage; the previous visible catalogue was kept unchanged.');return}
    const message=await completionMessage(env.DB,owner,producerId);await discardProducerCatalogStage(env.DB,owner,requestId).catch(()=>undefined);await setRunState(env.DB,owner,requestId,'complete','complete',job.attempt,message);log('log',{requestId,producerId,stage:'complete',attempt:job.attempt,catalogSummary});return;
  }

  if(job.attempt===1){try{await submitBatch(env,owner,producerId,requestId,2,FALLBACK_MODEL,uniqueFailed);return}catch(e){await failRun(env,owner,producerId,requestId,job,`Could not submit focused fallback for ${uniqueFailed.join(', ')}: ${(e as Error).message}`);return}}
  if(uniqueFailed.includes('profile')&&catalogSummary){
    try{await submitBatch(env,owner,producerId,requestId,job.attempt+1,FALLBACK_MODEL,['profile']);return}catch(e){await discardProducerCatalogStage(env.DB,owner,requestId).catch(()=>undefined);await setRunState(env.DB,owner,requestId,'failed','failed',job.attempt+1,`Catalogue refresh was committed, but profile retry could not be submitted: ${(e as Error).message}`);return}
  }
  if(uniqueFailed.includes('profile')){await discardProducerCatalogStage(env.DB,owner,requestId).catch(()=>undefined);await setRunState(env.DB,owner,requestId,'failed','failed',job.attempt,`The previous visible catalogue was kept unchanged, and profile research failed after fallback: ${errors.get('profile')}`);return}
  const retryKeys:string[]=[];let retryable=true;
  for(const key of uniqueFailed){const error=errors.get(key)??'',slice=parseSliceKey(key);if(!slice||!deterministicCatalogError(error)){retryable=false;break}const children=splitSlice(slice);if(!children.length){retryable=false;break}retryKeys.push(...children.map(child=>child.key))}
  if(retryable&&retryKeys.length&&job.attempt<MAX_CATALOG_ATTEMPT){try{await submitBatch(env,owner,producerId,requestId,job.attempt+1,FALLBACK_MODEL,[...new Set(retryKeys)]);return}catch(e){await discardProducerCatalogStage(env.DB,owner,requestId).catch(()=>undefined);await setRunState(env.DB,owner,requestId,'failed','failed',job.attempt+1,`The previous visible catalogue was kept unchanged; smaller-slice retry could not be submitted: ${(e as Error).message}`);return}}
  const errorText=uniqueFailed.map(key=>errors.get(key)).filter(Boolean).join('; ');await discardProducerCatalogStage(env.DB,owner,requestId).catch(()=>undefined);await setRunState(env.DB,owner,requestId,'failed','failed',job.attempt,`The previous visible catalogue was kept unchanged because ${uniqueFailed.length} bounded research part${uniqueFailed.length===1?'':'s'} could not be completed: ${errorText}`);
}
