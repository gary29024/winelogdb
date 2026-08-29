import { authHeaders,clearSession } from '../../lib/auth/client';
import type { Tasting,TastingSummary,TastingWine } from '../../lib/tastings/session';
import type { TastingDocument } from '../../lib/tastings/documents';

export type { Tasting,TastingSummary,TastingWine,TastingDocument };
export type TastingDetail={tasting:Tasting;wines:TastingWine[];documents:TastingDocument[]};

async function json<T>(r:Response,message:string):Promise<T>{
  if(r.status===401){clearSession();throw new Error('Session expired. Please sign in again.')}
  const body=await r.json().catch(()=>({})) as T&{error?:string};
  if(!r.ok)throw new Error(body.error||message);
  return body;
}

/**
 * The date is the browser's, not the server's: a Worker between midnight and
 * 08:00 in Hong Kong is still on yesterday's UTC date, and this date is the
 * tasting's identity as well as the wine form's prefill.
 */
export const localTastingDate=(now=new Date())=>
  `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

export const startTasting=(input:{name:string;tastingDate:string;venue?:string|null})=>
  fetch('/api/tastings',{method:'POST',headers:authHeaders(true),body:JSON.stringify(input)})
    .then(r=>json<{tasting:Tasting}>(r,'Could not start the tasting'));

export const getActiveTasting=()=>
  fetch('/api/tastings/active',{headers:authHeaders()}).then(r=>json<{tasting:Tasting|null}>(r,'Could not check for an open tasting'));

export const listTastings=()=>
  fetch('/api/tastings',{headers:authHeaders()}).then(r=>json<{items:TastingSummary[]}>(r,'Could not load tastings'));

export const getTasting=(id:string)=>
  fetch(`/api/tastings/${id}`,{headers:authHeaders()}).then(r=>json<TastingDetail>(r,'Tasting not found'));

export const updateTasting=(id:string,patch:{name?:string;venue?:string|null})=>
  fetch(`/api/tastings/${id}`,{method:'PUT',headers:authHeaders(true),body:JSON.stringify(patch)})
    .then(r=>json<{tasting:Tasting}>(r,'Could not update the tasting'));

export const endTasting=(id:string)=>
  fetch(`/api/tastings/${id}/end`,{method:'POST',headers:authHeaders()}).then(r=>json<{tasting:Tasting}>(r,'Could not end the tasting'));

export const reopenTasting=(id:string)=>
  fetch(`/api/tastings/${id}/reopen`,{method:'POST',headers:authHeaders()}).then(r=>json<{tasting:Tasting}>(r,'Could not reopen the tasting'));

export const attachWinesToTasting=(id:string,ids:string[])=>
  fetch(`/api/tastings/${id}/wines`,{method:'POST',headers:authHeaders(true),body:JSON.stringify({ids})})
    .then(r=>json<{attached:number}>(r,'Could not add the selected wines'));

export async function detachWineFromTasting(id:string,wineId:string){
  const response=await fetch(`/api/tastings/${id}/wines/${wineId}`,{method:'DELETE',headers:authHeaders()});
  if(response.status===401){clearSession();throw new Error('Session expired. Please sign in again.')}
  if(!response.ok)throw new Error('Could not remove the wine from this tasting');
}

export async function deleteTasting(id:string){
  const response=await fetch(`/api/tastings/${id}`,{method:'DELETE',headers:authHeaders(true),body:JSON.stringify({confirmation:'DELETE_TASTING'})});
  if(response.status===401){clearSession();throw new Error('Session expired. Please sign in again.')}
  if(!response.ok)throw new Error('Could not delete the tasting');
}

export const uploadTastingDocuments=(id:string,files:File[])=>{
  const form=new FormData();
  for(const file of files)form.append('documents',file);
  return fetch(`/api/tastings/${id}/documents`,{method:'POST',headers:authHeaders(),body:form})
    .then(r=>json<{documents:TastingDocument[]}>(r,'Could not save the wine list'));
};

export async function deleteTastingDocument(documentId:string){
  const response=await fetch(`/api/tastings/documents/${documentId}`,{method:'DELETE',headers:authHeaders()});
  if(response.status===401){clearSession();throw new Error('Session expired. Please sign in again.')}
  if(!response.ok)throw new Error('Could not remove that wine list page');
}
