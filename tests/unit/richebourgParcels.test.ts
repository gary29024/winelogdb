import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {burgundyVillageMapTarget} from '../../src/lib/places/burgundyVillageMap';
import {loadVillageMapCatalogue} from '../../src/lib/places/loadVillageMapCatalogue';
import {grandCruFor} from '../../src/lib/places/grandCruParcels/registry';
import {loadParcelEvidence} from '../../src/lib/places/grandCruParcels/evidence';
import named from '../../src/lib/places/grandCruParcels/richebourg.named-plots.json';
import report from '../../scripts/grand-crus/reports/richebourg-named-plots.json';

const wine={country:'France',region:'Burgundy',appellation:'Richebourg',classification:'grand_cru',colour:'red',wineName:'Richebourg'};
describe('Richebourg Tier 1',()=>{
 it('adds both named areas alongside Échezeaux with their own parent and source',async()=>{
  const catalogue=await loadVillageMapCatalogue('vosne-romanee');
  expect(catalogue.namedPlots?.map(layer=>layer.parentFeatureId)).toEqual(['inao-denom-565','inao-denom-1083']);
  expect(catalogue.features.filter(f=>f.parentFeatureId==='inao-denom-1083')).toEqual(named.features);
  expect(catalogue.namedPlots?.find(layer=>layer.parentFeatureId==='inao-denom-1083')?.source.sha256).toBe(report.source.sha256);
  const raw=readFileSync('public'+named.dataUrl,'utf8').replace(/\r\n/g,'\n');
  expect(createHash('sha256').update(raw).digest('hex')).toBe(report.sha256);
  expect(report.unmappedHa).toBeGreaterThan(0);
  expect(report.plots.map(p=>p.parts)).toEqual([3,5]);
 });
 it('selects only exact reviewed names inside the proven Richebourg identity',()=>{
  for(const feature of named.features){
   expect(burgundyVillageMapTarget({...wine,wineName:feature.name})).toMatchObject({featureId:'inao-denom-1083',namedPlotId:feature.id});
   expect(burgundyVillageMapTarget({...wine,referenceParcel:feature.sourceName})).toMatchObject({featureId:'inao-denom-1083',namedPlotId:feature.id});
  }
  for(const wineName of ['Les Richebourgs / Les Vérroilles ou Richebourgs','Unknown parcel','Les Richebourgs et Les Vérroilles ou Richebourgs']){
   const target=burgundyVillageMapTarget({...wine,wineName});
   expect(target?.featureId).toBe('inao-denom-1083');expect(target?.namedPlotId).toBeUndefined();
  }
  expect(burgundyVillageMapTarget({...wine,colour:'white'})).toBeNull();
  expect(burgundyVillageMapTarget({...wine,referenceSite:'Échezeaux Les Richebourgs'})).toBeNull();
  expect(burgundyVillageMapTarget({...wine,appellation:'Échezeaux',wineName:'Les Richebourgs'})?.namedPlotId).toBeUndefined();
 });
 it('enables only the audited Vosne cru and keeps rights separate from farming',async()=>{
  expect(grandCruFor('inao-denom-1083','vosne-romanee')).toMatchObject({slug:'richebourg',domaineGrouping:false,evidenceFrom:['richebourg']});
  const evidence=await loadParcelEvidence('inao-denom-1083');
  expect(evidence).not.toBeNull();
  expect(Object.keys(evidence.holderDomains??{})).toHaveLength(0);
 });
});
