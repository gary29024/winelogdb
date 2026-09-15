import { z } from 'zod';
import { requireSession } from '../src/lib/auth/session';
import { validateBatch } from '../src/features/uploads/validation';
import { CHAMPAGNE_EXTRACTION_PROMPT,CHAMPAGNE_PHOTO_BYTES,CHAMPAGNE_PHOTO_LIMIT,isChampagne,type ChampagneExtractionStatus } from '../src/lib/wine/champagneExtraction';
import { sparklingDetailsSchema } from '../src/lib/wine/sparklingDetails';
import { RECOGNITION_MODEL,sparklingDetailsJsonSchema } from '../src/lib/recognition/geminiRequest';
import { createGeminiBatch,fetchGeminiBatch,inlineResponseText,isTerminalBatchState,type GeminiInlineResponse } from '../src/lib/research/geminiBatch';
import { geminiCallTokens,recordAiUsage,type AnalyticsSink } from '../src/lib/usage/aiUsage';
import { postGeminiGenerateContent,resolveGeminiTransport,type GeminiTransportBindings } from './geminiTransport';

type Env=GeminiTransportBindings&{DB:D1Database;WINE_IMAGES:R2Bucket;AUTH_SECRET:string;RESEARCH_QUEUE:Queue<unknown>;AI_USAGE?:AnalyticsSink};
export type ChampagneExtractionJob={kind:'champagne_extraction';owner:string;wineId:string;requestId:string;cleanup?:boolean};
type Row={owner_id:string;wine_id:string;request_id:string;status:ChampagneExtractionStatus['status'];request_key:string;image_ids_json:string;batch_name:string|null;result_json:string|null;error:string|null;created_at:string;updated_at:string};
const resultSchema=z.object({details:sparklingDetailsSchema.nullable()}).strict();
const now=()=>new Date().toISOString();
const keyFor=(id:string)=>`champagne-extraction/${id}.json`;
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const readRow=(db:D1Database,owner:string,wineId:string)=>db.prepare('SELECT * FROM wine_champagne_extractions WHERE owner_id=? AND wine_id=?').bind(owner,wineId).first<Row>();
const statusOf=(row:Row):ChampagneExtractionStatus=>({requestId:row.request_id,status:row.status,details:row.result_json?resultSchema.parse(JSON.parse(row.result_json)).details:null,error:row.error,imageIds:JSON.parse(row.image_ids_json) as string[]});
const wineFor=(db:D1Database,owner:string,wineId:string)=>db.prepare('SELECT region,appellation,wine_style AS wineStyle FROM wines WHERE owner_id=? AND id=?').bind(owner,wineId).first<{region:string|null;appellation:string|null;wineStyle:string|null}>();
async function fail(env:Env,row:Row,message:string){
  await env.DB.prepare("UPDATE wine_champagne_extractions SET status='failed',error=?,updated_at=? WHERE owner_id=? AND wine_id=? AND request_id=? AND status NOT IN ('complete','failed')").bind(message,now(),row.owner_id,row.wine_id,row.request_id).run();
}
async function base64(file:File){
  const bytes=new Uint8Array(await file.arrayBuffer());let binary='';
  for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
  return btoa(binary);
}

export async function handleChampagneExtraction(request:Request,env:Env):Promise<Response|null>{
  const match=new URL(request.url).pathname.match(/^\/api\/wines\/([^/]+)\/champagne-extraction$/);
  if(!match)return null;
  if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed'},405);
  let owner:string;
  try{owner=(await requireSession(request.headers.get('Authorization')??undefined,env.AUTH_SECRET)).userId}catch{return json({error:'Unauthorized'},401)}
  const wineId=decodeURIComponent(match[1]),wine=await wineFor(env.DB,owner,wineId);
  if(!wine)return json({error:'Wine not found'},404);
  let existing=await readRow(env.DB,owner,wineId);
  // A crashed consumer must not leave the UI permanently busy. Never blindly
  // resubmit an uncertain paid call; make the failure visible for explicit retry.
  if(existing&&['queued','running'].includes(existing.status)&&Date.now()-Date.parse(existing.updated_at)>15*60_000){
    await fail(env,existing,'Extraction was interrupted. Please try again.');existing=await readRow(env.DB,owner,wineId);
  }
  if(request.method==='GET'){
    // Native batch polling is safe to resume if a queue delivery was lost.
    if(existing?.status==='submitted'&&Date.now()-Date.parse(existing.updated_at)>20*60_000){
      const claimed=await env.DB.prepare("UPDATE wine_champagne_extractions SET updated_at=? WHERE request_id=? AND status='submitted' AND updated_at=?").bind(now(),existing.request_id,existing.updated_at).run();
      if(claimed.meta.changes)await env.RESEARCH_QUEUE.send({kind:'champagne_extraction',owner,wineId,requestId:existing.request_id}).catch(()=>undefined);
    }
    return json({run:existing?statusOf(existing):null});
  }
  if(!isChampagne(wine))return json({error:'Photo backfill is available for Champagne only.'},400);
  if(existing&&!['complete','failed'].includes(existing.status))return json({run:statusOf(existing)},202);
  try{resolveGeminiTransport(env)}catch{return json({error:'Gemini is not configured for extraction.'},503)}
  let files:File[],imageIds:string[];
  try{
    const form=await request.formData();files=form.getAll('images').filter((item):item is File=>item instanceof File);
    validateBatch(files,{maxFiles:CHAMPAGNE_PHOTO_LIMIT,maxBytes:CHAMPAGNE_PHOTO_BYTES,minDimension:300,maxDimension:2000});
    imageIds=z.array(z.string().min(1)).min(1).max(CHAMPAGNE_PHOTO_LIMIT).parse(JSON.parse(String(form.get('imageIds'))));
    if(imageIds.length!==files.length||new Set(imageIds).size!==imageIds.length)throw new Error('Choose distinct saved photos for this wine.');
    const saved=await env.DB.prepare('SELECT id FROM wine_images WHERE owner_id=? AND wine_id=? AND id IN (SELECT value FROM json_each(?))').bind(owner,wineId,JSON.stringify(imageIds)).all<{id:string}>();
    if(saved.results.length!==imageIds.length)throw new Error('A selected photo no longer belongs to this wine. Refresh and try again.');
  }catch(error){return json({error:error instanceof Error?error.message:'Invalid photos'},400)}
  const requestId=crypto.randomUUID(),requestKey=keyFor(requestId),stamp=now();
  try{
    const parts=[{text:CHAMPAGNE_EXTRACTION_PROMPT},...await Promise.all(files.map(async file=>({inlineData:{data:await base64(file),mimeType:file.type}})))];
    const body={contents:[{role:'user',parts}],generationConfig:{responseMimeType:'application/json',responseJsonSchema:{type:'object',properties:{details:sparklingDetailsJsonSchema},required:['details'],additionalProperties:false},maxOutputTokens:4096}};
    await env.WINE_IMAGES.put(requestKey,JSON.stringify(body),{httpMetadata:{contentType:'application/json'}});
    const saved=await env.DB.prepare(`INSERT INTO wine_champagne_extractions(owner_id,wine_id,request_id,status,request_key,image_ids_json,created_at,updated_at)
      VALUES(?,?,?,'queued',?,?,?,?) ON CONFLICT(owner_id,wine_id) DO UPDATE SET request_id=excluded.request_id,status='queued',request_key=excluded.request_key,image_ids_json=excluded.image_ids_json,batch_name=NULL,result_json=NULL,error=NULL,created_at=excluded.created_at,updated_at=excluded.updated_at
      WHERE wine_champagne_extractions.status IN ('complete','failed')`).bind(owner,wineId,requestId,requestKey,JSON.stringify(imageIds),stamp,stamp).run();
    if(!saved.meta.changes){await env.WINE_IMAGES.delete(requestKey);const current=await readRow(env.DB,owner,wineId);return json({run:current?statusOf(current):null},202)}
    const job:ChampagneExtractionJob={kind:'champagne_extraction',owner,wineId,requestId};
    // Cleanup also runs when the wine is deleted or a consumer is interrupted.
    await env.RESEARCH_QUEUE.send({...job,cleanup:true},{delaySeconds:86400});
    await env.RESEARCH_QUEUE.send(job);
    if(existing)await env.WINE_IMAGES.delete(existing.request_key).catch(()=>undefined);
    const current=await readRow(env.DB,owner,wineId);return json({run:current?statusOf(current):null},202);
  }catch(error){
    const current=await readRow(env.DB,owner,wineId);
    if(current?.request_id===requestId)await fail(env,current,'Could not queue extraction. Please try again.');
    await env.WINE_IMAGES.delete(requestKey).catch(()=>undefined);
    console.error(JSON.stringify({event:'champagne-extraction-queue-failed',requestId,error:String(error)}));
    return json({error:'Could not queue extraction. Please try again.'},503);
  }
}

async function complete(env:Env,row:Row,inline:GeminiInlineResponse,tier:'batch'|'flex'){
  // Meter even an unusable answer; persisted event IDs prevent double billing in the UI.
  if(inline.response)await recordAiUsage(env,row.owner_id,{kind:'champagne_extraction',runId:row.request_id,targetId:row.wine_id,eventId:`champagne:${row.request_id}`,model:RECOGNITION_MODEL,tier,requests:1,units:1,...geminiCallTokens(inline.response.usageMetadata)});
  if(inline.error||!inline.response)throw new Error('Gemini could not extract these labels. Please retry with clearer photos.');
  if(inline.response.candidates?.[0]?.finishReason!=='STOP')throw new Error('The label extraction was incomplete. Please try again.');
  const parsed=resultSchema.parse(JSON.parse(inlineResponseText(inline)));
  await env.DB.prepare("UPDATE wine_champagne_extractions SET status='complete',result_json=?,error=NULL,updated_at=? WHERE owner_id=? AND wine_id=? AND request_id=? AND status IN ('running','submitted')").bind(JSON.stringify(parsed),now(),row.owner_id,row.wine_id,row.request_id).run();
}

export async function processChampagneExtraction(env:Env,job:ChampagneExtractionJob){
  const row=await readRow(env.DB,job.owner,job.wineId),key=keyFor(job.requestId);
  if(!row||row.request_id!==job.requestId){await env.WINE_IMAGES.delete(key);return}
  if(job.cleanup){
    if(Date.now()-Date.parse(row.created_at)<48*60*60_000){await env.RESEARCH_QUEUE.send(job,{delaySeconds:86400});return}
    if(!['complete','failed'].includes(row.status))await fail(env,row,'Extraction expired. Please try again.');
    await env.WINE_IMAGES.delete(key);return;
  }
  if(['complete','failed'].includes(row.status)){await env.WINE_IMAGES.delete(key);return}
  if(row.status==='running')return; // duplicate delivery must never repeat a paid submission
  let cleanInput=row.status==='submitted';
  try{
    if(Date.now()-Date.parse(row.created_at)>30*60*60_000)throw new Error('Extraction exceeded the batch waiting period. Please try again.');
    const wine=await wineFor(env.DB,job.owner,job.wineId);
    if(!wine||!isChampagne(wine))throw new Error('This wine is no longer classified as Champagne.');
    if(row.status==='submitted'&&row.batch_name){
      const result=await fetchGeminiBatch(env.GEMINI_API_KEY,row.batch_name);
      if(!result.ok)throw new Error('Could not read the batch result. Please try again.');
      if(!isTerminalBatchState(result.state)){
        await env.DB.prepare('UPDATE wine_champagne_extractions SET updated_at=? WHERE request_id=?').bind(now(),row.request_id).run();
        await env.RESEARCH_QUEUE.send(job,{delaySeconds:300});return;
      }
      if(result.state!=='JOB_STATE_SUCCEEDED')throw new Error('The background batch failed. Please try again.');
      const inline=result.responses.find(item=>item.metadata?.key===row.request_id);
      if(!inline)throw new Error('Gemini returned no matching batch result.');
      await complete(env,row,inline,'batch');
    }else{
      const claimed=await env.DB.prepare("UPDATE wine_champagne_extractions SET status='running',updated_at=? WHERE request_id=? AND status='queued'").bind(now(),row.request_id).run();
      if(!claimed.meta.changes)return;
      cleanInput=true;
      const object=await env.WINE_IMAGES.get(row.request_key);
      if(!object)throw new Error('The prepared photos expired. Please try again.');
      const body=await object.text(); // bounded to six 1.5 MB photos when staged
      if(resolveGeminiTransport(env)==='vertex-ai-gateway'){
        const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),600_000);
        try{
          const {response}=await postGeminiGenerateContent(env,RECOGNITION_MODEL,body,controller.signal,{feature:'recognition',mode:'champagne-backfill',requestId:row.request_id},{serviceTier:'flex',serverTimeoutSeconds:600});
          if(!response.ok)throw new Error('Background extraction was unavailable. Please try again.');
          await complete(env,row,{response:await response.json() as GeminiInlineResponse['response']},'flex');
        }finally{clearTimeout(timer)}
      }else{
        const name=await createGeminiBatch(env.GEMINI_API_KEY,RECOGNITION_MODEL,`winelog-champagne-${row.request_id}`,[{key:row.request_id,request:JSON.parse(body) as Record<string,unknown>}]);
        await env.DB.prepare("UPDATE wine_champagne_extractions SET status='submitted',batch_name=?,updated_at=? WHERE request_id=? AND status='running'").bind(name,now(),row.request_id).run();
        await env.RESEARCH_QUEUE.send(job,{delaySeconds:60});
      }
    }
  }catch(error){
    console.error(JSON.stringify({event:'champagne-extraction-failed',requestId:row.request_id,error:String(error)}));
    await fail(env,row,error instanceof z.ZodError?'The extracted details were invalid. Please try again with clearer photos.':error instanceof Error?error.message:'Extraction failed. Please try again.');
  }finally{
    // Native Batch already holds its input; Flex has finished reading it.
    if(cleanInput)await env.WINE_IMAGES.delete(key).catch(()=>undefined);
  }
}
