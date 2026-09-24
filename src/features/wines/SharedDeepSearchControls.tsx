import { useEffect,useRef,useState } from 'react';
import { FriendResearchStatus } from '../auth/FriendResearchStatus';
import { ElapsedSeconds } from '../../components/ElapsedSeconds';
import { startBackoffPoll,type Poller } from '../../lib/polling/backoff';
import { cancelWineDeepSearch,getWineDeepSearchStatus,startWineDeepSearch,type WineResearchRun } from './api';

type DeepState='idle'|'confirm-usage'|'running'|'error';
const deepStage:Record<WineResearchRun['stage'],string>={queued:'Queued for background research',researching:'Researching in the background',saving:'Saving Deep Search result',complete:'Research complete',failed:'Research failed'};

/**
 * Deep Search on a wine a friend shared, run and paid for by the reader.
 *
 * The same endpoint, credit quote and background run as the owner's page: the
 * server accepts a shared wine for research only, charges the reader only for
 * sections nobody they can read from has researched, and publishes what they
 * pay for to their friends, so the owner's page picks it up too. The owner's
 * own research is never replaced there, and is never credited to the reader.
 */
export function SharedDeepSearchControls({wineId,complete,onChange}:{wineId:string;complete:boolean;onChange:()=>Promise<unknown>}){
 const [state,setState]=useState<DeepState>('idle'),[run,setRun]=useState<WineResearchRun|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[cancelling,setCancelling]=useState(false),[friendOperation,setFriendOperation]=useState('');
 const pollRef=useRef<Poller|undefined>(undefined),reload=useRef(onChange);
 useEffect(()=>{reload.current=onChange},[onChange]);
 function stop(){pollRef.current?.stop();pollRef.current=undefined}
 function watch(next:WineResearchRun){
  stop();setRun(next);setState(next.status==='running'?'running':next.status==='failed'?'error':'idle');if(next.status!=='running')return;
  const poll=async()=>{
   const latest=await getWineDeepSearchStatus(wineId,next.requestId).catch(()=>null);if(!latest)return;setRun(latest);if(latest.status==='running')return;stop();
   if(latest.status==='complete'){await reload.current().catch(()=>undefined);setState('idle');setError('');setNotice(`Deep Search completed${latest.durationMs!=null?` in ${(latest.durationMs/1000).toFixed(1)}s`:''}.`)}
   else{setError(`The background Deep Search failed. · Support ID ${latest.requestId}`);setState('error')}
  };
  pollRef.current=startBackoffPoll(poll);void poll();
 }
 // A run the reader started earlier keeps reporting when they come back.
 useEffect(()=>{let active=true;getWineDeepSearchStatus(wineId).then(latest=>{if(active&&latest?.status==='running')watch(latest)}).catch(()=>undefined);return()=>{active=false;stop()}// eslint-disable-next-line react-hooks/exhaustive-deps
 },[wineId]);
 async function start(){
  setState('running');setError('');setNotice('');
  try{
   const accepted=await startWineDeepSearch(wineId,complete?'vintage':'none');
   if(accepted.cached){await reload.current();setState('idle');return}
   if(accepted.waitingForFriend){setFriendOperation(accepted.creditOperationId??'');setState('idle');return}
   const latest=await getWineDeepSearchStatus(wineId,accepted.researchRequestId);if(latest)watch(latest);else setNotice('Deep Search has been queued in the background. You can leave this page safely.');
  }catch(e){setError((e as Error).message);setState('error')}
 }
 async function cancel(){
  if(!run||run.status!=='running'||cancelling)return;if(!confirm('Cancel this Deep Search? Any producer, terroir, vintage or wine research already saved will be kept.'))return;
  setCancelling(true);setError('');
  try{const result=await cancelWineDeepSearch(wineId,run.requestId);stop();await reload.current().catch(()=>undefined);setRun(null);setState('idle');setNotice(result.alreadyTerminal?'Deep Search had already reached a terminal state.':'Deep Search cancelled. Any research already saved was kept.')}
  catch(e){setError((e as Error).message);setState('running')}
  finally{setCancelling(false)}
 }
 return <>
  {friendOperation&&<FriendResearchStatus operationId={friendOperation} onComplete={()=>void reload.current()}/>}
  {notice&&<p className="producer-notice" role="status">{notice}</p>}
  {state==='idle'&&<button type="button" className="primary" onClick={()=>setState('confirm-usage')}>{complete?'Refresh vintage research':'Deep Search'}</button>}
  {state==='confirm-usage'&&<div className="deep-confirm"><p>{complete?'This refresh keeps reusable producer and terroir research, and refreshes only the vintage-sensitive parts for this wine.':'WineLog reuses saved research first, including your friend’s, and researches only what is missing.'} It uses your own credits, and your friend can see the result. The background job continues even if you close WineLog. Continue?</p><button type="button" className="primary" onClick={()=>void start()}>{complete?'Queue vintage refresh':'Queue Deep Search'}</button><button type="button" className="secondary-danger" onClick={()=>setState('idle')}>Cancel</button></div>}
  {state==='running'&&<div className="deep-running" role="status"><span className="deep-spinner" aria-hidden="true"/><div><strong>{run?deepStage[run.stage]:'Queueing Deep Search…'}</strong><p>WineLog is researching this wine in the background.</p><small>{run?<><ElapsedSeconds startedAt={run.startedAt}/> · Support ID {run.requestId}</>:'0s'}</small><p>You can leave this page or close WineLog. The background research continues and the saved result will appear when you return.</p><button type="button" className="secondary-danger" disabled={!run||cancelling} onClick={()=>void cancel()}>{cancelling?'Cancelling…':'Cancel Deep Search'}</button></div></div>}
  {state==='error'&&<div className="deep-error" role="alert"><strong>Deep Search did not complete.</strong><p>{error||`The background research job failed before a result was saved.${run?.requestId?` · Support ID ${run.requestId}`:''}`}</p><button type="button" onClick={()=>void start()}>Retry Deep Search</button><button type="button" className="secondary-danger" onClick={()=>setState('idle')}>Close</button></div>}
 </>;
}
