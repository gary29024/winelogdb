import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { burgundyVillageMapTarget,gevreyMapCatalogue as catalogue } from '../../src/lib/places/burgundyVillageMap';
import type { FeatureCollection,MultiPolygon,Polygon } from 'geojson';
import { unpaintedVillageMapIds,villageMapNotes } from '../../src/lib/places/burgundyVillageMapNotes';

const wine={country:'France',region:'Burgundy',appellation:'Gevrey-Chambertin',wineName:'Les Cazetiers',classification:'premier_cru'};

describe('Gevrey village map identity',()=>{
 it('maps all 9 Grand Crus and 26 Premier Cru climats to their own INAO identities',()=>{
  const named=catalogue.features.filter(f=>f.kind==='vineyard');
  expect(named.filter(f=>f.tier==='grand_cru')).toHaveLength(9);
  expect(named.filter(f=>f.tier==='premier_cru')).toHaveLength(26);
  for(const feature of named){
   const target=burgundyVillageMapTarget({...wine,classification:feature.tier,wineName:feature.name,
    appellation:feature.tier==='grand_cru'?feature.name:'Gevrey-Chambertin'});
   expect(target,feature.name).toMatchObject({featureId:feature.id,scope:'vineyard'});
  }
 });
 it('accepts accents, aliases, and accepted reference site metadata',()=>{
  expect(burgundyVillageMapTarget({...wine,wineName:'',referenceSite:'Les Cazetiers'})?.featureId).toBe('inao-denom-610');
  expect(burgundyVillageMapTarget({...wine,wineName:'Gevrey Chambertin 1er Cru Cazetiers',classification:null})?.featureId).toBe('inao-denom-610');
  expect(burgundyVillageMapTarget({...wine,appellation:'Chambertin Clos de Beze Grand Cru',classification:'grand_cru',wineName:''})?.featureId).toBe('inao-denom-448');
 });
 it('broadens unnamed and blended Premier Crus without selecting a vineyard',()=>{
  for(const wineName of ['Gevrey-Chambertin Premier Cru','Les Cazetiers et Les Corbeaux','Unknown vineyard']){
   expect(burgundyVillageMapTarget({...wine,wineName})).toMatchObject({featureId:'inao-denom-616',scope:'appellation'});
  }
  expect(burgundyVillageMapTarget({...wine,wineName:'Gevrey-Chambertin',classification:'village'})).toMatchObject({featureId:'inao-denom-589',scope:'appellation'});
 });
 it('withholds conflicts, incompatible geography, unsupported villages and an unproven cru tier',()=>{
  for(const fields of [{country:'USA'},{region:'Bordeaux'},{appellation:'Meursault'},
   {identityMatchStatus:'conflict' as const},{classification:null},{appellation:'La Romanée',classification:'grand_cru'}]){
   expect(burgundyVillageMapTarget({...wine,...fields}),JSON.stringify(fields)).toBeNull();
  }
 });
});

describe('published village geometry',()=>{
 const data=JSON.parse(readFileSync(`public${catalogue.dataUrl}`,'utf8')) as FeatureCollection<Polygon|MultiPolygon>;
 it('ships every catalogue identity once with closed rings and geographic coordinates',()=>{
  expect(data.type).toBe('FeatureCollection');
  expect(data.features).toHaveLength(39);
  expect(new Set(data.features.map(f=>f.id)).size).toBe(39);
  for(const feature of catalogue.features){
   const polygon=data.features.find(f=>f.id===feature.id)!;
   expect(polygon?.properties).toMatchObject({denominationId:feature.denominationId,name:feature.name});
  }
  for(const feature of data.features){
   const rings=feature.geometry.type==='Polygon'?feature.geometry.coordinates:feature.geometry.coordinates.flat();
   for(const ring of rings){
    expect(ring.length).toBeGreaterThanOrEqual(4);
    expect(ring[0]).toEqual(ring.at(-1));
    for(const [lng,lat] of ring){expect(lng).toBeGreaterThan(4.8);expect(lng).toBeLessThan(5.1);expect(lat).toBeGreaterThan(47.1);expect(lat).toBeLessThan(47.3)}
   }
  }
 });
 it('keeps Brochon coverage and overlapping legal designations instead of inventing disjoint plots',()=>{
  expect(catalogue.features.find(f=>f.denominationId===589)?.communes).toEqual(['21110','21295']);
  const geometry=(id:number)=>data.features.find(f=>f.properties?.denominationId===id)!.geometry;
  expect(geometry(477)).toEqual(geometry(809));
  expect(catalogue.features.find(f=>f.denominationId===447)!.areaHa).toBeGreaterThan(catalogue.features.find(f=>f.denominationId===448)!.areaHa);
  expect(catalogue.sources.every(source=>source.sha256.length===64&&source.license.startsWith('Licence Ouverte'))).toBe(true);
 });
});

describe('overlap notes',()=>{
 it('only names catalogue crus, and leaves a cru unpainted only where a same-tier fill covers it',()=>{
  const byId=new Map(catalogue.features.map(f=>[f.id,f]));
  for(const [id,entry] of Object.entries(villageMapNotes)){
   expect(byId.get(id)?.kind,id).toBe('vineyard');
   if(!entry.paintedBy)continue;
   const cover=byId.get(entry.paintedBy)!;
   expect(cover.kind,id).toBe('vineyard');
   expect(cover.tier,id).toBe(byId.get(id)!.tier);
   // The cover must itself be painted and at least as large.
   expect(unpaintedVillageMapIds).not.toContain(cover.id);
   expect(cover.areaHa).toBeGreaterThanOrEqual(byId.get(id)!.areaHa);
  }
  expect(unpaintedVillageMapIds.sort()).toEqual(['inao-denom-448','inao-denom-809']);
 });
});
