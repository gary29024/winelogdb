import { postGeminiGenerateContent,type GeminiTransportBindings } from '../../../worker/geminiTransport';

export type GeminiBatchRequest={key:string;request:Record<string,unknown>};
export type GeminiInlineResponse={
  metadata?:{key?:string};
  response?:{candidates?:Array<{content?:{parts?:Array<{text?:string}>};groundingMetadata?:GroundingMetadata;finishReason?:string}>;usageMetadata?:Record<string,unknown>};
  error?:{message?:string;status?:number};
};
export type GroundingMetadata={
  groundingChunks?:Array<{web?:{title?:string;uri?:string}}>;
  groundingSupports?:Array<{segment?:{startIndex?:number;endIndex?:number;text?:string};groundingChunkIndices?:number[]}>;
  /** Every search the model actually ran. On Gemini 3 this is the billed unit. */
  webSearchQueries?:string[];
};

export type VertexFlexUsage={trafficType:string|null;flexConfirmed:boolean;promptTokens:number|null;outputTokens:number|null;totalTokens:number|null};

type GatewayRuntimeEnv=GeminiTransportBindings&{DB:D1Database};
type GatewayRuntime={kind:'ready';env:GatewayRuntimeEnv}|{kind:'incomplete';missing:string[]};
type StoredVertexBatch={id:string;model:string;display_name:string;requests_json:string;result_json:string|null;state:string;error:string|null;updated_at:string};
type FetchOptions={execute?:boolean};

const BATCH_TERMINAL_STATES=new Set(['JOB_STATE_SUCCEEDED','JOB_STATE_FAILED','JOB_STATE_CANCELLED','JOB_STATE_EXPIRED']);
const PRIMARY_MODEL='gemini-3.8-flash';
const EMULATED_PREFIX='vertex-batches/';
const EMULATED_TTL_MS=48*60*60*1000;
const RUNNING_STALE_MS=12*60*1000;
const REQUEST_TIMEOUT_MS=600_000;
const primaryBypassRequests=new Set<string>();
const gatewayRuntimeByApiKey=new Map<string,GatewayRuntime>();
const gatewayKeys=['CF_AI_GATEWAY_TOKEN','AI_GATEWAY_ACCOUNT_ID','AI_GATEWAY_ID','VERTEX_PROJECT_ID','VERTEX_REGION'] as const;
const credentialKey=(apiKey:unknown)=>String(apiKey??'');
const text=(value:unknown)=>typeof value==='string'?value.trim():'';
const now=()=>new Date().toISOString();
const parseJson=<T>(value:unknown,fallback:T):T=>{try{return JSON.parse(String(value)) as T}catch{return fallback}};
const finiteNumber=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?value:null;

export function configureGeminiBatchGateway(apiKey:unknown,env:GatewayRuntimeEnv){
  const key=credentialKey(apiKey),configured=gatewayKeys.filter(name=>Boolean(text(env[name])));
  if(configured.length===gatewayKeys.length){gatewayRuntimeByApiKey.set(key,{kind:'ready',env});return 'ready' as const}
  if(configured.length){gatewayRuntimeByApiKey.set(key,{kind:'incomplete',missing:gatewayKeys.filter(name=>!text(env[name]))});return 'incomplete' as const}
  gatewayRuntimeByApiKey.delete(key);return 'none' as const;
}

export function clearGeminiBatchGateway(apiKey:unknown){gatewayRuntimeByApiKey.delete(credentialKey(apiKey))}
export function isEmulatedGeminiBatchName(name:string){return name.startsWith(EMULATED_PREFIX)&&/^[A-Za-z0-9-]+$/.test(name.slice(EMULATED_PREFIX.length))}

export function bypassPrimaryGeminiBatchOnce(requestId:string){
  if(requestId)primaryBypassRequests.add(requestId);
}

export function clearPrimaryGeminiBatchBypass(requestId:string){
  primaryBypassRequests.delete(requestId);
}

function consumePrimaryBypass(model:string,displayName:string){
  if(model!==PRIMARY_MODEL)return false;
  for(const requestId of primaryBypassRequests){
    if(!displayName.includes(requestId))continue;
    primaryBypassRequests.delete(requestId);
    return true;
  }
  return false;
}

export function normalizeBatchState(payload:Record<string,unknown>){
  const raw=String(payload.state??(payload.metadata as Record<string,unknown>|undefined)?.state??'');
  return raw.startsWith('BATCH_STATE_')?`JOB_STATE_${raw.slice('BATCH_STATE_'.length)}`:raw;
}

function unwrapInlineResponses(value:unknown):GeminiInlineResponse[]{
  if(Array.isArray(value))return value as GeminiInlineResponse[];
  if(value&&typeof value==='object'&&Array.isArray((value as {inlinedResponses?:unknown}).inlinedResponses))return (value as {inlinedResponses:GeminiInlineResponse[]}).inlinedResponses;
  return [];
}

export function extractBatchResponses(payload:Record<string,unknown>):GeminiInlineResponse[]{
  const direct=unwrapInlineResponses((payload.dest as {inlinedResponses?:unknown}|undefined)?.inlinedResponses);if(direct.length)return direct;
  const operation=payload.response as {inlinedResponses?:unknown;dest?:{inlinedResponses?:unknown}}|undefined;
  const responseDirect=unwrapInlineResponses(operation?.inlinedResponses);if(responseDirect.length)return responseDirect;
  return unwrapInlineResponses(operation?.dest?.inlinedResponses);
}

export function isTerminalBatchState(state:string){return BATCH_TERMINAL_STATES.has(state)}
export function inlineResponseText(response:GeminiInlineResponse){return response.response?.candidates?.[0]?.content?.parts?.map(part=>part.text??'').join('')??''}
export function inlineFinishReason(response:GeminiInlineResponse){return response.response?.candidates?.[0]?.finishReason??null}
export function inlineGroundingMetadata(response:GeminiInlineResponse){return response.response?.candidates?.[0]?.groundingMetadata}

/**
 * How many Google searches a completed batch ran.
 *
 * Grounding on Gemini 3 is billed per search, not per request, so this is the
 * number that matters for cost - and it is only knowable from the response.
 */
export function countSearchQueries(responses:GeminiInlineResponse[]){
  return responses.reduce((total,response)=>total+(inlineGroundingMetadata(response)?.webSearchQueries?.length??0),0);
}

/** Tokens billed across a batch's responses, for the usage ledger. */
export function countUsageTokens(responses:GeminiInlineResponse[]){
  return responses.reduce((total,response)=>{
    const usage=vertexFlexUsage(response.response);
    return {promptTokens:total.promptTokens+(usage.promptTokens??0),outputTokens:total.outputTokens+(usage.outputTokens??0)};
  },{promptTokens:0,outputTokens:0});
}

export function responsesByKey(responses:GeminiInlineResponse[]){
  return new Map(responses.map(response=>[response.metadata?.key,response] as const).filter((entry):entry is [string,GeminiInlineResponse]=>Boolean(entry[0])));
}

export function vertexFlexUsage(response:GeminiInlineResponse['response']):VertexFlexUsage{
  const usage=response?.usageMetadata??{},trafficType=typeof usage.trafficType==='string'?usage.trafficType:null;
  // Thinking tokens bill at the output rate but are reported apart from the
  // answer, so the two are added. Null still means "not reported" rather than
  // zero, which is why this is not a plain sum.
  const answer=finiteNumber(usage.candidatesTokenCount),thinking=finiteNumber(usage.thoughtsTokenCount);
  return {
    trafficType,
    flexConfirmed:trafficType==='ON_DEMAND_FLEX',
    promptTokens:finiteNumber(usage.promptTokenCount),
    outputTokens:answer===null&&thinking===null?null:(answer??0)+(thinking??0),
    totalTokens:finiteNumber(usage.totalTokenCount)
  };
}

export function normalizeVertexGenerateContentRequest(request:Record<string,unknown>){
  const normalized=parseJson<Record<string,unknown>>(JSON.stringify(request),{}),tools=normalized.tools;
  if(Array.isArray(tools))normalized.tools=tools.map(tool=>{
    if(!tool||typeof tool!=='object')return tool;
    const record={...(tool as Record<string,unknown>)};
    if('google_search' in record&&!('googleSearch' in record)){record.googleSearch=record.google_search;delete record.google_search}
    if('google_search_retrieval' in record&&!('googleSearchRetrieval' in record)){record.googleSearchRetrieval=record.google_search_retrieval;delete record.google_search_retrieval}
    return record;
  });
  return normalized;
}

function gatewayRuntime(apiKey:unknown){
  const runtime=gatewayRuntimeByApiKey.get(credentialKey(apiKey));
  if(runtime?.kind==='incomplete')throw new Error(`AI Gateway configuration is incomplete: missing ${runtime.missing.join(', ')}`);
  return runtime?.kind==='ready'?runtime.env:null;
}

function featureMetadata(displayName:string,key:string){
  if(displayName.startsWith('winelog-producer-'))return {feature:'research',mode:'producer',batch_key:key};
  if(displayName.startsWith('winelog-wine-'))return {feature:'research',mode:'wine',batch_key:key};
  return {feature:'batch',mode:'queued',batch_key:key};
}

/**
 * How many entries of a queued Vertex batch run at once.
 *
 * Six is the platform ceiling rather than a guess: a Worker may hold many
 * connections open, but only six may sit in the initial "waiting for headers"
 * phase, and a seventh queues until one of those gets its headers back. A
 * grounded research call spends nearly all of its life in that phase, so asking
 * for more than six would queue inside the runtime and only make this number
 * lie about what is happening.
 *
 * It also covers a producer research run in one wave: that submits the profile
 * plus five alphabetical catalogue slices, six entries, which at the previous
 * limit of three took two waves and about twice the wall time for no reason. A
 * seventh slice would silently cost a second wave again, so the relationship
 * between the slice count and this number is pinned by a test.
 */
export const VERTEX_BATCH_CONCURRENCY=6;

/** Exported for the concurrency test; not part of the batch surface. */
export async function mapLimit<T,R>(items:T[],limit:number,fn:(item:T,index:number)=>Promise<R>){
  const output=new Array<R>(items.length);let cursor=0;
  const workers=Array.from({length:Math.min(Math.max(1,limit),items.length)},async()=>{while(true){const index=cursor++;if(index>=items.length)return;output[index]=await fn(items[index],index)}});
  await Promise.all(workers);return output;
}

async function executeVertexEntry(env:GatewayRuntimeEnv,model:string,displayName:string,entry:GeminiBatchRequest):Promise<GeminiInlineResponse>{
  const body=JSON.stringify(normalizeVertexGenerateContentRequest(entry.request));
  let lastError='Vertex request failed',lastStatus=0;
  for(let attempt=1;attempt<=2;attempt++){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
    try{
      const metadata=featureMetadata(displayName,entry.key);
      const {response}=await postGeminiGenerateContent(env,model,body,controller.signal,{...metadata,attempt,tier:'flex'},{serviceTier:'flex',serverTimeoutSeconds:600});
      clearTimeout(timer);
      if(response.ok){
        const payload=await response.json() as GeminiInlineResponse['response'],usage=vertexFlexUsage(payload);
        console.log(JSON.stringify({event:'vertex-flex-usage',model,...metadata,attempt,...usage}));
        return {metadata:{key:entry.key},response:payload};
      }
      lastStatus=response.status;lastError=(await response.text().catch(()=>'' )).replace(/\s+/g,' ').trim().slice(0,700)||`HTTP ${response.status}`;
      if(attempt===1&&(response.status===429||response.status>=500)){await new Promise(resolve=>setTimeout(resolve,900));continue}
      return {metadata:{key:entry.key},error:{message:lastError,status:lastStatus}};
    }catch(e){
      clearTimeout(timer);lastError=controller.signal.aborted?`Vertex Flex request timed out after ${REQUEST_TIMEOUT_MS/60000} minutes`:(e as Error).message||'Vertex Flex request failed';
      if(attempt===1){await new Promise(resolve=>setTimeout(resolve,900));continue}
      return {metadata:{key:entry.key},error:{message:lastError,status:lastStatus||0}};
    }
  }
  return {metadata:{key:entry.key},error:{message:lastError,status:lastStatus}};
}

async function storedVertexBatch(db:D1Database,name:string){
  const id=name.slice(EMULATED_PREFIX.length);
  return db.prepare('SELECT id,model,display_name,requests_json,result_json,state,error,updated_at FROM vertex_batch_emulation_jobs WHERE id=?').bind(id).first<StoredVertexBatch>();
}

function storedPayload(row:StoredVertexBatch){
  const payload=parseJson<Record<string,unknown>>(row.result_json,{state:row.state,error:row.error?{message:row.error}:undefined});
  if(!payload.state)payload.state=row.state;return payload;
}

async function executeStoredVertexBatch(env:GatewayRuntimeEnv,name:string,row:StoredVertexBatch){
  const db=env.DB,id=row.id,stamp=now();
  if(row.state==='JOB_STATE_RUNNING'&&Date.now()-Date.parse(row.updated_at||stamp)>RUNNING_STALE_MS){
    await db.prepare("UPDATE vertex_batch_emulation_jobs SET state='JOB_STATE_PENDING',updated_at=? WHERE id=? AND state='JOB_STATE_RUNNING'").bind(stamp,id).run();row.state='JOB_STATE_PENDING';
  }
  if(row.state!=='JOB_STATE_PENDING')return row;
  const claimed=await db.prepare("UPDATE vertex_batch_emulation_jobs SET state='JOB_STATE_RUNNING',updated_at=? WHERE id=? AND state='JOB_STATE_PENDING'").bind(stamp,id).run();
  if(Number(claimed.meta.changes||0)===0)return (await storedVertexBatch(db,name))??row;
  try{
    const entries=parseJson<GeminiBatchRequest[]>(row.requests_json,[]);
    if(!entries.length)throw new Error('Queued Vertex batch has no requests');
    const responses=await mapLimit(entries,VERTEX_BATCH_CONCURRENCY,(entry)=>executeVertexEntry(env,row.model,row.display_name,entry));
    const result={state:'JOB_STATE_SUCCEEDED',dest:{inlinedResponses:responses},completedAt:now()};
    await db.prepare("UPDATE vertex_batch_emulation_jobs SET state='JOB_STATE_SUCCEEDED',requests_json='[]',result_json=?,error=NULL,updated_at=? WHERE id=? AND state='JOB_STATE_RUNNING'").bind(JSON.stringify(result),now(),id).run();
  }catch(e){
    const error=(e as Error).message||'Queued Vertex Flex batch failed',result={state:'JOB_STATE_FAILED',error:{message:error}};
    await db.prepare("UPDATE vertex_batch_emulation_jobs SET state='JOB_STATE_FAILED',requests_json='[]',result_json=?,error=?,updated_at=? WHERE id=? AND state='JOB_STATE_RUNNING'").bind(JSON.stringify(result),error,now(),id).run();
  }
  return (await storedVertexBatch(db,name))??row;
}

/**
 * apiKey is a credential handle, not necessarily a credential. On a
 * gateway-only deployment it is undefined, and credentialKey reads that as ''
 * - the same '' configureGeminiBatchGateway registered the gateway runtime
 * under, so the request still goes out through AI Gateway.
 */
export async function createGeminiBatch(apiKey:string|undefined,model:string,displayName:string,entries:GeminiBatchRequest[]){
  if(!entries.length)throw new Error('Gemini Batch requires at least one request');
  if(consumePrimaryBypass(model,displayName))throw new Error('Gemini 3.8 Batch bypassed because the primary research model is temporarily in cooldown');
  const runtime=gatewayRuntime(apiKey);
  if(runtime){
    const id=crypto.randomUUID(),stamp=now(),expiresAt=new Date(Date.now()+EMULATED_TTL_MS).toISOString();
    await runtime.DB.prepare('DELETE FROM vertex_batch_emulation_jobs WHERE expires_at<?').bind(stamp).run().catch(()=>undefined);
    await runtime.DB.prepare(`INSERT INTO vertex_batch_emulation_jobs(id,model,display_name,requests_json,result_json,state,error,created_at,updated_at,expires_at)
      VALUES(?,?,?,?,NULL,'JOB_STATE_PENDING',NULL,?,?,?)`).bind(id,model,displayName,JSON.stringify(entries),stamp,stamp,expiresAt).run();
    return `${EMULATED_PREFIX}${id}`;
  }
  const developerKey=text(apiKey);
  if(!developerKey)throw new Error('No Gemini batch transport is configured');
  const requests=entries.map(entry=>({request:entry.request,metadata:{key:entry.key}}));
  const body=JSON.stringify({batch:{display_name:displayName,input_config:{requests:{requests}}}});
  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:batchGenerateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':developerKey},body});
  if(!response.ok)throw new Error(`Gemini Batch API create failed (${response.status}): ${(await response.text().catch(()=>'' )).slice(0,500)}`);
  const created=await response.json() as {name?:string;metadata?:{name?:string};response?:{name?:string}};
  const name=[created.name,created.metadata?.name,created.response?.name].find(value=>value?.startsWith('batches/'));
  if(!name)throw new Error('Gemini Batch API did not return a batch name');
  return name;
}

export async function fetchGeminiBatch(apiKey:string|undefined,googleBatchName:string,options:FetchOptions={}){
  if(isEmulatedGeminiBatchName(googleBatchName)){
    const runtime=gatewayRuntime(apiKey);if(!runtime)return {ok:false as const,status:503,error:'AI Gateway runtime is unavailable for this queued Vertex batch'};
    let row=await storedVertexBatch(runtime.DB,googleBatchName);if(!row)return {ok:false as const,status:404,error:'Queued Vertex batch not found'};
    if(options.execute!==false&&!isTerminalBatchState(row.state))row=await executeStoredVertexBatch(runtime,googleBatchName,row);
    const payload=storedPayload(row);return {ok:true as const,payload,state:normalizeBatchState(payload),responses:extractBatchResponses(payload)};
  }
  const developerKey=text(apiKey);
  if(!developerKey)return {ok:false as const,status:503,error:'Gemini batch status needs GEMINI_API_KEY when AI Gateway is not configured'};
  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/${googleBatchName}`,{headers:{'x-goog-api-key':developerKey}});
  if(!response.ok)return {ok:false as const,status:response.status,error:`Gemini batch status failed (${response.status}): ${(await response.text().catch(()=>'' )).slice(0,500)}`};
  const payload=await response.json() as Record<string,unknown>;
  return {ok:true as const,payload,state:normalizeBatchState(payload),responses:extractBatchResponses(payload)};
}

export async function cancelEmulatedGeminiBatch(apiKey:string|undefined,name:string){
  if(!isEmulatedGeminiBatchName(name))return {name,ok:false as const,status:400,error:'Not a queued Vertex batch'};
  const runtime=gatewayRuntime(apiKey);if(!runtime)return {name,ok:false as const,status:503,error:'AI Gateway runtime is unavailable for this queued Vertex batch'};
  const id=name.slice(EMULATED_PREFIX.length),stamp=now(),result={state:'JOB_STATE_CANCELLED',error:{message:'Cancelled by user'}};
  const existing=await runtime.DB.prepare('SELECT state FROM vertex_batch_emulation_jobs WHERE id=?').bind(id).first<{state:string}>();
  if(!existing)return {name,ok:false as const,status:404,error:'Queued Vertex batch not found'};
  if(!isTerminalBatchState(existing.state))await runtime.DB.prepare("UPDATE vertex_batch_emulation_jobs SET state='JOB_STATE_CANCELLED',requests_json='[]',result_json=?,error=?,updated_at=? WHERE id=? AND state IN ('JOB_STATE_PENDING','JOB_STATE_RUNNING')").bind(JSON.stringify(result),'Cancelled by user',stamp,id).run();
  return {name,ok:true as const,status:200};
}
/**
 * Google Search grounding and controlled generation cannot be used together.
 * A request that declares the search tool *and* sets responseMimeType with a
 * responseSchema is asking for two things the API will not do at once, and what
 * comes back is a well-formed JSON answer with the grounding silently dropped -
 * which the research gate then rejects, having no sources to verify against.
 *
 * Grounded requests therefore ask for JSON in the prompt instead. The schema
 * stays the single definition of the contract and is rendered into the prompt
 * from here, so the two cannot drift apart.
 */
export function groundedGenerationConfig(maxOutputTokens:number){return {maxOutputTokens}}

type SchemaNode={type?:string;properties?:Record<string,SchemaNode>;items?:SchemaNode;required?:string[];enum?:string[];nullable?:boolean};

function describeSchemaNode(node:SchemaNode,indent:string,required:boolean):string[]{
  const type=String(node.type??'STRING').toUpperCase();
  if(type==='OBJECT'&&node.properties){
    const requiredFields=new Set(node.required??[]);
    return Object.entries(node.properties).flatMap(([name,child])=>{
      const childType=String(child.type??'STRING').toUpperCase();
      const suffix=child.enum?.length?` (one of: ${child.enum.join(', ')})`:child.nullable?' (or null)':'';
      const head=`${indent}- ${name}: ${childType.toLowerCase()}${suffix}${requiredFields.has(name)?'':' (optional)'}`;
      return childType==='OBJECT'||childType==='ARRAY'?[head,...describeSchemaNode(child,`${indent}  `,requiredFields.has(name))]:[head];
    });
  }
  if(type==='ARRAY'&&node.items)return describeSchemaNode(node.items,indent,required);
  return [];
}

/** The response contract as prompt text, rendered from the schema itself. */
export function describeResponseSchema(schema:Record<string,unknown>){
  const lines=describeSchemaNode(schema as SchemaNode,'',true);
  return lines.length?`Return one JSON object and nothing else: no prose before or after it, and no Markdown code fence. Fields:\n${lines.join('\n')}`:'';
}
