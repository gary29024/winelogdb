export type BackoffOptions={initialMs?:number;maxMs?:number;factor?:number};

// Background research runs take minutes, so a flat two-second poll spent hundreds of
// D1 reads per run for status that barely changes. Stay responsive for the first few
// checks, then widen the gap towards maxMs.
export function backoffDelay(attempt:number,{initialMs=2000,maxMs=15000,factor=1.5}:BackoffOptions={}){
  const step=Math.max(0,Math.floor(attempt));
  return Math.min(maxMs,Math.round(initialMs*Math.pow(factor,step)));
}

export type Poller={stop:()=>void};

// Chained timeouts rather than setInterval: a slow response must not stack requests.
export function startBackoffPoll(tick:()=>Promise<void>|void,options:BackoffOptions={}):Poller{
  let attempt=0,timer:number|undefined,stopped=false;
  const schedule=()=>{
    if(stopped)return;
    timer=window.setTimeout(async()=>{
      if(stopped)return;
      try{await tick()}catch{/* the caller owns error reporting */}
      attempt+=1;
      schedule();
    },backoffDelay(attempt,options));
  };
  schedule();
  return {stop(){stopped=true;if(timer)window.clearTimeout(timer);timer=undefined}};
}
