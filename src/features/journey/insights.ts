import type { ClassificationStat,DiscoveryStat,DrinkingAgeStat,MonthStat } from './api';
import type { JourneySummary } from './model';

/**
 * Insights used to report almost entirely on ratings and tasting structure,
 * both of which are optional. A journal that rarely scores its wines saw three
 * cards of dashes and one card that could never return a row at all.
 *
 * Everything here reads signals that come free with logging a bottle - repeat
 * visits, the favourite heart, dates, vintages - and the rating and structure
 * cards are gated on whether there is enough of them to say anything.
 */
export const RATING_COVERAGE_FLOOR=.15;
export const STRUCTURE_COVERAGE_FLOOR=.15;

export function coverage(count:number,total:number){return total>0?count/total:0}

export function showsRatingInsights(summary:JourneySummary){
  return coverage(summary.ratedWines,summary.totalWines)>=RATING_COVERAGE_FLOOR;
}

export function showsStructureInsights(summary:JourneySummary){
  return coverage(summary.structuredTastings,summary.totalWines)>=STRUCTURE_COVERAGE_FLOOR;
}

export type FavoriteRate<T>={item:T;wines:number;favorites:number;rate:number};

/**
 * Rank by how often something earns a heart rather than by how often it is
 * logged. Anything below `minimum` wines is left out: one favourited bottle out
 * of one is a 100% rate and tells you nothing.
 */
export function favoriteRates<T>(
  items:readonly T[],
  read:(item:T)=>{wines:number;favorites:number},
  minimum=3
):FavoriteRate<T>[]{
  return items
    .map(item=>{const {wines,favorites}=read(item);return {item,wines,favorites,rate:wines>0?favorites/wines:0}})
    .filter(entry=>entry.wines>=minimum&&entry.favorites>0)
    .sort((a,b)=>b.rate-a.rate||b.favorites-a.favorites||b.wines-a.wines);
}

export type DiscoveryReading={percent:number;phrase:string;facets:{label:string;count:number}[]};

export function readDiscovery(discovery:DiscoveryStat):DiscoveryReading|null{
  if(!discovery.tastings)return null;
  const percent=Math.round(discovery.newProducers/discovery.tastings*100);
  const phrase=percent>=60?'Deep in exploring mode'
    :percent>=30?'Exploring and revisiting in balance'
    :percent>0?'Settling in with producers you know'
    :'Every recent bottle came from a producer you already knew';
  return {percent,phrase,facets:[
    {label:'new producers',count:discovery.newProducers},
    {label:'new regions',count:discovery.newRegions},
    {label:'new countries',count:discovery.newCountries}
  ]};
}

export type CadenceMonth={month:string;wines:number;label:string};
export type Cadence={months:CadenceMonth[];busiest:CadenceMonth|null;streak:number;perMonth:number};

const monthLabel=(month:string)=>{
  const date=new Date(`${month}-01T00:00:00`);
  return Number.isNaN(date.getTime())?month:new Intl.DateTimeFormat(undefined,{month:'short'}).format(date);
};

function shiftMonth(month:string,back:number){
  const [year,index]=month.split('-').map(Number);
  const shifted=new Date(Date.UTC(year,index-1-back,1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth()+1).padStart(2,'0')}`;
}

/**
 * The last `span` months ending at the most recent one with a tasting, quiet
 * months included so the gaps are visible. `streak` counts back from that month
 * for as long as every month has at least one tasting.
 */
export function buildCadence(rows:readonly MonthStat[],span=12):Cadence{
  const counts=new Map(rows.map(row=>[row.month,row.wines]));
  const latest=[...counts.keys()].sort().at(-1);
  if(!latest)return {months:[],busiest:null,streak:0,perMonth:0};
  const months:CadenceMonth[]=[];
  for(let back=span-1;back>=0;back-=1){
    const month=shiftMonth(latest,back);
    months.push({month,wines:counts.get(month)??0,label:monthLabel(month)});
  }
  let streak=0;
  for(let index=months.length-1;index>=0&&months[index].wines>0;index-=1)streak+=1;
  const busiest=months.reduce<CadenceMonth|null>((most,entry)=>!most||entry.wines>most.wines?entry:most,null);
  const total=months.reduce((sum,entry)=>sum+entry.wines,0);
  return {months,busiest:busiest&&busiest.wines>0?busiest:null,streak,perMonth:total/months.length};
}

export type AgeBand={label:string;wines:number;from:number;to:number};
export type DrinkingAge={median:number;typicalFrom:number;typicalTo:number;wines:number;bands:AgeBand[]};

const AGE_BANDS:{label:string;from:number;to:number}[]=[
  {label:'0–2 yrs',from:0,to:2},
  {label:'3–5',from:3,to:5},
  {label:'6–9',from:6,to:9},
  {label:'10–14',from:10,to:14},
  {label:'15–24',from:15,to:24},
  {label:'25+',from:25,to:Number.POSITIVE_INFINITY}
];

function quantile(sorted:readonly {age:number;wines:number}[],total:number,fraction:number){
  const target=total*fraction;
  let seen=0;
  for(const bucket of sorted){
    seen+=bucket.wines;
    if(seen>=target)return bucket.age;
  }
  return sorted.at(-1)?.age??0;
}

/** How old the bottles are when they get opened: median, middle half, histogram. */
export function buildDrinkingAge(rows:readonly DrinkingAgeStat[]):DrinkingAge|null{
  const sorted=[...rows].filter(row=>row.wines>0&&Number.isFinite(row.age)).sort((a,b)=>a.age-b.age);
  const wines=sorted.reduce((sum,row)=>sum+row.wines,0);
  if(!wines)return null;
  return {
    median:quantile(sorted,wines,.5),
    typicalFrom:quantile(sorted,wines,.25),
    typicalTo:quantile(sorted,wines,.75),
    wines,
    bands:AGE_BANDS.map(band=>({...band,
      wines:sorted.filter(row=>row.age>=band.from&&row.age<=band.to).reduce((sum,row)=>sum+row.wines,0)}))
  };
}

export type MixSlice={label:string;wines:number;share:number};

/** Top `limit` entries by count as shares of the whole, with the tail folded into "Other". */
export function buildMix<T>(items:readonly T[],read:(item:T)=>{label:string;wines:number},limit=6):MixSlice[]{
  const entries=items.map(read).filter(entry=>entry.wines>0).sort((a,b)=>b.wines-a.wines||a.label.localeCompare(b.label));
  const total=entries.reduce((sum,entry)=>sum+entry.wines,0);
  if(!total)return [];
  const head=entries.slice(0,limit),tail=entries.slice(limit);
  const slices=head.map(entry=>({label:entry.label,wines:entry.wines,share:entry.wines/total}));
  const rest=tail.reduce((sum,entry)=>sum+entry.wines,0);
  if(rest>0)slices.push({label:'Other',wines:rest,share:rest/total});
  return slices;
}

export type CruTier={key:string;label:string;wines:number;favorites:number;share:number};

/**
 * The cru mix, in hierarchy order rather than by volume - the point of the card
 * is the shape of the pyramid, and sorting by count would scramble it. Tiers the
 * journal has none of are dropped, so a cellar with no grand cru does not carry
 * an empty band.
 */
const CRU_ORDER:{key:string;label:string}[]=[
  {key:'grand_cru',label:'Grand Cru'},
  {key:'premier_cru',label:'Premier Cru'},
  {key:'village',label:'Village'}
];

export function buildCruMix(rows:readonly ClassificationStat[]):CruTier[]{
  const total=rows.reduce((sum,row)=>sum+row.wines,0);
  if(!total)return [];
  return CRU_ORDER.flatMap(tier=>{
    const row=rows.find(entry=>entry.classification===tier.key);
    return row&&row.wines>0?[{...tier,wines:row.wines,favorites:row.favorites,share:row.wines/total}]:[];
  });
}
