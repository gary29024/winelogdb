import type { WineInput, WineRecord } from '../../lib/db/schema';
const auth=()=>({'Authorization':`Bearer ${localStorage.getItem('session')??''}`,'Content-Type':'application/json'});
export async function listWines(params:URLSearchParams):Promise<{items:WineRecord[];nextOffset:number|null}>{const r=await fetch(`/api/wines?${params}`,{headers:auth()});if(!r.ok)throw new Error('Could not load wines');return r.json()}
export async function getWine(id:string):Promise<WineRecord>{const r=await fetch(`/api/wines/${id}`,{headers:auth()});if(!r.ok)throw new Error('Wine not found');return r.json()}
export async function saveWine(input:WineInput,id?:string){const r=await fetch(id?`/api/wines/${id}`:'/api/wines',{method:id?'PUT':'POST',headers:auth(),body:JSON.stringify(input)});if(!r.ok)throw new Error('Could not save wine');return r.json()}
export async function deleteWine(id:string){const r=await fetch(`/api/wines/${id}`,{method:'DELETE',headers:auth()});if(!r.ok)throw new Error('Could not delete wine')}
