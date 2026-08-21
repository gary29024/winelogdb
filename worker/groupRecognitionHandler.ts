import { validateBatch } from '../src/features/uploads/validation';
import { parseGroupRecognition } from '../src/features/recognition/groupSchema';
import { selectRecognitionMetadata,type RecognitionPhotoMetadata } from '../src/lib/uploads/metadataSelection';
import { shouldRetryRecognitionFailure } from '../src/lib/recognition/retryPolicy';
import { requireSession } from '../src/lib/auth/session';

type Bindings={GEMINI_API_KEY:string;AUTH_SECRET:string};
type GeminiResponse={candidates?:Array<{content?:{parts?:Array<{text?:string}>};finishReason?:string}>;usageMetadata?:{promptTokenCount?:number;candidatesTokenCount?:number;totalTokenCount?:number};error?:{message?:string}};
const MODEL='gemini-3.1-flash-lite';
const HARD_TIMEOUT_MS=60_000;
const MAX_GROUP_IMAGE_BYTES=3*1024*1024;
const parseJson=<T>(value:unknown,fallback:T):T=>{try{return JSON.parse(String(value)) as T}catch{return fallback}};

async function fileToBase64(file:File){const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(binary)}
function json(body:unknown,status=200,requestId?:string){const headers=new Headers({'Content-Type':'application/json; charset=UTF-8','Cache-Control':'no-store'});if(requestId)headers.set('X-WineLog-Request-Id',requestId);return new Response(JSON.stringify(body),{status,headers})}

const wineSchema={type:'OBJECT',properties:{
  producer:{type:'STRING'},wineName:{type:'STRING'},vintage:{type:'NUMBER',nullable:true},country:{type:'STRING',nullable:true},region:{type:'STRING',nullable:true},appellation:{type:'STRING',nullable:true},
  grapes:{type:'ARRAY',items:{type:'STRING'}},grapeBlend:{type:'ARRAY',items:{type:'OBJECT',properties:{grape:{type:'STRING'},percentage:{type:'NUMBER',nullable:true}},required:['grape']}},
  style:{type:'STRING',enum:['red','white','rose','sparkling','dessert','fortified','orange','other'],nullable:true},alcoholPercentage:{type:'NUMBER',nullable:true},locationName:{type:'STRING',nullable:true},confidence:{type:'NUMBER'},
  boundingBox:{type:'OBJECT',properties:{xMin:{type:'NUMBER'},yMin:{type:'NUMBER'},xMax:{type:'NUMBER'},yMax:{type:'NUMBER'}},required:['xMin','yMin','xMax','yMax']}
},required:['producer','wineName','grapes','grapeBlend','confidence','boundingBox']};
const responseSchema={type:'OBJECT',properties:{wines:{type:'ARRAY',items:wineSchema},unresolvedCount:{type:'NUMBER'}},required:['wines','unresolvedCount']};

export async function handleGroupRecognitionRequest(request:Request,env:Bindings){
  const requestId=crypto.randomUUID(),startedAt=Date.now();
  try{await requireSession(request.headers.get('Authorization')??undefined,env.AUTH_SECRET)}catch{return json({error:'Unauthorized',requestId},401,requestId)}
  let form:FormData;
  try{form=await request.formData()}catch(e){
    const message=(e as Error).message||'Could not read group recognition request';
    console.error(JSON.stringify({event:'group-recognition-form-error',requestId,error:message,contentType:request.headers.get('Content-Type')}));
    return json({error:'Could not read group recognition request',requestId},400,requestId)
  }
  const files=form.getAll('images').filter((x):x is File=>x instanceof File);
  try{validateBatch(files,{maxFiles:1,maxBytes:MAX_GROUP_IMAGE_BYTES,minDimension:300,maxDimension:2000})}catch(e){
    const message=(e as Error).message;
    console.error(JSON.stringify({event:'group-recognition-validation-error',requestId,error:message,files:files.map(file=>({name:file.name,type:file.type,size:file.size}))}));
    return json({error:message,requestId},400,requestId)
  }
  if(files.length!==1){console.error(JSON.stringify({event:'group-recognition-file-count-error',requestId,fileCount:files.length}));return json({error:'Choose exactly one group photo',requestId},400,requestId)}
  const file=files[0],metadata=parseJson<RecognitionPhotoMetadata[]>(form.get('metadata'),[]),selected=selectRecognitionMetadata(metadata);
  const context=[selected.capturedAt?`Photo timestamp: ${selected.capturedAt}.`:'No reliable photo timestamp.',selected.latitude!=null&&selected.longitude!=null?`Exact EXIF GPS: ${selected.latitude}, ${selected.longitude}. You may infer one concise approximate place name, but never change the coordinates.`:'No reliable GPS metadata.'].join(' ');
  const prompt=`This is ONE group photograph containing MULTIPLE wine bottles or labels. Identify each DISTINCT wine that can be reasonably identified. Do not treat the whole photo as one wine. Do not return the same wine twice merely because two bottles of it are visible. Order results left-to-right by the bottle/label position. For every returned wine, give a bounding box around the visible bottle or most useful label using normalized image coordinates from 0 to 1000: xMin,yMin,xMax,yMax. Keep the box tight enough to make a useful wine thumbnail but include the complete visible bottle/label when possible. If a visible bottle cannot be identified with producer and wine name, omit it from wines and increment unresolvedCount instead of guessing. Prioritize visible label facts; high-confidence canonical country, region, appellation, grapes and broad style may be filled from general wine knowledge. Style must be one of red, white, rose, sparkling, dessert, fortified, orange, other. Blend percentages only when explicitly visible. Do not return tasting notes, scores, producer history, terroir or deep research. Confidence is 0 to 1 for the specific wine identification. ${context}`;
  const imagePart={inlineData:{data:await fileToBase64(file),mimeType:file.type}};
  const requestBody=JSON.stringify({contents:[{role:'user',parts:[{text:prompt},imagePart]}],generationConfig:{responseMimeType:'application/json',responseSchema,maxOutputTokens:8192}});
  console.log(JSON.stringify({event:'group-recognition-start',requestId,model:MODEL,inputBytes:file.size,inputType:file.type,inputName:file.name}));
  for(let attempt=1;attempt<=2;attempt++){
    const attemptStarted=Date.now(),controller=new AbortController();let timedOut=false;const timer=setTimeout(()=>{timedOut=true;controller.abort()},HARD_TIMEOUT_MS);
    try{
      const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},body:requestBody,signal:controller.signal});
      clearTimeout(timer);const geminiLatencyMs=Date.now()-attemptStarted;
      if(!response.ok){const errorText=(await response.text()).slice(0,1500);console.error(JSON.stringify({event:'group-recognition-upstream-error',requestId,attempt,status:response.status,geminiLatencyMs,error:errorText}));if(attempt===1&&shouldRetryRecognitionFailure({status:response.status,timedOut:false,networkError:false})){await new Promise(r=>setTimeout(r,700+Math.floor(Math.random()*500)));continue}return json({error:`Group recognition failed (${response.status})`,requestId},502,requestId)}
      const payload=await response.json() as GeminiResponse,candidate=payload.candidates?.[0],text=candidate?.content?.parts?.map(part=>part.text??'').join('')??'';if(!text)throw new Error('Gemini returned no group recognition result');
      const result=parseGroupRecognition(text),durationMs=Date.now()-startedAt;
      console.log(JSON.stringify({event:'group-recognition-complete',requestId,model:MODEL,attempt,geminiLatencyMs,durationMs,wines:result.wines.length,unresolvedCount:result.unresolvedCount,finishReason:candidate?.finishReason??null,promptTokens:payload.usageMetadata?.promptTokenCount??null,outputTokens:payload.usageMetadata?.candidatesTokenCount??null,totalTokens:payload.usageMetadata?.totalTokenCount??null}));
      return json({...result,requestId,recognitionDurationMs:durationMs},200,requestId);
    }catch(e){clearTimeout(timer);const geminiLatencyMs=Date.now()-attemptStarted;if(timedOut){console.error(JSON.stringify({event:'group-recognition-timeout',requestId,attempt,geminiLatencyMs}));return json({error:'Group recognition timed out after 60 seconds. Please try again.',requestId},504,requestId)}const message=(e as Error).message||'Group recognition failed';console.error(JSON.stringify({event:'group-recognition-error',requestId,attempt,geminiLatencyMs,error:message}));if(attempt===1&&shouldRetryRecognitionFailure({status:null,timedOut:false,networkError:true})){await new Promise(r=>setTimeout(r,700+Math.floor(Math.random()*500)));continue}return json({error:message,requestId},502,requestId)}
  }
  return json({error:'Group recognition failed',requestId},502,requestId);
}
