import { authHeaders,clearSession } from '../../lib/auth/client';
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
  const body=await (await checked(response)).json() as {run:ChampagneExtractionStatus|null};
  return {run:normalizeRun(body.run)};
}
export async function getChampagneExtraction(wineId:string,signal?:AbortSignal){
  return extractionResponse(await fetch(`/api/wines/${encodeURIComponent(wineId)}/champagne-extraction`,{headers:authHeaders(),signal}));
}
export async function startChampagneExtraction(wineId:string,imageIds:string[],signal?:AbortSignal){
  if(!imageIds.length||imageIds.length>CHAMPAGNE_PHOTO_LIMIT)throw new Error(`Choose 1–${CHAMPAGNE_PHOTO_LIMIT} saved photos of this bottle.`);
  const form=new FormData();
  // Prepare one original at a time to bound browser memory. Never use the
  // thumbnail: small print on neck/back labels needs the original resolution.
  for(const id of imageIds){
    const response=await checked(await fetch(`/api/images/${encodeURIComponent(id)}`,{headers:authHeaders(),signal}));
    const blob=await response.blob();
    const prepared=await prepareRecognitionImageWithinBytes(new File([blob],`${id}.jpg`,{type:blob.type}),CHAMPAGNE_PHOTO_BYTES);
    signal?.throwIfAborted();form.append('images',prepared.file);
  }
  form.set('imageIds',JSON.stringify(imageIds));
  return extractionResponse(await fetch(`/api/wines/${encodeURIComponent(wineId)}/champagne-extraction`,{method:'POST',headers:authHeaders(),body:form,signal})) as Promise<{run:ChampagneExtractionStatus}>;
}
