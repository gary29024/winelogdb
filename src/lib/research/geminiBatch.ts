export type GeminiBatchRequest={key:string;request:Record<string,unknown>};
export type GeminiInlineResponse={
  metadata?:{key?:string};
  response?:{candidates?:Array<{content?:{parts?:Array<{text?:string}>};groundingMetadata?:GroundingMetadata;finishReason?:string}>;usageMetadata?:Record<string,unknown>};
  error?:{message?:string};
};
export type GroundingMetadata={
  groundingChunks?:Array<{web?:{title?:string;uri?:string}}>;
  groundingSupports?:Array<{segment?:{startIndex?:number;endIndex?:number;text?:string};groundingChunkIndices?:number[]}>;
};

const BATCH_TERMINAL_STATES=new Set(['JOB_STATE_SUCCEEDED','JOB_STATE_FAILED','JOB_STATE_CANCELLED','JOB_STATE_EXPIRED']);
const PRIMARY_MODEL='gemini-3.7-flash';
const primaryBypassRequests=new Set<string>();

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

export function responsesByKey(responses:GeminiInlineResponse[]){
  return new Map(responses.map(response=>[response.metadata?.key,response] as const).filter((entry):entry is [string,GeminiInlineResponse]=>Boolean(entry[0])));
}

export async function createGeminiBatch(apiKey:string,model:string,displayName:string,entries:GeminiBatchRequest[]){
  if(!entries.length)throw new Error('Gemini Batch requires at least one request');
  if(consumePrimaryBypass(model,displayName))throw new Error('Gemini 3.7 Batch bypassed because the primary research model is temporarily in cooldown');
  const requests=entries.map(entry=>({request:entry.request,metadata:{key:entry.key}}));
  const body=JSON.stringify({batch:{display_name:displayName,input_config:{requests:{requests}}}});
  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:batchGenerateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},body});
  if(!response.ok)throw new Error(`Gemini Batch API create failed (${response.status}): ${(await response.text().catch(()=>'' )).slice(0,500)}`);
  const created=await response.json() as {name?:string;metadata?:{name?:string};response?:{name?:string}};
  const name=[created.name,created.metadata?.name,created.response?.name].find(value=>value?.startsWith('batches/'));
  if(!name)throw new Error('Gemini Batch API did not return a batch name');
  return name;
}

export async function fetchGeminiBatch(apiKey:string,googleBatchName:string){
  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/${googleBatchName}`,{headers:{'x-goog-api-key':apiKey}});
  if(!response.ok)return {ok:false as const,status:response.status,error:`Gemini batch status failed (${response.status}): ${(await response.text().catch(()=>'' )).slice(0,500)}`};
  const payload=await response.json() as Record<string,unknown>;
  return {ok:true as const,payload,state:normalizeBatchState(payload),responses:extractBatchResponses(payload)};
}
