import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { burgundyVillageMapTarget,type VillageMapCatalogue } from '../../src/lib/places/burgundyVillageMap';
import { burgundyAtlasPremierCru,burgundyAtlasWineDetailPlace } from '../../src/lib/places/burgundyAtlasPremierCru';
import bouzeron from '../../src/lib/places/bouzeronVillageMapCatalogue.json';
import rully from '../../src/lib/places/rullyVillageMapCatalogue.json';
import mercurey from '../../src/lib/places/mercureyVillageMapCatalogue.json';
import givry from '../../src/lib/places/givryVillageMapCatalogue.json';
import montagny from '../../src/lib/places/montagnyVillageMapCatalogue.json';
import type { FeatureCollection,MultiPolygon,Polygon } from 'geojson';

const wine={country:'France',region:'Côte Chalonnaise',classification:'premier_cru'};
const catalogues=[bouzeron,rully,mercurey,givry,montagny];
const data=(c:VillageMapCatalogue)=>JSON.parse(readFileSync(`public${c.dataUrl}`,'utf8')) as FeatureCollection<Polygon|MultiPolygon>&{overviewFills?:FeatureCollection<Polygon|MultiPolygon>['features']};

describe('Côte Chalonnaise wine labels',()=>{
 // Primary producer and BIVB references are recorded in the map guide.
 it.each([
  ['Rully','Dureuil-Janthial Rully 1er Cru Le Meix Cadot',1102],
  ['Rully','Clos St Jacques',1091],
  ['Rully','Clos du Chaigne (à Jean de France)',1092],
  ['Mercurey','Domaine Faiveley Mercurey Clos des Myglands Monopole',818],
  ['Givry','Domaine Joblot Givry Clos du Cellier aux Moines',618],
  ['Givry','Domaine François Lumpp Crausot',640],
  ['Givry','Crauzot',640],
  ['Montagny','Olivier Leflaive Montagny 1er Cru Bonneveaux',877],
  ['Mercurey','Château de Chamirey Mercurey 1er Cru Clos du Roi',827],
  ['Mercurey','Le Clos du Roy',827],
  ['Givry','Vicomte d\'Aligny Givry 1er Cru Clos de la Barraude',626],
  ['Givry','Clos de la Baraude',626],
  ['Givry','Domaine Thénard Givry 1er Cru Cellier aux Moines',618],
 ])('%s — %s selects the source boundary',(appellation,wineName,id)=>{
  expect(burgundyVillageMapTarget({...wine,appellation,wineName})).toMatchObject({featureId:`inao-denom-${id}`,scope:'vineyard'});
 });
 it.each([
  ['Rully','Clos du Chaigne à Jean de France',1092,'La Pucelle',1111],
  ['Givry','Crauzot',640,'Clos Salomon',644],
  ['Givry','Cellier aux Moines',618,'Clos Salomon',644],
  ['Mercurey','Clos du Roi',827,'Les Croichots',843],
  ['Montagny','Bonneveaux',877,'Les Coères',913],
 ] as const)('accepts whole %s reference names and broadens blends',(appellation,name,id,other,broad)=>{
  const base={...wine,appellation,wineName:''};
  for(const field of ['referenceSite','referenceParcel'])expect(burgundyVillageMapTarget({...base,[field]:name})?.featureId).toBe(`inao-denom-${id}`);
  for(const fields of [{wineName:`${name} et ${other}`},{wineName:name,referenceSite:other}]){
   expect(burgundyVillageMapTarget({...base,...fields})).toMatchObject({featureId:`inao-denom-${broad}`,scope:'appellation'});
  }
 });
 it('retains producer conjunction handling without allowing mixed vineyards',()=>{
  for(const wineName of ['Domaine Père & Fils Givry La Plante','Domaine Pierre et Marie Givry La Plante']){
   expect(burgundyVillageMapTarget({...wine,appellation:'Givry',wineName})?.featureId).toBe('inao-denom-639');
  }
  for(const wineName of ['Givry La Plante & La Matrosse','Domaine Pierre et Marie La Plante','Domaine Père et Fils Givry La Plante et Crausot']){
   expect(burgundyVillageMapTarget({...wine,appellation:'Givry',wineName})?.featureId).toBe('inao-denom-644');
  }
 });
 it('keeps repeated and similar names tied to their appellation',()=>{
  for(const [appellation,wineName,id] of [
   ['Rully','Clos Saint-Jacques',1091],['Gevrey-Chambertin','Clos Saint-Jacques',597],
   ['Givry','Les Combes',2334],['Montagny','Les Combes',884],
   ['Mercurey','Clos des Montaigus',817],['Mercurey','Les Montaigus',835],['Mercurey','Clos du Château de Montaigu',819],
   ['Montagny','Le Vieux Château',874],['Montagny','La Condemine du Vieux Château',869],
  ] as const)expect(burgundyVillageMapTarget({...wine,region:'Burgundy',appellation,wineName})?.featureId).toBe(`inao-denom-${id}`);
  expect(burgundyVillageMapTarget({...wine,appellation:'Rully',wineName:'Les Saint-Jacques',classification:'village'})?.featureId).toBe('inao-denom-1087');
  expect(burgundyVillageMapTarget({...wine,appellation:'Mercurey',wineName:'Clos des Montaigus et Les Montaigus'})?.featureId).toBe('inao-denom-843');
  expect(burgundyVillageMapTarget({...wine,appellation:'Mercurey',wineName:'Clos des Montaigus Clos du Château de Montaigu'})?.featureId).toBe('inao-denom-819');
 });
});

describe('Givry source and Atlas gaps',()=>{
 it.each([['La Plante',639],['La Matrosse',2327],['Le Médenchot',2330]] as const)('%s selects its local INAO identity without inventing an Atlas link',(wineName,id)=>{
  const base={...wine,appellation:'Givry',wineName};
  expect(givry.features.find(f=>f.denominationId===id)).toMatchObject({matchId:`inao-denom-${id}`,atlasUrl:null,communes:['71241']});
  for(const fields of [{},{wineName:'',referenceSite:wineName},{wineName:'',referenceParcel:wineName},
   {appellation:`Givry 1er Cru ${wineName}`,wineName:'',classification:null}]){
   expect(burgundyVillageMapTarget({...base,...fields})).toMatchObject({villageId:'givry',featureId:`inao-denom-${id}`,scope:'vineyard'});
  }
  expect(burgundyAtlasPremierCru(base)).toBeNull();
  expect(burgundyAtlasWineDetailPlace(base)).toMatchObject({name:'Givry Premier Cru',scope:'appellation'});
  for(const fields of [{country:'USA'},{region:'Côte de Nuits'},{appellation:'Unknown'},
   {identityMatchStatus:'conflict' as const},{classification:null},{colour:'Rosé'}])expect(burgundyVillageMapTarget({...base,...fields})).toBeNull();
  for(const fields of [{wineName:`${wineName} et Clos Salomon`},{referenceSite:'Clos Salomon'},
   {wineName:'Clos Salomon',referenceSite:wineName},{wineName:'',referenceSite:`${wineName} & Clos Salomon`}]){
   expect(burgundyVillageMapTarget({...base,...fields})).toMatchObject({featureId:'inao-denom-644',scope:'appellation'});
  }
  expect(burgundyVillageMapTarget({...base,classification:'village'})?.featureId).toBe('inao-denom-617');
 });
 it('explains 37 of 38 boundaries and never substitutes Clos du Vernoy for Le Vernoy',()=>{
  expect(givry.coverageNote).toContain('37 of Givry’s 38');
  expect(givry.features.some(f=>f.name==='Le Vernoy')).toBe(false);
  const base={...wine,appellation:'Givry'};
  for(const fields of [{wineName:'Le Vernoy'},{wineName:'',referenceSite:'Le Vernoy'},
   {wineName:'Le Vernoy Clos Salomon'},{wineName:'Clos Salomon',referenceParcel:'Le Vernoy'},
   {wineName:'Clos du Vernoy',referenceSite:'Le Vernoy'}]){
   expect(burgundyVillageMapTarget({...base,...fields})).toMatchObject({featureId:'inao-denom-644',scope:'appellation'});
  }
  expect(burgundyVillageMapTarget({...base,wineName:'Le Vernoy',classification:null})).toBeNull();
  expect(burgundyVillageMapTarget({...base,wineName:'Clos du Vernoy'})?.featureId).toBe('inao-denom-628');
 });
});

describe('Côte Chalonnaise full source extent and colour',()=>{
 it.each([bouzeron,montagny])('$name supports white and unknown colour only',c=>{
  for(const f of c.features){
   const base={...wine,appellation:c.name,wineName:f.name,classification:f.tier};
   for(const fields of [{},{colour:'White'},{colour:'',wineStyle:'white'}])expect(burgundyVillageMapTarget({...base,...fields})?.featureId).toBe(f.id);
   for(const fields of [{colour:'Red'},{colour:'Rosé'},{colour:null,wineStyle:'red'}])expect(burgundyVillageMapTarget({...base,...fields})).toBeNull();
  }
  expect(burgundyVillageMapTarget({...wine,appellation:c.name,wineName:c.name,classification:'grand_cru'})).toBeNull();
 });
 it('keeps Bouzeron broad and does not manufacture Premier Crus',()=>{
  expect(bouzeron.features).toHaveLength(1);
  expect(burgundyVillageMapTarget({...wine,appellation:'Bouzeron',wineName:'Les Clous',classification:'village'}))
   .toMatchObject({featureId:'inao-denom-1286',scope:'appellation'});
  expect(burgundyVillageMapTarget({...wine,appellation:'Bouzeron',wineName:'Bouzeron Premier Cru'})).toBeNull();
 });
 it.each([rully,mercurey,givry])('$name uses the same source identities for red and white',c=>{
  for(const f of c.features)for(const colour of ['Red','White']){
   expect(burgundyVillageMapTarget({...wine,appellation:c.name,wineName:f.name,classification:f.tier,colour})?.featureId).toBe(f.id);
  }
 });
 it('retains all 13 producing communes and cross-commune vineyards',()=>{
  expect(catalogues.flatMap(c=>c.communes.map(commune=>commune.id)).sort()).toEqual([
   '71051','71070','71073','71109','71182','71221','71241','71247','71294','71302','71378','71459','71485']);
  const communes=(c:VillageMapCatalogue,id:number)=>c.features.find(f=>f.denominationId===id)?.communes;
  expect(communes(bouzeron,1286)).toEqual(['71051','71109']);
  for(const id of [1091,1092])expect(communes(rully,id)).toEqual(['71073']);
  expect(communes(mercurey,817)).toEqual(['71294','71459']);
  expect(communes(givry,620)).toEqual(['71182']);
  expect(communes(montagny,886)).toEqual(['71247','71302','71485']);
  for(const id of [894,898])expect(communes(montagny,id)).toEqual(['71302','71485']);
 });
 it.each(catalogues)('$name publishes selectable source features separately from overview paint',c=>{
  const geo=data(c);
  expect(geo.features.map(f=>f.id).sort()).toEqual([...c.features.map(f=>f.id),...c.communes.map(commune=>`commune-${commune.id}`)].sort());
  expect(geo.overviewFills??[]).toHaveLength(c.id==='bouzeron'?0:1);
  expect((c as VillageMapCatalogue).umbrellas??{}).toEqual(c.id==='mercurey'?{'inao-denom-817':['inao-denom-819']}:{});
  for(const f of [...geo.features,...(geo.overviewFills??[])]){
   const rings=f.geometry.type==='Polygon'?f.geometry.coordinates:f.geometry.coordinates.flat();
   expect(rings.every(r=>r.length>=4&&JSON.stringify(r[0])===JSON.stringify(r.at(-1)))).toBe(true);
  }
 });
});
