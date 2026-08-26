/**
 * Where the back link on a wine goes.
 *
 * A wine can be reached from the journal, a producer's page, a batch scan, the
 * passport or an achievement, and the useful way back is the one you came from.
 * The route itself cannot tell, so whoever links to a wine says.
 *
 * React Router keeps `location.state` on the history entry, so browser back and
 * forward carry it on their own. What it does not survive is a reload or a trip
 * out to the edit page and back, and those are common enough on a page you
 * linger on - hence the sessionStorage copy. Only the most recent wine is kept:
 * the entry is replaced as soon as another wine is opened, and reading it
 * requires the id to match, so a stale target can never be shown against the
 * wrong wine.
 */
export type BackTarget={to:string;label:string};

export const JOURNAL_BACK:BackTarget={to:'/journal',label:'Journal'};

const KEY='winelog.wineBack';

const isTarget=(value:unknown):value is BackTarget=>{
  if(!value||typeof value!=='object')return false;
  const {to,label}=value as Partial<BackTarget>;
  // Only in-app paths: a target read back from storage must never be able to
  // send someone off to another origin.
  return typeof to==='string'&&to.startsWith('/')&&!to.startsWith('//')&&typeof label==='string'&&label.length>0;
};

/** Reads a target handed over in `location.state`, ignoring anything else there. */
export function backTargetFromState(state:unknown):BackTarget|null{
  const from=(state as{from?:unknown}|null)?.from;
  return isTarget(from)?from:null;
}

export function rememberBackTarget(wineId:string,target:BackTarget){
  try{window.sessionStorage.setItem(KEY,JSON.stringify({wineId,...target}))}catch{/* storage unavailable */}
}

export function readBackTarget(wineId:string):BackTarget|null{
  try{
    const raw=window.sessionStorage.getItem(KEY);if(!raw)return null;
    const parsed=JSON.parse(raw) as{wineId?:unknown}&Partial<BackTarget>;
    if(parsed?.wineId!==wineId||!isTarget(parsed))return null;
    return {to:parsed.to,label:parsed.label};
  }catch{return null}
}

/** What a link into a wine passes so the wine can offer the way back. */
export const linkFrom=(target:BackTarget)=>({from:target});
