import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { burgundyVillageMapTarget,umbrellaNote,type VillageMapCatalogue } from '../../src/lib/places/burgundyVillageMap';
import { burgundyAtlasWineDetailPlace } from '../../src/lib/places/burgundyAtlasPremierCru';
import santenay from '../../src/lib/places/santenayVillageMapCatalogue.json';
import maranges from '../../src/lib/places/marangesVillageMapCatalogue.json';
import coteBeaune from '../../src/lib/places/coteBeauneVillageMapCatalogue.json';
import villages from '../../src/lib/places/coteBeauneVillagesMapCatalogue.json';
import config from '../../scripts/burgundy-villages.json';
import type { FeatureCollection,MultiPolygon,Polygon } from 'geojson';

const wine={country:'France',region:'Burgundy',classification:'premier_cru',colour:'Red'};
const data=(c:VillageMapCatalogue)=>JSON.parse(readFileSync(`public${c.dataUrl}`,'utf8')) as FeatureCollection<Polygon|MultiPolygon>&{overviewFills?:FeatureCollection<Polygon|MultiPolygon>['features']};
const geometry=(c:VillageMapCatalogue,id:number)=>data(c).features.find(f=>f.id===`inao-denom-${id}`)!.geometry;

describe('Santenay and Maranges producer labels',()=>{
 // Primary producer references, including the spelling differences that exact
 // INAO-name tests miss, are recorded in docs/burgundy-village-map.md.
 it.each([
  ['Santenay','Santenay Premier Cru Passe-Temps',1171],
  ['Santenay','Passe Temps',1171],
  ['Santenay','Clos de Tavannes Sélection',1164],
  ['Santenay',"Domaine de la Pousse d’Or Clos de Tavannes",1164],
  ['Santenay','Domaine Jessiaume Les Gravières',1169],
  ['Maranges','Domaine Monnot-Roche La Croix aux Moines',803],
  ['Maranges','Croix aux Moines',803],
  ['Maranges','Domaine Saint Marc Clos Roussot',804],
  ['Maranges','Albert Bichot Clos Roussots',804],
  ['Maranges','Domaine Grachet-Duchemin Clos des Loyères',801],
 ])('%s — %s selects the reviewed denomination',(appellation,wineName,id)=>{
  expect(burgundyVillageMapTarget({...wine,appellation,wineName})).toMatchObject({featureId:`inao-denom-${id}`,scope:'vineyard'});
 });
 it.each([
  ['Santenay','Passe-Temps',1171,'Beauregard',1172],
  ['Maranges','La Croix aux Moines',803,'La Fussière',805],
  ['Maranges','Clos Roussot',804,'Clos des Loyères',805],
 ] as const)('accepts %s reference names but keeps blends broad',(appellation,name,id,other,broad)=>{
  const base={...wine,appellation,wineName:''};
  for(const field of ['referenceSite','referenceParcel'])expect(burgundyVillageMapTarget({...base,[field]:name})?.featureId).toBe(`inao-denom-${id}`);
  for(const fields of [{wineName:`${name} et ${other}`},{wineName:name,referenceSite:other}]){
   expect(burgundyVillageMapTarget({...base,...fields})).toMatchObject({featureId:`inao-denom-${broad}`,scope:'appellation'});
  }
  expect(burgundyVillageMapTarget({...base,wineName:name,classification:null})).toBeNull();
  expect(burgundyVillageMapTarget({...base,wineName:name,identityMatchStatus:'conflict'})).toBeNull();
 });
 it('keeps similarly named crus and compound denominations distinct',()=>{
  for(const [appellation,wineName,id] of [
   ['Santenay','Clos des Mouches',1165],['Beaune','Clos des Mouches',325],
   ['Santenay','Clos Rousseau',1163],['Santenay','Grand Clos Rousseau',1166],['Maranges','Clos Roussot',804],
   ['Santenay','Les Gravières',1169],['Santenay','Clos de Tavannes',1164],['Santenay','Les Gravières-Clos de Tavannes',1170],
   ['Maranges','La Fussière',800],['Maranges','Clos de la Fussière',799],
   ['Maranges','La Fussière Clos de la Fussière',799],
  ] as const)expect(burgundyVillageMapTarget({...wine,appellation,wineName})?.featureId).toBe(`inao-denom-${id}`);
  expect(burgundyVillageMapTarget({...wine,appellation:'Santenay',wineName:'Clos Rousseau et Grand Clos Rousseau'})?.featureId).toBe('inao-denom-1172');
  expect(burgundyVillageMapTarget({...wine,appellation:'Maranges',wineName:'Clos Rousseau'})?.scope).toBe('appellation');
 });
 it('keeps unparsed conjunctions in producer-prefixed titles conservative',()=>{
  for(const wineName of ['Mestre Père et Fils Santenay Premier Cru Passe-Temps','Françoise et Denis Clair Clos de Tavannes Sélection']){
   expect(burgundyVillageMapTarget({...wine,appellation:'Santenay',wineName})).toMatchObject({featureId:'inao-denom-1172',scope:'appellation'});
  }
 });
 it('retains equal Tavannes boundaries without counting an extra climat',()=>{
  expect(geometry(santenay,1164)).toEqual(geometry(santenay,1170));
  expect(santenay.notes['inao-denom-1170'].sameBoundaryAs).toBe('inao-denom-1164');
  const notes=santenay.notes as VillageMapCatalogue['notes'];
  const named=santenay.features.filter(f=>f.kind==='vineyard');
  expect(named).toHaveLength(12);
  expect(named.filter(f=>!notes[f.id]?.sameBoundaryAs)).toHaveLength(11);
  expect(santenay.umbrellas).toEqual({'inao-denom-1169':['inao-denom-1164','inao-denom-1170']});
  expect(maranges.umbrellas).toEqual({'inao-denom-800':['inao-denom-799']});
  expect(umbrellaNote(maranges,'inao-denom-799')).toContain('lies within La Fussière');
 });
});

describe('source boundaries and colour',()=>{
 it.each([{c:santenay,red:2082,white:1159,app:230},{c:maranges,red:2061,white:797,app:198}])('$c.name keeps both source colours and the combined overview',({c,red,white,app})=>{
  const base={...wine,appellation:c.name,wineName:c.name,classification:'village'};
  for(const [fields,id] of [[{colour:'Red'},red],[{colour:'White'},white],[{colour:'',wineStyle:'white'},white]] as const){
   expect(burgundyVillageMapTarget({...base,...fields})?.featureId).toBe(`inao-denom-${id}`);
  }
  expect(burgundyVillageMapTarget({...base,colour:''})?.featureId).toBe(`inao-app-${app}-village`);
  expect(burgundyVillageMapTarget({...base,colour:'Rosé'})).toBeNull();
  expect(geometry(c,red)).toEqual(geometry(c,white));
  for(const f of c.features.filter(f=>f.kind==='vineyard'))for(const colour of ['Red','White']){
   expect(burgundyVillageMapTarget({...wine,appellation:c.name,wineName:f.name,colour})?.featureId).toBe(f.id);
  }
  expect(data(c).overviewFills).toHaveLength(1);
 });
 it('includes Remigny and all three Maranges communes without clipping shared crus',()=>{
  expect(santenay.features.find(f=>f.denominationId===2082)?.communes).toEqual(['21582','71369']);
  expect(maranges.features.find(f=>f.denominationId===2061)?.communes).toEqual(['71122','71174','71496']);
  expect(maranges.features.find(f=>f.denominationId===800)?.communes).toEqual(['71122','71174']);
  expect(maranges.features.find(f=>f.denominationId===804)?.communes).toEqual(['71122','71496']);
 });
 it.each([coteBeaune,villages])('$name has only its broad source area, no invented village plots or Premier Crus',c=>{
  expect(c.features).toHaveLength(1);
  expect(c.features[0]).toMatchObject({tier:'village',kind:'appellation'});
  const shapes=data(c);
  expect(shapes.features.map(f=>f.id).sort()).toEqual([c.features[0].id,...c.communes.map(c=>`commune-${c.id}`)].sort());
  expect(shapes.overviewFills).toBeUndefined();
  for(const f of shapes.features){
   const rings=f.geometry.type==='Polygon'?f.geometry.coordinates:f.geometry.coordinates.flat();
   expect(rings.every(r=>r.length>=4&&JSON.stringify(r[0])===JSON.stringify(r.at(-1)))).toBe(true);
  }
  expect(c.sources.every(s=>s.sha256.length===64&&s.license.startsWith('Licence Ouverte'))).toBe(true);
  expect(burgundyVillageMapTarget({...wine,appellation:c.name,wineName:c.name})).toBeNull();
 });
 it('keeps every Côte de Beaune-Villages commune and provides four overview zoom areas',()=>{
  expect(villages.communes).toHaveLength(16);
  expect(villages.features[0].communes).toEqual(villages.communes.map(c=>c.id).sort());
  for(const excluded of ['21054','21010','21492','21712'])expect(villages.communes.map(c=>c.id)).not.toContain(excluded);
  const configured=config.villages.find(v=>v.id===villages.id)!;
  const codes=configured.areas!.flatMap(a=>a.communes);
  expect(codes.sort()).toEqual(villages.features[0].communes);
  expect(new Set(codes).size).toBe(16);
  expect(villages.areas.map(a=>a.id)).toEqual(['north','centre','montrachet','south']);
  for(const a of villages.areas)expect(a.bounds[1]).toBeLessThan(a.bounds[3]);
 });
});

describe('Côte de Beaune identities with and without an Atlas page',()=>{
 const base={...wine,appellation:'Côte de Beaune-Villages',wineName:'Joseph Drouhin Côte de Beaune-Villages',classification:'village'};
 it.each([
  {},{appellation:'Cote de Beaune Villages AOC'},
  {appellation:null},{classification:null},
  {appellation:null,wineName:'',referenceSite:'Côte de Beaune-Villages'},
  {appellation:null,wineName:'',referenceParcel:'Côte de Beaune-Villages'},
  {colour:null,wineStyle:'red'},{colour:null},
 ])('maps the proven local appellation without inventing an Atlas URL: %j',fields=>{
  const record={...base,...fields};
  expect(burgundyVillageMapTarget(record)).toMatchObject({villageId:'cote-de-beaune-villages',featureId:'inao-denom-552',scope:'appellation'});
  expect(burgundyAtlasWineDetailPlace(record)).toBeNull();
  expect(villages.features[0]).toMatchObject({matchId:'inao-app-168-village',atlasUrl:null});
 });
 it.each([
  {colour:'White'},{colour:'Rosé'},{colour:null,wineStyle:'white'},
  {classification:'premier_cru'},{classification:'grand_cru'},
  {classification:null,wineName:'Côte de Beaune-Villages Premier Cru'},
  {classification:'regional'},{identityMatchStatus:'conflict' as const},
  {country:'USA'},{region:'Bordeaux'},
  {appellation:'Côte de Beaune'},{referenceSite:'Beaune'},{referenceParcel:'Pommard'},
  {wineName:'Côte de Beaune-Villages et Volnay'},
 ])('rejects incompatible colour, tier and geography: %j',fields=>{
  expect(burgundyVillageMapTarget({...base,...fields})).toBeNull();
 });
 it('distinguishes Beaune, Côte de Beaune and the subregion from Côte de Beaune-Villages',()=>{
  for(const [appellation,id] of [['Beaune',307],['Côte de Beaune',551],['Côte de Beaune-Villages',552]] as const){
   expect(burgundyVillageMapTarget({...base,appellation,wineName:appellation})?.featureId).toBe(`inao-denom-${id}`);
  }
  expect(burgundyVillageMapTarget({...base,appellation:null,wineName:'',region:'Côte de Beaune'})).toBeNull();
  for(const colour of ['Red','White']){
   const record={...base,appellation:'Côte de Beaune',wineName:'Joseph Drouhin Côte de Beaune',colour};
   expect(burgundyVillageMapTarget(record)?.featureId).toBe('inao-denom-551');
   expect(burgundyAtlasWineDetailPlace(record)?.url).toBe(coteBeaune.features[0].atlasUrl);
  }
 });
});
