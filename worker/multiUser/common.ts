export { ApiError,boundedBytes,hash,seconds,stamp } from '../../src/lib/credits/primitives';
import { ApiError,stamp } from '../../src/lib/credits/primitives';
export type Member={id:string;email:string;display_name:string;handle?:string|null;role:'owner'|'member';status:'active'|'suspended';tour_state?:string};
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
export type PilotSettings={memberLimit:number;memberStorageBytes:number;totalStorageBytes:number;aiConcurrency:number;aiDailyOperations:number;aiDailyEmbeddingRequests:number;researchRunsPerWeek?:number;aiMonthlyBudgetUsd:number;aiUnitBudgetUsd:number;cloudflareWarningUsd:number;cloudflareStopUsd:number;cloudflareObservedUsd:number;cloudflareObservedMonth:string;allowOverages:boolean;cloudflareAutoRolled?:boolean};
/**
 * Pilot settings, rolled into the current month when needed.
 *
 * The Cloudflare cost is typed in by the owner for one month at a time. It used
 * to pause member AI on the 1st until the owner entered the new month; now the
 * month moves forward on its own and the new month's cost starts at 0, because
 * the Cloudflare bill restarts monthly. cloudflareAutoRolled marks the figure as
 * not yet confirmed, so Owner controls can ask for it; saving settings clears it.
 * The monthly AI budget, which the app measures itself, still caps member work.
 */
export async function settings(db:D1Database){
 const row=await db.prepare('SELECT value_json FROM pilot_settings WHERE id=1').first<{value_json:string}>();
 if(!row)throw new ApiError(503,'Owner must configure pilot budgets first');
 let value=JSON.parse(row.value_json) as PilotSettings;
 const month=stamp().slice(0,7);
 if(value.cloudflareObservedMonth!==month){
  // Guarded on the old month so concurrent first requests of the month roll it once.
  await db.prepare("UPDATE pilot_settings SET value_json=json_set(value_json,'$.cloudflareObservedMonth',?,'$.cloudflareObservedUsd',0,'$.cloudflareAutoRolled',json('true')) WHERE id=1 AND json_extract(value_json,'$.cloudflareObservedMonth') IS NOT ?").bind(month,month).run();
  value={...value,cloudflareObservedMonth:month,cloudflareObservedUsd:0,cloudflareAutoRolled:true};
 }
 return {...value,researchRunsPerWeek:Number.isSafeInteger(value.researchRunsPerWeek)&&Number(value.researchRunsPerWeek)>0?Number(value.researchRunsPerWeek):2};
}
