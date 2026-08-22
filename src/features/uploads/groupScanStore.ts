import type { GroupRecognitionWine } from '../recognition/groupSchema';
import type { WinePhoto } from '../wines/api';
import { authHeaders } from '../../lib/auth/client';
import type { PhotoMetadata } from './photoMetadata';

export type GroupScanStoredItem={key:string;recognition:GroupRecognitionWine|null;crop:WinePhoto|null;savedId:string|null;removed:boolean;manual:boolean};
export type GroupScanStoredSession={id:string;createdAt:string;updatedAt:string;photo:File;recognitionPhoto:File;metadata:PhotoMetadata;width:number;height:number;unresolvedCount:number;items:GroupScanStoredItem[]};
export type GroupScanHistoryItem={id:string;createdAt:string;updatedAt:string;expiresAt:string|null;retained:boolean;totalItems:number;savedItems:number;pendingItems:number;firstWineName:string|null};
type ServerItem={key:string;recognition:GroupRecognitionWine|null;savedId:string|null;removed:boolean;manual:boolean;hasCrop:boolean;cropWidth:number;cropHeight:number;position:number};
type ServerSession={id:string;status:string;createdAt:string;updatedAt:string;expiresAt:string|null;retained:boolean;metadata:PhotoMetadata;width:number;height:number;unresolvedCount:number;items:ServerItem[]};
type ApiError={error?:unknown};

const knownSessions=new Set<string>();
const creating=new Map<string,Promise<void>>();
async function read<T>(response:Response,message:string):Promise<T>{const body=await response.json().catch(()=>({})) as ApiError&T;if(!response.ok)throw new Error(typeof body.error==='string'?body.error:`${message} (${response.status})`);return body as T}
async function fetchFile(url:string,name:string){const response=await fetch(url,{headers:authHeaders(),cache:'no-store'});if(!response.ok)throw new Error(`Could not restore Group Photo image (${response.status})`);const blob=await response.blob();return new File([blob],name,{type:blob.type||'application/octet-stream',lastModified:Date.now()})}
function statePayload(session:GroupScanStoredSession){return {createdAt:session.createdAt,updatedAt:session.updatedAt,metadata:session.metadata,width:session.width,height:session.height,unresolvedCount:session.unresolvedCount,items:session.items.map(item=>({key:item.key,recognition:item.recognition,savedId:item.savedId,removed:item.removed,manual:item.manual,cropWidth:item.crop?.width??1,cropHeight:item.crop?.height??1}))}}
async function updateState(session:GroupScanStoredSession){await read<ServerSession>(await fetch(`/api/group-recognition/sessions/${encodeURIComponent(session.id)}`,{method:'PUT',headers:authHeaders(true),body:JSON.stringify(statePayload(session))}),'Could not update Group Photo history')}
async function createServerSession(session:GroupScanStoredSession){
  const fd=new FormData();fd.append('original',session.photo);fd.append('recognitionImage',session.recognitionPhoto);fd.append('session',JSON.stringify(statePayload(session)));
  const cropKeys:Array<{key:string;width:number;height:number}>=[];for(const item of session.items){if(!item.crop)continue;fd.append('crops',item.crop.file);cropKeys.push({key:item.key,width:item.crop.width,height:item.crop.height})}fd.append('cropKeys',JSON.stringify(cropKeys));
  await read<ServerSession>(await fetch(`/api/group-recognition/sessions/${encodeURIComponent(session.id)}`,{method:'PUT',headers:authHeaders(),body:fd}),'Could not save Group Photo history');knownSessions.add(session.id);
}

export async function saveGroupScanSession(session:GroupScanStoredSession){if(knownSessions.has(session.id)){await updateState(session);return}const pending=creating.get(session.id);if(pending){await pending;await updateState(session);return}const task=createServerSession(session).finally(()=>creating.delete(session.id));creating.set(session.id,task);await task}
export async function getGroupScanSession(id:string):Promise<GroupScanStoredSession|null>{
  const response=await fetch(`/api/group-recognition/sessions/${encodeURIComponent(id)}`,{headers:authHeaders(),cache:'no-store'});if(response.status===404)return null;const session=await read<ServerSession>(response,'Could not load Group Photo history');knownSessions.add(id);
  const [photo,recognitionPhoto]=await Promise.all([fetchFile(`/api/group-recognition/sessions/${encodeURIComponent(id)}/image/original`,'group-photo-source'),fetchFile(`/api/group-recognition/sessions/${encodeURIComponent(id)}/image/preview`,'group-photo-preview.jpg')]);
  const items=await Promise.all(session.items.map(async item=>{const crop=item.hasCrop?await fetchFile(`/api/group-recognition/sessions/${encodeURIComponent(id)}/items/${encodeURIComponent(item.key)}/crop`,'group-wine.jpg'):null;return {key:item.key,recognition:item.recognition,crop:crop?{file:crop,metadata:session.metadata,width:item.cropWidth,height:item.cropHeight}:null,savedId:item.savedId,removed:item.removed,manual:item.manual} satisfies GroupScanStoredItem}));
  return {id:session.id,createdAt:session.createdAt,updatedAt:session.updatedAt,photo,recognitionPhoto,metadata:session.metadata,width:session.width,height:session.height,unresolvedCount:session.unresolvedCount,items};
}
export async function listGroupScanSessions():Promise<GroupScanHistoryItem[]>{const result=await read<{items:GroupScanHistoryItem[]}>(await fetch('/api/group-recognition/sessions',{headers:authHeaders(),cache:'no-store'}),'Could not load Group Photo history');for(const item of result.items)knownSessions.add(item.id);return result.items}
export async function deleteGroupScanSession(id:string){await read<{ok:true}>(await fetch(`/api/group-recognition/sessions/${encodeURIComponent(id)}`,{method:'DELETE',headers:authHeaders()}),'Could not remove Group Photo history');knownSessions.delete(id)}
export async function linkGroupScanWine(sessionId:string,itemKey:string,wineId:string){const pending=creating.get(sessionId);if(pending)await pending;return read<{ok:true;wineId:string;sessionId:string;clientKey:string}>(await fetch(`/api/group-recognition/sessions/${encodeURIComponent(sessionId)}/items/${encodeURIComponent(itemKey)}/link`,{method:'POST',headers:authHeaders(true),body:JSON.stringify({wineId})}),'Wine was saved, but its Group Photo source could not be linked')}
export async function fetchGroupSourcePreview(sessionId:string){return fetchFile(`/api/group-recognition/sessions/${encodeURIComponent(sessionId)}/image/preview`,'group-photo-source.jpg')}
