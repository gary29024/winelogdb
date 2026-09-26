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
 ['Bourgogne Côte d’Or','bourgogne-cote-dor','inao-denom-2840',40,['Red','White']],
 ['Bourgogne Hautes Côtes de Nuits','bourgogne-hautes-cotes-de-nuits','inao-denom-364',19,['Red','White','Rosé']],
 ['Bourgogne Hautes Côtes de Beaune','bourgogne-hautes-cotes-de-beaune','inao-denom-363',29,['Red','White','Rosé']],
 ['Bourgogne Côte Chalonnaise','bourgogne-cote-chalonnaise','inao-denom-365',44,['Red','White','Rosé']],
 ['Bourgogne Côtes du Couchois','bourgogne-cotes-du-couchois','inao-denom-1586',6,['Red']],
 ['Bourgogne Côtes d’Auxerre','bourgogne-cotes-dauxerre','inao-denom-366',5,['Red','White','Rosé']],
 ['Bourgogne Chitry','bourgogne-chitry','inao-denom-367',1,['Red','White','Rosé']],
 ['Bourgogne Coulanges-la-Vineuse','bourgogne-coulanges-la-vineuse','inao-denom-368',7,['Red','White','Rosé']],
 ['Bourgogne Épineuil','bourgogne-epineuil','inao-denom-369',1,['Red','Rosé']],
 ['Bourgogne Côte Saint-Jacques','bourgogne-cote-saint-jacques','inao-denom-374',1,['Red','White','Rosé']],
 ['Bourgogne Tonnerre','bourgogne-tonnerre','inao-denom-1751',6,['White']],
 ['Bourgogne La Chapelle Notre-Dame','bourgogne-la-chapelle-notre-dame','inao-denom-371',1,['Red','White','Rosé']],
 ['Bourgogne Le Chapitre','bourgogne-le-chapitre','inao-denom-372',1,['Red','White','Rosé']],
 ['Bourgogne Montrecul','bourgogne-montrecul','inao-denom-373',1,['Red','White','Rosé']],
 ['Mâcon Charnay-lès-Mâcon','macon-charnay-les-macon','inao-denom-1721',1,['Red','White','Rosé']],
 ['Mâcon Davayé','macon-davaye','inao-denom-1723',1,['Red','White','Rosé']],
 ['Mâcon Fuissé','macon-fuisse','inao-denom-2069',1,['White']],
 ['Mâcon Loché','macon-loche','inao-denom-2070',1,['White']],
 ['Mâcon Solutré-Pouilly','macon-solutre-pouilly','inao-denom-2072',1,['White']],
 ['Mâcon Vergisson','macon-vergisson','inao-denom-1736',1,['White']],
 ['Mâcon Vinzelles','macon-vinzelles','inao-denom-2074',1,['White']],
] as const;

describe('regional denominations stay separate from villages and named vineyards',()=>{
 for(const [name,id,featureId,count,colours] of cases){
  it.each([...colours,null])(`${name}: accepts allowed colour %s`,colour=>{
   expect(burgundyVillageMapTarget({...base,appellation:name,wineName:'A named cuvée',colour}))
    .toMatchObject({villageId:id,featureId,mapKind:'regional',scope:'appellation'});
  });
  it(`${name}: loads the whole denomination and every producing commune`,async()=>{
   const catalogue=await loadVillageMapCatalogue(id);
   expect(catalogue.mapKind).toBe('regional');
   expect(catalogue.features).toHaveLength(1);
   expect(catalogue.features[0]).toMatchObject({id:featureId,tier:'regional',kind:'appellation',appellationId:name.startsWith('Mâcon')?583:138,atlasUrl:null});
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
  expect(denominations.filter(d=>d.status==='mapped').map(d=>d.denominationId).sort((a,b)=>a-b)).toEqual([363,364,365,366,367,368,369,371,372,373,374,1586,1721,1723,1736,1751,2069,2070,2072,2074,2840]);
  expect(inventory.appellations.find(a=>a.appellationId===138)!.denominations).toHaveLength(15);
  const bourgogne=inventory.appellations.find(a=>a.appellationId===138)!.denominations;
  expect(bourgogne.filter(d=>d.denominationId!==362).every(d=>d.status==='mapped')).toBe(true);
  expect(bourgogne.find(d=>d.denominationId===362)!.status).toBe('pending');
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

describe('Yonne regional denominations',()=>{
 it.each([
  {appellation:'Côtes-d’Auxerre AOC',producer:'Jean-Hugues et Guilhem Goisot',wineName:'Gondonne',colour:'White',expected:'inao-denom-366'},
  {appellation:'Bourgogne Côtes d’Auxerre',wineName:'Corps de Garde',colour:'Red',expected:'inao-denom-366'},
  {appellation:'Bourgogne Chitry Blanc',producer:'Olivier Morin',wineName:'Olympe',colour:'White',expected:'inao-denom-367'},
  {appellation:'Bourgogne Chitry',wineName:'Vau du Puits',colour:'Red',expected:'inao-denom-367'},
  {appellation:'Bourgogne Coulanges la Vineuse',producer:'Domaine du Clos du Roi',wineName:'Domaine du Clos du Roi Chanvan',colour:'Red',expected:'inao-denom-368'},
  {appellation:'Bourgogne Coulanges-la-Vineuse',wineName:'Charly',colour:'White',expected:'inao-denom-368'},
  {appellation:'Bourgogne Epineuil AOP',producer:'Dominique Gruhier',wineName:'L’Âme des Dannots',colour:'Red',expected:'inao-denom-369'},
  {appellation:'Bourgogne Épineuil Rosé',wineName:'Rosé',colour:'Rosé',expected:'inao-denom-369'},
  {appellation:'Bourgogne Côte Saint-Jacques',producer:'Alain Vignot',wineName:'Les Ronces',colour:'Red',expected:'inao-denom-374'},
  {appellation:'Bourgogne Côte Saint-Jacques',wineName:'Pinot Gris',colour:'Rosé',expected:'inao-denom-374'},
  {appellation:'Bourgogne Côte Saint-Jacques Gris',wineName:'Pinot Gris',colour:'Gris',expected:'inao-denom-374'},
  {appellation:'Bourgogne Côte Saint-Jacques Vin Gris',wineStyle:'rose',expected:'inao-denom-374'},
  {appellation:'Bourgogne Côte Saint-Jacques',wineStyle:'vin gris',expected:'inao-denom-374'},
  // Pinot Gris is also in Vignot's white blend; the grape alone must not imply rosé.
  {appellation:'Bourgogne Côte Saint-Jacques Blanc',wineName:'Chardonnay Pinot Blanc Pinot Gris',colour:'White',expected:'inao-denom-374'},
  {appellation:'Bourgogne Tonnerre',producer:'Famille Moutard',wineName:'Vaumorillon',colour:'White',expected:'inao-denom-1751'},
  {appellation:'Bourgogne Blanc',wineName:'Bourgogne Tonnerre Vaumorillon',colour:'White',expected:'inao-denom-1751'},
 ])('keeps the reviewed label $appellation $wineName at denomination scope',({expected,...wine})=>{
  const target=burgundyVillageMapTarget({...base,region:'Yonne',...wine});
  expect(target).toMatchObject({featureId:expected,mapKind:'regional',scope:'appellation'});
  expect(target).not.toHaveProperty('locationContext');
 });
 for(const [appellation,,,,allowed] of cases.slice(5,11)){
  it.each(['Red','White','Rosé'])(`${appellation}: independently checks colour and style %s`,colour=>{
   const style=colour==='Rosé'?'rose':colour.toLowerCase();
   for(const evidence of [{colour},{wineStyle:style},{colour,wineStyle:style}]){
    const target=burgundyVillageMapTarget({...base,appellation,...evidence});
    if((allowed as readonly string[]).includes(colour))expect(target).toMatchObject({mapKind:'regional'});
    else expect(target).toBeNull();
   }
  });
  it.each(['Yonne','Grand Auxerrois','Chablis et Grand Auxerrois'])(`${appellation}: accepts compatible region %s`,region=>{
   expect(burgundyVillageMapTarget({...base,appellation,region})).toMatchObject({mapKind:'regional'});
  });
  it.each([
   {country:'USA'},{region:'Saône-et-Loire'},{region:'Côte d’Or'},{region:'Côte de Nuits'},{region:'Chablis'},
   {classification:'village'},{classification:'premier_cru'},{classification:'grand_cru'},
   {wineName:'Chablis'},{wineName:'Bourgogne Aligoté'},{referenceSite:'Irancy'},
   {referenceParcel:'Bourgogne Côte Chalonnaise'},{productSubtype:'Sparkling'},
   {identityMatchStatus:'conflict' as const},{colour:'Red',wineStyle:'white'},
   {colour:'White',wineStyle:'red'},{colour:'White',wineStyle:'rose'},
  ])(`${appellation}: rejects contradictory evidence %j`,overrides=>{
   expect(burgundyVillageMapTarget({...base,appellation,...overrides})).toBeNull();
  });
 }
 it.each([
  {appellation:'Bourgogne Épineuil Blanc'},
  {appellation:'Bourgogne Épineuil',wineName:'Blanc',colour:'Red'},
  {appellation:'Bourgogne Tonnerre Rouge'},
  {appellation:'Bourgogne Tonnerre',wineName:'Rosé',colour:'White'},
  {appellation:'Bourgogne Tonnerre',wineName:'Bourgogne Épineuil'},
  {appellation:'Bourgogne Tonnerre',wineName:'Chablis Montée de Tonnerre'},
  {appellation:'Bourgogne Côte Saint-Jacques Vin Gris',colour:'White'},
  {appellation:'Bourgogne Côte Saint-Jacques',wineName:'Vin Gris',colour:'Red'},
  {appellation:'Bourgogne Côte Saint-Jacques',wineName:'Gevrey-Chambertin Clos Saint-Jacques'},
  {appellation:'Bourgogne Tonnerre',colour:'Gris'},
  {appellation:'Bourgogne',region:'Yonne',wineName:'Tonnerre'},
  {appellation:'Bourgogne',region:'Auxerrois',wineName:'Gondonne'},
  {appellation:'Bourgogne',wineName:'Olympe',producer:'Olivier Morin'},
  {appellation:'Bourgogne',wineName:'Chanvan',producer:'Domaine du Clos du Roi'},
  {appellation:'Bourgogne',wineName:'Les Ronces',producer:'Alain Vignot'},
  {appellation:'Bourgogne',wineName:'Vaumorillon',producer:'Famille Moutard'},
  {appellation:'Bourgogne',referenceSite:'Bourgogne Chitry'},
 ])('does not infer colour, tier, a neighbouring denomination or producer holding: %j',wine=>{
  expect(burgundyVillageMapTarget({...base,...wine})).toBeNull();
 });
 it('preserves Chablis Montée de Tonnerre and Gevrey Clos Saint-Jacques',()=>{
  expect(burgundyVillageMapTarget({...base,region:'Yonne',appellation:'Chablis',wineName:'Montée de Tonnerre',classification:'premier_cru',colour:'White'}))
   .toMatchObject({villageId:'chablis',scope:'appellation'});
  expect(burgundyVillageMapTarget({...base,region:'Côte d’Or',appellation:'Gevrey-Chambertin',wineName:'Clos Saint-Jacques',classification:'premier_cru',colour:'Red'}))
   .toMatchObject({villageId:'gevrey-chambertin',scope:'vineyard'});
 });
 it('uses the five source communes for Côtes d’Auxerre and all six for Tonnerre',async()=>{
  expect((await loadVillageMapCatalogue('bourgogne-cotes-dauxerre')).communes.map(c=>c.name).sort())
   .toEqual(['Augy','Auxerre','Quenne','Saint-Bris-le-Vineux','Vincelottes']);
  expect((await loadVillageMapCatalogue('bourgogne-tonnerre')).communes.map(c=>c.id).sort())
   .toEqual(['89137','89153','89211','89262','89418','89447']);
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
    if(lon<3.2||lon>5.3||lat<46.2||lat>48.1)throw new Error(`Out-of-region coordinate in ${catalogue.name}`);
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

describe('small Côte d’Or regional denominations',()=>{
 it.each([
  {appellation:'Bourgogne « La Chapelle Notre Dame » AOC',producer:'Jean-Pierre Maldant',wineName:'Bourgogne La Chapelle Notre-Dame',expected:'inao-denom-371'},
  {appellation:'Bourgogne',producer:'Jean-Pierre Maldant',wineName:'Bourgogne La Chapelle Notre Dame',expected:'inao-denom-371'},
  {appellation:'Bourgogne Le Chapitre',producer:'Domaine Jean Fournier',wineName:'Bourgogne Le Chapitre Vieilles Vignes 2018',expected:'inao-denom-372'},
  {appellation:null,producer:'Domaine Jean Fournier',wineName:'Domaine Jean Fournier Bourgogne Le Chapitre Vieilles Vignes',expected:'inao-denom-372'},
  {appellation:'Bourgogne Montre-Cul',producer:'Derey Frères',wineName:'Montre Cul',expected:'inao-denom-373'},
 ])('keeps the reviewed producer label $wineName at denomination scope',({expected,...wine})=>{
  expect(burgundyVillageMapTarget({...base,region:'Côte d’Or',colour:'Red',...wine}))
   .toMatchObject({featureId:expected,mapKind:'regional',scope:'appellation'});
 });
 it.each(['Bourgogne Montrecul','Bourgogne Montre-Cul','Bourgogne En Montre-Cul','Bourgogne En Montrecul',
  'Bourgogne Montrecul ou Montre-Cul ou En Montre-Cul'])('treats %s as one source denomination',appellation=>{
  expect(burgundyVillageMapTarget({...base,appellation}))
   .toMatchObject({featureId:'inao-denom-373',scope:'appellation'});
 });
 it.each(['Le Chapitre','Le Chapitre 2019'])('keeps modern Marsannay %s on its village area',wineName=>{
  const target=burgundyVillageMapTarget({...base,appellation:'Marsannay',producer:'Domaine Jean Fournier',wineName,colour:'Red',classification:'village'});
  expect(target).toMatchObject({villageName:'Marsannay',featureId:'inao-denom-806-red-white',scope:'appellation'});
  expect(target).not.toHaveProperty('mapKind');
 });
 it('uses the explicit appellation, without guessing a transition from vintage text',()=>{
  for(const year of [2018,2019]){
   expect(burgundyVillageMapTarget({...base,appellation:'Bourgogne Le Chapitre',wineName:`Le Chapitre ${year}`}))
    .toMatchObject({featureId:'inao-denom-372',scope:'appellation'});
   expect(burgundyVillageMapTarget({...base,appellation:'Bourgogne',wineName:`Le Chapitre ${year}`})).toBeNull();
  }
 });
 it('explains the historic Le Chapitre identity without reusing its boundary for Marsannay',async()=>{
  const catalogue=await loadVillageMapCatalogue('bourgogne-le-chapitre');
  expect(catalogue.coverageNote).toContain('Marsannay since the 2019 vintage');
  expect(catalogue.coverageNote).toContain('not an individual producer holding');
  expect(catalogue.features).toHaveLength(1);
  expect(catalogue.features[0].denominationId).toBe(372);
 });
 for(const [appellation,id] of cases.slice(11,14)){
  it(`${appellation}: accepts its subregion and département, but rejects neighbouring regions`,()=>{
   const region=id==='bourgogne-la-chapelle-notre-dame'?'Côte de Beaune':'Côte de Nuits';
   const opposite=region==='Côte de Beaune'?'Côte de Nuits':'Côte de Beaune';
   for(const allowed of [region,'Côte d’Or'])expect(burgundyVillageMapTarget({...base,appellation,region:allowed})).toMatchObject({villageId:id});
   for(const rejected of [opposite,'Yonne','Saône-et-Loire'])expect(burgundyVillageMapTarget({...base,appellation,region:rejected})).toBeNull();
  });
  it.each([
   {classification:'village'},{classification:'premier_cru'},{classification:'grand_cru'},
   {country:'USA'},{identityMatchStatus:'conflict' as const},{productType:'Spirit'},
   {productSubtype:'Sparkling'},{wineStyle:'sparkling'},{wineName:'Crémant'},
   {colour:'Red',wineStyle:'white'},{colour:'White',wineName:'Rouge'},
   {wineName:'Bourgogne Chitry'},{referenceSite:'Marsannay'},
  ])(`${appellation}: withholds contradictory identity %j`,overrides=>{
   expect(burgundyVillageMapTarget({...base,appellation,...overrides})).toBeNull();
  });
 }
 it.each([
  {appellation:'Marsannay',wineName:'Bourgogne Le Chapitre'},
  {appellation:'Bourgogne Le Chapitre',wineName:'Marsannay Le Chapitre'},
  {appellation:'Bourgogne',wineName:'Le Chapitre',producer:'Domaine Jean Fournier'},
  {appellation:'Bourgogne',referenceParcel:'Bourgogne Montrecul'},
  {appellation:'La Chapelle Notre-Dame'},{appellation:'Le Chapitre'},{appellation:'Montrecul'},
  {appellation:null,wineName:'Montrecul'},
  {appellation:'Bourgogne',wineName:'Montrecul',region:'Côte de Beaune'},
  {appellation:'Bourgogne',wineName:'Montrecul Blanc',colour:'Red'},
  {appellation:'Bourgogne',wineName:'La Chapelle Notre-Dame Premier Cru'},
 ])('does not infer a denomination from a bare name, producer or conflicting label %j',wine=>{
  expect(burgundyVillageMapTarget({...base,...wine})).toBeNull();
 });
 // Unlike Le Chapitre (also a Marsannay and Fixin name), these site names
 // belong to one denomination, so a plain Bourgogne label may carry them.
 it.each([
  {appellation:'Bourgogne',wineName:'La Chapelle Notre-Dame',producer:'Jean-Pierre Maldant',expected:'inao-denom-371'},
  {appellation:'Bourgogne Rouge',wineName:'Chapelle Notre Dame',expected:'inao-denom-371'},
  {appellation:'Bourgogne Chapelle Notre-Dame',wineName:'A named cuvée',expected:'inao-denom-371'},
  {appellation:'Bourgogne',wineName:'Montrecul',producer:'Derey Frères',expected:'inao-denom-373'},
  {appellation:'Bourgogne',wineName:'Montre-Cul',region:'Côte d’Or',expected:'inao-denom-373'},
  {appellation:'Burgundy',wineName:'Derey Frères En Montre-Cul Rouge',producer:'Derey Frères',expected:'inao-denom-373'},
 ])('reads a unique site name beside plain Bourgogne %j',({expected,...wine})=>{
  expect(burgundyVillageMapTarget({...base,...wine})).toMatchObject({featureId:expected,mapKind:'regional',scope:'appellation'});
 });
 it.each([
  {appellation:'Ladoix',classification:'village'},
  {appellation:'Chapelle-Chambertin',classification:'grand_cru'},
  {appellation:'Aloxe-Corton',wineName:'Clos du Chapitre',classification:'premier_cru'},
 ])('preserves the distinct identity $appellation $wineName',wine=>{
  const target=burgundyVillageMapTarget({...base,...wine});
  expect(target).not.toBeNull();
  expect(target).not.toHaveProperty('mapKind');
 });
});

describe('southern Mâcon geographic denominations',()=>{
 for(const [appellation,id,featureId,,colours] of cases.slice(14)){
  const site=appellation.replace('Mâcon ','');
  it.each(['Burgundy','Bourgogne','Mâconnais','Saône-et-Loire'])(`${appellation}: accepts region %s`,region=>{
   expect(burgundyVillageMapTarget({...base,appellation,region})).toMatchObject({villageId:id,featureId,mapKind:'regional'});
  });
  it.each(['Mâcon','Macon Blanc'])(`${appellation}: accepts a split %s label`,appellation=>{
   expect(burgundyVillageMapTarget({...base,appellation,wineName:site,colour:'White'})).toMatchObject({featureId,scope:'appellation'});
  });
  it(`${appellation}: recognises the full name in the wine field and normalised label spelling`,()=>{
   for(const app of [null,'Mâcon Blanc'])expect(burgundyVillageMapTarget({...base,appellation:app,wineName:`${appellation} Vieilles Vignes`,colour:'White'})).toMatchObject({featureId});
   expect(burgundyVillageMapTarget({...base,appellation:appellation.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replaceAll(' ','-')+' AOP'})).toMatchObject({featureId});
  });
  it.each(['Red','White','Rosé'])(`${appellation}: checks colour and style independently (%s)`,colour=>{
   const style=colour==='Rosé'?'rose':colour.toLowerCase();
   const label=colour==='White'?'Blanc':colour==='Red'?'Rouge':'Rosé';
   for(const evidence of [{colour},{wineStyle:style},{wineName:label},{appellation:`${appellation} ${label}`}]){
    const target=burgundyVillageMapTarget({...base,appellation,...evidence});
    if((colours as readonly string[]).includes(colour))expect(target).toMatchObject({featureId});
    else expect(target).toBeNull();
   }
  });
  it.each([
   {region:'Côte d’Or'},{region:'Yonne'},{region:'Côte Chalonnaise'},{region:'Beaujolais'},
   {country:'USA'},{classification:'village'},{classification:'premier_cru'},{classification:'grand_cru'},
   {colour:'White',wineStyle:'red'},{colour:'White',wineName:'Rouge'},
   {productSubtype:'Sparkling'},{productType:'Spirit'},{identityMatchStatus:'conflict' as const},
   {referenceSite:'Pouilly-Fuissé'},{wineName:'Saint-Véran'},{wineName:'Mâcon Chaintré'},
   {wineName:'Mâcon-Villages'},{wineName:'Bourgogne Chitry'},
  ])(`${appellation}: withholds contradictory identity %j`,overrides=>{
   expect(burgundyVillageMapTarget({...base,appellation,...overrides})).toBeNull();
  });
  it(`${appellation}: a commune, producer or reference name alone does not select the map`,()=>{
   for(const wine of [{appellation:null,wineName:site},{appellation:'Mâcon',referenceSite:site},
    {appellation:'Mâcon',referenceParcel:appellation},{appellation:'Mâcon',producer:site},
    {appellation:'Bourgogne',wineName:site},{appellation:'Mâcon-Villages',wineName:site},
    {appellation:'Pouilly-Fuissé',wineName:site},{appellation:'Bourgogne',wineName:appellation}]){
    const target=burgundyVillageMapTarget({...base,...wine});
    expect(target?.mapKind).not.toBe('regional');
   }
  });
 }
 it.each([
  {appellation:'Mâcon Charnay Rouge',wineName:'Mâcon Charnay',producer:'Les Orfèvres du Vin',featureId:'inao-denom-1721',colour:'Red'},
  {appellation:'Mâcon Blanc',wineName:'Charnay',producer:'Les Orfèvres du Vin',featureId:'inao-denom-1721',colour:'White'},
  {appellation:'Mâcon Fuissé',wineName:'Les Tâches',producer:'Robert-Denogent',featureId:'inao-denom-2069'},
  {appellation:'Mâcon-Solutré',wineName:'Clos des Bertillonnes',producer:'Robert-Denogent',featureId:'inao-denom-2072'},
  {appellation:'Mâcon Loché',wineName:'Les Longues Terres',producer:'Marcel Couturier',featureId:'inao-denom-2070'},
  {appellation:'Mâcon Vinzelles',wineName:'Le Clos de Grand-Père',producer:'La Soufrandière',featureId:'inao-denom-2074'},
 ])('keeps the named producer wine $wineName at denomination scope',({featureId,...wine})=>{
  expect(burgundyVillageMapTarget({...base,colour:'White',...wine})).toMatchObject({featureId,scope:'appellation',mapKind:'regional'});
 });
 it.each([
  {appellation:'Mâcon',wineName:'Pouilly-Fuissé'},
  {appellation:'Mâcon Blanc',wineName:'Pouilly-Loché'},
  {appellation:'Mâcon',wineName:'Pouilly-Vinzelles'},
  {appellation:'Mâcon',wineName:'Fuissé Vinzelles'},
  {appellation:'Mâcon Fuissé',wineName:'Mâcon Vergisson'},
  {appellation:'Mâcon',wineName:'Loché Mâcon-Villages'},
  {appellation:'Mâcon',wineName:'Domaine de Fuissé',producer:'Domaine de Fuissé'},
  {appellation:'Mâcon Davayé Blanc',wineName:'Rouge',colour:null},
  {appellation:'Mâcon Blanc',wineName:'Charnay Rosé',colour:null},
 ])('does not erase a competing appellation when matching a split site name %j',wine=>{
  expect(burgundyVillageMapTarget({...base,colour:'White',...wine})).toBeNull();
 });
 // Mâcon villages recur in estate, co-operative and landmark names; only the
 // village itself, not "Château-Fuissé" or "Cave de Charnay", is label evidence.
 it.each([
  {appellation:'Mâcon',wineName:'Château-Fuissé Tête de Cru',producer:'Jean-Jacques Vincent'},
  {appellation:'Mâcon',wineName:'Château de Fuissé Blanc',producer:'Joseph Drouhin'},
  {appellation:'Mâcon',wineName:'Domaine de Fuissé Vieilles Vignes'},
  {appellation:'Mâcon Rouge',wineName:'Cave de Charnay Rouge',producer:'Cave de Charnay-lès-Mâcon',colour:'Red'},
  {appellation:'Mâcon',wineName:'Roche de Solutré'},
  {appellation:'Mâcon Blanc',wineName:'Les Vignes de Vergisson'},
  {appellation:'Mâcon',wineName:'Caves de Loché Blanc'},
 ])('does not read a village inside an estate or landmark name %j',wine=>{
  expect(burgundyVillageMapTarget({...base,colour:'White',...wine})?.mapKind).not.toBe('regional');
 });
 it.each([
  {appellation:'Mâcon',wineName:'Fuissé Vieilles Vignes',featureId:'inao-denom-2069'},
  {appellation:'Mâcon Blanc',wineName:'Vergisson La Roche',featureId:'inao-denom-1736'},
  {appellation:'Mâcon',wineName:'Château-Fuissé Fuissé',featureId:'inao-denom-2069'},
  {appellation:'Mâcon Rouge',wineName:'Cave de Charnay Charnay Rouge',featureId:'inao-denom-1721',colour:'Red'},
 ])('still reads the village when it stands on its own $wineName',({featureId,...wine})=>{
  expect(burgundyVillageMapTarget({...base,colour:'White',...wine})).toMatchObject({featureId,mapKind:'regional'});
 });
 it.each(['Pouilly-Fuissé','Pouilly-Loché','Pouilly-Vinzelles','Saint-Véran'])('preserves %s village identity',appellation=>{
  const target=burgundyVillageMapTarget({...base,appellation,colour:'White',classification:'village'});
  expect(target).toMatchObject({villageName:appellation,scope:'appellation'});
  expect(target).not.toHaveProperty('mapKind');
 });
 it('counts Fuissé once despite its duplicate source label, and explains Loché’s current commune',async()=>{
  const fuisse=await loadVillageMapCatalogue('macon-fuisse');
  expect(fuisse.features).toHaveLength(1);
  expect(fuisse.features[0]).toMatchObject({denominationId:2069,areaHa:342.09});
  expect(fuisse.coverageNote).toContain('Mâcon AOC');
  const loche=await loadVillageMapCatalogue('macon-loche');
  expect(loche.communes).toMatchObject([{id:'71270',name:'Mâcon'}]);
  expect(loche.coverageNote).toContain('Loché is within the current commune of Mâcon');
 });
});

describe('Saint abbreviations in regional names',()=>{
 it.each(['Bourgogne Côte St-Jacques','Bourgogne Côte St Jacques','Bourgogne Cote Saint Jacques'])('%s opens Côte Saint-Jacques',appellation=>{
  expect(burgundyVillageMapTarget({...base,appellation,colour:'Red'})?.featureId).toBe('inao-denom-374');
 });
});
