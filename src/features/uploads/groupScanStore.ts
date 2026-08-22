import type { GroupRecognitionWine } from '../recognition/groupSchema';
import type { WinePhoto } from '../wines/api';
import type { PhotoMetadata } from './photoMetadata';

type StoredFile={blob:Blob;name:string;type:string;lastModified:number};
type StoredWinePhoto={file:StoredFile;metadata?:PhotoMetadata;width?:number;height?:number};
type StoredReviewItem={key:string;recognition:GroupRecognitionWine|null;crop:StoredWinePhoto|null;savedId:string|null;removed:boolean;manual:boolean};
type StoredGroupSession={id:string;createdAt:string;updatedAt:string;photo:StoredFile;metadata:PhotoMetadata;width:number;height:number;unresolvedCount:number;items:StoredReviewItem[]};

export type GroupScanStoredItem={key:string;recognition:GroupRecognitionWine|null;crop:WinePhoto|null;savedId:string|null;removed:boolean;manual:boolean};
export type GroupScanStoredSession={id:string;createdAt:string;updatedAt:string;photo:File;metadata:PhotoMetadata;width:number;height:number;unresolvedCount:number;items:GroupScanStoredItem[]};
export type GroupScanHistoryItem={id:string;createdAt:string;updatedAt:string;totalItems:number;savedItems:number;pendingItems:number;firstWineName:string|null};

const DB_NAME='winelog-group-scans';
const STORE='sessions';
const VERSION=1;
const MAX_SESSIONS=12;

function openDb(){
  return new Promise<IDBDatabase>((resolve,reject)=>{
    if(typeof indexedDB==='undefined'){reject(new Error('Browser storage is unavailable'));return}
    const request=indexedDB.open(DB_NAME,VERSION);
    request.onerror=()=>reject(request.error??new Error('Could not open group scan storage'));
    request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'})};
    request.onsuccess=()=>resolve(request.result);
  });
}
function requestResult<T>(request:IDBRequest<T>){return new Promise<T>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error??new Error('Group scan storage request failed'))})}
function transactionDone(transaction:IDBTransaction){return new Promise<void>((resolve,reject)=>{transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error??new Error('Group scan storage transaction failed'));transaction.onabort=()=>reject(transaction.error??new Error('Group scan storage transaction aborted'))})}
function storedFile(file:File):StoredFile{return {blob:file.slice(0,file.size,file.type||'application/octet-stream'),name:file.name||'photo',type:file.type||'',lastModified:Number(file.lastModified)||Date.now()}}
function restoredFile(value:StoredFile,fallbackName:string){return new File([value.blob],value.name||fallbackName,{type:value.type||value.blob.type||'application/octet-stream',lastModified:Number(value.lastModified)||Date.now()})}
function storedPhoto(photo:WinePhoto):StoredWinePhoto{return {file:storedFile(photo.file),metadata:photo.metadata,width:photo.width,height:photo.height}}
function restoredPhoto(photo:StoredWinePhoto):WinePhoto{return {file:restoredFile(photo.file,'group-wine.jpg'),metadata:photo.metadata,width:Math.max(1,Number(photo.width)||1),height:Math.max(1,Number(photo.height)||1)}}
async function requestPersistentStorage(){try{if(typeof navigator!=='undefined'&&navigator.storage?.persist)await navigator.storage.persist()}catch{/* Best effort only. */}}

function toStored(session:GroupScanStoredSession):StoredGroupSession{
  return {...session,photo:storedFile(session.photo),items:session.items.map(item=>({...item,crop:item.crop?storedPhoto(item.crop):null}))};
}
function fromStored(session:StoredGroupSession):GroupScanStoredSession{
  return {...session,photo:restoredFile(session.photo,'group-recognition.jpg'),items:session.items.map(item=>({...item,crop:item.crop?restoredPhoto(item.crop):null}))};
}
function summary(session:StoredGroupSession):GroupScanHistoryItem{
  const visible=session.items.filter(item=>!item.removed),savedItems=visible.filter(item=>Boolean(item.savedId)).length;
  return {id:session.id,createdAt:session.createdAt,updatedAt:session.updatedAt,totalItems:visible.length,savedItems,pendingItems:visible.length-savedItems,firstWineName:visible.find(item=>item.recognition?.wineName)?.recognition?.wineName??null};
}

export async function saveGroupScanSession(session:GroupScanStoredSession){
  await requestPersistentStorage();
  const db=await openDb();
  try{
    const transaction=db.transaction(STORE,'readwrite'),done=transactionDone(transaction),store=transaction.objectStore(STORE);
    store.put(toStored(session));
    await done;
    const rows=await requestResult(db.transaction(STORE,'readonly').objectStore(STORE).getAll() as IDBRequest<StoredGroupSession[]>);
    const stale=rows.sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt)).slice(MAX_SESSIONS);
    if(stale.length){const cleanup=db.transaction(STORE,'readwrite'),cleanupDone=transactionDone(cleanup),cleanupStore=cleanup.objectStore(STORE);for(const row of stale)cleanupStore.delete(row.id);await cleanupDone}
  }finally{db.close()}
}
export async function getGroupScanSession(id:string){
  const db=await openDb();
  try{const row=await requestResult(db.transaction(STORE,'readonly').objectStore(STORE).get(id) as IDBRequest<StoredGroupSession|undefined>);return row?fromStored(row):null}finally{db.close()}
}
export async function listGroupScanSessions():Promise<GroupScanHistoryItem[]>{
  const db=await openDb();
  try{const rows=await requestResult(db.transaction(STORE,'readonly').objectStore(STORE).getAll() as IDBRequest<StoredGroupSession[]>);return rows.map(summary).sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt))}finally{db.close()}
}
export async function deleteGroupScanSession(id:string){
  const db=await openDb();
  try{const transaction=db.transaction(STORE,'readwrite'),done=transactionDone(transaction);transaction.objectStore(STORE).delete(id);await done}finally{db.close()}
}
