export const REFERENCE_SHARDS=256;
export type ReferenceProvider='lwin'|'elid';
export type ReferenceManifest={
 provider:ReferenceProvider;version:string;prefix:string;shardCount:number;rows:number;
 source:string;sourceUpdatedAt:string|null;generatedAt:string;redirectsKey?:string|null;
};
export type ElidReferenceRecord={
 elid:string;baseElid:string;producerCode:string;producerName:string;producerKey:string;
 wineName:string;wineKey:string;vintageCode:string;sourceUrl:string;
};

const cache=new Map<string,{until:number,value:unknown}>();
const CACHE_MS=5*60*1000;

export function referenceShardId(producerKey:string,shards=REFERENCE_SHARDS){
 let hash=2166136261;
 for(let i=0;i<producerKey.length;i++){hash^=producerKey.charCodeAt(i);hash=Math.imul(hash,16777619)}
 return String((hash>>>0)%shards).padStart(3,'0');
}
export const referenceManifestKey=(provider:ReferenceProvider)=>`reference/${provider}/current.json`;

async function jsonObject<T>(bucket:R2Bucket,key:string,ttl=CACHE_MS):Promise<T|null>{
 const hit=cache.get(key);if(hit&&hit.until>Date.now())return hit.value as T;
 const object=await bucket.get(key);if(!object)return null;
 const value=JSON.parse(await object.text()) as T;cache.set(key,{until:Date.now()+ttl,value});return value;
}

export async function referenceManifest(bucket:R2Bucket,provider:ReferenceProvider){
 return jsonObject<ReferenceManifest>(bucket,referenceManifestKey(provider),60_000);
}
export async function referenceRows<T>(bucket:R2Bucket,provider:ReferenceProvider,producerKey:string):Promise<T[]>{
 const manifest=await referenceManifest(bucket,provider);if(!manifest)return [];
 const shard=referenceShardId(producerKey,manifest.shardCount),key=`${manifest.prefix}/shard-${shard}.json`;
 return await jsonObject<T[]>(bucket,key)??[];
}
export async function lwinRedirects<T>(bucket:R2Bucket):Promise<Record<string,T>>{
 const manifest=await referenceManifest(bucket,'lwin');if(!manifest?.redirectsKey)return {};
 return await jsonObject<Record<string,T>>(bucket,manifest.redirectsKey)??{};
}
