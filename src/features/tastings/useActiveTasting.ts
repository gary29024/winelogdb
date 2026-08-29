import { useEffect,useState } from 'react';
import { getActiveTasting,type Tasting } from './api';

/**
 * The open tasting, read once per app load and shared.
 *
 * `Layout` does not unmount between routes and the wine form reads the same
 * value for its prefill, so a module-level cache plus one in-flight promise
 * keeps this to a single request however many components ask.
 *
 * Deliberately not polled. Nothing changes this state except this device's own
 * actions - starting, ending, reopening, or saving a wine dated another day -
 * and each of those invalidates it explicitly. A second device picks the change
 * up on its next load, which is the same guarantee the server's one-open-tasting
 * index gives.
 */
type Listener=(tasting:Tasting|null)=>void;
const listeners=new Set<Listener>();
let cached:{tasting:Tasting|null}|null=null;
let pending:Promise<Tasting|null>|null=null;

function publish(tasting:Tasting|null){
  cached={tasting};
  for(const listener of [...listeners])listener(tasting);
}

export function loadActiveTasting():Promise<Tasting|null>{
  if(cached)return Promise.resolve(cached.tasting);
  if(pending)return pending;
  pending=getActiveTasting()
    .then(({tasting})=>{publish(tasting);return tasting})
    // A failed probe must not block the app or wedge the cache: the next reader
    // simply tries again.
    .catch(()=>null)
    .finally(()=>{pending=null});
  return pending;
}

/** What start, end and reopen call with the row the server just returned. */
export function setActiveTasting(tasting:Tasting|null){
  publish(tasting&&!tasting.endedAt?tasting:null);
}

/** Forget and re-read - after saving a wine, which may have closed the tasting. */
export function refreshActiveTasting(){
  cached=null;
  return loadActiveTasting();
}

export function useActiveTasting(){
  const [tasting,setTasting]=useState<Tasting|null>(()=>cached?.tasting??null);
  const [loading,setLoading]=useState(()=>!cached);
  useEffect(()=>{
    let active=true;
    const listener:Listener=next=>{if(active)setTasting(next)};
    listeners.add(listener);
    void loadActiveTasting().then(next=>{if(active){setTasting(next);setLoading(false)}});
    return()=>{active=false;listeners.delete(listener)};
  },[]);
  return {tasting,loading};
}

/** Test seam: the module cache outlives a component tree. */
export function resetActiveTastingCache(){cached=null;pending=null;listeners.clear()}
