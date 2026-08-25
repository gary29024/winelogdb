export type GeminiTransportBindings={
  GEMINI_API_KEY?:string;
  CF_AI_GATEWAY_TOKEN?:string;
  AI_GATEWAY_ACCOUNT_ID?:string;
  AI_GATEWAY_ID?:string;
  VERTEX_PROJECT_ID?:string;
  VERTEX_REGION?:string;
  /** "true" asks AI Gateway to store request and response bodies. See collectLogPayload. */
  AI_GATEWAY_LOG_PAYLOADS?:string;
};

export type GeminiTransportProvider='vertex-ai-gateway'|'gemini-developer-api';
export type GeminiServiceTier='standard'|'flex';
type MetadataValue=string|number|boolean;
type RequestOptions={serviceTier?:GeminiServiceTier;serverTimeoutSeconds?:number};

const gatewayKeys=['CF_AI_GATEWAY_TOKEN','AI_GATEWAY_ACCOUNT_ID','AI_GATEWAY_ID','VERTEX_PROJECT_ID','VERTEX_REGION'] as const;
const text=(value:unknown)=>typeof value==='string'?value.trim():'';

export function resolveGeminiTransport(env:GeminiTransportBindings):GeminiTransportProvider{
  const configured=gatewayKeys.filter(key=>Boolean(text(env[key])));
  if(configured.length===gatewayKeys.length)return 'vertex-ai-gateway';
  if(configured.length>0){
    const missing=gatewayKeys.filter(key=>!text(env[key]));
    throw new Error(`AI Gateway configuration is incomplete: missing ${missing.join(', ')}`);
  }
  if(text(env.GEMINI_API_KEY))return 'gemini-developer-api';
  throw new Error('No Gemini transport is configured');
}

export function vertexGenerateContentUrl(env:GeminiTransportBindings,model:string){
  const account=text(env.AI_GATEWAY_ACCOUNT_ID),gateway=text(env.AI_GATEWAY_ID),project=text(env.VERTEX_PROJECT_ID),region=text(env.VERTEX_REGION);
  if(!account||!gateway||!project||!region)throw new Error('AI Gateway Vertex configuration is incomplete');
  return `https://gateway.ai.cloudflare.com/v1/${encodeURIComponent(account)}/${encodeURIComponent(gateway)}/google-vertex-ai/v1/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(region)}/publishers/google/models/${encodeURIComponent(model)}:generateContent`;
}

/**
 * Whether AI Gateway should store the request and response bodies.
 *
 * `cf-aig-collect-log-payload` is decided per request and overrides the
 * gateway's own setting, so while this is sent as "false" no dashboard toggle
 * can turn payload logging on. It stays off by default because the payloads are
 * whole research prompts and answers, which is both a lot of storage and a copy
 * of the owner's data sitting outside D1. Set AI_GATEWAY_LOG_PAYLOADS="true"
 * to collect them while diagnosing a specific failure, then set it back.
 *
 * Only the gateway transport is affected. Requests that go straight to
 * generativelanguage.googleapis.com never reach AI Gateway, so nothing about
 * them is logged there whatever this says.
 */
export function collectLogPayload(env:GeminiTransportBindings){
  return text(env.AI_GATEWAY_LOG_PAYLOADS).toLowerCase()==='true';
}

function metadataHeader(metadata?:Record<string,MetadataValue>){
  if(!metadata)return null;
  const entries=Object.entries(metadata).filter(([,value])=>['string','number','boolean'].includes(typeof value)).slice(0,5);
  return entries.length?JSON.stringify(Object.fromEntries(entries)):null;
}

export async function postGeminiGenerateContent(
  env:GeminiTransportBindings,
  model:string,
  body:string,
  signal:AbortSignal,
  metadata?:Record<string,MetadataValue>,
  options:RequestOptions={}
):Promise<{response:Response;provider:GeminiTransportProvider}>{
  const provider=resolveGeminiTransport(env);
  if(provider==='vertex-ai-gateway'){
    const headers=new Headers({
      'Content-Type':'application/json',
      'cf-aig-authorization':`Bearer ${text(env.CF_AI_GATEWAY_TOKEN)}`,
      'cf-aig-collect-log-payload':collectLogPayload(env)?'true':'false'
    });
    const tagged=metadataHeader(metadata);if(tagged)headers.set('cf-aig-metadata',tagged);
    if(options.serviceTier==='flex'){
      if(text(env.VERTEX_REGION)!=='global')throw new Error('Vertex Flex PayGo requires VERTEX_REGION=global');
      headers.set('X-Vertex-AI-LLM-Request-Type','shared');
      headers.set('X-Vertex-AI-LLM-Shared-Request-Type','flex');
      if(options.serverTimeoutSeconds)headers.set('X-Server-Timeout',String(Math.max(1,Math.floor(options.serverTimeoutSeconds))));
    }
    const response=await fetch(vertexGenerateContentUrl(env,model),{method:'POST',headers,body,signal});
    return {response,provider};
  }
  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
    method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':text(env.GEMINI_API_KEY)},body,signal
  });
  return {response,provider};
}
