import { decode } from 'geobuf';
import Pbf from 'pbf';
import type { VillageMapCatalogue } from './burgundyVillageMap';

/** Loaded with the map dialog. Compact transport never simplifies a boundary. */
export async function loadVillageMapData(catalogue:Pick<VillageMapCatalogue,'dataUrl'|'geobufUrl'>,signal:AbortSignal):Promise<unknown>{
 const compact=Boolean(catalogue.geobufUrl)&&typeof DecompressionStream==='function';
 // Old browsers retain the original GeoJSON path. Network/decode failures use
 // the dialog's retry, never a second, larger download on a slow connection.
 const response=await fetch(compact?catalogue.geobufUrl!:catalogue.dataUrl,{signal});
 if(!response.ok)throw new Error('Boundary download failed');
 if(!compact)return response.json();
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
