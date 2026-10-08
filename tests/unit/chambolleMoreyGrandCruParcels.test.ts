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
 {slug:'clos-des-lambrays',name:'Clos des Lambrays',id:'inao-denom-547',maps:['morey-saint-denis']},
 {slug:'clos-saint-denis',name:'Clos Saint-Denis',id:'inao-denom-548',maps:['morey-saint-denis']},
 {slug:'clos-de-la-roche',name:'Clos de la Roche',id:'inao-denom-544',maps:['morey-saint-denis']},
];
const tier2=new Map([['musigny',9],['bonnes-mares',13]]);
const bundle=JSON.parse(readFileSync('scripts/grand-crus/bundles/chambolle-morey.json','utf8')) as {crus:string[];villageMap:string;additionalVillageMaps:string[]};
const config=(slug:string)=>JSON.parse(readFileSync(`scripts/grand-crus/${slug}.json`,'utf8')) as {parentFeatureId:string;villageMaps:string[]};
const red={country:'France',region:'Burgundy',classification:'grand_cru',colour:'red'};

describe('Chambolle-Musigny and Morey-Saint-Denis reviewed crus',()=>{
 it('enables reviewed crus with Tier 2 grouping only after holder research',async()=>{
  for(const cru of reviewed){
   for(const map of cru.maps)expect(grandCruFor(cru.id,map)).toMatchObject({slug:cru.slug,domaineGrouping:tier2.has(cru.slug),evidenceFrom:[cru.slug]});
   const evidence=await loadParcelEvidence(cru.id);
   expect(evidence).not.toBeNull();
   expect(Object.keys(evidence.holderDomains??{})).toHaveLength(tier2.get(cru.slug)??0);
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
 it('never infers the Clos des Lambrays plot from the cru name alone',async()=>{
  const catalogue=await loadVillageMapCatalogue('morey-saint-denis');
  expect(catalogue.namedPlots?.map(layer=>layer.parentFeatureId)).toContain('inao-denom-547');
  expect(catalogue.features.filter(f=>f.kind==='named_plot'&&f.parentFeatureId==='inao-denom-547').map(f=>f.name))
   .toEqual(['Clos des Lambrays','Les Bouchots','Meix-Rentier']);
  const wine={...red,appellation:'Clos des Lambrays',wineName:'Clos des Lambrays'};
  for(const target of [wine,{...wine,referenceParcel:'Clos des Lambrays'},{...wine,referenceParcel:'Les Larrets'}]){
   const result=burgundyVillageMapTarget(target);
   expect(result).toMatchObject({villageId:'morey-saint-denis',featureId:'inao-denom-547'});
   expect(result?.namedPlotId).toBeUndefined();
  }
  expect(burgundyVillageMapTarget({...wine,referenceParcel:'Les Bouchots'})?.namedPlotId).toBe('clos-des-lambrays-plot-les-bouchots');
  expect(burgundyVillageMapTarget({...wine,referenceParcel:'Meix Rentier'})?.namedPlotId).toBe('clos-des-lambrays-plot-meix-rentier');
 });
 it('selects Clos Saint-Denis climats by exact name, apart from the Échezeaux plot of the same name',()=>{
  const wine={...red,appellation:'Clos Saint-Denis',wineName:'Clos Saint-Denis'};
  expect(burgundyVillageMapTarget(wine)).toMatchObject({villageId:'morey-saint-denis',featureId:'inao-denom-548'});
  expect(burgundyVillageMapTarget(wine)?.namedPlotId).toBeUndefined();
  expect(burgundyVillageMapTarget({...wine,referenceParcel:'Maison Brûlée'})?.namedPlotId).toBe('clos-saint-denis-plot-maison-brulee');
  expect(burgundyVillageMapTarget({...wine,referenceParcel:'Calouère'})?.namedPlotId).toBe('clos-saint-denis-plot-calouere');
  expect(burgundyVillageMapTarget({...wine,referenceParcel:'Les Chaffots'})?.namedPlotId).toBe('clos-saint-denis-plot-les-chaffots');
  const echezeaux={...red,appellation:'Échezeaux',wineName:'Échezeaux Clos Saint-Denis'};
  expect(burgundyVillageMapTarget(echezeaux)?.namedPlotId).toBe('echezeaux-plot-clos-saint-denis');
 });
 it('selects Clos de la Roche climats in Morey only, never a Clos Saint-Denis climat',async()=>{
  const plots=(await loadVillageMapCatalogue('morey-saint-denis')).features.filter(f=>f.kind==='named_plot'&&f.parentFeatureId==='inao-denom-544');
  expect(plots.map(f=>f.name)).toEqual(['Clos de la Roche','Les Chabiots','Les Fremières','Les Froichots','Les Genavrières','Les Mochamps','Monts Luisants']);
  expect(plots.every(f=>f.communes?.join()==='21442')).toBe(true);
  const wine={...red,appellation:'Clos de la Roche',wineName:'Clos de la Roche'};
  expect(burgundyVillageMapTarget(wine)?.namedPlotId).toBeUndefined();
  expect(burgundyVillageMapTarget({...wine,referenceParcel:'Les Chabiots'})?.namedPlotId).toBe('clos-de-la-roche-plot-les-chabiots');
  expect(burgundyVillageMapTarget({...wine,referenceParcel:'Monts Luisants'})?.namedPlotId).toBe('clos-de-la-roche-plot-monts-luisants');
  expect(burgundyVillageMapTarget({...wine,referenceParcel:'Les Chaffots'})?.namedPlotId).toBeUndefined();
 });
});
