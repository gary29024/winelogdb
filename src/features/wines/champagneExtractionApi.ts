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
  const body=await (await checked(response)).json() as {run?:ChampagneExtractionStatus|null};
  return {run:normalizeRun(body.run??null)};
}
export async function getChampagneExtraction(wineId:string,signal?:AbortSignal){
  return extractionResponse(await apiFetch(`/api/wines/${encodeURIComponent(wineId)}/champagne-extraction`,{headers:authHeaders(),signal}));
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
  let result=await extractionResponse(await apiFetch(`/api/wines/${encodeURIComponent(wineId)}/champagne-extraction`,{method:'POST',headers:authHeaders(),body:form,signal}));
  // A concurrent request can see a reserved operation before its HTTP result is
  // saved. Read its status; never turn an accepted response into a second run.
  if(!result.run)result=await getChampagneExtraction(wineId,signal);
  if(!result.run)throw new Error('Extraction was accepted. Reopen this wine to check its status before retrying.');
  return {run:result.run};
}
