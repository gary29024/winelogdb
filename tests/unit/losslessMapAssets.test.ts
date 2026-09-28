import {describe,expect,it,vi} from 'vitest';
import {serveLosslessMap} from '../../worker/losslessMapAssets';
import registry from '../../src/lib/places/burgundyLosslessMapRegistry.json';

const url='https://example.com'+registry.chablis.brotliJsonUrl;
describe('lossless public map delivery',()=>{
 it('streams the asset, strips credentials and ranges, and retains conditional caching',async()=>{
  const bytes=new Uint8Array([1,2,3]),fetcher=vi.fn<Fetcher['fetch']>(async()=>new Response(bytes,{headers:{ETag:'"map-hash"','Content-Type':'application/octet-stream','Accept-Ranges':'bytes'}}));
  const response=await serveLosslessMap(new Request(url,{headers:{Cookie:'private',Authorization:'Bearer private',Range:'bytes=0-1','If-None-Match':'"older-hash"'}}),{fetch:fetcher});
  const forwarded=fetcher.mock.calls[0][0] as Request;
  expect(Object.fromEntries(forwarded.headers)).toEqual({'accept-encoding':'identity','if-none-match':'"older-hash"'});
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  expect(response.headers.get('content-encoding')).toBe('br');
  expect(response.headers.get('cache-control')).toContain('immutable');
  expect(response.headers.get('etag')).toBe('"map-hash"');
  expect(response.headers.has('accept-ranges')).toBe(false);
 });
 it.each([404,200])('does not label missing asset/SPA bodies as compressed JSON (%s)',async status=>{
  const fetcher=vi.fn<Fetcher['fetch']>(async()=>new Response('<html>fallback</html>',{status,headers:{'Content-Type':'text/html'}}));
  const response=await serveLosslessMap(new Request(url),{fetch:fetcher});
  expect(response.status).toBe(502);expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.has('content-encoding')).toBe(false);expect(await response.text()).toBe('');
 });
 it('rejects unregistered paths and writes before consulting assets',async()=>{
  const fetcher=vi.fn<Fetcher['fetch']>();
  expect((await serveLosslessMap(new Request(url+'-unknown'),{fetch:fetcher})).status).toBe(404);
  expect((await serveLosslessMap(new Request(url,{method:'POST'}),{fetch:fetcher})).status).toBe(405);
  expect(fetcher).not.toHaveBeenCalled();
 });
 it('preserves a bodyless conditional 304',async()=>{
  const fetcher=vi.fn<Fetcher['fetch']>(async()=>new Response(null,{status:304,headers:{ETag:'"map-hash"'}}));
  const response=await serveLosslessMap(new Request(url),{fetch:fetcher});
  expect(response.status).toBe(304);expect(response.body).toBeNull();expect(response.headers.get('etag')).toBe('"map-hash"');
 });
});
