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

export type SavedVintageResearch={window:VintageWindow|null;job:VintageResearchStatus|null};

/**
 * What is known about a cell: the saved answer, and the lookup still running.
 *
 * The job matters as much as the window. Without it a reopened panel cannot
 * tell "nobody has asked" from "somebody asked and it is still going", so it
 * offered the button again for research that was already paid for.
 */
export async function getVintageWindow(subject:VintageSubject):Promise<SavedVintageResearch>{
  const response=await fetch(`/api/maturity/vintage?${params(subject)}`,{headers:authHeaders()});
  if(response.status===401){clearSession();throw new Error('Session expired. Please sign in again.')}
  if(!response.ok)throw new Error('Could not load saved vintage research');
  const body=await response.json() as {window?:VintageWindow|null;job?:VintageResearchStatus|null}|null;
  if(!body||!Object.hasOwn(body,'window'))throw new Error('Could not read saved vintage research');
  return {window:body.window??null,job:body.job??null};
}

export type VintageLookupResult={window:VintageWindow|null;cached:boolean;pending?:boolean;pendingStatus?:'queued'|'running'};

/**
 * Watches one job to its end, or until the caller stops caring.
 *
 * Shared by the button and by a panel that reopened onto work already in
 * flight, so both wait the same way and neither can start a second lookup.
 * Read immediately, then at 1s/3s before backing off to five-second intervals.
 * Status-request time counts against the budget, so a slow read cannot stretch
 * the wait past it.
 */
export async function observeVintageResearch(jobId:string,signal?:AbortSignal):Promise<VintageLookupResult>{
  const deadline=Date.now()+180_000;
  let pendingStatus:'queued'|'running'='queued';
  for(let poll=0;Date.now()<deadline;poll++){
    const delay=poll===0?0:poll===1?1000:poll===2?2000:5000;
    if(delay)await new Promise(resolve=>setTimeout(resolve,Math.min(delay,deadline-Date.now())));
    signal?.throwIfAborted();
    if(poll>0&&Date.now()>=deadline)break;
    const progress=await fetch(`/api/maturity/vintage/jobs/${encodeURIComponent(jobId)}`,{headers:authHeaders(),signal});
    if(progress.status===401){clearSession();throw new Error('Session expired. Please sign in again.')}
    const current=await progress.json().catch(()=>({})) as {job?:VintageResearchStatus;error?:string};
    if(!progress.ok||!current.job)throw new Error(current.error||'Could not read vintage research progress');
    if(current.job.status==='failed')throw new Error(current.job.error||'Could not look up that vintage');
    if(current.job.status==='complete')return {window:current.job.window,cached:false};
    if(current.job.status!=='queued'&&current.job.status!=='running')throw new Error('Could not read vintage research progress');
    pendingStatus=current.job.status;
  }
  return {window:null,cached:false,pending:true,pendingStatus};
}

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
  return observeVintageResearch(body.job.id,signal);
}
