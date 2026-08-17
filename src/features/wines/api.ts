import type { WineInput, WineRecord } from '../../lib/db/schema';
import { authHeaders,clearSession } from '../../lib/auth/client';
async function requireOk(r:Response,message:string){if(r.status===401){clearSession();throw new Error('Session expired. Please sign in again.')}if(!r.ok){const body=await r.json().catch(()=>({})) as {error?:string};throw new Error(body.error||message)}}
export async function listWines(params:URLSearchParams):Promise<{items:WineRecord[];nextOffset:number|null}>{const r=await fetch(`/api/wines?${params}`,{headers:authHeaders()});await requireOk(r,'Could not load wines');return r.json()}
export async function getWine(id:string):Promise<WineRecord>{const r=await fetch(`/api/wines/${id}`,{headers:authHeaders()});await requireOk(r,'Wine not found');return r.json()}
export async function saveWine(input:WineInput,id?:string):Promise<{id:string}|{ok:true}>{const r=await fetch(id?`/api/wines/${id}`:'/api/wines',{method:id?'PUT':'POST',headers:authHeaders(true),body:JSON.stringify(input)});await requireOk(r,'Could not save wine');return r.json() as Promise<{id:string}|{ok:true}>}
export async function deleteWine(id:string){const r=await fetch(`/api/wines/${id}`,{method:'DELETE',headers:authHeaders()});await requireOk(r,'Could not delete wine')}
