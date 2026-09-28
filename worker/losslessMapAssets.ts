import registry from '../src/lib/places/burgundyLosslessMapRegistry.json';

const encodings=new Map(Object.values(registry).flatMap(m=>[[m.brotliJsonUrl,'br'] as const,[m.gzipJsonUrl,'gzip'] as const]));
const unavailable=(status:number)=>new Response(null,{status,headers:{'Cache-Control':'no-store'}});

/** Stream precompressed public maps without workerd compressing them again. */
export async function serveLosslessMap(request:Request,assets:Pick<Fetcher,'fetch'>):Promise<Response>{
 const encoding=encodings.get(new URL(request.url).pathname);
 if(!encoding)return unavailable(404);
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response(null,{status:405,headers:{Allow:'GET, HEAD','Cache-Control':'no-store'}});
 // Fetch raw binary asset bytes. Do not forward credentials or byte ranges;
 // partial compressed streams cannot be parsed as complete GeoJSON maps.
 const inputHeaders=new Headers({'Accept-Encoding':'identity'});
 for(const key of ['If-None-Match','If-Modified-Since']){
  const value=request.headers.get(key);if(value)inputHeaders.set(key,value);
 }
 const asset=await assets.fetch(new Request(request.url,{method:request.method,headers:inputHeaders}));
 if(![200,304].includes(asset.status)||asset.headers.get('Content-Type')?.includes('text/html')){
  await asset.body?.cancel();return unavailable(502);
 }
 const headers=new Headers(asset.headers);
 headers.set('Content-Type','application/geo+json; charset=utf-8');
 headers.set('Content-Encoding',encoding);
 headers.set('Cache-Control','public, max-age=31536000, immutable, no-transform');
 headers.set('X-Content-Type-Options','nosniff');
 headers.delete('Accept-Ranges');
 return new Response(asset.body,{status:asset.status,headers,encodeBody:'manual'});
}
