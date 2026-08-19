import type { PhotoMetadata } from './photoMetadata';

export type PendingBatchPhoto={original:File;recognition:File;metadata:PhotoMetadata;width:number;height:number};
export type PendingBatchWine={sessionId:string;position:number;photos:PendingBatchPhoto[]};

type StoredBatchWine=PendingBatchWine&{key:string};
const DB_NAME='winelog-batch-uploads';
const STORE='pending-wines';
const VERSION=1;
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
      }
    };
    request.onsuccess=()=>resolve(request.result);
  });
}

function requestResult<T>(request:IDBRequest<T>){return new Promise<T>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error??new Error('Browser storage request failed'))})}
function transactionDone(transaction:IDBTransaction){return new Promise<void>((resolve,reject)=>{transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error??new Error('Browser storage transaction failed'));transaction.onabort=()=>reject(transaction.error??new Error('Browser storage transaction aborted'))})}

export async function savePendingBatchWines(sessionId:string,wines:Array<{position:number;photos:PendingBatchPhoto[]}>){
  const db=await openDb();
  try{
    const transaction=db.transaction(STORE,'readwrite'),store=transaction.objectStore(STORE);
    for(const wine of wines)store.put({key:key(sessionId,wine.position),sessionId,position:wine.position,photos:wine.photos} satisfies StoredBatchWine);
    await transactionDone(transaction);
  }finally{db.close()}
}

export async function listPendingBatchWines(sessionId:string):Promise<PendingBatchWine[]>{
  const db=await openDb();
  try{
    const transaction=db.transaction(STORE,'readonly'),index=transaction.objectStore(STORE).index('sessionId');
    const rows=await requestResult(index.getAll(IDBKeyRange.only(sessionId)) as IDBRequest<StoredBatchWine[]>);
    await transactionDone(transaction);
    return rows.sort((a,b)=>a.position-b.position).map(({sessionId:storedSessionId,position,photos})=>({sessionId:storedSessionId,position,photos}));
  }finally{db.close()}
}

export async function removePendingBatchWine(sessionId:string,position:number){
  const db=await openDb();
  try{const transaction=db.transaction(STORE,'readwrite');transaction.objectStore(STORE).delete(key(sessionId,position));await transactionDone(transaction)}finally{db.close()}
}

export async function clearPendingBatchSession(sessionId:string){
  const db=await openDb();
  try{
    const transaction=db.transaction(STORE,'readwrite'),store=transaction.objectStore(STORE),index=store.index('sessionId');
    const keys=await requestResult(index.getAllKeys(IDBKeyRange.only(sessionId)));
    for(const storedKey of keys)store.delete(storedKey);
    await transactionDone(transaction);
  }finally{db.close()}
}
