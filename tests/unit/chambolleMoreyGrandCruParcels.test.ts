import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {burgundyVillageMapTarget} from '../../src/lib/places/burgundyVillageMap';
import {loadVillageMapCatalogue} from '../../src/lib/places/loadVillageMapCatalogue';
import {grandCruFor} from '../../src/lib/places/grandCruParcels/registry';
import {loadParcelEvidence} from '../../src/lib/places/grandCruParcels/evidence';

// Chambolle-Morey bundle crus whose Tier 1 review is committed, with the village maps they appear on.
const reviewed=[
 {slug:'musigny',name:'Musigny',id:'inao-denom-973',maps:['chambolle-musigny']},
 {slug:'bonnes-mares',name:'Bonnes-Mares',id:'inao-denom-361',maps:['chambolle-musigny','morey-saint-denis']},
 {slug:'clos-de-tart',name:'Clos de Tart',id:'inao-denom-545',maps:['morey-saint-denis']},
];
const bundle=JSON.parse(readFileSync('scripts/grand-crus/bundles/chambolle-morey.json','utf8')) as {crus:string[];villageMap:string;additionalVillageMaps:string[]};
const config=(slug:string)=>JSON.parse(readFileSync(`scripts/grand-crus/${slug}.json`,'utf8')) as {parentFeatureId:string;villageMaps:string[]};
const red={country:'France',region:'Burgundy',classification:'grand_cru',colour:'red'};

describe('Chambolle-Musigny and Morey-Saint-Denis Tier 1 crus',()=>{
 it('enables only reviewed crus, without domaine grouping or farming claims',async()=>{
  for(const cru of reviewed){
   for(const map of cru.maps)expect(grandCruFor(cru.id,map)).toMatchObject({slug:cru.slug,domaineGrouping:false,evidenceFrom:[cru.slug]});
   const evidence=await loadParcelEvidence(cru.id);
   expect(evidence).not.toBeNull();
   expect(Object.keys(evidence.holderDomains??{})).toHaveLength(0);
  }
  const hidden=bundle.crus.filter(slug=>!reviewed.some(cru=>cru.slug===slug));
  for(const slug of hidden)for(const map of config(slug).villageMaps)expect(grandCruFor(config(slug).parentFeatureId,map)).toBeUndefined();
 });
 it('selects Musigny named areas only for exact climat names',async()=>{
  const catalogue=await loadVillageMapCatalogue('chambolle-musigny');
  expect(catalogue.namedPlots?.map(layer=>layer.parentFeatureId)).toEqual(['inao-denom-973']);
  expect(catalogue.features.filter(f=>f.kind==='named_plot').map(f=>f.name)).toEqual(['Les Musigny','Les Petits Musigny']);
  const wine={...red,appellation:'Musigny',wineName:'Musigny'};
  expect(burgundyVillageMapTarget(wine)).toMatchObject({villageId:'chambolle-musigny',featureId:'inao-denom-973'});
  expect(burgundyVillageMapTarget(wine)?.namedPlotId).toBeUndefined();
  expect(burgundyVillageMapTarget({...wine,referenceParcel:'Les Petits Musigny'})?.namedPlotId).toBe('musigny-plot-les-petits-musigny');
  expect(burgundyVillageMapTarget({...wine,referenceParcel:'Les Musigny'})?.namedPlotId).toBe('musigny-plot-les-musigny');
  // La Combe d'Orveau has no cadastral crosswalk, and a neighbouring lieu-dit is never a Musigny named area.
  for(const referenceParcel of ["La Combe d'Orveau",'Les Amoureuses']){
   expect(burgundyVillageMapTarget({...wine,referenceParcel})?.namedPlotId).toBeUndefined();
  }
 });
 it('keeps Bonnes-Mares on its official outline across both communes',async()=>{
  for(const map of ['chambolle-musigny','morey-saint-denis']){
   const layers=(await loadVillageMapCatalogue(map)).namedPlots??[];
   expect(layers.map(layer=>layer.parentFeatureId)).not.toContain('inao-denom-361');
  }
  const wine={...red,appellation:'Bonnes-Mares',wineName:'Bonnes-Mares'};
  for(const target of [wine,{...wine,referenceParcel:'Les Bonnes Mares'},{...wine,referenceParcel:'Les Véroilles'}]){
   const result=burgundyVillageMapTarget(target);
   expect(result?.featureId).toBe('inao-denom-361');
   expect(result?.namedPlotId).toBeUndefined();
  }
 });
 it('keeps Clos de Tart on its official outline, whatever the cadastral name',()=>{
  const wine={...red,appellation:'Clos de Tart',wineName:'Clos de Tart'};
  for(const target of [wine,{...wine,referenceParcel:'Clos de Tart'}]){
   const result=burgundyVillageMapTarget(target);
   expect(result).toMatchObject({villageId:'morey-saint-denis',featureId:'inao-denom-545'});
   expect(result?.namedPlotId).toBeUndefined();
  }
 });
});
