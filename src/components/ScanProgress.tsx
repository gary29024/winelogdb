import { useEffect,useState,type CSSProperties } from 'react';
import '../scanProgress.css';

/**
 * The glowing line that sweeps down a photograph while it is being read.
 *
 * Decoration only, so it is hidden from assistive technology, and with reduced
 * motion it stands still as a viewfinder frame. `delay` staggers several labels
 * so they do not sweep in lockstep.
 */
export function ScanBeam({delay=0}:{delay?:number}){
  return <span className="scan-beam" aria-hidden="true" style={delay?{'--scan-delay':`${delay}s`} as CSSProperties:undefined}><span className="scan-beam-line"/></span>;
}

/** Where the bar sits before the request leaves, and the most it ever claims. */
const FLOOR=6,CEILING=94;
/** Half the remaining distance is covered every this many seconds. */
const HALF_LIFE_S=8;
const STEP_S=3.5,SLOW_AFTER_S=30;

type Props={
  /**
   * When the request actually left. Null while it waits on the credit
   * confirmation, so the clock does not count time spent reading a dialog.
   */
  startedAt:number|null;
  /** What recognition is looking at, in order. Each shows for a few seconds and the last one holds. */
  steps:readonly string[];
  /** Replaces the steps once the wait runs longer than usual. */
  slowStep:string;
  /** Overrides the steps for work done after the answer has arrived. */
  step?:string;
  label:string;
};

/**
 * A bar that keeps moving and a line saying what is being read.
 *
 * Recognition is one request with no progress of its own to report, so a bar
 * parked at a fixed value looked frozen for the ten to thirty seconds it takes.
 * This one eases towards the end without reaching it - the honest shape for a
 * wait of unknown length - and the clock lives in here so its once-a-quarter-
 * second tick re-renders this line rather than the page around it.
 */
export function ScanProgress({startedAt,steps,slowStep,step,label}:Props){
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{
    if(startedAt==null)return;
    setNow(Date.now());
    const timer=window.setInterval(()=>setNow(Date.now()),250);
    return()=>window.clearInterval(timer);
  },[startedAt]);
  const elapsed=startedAt==null?0:Math.max(0,(now-startedAt)/1000);
  const value=startedAt==null?FLOOR:FLOOR+(CEILING-FLOOR)*(1-0.5**(elapsed/HALF_LIFE_S));
  const message=step??(startedAt==null?'Getting ready…':elapsed>=SLOW_AFTER_S?slowStep:steps[Math.min(steps.length-1,Math.floor(elapsed/STEP_S))]);
  return <div className="scan-progress">
    <div className="scan-progress-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}><span style={{width:`${value}%`}}/></div>
    <p className="scan-progress-copy"><span key={message} className="scan-progress-step">{message}</span>{startedAt!=null&&<span className="scan-progress-clock">{Math.floor(elapsed)}s</span>}</p>
  </div>;
}
