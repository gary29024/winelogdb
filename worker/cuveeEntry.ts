import { Hono,type Context } from 'hono';
import entryApp from './entry';
import { requireSession } from '../src/lib/auth/session';
import { ensureAllProducerLinks } from '../src/lib/producers/entities';
import { repairIdentityKeys } from '../src/lib/producers/identityRepair';
import { cleanupOrphanCuvee,ensureAllCuveeLinksForProducer,ensureMissingCuveeLinks,reconcileProducerCuvees,resolveExistingCuvee } from '../src/lib/cuvees/entities';
import { ensureWineIdentity } from '../src/lib/wine/identity';
import { setCuveePrimaryName } from '../src/lib/cuvees/primaryName';
import { ensureProducerCatalogCuveesSeeded } from '../src/lib/cuvees/catalogSeed';
import { changeCuveeCatalogLink,changeCuveeCatalogLinkSchema,createCuveeCatalogLink,createCuveeCatalogLinkSchema,getProducerCuveeCatalogState,unlinkCuveeCatalogLink,unlinkCuveeCatalogLinkSchema } from '../src/lib/cuvees/catalogLinks';
import { listJournalPage } from '../src/lib/journal/list';
import { applyBatchExperienceUpdate,batchExperienceSchema } from '../src/lib/journal/batchExperience';
import { deleteTasting,endTasting,listTastings,readActiveTasting,readTastingRow,readTastingWines,reopenTasting,startTasting,updateTasting } from '../src/lib/tastings/session';
import { attachTastingWinesSchema,attachWinesToTasting,detachWineFromTasting } from '../src/lib/tastings/attach';
import { addTastingDocuments,deleteTastingDocument,listTastingDocuments,readTastingDocument,tastingDocumentKeys } from '../src/lib/tastings/documents';
import { findLineupWine,matchSheetWines,readLineupForMatching } from '../src/lib/tastings/sheetMatch';
import { applySheetPrices,createSheetWines,sheetPricesSchema,sheetWinesSchema } from '../src/lib/tastings/sheetWrite';
import { sheetPageWasCutShort,sheetResumeLine } from '../src/features/recognition/sheetSchema';
import { sheetRecognitionSpec } from './sheetRecognitionHandler';
import { runVisionRecognition } from './visionRecognition';

type Bindings={DB:D1Database;WINE_IMAGES:R2Bucket;ASSETS:Fetcher;GEMINI_API_KEY:string;AUTH_SECRET:string;APP_PASSWORD:string;APP_URL:string;MAX_FILE_BYTES?:string;MAX_BATCH_FILES?:string};
type AppEnv={Bindings:Bindings};
const app=new Hono<AppEnv>();
const IDENTITY_MAINTENANCE_KEY='identity-reconcile-v2';
/**
 * One-shot, not a schedule: it repairs keys written by the old ASCII-only
 * normalizer. The claim row is the record that it has run, so a second pass
 * only happens if the first threw or ran out of its write budget.
 */
const IDENTITY_REPAIR_KEY='identity-key-unicode-repair-v1';
const MAINTENANCE_INTERVAL_MS=24*60*60*1000;
const MAINTENANCE_LOCAL_CHECK_MS=60*60*1000;
const maintenanceMemo=new Map<string,number>();

function cors(c:{req:{header:(name:string)=>string|undefined};env:Bindings;header:(name:string,value:string)=>void}){const origin=c.req.header('Origin');if(origin&&origin===c.env.APP_URL){c.header('Access-Control-Allow-Origin',origin);c.header('Vary','Origin')}}
async function user(c:{req:{header:(name:string)=>string|undefined};env:Bindings}){return (await requireSession(c.req.header('Authorization'),c.env.AUTH_SECRET)).userId}

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

async function maybeRepairIdentityKeys(c:Context<AppEnv>,owner:string){
  const nowIso=new Date().toISOString();
  const claim=await c.env.DB.prepare(`INSERT INTO maintenance_state(owner_id,maintenance_key,last_run_at) VALUES(?,?,?)
    ON CONFLICT(owner_id,maintenance_key) DO NOTHING`).bind(owner,IDENTITY_REPAIR_KEY,nowIso).run();
  if(!claim.meta.changes)return;
  c.executionCtx.waitUntil((async()=>{
    try{
      const report=await repairIdentityKeys(c.env.DB,owner);
      console.log(JSON.stringify({event:'identity-key-repair-complete',owner,...report}));
      // A capped pass left work behind, so the claim is released and the next
      // request picks the rest up.
      if(report.capped)await c.env.DB.prepare('DELETE FROM maintenance_state WHERE owner_id=? AND maintenance_key=?').bind(owner,IDENTITY_REPAIR_KEY).run().catch(()=>{});
    }catch(e){
      console.error(JSON.stringify({event:'identity-key-repair-failed',owner,error:(e as Error).message}));
      await c.env.DB.prepare('DELETE FROM maintenance_state WHERE owner_id=? AND maintenance_key=?').bind(owner,IDENTITY_REPAIR_KEY).run().catch(()=>{});
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
  if(Number(c.req.query('offset')||0)===0){try{await maybeRepairIdentityKeys(c,owner);await maybeScheduleIdentityMaintenance(c,owner)}catch(e){console.error(JSON.stringify({event:'identity-maintenance-schedule-failed',error:(e as Error).message}))}}
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
  if(Number(c.req.query('offset')||0)===0){try{await maybeRepairIdentityKeys(c,owner);await maybeScheduleIdentityMaintenance(c,owner)}catch(e){console.error(JSON.stringify({event:'identity-maintenance-schedule-failed',error:(e as Error).message}))}}
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
  let requestedName:string|null=null,preferCuveePrimaryName=false;
  try{
    const body=await c.req.raw.clone().json() as {wineName?:unknown;preferCuveePrimaryName?:unknown};
    if(typeof body.wineName==='string'&&body.wineName.trim())requestedName=body.wineName.trim();
    preferCuveePrimaryName=body.preferCuveePrimaryName===true;
  }catch{}
  const response=await entryApp.fetch(c.req.raw,c.env,c.executionCtx);
  if(response.ok){
    try{
      if(requestedName&&before?.wine_name!==requestedName){await c.env.DB.prepare('UPDATE wines SET recognized_wine_name=?,cuvee_id=NULL WHERE owner_id=? AND id=?').bind(requestedName,owner,id).run()}
      await ensureWineIdentity(c.env.DB,owner,id);
      if(requestedName&&preferCuveePrimaryName){
        const linked=await c.env.DB.prepare('SELECT cuvee_id FROM wines WHERE owner_id=? AND id=?').bind(owner,id).first<{cuvee_id:string|null}>();
        if(!linked?.cuvee_id)throw new Error('Wine has no cuvée identity to rename');
        await setCuveePrimaryName(c.env.DB,owner,linked.cuvee_id,requestedName);
      }
    }catch(e){
      console.error(JSON.stringify({event:'wine-cuvee-primary-name-failed',wineId:id,error:(e as Error).message}));
      if(preferCuveePrimaryName)return c.json({error:(e as Error).message||'Could not update primary cuvée name'},400);
    }
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

/**
 * Tastings.
 *
 * These live here rather than in entry because they are their own feature
 * rather than a hook on an existing wine route, and cuveeEntry is where the
 * app's own D1-backed endpoints have collected. Every one takes the same
 * preamble as the journal routes above: CORS, then the session, then a 401.
 *
 * Route order matters: the literal segments are registered before the dynamic
 * :id so that /api/tastings/active is not read as a tasting called "active".
 */
const ISO_DATE=/^\d{4}-\d{2}-\d{2}$/;
const tastingError=(e:unknown,fallback:string)=>{
  const message=(e as Error).message||fallback;
  return {message,status:(message.includes('no longer exist')?404:400) as 404|400};
};

app.post('/api/tastings',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const body=await c.req.json().catch(()=>null) as {name?:unknown;tastingDate?:unknown;venue?:unknown}|null;
  const name=typeof body?.name==='string'?body.name.trim():'';
  const tastingDate=typeof body?.tastingDate==='string'?body.tastingDate.trim():'';
  if(!name)return c.json({error:'A tasting needs a name'},400);
  // The date is the client's local one on purpose - see startTasting.
  if(!ISO_DATE.test(tastingDate))return c.json({error:'A tasting needs a date as YYYY-MM-DD'},400);
  try{return c.json({tasting:await startTasting(c.env.DB,owner,{name,tastingDate,venue:typeof body?.venue==='string'?body.venue:null})},201)}
  catch(e){console.error(JSON.stringify({event:'tasting-start-failed',error:(e as Error).message}));return c.json({error:'Could not start the tasting'},500)}
});

// Always 200, never 404: "nothing is open" is an answer, and the client reads
// this on every app load.
app.get('/api/tastings/active',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  try{return c.json({tasting:await readActiveTasting(c.env.DB,owner)})}
  catch(e){console.error(JSON.stringify({event:'tasting-active-failed',error:(e as Error).message}));return c.json({tasting:null})}
});

app.get('/api/tastings',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  try{return c.json({items:await listTastings(c.env.DB,owner,Number(c.req.query('limit'))||50)})}
  catch(e){console.error(JSON.stringify({event:'tasting-list-failed',error:(e as Error).message}));return c.json({error:'Could not load tastings'},500)}
});

app.get('/api/tastings/documents/:id',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const response=await readTastingDocument(c.env,owner,c.req.param('id')).catch(()=>null);
  return response??c.json({error:'Not found'},404);
});

app.delete('/api/tastings/documents/:id',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const removed=await deleteTastingDocument(c.env,owner,c.req.param('id')).catch(()=>false);
  return removed?c.body(null,204):c.json({error:'Not found'},404);
});

app.get('/api/tastings/:id',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const id=c.req.param('id');
  try{
    const tasting=await readTastingRow(c.env.DB,owner,id);
    if(!tasting)return c.json({error:'Not found'},404);
    const [wines,documents]=await Promise.all([readTastingWines(c.env.DB,owner,id),listTastingDocuments(c.env.DB,owner,id)]);
    return c.json({tasting,wines,documents});
  }catch(e){console.error(JSON.stringify({event:'tasting-read-failed',error:(e as Error).message}));return c.json({error:'Could not load the tasting'},500)}
});

app.put('/api/tastings/:id',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const body=await c.req.json().catch(()=>null) as {name?:unknown;venue?:unknown}|null;
  const patch:{name?:string;venue?:string|null}={};
  if(typeof body?.name==='string')patch.name=body.name;
  if(body!==null&&'venue' in body)patch.venue=typeof body.venue==='string'?body.venue:null;
  try{
    const tasting=await updateTasting(c.env.DB,owner,c.req.param('id'),patch);
    return tasting?c.json({tasting}):c.json({error:'Not found'},404);
  }catch(e){
    const message=(e as Error).message||'Could not update the tasting';
    // Renaming onto a name+date that already exists trips the identity index.
    if(/UNIQUE|constraint/i.test(message))return c.json({error:'You already have a tasting with that name on that date'},409);
    return c.json({error:message},400);
  }
});

app.post('/api/tastings/:id/end',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  try{
    const tasting=await endTasting(c.env.DB,owner,c.req.param('id'));
    return tasting?c.json({tasting}):c.json({error:'Not found'},404);
  }catch(e){return c.json({error:(e as Error).message||'Could not end the tasting'},500)}
});

app.post('/api/tastings/:id/reopen',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  try{
    const tasting=await reopenTasting(c.env.DB,owner,c.req.param('id'));
    return tasting?c.json({tasting}):c.json({error:'Not found'},404);
  }catch(e){return c.json({error:(e as Error).message||'Could not reopen the tasting'},500)}
});

app.post('/api/tastings/:id/wines',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const parsed=attachTastingWinesSchema.safeParse(await c.req.json().catch(()=>null));
  if(!parsed.success)return c.json({error:'Invalid wine selection',issues:parsed.error.issues},400);
  try{return c.json(await attachWinesToTasting(c.env.DB,owner,c.req.param('id'),parsed.data.ids))}
  catch(e){const {message,status}=tastingError(e,'Could not add the selected wines');return c.json({error:message},status)}
});

app.delete('/api/tastings/:id/wines/:wineId',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  try{
    const {detached}=await detachWineFromTasting(c.env.DB,owner,c.req.param('id'),c.req.param('wineId'));
    return detached?c.body(null,204):c.json({error:'Not found'},404);
  }catch(e){return c.json({error:(e as Error).message||'Could not remove the wine'},500)}
});

// The sheet usually arrives at the end, so this is deliberately not gated on
// the tasting still being open.
app.post('/api/tastings/:id/documents',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const form=await c.req.formData().catch(()=>null);
  const files=(form?.getAll('documents')??[]).filter((value):value is File=>value instanceof File);
  try{return c.json({documents:await addTastingDocuments(c.env,owner,c.req.param('id'),files)},201)}
  catch(e){const {message,status}=tastingError(e,'Could not save the wine list');return c.json({error:message},status)}
});

/**
 * Reading the printed wine list.
 *
 * One page per call - a trade tasting list runs to a hundred wines or more, and
 * one request carrying every page would be cut off mid-array and lose the tail
 * without saying so. The client photographs pages, posts them one at a time and
 * merges; `afterLine` continues a page that reported itself cut short.
 *
 * Rows come back already matched against the evening's lineup, because the
 * lineup has to be loaded exactly once and the client should not have to know
 * how WineLog decides two wines are the same one.
 */
/**
 * Is this wine already in this evening?
 *
 * Asked by the scan form before it creates anything. A bottle photographed at a
 * tasting whose printed list was read an hour earlier is the same wine as the
 * row that reading created - and the create path has no dedupe, so saving it
 * makes a second copy: one with the price and no photo, one with the photo and
 * no price, both in the same lineup.
 *
 * Scoped to the tasting rather than the whole library on purpose. A bottle
 * drunk last March is a different pour, and attaching tonight's photograph to
 * it would be wrong; what is being asked is only "is this one of tonight's".
 */
app.get('/api/tastings/:id/wine-match',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const producer=(c.req.query('producer')??'').trim(),wineName=(c.req.query('wineName')??'').trim();
  if(!producer||!wineName)return c.json({match:null});
  const rawVintage=c.req.query('vintage'),vintage=rawVintage&&/^\d{3,4}$/.test(rawVintage)?Number(rawVintage):null;
  try{
    const lineup=await readLineupForMatching(c.env.DB,owner,c.req.param('id'));
    const found=findLineupWine(lineup,producer,wineName,vintage);
    return c.json({match:found?{wineId:found.wineId,producer:found.producer,wineName:found.wineName,vintage:found.vintage}:null});
  }catch(e){
    // A failed probe must never block a save; the worst case is the duplicate
    // that was made before this existed.
    console.warn(JSON.stringify({event:'tasting-wine-match-failed',error:(e as Error).message}));
    return c.json({match:null});
  }
});

app.post('/api/tastings/:id/sheet/parse',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const tastingId=c.req.param('id');
  const tasting=await c.env.DB.prepare('SELECT id FROM tastings WHERE owner_id=? AND id=?').bind(owner,tastingId).first<{id:string}>();
  if(!tasting)return c.json({error:'That tasting no longer exists'},404);
  const outcome=await runVisionRecognition(c.req.raw,c.env,sheetRecognitionSpec);
  if(!outcome.ok)return outcome.response;
  const page=outcome.result;
  try{
    const lineup=await readLineupForMatching(c.env.DB,owner,tastingId);
    return c.json({
      currency:page.currency??null,
      unresolvedCount:page.unresolvedCount,
      // Both halves of "was this page cut short": the model's own flag and the
      // finish reason. Either one means there is more paper to read.
      truncated:sheetPageWasCutShort(page,outcome.finishReason),
      resumeAfterLine:sheetResumeLine(page),
      matches:matchSheetWines(page.wines,lineup),
      // The evening's wines, so a row the normalisation could not match can be
      // pointed at one by hand instead of being forced to create a duplicate.
      // Already loaded for the matching above, so this costs no extra query.
      lineup:lineup.map(wine=>({
        wineId:wine.wineId,producer:wine.producer,wineName:wine.wineName,vintage:wine.vintage,
        hasPrice:wine.price!=null,price:wine.price,currency:wine.currency
      })),
      requestId:outcome.requestId,recognitionDurationMs:outcome.durationMs
    });
  }catch(e){
    console.error(JSON.stringify({event:'tasting-sheet-match-failed',error:(e as Error).message}));
    return c.json({error:'Read the wine list, but could not match it against this tasting'},500);
  }
});

app.post('/api/tastings/:id/sheet/prices',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const parsed=sheetPricesSchema.safeParse(await c.req.json().catch(()=>null));
  if(!parsed.success)return c.json({error:'Invalid sheet prices',issues:parsed.error.issues},400);
  try{return c.json(await applySheetPrices(c.env.DB,owner,c.req.param('id'),parsed.data))}
  catch(e){const {message,status}=tastingError(e,'Could not fill in those prices');return c.json({error:message},status)}
});

app.post('/api/tastings/:id/sheet/wines',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const parsed=sheetWinesSchema.safeParse(await c.req.json().catch(()=>null));
  if(!parsed.success)return c.json({error:'Invalid sheet wines',issues:parsed.error.issues},400);
  try{return c.json(await createSheetWines(c.env.DB,owner,c.req.param('id'),parsed.data),201)}
  catch(e){const {message,status}=tastingError(e,'Could not add those wines');return c.json({error:message},status)}
});

app.delete('/api/tastings/:id',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const body=await c.req.json().catch(()=>null) as {confirmation?:unknown}|null;
  if(body?.confirmation!=='DELETE_TASTING')return c.json({error:'Deleting a tasting needs a confirmation'},400);
  const id=c.req.param('id');
  try{
    // Read the keys first: the FK cascades the document rows away, so after the
    // delete there is nothing left to tell R2 about.
    const keys=await tastingDocumentKeys(c.env.DB,owner,id);
    const deleted=await deleteTasting(c.env.DB,owner,id);
    if(!deleted)return c.json({error:'Not found'},404);
    if(keys.length)await Promise.allSettled(keys.map(key=>c.env.WINE_IMAGES.delete(key)));
    return c.body(null,204);
  }catch(e){console.error(JSON.stringify({event:'tasting-delete-failed',error:(e as Error).message}));return c.json({error:'Could not delete the tasting'},500)}
});

app.all('*',c=>entryApp.fetch(c.req.raw,c.env,c.executionCtx));
export default app;
