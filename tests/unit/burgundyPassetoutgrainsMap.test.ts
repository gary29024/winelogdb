import {describe,it,expect} from 'vitest';
import {burgundyVillageMapTarget} from '../../src/lib/places/burgundyVillageMap';
import {loadVillageMapCatalogue} from '../../src/lib/places/loadVillageMapCatalogue';

const base={country:'France',region:'Burgundy',classification:null,productType:'Wine',productSubtype:'Still',appellation:'Bourgogne Passe-tout-grains'};
const target={villageId:'bourgogne-passe-tout-grains',featureId:'inao-denom-394',scope:'appellation',mapKind:'regional'};

describe('Bourgogne Passe-tout-grains source overview',()=>{
 it.each([
  'Bourgogne Passe-tout-grains','Bourgogne Passe-tout-grain','Bourgogne Passetoutgrains',
  'Bourgogne Passetoutgrain','Bourgogne Passe-tous-grains','Passe-tout-grains','Passetoutgrains',
  'Bourgogne-Passe-tout-grains AOP','Bourgogne Passe-tout-grains AOC Rouge',
  'Bourgogne Passe-tout-grains Rosé','Bourgogne Passetoutgrains Clairet',
  'Bourgogne Passe-tout-grains Vieilles Vignes','Bourgogne Passetoutgrains Vieille Vigne',
 ])('reads the reviewed appellation spelling %s',appellation=>{
  expect(burgundyVillageMapTarget({...base,appellation})).toMatchObject(target);
 });
 it.each([
  ['Bourgogne','Passetoutgrain'],['Bourgogne Rouge','Passe-tout-grains'],
  ['Bourgogne Rosé','Passe-tous-grains'],['Bourgogne Clairet','Passetoutgrains'],
  ['Burgundy','Bourgogne-Passe-tout-grains'],
  ['Bourgogne Rouge Vieilles Vignes','Bourgogne Passe-tout-grains'],
  ['Bourgogne Vieille Vigne','Passe-tout-grain'],
 ])('reads the split %s + %s label',(appellation,wineName)=>{
  expect(burgundyVillageMapTarget({...base,appellation,wineName})).toMatchObject(target);
 });
 it.each(['Red','Rosé',null])('keeps appellation scope for colour %s',colour=>{
  const result=burgundyVillageMapTarget({...base,colour,wineName:'Les Champs',referenceParcel:'Les Champs'});
  expect(result).toMatchObject(target);
  expect(result).not.toHaveProperty('locationContext');
 });
 it.each(['Côte d’Or','Côte Chalonnaise','Mâconnais','Yonne','Chablis','Grand Auxerrois','Beaujolais','Rhône'])(
  'accepts origin context %s without inventing a local polygon',region=>{
   expect(burgundyVillageMapTarget({...base,region})).toMatchObject(target);
  });
 it.each([
  'Bourgogne Passe-tout-grains Gamay Pinot Noir',
  'Bourgogne Passe-tout-grains Rouge Pinot Noir Gamay Chardonnay',
  'Bourgogne Passe-tout-grains Rosé Pinot Blanc Pinot Gris',
 ])('does not treat permitted accessory grapes as white-wine evidence: %s',appellation=>{
  expect(burgundyVillageMapTarget({...base,appellation})).toMatchObject(target);
 });
 it('keeps a Pinot Blanc blend mention distinct from explicit white colour',()=>{
  expect(burgundyVillageMapTarget({...base,wineName:'Pinot Noir Gamay Pinot Blanc',colour:'Red'})).toMatchObject(target);
 });
 it.each([
  {appellation:null,wineName:'Passe-tout-grains'},
  {appellation:null,wineName:'Bourgogne Passe-tout-grains'},
  {appellation:null,referenceSite:'Bourgogne Passe-tout-grains'},
  {appellation:null,referenceParcel:'Passetoutgrains'},
  {appellation:null,producer:'Domaine Passetoutgrains'},
  {appellation:null,region:'Bourgogne Passe-tout-grains'},
  {appellation:'Bourgogne',wineName:'Gamay Pinot Noir'},
  {appellation:'Bourgogne Blanc',wineName:'Passetoutgrains'},
  {appellation:'Bourgogne Chardonnay Vieilles Vignes',wineName:'Passetoutgrains'},
  {appellation:'Bourgogne',wineName:'Domaine de Passe-tout-grains'},
  {appellation:'Bourgogne',wineName:'Domaine de Passetoutgrains',producer:'Domaine de Passetoutgrains'},
  {appellation:'Bourgogne',wineName:'Passe-tout-grains-Something'},
  {appellation:'Bourgogne',wineName:'Passetoutgrains Aligoté'},
  {appellation:'Bourgogne',wineName:'Passetoutgrains Meursault'},
  {appellation:'Bourgogne',wineName:'Passetoutgrains Montrecul'},
  {appellation:'Bourgogne Hautes Côtes de Nuits',wineName:'Passetoutgrains'},
  {appellation:'Mâcon',wineName:'Passetoutgrains'},
  {appellation:'Bourgogne Aligoté',wineName:'Passe-tous-grains'},
  {appellation:'Bourgogne Passe-tout-grains Unknown Place'},
  {appellation:'Bourgogne Passe-tout-grains Blanc'},
  {appellation:'Bourgogne Passe-tout-grains Clairet',colour:'Red'},
  {appellation:'Bourgogne Passe-tout-grains Pinot Blanc Blanc'},
  {wineName:'Pinot Blanc Blanc'},
  {colour:'White'},{wineStyle:'white'},{colour:'Red',wineStyle:'rose'},
  {wineName:'Blanc'},{wineName:'Aligoté'},{wineName:'Bourgogne Aligoté'},
  {wineName:'Mâcon-Villages'},{referenceSite:'Bouzeron'},{referenceParcel:'Chablis'},
  {wineName:'Bourgogne Mousseux'},{wineName:'Crémant de Bourgogne'},
  {wineName:'Premier Cru'},{wineName:'Grand Cru'},
  {classification:'village'},{classification:'premier_cru'},{classification:'grand_cru'},
  {country:'USA'},{region:'Bordeaux'},
  {productType:'Spirit'},{productSubtype:'Sparkling'},{wineStyle:'sparkling'},
  {identityMatchStatus:'conflict' as const},
 ])('withholds insufficient or conflicting identity %j',fields=>{
  expect(burgundyVillageMapTarget({...base,...fields})).toBeNull();
 });
 it('shows the source gap and separate red/rosé AOC without claiming a vineyard',async()=>{
  const catalogue=await loadVillageMapCatalogue('bourgogne-passe-tout-grains');
  expect(catalogue.features).toHaveLength(1);
  expect(catalogue.features[0]).toMatchObject({id:'inao-denom-394',appellationId:144,coverage:'partial',areaHa:54889.83});
  expect(catalogue.communes).toHaveLength(272);
  expect(catalogue.communes.filter(c=>c.id.startsWith('21'))).toHaveLength(90);
  expect(catalogue.communes.filter(c=>c.id.startsWith('71'))).toHaveLength(145);
  expect(catalogue.communes.filter(c=>c.id.startsWith('89'))).toHaveLength(37);
  expect(catalogue.communes.filter(c=>c.id.startsWith('69'))).toHaveLength(0);
  expect(catalogue.coverageNote).toContain('red and rosé');
  expect(catalogue.coverageNote).toContain('Rhône/Beaujolais boundaries are missing');
  expect(catalogue.geobufUrl).toBe('/maps/bourgogne-passe-tout-grains.2026-09-21.pbf.gz');
  expect(catalogue.downloadTimeoutMs).toBe(60000);
 });
});
