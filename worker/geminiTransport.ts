export type GeminiTransportBindings={
  GEMINI_API_KEY?:string;
  CF_AI_GATEWAY_TOKEN?:string;
  AI_GATEWAY_ACCOUNT_ID?:string;
  AI_GATEWAY_ID?:string;
  VERTEX_PROJECT_ID?:string;
  VERTEX_REGION?:string;
};

export type GeminiTransportProvider='vertex-ai-gateway'|'gemini-developer-api';
type MetadataValue=string|number|boolean;

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
  metadata?:Record<string,MetadataValue>
):Promise<{response:Response;provider:GeminiTransportProvider}>{
  const provider=resolveGeminiTransport(env);
  if(provider==='vertex-ai-gateway'){
    const headers=new Headers({
      'Content-Type':'application/json',
      'cf-aig-authorization':`Bearer ${text(env.CF_AI_GATEWAY_TOKEN)}`,
      'cf-aig-collect-log-payload':'false'
    });
    const tagged=metadataHeader(metadata);if(tagged)headers.set('cf-aig-metadata',tagged);
    const response=await fetch(vertexGenerateContentUrl(env,model),{method:'POST',headers,body,signal});
    return {response,provider};
  }
  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
    method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':text(env.GEMINI_API_KEY)},body,signal
  });
  return {response,provider};
}
