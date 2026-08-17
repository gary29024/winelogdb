import type { WineInput, WineRecord } from '../../lib/db/schema';
import type { PhotoMetadata } from '../uploads/photoMetadata';
import { authHeaders,clearSession } from '../../lib/auth/client';

export type WinePhoto={file:File;metadata?:PhotoMetadata;width:number;height:number};

async function requireOk(r:Response,message:string){if(r.status===401){clearSession();throw new Error('Session expired. Please sign in again.')}if(!r.ok){const body=await r.json().catch(()=>({})) as {error?:string};throw new Error(body.error||message)}}
export async function listWines(params:URLSearchParams):Promise<{items:WineRecord[];nextOffset:number|null}>{const r=await fetch(`/api/wines?${params}`,{headers:authHeaders()});await requireOk(r,'Could not load wines');return r.json()}
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
