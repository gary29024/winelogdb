import { authHeaders } from '../../lib/auth/client';
import type { WineInput } from '../../lib/db/schema';
import type { RecognitionResult } from '../recognition/schema';
import type { PhotoMetadata } from './photoMetadata';

export type BatchSessionSummary={id:string;status:string;totalItems:number;expectedItems:number;confirmedItems:number;createdAt:string;updatedAt:string;expiresAt:string};
export type BatchRecognitionItem={id:string;position:number;status:'staged'|'submitted'|'ready'|'failed'|'confirmed'|'rejected'|'expired';recognition:RecognitionResult|null;error:string|null;confirmedWineId:string|null;imageIds:string[]};
export type BatchRecognitionSession=BatchSessionSummary&{items:BatchRecognitionItem[]};

type StagePhoto={original:File;recognition:File;metadata:PhotoMetadata;width:number;height:number};
type ApiErrorBody={error?:unknown};
export class BatchApiError extends Error{constructor(message:string,readonly status:number){super(message);this.name='BatchApiError'}}
async function read<T>(r:Response,message:string):Promise<T>{const body=await r.json().catch(()=>({})) as ApiErrorBody&Record<string,unknown>;if(!r.ok)throw new BatchApiError(typeof body.error==='string'?body.error:`${message} (${r.status})`,r.status);return body as T}
export async function listBatchSessions(){const result=await read<{items:BatchSessionSummary[]}>(await fetch('/api/batch-recognition/sessions',{headers:authHeaders()}),'Could not load Batch Scan sessions');result.items.sort((a,b)=>{const aIncomplete=a.status==='uploading'?0:1,bIncomplete=b.status==='uploading'?0:1;return aIncomplete-bIncomplete||Date.parse(b.updatedAt)-Date.parse(a.updatedAt)});return result}
export async function createBatchSession(expectedItems:number){return read<{id:string;status:string;createdAt:string;expiresAt:string;expectedItems:number}>(await fetch('/api/batch-recognition/sessions',{method:'POST',headers:authHeaders(true),body:JSON.stringify({expectedItems})}),'Could not create Batch Scan')}
export async function getBatchSession(id:string){return read<BatchRecognitionSession>(await fetch(`/api/batch-recognition/sessions/${id}`,{headers:authHeaders()}),'Could not load Batch Scan')}

export function isRetryableBatchUploadStatus(status:number){return status===0||status===408||status===425||status===429||status>=500}
export function batchUploadRetryDelay(attempt:number){return attempt<=0?700:attempt===1?1500:3000}
function abortableDelay(ms:number,signal?:AbortSignal){return new Promise<void>((resolve,reject)=>{if(signal?.aborted){reject(new DOMException('Upload aborted','AbortError'));return}const timer=window.setTimeout(()=>{signal?.removeEventListener('abort',onAbort);resolve()},ms);const onAbort=()=>{window.clearTimeout(timer);reject(new DOMException('Upload aborted','AbortError'))};signal?.addEventListener('abort',onAbort,{once:true})})}

async function stagedWineIfComplete(sessionId:string,position:number,photoCount:number){
  try{
    const current=await getBatchSession(sessionId),item=current.items.find(candidate=>candidate.position===position);
    if(item&&item.imageIds.length===photoCount)return {id:item.id,position,photoCount:item.imageIds.length,preparedBytes:0,resumed:true as const};
  }catch{/* A failed reconciliation should not hide the original upload error. */}
  return null;
}

async function stageBatchWineOnce(sessionId:string,position:number,photos:StagePhoto[],signal?:AbortSignal){
  const fd=new FormData();for(const photo of photos){fd.append('originals',photo.original);fd.append('recognitionImages',photo.recognition)}fd.append('position',String(position));fd.append('metadata',JSON.stringify(photos.map(x=>x.metadata)));fd.append('dimensions',JSON.stringify(photos.map(x=>({width:x.width,height:x.height}))));
  return read<{id:string;position:number;photoCount:number;preparedBytes:number;resumed?:boolean}>(await fetch(`/api/batch-recognition/sessions/${sessionId}/items`,{method:'POST',headers:authHeaders(),body:fd,signal}),'Could not stage wine');
}

export async function stageBatchWine(sessionId:string,position:number,photos:StagePhoto[],signal?:AbortSignal){
  const alreadyStaged=await stagedWineIfComplete(sessionId,position,photos.length);if(alreadyStaged)return alreadyStaged;
  let lastError:unknown;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const staged=await stageBatchWineOnce(sessionId,position,photos,signal);
      if(staged.photoCount!==photos.length)throw new BatchApiError(`Wine ${position+1} is only partially staged on the server. Retry after the incomplete staging record is repaired.`,409);
      return staged;
    }catch(error){
      lastError=error;if(signal?.aborted||(error instanceof DOMException&&error.name==='AbortError'))throw error;
      const reconciled=await stagedWineIfComplete(sessionId,position,photos.length);if(reconciled)return reconciled;
      const status=error instanceof BatchApiError?error.status:0;if(!isRetryableBatchUploadStatus(status)||attempt===2)throw error;
      await abortableDelay(batchUploadRetryDelay(attempt),signal);
    }
  }
  throw lastError instanceof Error?lastError:new Error('Could not stage wine');
}

export async function submitBatchSession(id:string){return read<{accepted:true;sessionId:string}>(await fetch(`/api/batch-recognition/sessions/${id}/submit`,{method:'POST',headers:authHeaders(true),body:'{}'}),'Could not submit Batch Scan')}
export async function removeBatchSession(id:string){return read<{ok:true;confirmedItems:number}>(await fetch(`/api/batch-recognition/sessions/${id}`,{method:'DELETE',headers:authHeaders()}),'Could not remove Batch Scan')}
export async function confirmBatchWine(sessionId:string,itemId:string,wine:WineInput){return read<{id:string}>(await fetch(`/api/batch-recognition/sessions/${sessionId}/items/${itemId}/confirm`,{method:'POST',headers:authHeaders(true),body:JSON.stringify({wine})}),'Could not save this wine')}
export async function rejectBatchWine(sessionId:string,itemId:string){return read<{ok:true}>(await fetch(`/api/batch-recognition/sessions/${sessionId}/items/${itemId}/reject`,{method:'POST',headers:authHeaders(true),body:'{}'}),'Could not discard this wine')}
export const batchImageUrl=(id:string)=>`/api/batch-recognition/images/${id}`;
