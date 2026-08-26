import type { MilestoneKey } from './model';

/** One badge per milestone track. Lives here rather than inside a page because
 *  the passport names the tracks and the achievements page draws the ladder. */
export function JourneyStampIcon({kind}:{kind:MilestoneKey}){
  const common={width:18,height:18,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,'aria-hidden':true};
  if(kind==='totalWines')return <svg {...common}><path d="M8 3h8l-1 6.5a3 3 0 0 1-6 0L8 3Z"/><path d="M12 12.5V20M8.5 20h7"/></svg>;
  if(kind==='producers')return <svg {...common}><path d="M4.5 20V9.5L12 4l7.5 5.5V20"/><path d="M7.5 10h9M8.2 20v-5h3v5m1.6 0v-5h3v5M5.5 20h13"/></svg>;
  if(kind==='appellations')return <svg {...common}><path d="M12 21s6-5.5 6-11a6 6 0 1 0-12 0c0 5.5 6 11 6 11Z"/><circle cx="12" cy="10" r="2.2"/></svg>;
  if(kind==='countries')return <svg {...common}><circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.3 2.2 3.5 4.9 3.5 8S14.3 17.8 12 20M12 4C9.7 6.2 8.5 8.9 8.5 12S9.7 17.8 12 20"/></svg>;
  return <svg {...common}><rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9 8h6M9 12h3M9 16l1.5 1.5L15 13"/></svg>;
}
