import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {burgundyVillageMapTarget} from '../../src/lib/places/burgundyVillageMap';
import {loadVillageMapCatalogue} from '../../src/lib/places/loadVillageMapCatalogue';
import {grandCruFor} from '../../src/lib/places/grandCruParcels/registry';
import {loadParcelEvidence} from '../../src/lib/places/grandCruParcels/evidence';

describe('Chablis Grand Cru Tier 1',()=>{
 it('enables parcel rights and evidence without domaine grouping',async()=>{
  expect(grandCruFor('inao-denom-439','chablis')).toMatchObject({slug:'chablis-grand-cru',domaineGrouping:false,evidenceFrom:['chablis-grand-cru']});
  const evidence=await loadParcelEvidence('inao-denom-439');
  expect(evidence).not.toBeNull();
  expect(Object.keys(evidence.holderDomains??{})).toHaveLength(0);
 });
 it('keeps seven official climat labels and adds no cadastral named-area layer',async()=>{
  const config=JSON.parse(readFileSync('scripts/grand-crus/chablis-grand-cru.json','utf8'));
  expect(config.namedPlots.displayLayer).toBe(false);
  const catalogue=await loadVillageMapCatalogue('chablis');
  expect(catalogue.namedPlots).toBeUndefined();
  expect(catalogue.features.some(f=>f.kind==='named_plot')).toBe(false);
  const names=['Blanchot','Bougros','Grenouilles','Les Clos','Les Preuses','Valmur','Vaudésir'];
  for(const [index,wineName] of names.entries()){
   const target=burgundyVillageMapTarget({country:'France',region:'Burgundy',appellation:'Chablis Grand Cru',classification:'grand_cru',colour:'white',wineName});
   expect(target).toMatchObject({featureId:`inao-denom-${440+index}`});
   expect(target?.namedPlotId).toBeUndefined();
  }
  expect(config.namedPlots.plots).toHaveLength(7);
  expect(config.namedPlots.unresolved.find((r:{name:string})=>r.name==='La Moutonne')).toMatchObject({sourceCandidate:null});
 });
});
