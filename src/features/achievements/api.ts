import { apiFetch } from '../../lib/auth/client';
import { authHeaders,clearSession } from '../../lib/auth/client';
import { registerSummaryCache } from '../../lib/cache/summaryCaches';
import { discard,readShared,useLoad } from '../../lib/query/client';
import type { AchievementCatalogueOptions,AchievementMatchMode,AchievementProgress,CustomAchievementInput } from './types';

async function requireJson<T>(response:Response,message:string):Promise<T>{
  if(response.status===401){clearSession();throw new Error('Session expired. Please sign in again.')}
  const body=await response.json().catch(()=>({})) as T&{error?:string;issues?:Array<{path?:Array<string|number>;message?:string}>};
  if(!response.ok){const details=body.issues?.map(issue=>`${issue.path?.join('.')||'field'}: ${issue.message||'Invalid input'}`).join('; ');throw new Error([body.error||message,details].filter(Boolean).join(' — '))}
  return body;
}
const ACHIEVEMENTS_KEY=['achievements'] as const;
async function loadAchievementProgress(){
  const response=await apiFetch('/api/achievements',{headers:authHeaders()});
  return requireJson<AchievementProgress[]>(response,'Could not load wine collections');
}
export const invalidateAchievementProgress=()=>discard(ACHIEVEMENTS_KEY);
registerSummaryCache(invalidateAchievementProgress);
/** For a screen: shared with every other screen showing the collections. */
export const useAchievementProgress=()=>useLoad(ACHIEVEMENTS_KEY,loadAchievementProgress,{summary:true});
export const getAchievementProgress=()=>readShared(ACHIEVEMENTS_KEY,loadAchievementProgress,{summary:true});
export async function getAchievementCatalogueOptions(){
  const response=await apiFetch('/api/achievements/catalogue-options',{headers:authHeaders()});
  return requireJson<AchievementCatalogueOptions>(response,'Could not load catalogue targets');
}
export async function saveCustomAchievement(input:CustomAchievementInput,id?:string){
  const response=await apiFetch(id?`/api/achievements/custom/${id}`:'/api/achievements/custom',{method:id?'PUT':'POST',headers:authHeaders(true),body:JSON.stringify(input)});
  const result=await requireJson<{id:string}>(response,id?'Could not update collection':'Could not create collection');invalidateAchievementProgress();return result;
}
export async function deleteCustomAchievement(id:string){
  const response=await apiFetch(`/api/achievements/custom/${id}`,{method:'DELETE',headers:authHeaders(true),body:JSON.stringify({confirmation:'DELETE_COLLECTION'})});
  const result=await requireJson<{deleted:true}>(response,'Could not delete collection');invalidateAchievementProgress();return result;
}
export async function setAchievementMatchMode(id:string,matchMode:AchievementMatchMode){
  const response=await apiFetch(`/api/achievements/${id}/match-mode`,{method:'PUT',headers:authHeaders(true),body:JSON.stringify({matchMode})});
  const result=await requireJson<{matchMode:AchievementMatchMode}>(response,'Could not update collection matching');invalidateAchievementProgress();return result;
}
