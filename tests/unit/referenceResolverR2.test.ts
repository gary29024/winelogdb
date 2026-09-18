import { describe,expect,it } from 'vitest';
import { referenceShardId,type ReferenceManifest,type ElidReferenceRecord } from '../../src/lib/wine/referenceCatalog';
import { enrichRecognitionReference,resolveWineReference } from '../../src/lib/wine/referenceIdentity';
import type { LwinReferenceProduct } from '../../src/lib/wine/lwinImport';

function bucket(objects:Record<string,unknown>,throws=false){
 return {
  get:async(key:string)=>{
   if(throws)throw new Error('R2 temporarily unavailable');
   if(!(key in objects))return null;
   return {text:async()=>JSON.stringify(objects[key])};
  }
 } as unknown as R2Bucket;
}
const lwin:LwinReferenceProduct={
 productKey:'lwin:1234567',lwin7:'1234567',status:'Live',referenceLwin7:null,
 displayName:'Krug, Grande Cuvée 171ème Édition',producerTitle:null,producerName:'Krug',
 wineName:'Grande Cuvée 171ème Édition',producerKey:'krug',wineKey:'grande cuvee 171eme edition',
 country:'France',countryKey:'france',region:'Champagne',regionKey:'champagne',subRegion:null,site:null,parcel:null,
 colour:'White',colourKey:'white',productType:'Wine',productSubtype:'Sparkling',designation:'AOP',classification:null,
 vintageConfig:'nonSequential',firstVintage:null,finalVintage:null,sourceAddedAt:null,sourceUpdatedAt:'2026-09-16T00:00:00.000Z',importedAt:'2026-09-18T00:00:00.000Z'
};
const elid:ElidReferenceRecord={
 elid:'FR-CMP-KRUG01-N171',baseElid:'FR-CMP-KRUG01',producerCode:'FR-KRUG',producerName:'Krug',producerKey:'krug',
 wineName:'Grande Cuvée',wineKey:'grande cuvee',vintageCode:'N171',sourceUrl:'https://elid.wine/wine/FR-CMP-KRUG01-N171'
};
function objects(){
 const lwinManifest:ReferenceManifest={provider:'lwin',version:'l1',prefix:'reference/lwin/versions/l1',shardCount:256,rows:1,source:'LWIN.xlsx',sourceUpdatedAt:null,generatedAt:'now',redirectsKey:'reference/lwin/versions/l1/redirects.json'};
 const elidManifest:ReferenceManifest={provider:'elid',version:'e1',prefix:'reference/elid/versions/e1',shardCount:256,rows:1,source:'elid.wine',sourceUpdatedAt:null,generatedAt:'now',producerIndexKey:'reference/elid/versions/e1/producer-index.json'};
 const lwinShard=referenceShardId('krug'),elidShard=referenceShardId('FR-KRUG');
 return {
  'reference/lwin/current.json':lwinManifest,
  [`reference/lwin/versions/l1/shard-${lwinShard}.json`]:[lwin],
  'reference/lwin/versions/l1/redirects.json':{},
  'reference/elid/current.json':elidManifest,
  'reference/elid/versions/e1/producer-index.json':{'krug':['FR-KRUG'],'champagne krug':['FR-KRUG']},
  [`reference/elid/versions/e1/shard-${elidShard}.json`]:[elid]
 };
}

describe('R2 wine reference resolver',()=>{
 it('matches an edition-specific LWIN and only attaches a registry-backed ELID',async()=>{
  const result=await resolveWineReference(bucket(objects()),{producer:'Krug',wineName:'Grande Cuvée',releaseDesignation:'171ème Édition',vintage:null,vintageKind:'non_vintage',country:'France',region:'Champagne',style:'sparkling'});
  expect(result).toMatchObject({identityMatchStatus:'matched',lwin7:'1234567',elid:'FR-CMP-KRUG01-N171',productSubtype:'Sparkling'});
 });
 it('follows a Combined-to-Combined redirect chain to the current Live identity',async()=>{
  const data=objects(),shard=referenceShardId('krug'),key=`reference/lwin/versions/l1/shard-${shard}.json`;
  const first={...lwin,productKey:'lwin:1111111',lwin7:'1111111',status:'Combined' as const,referenceLwin7:'2222222'};
  data[key]=[first];
  data['reference/lwin/versions/l1/redirects.json']={
   '1111111':{targetLwin7:'2222222',targetShard:shard},
   '2222222':{targetLwin7:'1234567',targetShard:shard}
  };
  data[key]=[first,{...lwin,productKey:'lwin:2222222',lwin7:'2222222',status:'Combined',referenceLwin7:'1234567'},lwin];
  const result=await resolveWineReference(bucket(data),{producer:'Krug',wineName:'Grande Cuvée',releaseDesignation:'171ème Édition'});
  expect(result).toMatchObject({identityMatchStatus:'matched',lwin7:'1234567'});
 });
 it('does not guess when two LWIN rows have the same narrowed identity',async()=>{
  const data=objects(),shard=referenceShardId('krug'),key=`reference/lwin/versions/l1/shard-${shard}.json`;
  data[key]=[lwin,{...lwin,productKey:'lwin:7654321',lwin7:'7654321'}];
  const result=await resolveWineReference(bucket(data),{producer:'Krug',wineName:'Grande Cuvée',releaseDesignation:'171ème Édition'});
  expect(result.identityMatchStatus).toBe('ambiguous');expect(result.lwin7).toBeNull();
 });
 it('does not attach a specific ELID when vintage/release identity is not safely derivable',async()=>{
  const b=bucket(objects());
  const unknown=await resolveWineReference(b,{producer:'Krug',wineName:'Grande Cuvée',releaseDesignation:'171ème Édition',vintage:null,vintageKind:'unknown'});
  expect(unknown.elid).toBeNull();
  const mv=await resolveWineReference(b,{producer:'Krug',wineName:'Grande Cuvée',releaseDesignation:'MV20',vintage:null,vintageKind:'multi_vintage'});
  expect(mv.elid).toBeNull();
 });
 it('can reconcile a generic producer prefix through the explicit ELID producer index',async()=>{
  const data=objects(),index=data['reference/elid/versions/e1/producer-index.json'] as Record<string,string[]>;
  delete index.krug;index['champagne krug']=['FR-KRUG'];
  const changed={...lwin,producerName:'Champagne Krug',producerKey:'krug'},shard=referenceShardId('krug');
  data[`reference/lwin/versions/l1/shard-${shard}.json`]=[changed];
  const result=await resolveWineReference(bucket(data),{producer:'Krug',wineName:'Grande Cuvée',releaseDesignation:'171ème Édition',vintageKind:'non_vintage'});
  expect(result.elid).toBe('FR-CMP-KRUG01-N171');
 });
 it('fails open when R2 itself is temporarily unavailable',async()=>{
  const wine={producer:'Krug',wineName:'Grande Cuvée',vintage:null as number|null};
  await expect(enrichRecognitionReference(bucket({},true),wine)).resolves.toEqual(wine);
 });
});
