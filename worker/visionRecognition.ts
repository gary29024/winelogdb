import { validateBatch } from '../src/features/uploads/validation';
import { selectRecognitionMetadata,type RecognitionPhotoMetadata } from '../src/lib/uploads/metadataSelection';
import { shouldRetryRecognitionFailure } from '../src/lib/recognition/retryPolicy';
import { RECOGNITION_ESCALATION_MODEL } from '../src/lib/recognition/escalation';
import { requireSession } from '../src/lib/auth/session';
import { postGeminiGenerateContent,type GeminiTransportBindings } from './geminiTransport';
import { recordAiUsage,type AiUsageKind,type AnalyticsSink } from '../src/lib/usage/aiUsage';

/**
 * One photograph in, several wines out.
 *
 * Group Photo and Tasting Sheet are the same request twice: an image, a strict
 * JSON schema, a two-attempt retry, a schema-free fallback when Gemini rejects
 * the schema with a 400, an escalation to the stronger model when the result
 * looks thin, and per-call metering that must count the wines once however many
 * calls it took. Only the prompt, the schema, the parse and the usage kind
 * differ - so those are the spec, and everything else lives here once.
 *
 * The alternative was a second copy of a hundred lines of retry and metering,
 * which would have drifted the first time either mode was touched.
 */
export type RecognitionModeSpec<T>={
  /** How this mode is metered, and how its log events and transport metadata are named. */
  kind:AiUsageKind;
  mode:string;
  /** Sentence-case, for the messages a person reads: "Group recognition failed". */
  label:string;
  model:string;
  maxBytes:number;
  maxOutputTokens:number;
  oneFileError:string;
  /**
   * `afterLine` is the continuation hook: a page whose output was cut short is
   * asked again for the wines printed after the last line it managed. Group
   * Photo has no lines and simply ignores it.
   */
  prompt(context:string,afterLine:number|null):string;
  jsonSchema:unknown;
  parse(text:string):T;
  escalationReasons(result:T):string[];
  /** Wines covered, which is both the metered unit and how an escalation is judged. */
  wineCount(result:T):number;
  /**
   * Anything else worth having in the log line for this mode - the group photo's
   * count of bottles it gave up on, the sheet's truncation flag. Diagnostics
   * only; nothing reads these back.
   */
  logFields?(result:T):Record<string,unknown>;
};

const prefixed=(prefix:string,fields:Record<string,unknown>)=>
  Object.fromEntries(Object.entries(fields).map(([key,value])=>[`${prefix}${key[0].toUpperCase()}${key.slice(1)}`,value]));

export type VisionBindings=GeminiTransportBindings&{AUTH_SECRET:string;DB:D1Database;AI_USAGE?:AnalyticsSink};

type GeminiResponse={
  candidates?:Array<{content?:{parts?:Array<{text?:string}>};finishReason?:string}>;
  usageMetadata?:{promptTokenCount?:number;candidatesTokenCount?:number;totalTokenCount?:number};
  error?:{message?:string};
};

/** What this call billed, so the primary and any escalation are metered apart. */
const usageOf=(payload:GeminiResponse)=>({promptTokens:payload.usageMetadata?.promptTokenCount??0,outputTokens:payload.usageMetadata?.candidatesTokenCount??0});
const HARD_TIMEOUT_MS=60_000;
const parseJson=<V>(value:unknown,fallback:V):V=>{try{return JSON.parse(String(value)) as V}catch{return fallback}};

async function fileToBase64(file:File){const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(binary)}
export function recognitionJson(body:unknown,status=200,requestId?:string){
  const headers=new Headers({'Content-Type':'application/json; charset=UTF-8','Cache-Control':'no-store'});
  if(requestId)headers.set('X-WineLog-Request-Id',requestId);
  return new Response(JSON.stringify(body),{status,headers});
}

function geminiErrorMessage(raw:string,status:number){
  try{
    const parsed=JSON.parse(raw) as {error?:{message?:unknown;status?:unknown}};
    const message=typeof parsed.error?.message==='string'?parsed.error.message.trim():'';
    const providerStatus=typeof parsed.error?.status==='string'?parsed.error.status.trim():'';
    if(message)return `${providerStatus?`${providerStatus}: `:''}${message}`.replace(/\s+/g,' ').slice(0,700);
  }catch{/* plain-text provider error */}
  const cleaned=raw.replace(/\s+/g,' ').trim();
  return cleaned.slice(0,700)||`HTTP ${status}`;
}

async function tryEscalated<T>(env:VisionBindings,spec:RecognitionModeSpec<T>,requestId:string,requestBody:string,schemaFreeBody:string,primary:T,reasons:string[]){
  const startedAt=Date.now(),controller=new AbortController();let timedOut=false,schemaFallback=false;const timer=setTimeout(()=>{timedOut=true;controller.abort()},HARD_TIMEOUT_MS);
  console.log(JSON.stringify({event:`${spec.mode}-recognition-escalation-start`,requestId,fromModel:spec.model,toModel:RECOGNITION_ESCALATION_MODEL,reasons,primaryWines:spec.wineCount(primary),...prefixed('primary',spec.logFields?.(primary)??{})}));
  try{
    let transport=await postGeminiGenerateContent(env,RECOGNITION_ESCALATION_MODEL,requestBody,controller.signal,{feature:'recognition',mode:`${spec.mode}-escalation`,requestId}),response=transport.response,provider=transport.provider;
    if(response.status===400){
      const raw=(await response.text()).slice(0,2000);
      schemaFallback=true;
      console.warn(JSON.stringify({event:`${spec.mode}-recognition-escalation-schema-fallback`,requestId,model:RECOGNITION_ESCALATION_MODEL,provider,status:400,reasons,error:geminiErrorMessage(raw,400)}));
      transport=await postGeminiGenerateContent(env,RECOGNITION_ESCALATION_MODEL,schemaFreeBody,controller.signal,{feature:'recognition',mode:`${spec.mode}-escalation-fallback`,requestId});response=transport.response;provider=transport.provider;
    }
    clearTimeout(timer);
    if(!response.ok){const raw=(await response.text()).slice(0,2000);console.warn(JSON.stringify({event:`${spec.mode}-recognition-escalation-skipped`,requestId,model:RECOGNITION_ESCALATION_MODEL,provider,status:response.status,reasons,error:geminiErrorMessage(raw,response.status)}));return {result:primary,used:false,usage:null,finishReason:null}}
    const payload=await response.json() as GeminiResponse,candidate=payload.candidates?.[0],text=candidate?.content?.parts?.map(part=>part.text??'').join('')??'';
    if(!text)throw new Error(`Gemini 3.7 returned no ${spec.mode} recognition result`);
    const escalated=spec.parse(text),used=spec.wineCount(escalated)>0||spec.wineCount(primary)===0,result=used?escalated:primary;
    console.log(JSON.stringify({event:`${spec.mode}-recognition-escalation-complete`,requestId,model:RECOGNITION_ESCALATION_MODEL,provider,reasons,used,schemaFallback,primaryWines:spec.wineCount(primary),escalatedWines:spec.wineCount(escalated),...prefixed('primary',spec.logFields?.(primary)??{}),...prefixed('escalated',spec.logFields?.(escalated)??{}),latencyMs:Date.now()-startedAt,finishReason:candidate?.finishReason??null,promptTokens:payload.usageMetadata?.promptTokenCount??null,outputTokens:payload.usageMetadata?.candidatesTokenCount??null,totalTokens:payload.usageMetadata?.totalTokenCount??null}));
    return {result,used,usage:usageOf(payload),finishReason:used?candidate?.finishReason??null:null};
  }catch(e){clearTimeout(timer);console.warn(JSON.stringify({event:`${spec.mode}-recognition-escalation-skipped`,requestId,model:RECOGNITION_ESCALATION_MODEL,reasons,timedOut,schemaFallback,latencyMs:Date.now()-startedAt,error:(e as Error).message||'Escalation failed'}));return {result:primary,used:false,usage:null,finishReason:null}}
}

export type VisionOutcome<T>=
  |{ok:true;result:T;requestId:string;durationMs:number;finishReason:string|null;wineCount:number;owner:string}
  |{ok:false;response:Response};

/**
 * Runs one mode and hands back the parsed result rather than a Response, so a
 * caller that has more to say about it - the tasting sheet matches every row
 * against the evening's lineup before answering - does not have to unpick its
 * own JSON.
 */
export async function runVisionRecognition<T>(request:Request,env:VisionBindings,spec:RecognitionModeSpec<T>):Promise<VisionOutcome<T>>{
  const requestId=crypto.randomUUID(),startedAt=Date.now();
  const fail=(body:unknown,status:number)=>({ok:false as const,response:recognitionJson(body,status,requestId)});
  let owner:string;
  try{owner=(await requireSession(request.headers.get('Authorization')??undefined,env.AUTH_SECRET)).userId}catch{return fail({error:'Unauthorized',requestId},401)}
  let form:FormData;
  try{form=await request.formData()}catch(e){
    const message=(e as Error).message||`Could not read ${spec.mode} recognition request`;
    console.error(JSON.stringify({event:`${spec.mode}-recognition-form-error`,requestId,error:message,contentType:request.headers.get('Content-Type')}));
    return fail({error:`Could not read ${spec.mode} recognition request`,requestId},400);
  }
  const files=form.getAll('images').filter((x):x is File=>x instanceof File);
  try{validateBatch(files,{maxFiles:1,maxBytes:spec.maxBytes,minDimension:300,maxDimension:2000})}catch(e){
    const message=(e as Error).message;
    console.error(JSON.stringify({event:`${spec.mode}-recognition-validation-error`,requestId,error:message,files:files.map(file=>({name:file.name,type:file.type,size:file.size}))}));
    return fail({error:message,requestId},400);
  }
  if(files.length!==1){console.error(JSON.stringify({event:`${spec.mode}-recognition-file-count-error`,requestId,fileCount:files.length}));return fail({error:spec.oneFileError,requestId},400)}
  const file=files[0],metadata=parseJson<RecognitionPhotoMetadata[]>(form.get('metadata'),[]),selected=selectRecognitionMetadata(metadata);
  const rawAfterLine=Number(form.get('afterLine')),afterLine=Number.isFinite(rawAfterLine)&&rawAfterLine>0?Math.floor(rawAfterLine):null;
  const context=[selected.capturedAt?`Photo timestamp: ${selected.capturedAt}.`:'No reliable photo timestamp.',selected.latitude!=null&&selected.longitude!=null?`Exact EXIF GPS: ${selected.latitude}, ${selected.longitude}. You may infer one concise approximate place name, but never change the coordinates.`:'No reliable GPS metadata.'].join(' ');
  const prompt=spec.prompt(context,afterLine);
  const imagePart={inlineData:{data:await fileToBase64(file),mimeType:file.type}},contents=[{role:'user',parts:[{text:prompt},imagePart]}];
  const requestBody=JSON.stringify({contents,generationConfig:{responseMimeType:'application/json',responseJsonSchema:spec.jsonSchema,maxOutputTokens:spec.maxOutputTokens}});
  const schemaFreeBody=JSON.stringify({contents,generationConfig:{responseMimeType:'application/json',maxOutputTokens:spec.maxOutputTokens}});
  console.log(JSON.stringify({event:`${spec.mode}-recognition-start`,requestId,model:spec.model,inputBytes:file.size,inputType:file.type,inputName:file.name,outputMode:'json-schema',afterLine}));
  for(let attempt=1;attempt<=2;attempt++){
    const attemptStarted=Date.now(),controller=new AbortController();let timedOut=false;const timer=setTimeout(()=>{timedOut=true;controller.abort()},HARD_TIMEOUT_MS);
    try{
      let transport=await postGeminiGenerateContent(env,spec.model,requestBody,controller.signal,{feature:'recognition',mode:spec.mode,requestId}),response=transport.response,provider=transport.provider,schemaFallback=false,primaryError='';
      if(response.status===400){
        primaryError=(await response.text()).slice(0,2000);
        schemaFallback=true;
        console.warn(JSON.stringify({event:`${spec.mode}-recognition-schema-fallback`,requestId,model:spec.model,provider,attempt,error:geminiErrorMessage(primaryError,400)}));
        transport=await postGeminiGenerateContent(env,spec.model,schemaFreeBody,controller.signal,{feature:'recognition',mode:`${spec.mode}-schema-fallback`,requestId});response=transport.response;provider=transport.provider;
      }
      clearTimeout(timer);const geminiLatencyMs=Date.now()-attemptStarted;
      if(!response.ok){
        const errorText=(await response.text()).slice(0,2000),message=geminiErrorMessage(errorText,response.status);
        console.error(JSON.stringify({event:`${spec.mode}-recognition-upstream-error`,requestId,model:spec.model,provider,attempt,status:response.status,geminiLatencyMs,schemaFallback,primaryError:primaryError||undefined,error:errorText}));
        if(attempt===1&&shouldRetryRecognitionFailure({status:response.status,timedOut:false,networkError:false})){await new Promise(r=>setTimeout(r,700+Math.floor(Math.random()*500)));continue}
        return fail({error:`Gemini ${spec.mode} recognition failed (${response.status}): ${message}`,requestId},502);
      }
      const payload=await response.json() as GeminiResponse,candidate=payload.candidates?.[0],text=candidate?.content?.parts?.map(part=>part.text??'').join('')??'';
      if(!text)throw new Error(`Gemini returned no ${spec.mode} recognition result`);
      const primary=spec.parse(text),escalationReasons=spec.escalationReasons(primary);
      const escalation=escalationReasons.length?await tryEscalated(env,spec,requestId,requestBody,schemaFreeBody,primary,escalationReasons):{result:primary,used:false,usage:null,finishReason:null};
      const result=escalation.result,durationMs=Date.now()-startedAt,finalModel=escalation.used?RECOGNITION_ESCALATION_MODEL:spec.model;
      const wineCount=spec.wineCount(result);
      console.log(JSON.stringify({event:`${spec.mode}-recognition-complete`,requestId,model:finalModel,primaryModel:spec.model,escalated:escalation.used,escalationReasons,provider,attempt,geminiLatencyMs,durationMs,schemaFallback,wines:wineCount,...(spec.logFields?.(result)??{}),finishReason:candidate?.finishReason??null,promptTokens:payload.usageMetadata?.promptTokenCount??null,outputTokens:payload.usageMetadata?.candidatesTokenCount??null,totalTokens:payload.usageMetadata?.totalTokenCount??null}));
      // One photograph, however many wines were on it - which is exactly why
      // this cannot be quoted per run. The escalation is a second billed call
      // covering the same wines, so it carries zero units or they count twice.
      for(const [index,call] of [{model:spec.model,...usageOf(payload)},...(escalation.usage?[{model:RECOGNITION_ESCALATION_MODEL,...escalation.usage}]:[])].entries())
        await recordAiUsage(env,owner,{kind:spec.kind,runId:requestId,model:call.model,requests:1,units:index===0?wineCount:0,promptTokens:call.promptTokens,outputTokens:call.outputTokens});
      return {ok:true,result,requestId,durationMs,finishReason:escalation.used?escalation.finishReason:candidate?.finishReason??null,wineCount,owner};
    }catch(e){
      clearTimeout(timer);const geminiLatencyMs=Date.now()-attemptStarted;
      if(timedOut){console.error(JSON.stringify({event:`${spec.mode}-recognition-timeout`,requestId,attempt,geminiLatencyMs}));return fail({error:`${spec.label} timed out after 60 seconds. Please try again.`,requestId},504)}
      const message=(e as Error).message||`${spec.label} failed`;
      console.error(JSON.stringify({event:`${spec.mode}-recognition-error`,requestId,attempt,geminiLatencyMs,error:message}));
      if(attempt===1){await new Promise(r=>setTimeout(r,700+Math.floor(Math.random()*500)));continue}
      return fail({error:`${spec.label} returned invalid JSON: ${message}`,requestId},502);
    }
  }
  return fail({error:`${spec.label} failed`,requestId},502);
}

/** The plain wrapper: run the mode and answer with its result. */
export async function handleVisionRecognitionRequest<T>(request:Request,env:VisionBindings,spec:RecognitionModeSpec<T>){
  const outcome=await runVisionRecognition(request,env,spec);
  if(!outcome.ok)return outcome.response;
  return recognitionJson({...outcome.result,requestId:outcome.requestId,recognitionDurationMs:outcome.durationMs},200,outcome.requestId);
}
