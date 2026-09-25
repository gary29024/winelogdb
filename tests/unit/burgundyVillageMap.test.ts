import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { snapshotLabel,burgundyVillageMapTarget,type VillageMapCatalogue } from '../../src/lib/places/burgundyVillageMap';
import catalogue from '../../src/lib/places/burgundyVillageMapCatalogue.json';
import morey from '../../src/lib/places/moreyVillageMapCatalogue.json';
import chambolle from '../../src/lib/places/chambolleVillageMapCatalogue.json';
import vosne from '../../src/lib/places/vosneVillageMapCatalogue.json';
import registry from '../../src/lib/places/burgundyVillageMapRegistry.json';
import { loadVillageMapCatalogue } from '../../src/lib/places/loadVillageMapCatalogue';
import type { FeatureCollection,MultiPolygon,Polygon } from 'geojson';

const catalogues:VillageMapCatalogue[]=[catalogue,morey,chambolle,vosne];

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
   {identityMatchStatus:'conflict' as const},{classification:null},{appellation:'Clos de Vougeot',classification:'grand_cru'}]){
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
  const byId=new Map(catalogues.flatMap(c=>c.features).map(f=>[f.id,f]));
  const notes=Object.assign({},...catalogues.map(c=>c.notes)) as VillageMapCatalogue['notes'];
  const unpaintedVillageMapIds=Object.entries(notes).filter(([,entry])=>entry.paintedBy).map(([id])=>id);
  for(const [id,entry] of Object.entries(notes)){
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

describe.each([
 {catalogue:morey,grands:5,premiers:20,broad:'inao-denom-949',village:'inao-denom-928'},
 {catalogue:chambolle,grands:2,premiers:24,broad:'inao-denom-474',village:'inao-denom-449'},
 {catalogue:vosne,grands:8,premiers:14,broad:'inao-denom-1277',village:'inao-denom-1262'},
])('$catalogue.name identities and boundaries',({catalogue:c,grands,premiers,broad,village})=>{
 const data=JSON.parse(readFileSync(`public${c.dataUrl}`,'utf8')) as FeatureCollection<Polygon|MultiPolygon>;
 it('resolves every named cru and retains appellation scope for broad wines',()=>{
  const base={...wine,appellation:c.name};
  expect(c.features.filter(f=>f.tier==='grand_cru')).toHaveLength(grands);
  expect(c.features.filter(f=>f.kind==='vineyard'&&f.tier==='premier_cru')).toHaveLength(premiers);
  for(const feature of c.features.filter(f=>f.kind==='vineyard')){
   const target=burgundyVillageMapTarget({...base,classification:feature.tier,wineName:feature.name,
    appellation:feature.tier==='grand_cru'?feature.name:c.name});
   expect(target,feature.name).toMatchObject({featureId:feature.id,scope:'vineyard',
    villageId:feature.denominationId===361?'chambolle-musigny':c.id});
  }
  const blend=c.features.filter(f=>f.kind==='vineyard'&&f.tier==='premier_cru').slice(0,2).map(f=>f.name).join(' et ');
  for(const wineName of [c.name+' Premier Cru','Unknown vineyard',blend]){
   expect(burgundyVillageMapTarget({...base,wineName})).toMatchObject({featureId:broad,villageId:c.id,scope:'appellation'});
  }
  expect(burgundyVillageMapTarget({...base,wineName:c.name,classification:'village'})).toMatchObject({featureId:village,scope:'appellation'});
 });
 it('rejects conflicts and an unproven Premier Cru tier',()=>{
  for(const overrides of [{country:'USA'},{region:'Bordeaux'},{identityMatchStatus:'conflict' as const},{classification:null}]){
   const wineName=c.features.find(f=>f.kind==='vineyard'&&f.tier==='premier_cru')!.name;
   expect(burgundyVillageMapTarget({...wine,appellation:c.name,wineName,...overrides})).toBeNull();
  }
 });
 it('publishes exactly the expected wine and commune identities with intact rings',()=>{
  const expectedIds=[...c.features.map(f=>f.id),...c.communes.map(commune=>`commune-${commune.id}`)].sort();
  expect(data.features.map(f=>f.id).sort()).toEqual(expectedIds);
  for(const feature of data.features){
   expect(['Polygon','MultiPolygon']).toContain(feature.geometry.type);
   const rings=feature.geometry.type==='Polygon'?feature.geometry.coordinates:feature.geometry.coordinates.flat();
   for(const ring of rings){
    expect(ring.length).toBeGreaterThanOrEqual(4);expect(ring[0]).toEqual(ring.at(-1));
    expect(ring.every(([lng,lat])=>lng>4.9&&lng<5.05&&lat>47.1&&lat<47.3)).toBe(true);
   }
  }
  for(const feature of c.features){
   expect(data.features.find(f=>f.id===feature.id)?.properties).toMatchObject({name:feature.name,denominationId:feature.denominationId,communes:feature.communes});
  }
  expect(c.sources.every(s=>s.sha256.length===64&&s.license.startsWith('Licence Ouverte'))).toBe(true);
 });
});

describe('village registry',()=>{
 it('keeps shared Bonnes-Mares whole and identical in both village contexts',()=>{
  const features=[morey,chambolle].map(c=>JSON.parse(readFileSync(`public${c.dataUrl}`,'utf8')).features.find((f:{id:string})=>f.id==='inao-denom-361'));
  expect(features[0]).toEqual(features[1]);
  expect(features[0].properties.communes).toEqual(['21133','21442']);
  expect(morey.features.find(f=>f.id==='inao-denom-361')).toEqual(chambolle.features.find(f=>f.id==='inao-denom-361'));
  expect(burgundyVillageMapTarget({...wine,appellation:'Bonnes Mares Grand Cru',wineName:'Bonnes-Mares',classification:'grand_cru'}))
   .toMatchObject({villageId:'chambolle-musigny',featureId:'inao-denom-361'});
 });
 it('distinguishes identically named Premier Crus by village',()=>{
  expect(burgundyVillageMapTarget({...wine,appellation:'Morey-Saint-Denis',wineName:'Les Gruenchers'})?.featureId).toBe('inao-denom-944');
  expect(burgundyVillageMapTarget({...wine,appellation:'Chambolle-Musigny',wineName:'Les Gruenchers'})?.featureId).toBe('inao-denom-467');
  expect(burgundyVillageMapTarget({...wine,appellation:'Chambolle-Musigny',wineName:'Les Fuees'})?.featureId).toBe('inao-denom-465');
  expect(burgundyVillageMapTarget({...wine,appellation:'Chambolle-Musigny',wineName:'Les Feusselotes'})?.featureId).toBe('inao-denom-464');
 });
 it('has one target per identity and a working lazy catalogue for every village',async()=>{
  expect(registry.targets).toHaveLength(115);
  expect(new Set(registry.targets.map(t=>t.matchId)).size).toBe(115);
  for(const village of registry.villages){
   const c=await loadVillageMapCatalogue(village.id);
   expect(catalogues.find(expected=>expected.id===village.id)).toEqual(c);
   for(const target of registry.targets.filter(t=>t.villageId===village.id)){
    expect(c.features.find(f=>f.matchId===target.matchId)).toMatchObject({id:target.featureId,name:target.name,kind:target.scope});
   }
  }
  await expect(loadVillageMapCatalogue('unknown-village')).rejects.toThrow('unavailable');
 });
});

describe('Vosne-Romanée and Flagey-Échezeaux',()=>{
 it('keeps full source boundaries alongside the three reviewed overview-only exclusions',()=>{
  const data=JSON.parse(readFileSync(`public${vosne.dataUrl}`,'utf8')) as {
   features:Array<{id:string;geometry:Polygon|MultiPolygon;contextGeometry?:Polygon|MultiPolygon}>
  };
  const contextFeatures=data.features.filter(f=>f.contextGeometry);
  expect(contextFeatures.map(f=>f.id).sort()).toEqual(['inao-denom-1269','inao-denom-1271','inao-denom-1276']);
  for(const feature of contextFeatures){
   expect(feature.contextGeometry).not.toEqual(feature.geometry);
   const context=feature.contextGeometry!;
   const rings=context.type==='Polygon'?context.coordinates:context.coordinates.flat();
   expect(rings.every(r=>r.length>=4&&r[0][0]===r.at(-1)![0]&&r[0][1]===r.at(-1)![1])).toBe(true);
  }
  expect(data.features.find(f=>f.id==='inao-denom-565')?.contextGeometry).toBeUndefined();
 });
 it('includes both producing communes without clipping shared Premier Cru or appellation areas',()=>{
  const byDenom=(id:number)=>vosne.features.find(f=>f.denominationId===id)!;
  for(const id of [1262,1277,1271])expect(byDenom(id).communes).toEqual(['21267','21714']);
  for(const id of [565,645,1269,1275])expect(byDenom(id).communes).toEqual(['21267']);
  for(const id of [654,655,656,1083,1084,1085])expect(byDenom(id).communes).toEqual(['21714']);
  expect(vosne.communes.map(c=>c.id).sort()).toEqual(['21267','21714']);
 });
 it('keeps similarly named Grand Crus and the Gevrey Premier Cru La Romanée separate',()=>{
  const grand=(appellation:string)=>burgundyVillageMapTarget({...wine,appellation,wineName:appellation,classification:'grand_cru'});
  expect(grand('Echezeaux')).toMatchObject({villageId:'vosne-romanee',featureId:'inao-denom-565'});
  expect(grand('Grands Echezeaux')).toMatchObject({villageId:'vosne-romanee',featureId:'inao-denom-645'});
  expect(grand('La Romanee')?.featureId).toBe('inao-denom-655');
  expect(grand('Romanee Conti')?.featureId).toBe('inao-denom-1084');
  expect(grand('Romanee St Vivant')?.featureId).toBe('inao-denom-1085');
  const gevreyRomanee=catalogue.features.find(f=>f.name==='La Romanée')!;
  expect(burgundyVillageMapTarget({...wine,wineName:'La Romanée'}))
   .toMatchObject({villageId:'gevrey-chambertin',featureId:gevreyRomanee.id});
 });
 it('accepts reviewed label spellings and preserves the exact source identities',()=>{
  for(const [wineName,id] of [['Les Petits Monts',1274],['Les Petis Monts',1274],['Aux Reignots',1266],['Aux Raignots',1266],['Aux Brûlées',1264]] as const){
   const base={...wine,appellation:'Vosne-Romanée',wineName};
   expect(burgundyVillageMapTarget(base)).toMatchObject({featureId:`inao-denom-${id}`,scope:'vineyard'});
   expect(burgundyVillageMapTarget({...base,classification:null})).toBeNull();
  }
  expect(vosne.features.find(f=>f.id==='inao-denom-1274')).toMatchObject({name:'Les Petits Monts',sourceName:'Vosne-Romanée premier cru Les Petis Monts'});
  expect(burgundyVillageMapTarget({...wine,appellation:'Vosne-Romanée',wineName:'Aux Reignots et Les Petits Monts'}))
   .toMatchObject({featureId:'inao-denom-1277',scope:'appellation'});
 });
});

describe('source snapshot labels',()=>{
 it('shows a dated release by day and a monthly snapshot by month alone',()=>{
  expect(snapshotLabel('2026-09-21')).toBe('21 Sep 2026');
  expect(snapshotLabel('2026-06-01',true)).toBe('Jun 2026');
 });
 it('falls back to the raw value rather than inventing a date',()=>{
  expect(snapshotLabel('unknown')).toBe('unknown');
  expect(snapshotLabel(undefined)).toBe('');
 });
});

describe('display names',()=>{
 it('shows one spelling where INAO records alternatives, keeping the source name and Atlas identity',()=>{
  const feature=chambolle.features.find(f=>f.id==='inao-denom-464')!;
  expect(feature.name).toBe('Les Feusselottes');
  expect(feature.sourceName).toBe('Chambolle-Musigny premier cru Les Feusselottes ou Les Feusselotes');
  expect(feature.atlasUrl).toContain('les-feusselottes-ou-les-feusselotes');
 });
});
