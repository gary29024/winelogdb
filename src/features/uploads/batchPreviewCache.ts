import { authHeaders } from '../../lib/auth/client';
import { batchImageUrl } from './batchApi';

const MAX_CACHED_PREVIEWS=48;
const previewBlobs=new Map<string,Blob>();
const previewRequests=new Map<string,Promise<Blob>>();

function cachedPreview(id:string){
  const blob=previewBlobs.get(id);if(!blob)return undefined;
  previewBlobs.delete(id);previewBlobs.set(id,blob);return blob;
}

function rememberPreview(id:string,blob:Blob){
  previewBlobs.delete(id);previewBlobs.set(id,blob);
  while(previewBlobs.size>MAX_CACHED_PREVIEWS){
    const oldest=previewBlobs.keys().next().value as string|undefined;if(!oldest)break;
    previewBlobs.delete(oldest);
  }
}

const wait=(ms:number)=>new Promise(resolve=>window.setTimeout(resolve,ms));

async function fetchPreview(id:string){
  let lastError:unknown;
  for(let attempt=0;attempt<3;attempt++){
    if(attempt)await wait(600*attempt);
    try{
      // Keep the network request uncached: these are authenticated temporary
      // objects and a failed response must never be replayed by the browser.
      // Successful blobs are cached below only after the body has arrived.
      const response=await fetch(batchImageUrl(id),{headers:authHeaders(),cache:'no-store'});
      if(!response.ok)throw new Error(`Preview failed (${response.status})`);
      return await response.blob();
    }catch(error){lastError=error}
  }
  throw lastError instanceof Error?lastError:new Error('Preview failed');
}

/**
 * One staged image can be rendered in both the batch card and review sheet.
 * Share the in-flight R2 read and retain a bounded successful-blob LRU so
 * opening/closing review does not hit the same R2 object again.
 */
export function loadBatchPreviewBlob(id:string):Promise<Blob>{
  const cached=cachedPreview(id);if(cached)return Promise.resolve(cached);
  const pending=previewRequests.get(id);if(pending)return pending;
  const request=fetchPreview(id)
    .then(blob=>{rememberPreview(id,blob);return blob})
    .finally(()=>previewRequests.delete(id));
  previewRequests.set(id,request);return request;
}

/** A confirmed/discarded staged object no longer needs to occupy mobile memory. */
export function forgetBatchPreview(id:string){previewBlobs.delete(id)}

/** Test seam: this cache intentionally survives component remounts. */
export function resetBatchPreviewCache(){previewBlobs.clear();previewRequests.clear()}
