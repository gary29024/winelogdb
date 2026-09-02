import { authHeaders,clearSession } from '../../lib/auth/client';
import type { VintageWindow,VintageSubject } from '../../lib/maturity/vintageWindow';

const params=(subject:VintageSubject)=>{
  const query=new URLSearchParams();
  if(subject.country)query.set('country',subject.country);
  if(subject.region)query.set('region',subject.region);
  if(subject.appellation)query.set('appellation',subject.appellation);
  if(subject.vintage!=null)query.set('vintage',String(subject.vintage));
  if(subject.wineStyle)query.set('wineStyle',subject.wineStyle);
  return query;
};

/** What has already been found. Never calls anything, so a wine page is free. */
export async function getVintageWindow(subject:VintageSubject):Promise<VintageWindow|null>{
  const response=await fetch(`/api/maturity/vintage?${params(subject)}`,{headers:authHeaders()}).catch(()=>null);
  if(!response?.ok)return null;
  const body=await response.json().catch(()=>null) as {window?:VintageWindow|null}|null;
  return body?.window??null;
}

/** The button. The only thing in the app that spends a search on a window. */
export async function lookUpVintageWindow(subject:VintageSubject,refresh=false){
  const response=await fetch('/api/maturity/vintage',{method:'POST',headers:authHeaders(true),
    body:JSON.stringify({...subject,refresh})});
  if(response.status===401){clearSession();throw new Error('Session expired. Please sign in again.')}
  const body=await response.json().catch(()=>({})) as {window?:VintageWindow|null;cached?:boolean;error?:string};
  if(!response.ok)throw new Error(body.error||'Could not look up that vintage');
  return {window:body.window??null,cached:Boolean(body.cached)};
}
