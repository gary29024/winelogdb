export const REFERENCE_SHARDS=256;
export type ReferenceProvider='lwin'|'elid';
export type ReferenceManifest={
 provider:ReferenceProvider;version:string;prefix:string;shardCount:number;rows:number;matchableRows?:number;sparseRows?:number;
 source:string;sourceUpdatedAt:string|null;generatedAt:string;redirectsKey?:string|null;producerIndexKey?:string|null;lwinIdIndexPrefix?:string|null;
};
export type ElidReferenceRecord={
 elid:string;baseElid:string;producerCode:string;producerName:string;producerKey:string;
 wineName:string;wineKey:string;vintageCode:string;sourceUrl:string;
};
export type LwinRedirect={targetLwin7:string;targetShard:string};
export type ElidProducerIndex=Record<string,string[]>;
export type LwinProducerIndex=Record<string,string[]>;

export function normalizeReferenceText(value:string|null|undefined){
 return (value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
   .replace(/[’'`]/g,'').replace(/&/g,' and ').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
}
const GENERIC_PRODUCER_PREFIX=/^(?:domaine|domaines|chateau|ch|champagne|maison|cave|caves|weingut|bodega|bodegas|tenuta|cantina|azienda agricola|marques)\s+/;
export function producerLookupKeys(value:string|null|undefined){
 const base=normalizeReferenceText(value);if(!base)return [];
 const keys=[base];let stripped=base;
 while(GENERIC_PRODUCER_PREFIX.test(stripped))stripped=stripped.replace(GENERIC_PRODUCER_PREFIX,'').trim();
 if(stripped&&stripped!==base)keys.push(stripped);
 return [...new Set(keys)];
}
export function producerHouseQualifier(value:string|null|undefined){
 const base=normalizeReferenceText(value);if(!base)return null;
 const first=base.split(' ')[0];
 if(first==='domaine'||first==='domaines')return 'domaine';
 if(first==='chateau'||first==='ch')return 'chateau';
 if(first==='bodega'||first==='bodegas')return 'bodega';
 if(first==='cave'||first==='caves')return 'cave';
 if(first==='azienda')return 'azienda agricola';
 return ['champagne','maison','weingut','tenuta','cantina'].includes(first)?first:null;
}

export type LwinReferenceIdentitySource={
 displayName?:string|null;producerTitle?:string|null;producerName?:string|null;producerKey?:string|null;wineName?:string|null;wineKey?:string|null;
};
export function lwinReferenceIdentity(row:LwinReferenceIdentitySource){
 const display=(row.displayName??'').trim(),comma=display.indexOf(',');
 const displayProducer=comma>0?display.slice(0,comma).trim():null,displayWine=comma>0?display.slice(comma+1).trim():null;
 const structuredProducerName=row.producerName?.trim()||null,title=row.producerTitle?.trim();
 // DISPLAY_NAME may omit PRODUCER_TITLE even when the structured export has it.
 // Preserve an already-qualified display identity, and never duplicate its title.
 // A display prefix can be the wine/brand (Timeless), not its producer
 // (Silver Oak). Only borrow a display spelling/title for the same producer.
 const sameProducer=structuredProducerName&&producerLookupKeys(displayProducer).some(key=>producerLookupKeys(structuredProducerName).includes(key));
 const baseProducer=(sameProducer?displayProducer:null)||structuredProducerName||displayProducer,baseKey=normalizeReferenceText(baseProducer),titleKey=normalizeReferenceText(title);
 const producerName=baseProducer&&titleKey&&baseKey!==titleKey&&!baseKey.startsWith(`${titleKey} `)&&!producerHouseQualifier(baseProducer)?`${title} ${baseProducer}`:baseProducer;
 const wineName=row.wineName?.trim()||displayWine||null;
 return {
  producerName,producerKey:normalizeReferenceText(producerName)||normalizeReferenceText(row.producerKey),
  structuredProducerKey:normalizeReferenceText(row.producerKey)||normalizeReferenceText(structuredProducerName),
  displayWineKey:normalizeReferenceText(displayWine),wineName,wineKey:normalizeReferenceText(row.wineKey)||normalizeReferenceText(wineName)
 };
}

type CacheEntry={until:number;value:unknown|null};
// Create once per recognition request. Only resolved JSON is cached globally;
// never let one Workers request await another request's R2 I/O.
export class ReferenceReadScope{
 readonly pending=new Map<string,Promise<unknown>>();
 constructor(readonly bucket:R2Bucket){}
}
export type ReferenceSource=R2Bucket|ReferenceReadScope;
const caches=new WeakMap<R2Bucket,Map<string,CacheEntry>>();
const CACHE_MS=5*60*1000,NEGATIVE_CACHE_MS=60*1000,MAX_CACHE_ENTRIES=16;
function bucketCache(bucket:R2Bucket){let cache=caches.get(bucket);if(!cache){cache=new Map();caches.set(bucket,cache)}return cache}
function cacheSet(cache:Map<string,CacheEntry>,key:string,value:unknown|null,until:number){
 if(cache.has(key))cache.delete(key);
 while(cache.size>=MAX_CACHE_ENTRIES){const oldest=cache.keys().next().value as string|undefined;if(oldest===undefined)break;cache.delete(oldest)}
 cache.set(key,{until,value});
}

export function referenceShardId(key:string,shards=REFERENCE_SHARDS){
 let hash=2166136261;
 for(let i=0;i<key.length;i++){hash^=key.charCodeAt(i);hash=Math.imul(hash,16777619)}
 return String((hash>>>0)%shards).padStart(3,'0');
}
export const referenceManifestKey=(provider:ReferenceProvider)=>`reference/${provider}/current.json`;

async function jsonObject<T>(bucket:ReferenceSource,key:string,ttl=CACHE_MS):Promise<T|null>{
 if(bucket instanceof ReferenceReadScope){
  const hit=bucket.pending.get(key);if(hit)return hit as Promise<T|null>;
  const read=jsonObject<T>(bucket.bucket,key,ttl);
  bucket.pending.set(key,read);
  try{return await read}finally{bucket.pending.delete(key)}
 }
 const cache=bucketCache(bucket),now=Date.now(),hit=cache.get(key);
 if(hit){
  if(hit.until>now){cache.delete(key);cache.set(key,hit);return hit.value as T|null}
  cache.delete(key);
 }
 const object=await bucket.get(key);
 if(!object){cacheSet(cache,key,null,now+Math.min(ttl,NEGATIVE_CACHE_MS));return null}
 const value=JSON.parse(await object.text()) as T;cacheSet(cache,key,value,now+ttl);return value;
}

export async function referenceManifest(bucket:ReferenceSource,provider:ReferenceProvider){
 return jsonObject<ReferenceManifest>(bucket,referenceManifestKey(provider),60_000);
}
export async function referenceRowsByShard<T>(bucket:ReferenceSource,provider:ReferenceProvider,shard:string,required=false):Promise<T[]>{
 const manifest=await referenceManifest(bucket,provider);if(!manifest)return [];
 const key=`${manifest.prefix}/shard-${shard}.json`,rows=await jsonObject<T[]>(bucket,key);
 if(required&&!rows)throw new Error(`LWIN catalogue shard unavailable: ${shard}; resume to retry.`);
 return rows??[];
}
export async function referenceRows<T>(bucket:ReferenceSource,provider:ReferenceProvider,key:string):Promise<T[]>{
 const manifest=await referenceManifest(bucket,provider);if(!manifest)return [];
 return referenceRowsByShard<T>(bucket,provider,referenceShardId(key,manifest.shardCount));
}
export async function lwinRedirects(bucket:ReferenceSource):Promise<Record<string,LwinRedirect>>{
 const manifest=await referenceManifest(bucket,'lwin');if(!manifest?.redirectsKey)return {};
 return await jsonObject<Record<string,LwinRedirect>>(bucket,manifest.redirectsKey)??{};
}
export async function elidProducerIndex(bucket:ReferenceSource):Promise<ElidProducerIndex>{
 const manifest=await referenceManifest(bucket,'elid');if(!manifest?.producerIndexKey)return {};
 return await jsonObject<ElidProducerIndex>(bucket,manifest.producerIndexKey)??{};
}

/**
 * Bounded candidate retrieval for one-off repair/backfill work. It deliberately
 * scans only the immutable local LWIN shards and never calls Liv-ex. Callers
 * should narrow the returned rows before sending any candidates to AI.
 */
export async function lwinProducerIndex(bucket:ReferenceSource):Promise<LwinProducerIndex>{
 const manifest=await referenceManifest(bucket,'lwin');if(!manifest?.producerIndexKey)return {};
 return await jsonObject<LwinProducerIndex>(bucket,manifest.producerIndexKey)??{};
}
export class LwinProducerLookupTooBroadError extends Error {
 constructor(){super('LWIN producer lookup is too broad; refine the producer name or link a code before retrying.');this.name='LwinProducerLookupTooBroadError'}
}
function producerShards(index:LwinProducerIndex,producer:string|null|undefined,includeTokens=false){
 const keys=producerLookupKeys(producer),shards=new Set<string>();
 for(const key of keys){
  for(const shard of index[key]??[])shards.add(shard);
  if(includeTokens)for(const token of key.split(' ').filter(token=>token.length>=4))for(const shard of index[`t:${token}`]??[])shards.add(shard);
 }
 // Older indexes retain full producer keys even when common token entries were
 // pruned. Retrieve estate-qualified names by the whole multi-word base name.
 // This is candidate retrieval only; identity and ambiguity gates still apply.
 const bases=keys.filter(key=>!producerHouseQualifier(key)&&key.split(' ').length>=2);
 for(const [key,ids] of Object.entries(index))if(!key.startsWith('t:')&&bases.some(base=>key.startsWith(`${base} `)))for(const shard of ids)shards.add(shard);
 // Never truncate candidates: that could turn an ambiguous wine into a match.
 if(shards.size>16)throw new LwinProducerLookupTooBroadError();
 return shards;
}
export async function lwinStrictRowsForProducer<T>(bucket:ReferenceSource,producer:string|null|undefined):Promise<T[]>{
 const manifest=await referenceManifest(bucket,'lwin');if(!manifest)return [];
 const keys=producerLookupKeys(producer);if(!keys.length)return [];
 // Prefix stripping is retrieval-only. When an older manifest has no producer
 // index, try the tiny set of exact lookup-key shards instead of hashing only
 // the qualified form and missing rows stored under PRODUCER_NAME.
 const fallback=async()=>{
  const found:T[]=[],seen=new Set<string>();
  for(const key of keys){const shard=referenceShardId(key,manifest.shardCount);if(seen.has(shard))continue;seen.add(shard);found.push(...await referenceRowsByShard<T>(bucket,'lwin',shard))}
  return found;
 };
 if(!manifest.producerIndexKey)return fallback();
 const index=await lwinProducerIndex(bucket),shardIds=producerShards(index,producer);
 if(!shardIds.size)return fallback();
 const found:T[]=[];for(const shard of shardIds)found.push(...await referenceRowsByShard<T>(bucket,'lwin',shard,true));return found;
}

/** Exact-ID lookup. Explicit manual previews can search legacy imports globally. */
export async function lwinRowById<T extends {lwin7:string}>(bucket:ReferenceSource,lwin7:string,producer?:string|null,options:{manualPreview?:boolean}={}):Promise<T|null>{
 const manifest=await referenceManifest(bucket,'lwin');if(!manifest)return null;
 if(manifest.lwinIdIndexPrefix){
  const index=await jsonObject<Record<string,string>>(bucket,`${manifest.lwinIdIndexPrefix}${referenceShardId(lwin7,manifest.shardCount)}.json`);
  const shard=index?.[lwin7];if(!shard)return null;
  const rows=await referenceRowsByShard<T>(bucket,'lwin',shard);return rows.find(row=>row.lwin7===lwin7)??null;
 }
 if(options.manualPreview){
  try{
   const rows=await lwinStrictRowsForProducer<T>(bucket,producer),found=rows.find(row=>row.lwin7===lwin7);
   if(found)return found;
  }catch(error){if(!(error instanceof LwinProducerLookupTooBroadError))throw error}
  // Explicit code previews must not depend on the saved producer. Legacy
  // imports lack an ID index; read one shard at a time, bounded to 256, and
  // stop on the exact ID. Automatic matching never takes this fallback.
  if(!Number.isInteger(manifest.shardCount)||manifest.shardCount<1||manifest.shardCount>REFERENCE_SHARDS)throw new Error('Invalid LWIN catalogue shard count');
  for(let i=0;i<manifest.shardCount;i++){
   const rows=await referenceRowsByShard<T>(bucket,'lwin',String(i).padStart(3,'0'));
   const found=rows.find(row=>row.lwin7===lwin7);if(found)return found;
  }
  return null;
 }
 const rows=await lwinStrictRowsForProducer<T>(bucket,producer);return rows.find(row=>row.lwin7===lwin7)??null;
}
export async function lwinCandidateRowsForProducer<T>(bucket:ReferenceSource,producer:string|null|undefined):Promise<T[]>{
 const manifest=await referenceManifest(bucket,'lwin');if(!manifest)return [];
 if(!manifest.producerIndexKey)throw new Error('LWIN producer index is missing; rerun the LWIN reference import before AI backfill');
 const index=await lwinProducerIndex(bucket),shardIds=producerShards(index,producer,true);
 const found:T[]=[];for(const shard of shardIds)found.push(...await referenceRowsByShard<T>(bucket,'lwin',shard,true));return found;
}

/** Legacy bounded scan retained for maintenance tools; interactive/queue matching
 * must use the producer index above so one wine never reads all 256 shards. */
export async function lwinCandidateRows<T>(bucket:ReferenceSource,predicate:(row:T)=>boolean,limit=12):Promise<T[]>{
 const manifest=await referenceManifest(bucket,'lwin');if(!manifest)return [];
 const found:T[]=[];
 for(let i=0;i<manifest.shardCount&&found.length<limit;i++){
  const shard=String(i).padStart(3,'0'),rows=await referenceRowsByShard<T>(bucket,'lwin',shard);
  for(const row of rows)if(predicate(row)){found.push(row);if(found.length>=limit)break}
 }
 return found;
}
