import { useEffect,useState } from 'react';

export function elapsedSeconds(startedAt:string,now=Date.now()){
 const started=Date.parse(startedAt);
 return Number.isFinite(started)?Math.max(0,Math.floor((now-started)/1000)):0;
}

/**
 * Keep a live background-job clock local to this tiny component. A timer in a
 * wine or producer detail page would otherwise update the whole page tree once
 * per second while research is running.
 */
export function ElapsedSeconds({startedAt}:{startedAt:string}){
 const [seconds,setSeconds]=useState(()=>elapsedSeconds(startedAt));
 useEffect(()=>{
  setSeconds(elapsedSeconds(startedAt));
  const timer=window.setInterval(()=>setSeconds(elapsedSeconds(startedAt)),1000);
  return()=>window.clearInterval(timer);
 },[startedAt]);
 return <>{seconds}s</>;
}
