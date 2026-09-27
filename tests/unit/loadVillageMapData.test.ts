import { afterEach,describe,expect,it,vi } from 'vitest';
import { readFileSync,readdirSync } from 'node:fs';
import { gzipSync,gunzipSync } from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';
import { loadVillageMapData } from '../../src/lib/places/loadVillageMapData';
import macon from '../../src/lib/places/maconMapCatalogue.json';
import villages from '../../src/lib/places/macon-villagesMapCatalogue.json';
import bourgogne from '../../src/lib/places/bourgogneMapCatalogue.json';
import aligote from '../../src/lib/places/bourgogne-aligoteMapCatalogue.json';
import passetoutgrains from '../../src/lib/places/bourgogne-passe-tout-grainsMapCatalogue.json';
import mousseux from '../../src/lib/places/bourgogne-mousseuxMapCatalogue.json';
import coteaux from '../../src/lib/places/coteaux-bourguignonsMapCatalogue.json';
import cremant from '../../src/lib/places/cremant-de-bourgogneMapCatalogue.json';

afterEach(()=>vi.unstubAllGlobals());
const packed=(url:string)=>Uint8Array.from(readFileSync(`public${url}`));

describe('compact boundary downloads',()=>{
 for(const [catalogue,ratio] of [[macon,.6],[villages,.6],[bourgogne,.65],[aligote,.65],[passetoutgrains,.65],[mousseux,.65],[coteaux,.65],[cremant,.65]] as const){
  it(`restores every coordinate and property of ${catalogue.name} within its download budget`,async()=>{
   const raw=readFileSync(`public${catalogue.dataUrl}`),bytes=packed(catalogue.geobufUrl);
   const fetcher=vi.fn(async()=>new Response(bytes));vi.stubGlobal('fetch',fetcher);
   const signal=new AbortController().signal;
   const actual=await loadVillageMapData(catalogue,signal);
   expect(isDeepStrictEqual(actual,JSON.parse(raw.toString()))).toBe(true);
   expect(bytes.byteLength).toBeLessThan(gzipSync(raw).byteLength*ratio);
   expect(fetcher).toHaveBeenCalledExactlyOnceWith(catalogue.geobufUrl,{signal});
  },catalogue.id==='cremant-de-bourgogne'?15000:5000);
 }
 it('accepts a compact body already decompressed by the HTTP layer',async()=>{
  const bytes=Uint8Array.from(gunzipSync(packed(macon.geobufUrl)));
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(bytes,{headers:{'Content-Encoding':'gzip'}})));
  const actual=await loadVillageMapData(macon,new AbortController().signal);
  expect(isDeepStrictEqual(actual,JSON.parse(readFileSync(`public${macon.dataUrl}`,'utf8')))).toBe(true);
 });
 it('keeps the original path for browsers without native gzip support',async()=>{
  vi.stubGlobal('DecompressionStream',undefined);
  const expected={type:'FeatureCollection',features:[]};
  const fetcher=vi.fn(async()=>Response.json(expected));vi.stubGlobal('fetch',fetcher);
  const signal=new AbortController().signal;
  expect(await loadVillageMapData(macon,signal)).toEqual(expected);
  expect(fetcher).toHaveBeenCalledExactlyOnceWith(macon.dataUrl,{signal});
 });
 it('loads Crémant without native gzip support using its deployable compact fallback',async()=>{
  vi.stubGlobal('DecompressionStream',undefined);
  const bytes=packed(cremant.geobufRawUrl);
  expect(Buffer.from(bytes).equals(gunzipSync(packed(cremant.geobufUrl)))).toBe(true);
  expect(bytes.byteLength).toBeLessThan(25*1024*1024);
  const fetcher=vi.fn(async()=>new Response(bytes));vi.stubGlobal('fetch',fetcher);
  const signal=new AbortController().signal;
  const actual=await loadVillageMapData(cremant,signal);
  expect(isDeepStrictEqual(actual,JSON.parse(readFileSync(`public${cremant.dataUrl}`,'utf8')))).toBe(true);
  expect(fetcher).toHaveBeenCalledExactlyOnceWith(cremant.geobufRawUrl,{signal});
 },15000);
 it('keeps GeoJSON loading for maps without a compact copy',async()=>{
  const expected={type:'FeatureCollection',features:[]};
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json(expected)));
  expect(await loadVillageMapData({dataUrl:'/maps/other.geojson'},new AbortController().signal)).toEqual(expected);
 });
 it('does not start a larger fallback download when the compact request fails',async()=>{
  const fetcher=vi.fn(async()=>new Response('Unavailable',{status:503}));vi.stubGlobal('fetch',fetcher);
  await expect(loadVillageMapData(macon,new AbortController().signal)).rejects.toThrow('Boundary download failed');
  expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it('rejects truncated gzip so the dialog can offer a retry',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(packed(macon.geobufUrl).slice(0,20))));
  await expect(loadVillageMapData(macon,new AbortController().signal)).rejects.toThrow();
 });
 it('stops after cancellation even if the body has already arrived',async()=>{
  const controller=new AbortController();
  vi.stubGlobal('fetch',vi.fn(async()=>{
   controller.abort();return new Response(packed(macon.geobufUrl));
  }));
  await expect(loadVillageMapData(macon,controller.signal)).rejects.toMatchObject({name:'AbortError'});
 });
});

// Compact downloads are the largest boundary files. Each keeps the 60-second
// limit so a slow connection cannot abort Mâcon while larger maps still load.
// Crémant (6.5 MB, about 55 s at 1 Mbps) alone gets 120 seconds of headroom.
describe('compact map download limits',()=>{
 const dir='src/lib/places';
 const compact=readdirSync(dir).filter(name=>name.endsWith('MapCatalogue.json'))
  .map(name=>({name,catalogue:JSON.parse(readFileSync(`${dir}/${name}`,'utf8'))}))
  .filter(({catalogue})=>catalogue.geobufUrl);
 it('covers the Mâcon, Mâcon-Villages and partial Bourgogne maps',()=>{
  expect(compact.map(({catalogue})=>catalogue.id)).toEqual(expect.arrayContaining(['macon','macon-villages','bourgogne','bourgogne-aligote']));
 });
 it.each(compact.map(({name,catalogue})=>[name,catalogue]))('%s allows its reviewed download time',(_name,catalogue)=>{
  expect(catalogue.downloadTimeoutMs).toBe(catalogue.id==='cremant-de-bourgogne'?120000:60000);
 });
});
