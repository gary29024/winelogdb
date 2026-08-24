import { Hono } from 'hono';
import baseApp from './index';
import layeredApp from './layered';
import { applyJournalVintageSearch } from '../src/lib/journal/searchQuery';
import { favoriteUpdateSchema } from '../src/lib/journal/favorite';
import { requireSession } from '../src/lib/auth/session';
import { handleRecognitionRequest } from './recognitionHandler';
import { ACHIEVEMENT_DEFINITION_VERSION,createCustomAchievementCollection,deleteCustomAchievementCollection,loadAchievementCatalogueOptions,loadAchievementProgress,setAchievementMatchMode,updateCustomAchievementCollection } from './achievementHandler';
import { JOURNEY_PAYLOAD_VERSION,loadJourneySummary } from './journeyHandler';
import { etagMatches,revisionETag } from '../src/lib/db/ownerRevision';

type Bindings={DB:D1Database;WINE_IMAGES:R2Bucket;ASSETS:Fetcher;GEMINI_API_KEY:string;AUTH_SECRET:string;APP_PASSWORD:string;APP_URL:string;MAX_FILE_BYTES?:string;MAX_BATCH_FILES?:string};
type AppEnv={Bindings:Bindings};
const app=new Hono<AppEnv>();

async function user(c:{req:{header:(name:string)=>string|undefined};env:Bindings}){return (await requireSession(c.req.header('Authorization'),c.env.AUTH_SECRET)).userId}

app.post('/api/recognition',c=>handleRecognitionRequest(c.req.raw,c.env));

// Private, owner-scoped payloads: the browser may reuse them, shared caches may not.
// The ETag carries the owner revision, so an unchanged journal revalidates for the
// cost of one indexed lookup instead of a full recompute or a repeated response body.
function privateRevalidated(c:{header:(name:string,value:string)=>void},etag:string|null){
  c.header('Cache-Control','private, max-age=0, must-revalidate');
  if(etag)c.header('ETag',etag);
}

app.get('/api/wines',c=>{
  const url=new URL(c.req.raw.url);
  if(!applyJournalVintageSearch(url))return layeredApp.fetch(c.req.raw,c.env,c.executionCtx);
  const request=new Request(url.toString(),{method:'GET',headers:c.req.raw.headers});
  return layeredApp.fetch(request,c.env,c.executionCtx);
});

app.get('/api/achievements/catalogue-options',async c=>{
  let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  try{return c.json(await loadAchievementCatalogueOptions(c.env.DB,owner))}
  catch(error){console.error('Could not load achievement catalogue options',error);return c.json({error:'Could not load catalogue targets'},500)}
});
app.post('/api/achievements/custom',async c=>{
  let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  try{
    const result=await createCustomAchievementCollection(c.env.DB,owner,await c.req.json().catch(()=>null));
    if(!result.ok)return c.json({error:result.error,issues:result.issues},400);
    return c.json({id:result.id},201);
  }catch(error){console.error('Could not create achievement collection',error);return c.json({error:'Could not create collection'},500)}
});
app.put('/api/achievements/custom/:id',async c=>{
  let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  try{
    const result=await updateCustomAchievementCollection(c.env.DB,owner,c.req.param('id'),await c.req.json().catch(()=>null));
    if(!result.ok)return c.json({error:result.error,issues:result.issues},'notFound' in result&&result.notFound?404:400);
    return c.json({id:result.id});
  }catch(error){console.error('Could not update achievement collection',error);return c.json({error:'Could not update collection'},500)}
});
app.delete('/api/achievements/custom/:id',async c=>{
  let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const body=await c.req.json().catch(()=>null) as {confirmation?:string}|null;if(body?.confirmation!=='DELETE_COLLECTION')return c.json({error:'Deletion confirmation is required'},400);
  try{const result=await deleteCustomAchievementCollection(c.env.DB,owner,c.req.param('id'));return result.deleted?c.json({deleted:true}):c.json({error:'Collection not found'},404)}
  catch(error){console.error('Could not delete achievement collection',error);return c.json({error:'Could not delete collection'},500)}
});
app.put('/api/achievements/:id/match-mode',async c=>{
  let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  try{
    const result=await setAchievementMatchMode(c.env.DB,owner,c.req.param('id'),await c.req.json().catch(()=>null));
    if(!result.ok)return c.json({error:result.error},'notFound' in result&&result.notFound?404:400);
    return c.json({matchMode:result.matchMode});
  }catch(error){console.error('Could not update achievement match mode',error);return c.json({error:'Could not update collection matching'},500)}
});
app.get('/api/achievements',async c=>{
  let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  try{
    const {revision,progress}=await loadAchievementProgress(c.env.DB,owner);
    const etag=revision===null?null:revisionETag('achievements',ACHIEVEMENT_DEFINITION_VERSION,revision);
    if(etag&&etagMatches(c.req.header('If-None-Match'),etag)){privateRevalidated(c,etag);return c.body(null,304)}
    privateRevalidated(c,etag);
    return c.json(progress);
  }catch(error){console.error('Could not load achievements',error);return c.json({error:'Could not load wine collections'},500)}
});

app.get('/api/journey',async c=>{
  let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  try{
    const {revision,payload}=await loadJourneySummary(c.env.DB,owner);
    const etag=revision===null?null:revisionETag('journey',JOURNEY_PAYLOAD_VERSION,revision);
    if(etag&&etagMatches(c.req.header('If-None-Match'),etag)){privateRevalidated(c,etag);return c.body(null,304)}
    privateRevalidated(c,etag);
    return c.json(payload);
  }catch(error){console.error('Could not load Wine Journey',error);return c.json({error:'Could not load Wine Journey'},500)}
});

app.put('/api/wines/:id/favorite',async c=>{
  let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const parsed=favoriteUpdateSchema.safeParse(await c.req.json().catch(()=>null));
  if(!parsed.success)return c.json({error:'Favorite must be true or false',issues:parsed.error.issues},400);
  const id=c.req.param('id'),exists=await c.env.DB.prepare('SELECT id FROM wines WHERE owner_id=? AND id=?').bind(owner,id).first<{id:string}>();
  if(!exists)return c.json({error:'Wine not found'},404);
  const stamp=new Date().toISOString();
  await c.env.DB.prepare('UPDATE wines SET favorite=?,updated_at=? WHERE owner_id=? AND id=?').bind(parsed.data.favorite?1:0,stamp,owner,id).run();
  return c.json({id,favorite:parsed.data.favorite});
});

// The wine row already carries producer_id and favorite, and the base handler now
// maps both. Only fall back to a second read for a body that predates that mapping,
// so the common detail view costs one wines lookup instead of two.
app.get('/api/wines/:id',async c=>{
  const response=await layeredApp.fetch(c.req.raw,c.env,c.executionCtx);
  if(!response.ok)return response;
  let body:Record<string,unknown>;
  try{body=await response.clone().json() as Record<string,unknown>}catch{return response}
  if('producerId' in body&&'favorite' in body)return response;
  let owner:string;try{owner=await user(c)}catch{return response}
  const meta=await c.env.DB.prepare('SELECT producer_id,favorite FROM wines WHERE owner_id=? AND id=?').bind(owner,c.req.param('id')).first<{producer_id:string|null;favorite:number|null}>();
  if(!meta)return response;
  const headers=new Headers(response.headers);headers.set('Content-Type','application/json; charset=utf-8');headers.delete('Content-Length');
  return new Response(JSON.stringify({...body,producerId:meta.producer_id??null,favorite:Boolean(meta.favorite)}),{status:response.status,statusText:response.statusText,headers});
});

app.all('*',c=>layeredApp.fetch(c.req.raw,c.env,c.executionCtx));
export default app;
