import { recordAiUsage,type AiUsageEnv,type AiUsageKind } from '../usage/aiUsage';

export type SemanticEmbeddingBindings={
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
type StoredEmbeddingRow={wine_id:string;embedding:ArrayBuffer|ArrayBufferView;dimensions:number};
export type SemanticVectorCandidate={id:string;vector:ArrayLike<number>};
type MeterContext={owner:string;runId:string;targetId:'journal-query'|'journal-index'};

const WORKERS_MODEL='@cf/qwen/qwen3-embedding-0.6b';
const GEMINI_MODEL='gemini-embedding-001';
const WORKERS_DIMENSIONS=1024;
const GEMINI_DIMENSIONS=768;
const WARM_SLICE=64;
const BACKGROUND_BACKFILL=192;
const EMBED_BATCH=24;
const SEARCH_EMBEDDING_KIND='search_embedding' as AiUsageKind;

const jsonList=(value:unknown)=>{try{const parsed=JSON.parse(String(value));return Array.isArray(parsed)?parsed.map(String).filter(Boolean):[]}catch{return [] as string[]}};
const clamp=(value:number,min:number,max:number)=>Math.min(Math.max(value,min),max);

export function shouldUseSemanticQuery(query:string){
  const clean=query.trim();
  if(!clean||/^\d{4}$/.test(clean))return false;
  const cjk=(clean.match(/[\u3400-\u9fff\uf900-\ufaff]/gu)??[]).length;
  if(cjk>=4)return true;
  const words=clean.split(/\s+/u).filter(Boolean);
  return words.length>=3;
}

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

export function cosineSimilarity(a:ArrayLike<number>,b:ArrayLike<number>){
  if(!a.length||a.length!==b.length)return -1;
  let dot=0,na=0,nb=0;
  for(let i=0;i<a.length;i++){const av=Number(a[i]),bv=Number(b[i]);dot+=av*bv;na+=av*av;nb+=bv*bv}
  return na>0&&nb>0?dot/Math.sqrt(na*nb):-1;
}

function normalizedDot(a:ArrayLike<number>,b:ArrayLike<number>){
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
      const result=await (env.AI.run as (model:string,input:unknown)=>Promise<unknown>)(config.model,{text:texts});
      vectors=extractWorkersVectors(result);
    }else{
      const requests=texts.map(text=>({
        model:`models/${config.model}`,
        content:{parts:[{text}]},
        embedContentConfig:{taskType:kind==='query'?'RETRIEVAL_QUERY':'RETRIEVAL_DOCUMENT',outputDimensionality:config.dimensions,autoTruncate:true}
      }));
      attempted=true;
      const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:batchEmbedContents`,{
        method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':config.geminiKey??''},body:JSON.stringify({requests})
      });
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
    // Rejected or malformed AI answers can still consume quota. Meter every
    // provider attempt, not only responses that pass our validation. Neither
    // embedding response exposes exact billed tokens/neurons here, so the app
    // records calls + embeddings covered and the provider dashboard remains
    // authoritative for exact compute spend.
    if(attempted)await recordAiUsage(env,meter.owner,{kind:SEARCH_EMBEDDING_KIND,runId:meter.runId,targetId:meter.targetId,model:config.model,requests:1,units:texts.length});
  }
}

function vectorBlob(vector:number[]){return Float32Array.from(vector).buffer}
function vectorFromBlob(value:ArrayBuffer|ArrayBufferView){
  if(value instanceof ArrayBuffer)return new Float32Array(value);
  const copy=value.buffer.slice(value.byteOffset,value.byteOffset+value.byteLength);
  return new Float32Array(copy);
}

async function staleWineRows(db:D1Database,owner:string,config:EmbeddingConfig,limit:number){
  const result=await db.prepare(`SELECT w.id,w.producer,w.wine_name,w.vintage,w.country,w.region,w.appellation,w.classification,w.grapes_json,w.wine_style,w.tasting_notes,w.rating,w.event,w.venue,w.tags_json,w.updated_at
    FROM wines w
    LEFT JOIN wine_semantic_embeddings e ON e.owner_id=w.owner_id AND e.wine_id=w.id AND e.model_key=?
    WHERE w.owner_id=? AND (e.wine_id IS NULL OR e.source_updated_at<>w.updated_at)
    ORDER BY w.updated_at DESC,w.id DESC LIMIT ?`).bind(config.modelKey,owner,limit+1).all<SemanticWineRow>();
  return result.results;
}

async function refreshSemanticIndex(env:SemanticEnv,owner:string,config:EmbeddingConfig,limit:number,runId:string){
  const pending=await staleWineRows(env.DB,owner,config,limit),rows=pending.slice(0,limit);
  for(let start=0;start<rows.length;start+=EMBED_BATCH){
    const chunk=rows.slice(start,start+EMBED_BATCH),vectors=await embedTexts(env,config,chunk.map(buildWineSemanticDocument),'document',{owner,runId,targetId:'journal-index'}),stamp=new Date().toISOString();
    await env.DB.batch(chunk.map((row,index)=>env.DB.prepare(`INSERT INTO wine_semantic_embeddings(owner_id,wine_id,model_key,dimensions,source_updated_at,embedding,updated_at)
      VALUES(?,?,?,?,?,?,?)
      ON CONFLICT(owner_id,wine_id,model_key) DO UPDATE SET dimensions=excluded.dimensions,source_updated_at=excluded.source_updated_at,embedding=excluded.embedding,updated_at=excluded.updated_at`)
      .bind(owner,row.id,config.modelKey,config.dimensions,row.updated_at,vectorBlob(vectors[index]),stamp)));
  }
  return {indexed:rows.length,hasMore:pending.length>limit};
}

async function currentCandidates(db:D1Database,owner:string,config:EmbeddingConfig){
  const result=await db.prepare(`SELECT e.wine_id,e.embedding,e.dimensions
    FROM wine_semantic_embeddings e
    JOIN wines w ON w.owner_id=e.owner_id AND w.id=e.wine_id
    WHERE e.owner_id=? AND e.model_key=? AND e.dimensions=?`).bind(owner,config.modelKey,config.dimensions).all<StoredEmbeddingRow>();
  return result.results.map(row=>({id:row.wine_id,vector:vectorFromBlob(row.embedding)}));
}

export async function semanticWineIds(env:SemanticEnv,owner:string,query:string,limit=72){
  const config=configFor(env);if(!config)return null;
  // Never hold the request open to build document vectors. On a cold index the
  // lexical route answers immediately while warmSemanticWineIndex runs through
  // waitUntil; once at least one candidate exists, only the query embedding is
  // awaited here.
  const candidates=await currentCandidates(env.DB,owner,config);
  if(!candidates.length)return {ids:[] as string[],modelKey:config.modelKey};
  const runId=crypto.randomUUID();
  const [queryVector]=await embedTexts(env,config,[query],'query',{owner,runId,targetId:'journal-query'});
  return {ids:rankSemanticCandidates(queryVector,candidates,limit).map(item=>item.id),modelKey:config.modelKey};
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
