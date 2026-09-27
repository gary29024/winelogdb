import { decode } from 'geobuf';
import Pbf from 'pbf';
import type { VillageMapCatalogue } from './burgundyVillageMap';

/** Loaded with the map dialog. Compact transport never simplifies a boundary. */
export async function loadVillageMapData(catalogue:Pick<VillageMapCatalogue,'dataUrl'|'geobufUrl'|'geobufRawUrl'>,signal:AbortSignal):Promise<unknown>{
 const compactUrl=typeof DecompressionStream==='function'?catalogue.geobufUrl??catalogue.geobufRawUrl:catalogue.geobufRawUrl;
 // Older browsers use an uncompressed compact copy when the GeoJSON exceeds
 // the hosting asset limit; other maps retain their original GeoJSON path.
 // Network/decode failures use the dialog's retry, never a second, larger
 // download on a slow connection.
 const response=await fetch(compactUrl??catalogue.dataUrl,{signal});
 if(!response.ok)throw new Error('Boundary download failed');
 if(!compactUrl)return response.json();
 let bytes=new Uint8Array(await response.arrayBuffer());
 // Static .gz assets normally arrive intact. If a host supplies Content-Encoding,
 // fetch may already have decompressed them; inspect bytes to avoid doing it twice.
 if(bytes[0]===0x1f&&bytes[1]===0x8b){
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  bytes=new Uint8Array(await new Response(stream).arrayBuffer());
 }
 signal.throwIfAborted();
 return decode(new Pbf(bytes));
}
