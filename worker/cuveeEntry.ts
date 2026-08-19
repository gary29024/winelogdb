import { Hono,type Context } from 'hono';
import entryApp from './entry';
import { requireSession } from '../src/lib/auth/session';
import { ensureAllProducerLinks,linkWineProducer,seedProducerCountryFromWine } from '../src/lib/producers/entities';
import { cleanupOrphanCuvee,ensureAllCuveeLinksForProducer,ensureMissingCuveeLinks,linkWineCuvee,reconcileProducerCuvees,resolveExistingCuvee } from '../src/lib/cuvees/entities';
import { ensureProducerCatalogCuveesSeeded } from '../src/lib/cuvees/catalogSeed';
import { changeCuveeCatalogLink,changeCuveeCatalogLinkSchema,createCuveeCatalogLink,createCuveeCatalogLinkSchema,getProducerCuveeCatalogState,unlinkCuveeCatalogLink,unlinkCuveeCatalogLinkSchema } from '../src/lib/cuvees/catalogLinks';
import { listJournalPage } from '../src/lib/journal/list';
import { applyBatchExperienceUpdate,batchExperienceSchema } from '../src/lib/journal/batchExperience';

type Bindings={DB:D1Database;WINE_IMAGES:R2Bucket;ASSETS:Fetcher;GEMINI_API_KEY:string;AUTH_SECRET:string;APP_PASSWORD:string;APP_URL:string;MAX_FILE_BYTES?:string;MAX_BATCH_FILES?:string};
type AppEnv={Bindings:Bindings};
const app=new Hono<AppEnv>();
const IDENTITY_MAINTENANCE_KEY='identity-reconcile-v2';
const MAINTENANCE_INTERVAL_MS=24*60*60*1000;
const MAINTENANCE_LOCAL_CHECK_MS=60*60*1000;
const maintenanceMemo=new Map<string,number>();

function cors(c:{req:{header:(name:string)=>string|undefined};env:Bindings;header:(name:string,value:string)=>void}){const origin=c.req.header('Origin');if(origin&&origin===c.env.APP_URL){c.header('Access-Control-Allow-Origin',origin);c.header('Vary','Origin')}}
async function user(c:{req:{header:(name:string)=>string|undefined};env:Bindings}){return (await requireSession(c.req.header('Authorization'),c.env.AUTH_SECRET)).userId}

async function ensureWineIdentity(db:D1Database,owner:string,wineId:string){
  const wine=await db.prepare('SELECT producer,producer_id,country FROM wines WHERE owner_id=? AND id=?').bind(owner,wineId).first<{producer:string;producer_id:string|null;country:string|null}>();
  if(!wine)return;
  let producerId=wine.producer_id;
  if(!producerId&&wine.producer?.trim())producerId=(await linkWineProducer(db,owner,wineId,wine.producer,wine.country)).id;
  else if(producerId)await seedProducerCountryFromWine(db,owner,producerId,wine.country);
  await linkWineCuvee(db,owner,wineId);
}

async function maybeScheduleIdentityMaintenance(c:Context<AppEnv>,owner:string){
  const now=Date.now(),lastLocal=maintenanceMemo.get(owner)??0;
  if(now-lastLocal<MAINTENANCE_LOCAL_CHECK_MS)return;
  maintenanceMemo.set(owner,now);
  const state=await c.env.DB.prepare('SELECT last_run_at FROM maintenance_state WHERE owner_id=? AND maintenance_key=?').bind(owner,IDENTITY_MAINTENANCE_KEY).first<{last_run_at:string}>();
  const lastRun=Date.parse(state?.last_run_at??'');
  if(Number.isFinite(lastRun)&&now-lastRun<MAINTENANCE_INTERVAL_MS)return;
  const nowIso=new Date(now).toISOString(),cutoffIso=new Date(now-MAINTENANCE_INTERVAL_MS).toISOString();
  const claim=await c.env.DB.prepare(`INSERT INTO maintenance_state(owner_id,maintenance_key,last_run_at) VALUES(?,?,?)
    ON CONFLICT(owner_id,maintenance_key) DO UPDATE SET last_run_at=excluded.last_run_at
    WHERE maintenance_state.last_run_at<?`).bind(owner,IDENTITY_MAINTENANCE_KEY,nowIso,cutoffIso).run();
  if(!claim.meta.changes)return;
  c.executionCtx.waitUntil((async()=>{
    try{
      await ensureAllProducerLinks(c.env.DB,owner);
      await ensureMissingCuveeLinks(c.env.DB,owner);
      console.log(JSON.stringify({event:'identity-maintenance-complete',owner,key:IDENTITY_MAINTENANCE_KEY}));
    }catch(e){
      console.error(JSON.stringify({event:'identity-maintenance-failed',owner,key:IDENTITY_MAINTENANCE_KEY,error:(e as Error).message}));
      await c.env.DB.prepare('DELETE FROM maintenance_state WHERE owner_id=? AND maintenance_key=?').bind(owner,IDENTITY_MAINTENANCE_KEY).run().catch(()=>{});
    }
  })());
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

app.get('/api/images/:id',async c=>{
  const response=await entryApp.fetch(c.req.raw,c.env,c.executionCtx);
  if(!response.ok)return response;
  const headers=new Headers(response.headers);
  headers.set('Cache-Control','private, max-age=86400, immutable');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
});

app.get('/api/journal',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  if(Number(c.req.query('offset')||0)===0){try{await maybeScheduleIdentityMaintenance(c,owner)}catch(e){console.error(JSON.stringify({event:'identity-maintenance-schedule-failed',error:(e as Error).message}))}}
  try{return c.json(await listJournalPage(c.env.DB,owner,c.req.query()))}catch(e){console.error(JSON.stringify({event:'journal-list-failed',error:(e as Error).message}));return c.json({error:'Could not load Journal'},500)}
});

app.post('/api/journal/batch-experience',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const parsed=batchExperienceSchema.safeParse(await c.req.json().catch(()=>null));
  if(!parsed.success)return c.json({error:'Invalid batch update',issues:parsed.error.issues},400);
  try{return c.json(await applyBatchExperienceUpdate(c.env.DB,owner,parsed.data))}
  catch(e){const message=(e as Error).message||'Could not update selected wines';return c.json({error:message},message.includes('no longer exist')?404:500)}
});

app.get('/api/wines',async c=>{
  let owner:string;try{owner=await user(c)}catch{return entryApp.fetch(c.req.raw,c.env,c.executionCtx)}
  if(Number(c.req.query('offset')||0)===0){try{await maybeScheduleIdentityMaintenance(c,owner)}catch(e){console.error(JSON.stringify({event:'identity-maintenance-schedule-failed',error:(e as Error).message}))}}
  return entryApp.fetch(c.req.raw,c.env,c.executionCtx);
});

app.get('/api/wines/:id',async c=>{
  let owner:string;try{owner=await user(c)}catch{return entryApp.fetch(c.req.raw,c.env,c.executionCtx)}
  try{await ensureWineIdentity(c.env.DB,owner,c.req.param('id'))}catch{}
  return entryApp.fetch(c.req.raw,c.env,c.executionCtx);
});

// Keep the existing producer resolver out of the dynamic producer-detail hook below.
app.get('/api/producers/resolve',c=>entryApp.fetch(c.req.raw,c.env,c.executionCtx));

app.post('/api/producers/:id/cuvee-links',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const parsed=createCuveeCatalogLinkSchema.safeParse(await c.req.json().catch(()=>null));
  if(!parsed.success)return c.json({error:'Invalid cuvée catalog link',issues:parsed.error.issues},400);
  try{return c.json(await createCuveeCatalogLink(c.env.DB,owner,c.req.param('id'),parsed.data.sourceCuveeId,parsed.data.catalogCuveeId),201)}
  catch(e){const message=(e as Error).message||'Could not link cuvée to catalog';return c.json({error:message},message.includes('not found')?404:400)}
});

app.put('/api/producers/:id/cuvee-links/:linkId',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const parsed=changeCuveeCatalogLinkSchema.safeParse(await c.req.json().catch(()=>null));
  if(!parsed.success)return c.json({error:'Invalid cuvée catalog link change',issues:parsed.error.issues},400);
  try{return c.json(await changeCuveeCatalogLink(c.env.DB,owner,c.req.param('id'),c.req.param('linkId'),parsed.data.catalogCuveeId))}
  catch(e){const message=(e as Error).message||'Could not change cuvée catalog link';return c.json({error:message},message.includes('not found')?404:400)}
});

app.post('/api/producers/:id/cuvee-links/:linkId/unlink',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const parsed=unlinkCuveeCatalogLinkSchema.safeParse(await c.req.json().catch(()=>null));
  if(!parsed.success)return c.json({error:'Invalid cuvée catalog unlink',issues:parsed.error.issues},400);
  try{return c.json(await unlinkCuveeCatalogLink(c.env.DB,owner,c.req.param('id'),c.req.param('linkId')))}
  catch(e){const message=(e as Error).message||'Could not unlink cuvée from catalog';return c.json({error:message},message.includes('not found')?404:400)}
});

app.get('/api/producers/:id',async c=>{
  let owner:string;try{owner=await user(c)}catch{return entryApp.fetch(c.req.raw,c.env,c.executionCtx)}
  const producerId=c.req.param('id');
  const response=await entryApp.fetch(c.req.raw,c.env,c.executionCtx);
  if(!response.ok)return response;
  try{
    const [body,state]=await Promise.all([
      response.clone().json() as Promise<Record<string,unknown>&{tastedWines?:Array<Record<string,unknown>&{id?:unknown;cuveeId?:unknown}>}>,
      getProducerCuveeCatalogState(c.env.DB,owner,producerId)
    ]);
    const tastedWines=(body.tastedWines??[]).map(wine=>{const wineId=String(wine.id??'');return {...wine,cuveeId:typeof wine.cuveeId==='string'?wine.cuveeId:null,catalogCuveeId:state.wineCatalogTargets[wineId]??null}});
    const headers=new Headers(response.headers);headers.delete('Content-Length');headers.set('Content-Type','application/json; charset=utf-8');
    return new Response(JSON.stringify({...body,tastedWines,catalogCuvees:state.catalogCuvees,cuveeCatalogLinks:state.cuveeCatalogLinks}),{status:response.status,statusText:response.statusText,headers});
  }catch(e){console.error(JSON.stringify({event:'producer-cuvee-catalog-state-failed',producerId,error:(e as Error).message}));return response}
});

app.post('/api/producers/:id/research',c=>entryApp.fetch(c.req.raw,c.env,c.executionCtx));

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
