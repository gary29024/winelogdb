import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {burgundyVillageMapTarget} from '../../src/lib/places/burgundyVillageMap';
import {loadVillageMapCatalogue} from '../../src/lib/places/loadVillageMapCatalogue';
import {grandCruFor} from '../../src/lib/places/grandCruParcels/registry';
import {loadParcelEvidence} from '../../src/lib/places/grandCruParcels/evidence';

// Corton bundle crus whose Tier 1 review is committed. All three appear on the three hill maps.
const maps=['aloxe-corton','ladoix','pernand-vergelesses'];
const reviewed=[
 {slug:'corton',id:'inao-denom-549'},
 {slug:'corton-charlemagne',id:'inao-denom-550'},
 {slug:'charlemagne',id:'inao-denom-476'},
];
const bundle=JSON.parse(readFileSync('scripts/grand-crus/bundles/corton.json','utf8')) as {crus:string[]};
const config=(slug:string)=>JSON.parse(readFileSync(`scripts/grand-crus/${slug}.json`,'utf8')) as {parentFeatureId:string;namedPlots?:{displayLayer?:boolean}};

describe('Corton hill Tier 1 crus',()=>{
 it('enables only reviewed crus; only Corton (Tier 2) groups holders, from the shared table',async()=>{
  for(const cru of reviewed){
   const tier2=cru.slug==='corton';
   for(const map of maps)expect(grandCruFor(cru.id,map)).toMatchObject({slug:cru.slug,domaineGrouping:tier2,evidenceFrom:[cru.slug]});
   const evidence=await loadParcelEvidence(cru.id);
   expect(evidence).not.toBeNull();
   if(!tier2)expect(Object.keys(evidence.holderDomains??{})).toHaveLength(0);
  }
  // Tier 2 (#451): links come from the shared holder table; unlinked holders keep their legal names.
  const corton=await loadParcelEvidence('inao-denom-549');
  expect(corton.holderDomains?.['515520385']).toMatchObject({name:'Maison Leroy',basis:'company-identity'});
  expect(corton.holderDomains?.['427468962']).toMatchObject({name:'Domaine Louis Latour',basis:'filing-tenant-relationship'});
  expect(corton.holderDomains?.['408975357']?.basis).toBe('succession-lead');
  expect(corton.holderDomains?.['212100101']).toBeUndefined();
  expect(corton.holderDomains?.['U21845728']).toBeUndefined();
  const hidden=bundle.crus.filter(slug=>!reviewed.some(cru=>cru.slug===slug));
  for(const slug of hidden)for(const map of maps)expect(grandCruFor(config(slug).parentFeatureId,map)).toBeUndefined();
 });
 it('adds no cadastral layer over the official INAO Corton climats',async()=>{
  for(const cru of reviewed)expect(config(cru.slug).namedPlots?.displayLayer).toBe(false);
  for(const map of maps){
   const catalogue=await loadVillageMapCatalogue(map);
   expect(catalogue.namedPlots).toBeUndefined();
   expect(catalogue.features.some(f=>f.kind==='named_plot')).toBe(false);
  }
  const wine={country:'France',region:'Burgundy',appellation:'Corton',classification:'grand_cru',colour:'red'};
  expect(burgundyVillageMapTarget({...wine,wineName:'Les Bressandes'})).toMatchObject({featureId:'inao-denom-2357'});
  expect(burgundyVillageMapTarget({...wine,wineName:'Le Rognet et Corton'})).toMatchObject({featureId:'inao-denom-2356'});
  expect(burgundyVillageMapTarget({...wine,wineName:'Les Bressandes'})?.namedPlotId).toBeUndefined();
  const white={...wine,appellation:'Corton-Charlemagne',colour:'white'};
  for(const wineName of ['Corton-Charlemagne','Le Charlemagne','Les Pougets'])expect(burgundyVillageMapTarget({...white,wineName})?.namedPlotId).toBeUndefined();
 });
});
