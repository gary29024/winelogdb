import { authHeaders,clearSession } from '../../lib/auth/client';
import { CHAMPAGNE_PHOTO_BYTES,CHAMPAGNE_PHOTO_LIMIT,type ChampagneExtractionStatus } from '../../lib/wine/champagneExtraction';
import { prepareRecognitionImageWithinBytes } from '../uploads/prepareImage';

async function checked(response:Response){
  if(response.status===401){clearSession();throw new Error('Session expired. Please sign in again.')}
  if(!response.ok){const body=await response.json().catch(()=>({})) as {error?:string};throw new Error(body.error||'Could not load Champagne extraction.')}
  return response;
}
export async function getChampagneExtraction(wineId:string,signal?:AbortSignal){
  return (await checked(await fetch(`/api/wines/${encodeURIComponent(wineId)}/champagne-extraction`,{headers:authHeaders(),signal}))).json() as Promise<{run:ChampagneExtractionStatus|null}>;
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
  return (await checked(await fetch(`/api/wines/${encodeURIComponent(wineId)}/champagne-extraction`,{method:'POST',headers:authHeaders(),body:form,signal}))).json() as Promise<{run:ChampagneExtractionStatus}>;
}
