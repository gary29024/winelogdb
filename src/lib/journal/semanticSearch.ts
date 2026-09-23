import { AI_MODELS } from '../ai/policy';
import { recordAiUsage,type AiUsageEnv } from '../usage/aiUsage';
import { durableProvider,type ProviderAuthorization } from '../credits/provider';
import { missingTable } from '../db/ownerRevision';
export { shouldUseSemanticQuery } from './semanticQuery';

export type SemanticEmbeddingBindings={
  /** Multi-user requests carry this, but Smart Search embeddings are deliberately zero-credit. */
  CREDIT_CONTEXT?:ProviderAuthorization;
  AI?:Ai;
  GEMINI_API_KEY?:string;
  SEMANTIC_GEMINI_API_KEY?:string;
  SEMANTIC_SEARCH_PROVIDER?:string;
  SEMANTIC_WORKERS_MODEL?:string;
  SEMANTIC_GEMINI_MODEL?:string;
  SEMANTIC_GEMINI_DIMENSIONS?:string;
};

type SemanticEnv=SemanticEmbeddingBindings&AiUsageEnv;
type Provider='workers-ai'|'gemini';
type EmbeddingConfig={provider:Provider;model:string;dimensions:number;modelKey:string;geminiKey?:string};
type SemanticWineRow={
  id:string;producer:string;wine_name:string;vintage:number|null;country:string|null;region:string|null;appellation:string|null;
  classification:string|null;grapes_json:string;wine_style:string|null;tasting_notes:string|null;rating:number|null;event:string|null;venue:string|null;tags_json:string;updated_at:string;
};
type StoredEmbeddingRow={wine_id:string;embedding:unknown;dimensions:number};
type SemanticQueryCacheRow={result_ids_json:string;max_results:number;invisible:number};
export type SemanticVectorCandidate={id:string;vector:ArrayLike<number>};
type MeterContext={owner:string;runId:string;targetId:'journal-query'|'journal-index'};

// Embeddings are cheap enough that they do not consume user credits. They are
// still recorded in ai_usage_events/monthly below, per account and model, so the
// owner can see request and indexed-wine volume and change this policy later.
const EMBEDDING_CREDIT_EXEMPTION={exempt:true,reason:'search_embedding'} as const;

/**
 * How many embedding requests one account may spend in a rolling 24-hour window.
 *
 * Embeddings are zero-credit, which means they also miss every ceiling the
 * credit path enforces in `reserve` - the daily operation count, the monthly
 * budget and the Cloudflare stop-loss. Bounded per request is not the same as
 * bounded: the index converges, but distinct queries miss the 30-minute cache
 * and each buys a fresh embedding indefinitely.
 *
 * Read from pilot_settings so the owner controls it with everything else, and
 * counted off ai_usage_events, which already records every attempt on
 * idx_ai_usage_events_owner_kind. The owner pays the provider directly and is
 * not capped. A deployment with neither table configured is the pre-credits
 * single tenant and is left alone.
 *
 * This is a defensive ceiling, not an accounting reservation. Every sequential
 * provider call re-checks it, so one background refresh cannot run several
 * batches after crossing the limit. Two truly concurrent requests can still
 * race before either usage event lands; exact billing remains reconciled from
 * the usage ledger/provider dashboard rather than treating this as a credit hold.
 */
export const DEFAULT_DAILY_EMBEDDING_REQUESTS=400;

async function embeddingBudgetSpent(db:D1Database,owner:string){
  const since=new Date(Date.now()-86400000).toISOString();
  const row=await db.prepare("SELECT coalesce(sum(requests),0) AS spent FROM ai_usage_events WHERE owner_id=? AND kind='search_embedding' AND created_at>=?")
    .bind(owner,since).first<{spent:number}>();
  return Number(row?.spent)||0;
}

/** True when this account may still spend an embedding request in the rolling 24-hour window. */
export async function embeddingAllowed(env:SemanticEnv,owner:string){
  try{
    const account=await env.DB.prepare('SELECT role FROM app_users WHERE id=?').bind(owner).first<{role:string}>();
    if(!account)return true;
    if(account.role==='owner')return true;
    const configured=await env.DB.prepare('SELECT value_json FROM pilot_settings WHERE id=1').first<{value_json:string}>();
    const parsed=configured?JSON.parse(configured.value_json) as {aiDailyEmbeddingRequests?:unknown}:null;
    const raw=Number(parsed?.aiDailyEmbeddingRequests);
    const cap=Number.isFinite(raw)&&raw>=0?raw:DEFAULT_DAILY_EMBEDDING_REQUESTS;
    if(cap===0)return false;
    return await embeddingBudgetSpent(env.DB,owner)<cap;
  }catch(error){
    // A deployment without the multi-user tables has one account and no cap.
    if(missingTable(error))return true;
    throw error;
  }
}
const WORKERS_MODEL=AI_MODELS.semanticWorkers;
const GEMINI_MODEL=AI_MODELS.semanticGemini;
const WORKERS_DIMENSIONS=1024;
const GEMINI_DIMENSIONS=768;
const WARM_SLICE=64;
const BACKGROUND_BACKFILL=192;
const EMBED_BATCH=24;
const QUERY_CACHE_TTL_MS=30*60*1000;

const jsonList=(value:unknown)=>{try{const parsed=JSON.parse(String(value));return Array.isArray(parsed)?parsed.map(String).filter(Boolean):[]}catch{return [] as string[]}};
const clamp=(value:number,min:number,max:number)=>Math.min(Math.max(value,min),max);
const normalizeSemanticQuery=(query:string)=>query.normalize('NFKC').trim().replace(/\s+/g,' ');

export function buildWineSemanticDocument(row:Partial<SemanticWineRow>){
  const grapes=jsonList(row.grapes_json??'[]'),tags=jsonList(row.tags_json??'[]');
  const lines=[
    row.producer&&`Producer: ${row.producer}`,
    row.wine_name&&`Wine: ${row.wine_name}`,
    row.vintage!=null&&`Vintage: ${row.vintage}`,
    row.country&&`Country: ${row.country}`,
    row.region&&`Region: ${row.region}`,
    row.appellation&&`Appellation: ${row.appellation}`,
    row.classification&&`Classification: ${row.classification}`,
    row.wine_style&&`Style: ${row.wine_style}`,
    grapes.length&&`Grapes: ${grapes.join(', ')}`,
    row.tasting_notes?.trim()&&`Tasting notes: ${row.tasting_notes.trim()}`,
    row.rating!=null&&`Rating: ${row.rating}/100`,
    row.event&&`Tasting or event: ${row.event}`,
    row.venue&&`Venue: ${row.venue}`,
    tags.length&&`Tags: ${tags.join(', ')}`
  ].filter(Boolean);
  return lines.join('\n');
}

function normalized(values:ArrayLike<number>){
  let norm=0;for(let i=0;i<values.length;i++)norm+=Number(values[i])**2;
  const scale=norm>0?1/Math.sqrt(norm):1;
  return Array.from({length:values.length},(_,i)=>Number(values[i])*scale);
}

/** Both inputs must already be unit-normalized; provider vectors are normalized before storage/use. */
export function normalizedDot(a:ArrayLike<number>,b:ArrayLike<number>){
  if(!a.length||a.length!==b.length)return -1;
  let dot=0;for(let i=0;i<a.length;i++)dot+=Number(a[i])*Number(b[i]);
  return dot;
}

/** Query and persisted document vectors are normalized at the provider boundary. */
export function rankSemanticCandidates(query:ArrayLike<number>,candidates:SemanticVectorCandidate[],limit=72){
  return candidates.map(candidate=>({id:candidate.id,score:normalizedDot(query,candidate.vector)}))
    .filter(item=>Number.isFinite(item.score)&&item.score>-1)
    .sort((a,b)=>b.score-a.score)
    .slice(0,Math.max(1,limit));
}

function configFor(env:SemanticEmbeddingBindings):EmbeddingConfig|null{
  const requested=(env.SEMANTIC_SEARCH_PROVIDER??'workers-ai').trim().toLowerCase();
  if(requested==='off'||requested==='disabled')return null;
  if(requested==='gemini'){
    const key=env.SEMANTIC_GEMINI_API_KEY?.trim()||env.GEMINI_API_KEY?.trim();
    if(!key)return null;
    const model=env.SEMANTIC_GEMINI_MODEL?.trim()||GEMINI_MODEL;
    const dimensions=clamp(Number(env.SEMANTIC_GEMINI_DIMENSIONS)||GEMINI_DIMENSIONS,128,3072);
    return {provider:'gemini',model,dimensions,modelKey:`gemini:${model}:${dimensions}:v1`,geminiKey:key};
  }
  if(!env.AI)return null;
  const model=env.SEMANTIC_WORKERS_MODEL?.trim()||WORKERS_MODEL;
  return {provider:'workers-ai',model,dimensions:WORKERS_DIMENSIONS,modelKey:`workers-ai:${model}:${WORKERS_DIMENSIONS}:v1`};
}

function extractWorkersVectors(result:unknown){
  const data=(result as {data?:unknown})?.data;
  if(!Array.isArray(data))throw new Error('Workers AI embedding response did not contain data');
  return data.map(item=>{if(!Array.isArray(item))throw new Error('Workers AI embedding response contained an invalid vector');return item.map(Number)});
}

async function embedTexts(env:SemanticEnv,config:EmbeddingConfig,texts:string[],kind:'query'|'document',meter:MeterContext){
  if(!texts.length)return [] as number[][];
  let attempted=false;
  try{
    let vectors:number[][];
    if(config.provider==='workers-ai'){
      if(!env.AI)throw new Error('Workers AI binding is unavailable');
      attempted=true;
      // Workers AI has no Response wrapper to pass through durableProvider. This
      // is the one deliberate zero-credit AI.run path and is pinned by the
      // structural test; usage is recorded in the finally block below.
      const result=await (env.AI.run as (model:string,input:unknown)=>Promise<unknown>)(config.model,{text:texts});
      vectors=extractWorkersVectors(result);
    }else{
      const requests=texts.map(text=>({
        model:`models/${config.model}`,
        content:{parts:[{text}]},
        embedContentConfig:{taskType:kind==='query'?'RETRIEVAL_QUERY':'RETRIEVAL_DOCUMENT',outputDimensionality:config.dimensions,autoTruncate:true}
      }));
      attempted=true;
      const payload=JSON.stringify({requests});
      // Gemini embeddings follow the same zero-credit policy as Workers AI.
      // durableProvider is retained as the provider chokepoint, with an explicit
      // exemption rather than inheriting a member's denied/unpriced context. An
      // exempt call is not persisted in provider_operations; the usage ledger
      // below remains the audit trail for these idempotent embedding requests.
      const response=await durableProvider(EMBEDDING_CREDIT_EXEMPTION,`embeddings:${config.model}:${kind}:${payload}`,()=>
        fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:batchEmbedContents`,{
          method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':config.geminiKey??''},body:payload
        }));
      if(!response.ok)throw new Error(`Gemini embeddings failed (${response.status})`);
      const body=await response.json() as {embeddings?:Array<{values?:number[]}>};
      vectors=(body.embeddings??[]).map(item=>item.values??[]);
    }
    if(vectors.length!==texts.length)throw new Error(`Embedding response returned ${vectors.length} vectors for ${texts.length} inputs`);
    return vectors.map(vector=>{
      if(vector.length!==config.dimensions)throw new Error(`Embedding dimension mismatch: expected ${config.dimensions}, got ${vector.length}`);
      return normalized(vector);
    });
  }finally{
    // Rejected or malformed AI answers can still consume provider quota. Track
    // every attempt even though embeddings consume zero WineLog credits. The
    // usage unit for Smart Search is an indexed wine, so query embeddings count
    // as a request but deliberately add zero wine units.
    if(attempted)await recordAiUsage(env,meter.owner,{kind:'search_embedding',runId:meter.runId,targetId:meter.targetId,model:config.model,requests:1,units:kind==='document'?texts.length:0});
  }
}

// Uint8Array is accepted by both D1 and the repo's node:sqlite harness as a BLOB
// bind. A naked ArrayBuffer works in D1 but node:sqlite rejects it, which hid the
// persistence path from realistic integration tests.
function vectorBlob(vector:number[]){return new Uint8Array(Float32Array.from(vector).buffer)}

/**
 * D1 deliberately returns BLOB columns as plain number[] values, while the
 * local node:sqlite harness returns Uint8Array. Decode both at this boundary so
 * ranking does not depend on which database runtime produced the row.
 */
export function decodeStoredEmbedding(value:unknown){
  let bytes:Uint8Array;
  if(Array.isArray(value)){
    if(value.some(byte=>!Number.isInteger(byte)||byte<0||byte>255))throw new Error('Stored semantic embedding BLOB contains an invalid byte');
    bytes=Uint8Array.from(value);
  }else if(value instanceof ArrayBuffer)bytes=new Uint8Array(value);
  else if(ArrayBuffer.isView(value))bytes=new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
  else throw new Error('Stored semantic embedding BLOB has an unsupported runtime type');

  if(!bytes.byteLength||bytes.byteLength%Float32Array.BYTES_PER_ELEMENT!==0)throw new Error('Stored semantic embedding BLOB has an invalid byte length');
  // Copy to an aligned, standalone buffer before constructing Float32Array.
  // Some views can begin at a non-4-byte offset even when their total length is valid.
  const copy=new Uint8Array(bytes.byteLength);copy.set(bytes);
  return new Float32Array(copy.buffer);
}

/**
 * A member's Journal is their own wines plus the ones friends shared with them
 * (member_visible_wines), so Smart Search has to index both or a member whose
 * Journal is mostly shared bottles finds nothing. A shared bottle is embedded
 * under the recipient's account from what the recipient can see: the wine's
 * facts plus their own notes, score and tasting name - never the friend's
 * private notes. Its staleness follows whichever changed last, the source wine
 * or the recipient's own entry.
 */
const semanticSourceRows=`SELECT w.id,w.producer,w.wine_name,w.vintage,w.country,w.region,w.appellation,w.classification,w.grapes_json,w.wine_style,w.tasting_notes,w.rating,w.event,w.venue,w.tags_json,w.updated_at
    FROM wines w WHERE w.owner_id=?
    UNION ALL
    SELECT v.id,v.producer,v.wine_name,v.vintage,v.country,v.region,v.appellation,v.classification,v.grapes_json,v.wine_style,v.tasting_notes,v.rating,v.shared_tasting_name,v.venue,'[]',max(v.updated_at,coalesce(p.updated_at,''))
    FROM member_visible_wines v
    LEFT JOIN shared_wine_preferences p ON p.recipient_id=v.owner_id AND p.owner_id=v.source_owner_id AND p.wine_id=v.id
    WHERE v.owner_id=? AND v.is_shared=1`;

async function staleWineRows(db:D1Database,owner:string,config:EmbeddingConfig,limit:number){
  const result=await db.prepare(`SELECT s.*
    FROM (${semanticSourceRows}) s
    LEFT JOIN wine_semantic_embeddings e ON e.owner_id=? AND e.wine_id=s.id AND e.model_key=?
    WHERE e.wine_id IS NULL OR e.source_updated_at<>s.updated_at
    ORDER BY s.updated_at DESC,s.id DESC LIMIT ?`).bind(owner,owner,owner,config.modelKey,limit+1).all<SemanticWineRow>();
  return result.results;
}

async function semanticIndexRevision(db:D1Database,owner:string,config:EmbeddingConfig){
  const row=await db.prepare(`SELECT revision FROM wine_semantic_index_state WHERE owner_id=? AND model_key=?`)
    .bind(owner,config.modelKey).first<{revision:number}>();
  return Math.max(0,Number(row?.revision)||0);
}

async function cachedSemanticIds(db:D1Database,owner:string,config:EmbeddingConfig,queryKey:string,indexRevision:number,limit:number){
  if(!queryKey)return null;
  const cutoff=new Date(Date.now()-QUERY_CACHE_TTL_MS).toISOString();
  try{
    // Withdrawing a share or a friendship changes what a member can see without
    // touching the index revision, so a cached ranking could still name wines
    // that are gone - and the Journal, filtering them out, would show nothing.
    // Count those in the same read and treat any as a miss, so the query is
    // ranked again over the vectors that are still visible.
    const row=await db.prepare(`SELECT c.result_ids_json,c.max_results,
        (SELECT count(*) FROM json_each(c.result_ids_json) j
          WHERE NOT EXISTS (SELECT 1 FROM wines w WHERE w.owner_id=c.owner_id AND w.id=CAST(j.value AS TEXT))
            AND NOT EXISTS (SELECT 1 FROM member_visible_wines v WHERE v.owner_id=c.owner_id AND v.id=CAST(j.value AS TEXT) AND v.is_shared=1)) AS invisible
      FROM wine_semantic_query_cache c
      WHERE c.owner_id=? AND c.model_key=? AND c.query_key=? AND c.index_revision=? AND c.updated_at>=?`)
      .bind(owner,config.modelKey,queryKey,indexRevision,cutoff).first<SemanticQueryCacheRow>();
    if(!row||Number(row.max_results)<Math.max(1,limit)||Number(row.invisible)>0)return null;
    const ids=JSON.parse(row.result_ids_json);
    return Array.isArray(ids)&&ids.every(id=>typeof id==='string')?ids.slice(0,Math.max(1,limit)):null;
  }catch(error){
    console.warn(JSON.stringify({event:'semantic-query-cache-read-failed',error:(error as Error).message}));
    return null;
  }
}

async function cacheSemanticIds(env:SemanticEnv,owner:string,config:EmbeddingConfig,queryKey:string,indexRevision:number,ids:string[],limit:number){
  if(!queryKey)return;
  const stamp=new Date().toISOString(),cutoff=new Date(Date.now()-QUERY_CACHE_TTL_MS).toISOString(),maxResults=Math.max(1,limit);
  try{
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM wine_semantic_query_cache WHERE owner_id=? AND model_key=? AND (updated_at<? OR index_revision<?)`)
        .bind(owner,config.modelKey,cutoff,indexRevision),
      env.DB.prepare(`INSERT INTO wine_semantic_query_cache(owner_id,model_key,query_key,index_revision,max_results,result_ids_json,updated_at)
        VALUES(?,?,?,?,?,?,?)
        ON CONFLICT(owner_id,model_key,query_key) DO UPDATE SET
          index_revision=excluded.index_revision,
          max_results=excluded.max_results,
          result_ids_json=excluded.result_ids_json,
          updated_at=excluded.updated_at
        WHERE excluded.index_revision>=wine_semantic_query_cache.index_revision`)
        .bind(owner,config.modelKey,queryKey,indexRevision,maxResults,JSON.stringify(ids),stamp)
    ]);
  }catch(error){
    // Query caching is an optimization only. A cache write must never turn an
    // otherwise successful semantic search into an error/fallback.
    console.warn(JSON.stringify({event:'semantic-query-cache-write-failed',error:(error as Error).message}));
  }
}

async function refreshSemanticIndex(env:SemanticEnv,owner:string,config:EmbeddingConfig,limit:number,runId:string){
  // A current index needs no allowance/account reads. Check the live budget
  // immediately before each provider call, including the first batch.
  const pending=await staleWineRows(env.DB,owner,config,limit),rows=pending.slice(0,limit);
  let indexed=0,capped=false;
  for(let start=0;start<rows.length;start+=EMBED_BATCH){
    // Re-check before every provider request. Without this, a member sitting one
    // request below the ceiling could pass the initial guard and spend every
    // remaining batch in this refresh before the next request-level check.
    if(!await embeddingAllowed(env,owner)){capped=true;break}
    const chunk=rows.slice(start,start+EMBED_BATCH),vectors=await embedTexts(env,config,chunk.map(buildWineSemanticDocument),'document',{owner,runId,targetId:'journal-index'}),stamp=new Date().toISOString();
    const vectorStatements=chunk.map((row,index)=>env.DB.prepare(`INSERT INTO wine_semantic_embeddings(owner_id,wine_id,model_key,dimensions,source_updated_at,embedding,updated_at)
      VALUES(?,?,?,?,?,?,?)
      ON CONFLICT(owner_id,wine_id,model_key) DO UPDATE SET dimensions=excluded.dimensions,source_updated_at=excluded.source_updated_at,embedding=excluded.embedding,updated_at=excluded.updated_at`)
      .bind(owner,row.id,config.modelKey,config.dimensions,row.updated_at,vectorBlob(vectors[index]),stamp));
    const revisionStatement=env.DB.prepare(`INSERT INTO wine_semantic_index_state(owner_id,model_key,revision,updated_at)
      VALUES(?,?,1,?)
      ON CONFLICT(owner_id,model_key) DO UPDATE SET revision=wine_semantic_index_state.revision+1,updated_at=excluded.updated_at`)
      .bind(owner,config.modelKey,stamp);
    await env.DB.batch([...vectorStatements,revisionStatement]);
    indexed+=chunk.length;
  }
  return {indexed,hasMore:capped||pending.length>limit};
}

async function currentCandidates(db:D1Database,owner:string,config:EmbeddingConfig){
  const result=await db.prepare(`SELECT e.wine_id,e.embedding,e.dimensions
    FROM wine_semantic_embeddings e
    WHERE e.owner_id=? AND e.model_key=? AND e.dimensions=?
      AND (EXISTS (SELECT 1 FROM wines w WHERE w.owner_id=e.owner_id AND w.id=e.wine_id)
        OR EXISTS (SELECT 1 FROM member_visible_wines v WHERE v.owner_id=e.owner_id AND v.id=e.wine_id AND v.is_shared=1))`).bind(owner,config.modelKey,config.dimensions).all<StoredEmbeddingRow>();
  return result.results.map(row=>({id:row.wine_id,vector:decodeStoredEmbedding(row.embedding)}));
}

export async function semanticWineIds(env:SemanticEnv,owner:string,query:string,limit=72){
  const config=configFor(env);if(!config)return null;
  const queryKey=normalizeSemanticQuery(query),indexRevision=await semanticIndexRevision(env.DB,owner,config);
  const cached=await cachedSemanticIds(env.DB,owner,config,queryKey,indexRevision,limit);
  if(cached!==null)return {ids:cached,modelKey:config.modelKey};

  // Never hold the request open to build document vectors. On a cold index the
  // lexical route answers immediately while warmSemanticWineIndex runs through
  // waitUntil; once at least one candidate exists, only the query embedding is
  // awaited here. Ranked IDs are then cached against this exact index revision,
  // so returning from a wine detail page does not spend another embedding call.
  const candidates=await currentCandidates(env.DB,owner,config);
  if(!candidates.length)return {ids:[] as string[],modelKey:config.modelKey};
  // After the cache lookup above: a cached answer stays free when capped, and
  // returning null degrades this search to the lexical route rather than failing.
  if(!await embeddingAllowed(env,owner))return null;
  const runId=crypto.randomUUID();
  const [queryVector]=await embedTexts(env,config,[queryKey],'query',{owner,runId,targetId:'journal-query'});
  const ids=rankSemanticCandidates(queryVector,candidates,limit).map(item=>item.id);
  await cacheSemanticIds(env,owner,config,queryKey,indexRevision,ids,limit);
  return {ids,modelKey:config.modelKey};
}

export async function warmSemanticWineIndex(env:SemanticEnv,owner:string){
  const config=configFor(env);if(!config)return;
  const runId=crypto.randomUUID();
  let remaining=BACKGROUND_BACKFILL;
  while(remaining>0){
    const step=Math.min(WARM_SLICE,remaining),result=await refreshSemanticIndex(env,owner,config,step,runId);
    remaining-=result.indexed;
    if(!result.hasMore||result.indexed===0)break;
  }
}
