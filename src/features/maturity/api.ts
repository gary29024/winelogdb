import type { VintageResearchStatus } from '../../lib/maturity/vintageResearch';
import { authHeaders,clearSession } from '../../lib/auth/client';
import type { VintageWindow,VintageSubject } from '../../lib/maturity/vintageWindow';

const params=(subject:VintageSubject)=>{
  const query=new URLSearchParams();
  if(subject.country)query.set('country',subject.country);
  if(subject.region)query.set('region',subject.region);
  if(subject.appellation)query.set('appellation',subject.appellation);
  if(subject.vintage!=null)query.set('vintage',String(subject.vintage));
  if(subject.wineStyle)query.set('wineStyle',subject.wineStyle);
  if(subject.classification)query.set('classification',subject.classification);
  if(subject.producer)query.set('producer',subject.producer);
  if(subject.wineName)query.set('wineName',subject.wineName);
  return query;
};

/** Read saved research only. A failed read must not look like a cache miss. */
export async function getVintageWindow(subject:VintageSubject):Promise<VintageWindow|null>{
  const response=await fetch(`/api/maturity/vintage?${params(subject)}`,{headers:authHeaders()});
  if(response.status===401){clearSession();throw new Error('Session expired. Please sign in again.')}
  if(!response.ok)throw new Error('Could not load saved vintage research');
  const body=await response.json() as {window?:VintageWindow|null}|null;
  if(!body||!Object.hasOwn(body,'window'))throw new Error('Could not read saved vintage research');
  return body.window??null;
}

type VintageLookupResult={window:VintageWindow|null;cached:boolean;pending?:boolean};

/** Enqueue one lookup and observe it; status reads never start another model call. */
export async function lookUpVintageWindow(subject:VintageSubject,refresh=false,signal?:AbortSignal):Promise<VintageLookupResult>{
  const response=await fetch('/api/maturity/vintage',{method:'POST',headers:authHeaders(true),signal,
    body:JSON.stringify({...subject,refresh})});
  if(response.status===401){clearSession();throw new Error('Session expired. Please sign in again.')}
  const body=await response.json().catch(()=>({})) as {window?:VintageWindow|null;cached?:boolean;error?:string;job?:VintageResearchStatus};
  if(!response.ok)throw new Error(body.error||'Could not look up that vintage');
  if(response.status!==202)return {window:body.window??null,cached:Boolean(body.cached)};
  if(!body.job?.id)throw new Error('Could not read vintage research progress');
  // Polling only reads status. Closing the page stops the observer, not the job.
  // Bound the wait so a busy queue cannot leave the button spinning forever.
  for(let poll=0;poll<36;poll++){
    await new Promise(resolve=>setTimeout(resolve,5000));
    signal?.throwIfAborted();
    const progress=await fetch(`/api/maturity/vintage/jobs/${encodeURIComponent(body.job.id)}`,{headers:authHeaders(),signal});
    if(progress.status===401){clearSession();throw new Error('Session expired. Please sign in again.')}
    const current=await progress.json().catch(()=>({})) as {job?:VintageResearchStatus;error?:string};
    if(!progress.ok||!current.job)throw new Error(current.error||'Could not read vintage research progress');
    if(current.job.status==='failed')throw new Error(current.job.error||'Could not look up that vintage');
    if(current.job.status==='complete')return {window:current.job.window,cached:false};
  }
  return {window:null,cached:false,pending:true};
}
