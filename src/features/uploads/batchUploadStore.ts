import type { PhotoMetadata } from './photoMetadata';

export type PendingBatchPhoto={original:File;recognition:File;metadata:PhotoMetadata;width:number;height:number};
export type PendingBatchWine={sessionId:string;position:number;photos:PendingBatchPhoto[]};

type StoredFile={blob:Blob;name:string;type:string;lastModified:number};
type StoredBatchPhoto={original:StoredFile;recognition:StoredFile;metadata:PhotoMetadata;width:number;height:number};
type StoredBatchWine={key:string;sessionId:string;position:number;photos:unknown[];storageVersion?:number};
const DB_NAME='winelog-batch-uploads';
const STORE='pending-wines';
const VERSION=2;
const key=(sessionId:string,position:number)=>`${sessionId}:${position}`;

function openDb(){
  return new Promise<IDBDatabase>((resolve,reject)=>{
    if(typeof indexedDB==='undefined'){reject(new Error('Browser storage is unavailable'));return}
    const request=indexedDB.open(DB_NAME,VERSION);
    request.onerror=()=>reject(request.error??new Error('Could not open browser storage'));
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains(STORE)){
        const store=db.createObjectStore(STORE,{keyPath:'key'});
        store.createIndex('sessionId','sessionId',{unique:false});
      }else{
        const store=request.transaction?.objectStore(STORE);
        if(store&&!store.indexNames.contains('sessionId'))store.createIndex('sessionId','sessionId',{unique:false});
      }
    };
    request.onsuccess=()=>resolve(request.result);
  });
}

function requestResult<T>(request:IDBRequest<T>){return new Promise<T>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error??new Error('Browser storage request failed'))})}
function transactionDone(transaction:IDBTransaction){return new Promise<void>((resolve,reject)=>{transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error??new Error('Browser storage transaction failed'));transaction.onabort=()=>reject(transaction.error??new Error('Browser storage transaction aborted'))})}

function storedFile(file:File):StoredFile{
  return {blob:file.slice(0,file.size,file.type||'application/octet-stream'),name:file.name||'photo',type:file.type||'',lastModified:Number(file.lastModified)||Date.now()};
}

export function restoreStoredFile(value:unknown,fallbackName:string):File{
  if(value instanceof File)return value;
  if(value instanceof Blob)return new File([value],fallbackName,{type:value.type||'application/octet-stream'});
  if(value&&typeof value==='object'){
    const row=value as Partial<StoredFile>;
    if(row.blob instanceof Blob)return new File([row.blob],String(row.name||fallbackName),{type:String(row.type||row.blob.type||'application/octet-stream'),lastModified:Number(row.lastModified)||Date.now()});
  }
  throw new Error('A saved batch photo could not be restored from browser storage');
}

function storedPhoto(photo:PendingBatchPhoto):StoredBatchPhoto{
  return {original:storedFile(photo.original),recognition:storedFile(photo.recognition),metadata:photo.metadata,width:photo.width,height:photo.height};
}

export function restoreStoredBatchPhoto(value:unknown):PendingBatchPhoto{
  if(!value||typeof value!=='object')throw new Error('A saved batch photo is invalid');
  const row=value as {original?:unknown;recognition?:unknown;metadata?:PhotoMetadata;width?:number;height?:number};
  const original=restoreStoredFile(row.original,'wine-photo');
  const recognition=restoreStoredFile(row.recognition,`${original.name.replace(/\.[^.]+$/, '')||'wine-photo'}.jpg`);
  return {original,recognition,metadata:row.metadata??{capturedAt:null,latitude:null,longitude:null,source:'none'},width:Math.max(1,Number(row.width)||1),height:Math.max(1,Number(row.height)||1)};
}

async function requestPersistentStorage(){
  try{if(typeof navigator!=='undefined'&&navigator.storage?.persist)await navigator.storage.persist()}catch{/* Best effort only. */}
}

export async function savePendingBatchWines(sessionId:string,wines:Array<{position:number;photos:PendingBatchPhoto[]}>){
  await requestPersistentStorage();
  const db=await openDb();
  try{
    const transaction=db.transaction(STORE,'readwrite'),done=transactionDone(transaction),store=transaction.objectStore(STORE);
    for(const wine of wines)store.put({key:key(sessionId,wine.position),sessionId,position:wine.position,photos:wine.photos.map(storedPhoto),storageVersion:2} satisfies StoredBatchWine);
    await done;
  }finally{db.close()}
}

export async function listPendingBatchWines(sessionId:string):Promise<PendingBatchWine[]>{
  const db=await openDb();
  try{
    const transaction=db.transaction(STORE,'readonly'),index=transaction.objectStore(STORE).index('sessionId');
    const rows=await requestResult(index.getAll(IDBKeyRange.only(sessionId)) as IDBRequest<StoredBatchWine[]>);
    return rows.sort((a,b)=>a.position-b.position).map(row=>({sessionId:row.sessionId,position:row.position,photos:row.photos.map(restoreStoredBatchPhoto)}));
  }finally{db.close()}
}

export async function removePendingBatchWine(sessionId:string,position:number){
  const db=await openDb();
  try{const transaction=db.transaction(STORE,'readwrite'),done=transactionDone(transaction);transaction.objectStore(STORE).delete(key(sessionId,position));await done}finally{db.close()}
}

export async function clearPendingBatchSession(sessionId:string){
  const db=await openDb();
  try{
    const readTransaction=db.transaction(STORE,'readonly'),index=readTransaction.objectStore(STORE).index('sessionId');
    const keys=await requestResult(index.getAllKeys(IDBKeyRange.only(sessionId)));
    if(!keys.length)return;
    const writeTransaction=db.transaction(STORE,'readwrite'),done=transactionDone(writeTransaction),store=writeTransaction.objectStore(STORE);
    for(const storedKey of keys)store.delete(storedKey);
    await done;
  }finally{db.close()}
}
