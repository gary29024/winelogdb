import { describe,it,expect } from 'vitest';
import { burgundyVillageMapTarget } from '../../src/lib/places/burgundyVillageMap';
import { loadVillageMapCatalogue } from '../../src/lib/places/loadVillageMapCatalogue';
import inventory from '../../scripts/burgundy-regional-map-coverage.json';

const base={country:'France',region:'Burgundy',classification:null,productType:'Wine',productSubtype:'Still',appellation:'Bourgogne'};

describe('broad Bourgogne source overview',()=>{
 // Plain Bourgogne cannot be made from Aligoté: naming it is Bourgogne Aligoté.
 it.each(['Bourgogne Aligoté','Vin de Bourgogne Aligoté'])('reads %s in a plain Bourgogne wine name as Bourgogne Aligoté',wineName=>{
  expect(burgundyVillageMapTarget({...base,wineName})).toMatchObject({featureId:'inao-denom-389'});
 });
 it.each(['Bourgogne','Bourgogne AOC','Bourgogne Rouge','Bourgogne Blanc AOP','Bourgogne Rosé','Bourgogne Pinot Noir','Bourgogne Chardonnay'])(
  'opens only the broad overview for %s',appellation=>{
   expect(burgundyVillageMapTarget({...base,appellation,wineName:'Les Graviers'}))
    .toMatchObject({villageId:'bourgogne',featureId:'inao-denom-362',scope:'appellation',mapKind:'regional'});
  });
 it.each(['Côte d’Or','Côte de Beaune','Côte de Nuits','Côte Chalonnaise','Mâconnais','Grand Auxerrois','Yonne','Saône-et-Loire'])(
  'retains regional scope when recorded in %s',region=>{
   expect(burgundyVillageMapTarget({...base,region})).toMatchObject({featureId:'inao-denom-362'});
  });
 it.each([
  {appellation:'Burgundy'}, {appellation:null,wineName:'Bourgogne'},
  {appellation:null,referenceSite:'Bourgogne'}, {appellation:null,producer:'Domaine de Bourgogne'},
  {appellation:'Bourgogne Unknown Place'},
  {appellation:'Bourgogne Passe-tout-grains'}, {appellation:'Bourgogne Mousseux'},
  {appellation:'Crémant de Bourgogne'}, {appellation:'Coteaux Bourguignons'},
  {referenceSite:'Bourgogne Passe-tout-grains'},
  {wineName:'Bourgogne Mousseux'}, {wineName:'Bourgogne Grand Ordinaire'},
  {wineName:'Vin de Bourgogne Ordinaire'},
  {appellation:'Bourgogne Gamay'}, {wineName:'Bourgogne Gamay'}, {referenceSite:'Gamay'},
  {region:'Beaujolais'}, {region:'Rhône'}, {region:'Bordeaux'}, {country:'USA'},
  {colour:'Red',wineStyle:'white'}, {appellation:'Bourgogne Blanc',colour:'Red'},
  {appellation:'Bourgogne Pinot Noir',colour:'White'}, {appellation:'Bourgogne Chardonnay',colour:'Red'},
  {productType:'Spirit'}, {productSubtype:'Sparkling'}, {wineStyle:'sparkling'},
  {classification:'village'}, {classification:'premier_cru'}, {classification:'grand_cru'},
  {identityMatchStatus:'conflict' as const}, {wineName:'Premier Cru'},
  {wineName:'Mâcon-Villages'}, {wineName:'Mâcon'}, {referenceSite:'Pouilly-Fuissé'},
  {wineName:'Bourgogne Côte d’Or Bourgogne Chitry'},
 ])('withholds insufficient or conflicting identity %j',fields=>{
  expect(burgundyVillageMapTarget({...base,...fields})).toBeNull();
 });
 it.each([
  ['Bourgogne Côte d’Or','inao-denom-2840'],
  ['Bourgogne Hautes Côtes de Nuits','inao-denom-364'],
  ['Bourgogne Chitry','inao-denom-367'],
  ['Vin de Bourgogne Côte d’Or','inao-denom-2840'],
 ])('prefers the explicit denomination %s', (wineName,featureId)=>{
  expect(burgundyVillageMapTarget({...base,wineName})).toMatchObject({featureId});
 });
 it('does not locate a named vineyard or white-only sector from a cuvée or colour',()=>{
  for(const colour of ['Red','White','Rosé']){
   expect(burgundyVillageMapTarget({...base,colour,wineName:'Les Graviers',producer:'Domaine des Graviers'}))
    .toMatchObject({featureId:'inao-denom-362',scope:'appellation'});
  }
 });
 it('keeps regional origin wording compatible with another explicit appellation',()=>{
  for(const appellation of ['Mâcon','Mâcon-Villages']){
   expect(burgundyVillageMapTarget({...base,appellation,wineName:`${appellation} Vin de Bourgogne`})).toMatchObject({villageName:appellation});
  }
 });
 it('keeps the source gap visible and the white-only sector separately explorable',async()=>{
  const catalogue=await loadVillageMapCatalogue('bourgogne');
  expect(catalogue.communes).toHaveLength(264);
  expect(catalogue.communes.filter(c=>c.id.startsWith('21'))).toHaveLength(89);
  expect(catalogue.communes.filter(c=>c.id.startsWith('71'))).toHaveLength(138);
  expect(catalogue.communes.filter(c=>c.id.startsWith('89'))).toHaveLength(37);
  expect(catalogue.features[0]).toMatchObject({id:'inao-denom-362',coverage:'partial',areaHa:40415.01});
  expect(catalogue.features[1]).toMatchObject({id:'inao-denom-362-white-only',sectorColour:'white',areaHa:1019.37});
  expect(catalogue.features[1].communes).toHaveLength(23);
  expect(catalogue.features[1].coverage).toBeUndefined();
  expect(catalogue.notes['inao-denom-362-white-only'].note).toContain('not the whole white-wine area');
  expect(catalogue.coverageNote).toContain('not the complete appellation');
  expect(catalogue.coverageNote).toContain('Gamay is not covered');
  expect(catalogue.colourScope).toBe('overview');
  expect(inventory.appellations.flatMap(a=>a.denominations).find(d=>d.denominationId===362)?.status).toBe('partial');
 });
});
