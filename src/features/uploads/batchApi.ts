import { authHeaders } from '../../lib/auth/client';
import type { WineInput } from '../../lib/db/schema';
import type { RecognitionResult } from '../recognition/schema';
import type { PhotoMetadata } from './photoMetadata';

export type BatchSessionSummary={id:string;status:string;totalItems:number;confirmedItems:number;createdAt:string;updatedAt:string;expiresAt:string};
export type BatchRecognitionItem={id:string;position:number;status:'staged'|'submitted'|'ready'|'failed'|'confirmed'|'rejected'|'expired';recognition:RecognitionResult|null;error:string|null;confirmedWineId:string|null;imageIds:string[]};
export type BatchRecognitionSession=BatchSessionSummary&{items:BatchRecognitionItem[]};

type StagePhoto={original:File;recognition:File;metadata:PhotoMetadata;width:number;height:number};
async function read<T>(r:Response,message:string):Promise<T>{const body=await r.json().catch(()=>({}));if(!r.ok)throw new Error(typeof body?.error==='string'?body.error:`${message} (${r.status})`);return body as T}
export async function listBatchSessions(){return read<{items:BatchSessionSummary[]}>(await fetch('/api/batch-recognition/sessions',{headers:authHeaders()}),'Could not load Batch Scan sessions')}
export async function createBatchSession(){return read<{id:string;status:string;createdAt:string;expiresAt:string}>(await fetch('/api/batch-recognition/sessions',{method:'POST',headers:authHeaders(true),body:'{}'}),'Could not create Batch Scan')}
export async function getBatchSession(id:string){return read<BatchRecognitionSession>(await fetch(`/api/batch-recognition/sessions/${id}`,{headers:authHeaders()}),'Could not load Batch Scan')}
export async function stageBatchWine(sessionId:string,position:number,photos:StagePhoto[]){const fd=new FormData();for(const photo of photos){fd.append('originals',photo.original);fd.append('recognitionImages',photo.recognition)}fd.append('position',String(position));fd.append('metadata',JSON.stringify(photos.map(x=>x.metadata)));fd.append('dimensions',JSON.stringify(photos.map(x=>({width:x.width,height:x.height}))));return read<{id:string;position:number;photoCount:number;preparedBytes:number}>(await fetch(`/api/batch-recognition/sessions/${sessionId}/items`,{method:'POST',headers:authHeaders(),body:fd}),'Could not stage wine')}
export async function submitBatchSession(id:string){return read<{accepted:true;sessionId:string}>(await fetch(`/api/batch-recognition/sessions/${id}/submit`,{method:'POST',headers:authHeaders(true),body:'{}'}),'Could not submit Batch Scan')}
export async function confirmBatchWine(sessionId:string,itemId:string,wine:WineInput){return read<{id:string}>(await fetch(`/api/batch-recognition/sessions/${sessionId}/items/${itemId}/confirm`,{method:'POST',headers:authHeaders(true),body:JSON.stringify({wine})}),'Could not save this wine')}
export async function rejectBatchWine(sessionId:string,itemId:string){return read<{ok:true}>(await fetch(`/api/batch-recognition/sessions/${sessionId}/items/${itemId}/reject`,{method:'POST',headers:authHeaders(true),body:'{}'}),'Could not discard this wine')}
export const batchImageUrl=(id:string)=>`/api/batch-recognition/images/${id}`;
