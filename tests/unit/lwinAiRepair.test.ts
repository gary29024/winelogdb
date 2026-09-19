import { describe,expect,it } from 'vitest';
import { deterministicRepair,repairCandidates } from '../../worker/multiUser/lwinRepair';
import { referenceShardId,type ReferenceManifest } from '../../src/lib/wine/referenceCatalog';
import type { LwinReferenceProduct } from '../../src/lib/wine/lwinImport';

function bucket(rows:LwinReferenceProduct[]){
 const manifest:ReferenceManifest={provider:'lwin',version:'v1',prefix:'reference/lwin/versions/v1',shardCount:256,rows:rows.length,source:'test',sourceUpdatedAt:null,generatedAt:'now'};
 const objects:Record<string,unknown>={'reference/lwin/current.json':manifest};
 for(const row of rows){const key=`reference/lwin/versions/v1/shard-${referenceShardId(row.producerKey)}.json`,list=(objects[key] as LwinReferenceProduct[]|undefined)??[];list.push(row);objects[key]=list}
 return {get:async(key:string)=>key in objects?{text:async()=>JSON.stringify(objects[key])}:null} as unknown as R2Bucket;
}
const product=(lwin7:string,producerName:string,wineName:string):LwinReferenceProduct=>({productKey:`lwin:${lwin7}`,lwin7,status:'Live',referenceLwin7:null,displayName:`${producerName}, ${wineName}`,producerTitle:null,producerName,wineName,producerKey:producerName.toLowerCase(),wineKey:wineName.toLowerCase(),country:'France',countryKey:'france',region:'Bordeaux',regionKey:'bordeaux',subRegion:null,site:null,parcel:null,colour:'Red',colourKey:'red',productType:'Wine',productSubtype:'Still',designation:null,classification:null,vintageConfig:'sequential',firstVintage:2000,finalVintage:2026,sourceAddedAt:null,sourceUpdatedAt:null,importedAt:'now'});

describe('AI-assisted LWIN repair candidate gate',()=>{
 it('finds plausible rows across different LWIN shards and deterministically accepts an obvious alias',async()=>{
  const rows=[product('1000001','Chateau Margaux','Margaux'),product('1000002','Domaine Test','Other Wine')];
  const candidates=await repairCandidates(bucket(rows),{id:'w1',owner_id:'owner',producer:'Chateau Margaux',wine_name:'Margaux',country:'France',region:'Bordeaux',wine_style:'red',release_designation:null});
  expect(candidates[0]?.row.lwin7).toBe('1000001');
  expect(deterministicRepair(candidates)).toMatchObject({lwin7:'1000001',method:'deterministic'});
 });
 it('does not auto-accept a weak or close candidate',async()=>{
  const rows=[product('1000001','Chateau Margaux','Pavillon Rouge'),product('1000002','Chateau Margaux','Pavillon Blanc')];
  const candidates=await repairCandidates(bucket(rows),{id:'w1',owner_id:'owner',producer:'Ch Margaux',wine_name:'Pavillon',country:'France',region:'Bordeaux',wine_style:'red',release_designation:null});
  expect(deterministicRepair(candidates)).toBeNull();
 });
});
