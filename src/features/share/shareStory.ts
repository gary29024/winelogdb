import { authHeaders } from '../../lib/auth/client';
import { drawStoryCard,type LoadedPhoto,type StoryCard } from './renderStoryCollage';

/**
 * Getting a card out of the browser and into a story.
 *
 * There is no web API that hands an image to Instagram's story composer. The
 * documented instagram-stories:// intent is for native apps with a registered
 * Facebook app id, and from Safari it does nothing. What does work is the share
 * sheet: navigator.share with a file offers Instagram alongside everything
 * else, and Stories is one tap inside it. Where even that is missing - a
 * desktop browser, an old phone - the card is saved to the camera roll or the
 * downloads folder instead, which is the same two taps in a different order.
 */
export type ShareOutcome='shared'|'downloaded'|'cancelled';

export function canShareFiles(file:File,navigatorLike:Navigator=navigator){
  const share=navigatorLike as Navigator&{canShare?:(data:{files:File[]})=>boolean};
  return typeof navigatorLike.share==='function'&&typeof share.canShare==='function'&&share.canShare({files:[file]});
}

async function loadPhoto(imageId:string):Promise<LoadedPhoto>{
  try{
    const response=await fetch(`/api/images/${imageId}`,{headers:authHeaders(),cache:'default'});
    if(!response.ok)return null;
    const blob=await response.blob();
    const bitmap='createImageBitmap' in window?await createImageBitmap(blob).catch(()=>null):null;
    if(bitmap)return {image:bitmap,width:bitmap.width,height:bitmap.height};
    // Safari has had createImageBitmap for years, but an <img> is the fallback
    // that has always worked and costs one object URL.
    const url=URL.createObjectURL(blob);
    try{
      const image=await new Promise<HTMLImageElement>((resolve,reject)=>{
        const element=new Image();
        element.onload=()=>resolve(element);element.onerror=()=>reject(new Error('image failed'));
        element.src=url;
      });
      return {image,width:image.naturalWidth,height:image.naturalHeight};
    }finally{URL.revokeObjectURL(url)}
  }catch{return null}
}

/** Every photograph the card needs, fetched once each however often it appears. */
export async function loadStoryPhotos(card:StoryCard){
  const ids=[...new Set(card.wines.map(wine=>wine.imageId).filter((id):id is string=>Boolean(id)))];
  const loaded=await Promise.all(ids.map(async id=>[id,await loadPhoto(id)] as const));
  return new Map(loaded);
}

export async function renderStoryFile(card:StoryCard,name='winelog-story.jpg'){
  const canvas=document.createElement('canvas');
  drawStoryCard(canvas,card,await loadStoryPhotos(card));
  const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',.92));
  if(!blob)throw new Error('The story card could not be saved as an image');
  return new File([blob],name,{type:'image/jpeg'});
}

/**
 * Hands the card to the share sheet, or saves it.
 *
 * A cancelled share is not a failure - it is somebody changing their mind - so
 * it is reported as its own outcome rather than thrown.
 */
export async function shareStoryFile(file:File):Promise<ShareOutcome>{
  if(canShareFiles(file)){
    try{await navigator.share({files:[file]});return 'shared'}
    catch(error){
      if((error as Error)?.name==='AbortError')return 'cancelled';
      // Anything else - a browser that claimed it could and then would not -
      // still leaves the person with the card.
    }
  }
  const url=URL.createObjectURL(file);
  const link=document.createElement('a');
  link.href=url;link.download=file.name;document.body.appendChild(link);
  link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),10_000);
  return 'downloaded';
}
