import { describe,expect,it } from 'vitest';
import { producerHouseQualifier,producerLookupKeys,referenceRowsByShard,referenceShardId,type ReferenceManifest } from '../../src/lib/wine/referenceCatalog';

function bucket(objects:Record<string,unknown>,reads:Record<string,number>={}){
 return {get:async(key:string)=>{reads[key]=(reads[key]??0)+1;if(!(key in objects))return null;return {text:async()=>JSON.stringify(objects[key])}}} as unknown as R2Bucket;
}
describe('reference catalogue sharding and cache',()=>{
 it('is deterministic and bounded',()=>{
  expect(referenceShardId('krug')).toBe(referenceShardId('krug'));
  expect(Number(referenceShardId('krug'))).toBeGreaterThanOrEqual(0);
  expect(Number(referenceShardId('krug'))).toBeLessThan(256);
 });
 it('creates conservative producer lookup aliases without guessing ownership',()=>{
  expect(producerLookupKeys('Champagne Krug')).toEqual(['champagne krug','krug']);
  expect(producerLookupKeys('Ch. Latour')).toEqual(['ch latour','latour']);
  expect(producerLookupKeys('Cave de Tain')).toEqual(['cave de tain','de tain']);
  expect(producerLookupKeys('Caves de Tain')).toEqual(['caves de tain','de tain']);
  expect(producerHouseQualifier('Cave de Tain')).toBe('cave');
  expect(producerHouseQualifier('Caves de Tain')).toBe('cave');
  expect(producerLookupKeys('Dom Pérignon')).toEqual(['dom perignon']);
 });
 it('caches missing shards so repeated misses do not re-read R2',async()=>{
  const manifest:ReferenceManifest={provider:'lwin',version:'x',prefix:'reference/lwin/versions/x',shardCount:256,rows:0,source:'x',sourceUpdatedAt:null,generatedAt:'now'};
  const reads:Record<string,number>={},b=bucket({'reference/lwin/current.json':manifest},reads);
  await referenceRowsByShard(b,'lwin','001');await referenceRowsByShard(b,'lwin','001');
  expect(reads['reference/lwin/versions/x/shard-001.json']).toBe(1);
 });
 it('evicts old shard entries instead of growing for an isolate lifetime',async()=>{
  const manifest:ReferenceManifest={provider:'lwin',version:'x',prefix:'reference/lwin/versions/x',shardCount:256,rows:20,source:'x',sourceUpdatedAt:null,generatedAt:'now'};
  const objects:Record<string,unknown>={'reference/lwin/current.json':manifest},reads:Record<string,number>={};
  for(let i=0;i<20;i++)objects[`reference/lwin/versions/x/shard-${String(i).padStart(3,'0')}.json`]=[{i}];
  const b=bucket(objects,reads);
  for(let i=0;i<20;i++)await referenceRowsByShard(b,'lwin',String(i).padStart(3,'0'));
  await referenceRowsByShard(b,'lwin','000');
  expect(reads['reference/lwin/versions/x/shard-000.json']).toBe(2);
 });
});
