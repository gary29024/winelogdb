import { discard,readShared,setLoaded,useLoad } from '../../lib/query/client';
import { getActiveTasting,type Tasting } from './api';

/**
 * The open tasting, read once per app load and shared.
 *
 * `Layout` does not unmount between routes and the wine form reads the same
 * value for its prefill, so it is one pinned answer in the shared loader: a
 * single request however many components ask.
 *
 * Deliberately not polled. Nothing changes this state except this device's own
 * actions - starting, ending, reopening, or saving a wine dated another day -
 * and each of those invalidates it explicitly. A second device picks the change
 * up on its next load, which is the same guarantee the server's one-open-tasting
 * index gives.
 */
const ACTIVE_KEY=['tasting','active'] as const,PINNED={pinned:true};
const readActive=()=>getActiveTasting().then(({tasting})=>tasting);

export function loadActiveTasting():Promise<Tasting|null>{
  // A failed probe must not block the app or wedge the answer: the next reader
  // simply tries again.
  return readShared(ACTIVE_KEY,readActive,PINNED).catch(()=>null);
}

/** What start, end and reopen call with the row the server just returned. */
export function setActiveTasting(tasting:Tasting|null){
  setLoaded<Tasting|null>(ACTIVE_KEY,tasting&&!tasting.endedAt?tasting:null);
}

/** Forget and re-read - after saving a wine, which may have closed the tasting. */
export function refreshActiveTasting(){
  discard(ACTIVE_KEY);
  return loadActiveTasting();
}

export function useActiveTasting(){
  const {data,loading}=useLoad(ACTIVE_KEY,readActive,PINNED);
  return {tasting:data??null,loading};
}
