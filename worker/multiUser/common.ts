export { ApiError,boundedBytes,hash,seconds,stamp } from '../../src/lib/credits/primitives';
import { ApiError } from '../../src/lib/credits/primitives';
export type Member={id:string;email:string;display_name:string;role:'owner'|'member';status:'active'|'suspended'};
export type IdentityEnv={DB:D1Database;AUTH_SECRET:string;APP_URL:string;SUPPORT_EMAIL?:string;GOOGLE_CLIENT_ID?:string;GOOGLE_CLIENT_SECRET?:string;OWNER_GOOGLE_SUB?:string;OWNER_EMAIL?:string};
export const json=(body:unknown,status=200,headers:HeadersInit={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...headers}});
export const randomToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
export function cookie(request:Request,name:string){return request.headers.get('Cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(`${name}=`))?.slice(name.length+1)||''}
export const setCookie=(name:string,value:string,age:number)=>`${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${age}`;
export function appOrigin(env:Pick<IdentityEnv,'APP_URL'>){
 try{
  const url=new URL(env.APP_URL);
  if(url.username||url.password||url.search||url.hash||(url.pathname&&url.pathname!=='/'))throw new Error('APP_URL must be an origin');
  return url.origin;
 }catch{throw new ApiError(503,'APP_URL is not configured as a valid application origin')}
}
export async function body(request:Request):Promise<Record<string,unknown>>{const value=await request.json().catch(()=>null);if(!value||typeof value!=='object'||Array.isArray(value))throw new ApiError(400,'Expected a JSON object');return value as Record<string,unknown>}
export function ownerOnly(member:Member){if(member.role!=='owner')throw new ApiError(403,'Owner access required')}
export function textField(value:unknown,max=200){if(typeof value!=='string'||!value.trim()||value.length>max)throw new ApiError(400,'Invalid text field');return value.trim()}
export function positive(value:unknown,max=1_000_000){if(!Number.isSafeInteger(value)||Number(value)<=0||Number(value)>max)throw new ApiError(400,'Expected a positive integer');return Number(value)}
export type PilotSettings={memberLimit:number;memberStorageBytes:number;totalStorageBytes:number;aiConcurrency:number;aiDailyOperations:number;aiDailyEmbeddingRequests:number;aiMonthlyBudgetUsd:number;aiUnitBudgetUsd:number;cloudflareWarningUsd:number;cloudflareStopUsd:number;cloudflareObservedUsd:number;cloudflareObservedMonth:string;allowOverages:boolean};
export async function settings(db:D1Database){const row=await db.prepare('SELECT value_json FROM pilot_settings WHERE id=1').first<{value_json:string}>();if(!row)throw new ApiError(503,'Owner must configure pilot budgets first');return JSON.parse(row.value_json) as PilotSettings}
