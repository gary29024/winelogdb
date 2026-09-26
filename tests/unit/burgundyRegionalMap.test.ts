import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { burgundyVillageMapTarget,type VillageMapCatalogue } from '../../src/lib/places/burgundyVillageMap';
import { loadVillageMapCatalogue } from '../../src/lib/places/loadVillageMapCatalogue';
import { burgundyAtlasWineDetailPlace } from '../../src/lib/places/burgundyAtlasPremierCru';
import inventory from '../../scripts/burgundy-regional-map-coverage.json';
import config from '../../scripts/burgundy-regional-maps.json';
import villages from '../../src/lib/places/burgundyVillageMapRegistry.json';

const base={country:'France',region:'Burgundy',classification:null,productType:'Wine',productSubtype:'Still'};
const cases=[
 ['Bourgogne Côte d’Or','bourgogne-cote-dor','inao-denom-2840',40],
 ['Bourgogne Hautes Côtes de Nuits','bourgogne-hautes-cotes-de-nuits','inao-denom-364',19],
 ['Bourgogne Hautes Côtes de Beaune','bourgogne-hautes-cotes-de-beaune','inao-denom-363',29],
] as const;

describe('regional denominations stay separate from villages and named vineyards',()=>{
 for(const [name,id,featureId,count] of cases){
  it.each(['Red','White',null])(`${name}: accepts allowed colour %s`,colour=>{
   expect(burgundyVillageMapTarget({...base,appellation:name,wineName:'A named cuvée',colour}))
    .toMatchObject({villageId:id,featureId,mapKind:'regional',scope:'appellation'});
  });
  it(`${name}: loads the whole denomination and every producing commune`,async()=>{
   const catalogue=await loadVillageMapCatalogue(id);
   expect(catalogue.mapKind).toBe('regional');
   expect(catalogue.features).toHaveLength(1);
   expect(catalogue.features[0]).toMatchObject({id:featureId,tier:'regional',kind:'appellation',appellationId:138,atlasUrl:null});
   expect(catalogue.communes).toHaveLength(count);
   expect(catalogue.communes.map(c=>c.id).sort()).toEqual(config.maps.find(m=>m.id===id)!.communes);
   const data=JSON.parse(readFileSync(`public${catalogue.dataUrl}`,'utf8'));
   expect(data.features).toHaveLength(count+1);
   expect(data.features.filter((f:{properties:{kind:string}})=>f.properties.kind==='commune').map((f:{id:string})=>f.id).sort())
    .toEqual(catalogue.communes.map(c=>`commune-${c.id}`).sort());
   expect(data.features[0].id).toBe(featureId);
   const bounds=catalogue.bounds;
   for(const commune of catalogue.communes){
    expect(commune.bounds).toHaveLength(4);
    expect(commune.bounds![0]).toBeGreaterThanOrEqual(bounds[0]-0.000001);
    expect(commune.bounds![1]).toBeGreaterThanOrEqual(bounds[1]-0.000001);
    expect(commune.bounds![2]).toBeLessThanOrEqual(bounds[2]+0.000001);
    expect(commune.bounds![3]).toBeLessThanOrEqual(bounds[3]+0.000001);
   }
   assertGeometry(catalogue,data);
  });
 }
 it('tracks seven regional AOCs and all 49 source denominations without counting three new AOCs',()=>{
  expect(inventory.appellations).toHaveLength(7);
  const denominations=inventory.appellations.flatMap(a=>a.denominations);
  expect(denominations).toHaveLength(49);
  expect(new Set(denominations.map(d=>d.denominationId)).size).toBe(49);
  expect(denominations.filter(d=>d.status==='mapped').map(d=>d.denominationId).sort()).toEqual([2840,363,364]);
  expect(inventory.appellations.find(a=>a.appellationId===138)!.denominations).toHaveLength(15);
  expect(inventory.appellations.find(a=>a.appellationId===583)!.denominations).toHaveLength(29);
  expect(villages.villages).toHaveLength(44);
 });
 it.each([
  {appellation:"Bourgogne Cote-d'Or AOC",wineName:'Étienne Camuzet',producer:'Méo-Camuzet',colour:'Red',expected:'inao-denom-2840'},
  {appellation:'Hautes-Côtes de Nuits',wineName:'Cuvée Marine',producer:'Anne Gros',colour:'White',expected:'inao-denom-364'},
  {appellation:'Bourgogne Blanc',wineName:'Bourgogne Hautes Côtes de Nuits Clos Saint-Philibert',producer:'Méo-Camuzet',colour:'White',expected:'inao-denom-364'},
  {appellation:'Bourgogne Hautes Côtes de Beaune',wineName:'Jardin du Calvaire',producer:'Etienne Sauzet',colour:'White',expected:'inao-denom-363'},
  {appellation:'Hautes Côtes de Beaune',wineName:'Bourgogne Hautes-Côtes-de-Beaune Rosé',colour:'Rosé',expected:'inao-denom-363'},
  {appellation:'Hautes Côtes de Nuits',wineName:'Rosé',wineStyle:'rose',expected:'inao-denom-364'},
  {appellation:null,wineName:'Domaine Anne Gros Bourgogne Hautes Côtes de Nuits Blanc Cuvée Marine',expected:'inao-denom-364'},
 ])('keeps reviewed producer labels broad: $wineName',({expected,...wine})=>{
  expect(burgundyVillageMapTarget({...base,...wine})).toMatchObject({featureId:expected,scope:'appellation'});
 });
 it.each([
  {country:'USA'},{region:'Bordeaux'},{region:'Chablis'},{region:'Côte de Beaune'},
  {classification:'village'},{classification:'premier_cru'},{classification:'grand_cru'},
  {identityMatchStatus:'conflict' as const},{productType:'Spirit'},{productSubtype:'Sparkling'},{wineStyle:'sparkling'},
  {appellation:'Nuits-Saint-Georges'},{appellation:'Côte de Nuits-Villages'},
  {appellation:'Bourgogne Aligoté'},{appellation:'Bourgogne Hautes Côtes de Beaune'},
  {appellation:'Bourgogne Hautes Côtes de Nuits Bordeaux'},
  {appellation:'Hautes Côtes de Nuits Saint-Joseph'},
  {wineName:'Hautes Côtes de Nuits & Hautes Côtes de Beaune'},
  {wineName:'Hautes Côtes de Nuits & Bourgogne Chitry'},
  {wineName:'Hautes Côtes de Nuits Bourgogne Côtes du Couchois'},
  {wineName:'Hautes Côtes de Nuits Grands Crus'},
  {wineName:'Hautes Côtes de Nuits Premiers Crus'},
  {wineName:'Hautes Côtes de Nuits Premier Cru'},{wineName:'Hautes Côtes de Nuits 1er Cru'},
  {wineName:'Hautes Côtes de Nuits Grand Cru'},{wineName:'Hautes Côtes de Nuits Nuits-Saint-Georges'},
  {referenceSite:'Beaune'},{referenceParcel:'Bourgogne Côte d’Or'},
  {colour:'White',wineName:'Hautes Côtes de Nuits Rouge'},
 ])('withholds contradictory regional identity: %j',overrides=>{
  expect(burgundyVillageMapTarget({...base,appellation:'Bourgogne Hautes Côtes de Nuits',wineName:'Hautes Côtes de Nuits',...overrides})).toBeNull();
 });
 it.each([
  {appellation:'Bourgogne',region:'Côte d’Or'},
  {appellation:'Bourgogne',region:'Hautes Côtes de Nuits'},
  {appellation:'Bourgogne',referenceSite:'Hautes Côtes de Nuits'},
  {appellation:'Bourgogne',wineName:'Clos Saint-Philibert'},
  {appellation:'Bourgogne',wineName:'Cuvée Marine',producer:'Anne Gros'},
  {appellation:'Bourgogne Côte d’Or',colour:'Rosé'},
  {appellation:'Bourgogne Côte d’Or',wineName:'Rosé'},
  {appellation:'Bourgogne Côte d’Or',wineStyle:'rose'},
 ])('does not infer a designation or invent rosé Côte d’Or: %j',wine=>{
  expect(burgundyVillageMapTarget({...base,...wine})).toBeNull();
 });
 it.each(['Beaune','Côte de Beaune','Côte de Nuits-Villages','Nuits-Saint-Georges'])('preserves the distinct village %s',appellation=>{
  expect(burgundyVillageMapTarget({...base,appellation,classification:'village'})).toMatchObject({scope:'appellation',villageName:appellation});
  expect(burgundyVillageMapTarget({...base,appellation,classification:'village'})).not.toHaveProperty('mapKind');
 });
});

function assertGeometry(catalogue:VillageMapCatalogue,data:{features:{geometry:{type:string;coordinates:number[][][][]}}[]}){
 for(const feature of data.features){
  const geometry=feature.geometry;
  expect(['Polygon','MultiPolygon']).toContain(geometry.type);
  const polygons=geometry.type==='MultiPolygon'?geometry.coordinates:[geometry.coordinates as unknown as number[][][]];
  for(const polygon of polygons)for(const ring of polygon){
   expect(ring.length).toBeGreaterThanOrEqual(4);
   expect(ring[0]).toEqual(ring.at(-1));
   for(const [lon,lat] of ring){
    if(lon<4.4||lon>5.3||lat<46.7||lat>47.6)throw new Error(`Out-of-region coordinate in ${catalogue.name}`);
   }
  }
 }
}

describe('the Côte d’Or département as a recorded region',()=>{
 // The wine canonicaliser stores "cote dor" as the region Côte d'Or. It holds
 // both the Côte de Nuits and the Côte de Beaune, so it must not hide their maps.
 it.each([
  ['Gevrey-Chambertin','','village','inao-denom-589'],
  ['Meursault','Charmes','premier_cru','inao-denom-845'],
  ['Vosne-Romanée','Les Suchots','premier_cru','inao-denom-1276'],
  ['Chambertin','','grand_cru','inao-denom-447'],
  ['Corton','Bressandes','grand_cru','inao-denom-2357'],
 ] as const)('%s %s keeps its map and Atlas link',(appellation,wineName,classification,featureId)=>{
  for(const region of ["Côte d'Or",'Côte-d’Or',"Cote d'Or"]){
   const wine={...base,region,appellation,wineName,classification};
   expect(burgundyVillageMapTarget(wine)?.featureId,region).toBe(featureId);
   expect(burgundyAtlasWineDetailPlace(wine),region).not.toBeNull();
  }
 });
 it.each([
  ['Chablis Grand Cru','Les Clos','grand_cru'],['Chablis','','village'],['Mercurey','','village'],['Pouilly-Fuissé','','village'],
 ] as const)('%s still conflicts with Côte d’Or',(appellation,wineName,classification)=>{
  const wine={...base,region:"Côte d'Or",appellation,wineName,classification};
  expect(burgundyVillageMapTarget(wine)).toBeNull();
  expect(burgundyAtlasWineDetailPlace(wine)).toBeNull();
 });
});
