import { validateBatch } from '../src/features/uploads/validation';
import { parseRecognition } from '../src/features/recognition/schema';
import { buildRecognitionPrompt,recognitionResponseJsonSchema,RECOGNITION_MODEL } from '../src/lib/recognition/geminiRequest';
import { preferEscalatedRecognition,recognitionEscalationReasons,RECOGNITION_ESCALATION_MODEL } from '../src/lib/recognition/escalation';
import type { RecognitionPhotoMetadata } from '../src/lib/uploads/metadataSelection';
import { shouldRetryRecognitionFailure } from '../src/lib/recognition/retryPolicy';
import { requireSession } from '../src/lib/auth/session';
import { handleGroupRecognitionRequest } from './groupRecognitionHandler';
import { postGeminiGenerateContent,type GeminiTransportBindings } from './geminiTransport';
import { recordAiUsage,type AnalyticsSink } from '../src/lib/usage/aiUsage';

type RecognitionBindings=GeminiTransportBindings&{AUTH_SECRET:string;MAX_BATCH_FILES?:string;DB:D1Database;AI_USAGE?:AnalyticsSink};
/** What this call billed, so the caller can meter the primary and any escalation separately. */
const usageOf=(payload:GeminiResponse)=>({promptTokens:payload.usageMetadata?.promptTokenCount??0,outputTokens:payload.usageMetadata?.candidatesTokenCount??0});
type GeminiResponse={
  candidates?:Array<{content?:{parts?:Array<{text?:string}>};finishReason?:string}>;
  usageMetadata?:{promptTokenCount?:number;candidatesTokenCount?:number;totalTokenCount?:number};
  error?:{message?:string;code?:number;status?:string};
};

const MODEL=RECOGNITION_MODEL;
const HARD_TIMEOUT_MS=60_000;
const parseJson=<T>(value:unknown,fallback:T):T=>{try{return JSON.parse(String(value)) as T}catch{return fallback}};

async function fileToBase64(file:File){
  const bytes=new Uint8Array(await file.arrayBuffer());let binary='';
  for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
  return btoa(binary);
}

function json(body:unknown,status=200,requestId?:string){
  const headers=new Headers({'Content-Type':'application/json; charset=UTF-8','Cache-Control':'no-store'});
  if(requestId)headers.set('X-WineLog-Request-Id',requestId);
  return new Response(JSON.stringify(body),{status,headers});
}

function geminiErrorMessage(raw:string,status:number){
  try{
    const parsed=JSON.parse(raw) as {error?:{message?:unknown;status?:unknown;code?:unknown}};
    const message=typeof parsed.error?.message==='string'?parsed.error.message.trim():'';
    const providerStatus=typeof parsed.error?.status==='string'?parsed.error.status.trim():'';
    if(message)return `${providerStatus?`${providerStatus}: `:''}${message}`.replace(/\s+/g,' ').slice(0,700);
  }catch{/* plain-text provider error */}
  const cleaned=raw.replace(/\s+/g,' ').trim();
  return cleaned.slice(0,700)||`HTTP ${status}`;
}

function looksLikeStructuredOutputRejection(raw:string){
  return /response.?schema|response.?json.?schema|response.?format|generation.?config|structured.?output|unknown (?:name|field)|schema/i.test(raw);
}

async function tryEscalatedRecognition(
  env:RecognitionBindings,
  requestId:string,
  requestBody:string,
  schemaFreeBody:string,
  primary:ReturnType<typeof parseRecognition>,
  reasons:string[]
){
  const startedAt=Date.now(),controller=new AbortController();let timedOut=false,schemaFallback=false;
  const timer=setTimeout(()=>{timedOut=true;controller.abort()},HARD_TIMEOUT_MS);
  console.log(JSON.stringify({event:'recognition-escalation-start',requestId,fromModel:MODEL,toModel:RECOGNITION_ESCALATION_MODEL,reasons,primaryConfidence:primary.confidence}));
  try{
    let transport=await postGeminiGenerateContent(env,RECOGNITION_ESCALATION_MODEL,requestBody,controller.signal,{feature:'recognition',mode:'single-escalation',requestId}),response=transport.response,provider=transport.provider;
    if(response.status===400){
      const raw=(await response.text()).slice(0,2000);
      if(looksLikeStructuredOutputRejection(raw)){
        schemaFallback=true;
        transport=await postGeminiGenerateContent(env,RECOGNITION_ESCALATION_MODEL,schemaFreeBody,controller.signal,{feature:'recognition',mode:'single-escalation-fallback',requestId});response=transport.response;provider=transport.provider;
      }else{
        clearTimeout(timer);console.warn(JSON.stringify({event:'recognition-escalation-skipped',requestId,model:RECOGNITION_ESCALATION_MODEL,provider,status:400,reasons,error:geminiErrorMessage(raw,400)}));return {result:primary,used:false,usage:null};
      }
    }
    clearTimeout(timer);
    if(!response.ok){const raw=(await response.text()).slice(0,2000);console.warn(JSON.stringify({event:'recognition-escalation-skipped',requestId,model:RECOGNITION_ESCALATION_MODEL,provider,status:response.status,reasons,error:geminiErrorMessage(raw,response.status)}));return {result:primary,used:false,usage:null}}
    const payload=await response.json() as GeminiResponse,candidate=payload.candidates?.[0],text=candidate?.content?.parts?.map(part=>part.text??'').join('')??'';
    if(!text)throw new Error('Gemini 3.7 returned no recognition result');
    const escalated=parseRecognition(text),result=preferEscalatedRecognition(primary,escalated),used=result===escalated;
    console.log(JSON.stringify({event:'recognition-escalation-complete',requestId,model:RECOGNITION_ESCALATION_MODEL,provider,reasons,used,schemaFallback,primaryConfidence:primary.confidence,escalatedConfidence:escalated.confidence,latencyMs:Date.now()-startedAt,finishReason:candidate?.finishReason??null,promptTokens:payload.usageMetadata?.promptTokenCount??null,outputTokens:payload.usageMetadata?.candidatesTokenCount??null,totalTokens:payload.usageMetadata?.totalTokenCount??null}));
    return {result,used,usage:usageOf(payload)};
  }catch(e){
    clearTimeout(timer);console.warn(JSON.stringify({event:'recognition-escalation-skipped',requestId,model:RECOGNITION_ESCALATION_MODEL,reasons,timedOut,latencyMs:Date.now()-startedAt,error:(e as Error).message||'Escalation failed'}));return {result:primary,used:false,usage:null};
  }
}

async function meterRecognition(env:RecognitionBindings,owner:string,requestId:string,calls:Array<{model:string;promptTokens:number;outputTokens:number}>){
  for(const call of calls)await recordAiUsage(env,owner,{kind:'scan_single',runId:requestId,model:call.model,requests:1,promptTokens:call.promptTokens,outputTokens:call.outputTokens});
}

export async function handleRecognitionRequest(request:Request,env:RecognitionBindings){
  if(request.headers.get('X-WineLog-Recognition-Mode')==='group')return handleGroupRecognitionRequest(request,env);
  const requestId=crypto.randomUUID(),startedAt=Date.now();
  let owner:string;
  try{owner=(await requireSession(request.headers.get('Authorization')??undefined,env.AUTH_SECRET)).userId}catch{return json({error:'Unauthorized',requestId},401,requestId)}

  let form:FormData;
  try{form=await request.formData()}catch{return json({error:'Could not read recognition request',requestId},400,requestId)}
  const files=form.getAll('images').filter((x):x is File=>x instanceof File);
  try{validateBatch(files,{maxFiles:Number(env.MAX_BATCH_FILES)||12,maxBytes:3*1024*1024,minDimension:300,maxDimension:2000})}catch(e){return json({error:(e as Error).message,requestId},400,requestId)}
  if(!files.length)return json({error:'Choose at least one wine photo',requestId},400,requestId);

  const metadata=parseJson<RecognitionPhotoMetadata[]>(form.get('metadata'),[]),{prompt,selected}=buildRecognitionPrompt(metadata);
  const imageParts=await Promise.all(files.map(async file=>({inlineData:{data:await fileToBase64(file),mimeType:file.type}})));
  const contents=[{role:'user',parts:[{text:prompt},...imageParts]}];
  const requestBody=JSON.stringify({contents,generationConfig:{responseMimeType:'application/json',responseJsonSchema:recognitionResponseJsonSchema}});
  const schemaFreeBody=JSON.stringify({contents,generationConfig:{responseMimeType:'application/json'}});
  const totalInputBytes=files.reduce((sum,file)=>sum+file.size,0);
  console.log(JSON.stringify({event:'recognition-start',requestId,model:MODEL,photoCount:files.length,inputBytes:totalInputBytes,schemaMode:'json-schema'}));

  for(let attempt=1;attempt<=2;attempt++){
    const attemptStarted=Date.now(),controller=new AbortController();let timedOut=false;
    const timer=setTimeout(()=>{timedOut=true;controller.abort()},HARD_TIMEOUT_MS);
    try{
      let transport=await postGeminiGenerateContent(env,MODEL,requestBody,controller.signal,{feature:'recognition',mode:'single',requestId}),response=transport.response,provider=transport.provider,schemaFallback=false,primaryError='';
      if(response.status===400){
        primaryError=(await response.text()).slice(0,2000);
        if(looksLikeStructuredOutputRejection(primaryError)){
          schemaFallback=true;
          console.warn(JSON.stringify({event:'recognition-schema-fallback',requestId,model:MODEL,provider,attempt,error:geminiErrorMessage(primaryError,400)}));
          transport=await postGeminiGenerateContent(env,MODEL,schemaFreeBody,controller.signal,{feature:'recognition',mode:'single-schema-fallback',requestId});response=transport.response;provider=transport.provider;
        }else{
          clearTimeout(timer);
          const geminiLatencyMs=Date.now()-attemptStarted,message=geminiErrorMessage(primaryError,400);
          console.error(JSON.stringify({event:'recognition-upstream-error',requestId,model:MODEL,provider,attempt,status:400,geminiLatencyMs,error:primaryError}));
          return json({error:`Gemini rejected the recognition request (400): ${message}`,requestId},502,requestId);
        }
      }
      clearTimeout(timer);
      const geminiLatencyMs=Date.now()-attemptStarted;
      if(!response.ok){
        const errorText=(await response.text()).slice(0,2000),message=geminiErrorMessage(errorText,response.status);
        console.error(JSON.stringify({event:'recognition-upstream-error',requestId,model:MODEL,provider,attempt,status:response.status,geminiLatencyMs,schemaFallback,primaryError:primaryError||undefined,error:errorText}));
        if(attempt===1&&shouldRetryRecognitionFailure({status:response.status,timedOut:false,networkError:false})){
          await new Promise(r=>setTimeout(r,700+Math.floor(Math.random()*500)));continue;
        }
        return json({error:`Gemini recognition failed (${response.status}): ${message}`,requestId},502,requestId);
      }
      const payload=await response.json() as GeminiResponse;
      const candidate=payload.candidates?.[0],text=candidate?.content?.parts?.map(part=>part.text??'').join('')??'';
      if(!text)throw new Error('Gemini returned no recognition result');
      const primary=parseRecognition(text),escalationReasons=recognitionEscalationReasons(primary,{schemaFallback});
      const escalation=escalationReasons.length?await tryEscalatedRecognition(env,requestId,requestBody,schemaFreeBody,primary,escalationReasons):{result:primary,used:false,usage:null};
      const result=escalation.result,finalModel=escalation.used?RECOGNITION_ESCALATION_MODEL:MODEL;
      const locationName=selected.gpsSource==='exif'&&result.locationName?.trim()?result.locationName.trim():null;
      const durationMs=Date.now()-startedAt;
      console.log(JSON.stringify({event:'recognition-complete',requestId,model:finalModel,primaryModel:MODEL,escalated:escalation.used,escalationReasons,provider,attempt,geminiLatencyMs,durationMs,schemaFallback,finishReason:candidate?.finishReason??null,promptTokens:payload.usageMetadata?.promptTokenCount??null,outputTokens:payload.usageMetadata?.candidatesTokenCount??null,totalTokens:payload.usageMetadata?.totalTokenCount??null}));
      // Metered per model: an escalation is a second billed call at a second
      // model's rate, and rolling them together would hide it.
      await meterRecognition(env,owner,requestId,[{model:MODEL,...usageOf(payload)},...(escalation.usage?[{model:RECOGNITION_ESCALATION_MODEL,...escalation.usage}]:[])]);
      return json({...result,locationName,tastingDate:selected.capturedAt?.slice(0,10)??null,latitude:selected.latitude,longitude:selected.longitude,metadataSource:selected.gpsSource==='exif'?'exif':selected.timestampSource,requestId,recognitionDurationMs:durationMs},200,requestId);
    }catch(e){
      clearTimeout(timer);
      const geminiLatencyMs=Date.now()-attemptStarted;
      if(timedOut){
        console.error(JSON.stringify({event:'recognition-timeout',requestId,model:MODEL,attempt,geminiLatencyMs,hardTimeoutMs:HARD_TIMEOUT_MS}));
        return json({error:'Recognition timed out after 60 seconds. Please try again.',requestId},504,requestId);
      }
      const message=(e as Error).message||'Recognition request failed';
      console.error(JSON.stringify({event:'recognition-request-error',requestId,model:MODEL,attempt,geminiLatencyMs,error:message}));
      if(attempt===1&&shouldRetryRecognitionFailure({status:null,timedOut:false,networkError:true})){
        await new Promise(r=>setTimeout(r,700+Math.floor(Math.random()*500)));continue;
      }
      return json({error:message,requestId},502,requestId);
    }
  }
  return json({error:'Recognition failed',requestId},502,requestId);
}
