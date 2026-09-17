export function elapsedSeconds(startedAt:string,now=Date.now()){
 const started=Date.parse(startedAt);
 return Number.isFinite(started)?Math.max(0,Math.floor((now-started)/1000)):0;
}
