import { describe,it,expect } from 'vitest';
import { burgundyVillageMapTarget,wineDetailMapTarget } from '../../src/lib/places/burgundyVillageMap';
import { unlistedRegionalMapIds } from '../../src/lib/places/unlistedRegionalMaps';
import registry from '../../src/lib/places/burgundyRegionalMapRegistry.json';

const base={country:'France',region:'Burgundy',classification:null,productType:'Wine',productSubtype:'Still',wineName:'Les Champs'};

describe('wine page map entry point',()=>{
 it('names only built regional maps',()=>{
  expect(unlistedRegionalMapIds.every(id=>registry.maps.some(map=>map.id===id))).toBe(true);
 });
 // Region-wide appellations still match their map; the wine page just offers none.
 it.each([
  [{appellation:'Bourgogne',colour:'White',wineStyle:'white'},'bourgogne'],
  [{appellation:'Bourgogne',region:'Côte Chalonnaise',colour:'Red',wineStyle:'red'},'bourgogne'],
  [{appellation:'Bourgogne Aligoté',colour:'White',wineStyle:'white'},'bourgogne-aligote'],
  [{appellation:'Bourgogne Passe-tout-grains',colour:'Red',wineStyle:'red'},'bourgogne-passe-tout-grains'],
  [{appellation:'Bourgogne Mousseux',colour:'Red',wineStyle:'sparkling',productSubtype:'Sparkling'},'bourgogne-mousseux'],
  [{appellation:'Coteaux Bourguignons',colour:'Red',wineStyle:'red'},'coteaux-bourguignons'],
  [{appellation:'Crémant de Bourgogne',colour:'White',wineStyle:'sparkling',productSubtype:'Sparkling'},'cremant-de-bourgogne'],
 ])('offers no map for %o',(fields,villageId)=>{
  expect(burgundyVillageMapTarget({...base,...fields})).toMatchObject({villageId});
  expect(wineDetailMapTarget({...base,...fields})).toBeNull();
 });
 it.each([
  [{appellation:'Mâcon-Villages',region:'Saône-et-Loire',colour:'White',wineStyle:'white'},'macon-villages'],
  [{appellation:'Mâcon',region:'Saône-et-Loire',colour:'White',wineStyle:'white'},'macon'],
  [{appellation:'Bourgogne Côte Chalonnaise',region:'Côte Chalonnaise',colour:'Rosé',wineStyle:'rose'},'bourgogne-cote-chalonnaise'],
 ])('keeps the map for %o',(fields,villageId)=>{
  expect(wineDetailMapTarget({...base,...fields})).toMatchObject({villageId});
 });
});
