import { apiFetch,authHeaders } from './client';
export async function apiJson<T>(path:string,method='GET',value?:unknown):Promise<T>{
 const response=await apiFetch(path,{method,headers:authHeaders(value!==undefined),body:value===undefined?undefined:JSON.stringify(value)});
 const body=await response.json() as {error?:string};if(!response.ok)throw new Error(body.error||'Request failed');return body as T;
}
