import { Hono } from 'hono';
import baseApp from './index';
import { requireSession } from '../src/lib/auth/session';
import { runLayeredDeepSearch } from '../src/lib/research/deepSearch';
import { linkWineProducer,mapProducerRow,normalizeProducerAlias,resolveExistingProducer,setProducerPrimaryName } from '../src/lib/producers/entities';
import { mergeProducerEntities,unlinkProducerMerge } from '../src/lib/producers/merge';
import { getProducerResearchRun,runProducerResearch } from '../src/lib/producers/research';
import { selectRecognitionMetadata,type RecognitionPhotoMetadata } from '../src/lib/uploads/metadataSelection';

type Bindings={DB:D1Database;WINE_IMAGES:R2Bucket;ASSETS:Fetcher;GEMINI_API_KEY:string;AUTH_SECRET:string;APP_PASSWORD:string;APP_URL:string;MAX_FILE_BYTES?:string;MAX_BATCH_FILES?:string};
type AppEnv={Bindings:Bindings};
const app=new Hono<AppEnv>();

async function user(c:{req:{header:(name:string)=>string|undefined};env:Bindings}){return (await requireSession(c.req.header('Authorization'),c.env.AUTH_SECRET)).userId}
const parseJson=<T>(value:unknown,fallback:T):T=>{try{return JSON.parse(String(value)) as T}catch{return fallback}};
async function linkSavedWine(db:D1Database,owner:string,wineId:string){
  const row=await db.prepare('SELECT producer FROM wines WHERE owner_id=? AND id=?').bind(owner,wineId).first<{producer:string}>();
  if(row?.producer?.trim())await linkWineProducer(db,owner,wineId,row.producer);
}

app.get('/api/producers',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  try{
    const rows=await c.env.DB.prepare(`SELECT p.id,p.canonical_name,p.home_country,p.home_region,p.home_locality,p.researched_at,
      (SELECT count(*) FROM wines w WHERE w.owner_id=p.owner_id AND w.producer_id=p.id) AS tasted_count,
      coalesce(json_array_length(p.catalog_json),0) AS catalog_count
      FROM producers p WHERE p.owner_id=? ORDER BY coalesce(p.home_country,'~'),coalesce(p.home_region,'~'),p.canonical_name COLLATE NOCASE`).bind(owner).all<Record<string,unknown>>();
    return c.json({items:rows.results.map(r=>({id:String(r.id),canonicalName:String(r.canonical_name),homeCountry:r.home_country?String(r.home_country):null,homeRegion:r.home_region?String(r.home_region):null,homeLocality:r.home_locality?String(r.home_locality):null,tastedCount:Number(r.tasted_count)||0,catalogCount:Number(r.catalog_count)||0,researchedAt:r.researched_at?String(r.researched_at):null}))});
  }catch(e){return c.json({error:(e as Error).message||'Could not load producers'},500)}
});

function cors(c:{req:{header:(name:string)=>string|undefined};env:Bindings;header:(name:string,value:string)=>void}){const origin=c.req.header('Origin');if(origin&&origin===c.env.APP_URL){c.header('Access-Control-Allow-Origin',origin);c.header('Vary','Origin')}}

app.get('/api/producers/resolve',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const name=(c.req.query('name')||'').trim();
  if(!name)return c.json({matched:false,inputName:''});
  try{
    const producer=await resolveExistingProducer(c.env.DB,owner,name);
    return producer?c.json({matched:true,inputName:name,producer}):c.json({matched:false,inputName:name});
  }catch(e){return c.json({error:(e as Error).message||'Could not resolve producer'},500)}
});

app.get('/api/producers/:id/research-status',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const requestId=(c.req.query('requestId')||'').trim();
  if(!requestId)return c.json({error:'requestId is required'},400);
  try{const run=await getProducerResearchRun(c.env.DB,owner,c.req.param('id'),requestId);return run?c.json(run):c.json({error:'Research run not found'},404)}catch(e){return c.json({error:(e as Error).message||'Could not load research status'},500)}
});

app.get('/api/producers/:id/hero-image',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const row=await c.env.DB.prepare('SELECT hero_image_object_key FROM producers WHERE owner_id=? AND id=?').bind(owner,c.req.param('id')).first<{hero_image_object_key:string|null}>();
  if(!row?.hero_image_object_key)return c.json({error:'Producer image not found'},404);
  const obj=await c.env.WINE_IMAGES.get(row.hero_image_object_key);if(!obj)return c.json({error:'Producer image not found'},404);
  return new Response(obj.body,{headers:{'Content-Type':obj.httpMetadata?.contentType||'application/octet-stream','Cache-Control':'private, max-age=3600','Content-Security-Policy':"default-src 'none'"}});
});

app.get('/api/producers/:id',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  try{
    const row=await c.env.DB.prepare('SELECT * FROM producers WHERE owner_id=? AND id=?').bind(owner,c.req.param('id')).first<Record<string,unknown>>();
    if(!row)return c.json({error:'Producer not found'},404);
    const [aliases,wines,history,links]=await Promise.all([
      c.env.DB.prepare('SELECT display_alias FROM producer_aliases WHERE owner_id=? AND producer_id=? ORDER BY display_alias COLLATE NOCASE').bind(owner,c.req.param('id')).all<{display_alias:string}>(),
      c.env.DB.prepare(`SELECT w.id,w.wine_name,w.vintage,w.appellation,w.region,w.country,w.wine_style,w.grapes_json,
        (SELECT wi.id FROM wine_images wi WHERE wi.owner_id=w.owner_id AND wi.wine_id=w.id ORDER BY wi.rowid ASC LIMIT 1) AS image_id,
        coalesce((SELECT we.consumed_at FROM wine_experiences we WHERE we.owner_id=w.owner_id AND we.wine_id=w.id ORDER BY we.created_at DESC LIMIT 1),w.tasting_date) AS tasting_date,
        coalesce((SELECT we.rating FROM wine_experiences we WHERE we.owner_id=w.owner_id AND we.wine_id=w.id ORDER BY we.created_at DESC LIMIT 1),w.rating) AS rating
        FROM wines w WHERE w.owner_id=? AND w.producer_id=? ORDER BY coalesce(tasting_date,w.created_at) DESC,w.vintage DESC`).bind(owner,c.req.param('id')).all<Record<string,unknown>>(),
      c.env.DB.prepare('SELECT count(*) AS count FROM producer_research_history WHERE owner_id=? AND producer_id=?').bind(owner,c.req.param('id')).first<{count:number}>(),
      c.env.DB.prepare(`SELECT id,source_producer_id,source_canonical_name,merged_at FROM producer_merges
        WHERE owner_id=? AND destination_producer_id=? AND undone_at IS NULL ORDER BY merged_at DESC`).bind(owner,c.req.param('id')).all<{id:string;source_producer_id:string;source_canonical_name:string;merged_at:string}>()
    ]);
    return c.json({...mapProducerRow(row),aliases:aliases.results.map(x=>x.display_alias),researchHistoryCount:Number(history?.count)||0,linkedProducers:links.results.map(x=>({mergeId:x.id,producerId:x.source_producer_id,name:x.source_canonical_name,mergedAt:x.merged_at})),tastedWines:wines.results.map(w=>({id:String(w.id),wineName:String(w.wine_name),vintage:w.vintage==null?null:Number(w.vintage),appellation:w.appellation?String(w.appellation):null,region:w.region?String(w.region):null,country:w.country?String(w.country):null,wineStyle:w.wine_style?String(w.wine_style):null,grapes:parseJson<unknown[]>(w.grapes_json,[]).map(String).filter(Boolean),imageId:w.image_id?String(w.image_id):null,tastingDate:w.tasting_date?String(w.tasting_date):null,rating:w.rating==null?null:Number(w.rating)}))});
  }catch(e){return c.json({error:(e as Error).message||'Could not load producer'},500)}
});

app.post('/api/producers/:id/primary-name',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const body=await c.req.json().catch(()=>({})) as {name?:string};
  if(!body.name?.trim())return c.json({error:'Choose an existing producer name'},400);
  try{return c.json(await setPrimaryProducerName(c.env.DB,owner,c.req.param('id'),body.name))}catch(e){const message=(e as Error).message||'Could not change primary name';return c.json({error:message},message.includes('existing')||message.includes('conflict')?400:500)}
});

app.post('/api/producers/:id/merge',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const body=await c.req.json().catch(()=>({})) as {confirmation?:string;sourceProducerId?:string};
  if(body.confirmation!=='MERGE_PRODUCER'||!body.sourceProducerId)return c.json({error:'Producer merge requires an existing producer selection and explicit confirmation'},400);
  try{return c.json(await mergeProducerEntities(c.env.DB,owner,c.req.param('id'),body.sourceProducerId))}catch(e){const message=(e as Error).message||'Could not link producer';return c.json({error:message},message==='Producer not found'?404:400)}
});

app.post('/api/producers/:id/unlink',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const body=await c.req.json().catch(()=>({})) as {confirmation?:string;mergeId?:string};
  if(body.confirmation!=='UNLINK_PRODUCER'||!body.mergeId)return c.json({error:'Producer unlink requires an existing linked producer and explicit confirmation'},400);
  const guard=await c.env.DB.prepare(`SELECT p.canonical_name,m.source_canonical_name,m.source_aliases_json FROM producer_merges m
    JOIN producers p ON p.owner_id=m.owner_id AND p.id=m.destination_producer_id
    WHERE m.owner_id=? AND m.id=? AND m.destination_producer_id=? AND m.undone_at IS NULL`).bind(owner,body.mergeId,c.req.param('id')).first<{canonical_name:string;source_canonical_name:string;source_aliases_json:string}>();
  if(guard){
    const primary=normalizeProducerAlias(guard.canonical_name),sourceNames=new Set<string>([normalizeProducerAlias(guard.source_canonical_name)]);
    try{for(const alias of JSON.parse(guard.source_aliases_json) as Array<{display_alias?:string}>){if(alias.display_alias)sourceNames.add(normalizeProducerAlias(alias.display_alias))}}catch{}
    if(sourceNames.has(primary))return c.json({error:'Choose a primary name that belongs to the canonical producer before unlinking this producer'},400);
  }
  try{return c.json(await unlinkProducerMerge(c.env.DB,owner,c.req.param('id'),body.mergeId))}catch(e){const message=(e as Error).message||'Could not unlink producer';return c.json({error:message},message.includes('not found')?404:400)}
});

app.post('/api/producers/:id/research',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const body=await c.req.json().catch(()=>({})) as {confirmation?:string;requestId?:string};
  try{const result=await runProducerResearch(c.env,owner,c.req.param('id'),body.confirmation,body.requestId);return c.json(result.body,result.status)}catch(e){console.error(JSON.stringify({event:'producer_research',stage:'route_failed',producerId:c.req.param('id'),requestId:body.requestId,error:(e as Error).message||String(e)}));return c.json({error:'Producer research failed unexpectedly',researchRequestId:body.requestId},500)}
});

app.post('/api/recognition',async c=>{
  cors(c);try{await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  let selected=selectRecognitionMetadata([]);
  try{
    const form=await c.req.raw.clone().formData();
    selected=selectRecognitionMetadata(parseJson<RecognitionPhotoMetadata[]>(form.get('metadata'),[]));
  }catch{}
  const response=await baseApp.fetch(c.req.raw,c.env,c.executionCtx);
  if(!response.ok)return response;
  try{
    const body=await response.clone().json() as Record<string,unknown>;
    return c.json({...body,locationName:null,tastingDate:selected.capturedAt?.slice(0,10)??null,latitude:selected.latitude,longitude:selected.longitude,metadataSource:selected.gpsSource==='exif'?'exif':selected.timestampSource});
  }catch{return response}
});

app.post('/api/wines/:id/deep-search',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const body=await c.req.json().catch(()=>({})) as {confirmation?:string;refresh?:'none'|'vintage'|'all'};
  try{const result=await runLayeredDeepSearch(c.env,owner,c.req.param('id'),body);return c.json(result.body,result.status)}catch{return c.json({error:'Deep Search failed unexpectedly'},500)}
});

app.post('/api/wines',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const response=await baseApp.fetch(c.req.raw,c.env,c.executionCtx);
  if(response.ok){
    try{const body=await response.clone().json() as {id?:string};if(body.id)await linkSavedWine(c.env.DB,owner,body.id)}catch{}
  }
  return response;
});

app.put('/api/wines/:id',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const response=await baseApp.fetch(c.req.raw,c.env,c.executionCtx);
  if(response.ok){try{await linkSavedWine(c.env.DB,owner,c.req.param('id'))}catch{}}
  return response;
});

app.all('*',c=>baseApp.fetch(c.req.raw,c.env,c.executionCtx));
export default app;
