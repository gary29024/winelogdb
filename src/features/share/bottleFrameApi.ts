import { authHeaders,clearSession } from '../../lib/auth/client';
import type { BottleFrame } from '../../lib/images/bottleFrame';
import type { LoadedPhoto } from './renderStoryCollage';

/**
 * Asking what is already known, and paying to know the rest.
 *
 * Reading is free and happens whenever the sheet opens; measuring is a vision
 * call and happens only when somebody presses the button. That split is the
 * whole reason these are two functions rather than one that "makes sure".
 */
async function ok(response:Response,message:string){
  if(response.status===401){clearSession();throw new Error('Session expired. Please sign in again.')}
  if(!response.ok){
    const body=await response.json().catch(()=>({})) as {error?:string};
    throw new Error(body.error||message);
  }
}

export async function fetchBottleFrames(imageIds:string[]):Promise<Map<string,BottleFrame>>{
  const ids=[...new Set(imageIds.filter(Boolean))];
  if(!ids.length)return new Map();
  const response=await fetch(`/api/bottle-frames?ids=${encodeURIComponent(ids.join(','))}`,{headers:authHeaders()});
  await ok(response,'Could not load the bottle framing');
  const body=await response.json() as {frames:Record<string,BottleFrame>};
  return new Map(Object.entries(body.frames??{}));
}

/**
 * The photograph as the measuring call wants it: small.
 *
 * A box in a thousandth of the frame is the same box whether it was read off
 * three thousand pixels or six hundred, so this sends the smaller one - it
 * costs a fraction of the tokens, uploads in a moment on venue wifi, and the
 * bitmap is already in memory because the card has just drawn it.
 */
const THUMBNAIL_EDGE=640;
export async function thumbnailOf(photo:NonNullable<LoadedPhoto>,name='bottle.jpg'){
  const scale=Math.min(1,THUMBNAIL_EDGE/Math.max(photo.width,photo.height));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(photo.width*scale));
  canvas.height=Math.max(1,Math.round(photo.height*scale));
  const context=canvas.getContext('2d');
  if(!context)throw new Error('This browser cannot prepare the photograph');
  context.drawImage(photo.image,0,0,canvas.width,canvas.height);
  const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',.82));
  if(!blob)throw new Error('This browser cannot prepare the photograph');
  return new File([blob],name,{type:'image/jpeg'});
}

export async function measureBottleFrame(imageId:string,file:File):Promise<BottleFrame>{
  const form=new FormData();
  form.append('images',file);
  form.append('metadata',JSON.stringify([{capturedAt:null,latitude:null,longitude:null,source:'none'}]));
  const response=await fetch(`/api/bottle-frames/${imageId}`,{method:'POST',headers:authHeaders(),body:form});
  await ok(response,'Could not measure that photograph');
  const body=await response.json() as {frame:BottleFrame};
  return body.frame;
}
