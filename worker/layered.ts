import { Hono } from 'hono';
import baseApp from './index';
import { requireSession } from '../src/lib/auth/session';
import { runLayeredDeepSearch } from '../src/lib/research/deepSearch';
import { ensureAllProducerLinks,mapProducerRow } from '../src/lib/producers/entities';
import { mergeProducerEntities,unlinkProducerMerge } from '../src/lib/producers/merge';
import { runProducerResearch } from '../src/lib/producers/research';

type Bindings={DB:D1Database;WINE_IMAGES:R2Bucket;ASSETS:Fetcher;GEMINI_API_KEY:string;AUTH_SECRET:string;APP_PASSWORD:string;APP_URL:string;MAX_FILE_BYTES?:string;MAX_BATCH_FILES?:string};
type AppEnv={Bindings:Bindings};
const app=new Hono<AppEnv>();

function cors(c:{req:{header:(name:string)=>string|undefined};env:Bindings;header:(name:string,value:string)=>void}){const origin=c.req.header('Origin');if(origin&&origin===c.env.APP_URL){c.header('Access-Control-Allow-Origin',origin);c.header('Vary','Origin')}}
async function user(c:{req:{header:(name:string)=>string|undefined};env:Bindings}){return (await requireSession(c.req.header('Authorization'),c.env.AUTH_SECRET)).userId}

app.get('/api/producers',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  try{
    await ensureAllProducerLinks(c.env.DB,owner);
    const rows=await c.env.DB.prepare(`SELECT p.id,p.canonical_name,p.home_country,p.home_region,p.home_locality,p.researched_at,
      (SELECT count(*) FROM wines w WHERE w.owner_id=p.owner_id AND w.producer_id=p.id) AS tasted_count,
      coalesce(json_array_length(p.catalog_json),0) AS catalog_count
      FROM producers p WHERE p.owner_id=? ORDER BY coalesce(p.home_country,'~'),coalesce(p.home_region,'~'),p.canonical_name COLLATE NOCASE`).bind(owner).all<Record<string,unknown>>();
    return c.json({items:rows.results.map(r=>({id:String(r.id),canonicalName:String(r.canonical_name),homeCountry:r.home_country?String(r.home_country):null,homeRegion:r.home_region?String(r.home_region):null,homeLocality:r.home_locality?String(r.home_locality):null,tastedCount:Number(r.tasted_count)||0,catalogCount:Number(r.catalog_count)||0,researchedAt:r.researched_at?String(r.researched_at):null}))});
  }catch(e){return c.json({error:(e as Error).message||'Could not load producers'},500)}
});

app.get('/api/producers/:id',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  try{
    await ensureAllProducerLinks(c.env.DB,owner);
    const row=await c.env.DB.prepare('SELECT * FROM producers WHERE owner_id=? AND id=?').bind(owner,c.req.param('id')).first<Record<string,unknown>>();
    if(!row)return c.json({error:'Producer not found'},404);
    const [aliases,wines,history,links]=await Promise.all([
      c.env.DB.prepare('SELECT display_alias FROM producer_aliases WHERE owner_id=? AND producer_id=? ORDER BY display_alias COLLATE NOCASE').bind(owner,c.req.param('id')).all<{display_alias:string}>(),
      c.env.DB.prepare(`SELECT w.id,w.wine_name,w.vintage,w.appellation,w.region,w.country,
        coalesce((SELECT we.consumed_at FROM wine_experiences we WHERE we.owner_id=w.owner_id AND we.wine_id=w.id ORDER BY we.created_at DESC LIMIT 1),w.tasting_date) AS tasting_date,
        coalesce((SELECT we.rating FROM wine_experiences we WHERE we.owner_id=w.owner_id AND we.wine_id=w.id ORDER BY we.created_at DESC LIMIT 1),w.rating) AS rating
        FROM wines w WHERE w.owner_id=? AND w.producer_id=? ORDER BY coalesce(tasting_date,w.created_at) DESC,w.vintage DESC`).bind(owner,c.req.param('id')).all<Record<string,unknown>>(),
      c.env.DB.prepare('SELECT count(*) AS count FROM producer_research_history WHERE owner_id=? AND producer_id=?').bind(owner,c.req.param('id')).first<{count:number}>(),
      c.env.DB.prepare(`SELECT id,source_producer_id,source_canonical_name,merged_at FROM producer_merges
        WHERE owner_id=? AND destination_producer_id=? AND undone_at IS NULL ORDER BY merged_at DESC`).bind(owner,c.req.param('id')).all<{id:string;source_producer_id:string;source_canonical_name:string;merged_at:string}>()
    ]);
    return c.json({...mapProducerRow(row),aliases:aliases.results.map(x=>x.display_alias),researchHistoryCount:Number(history?.count)||0,linkedProducers:links.results.map(x=>({mergeId:x.id,producerId:x.source_producer_id,name:x.source_canonical_name,mergedAt:x.merged_at})),tastedWines:wines.results.map(w=>({id:String(w.id),wineName:String(w.wine_name),vintage:w.vintage==null?null:Number(w.vintage),appellation:w.appellation?String(w.appellation):null,region:w.region?String(w.region):null,country:w.country?String(w.country):null,tastingDate:w.tasting_date?String(w.tasting_date):null,rating:w.rating==null?null:Number(w.rating)}))});
  }catch(e){return c.json({error:(e as Error).message||'Could not load producer'},500)}
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
  try{return c.json(await unlinkProducerMerge(c.env.DB,owner,c.req.param('id'),body.mergeId))}catch(e){const message=(e as Error).message||'Could not unlink producer';return c.json({error:message},message.includes('not found')?404:400)}
});

app.post('/api/producers/:id/research',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const body=await c.req.json().catch(()=>({})) as {confirmation?:string};
  try{const result=await runProducerResearch(c.env,owner,c.req.param('id'),body.confirmation);return c.json(result.body,result.status)}catch{return c.json({error:'Producer research failed unexpectedly'},500)}
});

app.post('/api/wines/:id/deep-search',async c=>{
  cors(c);let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const body=await c.req.json().catch(()=>({})) as {confirmation?:string;refresh?:'none'|'vintage'|'all'};
  try{const result=await runLayeredDeepSearch(c.env,owner,c.req.param('id'),body);return c.json(result.body,result.status)}catch{return c.json({error:'Deep Search failed unexpectedly'},500)}
});

app.all('*',c=>baseApp.fetch(c.req.raw,c.env,c.executionCtx));
export default app;
