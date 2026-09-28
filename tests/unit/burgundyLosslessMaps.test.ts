import {afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {brotliDecompressSync,gunzipSync} from 'node:zlib';
import {isDeepStrictEqual} from 'node:util';
import registry from '../../src/lib/places/burgundyLosslessMapRegistry.json';
import report from '../../scripts/burgundy-lossless-map-report.json';
import {loadVillageMapCatalogue} from '../../src/lib/places/loadVillageMapCatalogue';
import {loadVillageMapData} from '../../src/lib/places/loadVillageMapData';

const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const source=(path:string)=>readFileSync(path,'utf8').replace(/\r\n/g,'\n');
afterEach(()=>vi.unstubAllGlobals());

describe.each(Object.entries(registry))('%s lossless map transport',(id,entry)=>{
 it('preserves the complete source bytes, including full-precision coordinates and display geometry',async()=>{
  const catalogue=await loadVillageMapCatalogue(id),row=report.maps.find(m=>m.id===id)!;
  expect(catalogue).toMatchObject(entry);
  const canonical=source('public'+catalogue.dataUrl);
  const gzip=readFileSync('public'+entry.gzipJsonUrl),brotli=readFileSync('public'+entry.brotliJsonUrl);
  expect(new TextDecoder().decode(brotliDecompressSync(brotli))).toBe(canonical);
  expect(new TextDecoder().decode(gunzipSync(gzip))).toBe(canonical);
  expect(sha(new TextEncoder().encode(canonical))).toBe(row.sourceSha256);
  expect(sha(new TextEncoder().encode(source('src/lib/places/'+row.catalogue)))).toBe(row.catalogueSha256);
  expect(sha(brotli)).toBe(row.compressedSha256);
  expect(sha(gzip)).toBe(row.gzipSha256);
  expect(entry.brotliJsonUrl).toContain(sha(brotli).slice(0,12));
  expect(entry.gzipJsonUrl).toContain(sha(gzip).slice(0,12));
  expect(brotli.length).toBe(row.brotliBytes);
  expect(gzip.length).toBe(row.gzipEquivalentBytes);
  expect(brotli.length).toBeLessThan(gzip.length*.85);
  expect(brotli.length).toBeLessThan(600000);
 });
 it.each([true,false])('loads the exact map through HTTP decoding, modern browser = %s',async modern=>{
  if(!modern)vi.stubGlobal('DecompressionStream',undefined);
  const catalogue=await loadVillageMapCatalogue(id),expected=JSON.parse(source('public'+catalogue.dataUrl));
  // fetch exposes the decoded body, retaining the HTTP encoding header.
  const fetcher=vi.fn(async()=>Response.json(expected,{headers:{'Content-Encoding':modern?'br':'gzip'}}));
  vi.stubGlobal('fetch',fetcher);const signal=new AbortController().signal;
  expect(isDeepStrictEqual(await loadVillageMapData(catalogue,signal),expected)).toBe(true);
  expect(fetcher).toHaveBeenCalledExactlyOnceWith(modern?entry.brotliJsonUrl:entry.gzipJsonUrl,{signal});
 });
});

it('does not alter regional or other village transport choices',async()=>{
 expect((await loadVillageMapCatalogue('bourgogne')).brotliJsonUrl).toBeUndefined();
 expect((await loadVillageMapCatalogue('gevrey-chambertin')).brotliJsonUrl).toBeUndefined();
});
it.each([503,200])('never falls back to a second download after a failed or invalid JSON response (%s)',async status=>{
 const fetcher=vi.fn(async()=>new Response('<html>missing asset</html>',{status}));vi.stubGlobal('fetch',fetcher);
 await expect(loadVillageMapData(await loadVillageMapCatalogue('chablis'),new AbortController().signal)).rejects.toThrow();
 expect(fetcher).toHaveBeenCalledTimes(1);
});
it('honours cancellation after HTTP-decoded JSON arrives',async()=>{
 const controller=new AbortController();
 vi.stubGlobal('fetch',vi.fn(async()=>{controller.abort();return Response.json({type:'FeatureCollection',features:[]})}));
 await expect(loadVillageMapData(await loadVillageMapCatalogue('chablis'),controller.signal)).rejects.toMatchObject({name:'AbortError'});
});
