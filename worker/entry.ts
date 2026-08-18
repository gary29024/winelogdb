import { Hono } from 'hono';
import baseApp from './index';
import layeredApp from './layered';
import { selectRecognitionMetadata, type RecognitionPhotoMetadata } from '../src/lib/uploads/metadataSelection';
import { applyJournalVintageSearch } from '../src/lib/journal/searchQuery';

type Bindings={DB:D1Database;WINE_IMAGES:R2Bucket;ASSETS:Fetcher;GEMINI_API_KEY:string;AUTH_SECRET:string;APP_PASSWORD:string;APP_URL:string;MAX_FILE_BYTES?:string;MAX_BATCH_FILES?:string};
type AppEnv={Bindings:Bindings};
const app=new Hono<AppEnv>();
const parseJson=<T>(value:unknown,fallback:T):T=>{try{return JSON.parse(String(value)) as T}catch{return fallback}};

app.post('/api/recognition',async c=>{
  let selected=selectRecognitionMetadata([]),forwardedRequest=c.req.raw;
  try{
    const form=await c.req.raw.clone().formData();
    const metadata=parseJson<RecognitionPhotoMetadata[]>(form.get('metadata'),[]);
    selected=selectRecognitionMetadata(metadata);
    if(metadata.length){
      const source=selected.gpsSource==='exif'?'exif':selected.timestampSource;
      const recognitionMetadata=metadata.map((item,index)=>index===0?{
        ...item,
        capturedAt:selected.capturedAt,
        latitude:selected.latitude,
        longitude:selected.longitude,
        source
      }:item);
      form.set('metadata',JSON.stringify(recognitionMetadata));
      const headers=new Headers(c.req.raw.headers);
      headers.delete('content-type');
      headers.delete('content-length');
      forwardedRequest=new Request(c.req.raw.url,{method:'POST',headers,body:form});
    }
  }catch{}

  const response=await baseApp.fetch(forwardedRequest,c.env,c.executionCtx);
  if(!response.ok)return response;
  try{
    const body=await response.clone().json() as Record<string,unknown>;
    const locationName=selected.gpsSource==='exif'&&typeof body.locationName==='string'&&body.locationName.trim()?body.locationName.trim():null;
    const payload={...body,locationName,tastingDate:selected.capturedAt?.slice(0,10)??null,latitude:selected.latitude,longitude:selected.longitude,metadataSource:selected.gpsSource==='exif'?'exif':selected.timestampSource};
    const headers=new Headers(response.headers);
    headers.set('Content-Type','application/json; charset=UTF-8');
    return new Response(JSON.stringify(payload),{status:response.status,headers});
  }catch{return response}
});

app.get('/api/wines',c=>{
  const url=new URL(c.req.raw.url);
  if(!applyJournalVintageSearch(url))return layeredApp.fetch(c.req.raw,c.env,c.executionCtx);
  const request=new Request(url.toString(),{method:'GET',headers:c.req.raw.headers});
  return layeredApp.fetch(request,c.env,c.executionCtx);
});

app.all('*',c=>layeredApp.fetch(c.req.raw,c.env,c.executionCtx));
export default app;
