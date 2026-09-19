/**
 * The share maths behind a stacked proportion bar.
 *
 * Rounding each share on its own gives a set that sums to 99 or 101 about as
 * often as it sums to 100, and a bar laid out from those widths either leaves a
 * sliver of empty track at its end or pushes its last segment past it. The
 * largest-remainder method hands the leftover points to whichever entries lost
 * most to rounding, so a row always sums to exactly 100 and the bar always
 * closes.
 *
 * `insights.ts` keeps its own `topMix`: it needs a float share to scale one
 * bar per row, where summing to 100 across rows is not a property anything
 * depends on. A single stacked track is the case that needs whole points.
 */

export type CompositionTone=string;
export type CompositionEntry={key:string;label:string;count:number;tone:CompositionTone};
export type CompositionSegment=CompositionEntry&{percent:number};

/** Percentages that sum to exactly 100 whenever anything was counted at all. */
export function compositionShares<T extends {count:number}>(entries:readonly T[]):(T&{percent:number})[]{
  const counts=entries.map(entry=>{
    const value=Math.trunc(Number(entry.count));
    return Number.isFinite(value)&&value>0?value:0;
  });
  const total=counts.reduce((sum,count)=>sum+count,0);
  if(!total)return entries.map(entry=>({...entry,percent:0}));

  const exact=counts.map(count=>count/total*100);
  const percent=exact.map(value=>Math.floor(value));
  let spare=100-percent.reduce((sum,value)=>sum+value,0);
  // An empty tier must not be handed a point merely because points were left
  // over: a 0% segment that draws 1% of the bar is a lie about the range.
  const byRemainder=exact
    .map((value,index)=>({index,remainder:value-Math.floor(value)}))
    .filter(entry=>counts[entry.index]>0)
    .sort((a,b)=>b.remainder-a.remainder||a.index-b.index);
  for(const entry of byRemainder){
    if(spare<=0)break;
    percent[entry.index]+=1;spare-=1;
  }
  return entries.map((entry,index)=>({...entry,percent:percent[index]}));
}

/**
 * The `limit` largest entries, with everything after them folded into one row.
 *
 * Categorical colour runs out: past a handful of slots the hues stop being
 * reliably distinguishable, so a sixth village is not given a generated colour,
 * it joins "Other". Entries are folded by count, and the fold keeps its place at
 * the end of the row rather than being sorted among the named entries.
 */
export function foldToOther<T extends CompositionEntry>(
  entries:readonly T[],limit:number,otherTone:CompositionTone,label='Other'
):CompositionEntry[]{
  const ranked=[...entries].sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label));
  if(limit<1)return [];
  if(ranked.length<=limit)return ranked;
  const head=ranked.slice(0,limit),tail=ranked.slice(limit);
  const folded=tail.reduce((sum,entry)=>sum+Math.max(0,entry.count),0);
  return folded>0?[...head,{key:'__other',label,count:folded,tone:otherTone}]:head;
}

/** The categorical slots, in the fixed order that keeps neighbours apart. */
export const SERIES_TONES:CompositionTone[]=['series-1','series-2','series-3','series-4','series-5'];
export const OTHER_TONE:CompositionTone='neutral';

/** Assigns the fixed slot order to entries that carry no tone of their own. */
export function withSeriesTones(entries:readonly Omit<CompositionEntry,'tone'>[]):CompositionEntry[]{
  return entries.map((entry,index)=>({...entry,tone:SERIES_TONES[index]??OTHER_TONE}));
}
