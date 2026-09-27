import {describe,it,expect,vi,afterEach} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {decode} from 'geobuf';
import Pbf from 'pbf';
import overviews from '../../src/lib/places/burgundyRegionalOverviewRegistry.json';
import registry from '../../src/lib/places/burgundyRegionalMapRegistry.json';
import report from '../../scripts/burgundy-regional-overview-report.json';
import {loadVillageMapCatalogue} from '../../src/lib/places/loadVillageMapCatalogue';
import {loadVillageMapData} from '../../src/lib/places/loadVillageMapData';

afterEach(()=>vi.unstubAllGlobals());
const bytes=(url:string)=>readFileSync(`public${url}`);
const digest=(value:Buffer)=>createHash('sha256').update(value).digest('hex');

describe('display-only regional overviews',()=>{
 it('covers the complete regional inventory and leaves village maps detailed',async()=>{
  expect(Object.keys(overviews).sort()).toEqual(registry.maps.map(m=>m.id).sort());
  expect(report).toHaveLength(49);
  expect((await loadVillageMapCatalogue('chablis')).overview).toBeUndefined();
 });
 it.each(Object.entries(overviews))('%s retains identity, scope, provenance and a bounded lightweight download',async(id,overview)=>{
  const catalogue=await loadVillageMapCatalogue(id);
  const measurement=report.find(m=>m.id===id)!;
  expect(catalogue.overview).toEqual(overview);
  expect(digest(bytes(catalogue.dataUrl))).toBe(measurement.sourceSha256);
  expect(digest(readFileSync(`src/lib/places/${id}MapCatalogue.json`))).toBe(measurement.catalogueSha256);
  const raw=bytes(overview.geobufRawUrl),packed=bytes(overview.geobufUrl);
  expect(digest(raw)).toBe(measurement.overviewSha256);
  expect(digest(raw)).toBe(digest(gunzipSync(packed)));
  expect(packed.length).toBe(measurement.overviewGzipBytes);
  expect(packed.length).toBeLessThan(800000);
  expect(raw.length).toBeLessThan(1000000);
  // Match the browser's owned Uint8Array; small Node Buffers share a slab and
  // Pbf's DataView reader does not account for that slab's byte offset.
  const data=decode(new Pbf(Uint8Array.from(raw))) as GeoJSON.FeatureCollection;
  expect(data.features.map(f=>f.id)).toEqual(catalogue.features.map(f=>f.id));
  for(const [i,feature] of data.features.entries()){
   const source=catalogue.features[i];
   expect(feature.properties).toMatchObject({id:source.id,name:source.name,kind:'appellation',tier:'regional',areaHa:source.areaHa,communes:source.communes});
   expect(feature.properties?.coverage).toBe(source.coverage);
   expect(feature.properties?.sectorColour).toBe(source.sectorColour);
   expect(['Polygon','MultiPolygon']).toContain(feature.geometry.type);
  }
  expect(overview.labelIds.length).toBeLessThanOrEqual(8);
  expect(new Set(overview.labelIds).size).toBe(overview.labelIds.length);
  expect(overview.labelIds.every(id=>catalogue.communes.some(c=>c.id===id))).toBe(true);
  expect(overview.maxZoom).toBeLessThanOrEqual(14);
  expect(overview.downloadTimeoutMs).toBe(20000);
  expect(measurement.features.every(f=>f.areaChangePercent<5&&f.differencePercent<12)).toBe(true);
 });
 it.each([true,false])('loads only the overview with native gzip support = %s',async(native)=>{
  if(!native)vi.stubGlobal('DecompressionStream',undefined);
  const catalogue=await loadVillageMapCatalogue('cremant-de-bourgogne');
  const overview=catalogue.overview!;
  const url=native?overview.geobufUrl:overview.geobufRawUrl;
  const fetcher=vi.fn(async()=>new Response(Uint8Array.from(bytes(url))));vi.stubGlobal('fetch',fetcher);
  const signal=new AbortController().signal;
  const data=await loadVillageMapData(overview,signal) as GeoJSON.FeatureCollection;
  expect(data.features).toHaveLength(1);
  expect(fetcher).toHaveBeenCalledExactlyOnceWith(url,{signal});
 });
});
