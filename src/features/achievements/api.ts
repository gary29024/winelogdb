import { authHeaders,clearSession } from '../../lib/auth/client';
import { registerSummaryCache } from '../../lib/cache/summaryCaches';
import { createSessionCache } from '../../lib/cache/sessionCache';
import type { AchievementCatalogueOptions,AchievementMatchMode,AchievementProgress,CustomAchievementInput } from './types';

async function requireJson<T>(response:Response,message:string):Promise<T>{
  if(response.status===401){clearSession();throw new Error('Session expired. Please sign in again.')}
  const body=await response.json().catch(()=>({})) as T&{error?:string;issues?:Array<{path?:Array<string|number>;message?:string}>};
  if(!response.ok){const details=body.issues?.map(issue=>`${issue.path?.join('.')||'field'}: ${issue.message||'Invalid input'}`).join('; ');throw new Error([body.error||message,details].filter(Boolean).join(' — '))}
  return body;
}
const achievementCache=createSessionCache(async()=>{
  const response=await fetch('/api/achievements',{headers:authHeaders()});
  return requireJson<AchievementProgress[]>(response,'Could not load wine collections');
});
export const invalidateAchievementProgress=achievementCache.invalidate;
registerSummaryCache(invalidateAchievementProgress);
export const getAchievementProgress=achievementCache.get;
export async function getAchievementCatalogueOptions(){
  const response=await fetch('/api/achievements/catalogue-options',{headers:authHeaders()});
  return requireJson<AchievementCatalogueOptions>(response,'Could not load catalogue targets');
}
export async function saveCustomAchievement(input:CustomAchievementInput,id?:string){
  const response=await fetch(id?`/api/achievements/custom/${id}`:'/api/achievements/custom',{method:id?'PUT':'POST',headers:authHeaders(true),body:JSON.stringify(input)});
  const result=await requireJson<{id:string}>(response,id?'Could not update collection':'Could not create collection');invalidateAchievementProgress();return result;
}
export async function deleteCustomAchievement(id:string){
  const response=await fetch(`/api/achievements/custom/${id}`,{method:'DELETE',headers:authHeaders(true),body:JSON.stringify({confirmation:'DELETE_COLLECTION'})});
  const result=await requireJson<{deleted:true}>(response,'Could not delete collection');invalidateAchievementProgress();return result;
}
export async function setAchievementMatchMode(id:string,matchMode:AchievementMatchMode){
  const response=await fetch(`/api/achievements/${id}/match-mode`,{method:'PUT',headers:authHeaders(true),body:JSON.stringify({matchMode})});
  const result=await requireJson<{matchMode:AchievementMatchMode}>(response,'Could not update collection matching');invalidateAchievementProgress();return result;
}
