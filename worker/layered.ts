import { Hono } from 'hono';
import baseApp from './index';
import { requireSession } from '../src/lib/auth/session';
import { linkWineProducer,mapProducerRow,normalizeProducerAlias,resolveExistingProducer,setProducerPrimaryName,suggestExistingProducer } from '../src/lib/producers/entities';
import { mergeProducerEntities,unlinkProducerMerge } from '../src/lib/producers/merge';
import { getProducerResearchRun } from '../src/lib/producers/research';
import { createManualProducerContact,deleteManualProducerContact,listManualProducerContacts,updateManualProducerContact } from '../src/lib/producers/manualContacts';
import { applyCatalogDecisions,deleteCatalogDecision,listCatalogDecisions,saveCatalogDecision } from '../src/lib/producers/catalogDecisions';
import { selectRecognitionMetadata,type RecognitionPhotoMetadata } from '../src/lib/uploads/metadataSelection';
import { canonicalCatalogEntries,type CatalogPresentationLike } from '../src/lib/cuvees/catalogPresentation';
import { usageSummary } from '../src/lib/usage/aiUsage';
import { seedAiUsageOnce } from '../src/lib/usage/seedFromResearchJobs';
import { readAiRates,type AiRateEnv } from '../src/lib/usage/rates';

type Bindings={DB:D1Database;WINE_IMAGES:R2Bucket;ASSETS:Fetcher;GEMINI_API_KEY:string;AUTH_SECRET:string;APP_PASSWORD:string;APP_URL:string;MAX_FILE_BYTES?:string;MAX_BATCH_FILES?:string}&AiRateEnv;
type AppEnv={Bindings:Bindings};
const app=new Hono<AppEnv>();

async function user(c:{req:{header:(name:string)=>string|undefined};env:Bindings}){return (await requireSession(c.req.header('Authorization'),c.env.AUTH_SECRET)).userId}
const parseJson=<T>(value:unknown,fallback:T):T=>{try{return JSON.parse(String(value)) as T}catch{return fallback}};
function catalogEntries(value:unknown){
  const parsed=parseJson<unknown>(value,[]);
  if(!Array.isArray(parsed))return [] as CatalogPresentationLike[];
  return parsed.filter((item):item is CatalogPresentationLike=>Boolean(item&&typeof item==='object'&&typeof (item as {name?:unknown}).name==='string'));
}
async function linkSavedWine(db:D1Database,owner:string,wineId:string){
  const row=await db.prepare('SELECT producer FROM wines WHERE owner_id=? AND id=?').bind(owner,wineId).first<{producer:string}>();
  if(row?.producer?.trim())await linkWineProducer(db,owner,wineId,row.producer);
}

// What the AI has cost, per run. Read from the same ledger the Analytics Engine
// data points come from, priced at read time so a rate correction in
// wrangler.jsonc reprices history rather than only what happens next.
app.get('/api/usage/spend',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const days=Number(c.req.query('days')??30);
  try{
    // Once, on the first read: the search counts research jobs have been
    // recording all along predate the ledger, and the monthly allowance is
    // counted in exactly those.
    await seedAiUsageOnce(c.env.DB,owner).catch(()=>null);
    return c.json(await usageSummary(c.env.DB,owner,readAiRates(c.env),Number.isFinite(days)?days:30));
  }
  catch(e){return c.json({error:(e as Error).message||'Could not load AI spend'},500)}
});

app.get('/api/producers',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  try{
    const [rows,aliases]=await Promise.all([
      c.env.DB.prepare(`SELECT p.id,p.canonical_name,p.home_country,p.home_region,p.home_locality,p.researched_at,p.catalog_json,
        (SELECT count(*) FROM wines w WHERE w.owner_id=p.owner_id AND w.producer_id=p.id) AS tasted_count
        FROM producers p WHERE p.owner_id=? ORDER BY coalesce(p.home_country,'~'),coalesce(p.home_region,'~'),p.canonical_name COLLATE NOCASE`).bind(owner).all<Record<string,unknown>>(),
      c.env.DB.prepare('SELECT producer_id,display_alias FROM producer_aliases WHERE owner_id=? ORDER BY display_alias COLLATE NOCASE').bind(owner).all<{producer_id:string;display_alias:string}>()
    ]);
    const aliasesByProducer=new Map<string,string[]>();
    for(const alias of aliases.results){const list=aliasesByProducer.get(alias.producer_id)??[];list.push(alias.display_alias);aliasesByProducer.set(alias.producer_id,list)}
    return c.json({items:rows.results.map(r=>{
      const id=String(r.id),canonicalName=String(r.canonical_name),producerNames=[canonicalName,...(aliasesByProducer.get(id)??[])];
      const catalogCount=canonicalCatalogEntries(catalogEntries(r.catalog_json),producerNames).length;
      return {id,canonicalName,homeCountry:r.home_country?String(r.home_country):null,homeRegion:r.home_region?String(r.home_region):null,homeLocality:r.home_locality?String(r.home_locality):null,tastedCount:Number(r.tasted_count)||0,catalogCount,researchedAt:r.researched_at?String(r.researched_at):null};
    })});
  }catch(e){return c.json({error:(e as Error).message||'Could not load producers'},500)}
});

function cors(c:{req:{header:(name:string)=>string|undefined};env:Bindings;header:(name:string,value:string)=>void}){const origin=c.req.header('Origin');if(origin&&origin===c.env.APP_URL){c.header('Access-Control-Allow-Origin',origin);c.header('Vary','Origin')}}
const manualContactStatus=(message:string)=>message.toLowerCase().includes('not found')?404:400;

app.get('/api/producers/resolve',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const name=(c.req.query('name')||'').trim();
  if(!name)return c.json({matched:false,inputName:''});
  try{
    const producer=await resolveExistingProducer(c.env.DB,owner,name);
    if(producer)return c.json({matched:true,inputName:name,producer});
    // Only when nothing matched: the scan of the producer list is cheap but it
    // is not free, and a name that already resolved has nothing to suggest.
    const suggestion=await suggestExistingProducer(c.env.DB,owner,name).catch(()=>null);
    return c.json({matched:false,inputName:name,...(suggestion?{suggestion}:{})});
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
    const [aliases,wines,history,links,supplementaryContacts,catalogDecisions]=await Promise.all([
      c.env.DB.prepare('SELECT display_alias FROM producer_aliases WHERE owner_id=? AND producer_id=? ORDER BY display_alias COLLATE NOCASE').bind(owner,c.req.param('id')).all<{display_alias:string}>(),
      c.env.DB.prepare(`SELECT w.id,w.cuvee_id,w.wine_name,w.vintage,w.appellation,w.region,w.country,w.wine_style,w.grapes_json,
        (SELECT wi.id FROM wine_images wi WHERE wi.owner_id=w.owner_id AND wi.wine_id=w.id ORDER BY wi.rowid ASC LIMIT 1) AS image_id,
        coalesce((SELECT we.consumed_at FROM wine_experiences we WHERE we.owner_id=w.owner_id AND we.wine_id=w.id ORDER BY we.created_at DESC LIMIT 1),w.tasting_date) AS tasting_date,
        coalesce((SELECT we.rating FROM wine_experiences we WHERE we.owner_id=w.owner_id AND we.wine_id=w.id ORDER BY we.created_at DESC LIMIT 1),w.rating) AS rating
        FROM wines w WHERE w.owner_id=? AND w.producer_id=? ORDER BY coalesce(tasting_date,w.created_at) DESC,w.vintage DESC`).bind(owner,c.req.param('id')).all<Record<string,unknown>>(),
      c.env.DB.prepare('SELECT count(*) AS count FROM producer_research_history WHERE owner_id=? AND producer_id=?').bind(owner,c.req.param('id')).first<{count:number}>(),
      c.env.DB.prepare(`SELECT id,source_producer_id,source_canonical_name,merged_at FROM producer_merges
        WHERE owner_id=? AND destination_producer_id=? AND undone_at IS NULL ORDER BY merged_at DESC`).bind(owner,c.req.param('id')).all<{id:string;source_producer_id:string;source_canonical_name:string;merged_at:string}>(),
      listManualProducerContacts(c.env.DB,owner,c.req.param('id')),
      listCatalogDecisions(c.env.DB,owner,c.req.param('id'))
    ]);
    const entity=mapProducerRow(row),producerNames=[entity.canonicalName,...aliases.results.map(x=>x.display_alias)];
    const correctedCatalog=applyCatalogDecisions(entity.catalog,catalogDecisions,producerNames).range;
    return c.json({...entity,catalog:correctedCatalog,catalogDecisions,aliases:aliases.results.map(x=>x.display_alias),researchHistoryCount:Number(history?.count)||0,linkedProducers:links.results.map(x=>({mergeId:x.id,producerId:x.source_producer_id,name:x.source_canonical_name,mergedAt:x.merged_at})),supplementaryContacts,tastedWines:wines.results.map(w=>({id:String(w.id),cuveeId:w.cuvee_id?String(w.cuvee_id):null,wineName:String(w.wine_name),vintage:w.vintage==null?null:Number(w.vintage),appellation:w.appellation?String(w.appellation):null,region:w.region?String(w.region):null,country:w.country?String(w.country):null,wineStyle:w.wine_style?String(w.wine_style):null,grapes:parseJson<unknown[]>(w.grapes_json,[]).map(String).filter(Boolean),imageId:w.image_id?String(w.image_id):null,tastingDate:w.tasting_date?String(w.tasting_date):null,rating:w.rating==null?null:Number(w.rating)}))});
  }catch(e){return c.json({error:(e as Error).message||'Could not load producer'},500)}
});

app.post('/api/producers/:id/manual-contacts',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const body=await c.req.json().catch(()=>({}));
  try{return c.json(await createManualProducerContact(c.env.DB,owner,c.req.param('id'),body),201)}catch(e){const message=(e as Error).message||'Could not add supplementary contact';return c.json({error:message},manualContactStatus(message))}
});

app.put('/api/producers/:id/manual-contacts/:contactId',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const body=await c.req.json().catch(()=>({}));
  try{return c.json(await updateManualProducerContact(c.env.DB,owner,c.req.param('id'),c.req.param('contactId'),body))}catch(e){const message=(e as Error).message||'Could not update supplementary contact';return c.json({error:message},manualContactStatus(message))}
});

app.delete('/api/producers/:id/manual-contacts/:contactId',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const body=await c.req.json().catch(()=>({})) as {confirmation?:string};if(body.confirmation!=='DELETE_MANUAL_CONTACT')return c.json({error:'Deleting a supplementary contact requires confirmation'},400);
  try{return c.json(await deleteManualProducerContact(c.env.DB,owner,c.req.param('id'),c.req.param('contactId')))}catch(e){const message=(e as Error).message||'Could not delete supplementary contact';return c.json({error:message},manualContactStatus(message))}
});

app.post('/api/producers/:id/primary-name',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const body=await c.req.json().catch(()=>({})) as {name?:string};
  if(!body.name?.trim())return c.json({error:'Choose an existing producer name'},400);
  try{return c.json(await setProducerPrimaryName(c.env.DB,owner,c.req.param('id'),body.name))}catch(e){const message=(e as Error).message||'Could not change primary name';return c.json({error:message},message.includes('existing')||message.includes('conflict')?400:500)}
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

app.post('/api/producers/:id/catalog-decisions',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const body=await c.req.json().catch(()=>({})) as {confirmation?:string;decision?:unknown;sourceKey?:unknown;sourceName?:unknown;targetKey?:unknown;targetName?:unknown};
  if(body.confirmation!=='CORRECT_PRODUCER_CATALOG')return c.json({error:'A catalogue correction requires explicit confirmation'},400);
  try{return c.json(await saveCatalogDecision(c.env.DB,owner,c.req.param('id'),body))}
  catch(e){const message=(e as Error).message||'Could not save the catalogue correction';return c.json({error:message},message.includes('not found')?404:400)}
});

app.post('/api/producers/:id/catalog-decisions/:decisionId/undo',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const body=await c.req.json().catch(()=>({})) as {confirmation?:string};
  if(body.confirmation!=='UNDO_PRODUCER_CATALOG_CORRECTION')return c.json({error:'Undoing a catalogue correction requires explicit confirmation'},400);
  try{return c.json(await deleteCatalogDecision(c.env.DB,owner,c.req.param('id'),c.req.param('decisionId')))}
  catch(e){const message=(e as Error).message||'Could not undo the catalogue correction';return c.json({error:message},message.includes('not found')?404:400)}
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