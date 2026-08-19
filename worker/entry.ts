import { Hono } from 'hono';
import baseApp from './index';
import layeredApp from './layered';
import { applyJournalVintageSearch } from '../src/lib/journal/searchQuery';
import { favoriteUpdateSchema } from '../src/lib/journal/favorite';
import { requireSession } from '../src/lib/auth/session';
import { handleRecognitionRequest } from './recognitionHandler';

type Bindings={DB:D1Database;WINE_IMAGES:R2Bucket;ASSETS:Fetcher;GEMINI_API_KEY:string;AUTH_SECRET:string;APP_PASSWORD:string;APP_URL:string;MAX_FILE_BYTES?:string;MAX_BATCH_FILES?:string};
type AppEnv={Bindings:Bindings};
const app=new Hono<AppEnv>();

async function user(c:{req:{header:(name:string)=>string|undefined};env:Bindings}){return (await requireSession(c.req.header('Authorization'),c.env.AUTH_SECRET)).userId}

app.post('/api/recognition',c=>handleRecognitionRequest(c.req.raw,c.env));

app.get('/api/wines',c=>{
  const url=new URL(c.req.raw.url);
  if(!applyJournalVintageSearch(url))return layeredApp.fetch(c.req.raw,c.env,c.executionCtx);
  const request=new Request(url.toString(),{method:'GET',headers:c.req.raw.headers});
  return layeredApp.fetch(request,c.env,c.executionCtx);
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

app.get('/api/wines/:id',async c=>{
  const response=await layeredApp.fetch(c.req.raw,c.env,c.executionCtx);
  if(!response.ok)return response;
  let owner:string;try{owner=await user(c)}catch{return response}
  const meta=await c.env.DB.prepare('SELECT producer_id,favorite FROM wines WHERE owner_id=? AND id=?').bind(owner,c.req.param('id')).first<{producer_id:string|null;favorite:number|null}>();
  if(!meta)return response;
  try{
    const body=await response.json() as Record<string,unknown>;
    const headers=new Headers(response.headers);headers.set('Content-Type','application/json; charset=utf-8');
    return new Response(JSON.stringify({...body,producerId:meta.producer_id??null,favorite:Boolean(meta.favorite)}),{status:response.status,statusText:response.statusText,headers});
  }catch{return response}
});

app.all('*',c=>layeredApp.fetch(c.req.raw,c.env,c.executionCtx));
export default app;
