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
 ['Bourgogne Côte Chalonnaise','bourgogne-cote-chalonnaise','inao-denom-365',44],
 ['Bourgogne Côtes du Couchois','bourgogne-cotes-du-couchois','inao-denom-1586',6],
] as const;

describe('regional denominations stay separate from villages and named vineyards',()=>{
 for(const [name,id,featureId,count] of cases){
  it.each(featureId==='inao-denom-1586'?['Red',null]:['Red','White',null])(`${name}: accepts allowed colour %s`,colour=>{
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
 it('tracks seven regional AOCs and all 49 source denominations without counting geographic denominations as new AOCs',()=>{
  expect(inventory.appellations).toHaveLength(7);
  const denominations=inventory.appellations.flatMap(a=>a.denominations);
  expect(denominations).toHaveLength(49);
  expect(new Set(denominations.map(d=>d.denominationId)).size).toBe(49);
  expect(denominations.filter(d=>d.status==='mapped').map(d=>d.denominationId).sort((a,b)=>a-b)).toEqual([363,364,365,1586,2840]);
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

describe('Côte Chalonnaise and Couchois regional labels',()=>{
 it.each([
  {appellation:'Bourgogne Côte Chalonnaise',producer:'Château de Chamilly',wineName:'Bourgogne – Côte Chalonnaise',colour:'Red',expected:'inao-denom-365'},
  {appellation:'Bourgogne Côte Chalonnaise',producer:'Vignerons de Buxy',wineName:'Chardonnay Buissonnier',colour:'White',expected:'inao-denom-365'},
  {appellation:null,wineName:'Bourgogne Côte Chalonnaise Chardonnay Buissonnier',colour:'White',expected:'inao-denom-365'},
  {appellation:'Bourgogne Côte Chalonnaise Rosé AOC',wineStyle:'rose',expected:'inao-denom-365'},
  {appellation:'Bourgogne Côte Chalonnaise',region:'Saône-et-Loire',expected:'inao-denom-365'},
  {appellation:'Bourgogne Côtes du Couchois',producer:'Domaine Lacour',wineName:'Sous le Clos',referenceParcel:'Promets / Sous le Clos',colour:'Red',expected:'inao-denom-1586'},
  {appellation:'Côtes-du-Couchois AOP',producer:'Domaine Lacour',wineName:'Cuvée Amphore',wineStyle:'red',expected:'inao-denom-1586'},
  {appellation:'Bourgogne Rouge',producer:'Domaine du Château de Couches',wineName:'Bourgogne Côtes du Couchois Clos Marguerite À la Folie',expected:'inao-denom-1586'},
  {appellation:'Bourgogne Côtes du Couchois',region:'Couchois',expected:'inao-denom-1586'},
  {appellation:'Bourgogne Côtes du Couchois',region:'Saone-et-Loire',expected:'inao-denom-1586'},
  {appellation:'Bourgogne Côtes du Couchois',region:'Côte Chalonnaise',expected:'inao-denom-1586'},
 ])('keeps $appellation $wineName at the whole denomination',({expected,...wine})=>{
  const result=burgundyVillageMapTarget({...base,...wine});
  expect(result).toMatchObject({featureId:expected,mapKind:'regional',scope:'appellation'});
  expect(result).not.toHaveProperty('locationContext');
 });
 it.each([
  {colour:'White'},{colour:'Rosé'},{wineStyle:'white'},{wineStyle:'rose'},
  {wineName:'Bourgogne Côtes du Couchois Blanc'},{wineName:'Bourgogne Côtes du Couchois Rosé'},
  {appellation:'Côtes du Couchois White'},{appellation:'Côtes du Couchois Rosé'},
  {wineName:'Bourgogne Côtes du Couchois Blanc',colour:'Red'},
  {appellation:'Bourgogne Blanc',wineName:'Côtes du Couchois'},
 ])('refuses unsupported Couchois colour evidence %j',overrides=>{
  expect(burgundyVillageMapTarget({...base,appellation:'Bourgogne Côtes du Couchois',...overrides})).toBeNull();
 });
 for(const appellation of ['Bourgogne Côte Chalonnaise','Bourgogne Côtes du Couchois']){
  it.each([
   {country:'USA'},{region:'Côte d’Or'},{region:'Côte de Beaune'},{region:'Chablis'},
   {classification:'village'},{classification:'premier_cru'},{classification:'grand_cru'},
   {productSubtype:'Sparkling'},{wineStyle:'sparkling'},{identityMatchStatus:'conflict' as const},
   {wineName:'Mercurey'},{referenceSite:'Montagny'},{referenceParcel:'Bourgogne Chitry'},
   {wineName:'Bourgogne Côte Chalonnaise & Bourgogne Côtes du Couchois'},
  ])(`${appellation} refuses contradictory identity %j`,overrides=>{
   expect(burgundyVillageMapTarget({...base,appellation,...overrides})).toBeNull();
  });
 }
 it.each([
  {appellation:'Bourgogne',region:'Côte Chalonnaise'},
  {appellation:'Bourgogne',region:'Couchois'},
  {appellation:'Bourgogne',region:'Côtes du Couchois'},
  {appellation:'Bourgogne',wineName:'Côte Chalonnaise'},
  {appellation:'Bourgogne',wineName:'Sous le Clos',producer:'Domaine Lacour'},
  {appellation:'Bourgogne',wineName:'Clos Marguerite À la Folie',producer:'Château de Couches'},
  {appellation:'Bourgogne',referenceParcel:'Bourgogne Côtes du Couchois'},
 ])('does not infer a regional denomination from geography or a cuvée %j',wine=>{
  expect(burgundyVillageMapTarget({...base,...wine})).toBeNull();
 });
 it.each(['Bouzeron','Rully','Mercurey','Givry','Montagny'])('preserves %s village identity in the Côte Chalonnaise region',appellation=>{
  expect(burgundyVillageMapTarget({...base,region:'Côte Chalonnaise',appellation,classification:'village'}))
   .toMatchObject({villageName:appellation,scope:'appellation'});
 });
});

function assertGeometry(catalogue:VillageMapCatalogue,data:{features:{properties:{kind:string};geometry:{type:string;coordinates:number[][][][]}}[]}){
 const configured=config.maps.find(map=>map.id===catalogue.id)!;
 for(const feature of data.features){
  const grid=feature.properties.kind==='appellation'?(configured.coordinateGrid??1e-6):1e-6;
  const geometry=feature.geometry;
  expect(['Polygon','MultiPolygon']).toContain(geometry.type);
  const polygons=geometry.type==='MultiPolygon'?geometry.coordinates:[geometry.coordinates as unknown as number[][][]];
  for(const polygon of polygons)for(const ring of polygon){
   expect(ring.length).toBeGreaterThanOrEqual(4);
   expect(ring[0]).toEqual(ring.at(-1));
   for(const [lon,lat] of ring){
    if(lon<4.3||lon>5.3||lat<46.5||lat>47.6)throw new Error(`Out-of-region coordinate in ${catalogue.name}`);
    if([lon,lat].some(value=>Math.abs(value/grid-Math.round(value/grid))>0.000001))throw new Error(`Coordinate exceeds reviewed precision in ${catalogue.name}`);
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

describe('Saône-et-Loire and Yonne as recorded regions',()=>{
 it.each([
  ['Saône-et-Loire','Mercurey','Clos du Roi','premier_cru','inao-denom-827'],
  ['Saône et Loire','Pouilly-Fuissé','Les Brulés','premier_cru','inao-denom-2871'],
  ['Saône-et-Loire','Rully','','village','inao-denom-1087'],
  ['Saône-et-Loire','Maranges','','village','inao-app-198-village'],
  ['Yonne','Chablis Grand Cru','Les Clos','grand_cru','inao-denom-443'],
  ['Yonne','Chablis','','village','inao-denom-397'],
  ['Yonne','Irancy','','village','inao-denom-1288'],
  ['Yonne','Saint-Bris','','village','inao-denom-1597'],
 ] as const)('%s keeps %s %s on its map',(region,appellation,wineName,classification,featureId)=>{
  const wine={...base,region,appellation,wineName,classification};
  expect(burgundyVillageMapTarget(wine)?.featureId).toBe(featureId);
  expect(burgundyAtlasWineDetailPlace(wine)).not.toBeNull();
 });
 it.each([
  ['Saône-et-Loire','Meursault'],['Saône-et-Loire','Chablis'],['Yonne','Gevrey-Chambertin'],['Yonne','Mercurey'],["Côte d'Or",'Mercurey'],
 ] as const)('%s still conflicts with %s',(region,appellation)=>{
  const wine={...base,region,appellation,classification:'village'};
  expect(burgundyVillageMapTarget(wine)).toBeNull();
  expect(burgundyAtlasWineDetailPlace(wine)).toBeNull();
 });
});
