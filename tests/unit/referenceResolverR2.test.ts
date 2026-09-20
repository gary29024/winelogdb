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
 const lwinManifest:ReferenceManifest={provider:'lwin',version:'l1',prefix:'reference/lwin/versions/l1',shardCount:256,rows:1,source:'LWIN.xlsx',sourceUpdatedAt:null,generatedAt:'now',redirectsKey:'reference/lwin/versions/l1/redirects.json',producerIndexKey:'reference/lwin/versions/l1/producer-index.json'};
 const elidManifest:ReferenceManifest={provider:'elid',version:'e1',prefix:'reference/elid/versions/e1',shardCount:256,rows:1,source:'elid.wine',sourceUpdatedAt:null,generatedAt:'now',producerIndexKey:'reference/elid/versions/e1/producer-index.json'};
 const lwinShard=referenceShardId('krug'),elidShard=referenceShardId('FR-KRUG');
 return {
  'reference/lwin/current.json':lwinManifest,
  [`reference/lwin/versions/l1/shard-${lwinShard}.json`]:[lwin],
  'reference/lwin/versions/l1/producer-index.json':{'krug':[lwinShard]},
  'reference/lwin/versions/l1/redirects.json':{},
  'reference/elid/current.json':elidManifest,
  'reference/elid/versions/e1/producer-index.json':{'krug':['FR-KRUG'],'champagne krug':['FR-KRUG']},
  [`reference/elid/versions/e1/shard-${elidShard}.json`]:[elid]
 };
}

describe('R2 wine reference resolver',()=>{
 it('uses structured titles to distinguish Maison and Domaine when both display names omit them',async()=>{
  const data=objects(),shard=referenceShardId('fang');
  const maison={...lwin,productKey:'lwin:3061244',lwin7:'3061244',displayName:'Fang, Cuvee Zephyr',producerTitle:'Maison',producerName:'Fang',producerKey:'fang',wineName:'Cuvee Zephyr',wineKey:'cuvee zephyr'};
  data[`reference/lwin/versions/l1/shard-${shard}.json`]=[maison,{...maison,productKey:'lwin:3061245',lwin7:'3061245',producerTitle:'Domaine'}];
  (data['reference/lwin/versions/l1/producer-index.json'] as Record<string,string[]>).fang=[shard];
  const b=bucket(data);
  expect(await resolveWineReference(b,{producer:'Maison FANG',wineName:'Cuvée Zéphyr'})).toMatchObject({identityMatchStatus:'matched',lwin7:'3061244',referenceProducer:'Maison Fang'});
  expect(await resolveWineReference(b,{producer:'Domaine FANG',wineName:'Cuvée Zéphyr'})).toMatchObject({identityMatchStatus:'matched',lwin7:'3061245',referenceProducer:'Domaine Fang'});
  expect(await resolveWineReference(b,{producer:'FANG',wineName:'Cuvée Zéphyr'})).toMatchObject({identityMatchStatus:'ambiguous',lwin7:null});
 });
 it('matches an edition-specific LWIN and only attaches a registry-backed ELID',async()=>{
  const result=await resolveWineReference(bucket(objects()),{producer:'Krug',wineName:'Grande Cuvée',releaseDesignation:'171ème Édition',vintage:null,vintageKind:'non_vintage',country:'France',region:'Champagne',style:'sparkling'});
  expect(result).toMatchObject({identityMatchStatus:'matched',lwin7:'1234567',elid:'FR-CMP-KRUG01-N171',productSubtype:'Sparkling'});
 });
 it('uses the official display identity for sparse LWIN rows and keeps domaine/maison distinct',async()=>{
  const data=objects(),castagnierShard=referenceShardId('castagnier'),path=`reference/lwin/versions/l1/shard-${castagnierShard}.json`;
  const domaine={...lwin,productKey:'lwin:1724273',lwin7:'1724273',displayName:'Domaine Castagnier, Chambolle-Musigny',producerTitle:'Domaine',producerName:'Castagnier',producerKey:'castagnier',wineName:null,wineKey:'',region:'Burgundy',regionKey:'burgundy',subRegion:'Chambolle-Musigny',colour:'Red',colourKey:'red',productSubtype:'Still'};
  const maison={...domaine,productKey:'lwin:1724274',lwin7:'1724274',displayName:'Maison Castagnier, Chambolle-Musigny',producerTitle:'Maison'};
  data[path]=[...((data[path] as LwinReferenceProduct[]|undefined)??[]),domaine,maison];
  (data['reference/lwin/versions/l1/producer-index.json'] as Record<string,string[]>)['castagnier']=[castagnierShard];
  const estate=await resolveWineReference(bucket(data),{producer:'Domaine Castagnier',wineName:'Chambolle-Musigny',vintage:2022,vintageKind:'vintage',country:'France',region:'Burgundy',style:'red'});
  expect(estate).toMatchObject({identityMatchStatus:'matched',lwin7:'1724273',referenceProducer:'Domaine Castagnier',referenceWineName:'Chambolle-Musigny'});
  const negociant=await resolveWineReference(bucket(data),{producer:'Maison Castagnier',wineName:'Chambolle-Musigny',vintage:2022,vintageKind:'vintage',country:'France',region:'Burgundy',style:'red'});
  expect(negociant).toMatchObject({identityMatchStatus:'matched',lwin7:'1724274',referenceProducer:'Maison Castagnier'});
  const bare=await resolveWineReference(bucket(data),{producer:'Castagnier',wineName:'Chambolle-Musigny',vintage:2022,vintageKind:'vintage',country:'France',region:'Burgundy',style:'red'});
  expect(bare.identityMatchStatus).toBe('ambiguous');expect(bare.lwin7).toBeNull();expect(bare.identityMatchCandidates).toEqual(['1724273','1724274']);
 });
 it('keeps the structured producer name as an accepted alias on ordinary populated rows',async()=>{
  const data=objects(),shard=referenceShardId('margaux'),path=`reference/lwin/versions/l1/shard-${shard}.json`;
  const row={...lwin,productKey:'lwin:1000001',lwin7:'1000001',displayName:'Chateau Margaux, Chateau Margaux',producerTitle:'Chateau',producerName:'Margaux',producerKey:'margaux',wineName:'Chateau Margaux',wineKey:'chateau margaux',region:'Bordeaux',regionKey:'bordeaux',colour:'Red',colourKey:'red',productSubtype:'Still'};
  data[path]=[row];const index=data['reference/lwin/versions/l1/producer-index.json'] as Record<string,string[]>;index.margaux=[shard];index['chateau margaux']=[shard];
  const bare=await resolveWineReference(bucket(data),{producer:'Margaux',wineName:'Chateau Margaux',country:'France',region:'Bordeaux',style:'red'});
  const display=await resolveWineReference(bucket(data),{producer:'Chateau Margaux',wineName:'Chateau Margaux',country:'France',region:'Bordeaux',style:'red'});
  expect(bare).toMatchObject({identityMatchStatus:'matched',lwin7:'1000001'});expect(display).toMatchObject({identityMatchStatus:'matched',lwin7:'1000001'});
 });
 it('tries both qualified and stripped producer shards when an older manifest has no producer index',async()=>{
  const data=objects(),manifest=data['reference/lwin/current.json'] as ReferenceManifest,records=data as Record<string,unknown>;delete manifest.producerIndexKey;delete records['reference/lwin/versions/l1/producer-index.json'];
  const shard=referenceShardId('castagnier'),path=`reference/lwin/versions/l1/shard-${shard}.json`;
  data[path]=[{...lwin,productKey:'lwin:1724273',lwin7:'1724273',displayName:'Domaine Castagnier, Chambolle-Musigny',producerName:'Castagnier',producerKey:'castagnier',wineName:null,wineKey:'',region:'Burgundy',regionKey:'burgundy',colour:'Red',colourKey:'red',productSubtype:'Still'}];
  const result=await resolveWineReference(bucket(data),{producer:'Domaine Castagnier',wineName:'Chambolle-Musigny',country:'France',region:'Burgundy',style:'red'});
  expect(result).toMatchObject({identityMatchStatus:'matched',lwin7:'1724273'});
 });
 it('falls back to a base LWIN wine row when the export does not carry edition-specific rows',async()=>{
  const data=objects(),shard=referenceShardId('krug'),key=`reference/lwin/versions/l1/shard-${shard}.json`;
  data[key]=[{...lwin,displayName:'Krug, Grande Cuvee',wineName:'Grande Cuvee',wineKey:'grande cuvee'}];
  const result=await resolveWineReference(bucket(data),{producer:'Krug',wineName:'Grande Cuvée',releaseDesignation:'171ème Édition',vintage:null,vintageKind:'non_vintage',country:'France',region:'Champagne',style:'sparkling'});
  expect(result).toMatchObject({identityMatchStatus:'matched',lwin7:'1234567',elid:'FR-CMP-KRUG01-N171'});
 });
 it('prefers an edition-specific LWIN row over the base-family fallback',async()=>{
  const data=objects(),shard=referenceShardId('krug'),key=`reference/lwin/versions/l1/shard-${shard}.json`;
  data[key]=[lwin,{...lwin,productKey:'lwin:7654321',lwin7:'7654321',displayName:'Krug, Grande Cuvee',wineName:'Grande Cuvee',wineKey:'grande cuvee'}];
  const result=await resolveWineReference(bucket(data),{producer:'Krug',wineName:'Grande Cuvée',releaseDesignation:'171ème Édition',vintageKind:'non_vintage'});
  expect(result).toMatchObject({identityMatchStatus:'matched',lwin7:'1234567'});
 });
 it('follows Combined redirects across producer shards to the current Live identity',async()=>{
  const data=objects(),sourceShard=referenceShardId('krug'),sourceKey=`reference/lwin/versions/l1/shard-${sourceShard}.json`;
  const middleKey='renamed producer',middleShard=referenceShardId(middleKey),middlePath=`reference/lwin/versions/l1/shard-${middleShard}.json`;
  const liveKey='current producer',liveShard=referenceShardId(liveKey),livePath=`reference/lwin/versions/l1/shard-${liveShard}.json`;
  const first={...lwin,productKey:'lwin:1111111',lwin7:'1111111',status:'Combined' as const,referenceLwin7:'2222222'};
  const middle={...lwin,productKey:'lwin:2222222',lwin7:'2222222',status:'Combined' as const,referenceLwin7:'1234567',producerName:'Renamed Producer',producerKey:middleKey};
  const current={...lwin,producerName:'Current Producer',producerKey:liveKey};
  data[sourceKey]=[first];data[middlePath]=[middle];data[livePath]=[current];
  data['reference/lwin/versions/l1/redirects.json']={
   '1111111':{targetLwin7:'2222222',targetShard:middleShard},
   '2222222':{targetLwin7:'1234567',targetShard:liveShard}
  };
  const result=await resolveWineReference(bucket(data),{producer:'Krug',wineName:'Grande Cuvée',releaseDesignation:'171ème Édition'});
  expect(result).toMatchObject({identityMatchStatus:'matched',lwin7:'1234567'});
 });
 it('ignores Deleted duplicates when a current Live identity exists',async()=>{
  const data=objects(),shard=referenceShardId('krug'),key=`reference/lwin/versions/l1/shard-${shard}.json`;
  data[key]=[lwin,{...lwin,productKey:'lwin:7654321',lwin7:'7654321',status:'Deleted' as const}];
  const result=await resolveWineReference(bucket(data),{producer:'Krug',wineName:'Grande Cuvée',releaseDesignation:'171ème Édition'});
  expect(result).toMatchObject({identityMatchStatus:'matched',lwin7:'1234567'});
 });
 it('does not match a Deleted identity when no current candidate exists',async()=>{
  const data=objects(),shard=referenceShardId('krug'),key=`reference/lwin/versions/l1/shard-${shard}.json`;
  data[key]=[{...lwin,status:'Deleted' as const}];
  const result=await resolveWineReference(bucket(data),{producer:'Krug',wineName:'Grande Cuvée',releaseDesignation:'171ème Édition'});
  expect(result.identityMatchStatus).toBe('unmatched');expect(result.lwin7).toBeNull();
 });
 it('does not guess when two non-deleted LWIN rows have the same narrowed identity',async()=>{
  const data=objects(),shard=referenceShardId('krug'),key=`reference/lwin/versions/l1/shard-${shard}.json`;
  data[key]=[lwin,{...lwin,productKey:'lwin:7654321',lwin7:'7654321'}];
  const result=await resolveWineReference(bucket(data),{producer:'Krug',wineName:'Grande Cuvée',releaseDesignation:'171ème Édition'});
  expect(result.identityMatchStatus).toBe('ambiguous');expect(result.lwin7).toBeNull();expect(result.identityMatchCandidates).toEqual(['1234567','7654321']);
 });
 it('canonicalizes LWIN geography and only composes LWIN11 where the vintage is provable',async()=>{
  const data=objects(),shard=referenceShardId('krug'),key=`reference/lwin/versions/l1/shard-${shard}.json`;
  data[key]=[{...lwin,region:'Bourgogne',regionKey:'bourgogne',site:'Côte de Nuits',parcel:'Les Suchots',vintageConfig:'sequential',firstVintage:2000,finalVintage:2020}];
  const result=await resolveWineReference(bucket(data),{producer:'Krug',wineName:'Grande Cuvée',releaseDesignation:'171ème Édition',vintage:2019,vintageKind:'vintage',country:'France',region:'Burgundy'});
  expect(result).toMatchObject({identityMatchStatus:'matched',lwin7:'1234567',lwin11:'12345672019',region:'Burgundy',referenceSite:'Côte de Nuits',referenceParcel:'Les Suchots'});

  const data2=objects();data2[key]=[{...lwin,vintageConfig:'nonSequential',firstVintage:2000,finalVintage:2020}];
  const selectedYears=await resolveWineReference(bucket(data2),{producer:'Krug',wineName:'Grande Cuvée',releaseDesignation:'171ème Édition',vintage:2019,vintageKind:'vintage'});
  expect(selectedYears.lwin11).toBeNull();
 });
 it('can match an ELID base wine name after removing the known release designation',async()=>{
  const data=objects(),lwinShard=referenceShardId('krug');
  data[`reference/lwin/versions/l1/shard-${lwinShard}.json`]=[{...lwin,wineName:'Grande Cuvée 171ème Édition',wineKey:'grande cuvee 171eme edition'}];
  const result=await resolveWineReference(bucket(data),{producer:'Krug',wineName:'Grande Cuvée 171ème Édition',releaseDesignation:'171ème Édition',vintageKind:'non_vintage'});
  expect(result.elid).toBe('FR-CMP-KRUG01-N171');
 });
 it('does not attach a specific ELID when vintage/release identity is not safely derivable',async()=>{
  const b=bucket(objects());
  const unknown=await resolveWineReference(b,{producer:'Krug',wineName:'Grande Cuvée',releaseDesignation:'171ème Édition',vintage:null,vintageKind:'unknown'});
  expect(unknown.elid).toBeNull();
  const mv=await resolveWineReference(b,{producer:'Krug',wineName:'Grande Cuvée',releaseDesignation:'MV20',vintage:null,vintageKind:'multi_vintage'});
  expect(mv.elid).toBeNull();
 });
 it('can reconcile an ELID generic producer prefix through the explicit producer index',async()=>{
  const data=objects(),elidShard=referenceShardId('FR-KRUG');
  const producerIndex=data['reference/elid/versions/e1/producer-index.json'] as Record<string,string[]>;
  delete producerIndex['champagne krug'];
  data[`reference/elid/versions/e1/shard-${elidShard}.json`]=[{...elid,producerName:'Champagne Krug',producerKey:'champagne krug'}];
  const result=await resolveWineReference(bucket(data),{producer:'Krug',wineName:'Grande Cuvée',releaseDesignation:'171ème Édition',vintageKind:'non_vintage'});
  expect(result.elid).toBe('FR-CMP-KRUG01-N171');
 });
 it('fails open when R2 itself is temporarily unavailable',async()=>{
  const wine={producer:'Krug',wineName:'Grande Cuvée',vintage:null as number|null};
  await expect(enrichRecognitionReference(bucket({},true),wine)).resolves.toEqual(wine);
 });
});
