import type { WineInput, WineRecord } from '../../lib/db/schema';
import type { PhotoMetadata } from '../uploads/photoMetadata';
import { authHeaders,clearSession } from '../../lib/auth/client';

export type WinePhoto={file:File;metadata?:PhotoMetadata;width:number;height:number};
export type JournalWine={
  id:string;
  producer:string;
  wineName:string;
  vintage:number|null;
  country:string|null;
  region:string|null;
  appellation:string|null;
  grapes:string[];
  wineStyle:string|null;
  tastingName:string|null;
  rating:number|null;
  tastingDate:string|null;
  imageIds:string[];
  createdAt:string;
};

type ApiIssue={path?:Array<string|number>;message?:string};
async function requireOk(r:Response,message:string){
  if(r.status===401){clearSession();throw new Error('Session expired. Please sign in again.')}
  if(!r.ok){
    const body=await r.json().catch(()=>({})) as {error?:string;issues?:ApiIssue[]};
    const details=body.issues?.map(issue=>`${issue.path?.join('.')||'field'}: ${issue.message||'Invalid input'}`).join('; ');
    throw new Error([body.error||message,details].filter(Boolean).join(' — '));
  }
}
export async function listWines(params:URLSearchParams,options:{limit?:number;offset?:number;signal?:AbortSignal}={}):Promise<{items:JournalWine[];nextOffset:number|null}>{
  const query=new URLSearchParams(params);
  query.set('limit',String(options.limit??36));
  query.set('offset',String(options.offset??0));
  const r=await fetch(`/api/journal?${query}`,{headers:authHeaders(),signal:options.signal});
  await requireOk(r,'Could not load wines');
  return r.json();
}
export async function getWine(id:string):Promise<WineRecord>{const r=await fetch(`/api/wines/${id}`,{headers:authHeaders()});await requireOk(r,'Wine not found');return r.json()}
export async function saveWine(input:WineInput,id?:string,photos:WinePhoto[]=[]):Promise<{id:string}|{ok:true}>{
  if(id){const r=await fetch(`/api/wines/${id}`,{method:'PUT',headers:authHeaders(true),body:JSON.stringify(input)});await requireOk(r,'Could not save wine');return r.json() as Promise<{ok:true}>}
  if(photos.length){
    const fd=new FormData();fd.append('wine',JSON.stringify(input));
    photos.forEach(x=>fd.append('images',x.file));
    fd.append('dimensions',JSON.stringify(photos.map(x=>({width:x.width,height:x.height}))));
    fd.append('metadata',JSON.stringify(photos.map(x=>x.metadata??{capturedAt:null,latitude:null,longitude:null,source:'none'})));
    const r=await fetch('/api/wines',{method:'POST',headers:authHeaders(),body:fd});await requireOk(r,'Could not save wine and photos');return r.json() as Promise<{id:string}>;
  }
  const r=await fetch('/api/wines',{method:'POST',headers:authHeaders(true),body:JSON.stringify(input)});await requireOk(r,'Could not save wine');return r.json() as Promise<{id:string}>;
}
export async function deleteWine(id:string){const r=await fetch(`/api/wines/${id}`,{method:'DELETE',headers:authHeaders()});await requireOk(r,'Could not delete wine')}
