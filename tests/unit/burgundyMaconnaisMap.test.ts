import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { burgundyVillageMapTarget,type VillageMapCatalogue } from '../../src/lib/places/burgundyVillageMap';
import { burgundyAtlasPremierCru,burgundyAtlasWineDetailPlace } from '../../src/lib/places/burgundyAtlasPremierCru';
import fuisse from '../../src/lib/places/pouillyFuisseVillageMapCatalogue.json';
import loche from '../../src/lib/places/pouillyLocheVillageMapCatalogue.json';
import vinzelles from '../../src/lib/places/pouillyVinzellesVillageMapCatalogue.json';
import veran from '../../src/lib/places/saintVeranVillageMapCatalogue.json';
import clesse from '../../src/lib/places/vireClesseVillageMapCatalogue.json';
import type { FeatureCollection,MultiPolygon,Polygon } from 'geojson';

const wine={country:'France',region:'Mâconnais',classification:'premier_cru'};
const catalogues=[fuisse,loche,vinzelles,veran,clesse];
const data=(c:VillageMapCatalogue)=>JSON.parse(readFileSync(`public${c.dataUrl}`,'utf8')) as FeatureCollection<Polygon|MultiPolygon>&{overviewFills?:FeatureCollection<Polygon|MultiPolygon>['features']};
const geometry=(c:VillageMapCatalogue,id:number)=>data(c).features.find(f=>f.id===`inao-denom-${id}`)!.geometry;

describe('Mâconnais Premier Crus and producer names',()=>{
 // Producer references and precise full-climat scope are in the map guide.
 it.each([
  ['Pouilly-Fuissé','Château Fuissé Pouilly-Fuissé Le Clos Monopole',2870],
  ['Pouilly-Fuissé','Château des Quarts Pouilly-Fuissé Aux Quarts Clos des Quarts',2866],
  ['Pouilly-Fuissé','Clos des Quarts',2866],
  ['Pouilly-Fuissé','Olivier Merlin Aux Vignerais',2877],
  ['Pouilly-Fuissé','Olivier Merlin En France Clos de France',2884],
  ['Pouilly-Fuissé','Domaine Ferret Tournant de Pouilly',2874],
  ['Pouilly-Fuissé','Domaine Ferret Pouilly-Fuissé Le Clos de Jeanne',2873],
  ['Pouilly-Fuissé','La Baudotte',2873],
  ['Pouilly-Fuissé','Albert Bichot Pouilly-Fuissé 1er Cru Clos Reyssié',2867],
  ['Pouilly-Fuissé','Maison Matisco Le Clos Reyssier',2867],
  ['Pouilly-Loché','Domaine du Clos des Rocs Olivier Giroux Les Mûres',2932],
  ['Pouilly-Vinzelles','Bret Brothers & La Soufrandière Pouilly-Vinzelles Les Quarts Zen',2930],
  ['Pouilly-Vinzelles','Les Pétaux',2928],
  ['Pouilly-Vinzelles','Les Longeays',2929],
 ])('%s — %s selects the reviewed source identity',(appellation,wineName,id)=>{
  expect(burgundyVillageMapTarget({...wine,appellation,wineName})).toMatchObject({featureId:`inao-denom-${id}`,scope:'vineyard'});
 });
 it.each([
  ['Le Clos de Jeanne',2873],['Clos de Jeanne',2873],['La Baudotte',2873],
  ['Tournant de Pouilly',2874],['Clos des Quarts',2866],['Aux Vignerais',2877],['Clos de France',2884],
  ['Clos Reyssié',2867],
 ] as const)('accepts whole reference name %s without promoting a village wine',(name,id)=>{
  const base={...wine,appellation:'Pouilly-Fuissé',wineName:''};
  for(const field of ['referenceSite','referenceParcel'])expect(burgundyVillageMapTarget({...base,[field]:name})?.featureId).toBe(`inao-denom-${id}`);
  expect(burgundyVillageMapTarget({...base,wineName:name,classification:'village'})?.featureId).toBe('inao-denom-1055');
  expect(burgundyVillageMapTarget({...base,wineName:name,classification:null})).toBeNull();
  for(const fields of [{wineName:`${name} et Les Crays`},{wineName:name,referenceParcel:'Les Crays'}]){
   expect(burgundyVillageMapTarget({...base,...fields})).toMatchObject({featureId:'inao-denom-2865',scope:'appellation'});
  }
 });
 it('does not mistake generic clos text, village cuvées or Ferret’s old name for Le Clos',()=>{
  for(const wineName of ['Clos des Prouges','Le Clos des Prouges','Le Clos du Moulin','Clos inconnu',
   'Domaine Ferret Pouilly-Fuissé Le Clos','Ferret Le Clos','Les Crays Clos inconnu']){
   const target=burgundyVillageMapTarget({...wine,appellation:'Pouilly-Fuissé',wineName});
   expect(target?.featureId,wineName).not.toBe('inao-denom-2870');
   if(wineName!=='Les Crays Clos inconnu')expect(target?.featureId,wineName).toBe('inao-denom-2865');
  }
  expect(burgundyVillageMapTarget({...wine,appellation:'Pouilly-Fuissé',wineName:'Ferret Le Clos',classification:'village'})?.featureId).toBe('inao-denom-1055');
  expect(burgundyVillageMapTarget({...wine,appellation:'Pouilly-Fuissé',wineName:'Pouilly'})?.featureId).toBe('inao-denom-2883');
 });
 it('separates Pouilly appellations, repeated Quarts and Perrières names, and the Loire',()=>{
  for(const [appellation,wineName,id] of [
   ['Pouilly-Fuissé','Aux Quarts',2866],['Pouilly-Vinzelles','Les Quarts',2930],
   ['Pouilly-Fuissé','Les Perrières',2873],['Meursault','Perrières',858],
  ] as const)expect(burgundyVillageMapTarget({...wine,region:'Burgundy',appellation,wineName})?.featureId).toBe(`inao-denom-${id}`);
  for(const fields of [{appellation:'Pouilly-Fumé'},{appellation:'Pouilly-sur-Loire'},{region:'Loire'},
   {appellation:'Mâcon-Vinzelles'},{appellation:'Bourgogne Chardonnay'},{appellation:'Pouilly-Loché',wineName:'Pouilly-Vinzelles Les Quarts'}]){
   expect(burgundyVillageMapTarget({...wine,appellation:'Pouilly-Fuissé',wineName:'Les Quarts',...fields})).toBeNull();
  }
 });
});

describe('local Premier Cru tiers with existing Atlas village links',()=>{
 it.each([{c:loche,broad:2931,village:1057},{c:vinzelles,broad:2927,village:1059}])('$c.name retains local named and broad maps without inventing an Atlas link',({c,broad,village})=>{
  const base={...wine,appellation:c.name,wineName:''};
  expect(burgundyVillageMapTarget(base)).toMatchObject({featureId:`inao-denom-${broad}`,scope:'appellation'});
  expect(burgundyAtlasWineDetailPlace(base)).toBeNull();
  for(const f of c.features.filter(f=>f.kind==='vineyard')){
   expect(f).toMatchObject({matchId:f.id,atlasUrl:null});
   for(const fields of [{wineName:f.name},{referenceSite:f.name},{referenceParcel:f.name},
    {appellation:`${c.name} 1er Cru ${f.name}`,classification:null}]){
    expect(burgundyVillageMapTarget({...base,...fields})).toMatchObject({featureId:f.id,scope:'vineyard'});
    expect(burgundyAtlasPremierCru({...base,...fields})).toBeNull();
   }
   for(const fields of [{country:'USA'},{region:'Côte de Nuits'},{identityMatchStatus:'conflict' as const},{classification:null}]){
    expect(burgundyVillageMapTarget({...base,wineName:f.name,...fields})).toBeNull();
   }
   for(const fields of [{wineName:`${f.name} et another plot`},{referenceSite:`${f.name} & another plot`}]){
    expect(burgundyVillageMapTarget({...base,...fields})?.featureId).toBe(`inao-denom-${broad}`);
   }
   const villageWine={...base,wineName:f.name,classification:'village'};
   expect(burgundyVillageMapTarget(villageWine)?.featureId).toBe(`inao-denom-${village}`);
   expect(burgundyAtlasWineDetailPlace(villageWine)).toMatchObject({name:c.name,scope:'appellation'});
  }
 });
 it('keeps an unnamed Loché Premier Cru broad and preserves tiny source differences from Les Mûres',()=>{
  expect(geometry(loche,2931)).not.toEqual(geometry(loche,2932));
  expect(loche.features.find(f=>f.denominationId===2931)!.areaHa).toBe(loche.features.find(f=>f.denominationId===2932)!.areaHa);
  expect(burgundyVillageMapTarget({...wine,appellation:'Pouilly-Loché',wineName:'Pouilly-Loché Premier Cru'}))
   .toMatchObject({featureId:'inao-denom-2931',scope:'appellation'});
 });
});

describe('Mâconnais source areas and producing communes',()=>{
 it.each(catalogues)('$name accepts white or unknown colour and rejects red, rosé and Grand Cru',c=>{
  for(const f of c.features.filter(f=>![1056,1593].includes(f.denominationId))){
   const base={...wine,appellation:c.name,wineName:f.name,classification:f.tier};
   for(const fields of [{},{colour:'White'},{colour:null,wineStyle:'white'}])expect(burgundyVillageMapTarget({...base,...fields})?.featureId).toBe(f.id);
   for(const fields of [{colour:'Red'},{colour:'Rosé'},{colour:null,wineStyle:'red'},{classification:'grand_cru'}])expect(burgundyVillageMapTarget({...base,...fields})).toBeNull();
  }
 });
 it.each([{c:fuisse,area:1056,village:1055,name:'Les Combettes'},{c:clesse,area:1593,village:1287,name:'Quintaine'}])('$c.name keeps named-climat eligibility as a broad selectable source area',({c,area,village,name})=>{
  expect(c.features.find(f=>f.denominationId===area)).toMatchObject({kind:'appellation',tier:'village',matchId:`inao-denom-${area}`,atlasUrl:null});
  const base={...wine,appellation:c.name,wineName:name,classification:'village'};
  expect(burgundyVillageMapTarget(base)).toMatchObject({featureId:`inao-denom-${village}`,scope:'appellation'});
  expect(geometry(c,area)).not.toEqual(geometry(c,village));
  if(c.id==='vire-clesse')expect(c.features.find(f=>f.denominationId===area)!.areaHa).toBeLessThan(c.features.find(f=>f.denominationId===village)!.areaHa);
 });
 it.each([veran,clesse])('$name does not invent Premier Crus or individual village plots',c=>{
  const wineName=c.id==='saint-veran'?'Les Pommards':'Quintaine';
  const base={...wine,appellation:c.name,wineName};
  expect(burgundyVillageMapTarget(base)).toBeNull();
  expect(burgundyVillageMapTarget({...base,classification:'village'})?.scope).toBe('appellation');
 });
 it('retains all 16 source communes, shared Vers Cras and both Saint-Véran areas',()=>{
  expect([...new Set(catalogues.flatMap(c=>c.communes.map(commune=>commune.id)))].sort()).toEqual([
   '71074','71084','71108','71135','71169','71210','71250','71258','71270','71305','71360','71487','71526','71567','71583','71584']);
  expect(fuisse.features.find(f=>f.denominationId===2876)?.communes).toEqual(['71210','71526']);
  expect(veran.communes).toHaveLength(7);
  expect(veran.areas.map(a=>a.id)).toEqual(['north','south']);
  expect(veran.areas[0].bounds[1]).toBeGreaterThan(veran.areas[1].bounds[3]);
  expect(loche.communes).toEqual([{id:'71270',name:'Mâcon (Loché)'}]);
  expect(vinzelles.communes).toEqual([{id:'71583',name:'Vinzelles'}]);
 });
 it.each(catalogues)('$name ships full closed source rings and separate overview fills',c=>{
  const geo=data(c);
  expect(geo.features.map(f=>f.id).sort()).toEqual([...c.features.map(f=>f.id),...c.communes.map(commune=>`commune-${commune.id}`)].sort());
  expect(geo.overviewFills??[]).toHaveLength(c.features.some(f=>f.kind==='vineyard')?1:0);
  expect((c as VillageMapCatalogue).umbrellas??{}).toEqual({});
  for(const f of [...geo.features,...(geo.overviewFills??[])]){
   const rings=f.geometry.type==='Polygon'?f.geometry.coordinates:f.geometry.coordinates.flat();
   expect(rings.every(r=>r.length>=4&&JSON.stringify(r[0])===JSON.stringify(r.at(-1)))).toBe(true);
  }
 });
});
