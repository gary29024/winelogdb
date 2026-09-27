import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {burgundyVillageMapTarget} from '../../src/lib/places/burgundyVillageMap';
import {loadVillageMapCatalogue} from '../../src/lib/places/loadVillageMapCatalogue';
import registry from '../../src/lib/places/burgundyRegionalMapRegistry.json';

const base={country:'France',region:'Burgundy',classification:null,productType:'Wine',productSubtype:'Sparkling',wineStyle:'sparkling',colour:'Red',appellation:'Bourgogne Mousseux'};
const target={villageId:'bourgogne-mousseux',featureId:'inao-denom-391',scope:'appellation',mapKind:'regional'};

describe('Bourgogne Mousseux red sparkling source overview',()=>{
 it.each(['Bourgogne Mousseux','Bourgogne-Mousseux AOP','Bourgogne mousseux AOC Rouge','Bourgogne Mousseux Vieilles Vignes'])(
  'reads the recorded AOC: %s',appellation=>expect(burgundyVillageMapTarget({...base,appellation})).toMatchObject(target));
 it.each([
  {colour:null},{colour:null,wineStyle:null},{productSubtype:null},{productType:null,productSubtype:null,wineStyle:null},
  {productType:'Sparkling Wine',productSubtype:'Sparkling Wine'},
  {wineName:'Rouge mousseux'},{wineName:'Pinot Noir Gamay César'},
  {wineName:'Gamay Chardonnay Aligoté Pinot Blanc Pinot Gris Melon'},
  {appellation:'Bourgogne Mousseux Rouge Pinot Noir Gamay de Bouze Gamay de Chaudenay Chardonnay Aligoté Pinot Blanc Pinot Gris Melon'},
  {appellation:'Bourgogne',wineName:'Bourgogne Mousseux'},
  {appellation:'Bourgogne Rouge Vieilles Vignes',wineName:'Bourgogne-Mousseux'},
  {appellation:'Burgundy',wineName:'Bourgogne Mousseux'},
 ])('retains separate sparkling style and colour: %j',fields=>{
  expect(burgundyVillageMapTarget({...base,...fields})).toMatchObject(target);
 });
 it.each(['Côte d’Or','Côte Chalonnaise','Mâconnais','Yonne','Chablis','Grand Auxerrois','Beaujolais','Rhône'])(
  'keeps broad scope in %s',region=>{
   const result=burgundyVillageMapTarget({...base,region,wineName:'Les Champs',referenceParcel:'Les Champs'});
   expect(result).toMatchObject(target);
   expect(result).not.toHaveProperty('locationContext');
  });
 it.each([
  {appellation:null},{appellation:'Mousseux'},{appellation:'Bourgogne',wineName:'Mousseux'},
  {appellation:'Bourgogne',wineName:'Rouge Sparkling Pinot Noir'},
  {appellation:null,wineName:'Bourgogne Mousseux'},
  {appellation:null,referenceSite:'Bourgogne Mousseux'},
  {appellation:null,referenceParcel:'Bourgogne Mousseux'},
  {appellation:null,producer:'Bourgogne Mousseux'},
  {appellation:null,region:'Bourgogne Mousseux'},
  {appellation:'Bourgogne',wineName:'Domaine de Bourgogne-Mousseux'},
  {appellation:'Bourgogne',wineName:'Bourgogne-Mousseux',producer:'Bourgogne Mousseux'},
  {appellation:'Bourgogne',wineName:'Bourgogne-Mousseux-Something'},
  {appellation:'Bourgogne Blanc',wineName:'Bourgogne Mousseux'},
  {appellation:'Bourgogne Mousseux Unknown Place'},
  {appellation:'Bourgogne Mousseux Blanc'},{appellation:'Bourgogne Mousseux Rosé'},
  {colour:'White'},{colour:'Rosé'},{wineName:'Blanc'},{wineName:'Rosé'},{wineName:'Clairet'},
  {wineName:'Pinot Blanc Blanc'},{wineName:'Bourgogne Aligoté'},
  {wineName:'Crémant de Bourgogne'},{wineName:'Bourgogne Passe-tout-grains'},
  {wineName:'Mâcon-Villages'},{referenceSite:'Bouzeron'},{referenceParcel:'Chablis'},
  {wineName:'Grand Cru'},{wineName:'Premier Cru'},
  {classification:'village'},{classification:'premier_cru'},{classification:'grand_cru'},
  {productSubtype:'Still'},{productSubtype:'Still Wine'},
  {productType:'Still Wine'},{productType:'Spirit'},{productType:'Fortified Wine'},
  {wineStyle:'red'},{wineStyle:'white'},{wineStyle:'rose'},{wineStyle:'dessert'},
  {country:'USA'},{region:'Bordeaux'},{identityMatchStatus:'conflict' as const},
 ])('withholds insufficient or conflicting identity: %j',fields=>{
  expect(burgundyVillageMapTarget({...base,...fields})).toBeNull();
 });
 it('keeps every existing regional map restricted to still wine',()=>{
  for(const group of registry.maps.filter(group=>group.id!=='bourgogne-mousseux')){
   expect(burgundyVillageMapTarget({...base,appellation:group.name,colour:null}),group.name).toBeNull();
  }
 });
 it('retains all source communes and states the missing Rhône coverage',async()=>{
  const catalogue=await loadVillageMapCatalogue('bourgogne-mousseux');
  expect(catalogue.features).toHaveLength(1);
  expect(catalogue.features[0]).toMatchObject({id:'inao-denom-391',appellationId:141,coverage:'partial',areaHa:54988.55});
  expect(catalogue.communes).toHaveLength(272);
  for(const [department,count] of [['21',90],['71',145],['89',37],['69',0]] as const){
   expect(catalogue.communes.filter(c=>c.id.startsWith(department))).toHaveLength(count);
  }
  expect(catalogue.coverageNote).toContain('red sparkling');
  expect(catalogue.coverageNote).toContain('Rhône/Beaujolais boundaries are missing');
  expect(catalogue.geobufUrl).toBe('/maps/bourgogne-mousseux.2026-09-21.pbf.gz');
  expect(catalogue.downloadTimeoutMs).toBe(60000);
  const data=JSON.parse(readFileSync(`public${catalogue.dataUrl}`,'utf8'));
  expect(data.features).toHaveLength(273);
  expect(data.features[0].properties).toMatchObject({id:'inao-denom-391',sourceName:'Bourgogne mousseux',coverage:'partial'});
  expect(data.features.slice(1).map((f:{id:string})=>f.id).sort()).toEqual(catalogue.communes.map(c=>`commune-${c.id}`).sort());
  for(const commune of catalogue.communes){
   expect(commune.bounds![0]).toBeGreaterThanOrEqual(catalogue.bounds[0]-0.000001);
   expect(commune.bounds![1]).toBeGreaterThanOrEqual(catalogue.bounds[1]-0.000001);
   expect(commune.bounds![2]).toBeLessThanOrEqual(catalogue.bounds[2]+0.000001);
   expect(commune.bounds![3]).toBeLessThanOrEqual(catalogue.bounds[3]+0.000001);
  }
 });
});
