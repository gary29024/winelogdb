import { Hono } from 'hono';
import entryApp from './entry';
import { requireSession } from '../src/lib/auth/session';
import { ensureAllProducerLinks,linkWineProducer } from '../src/lib/producers/entities';
import { cleanupOrphanCuvee,ensureAllCuveeLinksForProducer,ensureMissingCuveeLinks,linkWineCuvee,reconcileProducerCuvees,resolveExistingCuvee } from '../src/lib/cuvees/entities';
import { ensureProducerCatalogCuveesSeeded } from '../src/lib/cuvees/catalogSeed';

type Bindings={DB:D1Database;WINE_IMAGES:R2Bucket;ASSETS:Fetcher;GEMINI_API_KEY:string;AUTH_SECRET:string;APP_PASSWORD:string;APP_URL:string;MAX_FILE_BYTES?:string;MAX_BATCH_FILES?:string};
type AppEnv={Bindings:Bindings};
const app=new Hono<AppEnv>();

function cors(c:{req:{header:(name:string)=>string|undefined};env:Bindings;header:(name:string,value:string)=>void}){const origin=c.req.header('Origin');if(origin&&origin===c.env.APP_URL){c.header('Access-Control-Allow-Origin',origin);c.header('Vary','Origin')}}
async function user(c:{req:{header:(name:string)=>string|undefined};env:Bindings}){return (await requireSession(c.req.header('Authorization'),c.env.AUTH_SECRET)).userId}

async function ensureWineIdentity(db:D1Database,owner:string,wineId:string){
  const wine=await db.prepare('SELECT producer,producer_id FROM wines WHERE owner_id=? AND id=?').bind(owner,wineId).first<{producer:string;producer_id:string|null}>();
  if(!wine)return;
  if(!wine.producer_id&&wine.producer?.trim())await linkWineProducer(db,owner,wineId,wine.producer);
  await linkWineCuvee(db,owner,wineId);
}

app.get('/api/cuvees/resolve',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const producerId=(c.req.query('producerId')||'').trim(),name=(c.req.query('name')||'').trim();
  const appellation=(c.req.query('appellation')||'').trim()||null,style=(c.req.query('style')||'').trim()||null;
  if(!producerId||!name)return c.json({matched:false,inputName:name});
  try{
    await ensureProducerCatalogCuveesSeeded(c.env.DB,owner,producerId);
    await reconcileProducerCuvees(c.env.DB,owner,producerId);
    const cuvee=await resolveExistingCuvee(c.env.DB,owner,producerId,name,appellation,style);
    return cuvee?c.json({matched:true,inputName:name,cuvee}):c.json({matched:false,inputName:name});
  }catch(e){return c.json({error:(e as Error).message||'Could not resolve cuvee'},500)}
});

app.get('/api/wines',async c=>{
  let owner:string;try{owner=await user(c)}catch{return entryApp.fetch(c.req.raw,c.env,c.executionCtx)}
  try{await ensureAllProducerLinks(c.env.DB,owner);await ensureMissingCuveeLinks(c.env.DB,owner)}catch{}
  return entryApp.fetch(c.req.raw,c.env,c.executionCtx);
});

app.get('/api/wines/:id',async c=>{
  let owner:string;try{owner=await user(c)}catch{return entryApp.fetch(c.req.raw,c.env,c.executionCtx)}
  try{await ensureWineIdentity(c.env.DB,owner,c.req.param('id'))}catch{}
  return entryApp.fetch(c.req.raw,c.env,c.executionCtx);
});

// Keep the existing producer resolver out of the dynamic producer-detail hook below.
app.get('/api/producers/resolve',c=>entryApp.fetch(c.req.raw,c.env,c.executionCtx));

app.get('/api/producers/:id',async c=>{
  let owner:string;try{owner=await user(c)}catch{return entryApp.fetch(c.req.raw,c.env,c.executionCtx)}
  try{await ensureAllProducerLinks(c.env.DB,owner);await ensureAllCuveeLinksForProducer(c.env.DB,owner,c.req.param('id'))}catch{}
  return entryApp.fetch(c.req.raw,c.env,c.executionCtx);
});

app.post('/api/producers/:id/research',async c=>{
  const response=await entryApp.fetch(c.req.raw,c.env,c.executionCtx);
  if(response.ok){
    try{const owner=await user(c);await ensureAllCuveeLinksForProducer(c.env.DB,owner,c.req.param('id'))}catch{}
  }
  return response;
});

app.post('/api/producers/:id/merge',async c=>{
  const response=await entryApp.fetch(c.req.raw,c.env,c.executionCtx);
  if(response.ok){try{const owner=await user(c);await ensureAllCuveeLinksForProducer(c.env.DB,owner,c.req.param('id'))}catch{}}
  return response;
});

app.post('/api/producers/:id/unlink',async c=>{
  const response=await entryApp.fetch(c.req.raw,c.env,c.executionCtx);
  if(response.ok){
    try{
      const owner=await user(c),body=await response.clone().json() as {restoredProducerId?:string};
      await ensureAllCuveeLinksForProducer(c.env.DB,owner,c.req.param('id'));
      if(body.restoredProducerId)await ensureAllCuveeLinksForProducer(c.env.DB,owner,body.restoredProducerId);
    }catch{}
  }
  return response;
});

app.post('/api/wines/:id/deep-search',async c=>{
  try{const owner=await user(c);await ensureWineIdentity(c.env.DB,owner,c.req.param('id'))}catch{}
  return entryApp.fetch(c.req.raw,c.env,c.executionCtx);
});

app.post('/api/wines',async c=>{
  let owner:string;try{owner=await user(c)}catch{return entryApp.fetch(c.req.raw,c.env,c.executionCtx)}
  const response=await entryApp.fetch(c.req.raw,c.env,c.executionCtx);
  if(response.ok){try{const body=await response.clone().json() as {id?:string};if(body.id)await ensureWineIdentity(c.env.DB,owner,body.id)}catch{}}
  return response;
});

app.put('/api/wines/:id',async c=>{
  let owner:string;try{owner=await user(c)}catch{return entryApp.fetch(c.req.raw,c.env,c.executionCtx)}
  const id=c.req.param('id'),before=await c.env.DB.prepare('SELECT wine_name FROM wines WHERE owner_id=? AND id=?').bind(owner,id).first<{wine_name:string}>().catch(()=>null);
  let requestedName:string|null=null;
  try{const body=await c.req.raw.clone().json() as {wineName?:unknown};if(typeof body.wineName==='string'&&body.wineName.trim())requestedName=body.wineName.trim()}catch{}
  const response=await entryApp.fetch(c.req.raw,c.env,c.executionCtx);
  if(response.ok){
    try{
      if(requestedName&&before?.wine_name!==requestedName){await c.env.DB.prepare('UPDATE wines SET recognized_wine_name=?,cuvee_id=NULL WHERE owner_id=? AND id=?').bind(requestedName,owner,id).run()}
      await ensureWineIdentity(c.env.DB,owner,id);
    }catch{}
  }
  return response;
});

app.delete('/api/wines/:id',async c=>{
  let owner:string;try{owner=await user(c)}catch{return entryApp.fetch(c.req.raw,c.env,c.executionCtx)}
  const id=c.req.param('id');
  const before=await c.env.DB.prepare('SELECT cuvee_id,producer_id FROM wines WHERE owner_id=? AND id=?').bind(owner,id).first<{cuvee_id:string|null;producer_id:string|null}>().catch(()=>null);
  const response=await entryApp.fetch(c.req.raw,c.env,c.executionCtx);
  if(response.ok&&before){
    try{
      await cleanupOrphanCuvee(c.env.DB,owner,before.cuvee_id);
      if(before.producer_id)await reconcileProducerCuvees(c.env.DB,owner,before.producer_id);
    }catch(e){console.error(JSON.stringify({event:'cuvee-delete-cleanup-failed',wineId:id,cuveeId:before.cuvee_id,error:(e as Error).message}))}
  }
  return response;
});

app.all('*',c=>entryApp.fetch(c.req.raw,c.env,c.executionCtx));
export default app;
