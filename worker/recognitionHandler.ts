import { validateBatch } from '../src/features/uploads/validation';
import { parseRecognition } from '../src/features/recognition/schema';
import { selectRecognitionMetadata,type RecognitionPhotoMetadata } from '../src/lib/uploads/metadataSelection';
import { shouldRetryRecognitionFailure } from '../src/lib/recognition/retryPolicy';
import { requireSession } from '../src/lib/auth/session';
import { handleGroupRecognitionRequest } from './groupRecognitionHandler';

type RecognitionBindings={GEMINI_API_KEY:string;AUTH_SECRET:string;MAX_BATCH_FILES?:string};
type GeminiResponse={
  candidates?:Array<{content?:{parts?:Array<{text?:string}>};finishReason?:string}>;
  usageMetadata?:{promptTokenCount?:number;candidatesTokenCount?:number;totalTokenCount?:number};
  error?:{message?:string;code?:number;status?:string};
};

const MODEL='gemini-3.1-flash-lite';
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

const responseSchema={
  type:'OBJECT',
  properties:{
    producer:{type:'STRING',nullable:true},wineName:{type:'STRING',nullable:true},vintage:{type:'NUMBER',nullable:true},country:{type:'STRING',nullable:true},region:{type:'STRING',nullable:true},appellation:{type:'STRING',nullable:true},
    grapes:{type:'ARRAY',items:{type:'STRING'}},
    grapeBlend:{type:'ARRAY',items:{type:'OBJECT',properties:{grape:{type:'STRING'},percentage:{type:'NUMBER',nullable:true}},required:['grape']}},
    style:{type:'STRING',nullable:true},alcoholPercentage:{type:'NUMBER',nullable:true},locationName:{type:'STRING',nullable:true},confidence:{type:'NUMBER'}
  },
  required:['grapes','grapeBlend','confidence']
};

export async function handleRecognitionRequest(request:Request,env:RecognitionBindings){
  if(request.headers.get('X-WineLog-Recognition-Mode')==='group')return handleGroupRecognitionRequest(request,env);
  const requestId=crypto.randomUUID(),startedAt=Date.now();
  try{await requireSession(request.headers.get('Authorization')??undefined,env.AUTH_SECRET)}catch{return json({error:'Unauthorized',requestId},401,requestId)}

  let form:FormData;
  try{form=await request.formData()}catch{return json({error:'Could not read recognition request',requestId},400,requestId)}
  const files=form.getAll('images').filter((x):x is File=>x instanceof File);
  try{validateBatch(files,{maxFiles:Number(env.MAX_BATCH_FILES)||12,maxBytes:3*1024*1024,minDimension:300,maxDimension:2000})}catch(e){return json({error:(e as Error).message,requestId},400,requestId)}
  if(!files.length)return json({error:'Choose at least one wine photo',requestId},400,requestId);

  const metadata=parseJson<RecognitionPhotoMetadata[]>(form.get('metadata'),[]),selected=selectRecognitionMetadata(metadata);
  const context=[
    selected.capturedAt?`The strongest photo timestamp is ${selected.capturedAt}.`:'No reliable photo timestamp.',
    selected.latitude!=null&&selected.longitude!=null?`The exact EXIF GPS is ${selected.latitude}, ${selected.longitude}. Infer only an approximate concise human-readable place name when reasonably confident; never alter the coordinates.`:'No reliable GPS metadata.'
  ].join(' ');
  const prompt=`All supplied images are labels or views of the SAME wine bottle. Analyze them jointly in one identification. Reconcile front, back, neck and supplementary labels rather than treating them as separate wines. First prioritize facts visible anywhere in the supplied images. After identifying the bottle, you may fill high-confidence canonical facts from general wine knowledge even when not printed verbatim: country, region, appellation, grape varieties, and broad wine style. Use null or an empty array when not reasonably confident. For style, return only one of: red, white, rose, sparkling, dessert, fortified, orange, other. Capture grape blend percentages only when explicitly visible in the supplied images; never invent vintage-specific percentages. Keep plain grape names in grapes and percentages in grapeBlend. Do not add producer history, vintage quality, terroir commentary, winemaking techniques, drinking windows, tasting notes, scores, or detailed research here; those belong to Deep Search. Confidence is 0 to 1 and should reflect confidence in the bottle identification. ${context} Do not invent a tasting date; the application derives it from photo metadata.`;
  const imageParts=await Promise.all(files.map(async file=>({inlineData:{data:await fileToBase64(file),mimeType:file.type}})));
  const requestBody=JSON.stringify({contents:[{role:'user',parts:[{text:prompt},...imageParts]}],generationConfig:{responseMimeType:'application/json',responseSchema}});
  const totalInputBytes=files.reduce((sum,file)=>sum+file.size,0);
  console.log(JSON.stringify({event:'recognition-start',requestId,model:MODEL,photoCount:files.length,inputBytes:totalInputBytes}));

  for(let attempt=1;attempt<=2;attempt++){
    const attemptStarted=Date.now(),controller=new AbortController();let timedOut=false;
    const timer=setTimeout(()=>{timedOut=true;controller.abort()},HARD_TIMEOUT_MS);
    try{
      const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,{
        method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},body:requestBody,signal:controller.signal
      });
      clearTimeout(timer);
      const geminiLatencyMs=Date.now()-attemptStarted;
      if(!response.ok){
        const errorText=(await response.text()).slice(0,1500);
        console.error(JSON.stringify({event:'recognition-upstream-error',requestId,model:MODEL,attempt,status:response.status,geminiLatencyMs,error:errorText}));
        if(attempt===1&&shouldRetryRecognitionFailure({status:response.status,timedOut:false,networkError:false})){
          await new Promise(r=>setTimeout(r,700+Math.floor(Math.random()*500)));continue;
        }
        return json({error:`Recognition failed (${response.status})`,requestId},502,requestId);
      }
      const payload=await response.json() as GeminiResponse;
      const candidate=payload.candidates?.[0],text=candidate?.content?.parts?.map(part=>part.text??'').join('')??'';
      if(!text)throw new Error('Gemini returned no recognition result');
      const result=parseRecognition(text);
      const locationName=selected.gpsSource==='exif'&&result.locationName?.trim()?result.locationName.trim():null;
      const durationMs=Date.now()-startedAt;
      console.log(JSON.stringify({event:'recognition-complete',requestId,model:MODEL,attempt,geminiLatencyMs,durationMs,finishReason:candidate?.finishReason??null,promptTokens:payload.usageMetadata?.promptTokenCount??null,outputTokens:payload.usageMetadata?.candidatesTokenCount??null,totalTokens:payload.usageMetadata?.totalTokenCount??null}));
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
