import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { burgundyVillageMapTarget,umbrellaNote,type VillageMapCatalogue } from '../../src/lib/places/burgundyVillageMap';
import savigny from '../../src/lib/places/savignyVillageMapCatalogue.json';
import chorey from '../../src/lib/places/choreyVillageMapCatalogue.json';
import auxey from '../../src/lib/places/auxeyVillageMapCatalogue.json';
import monthelie from '../../src/lib/places/monthelieVillageMapCatalogue.json';
import saintRomain from '../../src/lib/places/saintRomainVillageMapCatalogue.json';
import type { FeatureCollection,MultiPolygon,Polygon } from 'geojson';

const wine={country:'France',region:'Burgundy',classification:'premier_cru',colour:'Red'};
const data=(c:VillageMapCatalogue)=>JSON.parse(readFileSync(`public${c.dataUrl}`,'utf8')) as FeatureCollection<Polygon|MultiPolygon>&{overviewFills?:FeatureCollection<Polygon|MultiPolygon>['features']};
const geometry=(c:VillageMapCatalogue,id:number)=>data(c).features.find(f=>f.id===`inao-denom-${id}`)!.geometry;

// Actual producer names/spellings, including old labels; primary sources are
// recorded in docs/burgundy-village-map.md. A stored appellation anchors these
// wine titles even where the producer abbreviates the village to Savigny.
describe('producer labels in the next Côte de Beaune villages',()=>{
 it.each([
  ['Savigny-lès-Beaune','Albert Morot Savigny 1er Cru Clos de la Bataillère Monopole',1180],
  ['Savigny-lès-Beaune','Albert Morot La Bataillère aux Vergelesses Premier Cru',1180],
  ['Savigny-lès-Beaune','La Bataillère',1180],
  ['Savigny-lès-Beaune','Joseph Drouhin Savigny-les-Beaune Premier Cru Fourneaux',1175],
  ['Savigny-lès-Beaune','Domaine Rapet Aux Fournaux',1175],
  ['Savigny-lès-Beaune','Aux Fourneaux',1175],
  ['Savigny-lès-Beaune','Bruno Clair Savigny-lès-Beaune Les Jarrons 1er Cru',1186],
  ['Auxey-Duresses','Les Bretterins',267],
  ['Auxey-Duresses','Les Bréterins',267],
  ['Monthélie','Domaine Changarnier Monthelie 1er Cru Champs Fulliot',921],
  ['Monthélie','Domaine Georges Glantenay Monthélie Les Champs Fulliot',921],
  ['Monthélie','Domaine Dujardin Les Champs Fulliots',921],
  ['Monthélie','MJ Tricot Clos Les Champs Fulliot',921],
  ['Monthélie','Pierre-Yves Colin-Morey Clos des Champs Fulliots',921],
  ['Monthélie','Clos des Champs Fulliot',921],
  ['Monthélie','Domaine Chanson Monthelie 1er Cru Le Clos Gauthey',918],
 ])('%s — %s selects its reviewed source denomination',(appellation,wineName,id)=>{
  expect(burgundyVillageMapTarget({...wine,appellation,wineName})).toMatchObject({featureId:`inao-denom-${id}`,scope:'vineyard'});
 });
 it('accepts the complete reviewed names in reference fields and keeps blends broad',()=>{
  for(const [appellation,name,id,other,broad] of [
   ['Savigny-lès-Beaune','Clos de la Bataillère',1180,'Les Lavières',1196],
   ['Savigny-lès-Beaune','La Bataillère aux Vergelesses',1180,'Les Lavières',1196],
   ['Savigny-lès-Beaune','Aux Fournaux',1175,'Les Lavières',1196],
   ['Auxey-Duresses','Les Bretterins',267,'Clos du Val',272],
   ['Monthélie','Les Champs Fulliot',921,'Sur la Velle',926],
   ['Monthélie','Clos des Champs Fulliot',921,'Sur la Velle',926],
  ] as const){
   const base={...wine,appellation,wineName:''};
   expect(burgundyVillageMapTarget({...base,referenceSite:name})?.featureId).toBe(`inao-denom-${id}`);
   expect(burgundyVillageMapTarget({...base,referenceParcel:name})?.featureId).toBe(`inao-denom-${id}`);
   expect(burgundyVillageMapTarget({...base,wineName:`${name} et ${other}`})).toMatchObject({featureId:`inao-denom-${broad}`,scope:'appellation'});
   expect(burgundyVillageMapTarget({...base,wineName:name,classification:null})).toBeNull();
   expect(burgundyVillageMapTarget({...base,wineName:name,identityMatchStatus:'conflict'})).toBeNull();
  }
 });
 it('preserves neighbouring names and scopes repeated names to their appellation',()=>{
  for(const [appellation,wineName,id] of [
   ['Savigny-lès-Beaune','Les Vergelesses',1193],['Savigny-lès-Beaune','Basses Vergelesses',1179],
   ['Pernand-Vergelesses','Les Vergelesses',1022],
   ['Savigny-lès-Beaune','Les Marconnets',1188],['Beaune','Les Marconnets',335],
   ['Auxey-Duresses','Les Duresses',268],['Monthélie','Les Duresses',922],
   ['Auxey-Duresses','La Chapelle',266],['Chassagne-Montrachet','La Chapelle',499],
   ['Monthélie','Le Clou des Chênes',1993],['Volnay','Clos des Chênes',1236],
   ['Monthélie','Les Clous',1995],['Savigny-lès-Beaune','Aux Clous',1174],
  ] as const)expect(burgundyVillageMapTarget({...wine,appellation,wineName})?.featureId).toBe(`inao-denom-${id}`);
  // The alias never guesses a climat under a different village.
  expect(burgundyVillageMapTarget({...wine,appellation:'Auxey-Duresses',wineName:'Champs Fulliot'}))
   .toMatchObject({featureId:'inao-denom-272',scope:'appellation'});
 });
 it('uses containment only for Clos du Val, not partial overlaps or adjacent crus',()=>{
  expect(auxey.umbrellas).toEqual({'inao-denom-264':['inao-denom-265']});
  expect(umbrellaNote(auxey,'inao-denom-265')).toContain('lies within Climat du Val');
  expect(burgundyVillageMapTarget({...wine,appellation:'Auxey-Duresses',wineName:'Climat du Val Clos du Val'})?.featureId).toBe('inao-denom-265');
  expect(burgundyVillageMapTarget({...wine,appellation:'Auxey-Duresses',wineName:'La Chapelle',referenceSite:'Reugne'}))
   .toMatchObject({featureId:'inao-denom-272',scope:'appellation'});
  expect(umbrellaNote(auxey,'inao-denom-266')).toBeUndefined();
  expect(umbrellaNote(savigny,'inao-denom-1180')).toBeUndefined();
  expect(auxey.notes['inao-denom-266'].note).toContain('overlaps parts of Reugne and Les Bréterins');
 });
});

describe('source coverage and wine colour',()=>{
 it.each([
  {c:savigny,white:1173,red:2081,app:231},
  {c:chorey,white:543,red:2049,app:159},
  {c:auxey,white:262,red:2075,app:129},
  {c:saintRomain,white:2048,red:1157,app:228},
 ])('$c.name retains both colour identities and the explicit combined overview',({c,white,red,app})=>{
  const base={...wine,appellation:c.name,wineName:c.name,classification:'village'};
  for(const [fields,id] of [[{colour:'White'},white],[{colour:'Red'},red],[{colour:'',wineStyle:'white'},white],[{colour:null,wineStyle:'red'},red]] as const){
   expect(burgundyVillageMapTarget({...base,...fields})).toMatchObject({featureId:`inao-denom-${id}`,scope:'appellation'});
  }
  expect(burgundyVillageMapTarget({...base,colour:''})?.featureId).toBe(`inao-app-${app}-village`);
  expect(burgundyVillageMapTarget({...base,colour:'Rosé'})).toBeNull();
  expect(c.features.find(f=>f.denominationId===white)?.sourceName).toBe(c.name);
  expect(c.features.find(f=>f.denominationId===red)?.sourceName).toContain('Côte de Beaune');
  expect(c.features[0]).toMatchObject({denominationId:null,denominationIds:[white,red].sort((a,b)=>a-b),name:`${c.name} (all colours)`});
 });
 it('keeps Saint-Romain colour areas different, and the three equal colour pairs intact',()=>{
  expect(geometry(saintRomain,1157)).not.toEqual(geometry(saintRomain,2048));
  expect(saintRomain.features.find(f=>f.denominationId===1157)?.areaHa).toBe(143.37);
  expect(saintRomain.features.find(f=>f.denominationId===2048)?.areaHa).toBe(147.05);
  for(const [c,white,red] of [[savigny,1173,2081],[chorey,543,2049],[auxey,262,2075]] as const){
   expect(geometry(c,white)).toEqual(geometry(c,red));
  }
 });
 it('includes Monthélie’s four non-contiguous Premier Cru IDs and both colours',()=>{
  for(const id of [1992,1993,1994,1995]){
   const feature=monthelie.features.find(f=>f.denominationId===id)!;
   expect(feature.kind).toBe('vineyard');
   for(const colour of ['White','Red'])expect(burgundyVillageMapTarget({...wine,appellation:'Monthélie',wineName:feature.name,colour})?.featureId).toBe(feature.id);
  }
  for(const colour of ['White','Red',''])expect(burgundyVillageMapTarget({...wine,appellation:'Monthélie',wineName:'Monthélie',classification:'village',colour})?.featureId).toBe('inao-denom-914');
  expect(monthelie.notes['inao-denom-921'].note).toContain('whole Les Champs Fulliots');
 });
 it.each([chorey,saintRomain])('$name supplies only broad village areas and does not invent Premier Crus',c=>{
  expect(c.features).toHaveLength(3);
  expect(c.features.every(f=>f.kind==='appellation'&&f.tier==='village')).toBe(true);
  const shapes=data(c);
  expect(shapes.features).toHaveLength(4);
  expect(shapes.features.map(f=>f.id).sort()).toEqual([...c.features.map(f=>f.id),`commune-${c.communes[0].id}`].sort());
  for(const f of shapes.features){
   const rings=f.geometry.type==='Polygon'?f.geometry.coordinates:f.geometry.coordinates.flat();
   expect(rings.every(r=>r.length>=4&&JSON.stringify(r[0])===JSON.stringify(r.at(-1)))).toBe(true);
  }
  expect(shapes.overviewFills).toBeUndefined();
  expect(burgundyVillageMapTarget({...wine,appellation:c.name,wineName:c.name})).toBeNull();
  expect(c.sources.every(s=>s.sha256.length===64&&s.license.startsWith('Licence Ouverte'))).toBe(true);
 });
 it.each([
  ['Chorey-lès-Beaune','Domaine Aegerter Les Beaumonts','Red',2049],
  ['Chorey-lès-Beaune','Pierre et Jean-Baptiste Lebreuil Les Beaumonts','Red',2049],
  ['Saint-Romain','Henri et Gilles Buisson Sous la Velle','White',2048],
  ['Saint-Romain','Henri et Gilles Buisson Sous Roche','Red',1157],
 ])('%s — %s keeps the published village area',(appellation,wineName,colour,id)=>{
  expect(burgundyVillageMapTarget({...wine,appellation,wineName,colour,classification:'village'}))
   .toMatchObject({featureId:`inao-denom-${id}`,scope:'appellation'});
 });
 it.each([savigny,auxey,monthelie])('$name paints one Premier Cru union while keeping every selectable boundary',c=>{
  const shapes=data(c);
  expect(shapes.overviewFills).toHaveLength(1);
  expect(shapes.overviewFills![0].properties?.tier).toBe('premier_cru');
  for(const f of c.features)expect(shapes.features.find(s=>s.id===f.id)?.properties).toMatchObject({denominationId:f.denominationId,areaHa:f.areaHa,communes:f.communes});
 });
});
