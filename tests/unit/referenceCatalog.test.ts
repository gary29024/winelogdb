import { describe,expect,it } from 'vitest';
import { lwinRowById,lwinReferenceIdentity,producerHouseQualifier,producerLookupKeys,referenceRowsByShard,referenceShardId,type ReferenceManifest } from '../../src/lib/wine/referenceCatalog';

function bucket(objects:Record<string,unknown>,reads:Record<string,number>={}){
 return {get:async(key:string)=>{reads[key]=(reads[key]??0)+1;if(!(key in objects))return null;return {text:async()=>JSON.stringify(objects[key])}}} as unknown as R2Bucket;
}
describe('reference catalogue sharding and cache',()=>{
 it('limits global legacy lookup to explicit manual previews and the manifest shard count',async()=>{
  const reads:Record<string,number>={},objects={'reference/lwin/current.json':{prefix:'legacy',shardCount:3},'legacy/shard-002.json':[{lwin7:'2035826'}]},b=bucket(objects,reads);
  expect(await lwinRowById(b,'2035826')).toBeNull();
  expect(Object.keys(reads).filter(key=>key.includes('/shard-'))).toHaveLength(0);
  expect(await lwinRowById(b,'2035826',null,{manualPreview:true})).toEqual({lwin7:'2035826'});
  expect(Object.keys(reads).filter(key=>key.includes('/shard-'))).toHaveLength(3);
  expect(await lwinRowById(b,'9999999',null,{manualPreview:true})).toBeNull();
 });
 it.each([false,true])('uses a Schloss title alias before the legacy global scan (producer index: %s)',async indexed=>{
  const reads:Record<string,number>={},shard=referenceShardId('lieser'),row={lwin7:'1248683'};
  const manifest={prefix:'legacy',shardCount:256,...indexed?{producerIndexKey:'legacy/producers.json'}:{}};
  const objects:Record<string,unknown>={'reference/lwin/current.json':manifest,[`legacy/shard-${shard}.json`]:[row]};
  if(indexed)objects['legacy/producers.json']={'lieser':[shard]};
  const b=bucket(objects,reads);
  expect(await lwinRowById(b,'1248683','Schloss Lieser',{manualPreview:true})).toEqual(row);
  const shardReads=Object.keys(reads).filter(key=>key.includes('/shard-'));
  expect(shardReads).toContain(`legacy/shard-${shard}.json`);
  expect(shardReads.length).toBeLessThanOrEqual(indexed?1:2);
 });
 it('does not turn a catalogue read failure into an absent-code result',async()=>{
  const b={get:async(key:string)=>{if(key.endsWith('current.json'))return {text:async()=>JSON.stringify({prefix:'legacy',shardCount:3})};throw new Error('Storage unavailable')}} as unknown as R2Bucket;
  await expect(lwinRowById(b,'2035826',null,{manualPreview:true})).rejects.toThrow('Storage unavailable');
 });
 it('does not mistake a wine-brand display prefix for its structured producer',()=>{
  expect(lwinReferenceIdentity({displayName:'Timeless, Napa Valley',producerName:'Silver Oak',wineName:'Timeless'})).toMatchObject({producerName:'Silver Oak',producerKey:'silver oak',wineName:'Timeless'});
 });
 it.each(['Maison','Domaine'])('preserves %s from the structured title when the display name omits it',title=>{
  expect(lwinReferenceIdentity({displayName:'Fang, Cuvee Zephyr',producerTitle:title,producerName:'Fang',wineName:'Cuvee Zephyr'}))
   .toMatchObject({producerName:`${title} Fang`,producerKey:`${title.toLowerCase()} fang`,structuredProducerKey:'fang',wineName:'Cuvee Zephyr'});
 });
 it.each([
  ['Domaine Fang, Cuvee Zephyr','Domaine','Fang','Domaine Fang'],
  ['Maison Fang, Cuvee Zephyr','Domaine','Fang','Maison Fang'],
  [null,'Domaine','Domaine Fang','Domaine Fang'],
  ['Château Test, Wine','Chateau','Test','Château Test'],
  ['Fang, Cuvee Zephyr',null,'Fang','Fang'],
  ['Fang, Cuvee Zephyr','Maison',null,'Maison Fang']
 ])('preserves qualified and sparse producer identities: %s',(displayName,producerTitle,producerName,expected)=>{
  expect(lwinReferenceIdentity({displayName,producerTitle,producerName}).producerName).toBe(expected);
 });
 it('is deterministic and bounded',()=>{
  expect(referenceShardId('krug')).toBe(referenceShardId('krug'));
  expect(Number(referenceShardId('krug'))).toBeGreaterThanOrEqual(0);
  expect(Number(referenceShardId('krug'))).toBeLessThan(256);
 });
 it('creates conservative producer lookup aliases without guessing ownership',()=>{
  expect(producerLookupKeys('Champagne Krug')).toEqual(['champagne krug','krug']);
  expect(producerLookupKeys('Ch. Latour')).toEqual(['ch latour','latour']);
  expect(producerLookupKeys('Schloss Lieser')).toEqual(['schloss lieser','lieser']);
  expect(producerHouseQualifier('Schloss Lieser')).toBe('schloss');
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
