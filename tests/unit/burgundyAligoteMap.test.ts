import {describe,it,expect} from 'vitest';
import {burgundyVillageMapTarget} from '../../src/lib/places/burgundyVillageMap';
import {loadVillageMapCatalogue} from '../../src/lib/places/loadVillageMapCatalogue';

const base={country:'France',region:'Burgundy',classification:null,productType:'Wine',productSubtype:'Still',appellation:'Bourgogne Aligoté'};

describe('Bourgogne Aligoté source overview',()=>{
 it.each(['Bourgogne Aligoté','Bourgogne Aligote AOC','Bourgogne-Aligoté AOP','Bourgogne Aligoté Blanc','Bourgogne Aligoté White'])(
  'opens its own regional AOC for %s',appellation=>{
   expect(burgundyVillageMapTarget({...base,appellation,wineName:'Vieilles Vignes',colour:'White'}))
    .toMatchObject({villageId:'bourgogne-aligote',featureId:'inao-denom-389',scope:'appellation',mapKind:'regional'});
  });
 it.each(['Côte d’Or','Côte de Nuits','Côte de Beaune','Côte Chalonnaise','Mâconnais','Yonne','Saône-et-Loire','Chablis','Grand Auxerrois','Chablis et Grand Auxerrois'])(
  'keeps appellation scope with region %s',region=>{
   expect(burgundyVillageMapTarget({...base,region,colour:'White'})).toMatchObject({featureId:'inao-denom-389'});
  });
 it.each([
  {colour:null},{wineStyle:'white'},{wineName:'Aligoté Vieilles Vignes'},
  {wineName:'Les Champs',referenceParcel:'Les Champs'},
  {wineName:'Domaine de Chitry Vieilles Vignes',producer:'Domaine de Chitry'},
  {wineName:'Bourgogne Aligoté Vin de Bourgogne'},
 ])('does not infer a plot from label context %j',fields=>{
  const target=burgundyVillageMapTarget({...base,...fields});
  expect(target).toMatchObject({featureId:'inao-denom-389',scope:'appellation'});
  expect(target).not.toHaveProperty('locationContext');
 });
 it.each([
  {appellation:null,wineName:'Bourgogne Aligoté'},
  {appellation:null,referenceSite:'Bourgogne Aligoté'},
  {appellation:null,referenceParcel:'Bourgogne Aligoté'},
  {appellation:null,producer:'Bourgogne Aligoté'},
  {appellation:'Aligoté'},{appellation:'Bourgogne',wineName:'Aligoté'},
  {appellation:'Bourgogne',wineName:'Bourgogne Aligoté'},
  {appellation:'Bourgogne Aligoté Unknown Place'},
  {appellation:'Bourgogne Aligoté Rouge'},{appellation:'Bourgogne Aligoté Clairet'},
  {appellation:'Bourgogne Aligoté Rosé'},{appellation:'Bourgogne Aligoté Chardonnay'},
  {appellation:'Bourgogne Aligoté Pinot Noir'},{appellation:'Bourgogne Aligoté Gamay'},
  {colour:'Red'},{colour:'Rosé'},{wineStyle:'red'},{wineStyle:'rose'},
  {colour:'White',wineStyle:'red'},{wineName:'Clairet'},{wineName:'Rouge'},
  {wineName:'Chardonnay'},{wineName:'Passetoutgrain'},
  {wineName:'Bouzeron'},{referenceSite:'Bouzeron'},{wineName:'Bourgogne Chitry'},
  {wineName:'Mâcon-Villages'},{referenceParcel:'Bourgogne Côte d’Or'},
  {wineName:'Crémant de Bourgogne'},{wineName:'Bourgogne Mousseux'},
  {wineName:'Premier Cru'},{wineName:'Grand Cru'},
  {country:'USA'},{region:'Bordeaux'},{region:'Beaujolais'},{region:'Rhône'},
  {classification:'village'},{classification:'premier_cru'},{classification:'grand_cru'},
  {productType:'Spirit'},{productSubtype:'Sparkling'},{wineStyle:'sparkling'},
  {identityMatchStatus:'conflict' as const},
 ])('withholds insufficient or contradictory evidence %j',fields=>{
  expect(burgundyVillageMapTarget({...base,...fields})).toBeNull();
 });
 it('preserves Bouzeron as a separate village appellation',()=>{
  expect(burgundyVillageMapTarget({...base,appellation:'Bouzeron',region:'Côte Chalonnaise',classification:'village',colour:'White'}))
   .toMatchObject({villageId:'bouzeron',scope:'appellation'});
 });
 it('keeps the source gap visible without claiming mixed-colour scope',async()=>{
  const catalogue=await loadVillageMapCatalogue('bourgogne-aligote');
  expect(catalogue.features).toHaveLength(1);
  expect(catalogue.features[0]).toMatchObject({id:'inao-denom-389',appellationId:140,coverage:'partial',areaHa:54991.42});
  expect(catalogue.communes).toHaveLength(272);
  expect(catalogue.communes.filter(c=>c.id.startsWith('21'))).toHaveLength(90);
  expect(catalogue.communes.filter(c=>c.id.startsWith('71'))).toHaveLength(145);
  expect(catalogue.communes.filter(c=>c.id.startsWith('89'))).toHaveLength(37);
  expect(catalogue.coverageNote).toContain('white-wine production boundaries');
  expect(catalogue.coverageNote).toContain('not the complete appellation');
  expect(catalogue.colourScope).toBeUndefined();
  expect(catalogue.geobufUrl).toBe('/maps/bourgogne-aligote.2026-09-21.pbf.gz');
  expect(catalogue.downloadTimeoutMs).toBe(60000);
  expect(catalogue.communes.find(c=>c.id==='71372')?.name).toBe('Romanèche-Thorins');
 });
});
