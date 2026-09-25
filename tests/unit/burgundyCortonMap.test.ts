import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { burgundyVillageMapTarget,type VillageMapCatalogue } from '../../src/lib/places/burgundyVillageMap';
import aloxe from '../../src/lib/places/aloxeVillageMapCatalogue.json';
import pernand from '../../src/lib/places/pernandVillageMapCatalogue.json';
import ladoix from '../../src/lib/places/ladoixVillageMapCatalogue.json';
import registry from '../../src/lib/places/burgundyVillageMapRegistry.json';

const wine={country:'France',region:'Côte de Beaune',appellation:'Corton',wineName:'Les Bressandes',classification:'grand_cru',colour:'Red'};
const feature=(c:VillageMapCatalogue,id:number)=>c.features.find(f=>f.denominationId===id)!;
const data=(c:VillageMapCatalogue)=>JSON.parse(readFileSync(`public${c.dataUrl}`,'utf8'));

describe('Corton source identities',()=>{
 it('distinguishes three Grand Cru appellations from 24 named Corton climats',()=>{
  const grands=aloxe.features.filter(f=>f.tier==='grand_cru');
  expect(new Set(grands.map(f=>f.appellationId)).size).toBe(3);
  expect(grands.filter(f=>'parentAppellation' in f)).toHaveLength(24);
  expect(feature(aloxe,549)).toMatchObject({name:'Corton',kind:'appellation'});
  expect(feature(aloxe,476).communes).toEqual(['21010','21480']);
  expect(feature(aloxe,550).communes).toEqual(['21010','21480','21606']);
  expect(feature(aloxe,549).communes).toEqual(['21010','21480','21606']);
  expect(feature(aloxe,476).areaHa).toBeLessThan(feature(aloxe,550).areaHa);
 });
 it('keeps all shared Grand Cru boundaries identical in all three village contexts',()=>{
  const maps=[aloxe,pernand,ladoix].map(data);
  for(const f of aloxe.features.filter(f=>f.tier==='grand_cru')){
   for(const c of [pernand,ladoix])expect(c.features.find(g=>g.id===f.id)).toEqual(f);
   for(const m of maps.slice(1))expect(m.features.find((g:{id:string})=>g.id===f.id)).toEqual(maps[0].features.find((g:{id:string})=>g.id===f.id));
  }
 });
 it('retains Aloxe production in Pernand and Ladoix, and the source name for Les Chaillots',()=>{
  expect(feature(aloxe,242).communes).toEqual(['21010','21480','21606']);
  expect(feature(aloxe,243).communes).toEqual(['21010','21606']);
  expect(feature(aloxe,245).communes).toEqual(['21606']);
  expect(feature(aloxe,248)).toMatchObject({name:'Les Chaillots',sourceName:'Aloxe-Corton premier cru Les Chaillots blanc'});
  for(const colour of ['Red','White'])expect(burgundyVillageMapTarget({...wine,appellation:'Aloxe-Corton',wineName:'Les Chaillots',classification:'premier_cru',colour})?.featureId).toBe('inao-denom-248');
 });
 it('preserves separate Ladoix colour IDs even though their geometries are equal',()=>{
  const base={...wine,appellation:'Ladoix',wineName:'Ladoix',classification:'village'};
  for(const [fields,id] of [[{colour:'White'},657],[{colour:'Red'},2059],[{colour:'',wineStyle:'white'},657]] as const){
   expect(burgundyVillageMapTarget({...base,...fields})).toMatchObject({featureId:`inao-denom-${id}`,scope:'appellation'});
  }
  expect(burgundyVillageMapTarget({...base,colour:null})?.featureId).toBe('inao-app-192-village');
  const m=data(ladoix);
  expect(m.features.find((f:{id:string})=>f.id==='inao-denom-657').geometry).toEqual(m.features.find((f:{id:string})=>f.id==='inao-denom-2059').geometry);
 });
});

describe('named Corton wine matching',()=>{
 it.each(registry.grandCruClimats[0].climats)('matches $name with a local identity and no invented Atlas link',climat=>{
  for(const fields of [
   {wineName:climat.name},{wineName:`Corton Grand Cru ${climat.name} 2020`},
   {wineName:'',referenceSite:climat.name},{wineName:'',referenceParcel:climat.name},
   {appellation:`Corton ${climat.name}`,wineName:''},
  ])expect(burgundyVillageMapTarget({...wine,...fields})).toMatchObject({villageId:'aloxe-corton',featureId:climat.matchId,scope:'vineyard'});
  expect(aloxe.features.find(f=>f.id===climat.matchId)?.atlasUrl).toBeNull();
 });
 it.each([
  {wineName:'Corton'},{wineName:'Corton Grand Cru'},
  {wineName:'Clos des Cortons Faiveley'}, {wineName:'Unknown climat'},
  {wineName:'Les Bressandes et Les Renardes'},{wineName:'Les Bressandes / Unknown'},
  {wineName:'Les Bressandes and Unknown'},{wineName:'Les Bressandes',referenceSite:'Les Renardes'},
  {wineName:'Les Bressandes',referenceSite:'Unknown climat'},
  {wineName:'Les Bressandes',colour:'White'},{wineName:'Les Vergennes',colour:'',wineStyle:'white'},
 ])('keeps broad Corton scope when no single red designation is proven: %j',fields=>{
  expect(burgundyVillageMapTarget({...wine,...fields})).toMatchObject({villageId:'aloxe-corton',featureId:'inao-denom-549',scope:'appellation'});
 });
 it.each([
  {country:'USA'},{region:'Bordeaux'},{classification:'premier_cru'},{classification:'village'},
  {identityMatchStatus:'conflict' as const},{referenceSite:'Pommard Les Rugiens'},
  {wineName:'Corton-Charlemagne Les Bressandes'},{appellation:'Corton / Pommard'},
  {wineName:'Corton Premier Cru Les Bressandes'},{colour:'Rosé'},
 ])('withholds contradictory identities: %j',fields=>{
  expect(burgundyVillageMapTarget({...wine,...fields})).toBeNull();
 });
 it('accepts article omission and accents, without confusing Corton with Le Corton',()=>{
  expect(burgundyVillageMapTarget({...wine,wineName:'Bressandes'})?.featureId).toBe('inao-denom-2357');
  expect(burgundyVillageMapTarget({...wine,wineName:'Les Fietres'})?.featureId).toBe('inao-denom-2361');
  expect(burgundyVillageMapTarget({...wine,wineName:'Le Corton'})?.featureId).toBe('inao-denom-2354');
  expect(burgundyVillageMapTarget({...wine,wineName:'Corton'})?.featureId).toBe('inao-denom-549');
  expect(burgundyVillageMapTarget({...wine,wineName:'Les BressandesUnknown'})?.featureId).toBe('inao-denom-549');
 });
 it('does not confuse Corton climat names with village Premier Crus or the white Grand Crus',()=>{
  for(const [appellation,wineName,id] of [['Aloxe-Corton','Les Maréchaudes',251],['Aloxe-Corton','Les Paulands',253],['Ladoix','Hautes Mourottes',660],['Ladoix','Le Rognet et Corton',1988]] as const){
   expect(burgundyVillageMapTarget({...wine,appellation,wineName,classification:'premier_cru'})?.featureId).toBe(`inao-denom-${id}`);
  }
  for(const [appellation,id] of [['Corton-Charlemagne',550],['Charlemagne',476]] as const){
   expect(burgundyVillageMapTarget({...wine,appellation,wineName:appellation,colour:'White'})?.featureId).toBe(`inao-denom-${id}`);
  }
 });
});

describe('Corton label spellings and producer names',()=>{
 it('reads Rognet as INAO\'s Le Rognet et Corton, whose "et" would otherwise look like a blend',()=>{
  for(const wineName of ['Corton Rognet','Corton Le Rognet','Corton Clos Rognet','Le Rognet et Corton']){
   expect(burgundyVillageMapTarget({...wine,wineName})?.featureId,wineName).toBe('inao-denom-2356');
  }
  expect(burgundyVillageMapTarget({...wine,wineName:'Corton Rognet et Bressandes'})?.featureId).toBe('inao-denom-549');
 });
 it('keeps a map when a producer in the title names another place, at Corton appellation scope',()=>{
  for(const wineName of ['Domaine de la Romanée-Conti Corton','Château de Meursault Corton Bressandes']){
   expect(burgundyVillageMapTarget({...wine,wineName}),wineName).toMatchObject({featureId:'inao-denom-549',scope:'appellation'});
  }
  // Outside the title, another place still contradicts Corton; and a name built
  // on Corton itself is another appellation, even in the title.
  expect(burgundyVillageMapTarget({...wine,referenceSite:'Meursault'})).toBeNull();
  expect(burgundyVillageMapTarget({...wine,wineName:'Corton-Charlemagne Les Bressandes'})).toBeNull();
  expect(burgundyVillageMapTarget({...wine,wineName:'Aloxe-Corton Les Bressandes'})).toBeNull();
 });
});
