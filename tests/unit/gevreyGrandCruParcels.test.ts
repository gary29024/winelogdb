import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {burgundyVillageMapTarget} from '../../src/lib/places/burgundyVillageMap';
import {loadVillageMapCatalogue} from '../../src/lib/places/loadVillageMapCatalogue';
import {grandCruFor} from '../../src/lib/places/grandCruParcels/registry';
import {loadParcelEvidence} from '../../src/lib/places/grandCruParcels/evidence';

// Extend this list only when that cru's independent Tier 1 audit is committed.
const reviewed=[
 {slug:'chambertin',name:'Chambertin',id:'inao-denom-447'},
 {slug:'chambertin-clos-de-beze',name:'Chambertin-Clos de Bèze',id:'inao-denom-448'},
 {slug:'chapelle-chambertin',name:'Chapelle-Chambertin',id:'inao-denom-475'},
 {slug:'griotte-chambertin',name:'Griotte-Chambertin',id:'inao-denom-646'},
 {slug:'charmes-chambertin',name:'Charmes-Chambertin',id:'inao-denom-477'},
 {slug:'mazoyeres-chambertin',name:'Mazoyères-Chambertin',id:'inao-denom-809'},
 {slug:'latricieres-chambertin',name:'Latricières-Chambertin',id:'inao-denom-666'},
];
const bundle=JSON.parse(readFileSync('scripts/grand-crus/bundles/gevrey-chambertin.json','utf8')) as {crus:string[]};
const config=(slug:string)=>JSON.parse(readFileSync(`scripts/grand-crus/${slug}.json`,'utf8')) as {parentFeatureId:string;namedPlots?:{displayLayer?:boolean;plots:{id:string;name:string;sourceName:string}[]}};

describe('Gevrey-Chambertin Tier 1 crus',()=>{
 it('keeps Charmes and Mazoyères membership on their separate INAO identities despite the shared geometry',()=>{
  const manifest=JSON.parse(readFileSync('src/lib/places/grandCruParcels/gevrey-chambertin.manifest.json','utf8')) as {dataUrl:string};
  const asset=JSON.parse(readFileSync(`public${manifest.dataUrl}`,'utf8')) as {features:{properties:{id:string;overlaps:{parentFeatureId:string}[]}}[]};
  const members=(parent:string)=>asset.features.filter(f=>f.properties.overlaps.some(o=>o.parentFeatureId===parent)).map(f=>f.properties.id).sort();
  expect(members('inao-denom-477')).toEqual(members('inao-denom-809'));
  for(const [slug,name,id] of [['charmes-chambertin','Charmes-Chambertin','inao-denom-477'],['mazoyeres-chambertin','Mazoyères-Chambertin','inao-denom-809']]){
   const register=JSON.parse(readFileSync(`docs/research/${slug}/register.json`,'utf8')) as {parcels:{parcelId:string}[]};
   expect(register.parcels.map(p=>p.parcelId).sort()).toEqual(members(id));
   expect(burgundyVillageMapTarget({country:'France',region:'Burgundy',appellation:name,classification:'grand_cru',colour:'red',wineName:name})).toMatchObject({featureId:id});
  }
 });
 it('enables reviewed crus with their own evidence and no inferred domaine grouping',async()=>{
  for(const cru of reviewed){
   expect(grandCruFor(cru.id,'gevrey-chambertin')).toMatchObject({slug:cru.slug,domaineGrouping:false,evidenceFrom:[cru.slug]});
   const evidence=await loadParcelEvidence(cru.id);
   expect(evidence).not.toBeNull();
   expect(Object.keys(evidence.holderDomains??{})).toHaveLength(0);
  }
  for(const slug of bundle.crus.filter(slug=>!reviewed.some(cru=>cru.slug===slug))){
   expect(grandCruFor(config(slug).parentFeatureId,'gevrey-chambertin')).toBeUndefined();
  }
 });
 it('keeps suppressed named areas on the unchanged official INAO feature',async()=>{
  const layers=(await loadVillageMapCatalogue('gevrey-chambertin')).namedPlots?.map(layer=>layer.parentFeatureId)??[];
  for(const cru of reviewed){
   const named=config(cru.slug).namedPlots!;
   expect(named.displayLayer===false).toBe(!layers.includes(cru.id));
   if(named.displayLayer!==false)continue;
   const wine={country:'France',region:'Burgundy',appellation:cru.name,classification:'grand_cru',colour:'red',wineName:cru.name};
   for(const target of [wine,...named.plots.map(plot=>({...wine,referenceParcel:plot.sourceName}))]){
    const result=burgundyVillageMapTarget(target);
    expect(result).toMatchObject({villageId:'gevrey-chambertin',featureId:cru.id});
    expect(result?.namedPlotId).toBeUndefined();
   }
  }
 });
 it('selects reviewed constituent areas while broad or unresolved wines retain the whole cru',()=>{
  for(const cru of reviewed){
   const named=config(cru.slug).namedPlots!;
   if(named.displayLayer===false)continue;
   const wine={country:'France',region:'Burgundy',appellation:cru.name,classification:'grand_cru',colour:'red',wineName:cru.name};
   for(const target of [wine,{...wine,referenceParcel:'Unknown area'}]){
    const result=burgundyVillageMapTarget(target);
    expect(result?.featureId).toBe(cru.id);
    expect(result?.namedPlotId).toBeUndefined();
   }
   for(const plot of named.plots){
    for(const referenceParcel of [plot.name,plot.sourceName]){
     expect(burgundyVillageMapTarget({...wine,referenceParcel})).toMatchObject({featureId:cru.id,namedPlotId:`${cru.slug}-plot-${plot.id}`});
    }
   }
  }
 });
 it('distinguishes the Chambertin part of Chapelle-Chambertin from a conflicting reference',()=>{
  const wine={country:'France',region:'Burgundy',appellation:'Chapelle-Chambertin',classification:'grand_cru',colour:'red',wineName:'Chapelle-Chambertin'};
  expect(burgundyVillageMapTarget(wine)).toMatchObject({featureId:'inao-denom-475'});
  expect(burgundyVillageMapTarget({...wine,referenceSite:'Chambertin'})).toBeNull();
  expect(burgundyVillageMapTarget({...wine,appellation:'Chapelle-Chambertin Chambertin'})).toBeNull();
  expect(burgundyVillageMapTarget({...wine,referenceParcel:'Les Gémeaux',wineName:'Chambertin'})?.namedPlotId).toBeUndefined();
 });
 it('preserves the stamped 2022 Chambertin application date despite the 2023 index identifier',async()=>{
  const evidence=await loadParcelEvidence('inao-denom-447');
  const events=evidence.parcels['21295000BN0034'];
  const application=events.find(e=>e.sources?.includes('eugenie-2022'));
  expect(application).toMatchObject({date:'2022-12-15'});
  expect(application?.note).toContain('does not authorise cultivation');
  expect(application?.note).toContain('unconfirmed');
 });
});
