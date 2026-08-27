/**
 * The month the grounding allowance is counted in.
 *
 * The free searches reset at midnight Pacific on the 1st, not at midnight UTC
 * and not in the owner's own timezone. From Hong Kong that is mid-afternoon on
 * the 1st, so a UTC month key would file up to sixteen hours of usage under the
 * wrong month - and it would do it at exactly the moment the allowance matters,
 * which is the boundary itself.
 *
 * The zone is named rather than offset so the two DST changes a year are
 * handled by the platform. Midnight is never inside a DST gap: US transitions
 * happen at 02:00.
 */
export const BILLING_TIME_ZONE='America/Los_Angeles';

const partsIn=(at:Date,timeZone:string)=>{
  const parts=new Intl.DateTimeFormat('en-US',{timeZone,hour12:false,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).formatToParts(at);
  const value=(type:string)=>Number(parts.find(part=>part.type===type)?.value);
  const hour=value('hour');
  return {year:value('year'),month:value('month'),day:value('day'),hour:hour===24?0:hour,minute:value('minute'),second:value('second')};
};

/** How far the zone's wall clock is from UTC at a given instant, in ms. */
const zoneOffsetMs=(at:Date,timeZone:string)=>{
  const {year,month,day,hour,minute,second}=partsIn(at,timeZone);
  return Date.UTC(year,month-1,day,hour,minute,second)-Math.floor(at.getTime()/1000)*1000;
};

/** The billing month an instant falls in, as YYYY-MM. */
export function billingMonth(at:Date=new Date(),timeZone=BILLING_TIME_ZONE){
  const {year,month}=partsIn(at,timeZone);
  return `${year}-${String(month).padStart(2,'0')}`;
}

/** The instant a wall-clock time in the zone actually happens at. */
function instantOf(year:number,month:number,day:number,timeZone:string){
  const naive=Date.UTC(year,month-1,day,0,0,0);
  const firstPass=naive-zoneOffsetMs(new Date(naive),timeZone);
  return new Date(naive-zoneOffsetMs(new Date(firstPass),timeZone));
}

/** When the allowance next resets, as an absolute instant. */
export function nextBillingReset(at:Date=new Date(),timeZone=BILLING_TIME_ZONE){
  const {year,month}=partsIn(at,timeZone);
  return instantOf(month===12?year+1:year,month===12?1:month+1,1,timeZone);
}
