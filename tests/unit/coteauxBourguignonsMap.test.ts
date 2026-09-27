import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {burgundyVillageMapTarget} from '../../src/lib/places/burgundyVillageMap';
import {loadVillageMapCatalogue} from '../../src/lib/places/loadVillageMapCatalogue';

const base={country:'France',region:'Burgundy',classification:null,productType:'Wine',productSubtype:'Still',appellation:'Coteaux Bourguignons'};
const target={villageId:'coteaux-bourguignons',featureId:'inao-denom-2338',scope:'appellation',mapKind:'regional'};

describe('Coteaux Bourguignons partial regional overview',()=>{
 it.each(['Coteaux Bourguignons','Coteaux-Bourguignons AOP','Coteaux Bourguignons AOC Rouge',
  'Coteaux Bourguignons Blanc','Coteaux Bourguignons Rosé','Coteaux Bourguignons Clairet',
  'Coteaux Bourguignons Vieilles Vignes','Bourgogne Grand Ordinaire','Bourgogne Ordinaire',
  'Bourgogne-Grand-Ordinaire AOC Blanc','Bourgogne Ordinaire Rosé',
 ])('recognises the explicit denomination and its traditional names: %s',appellation=>{
  expect(burgundyVillageMapTarget({...base,appellation})).toMatchObject(target);
 });
 it.each(['Red','White','Rosé',null])('keeps a broad overview for %s',colour=>{
  const result=burgundyVillageMapTarget({...base,colour,wineName:'Les Champs',referenceParcel:'Les Champs'});
  expect(result).toMatchObject(target);
  expect(result).not.toHaveProperty('locationContext');
 });
 it.each(['Châtillonnais','Beaujolais','Rhône','Yonne','Mâconnais','Côte Chalonnaise'])(
  'accepts regional context without inventing a local boundary: %s',region=>{
   expect(burgundyVillageMapTarget({...base,region})).toMatchObject(target);
  });
 it.each(['Coteaux Bourguignons','Coteaux-Bourguignons','Bourgogne Grand Ordinaire','Bourgogne-Ordinaire','Vin de Bourgogne Ordinaire'])(
  'matches a complete denomination beside recorded Bourgogne: %s',wineName=>{
   expect(burgundyVillageMapTarget({...base,appellation:'Bourgogne',wineName})).toMatchObject(target);
  });
 it.each([
  {appellation:'Coteaux Bourguignons Aligoté',colour:'White'},
  {appellation:'Coteaux Bourguignons Pinot Blanc Pinot Gris Melon de Bourgogne',colour:'White'},
  {appellation:'Coteaux Bourguignons Rouge Pinot Noir Gamay Chardonnay Pinot Blanc Aligoté',colour:'Red'},
  {appellation:'Coteaux Bourguignons César',region:'Yonne',colour:'Red'},
  {appellation:'Coteaux Bourguignons Clairet Pinot Gris',colour:'Rosé'},
  {appellation:'Coteaux Bourguignons Blanc Nouveau',colour:'White'},
  {appellation:'Coteaux Bourguignons Primeur',colour:null},
  {appellation:'Bourgogne Grand Ordinaire Nouveau',colour:'White'},
  {wineName:'Primeur',colour:'White'},
 ])('accepts reviewed grapes and white-only mentions: %j',fields=>{
  expect(burgundyVillageMapTarget({...base,...fields})).toMatchObject(target);
 });
 it.each([
  {appellation:null},{appellation:null,wineName:'Coteaux Bourguignons'},
  {appellation:null,referenceSite:'Coteaux Bourguignons'},{appellation:null,referenceParcel:'Bourgogne Grand Ordinaire'},
  {appellation:null,producer:'Coteaux Bourguignons'},{appellation:null,region:'Coteaux Bourguignons'},
  {appellation:'Grand Ordinaire'},{appellation:'Ordinaire'},{appellation:'Coteaux'},
  {appellation:'Bourgogne Grand Ordinaire Unknown Place'},
  {appellation:'Coteaux Bourguignons Unknown Place'},
  {appellation:'Bourgogne',wineName:'Domaine de Coteaux-Bourguignons'},
  {appellation:'Bourgogne',wineName:'Coteaux-Bourguignons-Something'},
  {appellation:'Bourgogne',wineName:'Coteaux Bourguignons',producer:'Coteaux Bourguignons'},
  {wineName:'Bourgogne Aligoté'},{wineName:'Bourgogne Mousseux'},
  {wineName:'Bourgogne Passe-tout-grains'},{wineName:'Crémant de Bourgogne'},
  {wineName:'Mâcon-Villages'},{referenceSite:'Meursault'},{referenceParcel:'Chablis'},
  {wineName:'Premier Cru'},{wineName:'Grand Cru'},
  {colour:'Red',wineStyle:'white'},{appellation:'Coteaux Bourguignons Blanc',colour:'Red'},
  {appellation:'Coteaux Bourguignons Clairet',colour:'White'},
  {appellation:'Coteaux Bourguignons Nouveau',colour:'Red'},
  {appellation:'Coteaux Bourguignons Rosé Primeur'},
  {wineName:'Nouveau',colour:'Rosé'},
  {appellation:'Coteaux Bourguignons César',colour:'White'},
  {appellation:'Coteaux Bourguignons Pinot Noir',colour:'White'},
  {classification:'village'},{classification:'premier_cru'},{classification:'grand_cru'},
  {productType:'Spirit'},{productSubtype:'Sparkling'},{wineStyle:'sparkling'},
  {country:'USA'},{region:'Bordeaux'},{identityMatchStatus:'conflict' as const},
 ])('withholds missing or conflicting identity: %j',fields=>{
  expect(burgundyVillageMapTarget({...base,...fields})).toBeNull();
 });
 it('keeps new label exceptions scoped to this appellation',()=>{
  for(const appellation of ['Bourgogne Nouveau','Bourgogne Aligoté Primeur','Mâcon César']){
   expect(burgundyVillageMapTarget({...base,appellation})).toBeNull();
  }
  expect(burgundyVillageMapTarget({...base,appellation:'Bourgogne',wineName:'Ordinaire'})).toMatchObject({featureId:'inao-denom-362'});
 });
 it('retains all 275 source communes and explains the missing colour and Rhône boundaries',async()=>{
  const catalogue=await loadVillageMapCatalogue('coteaux-bourguignons');
  expect(catalogue.features).toHaveLength(1);
  expect(catalogue.features[0]).toMatchObject({id:'inao-denom-2338',appellationId:1027,coverage:'partial',areaHa:55553.82});
  expect(catalogue.communes).toHaveLength(275);
  for(const [department,count] of [['21',90],['71',148],['89',37],['69',0]] as const){
   expect(catalogue.communes.filter(c=>c.id.startsWith(department))).toHaveLength(count);
  }
  for(const id of ['71084','71108','71150'])expect(catalogue.communes.some(c=>c.id===id)).toBe(true);
  expect(catalogue.colourScope).toBe('overview');
  expect(catalogue.coverageNote).toContain('Rhône/Beaujolais boundaries are missing');
  expect(catalogue.coverageNote).toContain('colour-specific');
  expect(catalogue.geobufUrl).toBe('/maps/coteaux-bourguignons.2026-09-21.pbf.gz');
  expect(catalogue.downloadTimeoutMs).toBe(60000);
  const data=JSON.parse(readFileSync(`public${catalogue.dataUrl}`,'utf8'));
  expect(data.features).toHaveLength(276);
  expect(data.features.slice(1).map((f:{id:string})=>f.id).sort()).toEqual(catalogue.communes.map(c=>`commune-${c.id}`).sort());
  for(const commune of catalogue.communes){
   expect(commune.bounds![0]).toBeGreaterThanOrEqual(catalogue.bounds[0]-0.000001);
   expect(commune.bounds![1]).toBeGreaterThanOrEqual(catalogue.bounds[1]-0.000001);
   expect(commune.bounds![2]).toBeLessThanOrEqual(catalogue.bounds[2]+0.000001);
   expect(commune.bounds![3]).toBeLessThanOrEqual(catalogue.bounds[3]+0.000001);
  }
 });
});
