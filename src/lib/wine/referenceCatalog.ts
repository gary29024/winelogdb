export const REFERENCE_SHARDS=256;
export type ReferenceProvider='lwin'|'elid';
export type ReferenceManifest={
 provider:ReferenceProvider;version:string;prefix:string;shardCount:number;rows:number;matchableRows?:number;sparseRows?:number;
 source:string;sourceUpdatedAt:string|null;generatedAt:string;redirectsKey?:string|null;producerIndexKey?:string|null;
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
const GENERIC_PRODUCER_PREFIX=/^(?:domaine|domaines|chateau|ch|champagne|maison|weingut|bodega|bodegas|tenuta|cantina|azienda agricola)\s+/;
export function producerLookupKeys(value:string|null|undefined){
 const base=normalizeReferenceText(value);if(!base)return [];
 const keys=[base];let stripped=base;
 while(GENERIC_PRODUCER_PREFIX.test(stripped))stripped=stripped.replace(GENERIC_PRODUCER_PREFIX,'').trim();
 if(stripped&&stripped!==base)keys.push(stripped);
 return [...new Set(keys)];
}

type CacheEntry={until:number;value:unknown|null};
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

async function jsonObject<T>(bucket:R2Bucket,key:string,ttl=CACHE_MS):Promise<T|null>{
 const cache=bucketCache(bucket),now=Date.now(),hit=cache.get(key);
 if(hit){
  if(hit.until>now){cache.delete(key);cache.set(key,hit);return hit.value as T|null}
  cache.delete(key);
 }
 const object=await bucket.get(key);
 if(!object){cacheSet(cache,key,null,now+Math.min(ttl,NEGATIVE_CACHE_MS));return null}
 const value=JSON.parse(await object.text()) as T;cacheSet(cache,key,value,now+ttl);return value;
}

export async function referenceManifest(bucket:R2Bucket,provider:ReferenceProvider){
 return jsonObject<ReferenceManifest>(bucket,referenceManifestKey(provider),60_000);
}
export async function referenceRowsByShard<T>(bucket:R2Bucket,provider:ReferenceProvider,shard:string):Promise<T[]>{
 const manifest=await referenceManifest(bucket,provider);if(!manifest)return [];
 const key=`${manifest.prefix}/shard-${shard}.json`;return await jsonObject<T[]>(bucket,key)??[];
}
export async function referenceRows<T>(bucket:R2Bucket,provider:ReferenceProvider,key:string):Promise<T[]>{
 const manifest=await referenceManifest(bucket,provider);if(!manifest)return [];
 return referenceRowsByShard<T>(bucket,provider,referenceShardId(key,manifest.shardCount));
}
export async function lwinRedirects(bucket:R2Bucket):Promise<Record<string,LwinRedirect>>{
 const manifest=await referenceManifest(bucket,'lwin');if(!manifest?.redirectsKey)return {};
 return await jsonObject<Record<string,LwinRedirect>>(bucket,manifest.redirectsKey)??{};
}
export async function elidProducerIndex(bucket:R2Bucket):Promise<ElidProducerIndex>{
 const manifest=await referenceManifest(bucket,'elid');if(!manifest?.producerIndexKey)return {};
 return await jsonObject<ElidProducerIndex>(bucket,manifest.producerIndexKey)??{};
}

/**
 * Bounded candidate retrieval for one-off repair/backfill work. It deliberately
 * scans only the immutable local LWIN shards and never calls Liv-ex. Callers
 * should narrow the returned rows before sending any candidates to AI.
 */
export async function lwinProducerIndex(bucket:R2Bucket):Promise<LwinProducerIndex>{
 const manifest=await referenceManifest(bucket,'lwin');if(!manifest?.producerIndexKey)return {};
 return await jsonObject<LwinProducerIndex>(bucket,manifest.producerIndexKey)??{};
}
export async function lwinCandidateRowsForProducer<T>(bucket:R2Bucket,producer:string|null|undefined,predicate:(row:T)=>boolean,limit=20):Promise<T[]>{
 const manifest=await referenceManifest(bucket,'lwin');if(!manifest)return [];
 const index=await lwinProducerIndex(bucket),keys=producerLookupKeys(producer);
 const shardIds=new Set<string>();
 for(const key of keys){for(const shard of index[key]??[])shardIds.add(shard);for(const token of key.split(' ').filter(token=>token.length>=4))for(const shard of index[`t:${token}`]??[])shardIds.add(shard)}
 const found:T[]=[];
 for(const shard of shardIds){const rows=await referenceRowsByShard<T>(bucket,'lwin',shard);for(const row of rows)if(predicate(row)){found.push(row);if(found.length>=limit)return found}}
 return found;
}

/** Legacy bounded scan retained for maintenance tools; interactive/queue matching
 * must use the producer index above so one wine never reads all 256 shards. */
export async function lwinCandidateRows<T>(bucket:R2Bucket,predicate:(row:T)=>boolean,limit=12):Promise<T[]>{
 const manifest=await referenceManifest(bucket,'lwin');if(!manifest)return [];
 const found:T[]=[];
 for(let i=0;i<manifest.shardCount&&found.length<limit;i++){
  const shard=String(i).padStart(3,'0'),rows=await referenceRowsByShard<T>(bucket,'lwin',shard);
  for(const row of rows)if(predicate(row)){found.push(row);if(found.length>=limit)break}
 }
 return found;
}
