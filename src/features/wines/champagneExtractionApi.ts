import { apiFetch,authHeaders,clearSession,getSession } from '../../lib/auth/client';
import { CHAMPAGNE_PHOTO_BYTES,CHAMPAGNE_PHOTO_LIMIT,normalizeChampagneDetails,type ChampagneExtractionStatus } from '../../lib/wine/champagneExtraction';
import { prepareRecognitionImageWithinBytes } from '../uploads/prepareImage';
import { sparklingDetailsSchema } from '../../lib/wine/sparklingDetails';

async function checked(response:Response){
  if(response.status===401){clearSession();throw new Error('Session expired. Please sign in again.')}
  if(!response.ok){const body=await response.json().catch(()=>({})) as {error?:string};throw new Error(body.error||'Could not load Champagne extraction.')}
  return response;
}
const responseDetailsSchema=sparklingDetailsSchema.strip();
const normalizeRun=(run:ChampagneExtractionStatus|null)=>{
  if(!run||run.details==null)return run;
  // Older clients can still show known fields from a newer server response.
  // Never pass unknown/invalid fields on to the form's strict suggestion parser.
  const parsed=responseDetailsSchema.safeParse(run.details);
  return {...run,details:parsed.success?normalizeChampagneDetails(parsed.data):null};
};
async function extractionResponse(response:Response){
  const body=await (await checked(response)).json() as {run?:ChampagneExtractionStatus|null;creditOperationId?:string};
  return {run:normalizeRun(body.run??null),...(body.creditOperationId?{creditOperationId:body.creditOperationId}:{})};
}
export async function getChampagneExtraction(wineId:string,signal?:AbortSignal){
  return extractionResponse(await apiFetch(`/api/wines/${encodeURIComponent(wineId)}/champagne-extraction`,{headers:authHeaders(),signal}));
}
const acceptedMessage='Extraction was accepted. Reopen this wine to check its status before retrying.';
function acceptanceDelay(ms:number,signal?:AbortSignal){
  return new Promise<void>((resolve,reject)=>{
    signal?.throwIfAborted();
    const onAbort=()=>{clearTimeout(timer);reject(signal?.reason)};
    const timer=setTimeout(()=>{signal?.removeEventListener('abort',onAbort);resolve()},ms);
    signal?.addEventListener('abort',onAbort,{once:true});
  });
}
async function acceptedExtraction(wineId:string,operationId:string,identity:string|null,signal?:AbortSignal){
  for(let attempt=0;attempt<8;attempt++){
    signal?.throwIfAborted();
    if(identity!==getSession())throw new Error('Account changed; discard the previous extraction.');
    const response=await checked(await apiFetch(`/api/credits/operations/${encodeURIComponent(operationId)}`,{headers:authHeaders(),signal}));
    const operation=await response.json() as {status:string;runId?:string|null;result?:{run?:ChampagneExtractionStatus;error?:string}|null};
    const requestId=operation.runId??operation.result?.run?.requestId;
    if(requestId){
      const {run}=await getChampagneExtraction(wineId,signal);
      if(run?.requestId===requestId)return run;
    }
    if(operation.status==='failed')throw new Error(operation.result?.error||'Could not start extraction. Please try again.');
    if(operation.status==='review')throw new Error('Extraction needs review before it can be retried.');
    if(operation.status==='complete')break;
    if(attempt<7)await acceptanceDelay(Math.min(250*2**attempt,2000),signal);
  }
  throw new Error(acceptedMessage);
}
export async function startChampagneExtraction(wineId:string,imageIds:string[],signal?:AbortSignal){
  if(!imageIds.length||imageIds.length>CHAMPAGNE_PHOTO_LIMIT)throw new Error(`Choose 1–${CHAMPAGNE_PHOTO_LIMIT} saved photos of this bottle.`);
  const identity=getSession(),form=new FormData();
  // Prepare one original at a time to bound browser memory. Never use the
  // thumbnail: small print on neck/back labels needs the original resolution.
  for(const id of imageIds){
    if(identity!==getSession())throw new Error('Account changed; select the photos again.');
    const response=await checked(await apiFetch(`/api/images/${encodeURIComponent(id)}`,{headers:authHeaders(),signal}));
    const blob=await response.blob();
    const prepared=await prepareRecognitionImageWithinBytes(new File([blob],`${id}.jpg`,{type:blob.type}),CHAMPAGNE_PHOTO_BYTES);
    signal?.throwIfAborted();form.append('images',prepared.file);
  }
  if(identity!==getSession())throw new Error('Account changed; select the photos again.');
  form.set('imageIds',JSON.stringify(imageIds));
  // The common client serializes this FormData once for the quote and execution,
  // and reuses the same idempotency key if a network response is lost.
  const result=await extractionResponse(await apiFetch(`/api/wines/${encodeURIComponent(wineId)}/champagne-extraction`,{method:'POST',headers:authHeaders(),body:form,signal}));
  // A concurrent request can see a reserved operation before its HTTP result is
  // saved. Follow that operation's bound run; the wine may still show an older
  // completed extraction while the accepted request is staging its photos.
  if(result.run)return {run:result.run};
  if(!result.creditOperationId)throw new Error(acceptedMessage);
  return {run:await acceptedExtraction(wineId,result.creditOperationId,identity,signal)};
}
