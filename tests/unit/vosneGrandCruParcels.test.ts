import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {burgundyVillageMapTarget} from '../../src/lib/places/burgundyVillageMap';
import {loadVillageMapCatalogue} from '../../src/lib/places/loadVillageMapCatalogue';
import {grandCruFor} from '../../src/lib/places/grandCruParcels/registry';
import {loadParcelEvidence} from '../../src/lib/places/grandCruParcels/evidence';

// Vosne-Romanée bundle crus whose Tier 1 review is committed. Each is a whole-cru
// named area (no display layer) unless its config publishes one.
const tier1=[
 {slug:'la-romanee',name:'La Romanée',id:'inao-denom-655'},
 {slug:'la-tache',name:'La Tâche',id:'inao-denom-656'},
 {slug:'la-grande-rue',name:'La Grande Rue',id:'inao-denom-654'},
];
// Tier 2 crus group recorded holders under shared-table domaine headings; holderDomains counts the holders with exactly one link.
const tier2=[
 {slug:'romanee-saint-vivant',name:'Romanée-Saint-Vivant',id:'inao-denom-1085',holderDomains:10},
 {slug:'romanee-conti',name:'Romanée-Conti',id:'inao-denom-1084',holderDomains:1},
];
const reviewed=[...tier1,...tier2];
const bundle=JSON.parse(readFileSync('scripts/grand-crus/bundles/vosne-romanee.json','utf8')) as {crus:string[]};
const config=(slug:string)=>JSON.parse(readFileSync(`scripts/grand-crus/${slug}.json`,'utf8')) as {parentFeatureId:string;namedPlots?:{displayLayer?:boolean;plots:{name:string;sourceName:string}[]}};

describe('Vosne-Romanée Tier 1 crus',()=>{
 it('enables only reviewed crus, without domaine grouping or farming claims',async()=>{
  for(const cru of tier1){
   expect(grandCruFor(cru.id,'vosne-romanee')).toMatchObject({slug:cru.slug,domaineGrouping:false,evidenceFrom:[cru.slug]});
   const evidence=await loadParcelEvidence(cru.id);
   expect(evidence).not.toBeNull();
   expect(Object.keys(evidence.holderDomains??{})).toHaveLength(0);
  }
  const hidden=bundle.crus.filter(slug=>slug!=='richebourg'&&!reviewed.some(cru=>cru.slug===slug));
  for(const slug of hidden)expect(grandCruFor(config(slug).parentFeatureId,'vosne-romanee')).toBeUndefined();
 });
 it('groups Tier 2 holders from the shared table, separate from farming',async()=>{
  for(const cru of tier2){
   expect(grandCruFor(cru.id,'vosne-romanee')).toMatchObject({slug:cru.slug,domaineGrouping:true,evidenceFrom:[cru.slug]});
   const evidence=await loadParcelEvidence(cru.id);
   expect(Object.keys(evidence.holderDomains??{})).toHaveLength(cru.holderDomains);
   expect(JSON.stringify(evidence)).not.toMatch(/currentFarmer|farmed by/);
  }
 });
 it('keeps whole-cru named areas on the official outline',async()=>{
  const layers=(await loadVillageMapCatalogue('vosne-romanee')).namedPlots?.map(layer=>layer.parentFeatureId)??[];
  for(const cru of reviewed){
   const named=config(cru.slug).namedPlots!;
   expect(named.displayLayer===false).toBe(!layers.includes(cru.id));
   if(named.displayLayer!==false)continue;
   const wine={country:'France',region:'Burgundy',appellation:cru.name,classification:'grand_cru',colour:'red',wineName:cru.name};
   for(const target of [wine,...named.plots.map(plot=>({...wine,referenceParcel:plot.sourceName}))]){
    const result=burgundyVillageMapTarget(target);
    expect(result).toMatchObject({villageId:'vosne-romanee',featureId:cru.id});
    expect(result?.namedPlotId).toBeUndefined();
   }
  }
 });
});
