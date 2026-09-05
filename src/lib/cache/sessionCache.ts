import { getSession } from '../auth/client';

/** Share concurrent reads without allowing an older request to undo invalidation. */
export function createSessionCache<T>(load:()=>Promise<T>,ttlMs=30_000){
  let session:string|null|undefined;
  let generation=0;
  let cached:{data:T;expires:number}|null=null;
  let pending:Promise<T>|null=null;
  const invalidate=()=>{generation++;cached=null;pending=null};
  const get=():Promise<T>=>{
    const currentSession=getSession();
    if(session!==currentSession){invalidate();session=currentSession}
    if(cached&&cached.expires>Date.now())return Promise.resolve(cached.data);
    if(pending)return pending;
    const startedGeneration=generation;
    const request=load().then(data=>{
      if(generation===startedGeneration&&getSession()===currentSession){
        cached={data,expires:Date.now()+ttlMs};
      }
      return data;
    }).finally(()=>{if(pending===request)pending=null});
    pending=request;
    return request;
  };
  return {get,invalidate};
}
