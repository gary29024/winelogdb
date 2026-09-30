import {afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {burgundyVillageMapTarget} from '../../src/lib/places/burgundyVillageMap';
import {loadVillageMapCatalogue} from '../../src/lib/places/loadVillageMapCatalogue';
import {loadVillageMapData} from '../../src/lib/places/loadVillageMapData';
import named from '../../src/lib/places/grandCruParcels/echezeaux.named-plot-index.json';
import namedCatalogue from '../../src/lib/places/grandCruParcels/echezeaux.named-plots.json';
import parcelManifest from '../../src/lib/places/grandCruParcels/flagey-echezeaux.manifest.json';
import namedReport from '../../scripts/grand-crus/reports/echezeaux-named-plots.json';
import parcelReport from '../../scripts/grand-crus/reports/flagey-echezeaux-parcels.json';
import type {Parcels} from '../../src/features/vineyards/GrandCruParcels';

const wine={country:'France',region:'Burgundy',appellation:'Échezeaux',classification:'grand_cru',colour:'red',wineName:''};
const target=(overrides:Partial<typeof wine>&{referenceSite?:string;referenceParcel?:string;identityMatchStatus?:'conflict'})=>burgundyVillageMapTarget({...wine,...overrides});
afterEach(()=>vi.unstubAllGlobals());

describe('Échezeaux named-area identity',()=>{
 for(const plot of named.plots)for(const name of [plot.name,...plot.aliases]){
  it(`selects ${name} while retaining the Échezeaux INAO identity`,()=>{
   for(const field of ['wineName','referenceSite','referenceParcel'])expect(target({[field]:name})).toMatchObject({featureId:'inao-denom-565',name:'Échezeaux',namedPlotId:plot.id});
   expect(target({appellation:`Echezeaux Grand Cru ${name}`})).toMatchObject({featureId:'inao-denom-565',namedPlotId:plot.id});
  });
 }
 it.each(['Les Poulaillères','LES POULA','Les Beaux Monts Hauts','En Orveau','Orveaux','Les Treux et En Orveaux','Les Treux / Les Loachausses','Les Cruots et Les Poulaillères','Les Loachausses unknown blend','Les Treux Grands Échezeaux','Les Treux Clos de Tart','Domaine de la Romanée-Conti Les Treux'])('keeps unknown or mixed name %s at cru scope',wineName=>{
  expect(target({wineName})).toMatchObject({featureId:'inao-denom-565'});
  expect(target({wineName})?.namedPlotId).toBeUndefined();
 });
 it('rejects conflicting reference fields and does not use a producer name to infer holdings',()=>{
  expect(target({wineName:'Les Treux',referenceSite:'En Orveaux'})?.namedPlotId).toBeUndefined();
  expect(target({wineName:'Les Treux',referenceSite:'Unknown area'})?.namedPlotId).toBeUndefined();
  expect(target({wineName:'Domaine de la Romanée-Conti'})?.namedPlotId).toBeUndefined();
  expect(target({appellation:'Échezeaux Clos de Tart',wineName:'Les Treux'})).toBeNull();
  expect(target({wineName:'Les Treux',referenceSite:'Grands Échezeaux'})).toBeNull();
 });
 it.each([{country:'USA'},{region:'Bordeaux'},{classification:'premier_cru'},{classification:'village'},{colour:'white'},{colour:'rose'},{identityMatchStatus:'conflict' as const},{wineName:'Echezeaux Premier Cru Les Treux'}])('withholds conflicting identity %j',fields=>expect(target(fields)).toBeNull());
 it('does not reinterpret homonyms in other crus or promote Vosne En Orveaux',()=>{
  expect(target({appellation:'Clos Saint-Denis',wineName:'Clos Saint-Denis'})).toMatchObject({villageId:'morey-saint-denis'});
  expect(target({appellation:'Grands Échezeaux',wineName:'Grands Échezeaux'})).toMatchObject({featureId:'inao-denom-645'});
  const premier=target({appellation:'Vosne-Romanée',wineName:'En Orveaux',classification:'premier_cru'});
  expect(premier?.featureId).toBe('inao-denom-1269');expect(premier?.namedPlotId).toBeUndefined();
 });
});

describe('Pilot sources and geometry',()=>{
 it('loads the additional named layer only into the Vosne/Flagey catalogue and leaves official features unchanged',async()=>{
  const catalogue=await loadVillageMapCatalogue('vosne-romanee');
  expect(catalogue.features.filter(f=>f.kind==='named_plot')).toEqual(namedCatalogue.features);
  expect(catalogue.namedPlots?.source.sha256).toBe(namedReport.source.sha256);
  expect((await loadVillageMapCatalogue('vougeot')).namedPlots).toBeUndefined();
  expect(new Set(catalogue.features.map(f=>f.id)).size).toBe(catalogue.features.length);
  expect(namedCatalogue.features.every(f=>f.parentFeatureId==='inao-denom-565'&&f.denominationId===null&&f.atlasUrl===null)).toBe(true);
 });
 it('pins exact payloads and records the unresolved name without gap filling',()=>{
  for(const report of [namedReport,parcelReport]){
   const bytes=readFileSync('public'+report.dataUrl,'utf8').replace(/\r\n/g,'\n');
   expect(createHash('sha256').update(bytes).digest('hex')).toBe(report.sha256);
   expect(Buffer.byteLength(bytes)).toBe(report.bytes);
  }
  expect(namedReport.plots).toHaveLength(10);
  expect(namedReport.unmappedHa).toBeGreaterThan(5);
  expect(namedReport.unresolved[0].sourceCandidate).toBe('LES POULA');
  expect(namedReport.gzipEquivalentBytes).toBeLessThan(15000);
  expect(parcelReport.gzipEquivalentBytes).toBeLessThan(45000);
 });
 it('retains unknown rights, source codes, pseudo-identifiers and the distinction between owners and farmers',()=>{
  const data=JSON.parse(readFileSync('public'+parcelManifest.dataUrl,'utf8')) as Parcels;
  expect(data.features).toHaveLength(308);
  expect(data.features.filter(f=>f.properties.recordedRights.length)).toHaveLength(138);
  expect(data.features.filter(f=>!f.properties.recordedRights.length)).toHaveLength(170);
  const rights=data.features.flatMap(f=>f.properties.recordedRights);
  expect(rights.some(r=>r.rightCode==='N'&&r.rightLabel==='Nu-propriétaire')).toBe(true);
  for(const right of rights)expect(right.siren).toBe(/^\d{9}$/.test(right.holderId)?right.holderId:null);
  expect(rights.some(r=>r.holderId.startsWith('U')&&r.siren===null)).toBe(true);
  expect(data.features.every(f=>f.properties.domaineLinks.length===0)).toBe(true);
  expect(parcelManifest.rightsAsOf).toBe('2025-01-01');
  expect(parcelManifest.cadastreDate).toBe('2026-06-01');
  for(const f of data.features){
   expect(f.id).toBe(f.properties.id);expect(f.properties.id).toMatch(/^21267\d{3}[A-Z0-9]{2}\d{4}$/);
   expect(f.properties.overlaps.length).toBeGreaterThan(0);
   for(const o of f.properties.overlaps){expect(o.areaM2).toBeGreaterThan(1);expect(o.parcelPercent).toBeGreaterThan(0);expect(o.parcelPercent).toBeLessThanOrEqual(100.001)}
  }
 });
});

it('fetches the independent named layer lazily with the canonical map and preserves cancellation',async()=>{
 const catalogue=await loadVillageMapCatalogue('vosne-romanee');
 const fetcher=vi.fn(async(url:string)=>Response.json(JSON.parse(readFileSync('public'+url,'utf8'))));
 vi.stubGlobal('fetch',fetcher);const controller=new AbortController();
 const data=await loadVillageMapData(catalogue,controller.signal) as {features:unknown[]};
 expect(data.features).toEqual([...JSON.parse(readFileSync('public'+catalogue.dataUrl,'utf8')).features,...JSON.parse(readFileSync('public'+namedCatalogue.dataUrl,'utf8')).features]);
 expect(fetcher.mock.calls.map(c=>c[0]).sort()).toEqual([catalogue.dataUrl,namedCatalogue.dataUrl].sort());
 vi.stubGlobal('fetch',vi.fn(async()=>{controller.abort();return Response.json({type:'FeatureCollection',features:[]})}));
 await expect(loadVillageMapData(catalogue,controller.signal)).rejects.toMatchObject({name:'AbortError'});
});

it('rejects an unavailable named layer without substituting broader geometry for a named selection',async()=>{
 const catalogue=await loadVillageMapCatalogue('vosne-romanee');
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>url===namedCatalogue.dataUrl?new Response(null,{status:503}):Response.json({type:'FeatureCollection',features:[]})));
 await expect(loadVillageMapData(catalogue,new AbortController().signal)).rejects.toThrow('Boundary download failed');
});
