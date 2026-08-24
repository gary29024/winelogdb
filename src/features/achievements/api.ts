import { authHeaders,clearSession } from '../../lib/auth/client';
import type { AchievementProgress } from './types';

let cached:{expires:number;data:AchievementProgress[]}|null=null;
let pending:Promise<AchievementProgress[]>|null=null;

export function getAchievementProgress():Promise<AchievementProgress[]>{
  if(cached&&cached.expires>Date.now())return Promise.resolve(cached.data);
  if(pending)return pending;
  pending=(async()=>{
    const response=await fetch('/api/achievements',{headers:authHeaders()});
    if(response.status===401){clearSession();throw new Error('Session expired. Please sign in again.')}
    if(!response.ok){const body=await response.json().catch(()=>({})) as {error?:string};throw new Error(body.error||'Could not load wine collections')}
    const data=await response.json() as AchievementProgress[];
    cached={data,expires:Date.now()+30_000};
    return data;
  })().finally(()=>{pending=null});
  return pending;
}
