import { authHeaders } from '../../lib/auth/client';

const MAX_GROUP_IMAGE_CACHE_BYTES=32*1024*1024;
type CacheEntry={blob:Blob;bytes:number};
const imageBlobs=new Map<string,CacheEntry>();
const imageRequests=new Map<string,Promise<Blob>>();
let cachedBytes=0;

export function groupOriginalImageUrl(sessionId:string){return `/api/group-recognition/sessions/${encodeURIComponent(sessionId)}/image/original`}
export function groupPreviewImageUrl(sessionId:string){return `/api/group-recognition/sessions/${encodeURIComponent(sessionId)}/image/preview`}
export function groupCropImageUrl(sessionId:string,itemKey:string){return `/api/group-recognition/sessions/${encodeURIComponent(sessionId)}/items/${encodeURIComponent(itemKey)}/crop`}

function cachedImage(url:string){
  const entry=imageBlobs.get(url);if(!entry)return undefined;
  imageBlobs.delete(url);imageBlobs.set(url,entry);return entry.blob;
}

export function rememberGroupImageBlob(url:string,blob:Blob){
  const existing=imageBlobs.get(url);if(existing){cachedBytes-=existing.bytes;imageBlobs.delete(url)}
  if(blob.size>MAX_GROUP_IMAGE_CACHE_BYTES)return;
  imageBlobs.set(url,{blob,bytes:blob.size});cachedBytes+=blob.size;
  while(cachedBytes>MAX_GROUP_IMAGE_CACHE_BYTES){
    const oldest=imageBlobs.entries().next().value as [string,CacheEntry]|undefined;if(!oldest)break;
    imageBlobs.delete(oldest[0]);cachedBytes-=oldest[1].bytes;
  }
}

/**
 * Group Photo sessions can expose the same private R2 image through the resume
 * screen and later as source context on a saved wine. Share an in-flight read
 * and keep a byte-bounded successful-blob LRU so those views do not repeatedly
 * read the same temporary/private object. Browser HTTP caching stays disabled.
 */
export function loadGroupImageBlob(url:string):Promise<Blob>{
  const cached=cachedImage(url);if(cached)return Promise.resolve(cached);
  const pending=imageRequests.get(url);if(pending)return pending;
  const request=fetch(url,{headers:authHeaders(),cache:'no-store'})
    .then(async response=>{if(!response.ok)throw new Error(`Could not restore Group Photo image (${response.status})`);return response.blob()})
    .then(blob=>{rememberGroupImageBlob(url,blob);return blob})
    .finally(()=>imageRequests.delete(url));
  imageRequests.set(url,request);return request;
}

export function forgetGroupSessionImages(sessionId:string){
  const prefix=`/api/group-recognition/sessions/${encodeURIComponent(sessionId)}/`;
  for(const [url,entry] of imageBlobs){if(!url.startsWith(prefix))continue;imageBlobs.delete(url);cachedBytes-=entry.bytes}
}

/** Test seam: production cache intentionally survives route/component remounts. */
export function resetGroupImageCache(){imageBlobs.clear();imageRequests.clear();cachedBytes=0}
