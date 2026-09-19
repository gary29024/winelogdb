import { describe,expect,it } from 'vitest';
import { deterministicRepair,repairCandidates } from '../../worker/multiUser/lwinRepair';
import { lwinReferenceIdentity,producerLookupKeys,referenceShardId,type LwinProducerIndex,type ReferenceManifest } from '../../src/lib/wine/referenceCatalog';
import type { LwinReferenceProduct } from '../../src/lib/wine/lwinImport';

function bucket(rows:LwinReferenceProduct[],reads?:string[]){
 const index:LwinProducerIndex={},indexKey='reference/lwin/versions/v1/producer-index.json';
 const manifest:ReferenceManifest={provider:'lwin',version:'v1',prefix:'reference/lwin/versions/v1',shardCount:256,rows:rows.length,source:'test',sourceUpdatedAt:null,generatedAt:'now',producerIndexKey:indexKey};
 const objects:Record<string,unknown>={'reference/lwin/current.json':manifest,[indexKey]:index};
 for(const row of rows){
  const identity=lwinReferenceIdentity(row),shard=referenceShardId(row.producerKey||identity.producerKey),key=`reference/lwin/versions/v1/shard-${shard}.json`,list=(objects[key] as LwinReferenceProduct[]|undefined)??[];list.push(row);objects[key]=list;
  const lookupKeys=new Set([...producerLookupKeys(row.producerName),...producerLookupKeys(identity.producerName)]);
  for(const lookup of lookupKeys){for(const value of [lookup,...lookup.split(' ').filter(token=>token.length>=4).map(token=>`t:${token}`)]){const shards=index[value]??[];if(!shards.includes(shard))shards.push(shard);index[value]=shards}}
 }
 for(const key of Object.keys(index))if(key.startsWith('t:')&&index[key].length>8)delete index[key];
 return {get:async(key:string)=>{reads?.push(key);return key in objects?{text:async()=>JSON.stringify(objects[key])}:null}} as unknown as R2Bucket;
}
const product=(lwin7:string,producerName:string,wineName:string):LwinReferenceProduct=>({productKey:`lwin:${lwin7}`,lwin7,status:'Live',referenceLwin7:null,displayName:`${producerName}, ${wineName}`,producerTitle:null,producerName,wineName,producerKey:producerName.toLowerCase(),wineKey:wineName.toLowerCase(),country:'France',countryKey:'france',region:'Bordeaux',regionKey:'bordeaux',subRegion:null,site:null,parcel:null,colour:'Red',colourKey:'red',productType:'Wine',productSubtype:'Still',designation:null,classification:null,vintageConfig:'sequential',firstVintage:2000,finalVintage:2026,sourceAddedAt:null,sourceUpdatedAt:null,importedAt:'now'});

describe('AI-assisted LWIN repair candidate gate',()=>{
 it('finds plausible rows across different LWIN shards and deterministically accepts an obvious alias',async()=>{
  const rows=[product('1000001','Chateau Margaux','Margaux'),product('1000002','Domaine Test','Other Wine')];
  const candidates=await repairCandidates(bucket(rows),{id:'w1',owner_id:'owner',producer:'Chateau Margaux',wine_name:'Margaux',country:'France',region:'Bordeaux',wine_style:'red',release_designation:null});
  expect(candidates[0]?.row.lwin7).toBe('1000001');
  expect(deterministicRepair(candidates)).toMatchObject({lwin7:'1000001',method:'deterministic'});
 });
 it('keeps estate and negociant display identities separate even when PRODUCER_NAME is shared',async()=>{
  const base=product('1724273','Castagnier','Placeholder'),domaine={...base,displayName:'Domaine Castagnier, Chambolle-Musigny',producerTitle:'Domaine',wineName:null,wineKey:'',region:'Burgundy',regionKey:'burgundy',subRegion:'Chambolle-Musigny'},maison={...domaine,productKey:'lwin:1724274',lwin7:'1724274',displayName:'Maison Castagnier, Chambolle-Musigny',producerTitle:'Maison'};
  const candidates=await repairCandidates(bucket([domaine,maison]),{id:'w1',owner_id:'owner',producer:'Domaine Castagnier',wine_name:'Chambolle-Musigny',country:'France',region:'Burgundy',wine_style:'red',release_designation:null});
  expect(candidates.map(item=>item.row.lwin7)).toEqual(['1724273']);
  expect(deterministicRepair(candidates)).toMatchObject({lwin7:'1724273',method:'deterministic'});
 });
 it('does not auto-accept a weak or close candidate',async()=>{
  const rows=[product('1000001','Chateau Margaux','Pavillon Rouge'),product('1000002','Chateau Margaux','Pavillon Blanc')];
  const candidates=await repairCandidates(bucket(rows),{id:'w1',owner_id:'owner',producer:'Ch Margaux',wine_name:'Pavillon',country:'France',region:'Bordeaux',wine_style:'red',release_designation:null});
  expect(deterministicRepair(candidates)).toBeNull();
 });
 it('prunes generic producer tokens so candidate lookup stays bounded',async()=>{
  const rows=Array.from({length:64},(_,i)=>product(String(2000000+i),`Chateau Producer ${i}`,`Wine ${i}`));
  rows.push(product('2999999','Chateau Margaux','Margaux'));
  const reads:string[]=[];
  const candidates=await repairCandidates(bucket(rows,reads),{id:'w1',owner_id:'owner',producer:'Chateau Margaux',wine_name:'Margaux',country:'France',region:'Bordeaux',wine_style:'red',release_designation:null});
  expect(candidates[0]?.row.lwin7).toBe('2999999');
  expect(reads.filter(key=>key.includes('/shard-')).length).toBeLessThanOrEqual(8);
 });
});
