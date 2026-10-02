import type { AreaHarvest,HarvestStart,GrapeId,GrapeSeason,RipeningWeather,SeasonWeather,SugarCurve,VillageNormal,VillageSeason } from './types';

/**
 * Everything the Vintages screens say about a season, derived from the
 * pipeline's measurements. Kept pure so the wording and thresholds are tested
 * without a page, and so a new region needs data, not code.
 */

const DAY=86_400_000;

export const isoDay=(iso:string)=>Date.UTC(Number(iso.slice(0,4)),Number(iso.slice(5,7))-1,Number(iso.slice(8,10)));
/** A month-day in a given season year, as epoch ms. */
export const seasonDay=(year:number,monthDay:string)=>Date.UTC(year,Number(monthDay.slice(0,2))-1,Number(monthDay.slice(3,5)));
export const daysBetween=(from:number,to:number)=>Math.round((to-from)/DAY);
export const addDays=(time:number,days:number)=>time+days*DAY;

// Fixed English month names: "Sep", never a locale's "Sept." - dates sit in
// tight tiles where a longer form wraps.
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const LONG_MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
export const formatDay=(time:number)=>{const d=new Date(time);return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`};
/** "12–26 Sep", or "28 Aug–11 Sep" across a month end. */
export const formatRange=(from:number,to:number)=>{
  const a=new Date(from),b=new Date(to);
  return a.getUTCMonth()===b.getUTCMonth()?`${a.getUTCDate()}–${formatDay(to)}`:`${formatDay(from)}–${formatDay(to)}`;
};
export const formatLongDay=(time:number)=>{const d=new Date(time);return `${d.getUTCDate()} ${LONG_MONTHS[d.getUTCMonth()]}`};

/* ---------- Harvest timing ---------- */

export type HarvestReading={start:number;end:number;source:HarvestStart['source'];typicalStart:number;shiftDays:number};

/** Picking is read as the start date plus two weeks, the span a village usually takes. */
export const PICKING_DAYS=14;

export function harvestFor(harvest:AreaHarvest|undefined,year:number):HarvestReading|null{
  const entry=harvest?.years[String(year)];
  if(!harvest||!entry)return null;
  const start=isoDay(entry.date),typicalStart=seasonDay(year,harvest.typical);
  return {start,end:addDays(start,PICKING_DAYS),source:entry.source,typicalStart,shiftDays:daysBetween(typicalStart,start)};
}

export const shiftLabel=(days:number,unit:'short'|'long'='long')=>{
  if(days===0)return unit==='short'?'on time':'right on time';
  const n=Math.abs(days);
  if(unit==='short')return `${n}d ${days<0?'early':'late'}`;
  return `${n} day${n===1?'':'s'} ${days<0?'earlier':'later'}`;
};

/* ---------- Season measures against normal ---------- */

/** −2…2: how far a measure sat from its normal, in the direction a reader means. */
export type Level=-2|-1|0|1|2;

const band=(value:number,small:number,large:number):Level=>value>=large?2:value>=small?1:value<=-large?-2:value<=-small?-1:0;
const pct=(value:number,normal:number)=>normal>0?(value-normal)/normal:0;

export type SeasonLevels={warmth:Level;rain:Level;nights:Level};

export function seasonLevels(season:SeasonWeather,normal:SeasonWeather):SeasonLevels{
  return {
    warmth:band(pct(season.gdd,normal.gdd),.03,.08),
    rain:band(pct(season.rainAprSep,normal.rainAprSep),.15,.35),
    nights:band(season.augNights-normal.augNights,.5,1.5)
  };
}

/** One number for how far the whole season sat from a typical one. */
export function seasonDistance(levels:SeasonLevels,shiftDays:number){
  return Math.abs(levels.warmth)+Math.abs(levels.rain)+Math.abs(levels.nights)+Math.abs(shiftDays)/7;
}

export const SCORE_LABELS=['','Typical season','Fairly typical','Unusual season','Very unusual','Exceptional season'] as const;
export type SeasonScore=1|2|3|4|5;
export function seasonScore(distance:number):SeasonScore{
  return Math.min(5,Math.max(1,1+Math.round(distance*.75))) as SeasonScore;
}

const WARMTH_WORD:Record<Level,string>={2:'Hot',1:'Warm',0:'Mild','-1':'Cool','-2':'Cold'};

/** "Cool, wet, late": the three facts a reader asks first, in that order. */
export function seasonCharacter(levels:SeasonLevels,shiftDays:number){
  const parts=[WARMTH_WORD[levels.warmth]];
  if(levels.rain>0)parts.push(levels.rain>1?'very wet':'wet');
  else if(levels.rain<0)parts.push(levels.rain<-1?'very dry':'dry');
  if(shiftDays<=-12)parts.push('very early');
  else if(shiftDays<=-4)parts.push('early');
  else if(shiftDays>=12)parts.push('very late');
  else if(shiftDays>=4)parts.push('late');
  if(parts.length===1)parts.push('even');
  return parts.join(', ');
}

/** "A cool, rainy, late vintage" - the detail page's headline. */
export function seasonHeadline(levels:SeasonLevels,shiftDays:number){
  const words=[WARMTH_WORD[levels.warmth].toLowerCase()];
  if(levels.rain>0)words.push('rainy');else if(levels.rain<0)words.push('dry');
  if(shiftDays<=-4)words.push('early');else if(shiftDays>=4)words.push('late');
  const article=/^[aeiou]/.test(words[0])?'An':'A';
  return `${article} ${words.join(', ')} vintage`;
}

/**
 * Two or three plain sentences: what happened, and what it usually means in
 * the glass. Every clause comes from a measured departure, so a typical year
 * says little - which is the honest reading of a typical year.
 */
export function seasonStory(season:SeasonWeather,normal:SeasonWeather,levels:SeasonLevels,shiftDays:number){
  const happened:string[]=[];
  const late=shiftDays>=4,early=shiftDays<=-4;
  if(season.frostDays>=normal.frostDays+2)happened.push('Spring frost hit the young shoots and likely cut the crop.');
  if(levels.rain>=1&&late)happened.push(`Steady rain${levels.rain>1?' well above normal':''} slowed ripening and kept disease pressure high.`);
  else if(levels.rain>=1)happened.push(`Rain ran ${levels.rain>1?'well ':''}above normal and kept disease pressure high.`);
  else if(levels.rain<=-1&&levels.warmth>=1)happened.push('A hot, dry summer pushed ripening ahead.');
  else if(levels.rain<=-1)happened.push('A dry season kept the grapes clean and small.');
  else if(levels.warmth>=1)happened.push('Warmth ran ahead of normal through the summer.');
  else if(levels.warmth<=-1)happened.push('A cool summer kept ripening slow.');
  if(season.heatDays>=normal.heatDays*1.8&&season.heatDays>=12)happened.push('Repeated heatwaves stressed the vines.');
  if(levels.nights>=1&&levels.warmth>=1)happened.push('Warm nights gave acidity little chance to rest.');

  let expect='Expect a classic, balanced style.';
  if(late||levels.warmth<=-1)expect=levels.rain>=1?'Expect lighter, fresher wines — careful sorting made the difference.':'Expect fresh, taut wines with bright acidity.';
  else if(early||levels.warmth>=1)expect=levels.rain<=-1?'Expect riper, fuller wines; the best kept their freshness.':'Expect generous, ripe wines with softer acidity.';
  else if(levels.rain>=2)expect='Expect uneven quality — the growers who sorted hardest made the best wines.';
  return {happened:happened.length?happened.join(' '):'Weather stayed close to normal through the season.',expect};
}

/* ---------- Sugar ---------- */

const curveTime=(curve:SugarCurve,year:number,index:number)=>addDays(seasonDay(year,curve.start),index*curve.step);

/** Sugar on a given day, interpolated; clamped to the ends of the curve. */
export function sugarOn(curve:SugarCurve,year:number,time:number){
  const {values}=curve;
  const position=daysBetween(seasonDay(year,curve.start),time)/curve.step;
  if(position<=0)return values[0];
  if(position>=values.length-1)return values[values.length-1];
  const low=Math.floor(position),t=position-low;
  return values[low]+(values[low+1]-values[low])*t;
}

/** First day the curve reaches `target`, or null if it never does in the modelled span. */
export function dayReaching(curve:SugarCurve,year:number,target:number){
  const {values}=curve;
  for(let i=1;i<values.length;i++){
    if(values[i]>=target){
      const before=values[i-1];
      const t=before>=target?0:(target-before)/(values[i]-before);
      return Math.round(curveTime(curve,year,i-1)+t*curve.step*DAY);
    }
  }
  return null;
}

/** g/L to potential alcohol, % vol (16.83 g/L per degree). */
export const potentialAlcohol=(sugar:number)=>sugar/16.83;

export type PickingReading={low:number;high:number;alcoholLow:number;alcoholHigh:number};
export function sugarAtPicking(curve:SugarCurve,year:number,start:number,end:number):PickingReading{
  const a=sugarOn(curve,year,start),b=sugarOn(curve,year,end);
  const low=Math.round(Math.min(a,b)),high=Math.round(Math.max(a,b));
  return {low,high,alcoholLow:potentialAlcohol(low),alcoholHigh:potentialAlcohol(high)};
}

/* ---------- Ripening conditions ---------- */

export type Effect='helps'|'hurts'|'neutral';
export type ConditionIcon='clock'|'flame'|'moon'|'sun'|'drop'|'scale'|'therm'|'spark';
export type Condition={id:string;icon:ConditionIcon;label:string;value:string;usual:string;effect:Effect};
export type Verdict='Favourable'|'Mixed'|'Challenging';
export type ConditionsReading={title:string;verdict:Verdict;conditions:Condition[]};

const signed=(value:number,digits=0)=>`${value>0?'+':value<0?'−':''}${Math.abs(value).toFixed(digits)}`;

export function hangTime(veraison:number,harvest:HarvestReading){
  return daysBetween(veraison,addDays(harvest.start,Math.round(PICKING_DAYS/2)));
}

/**
 * Pinot Noir is read for colour and tannin, Chardonnay for freshness. The
 * thresholds compare the year to its own village's normal, so the same rules
 * hold in a warm village and a cool one.
 */
export function ripeningConditions(grape:GrapeId,year:RipeningWeather,normal:RipeningWeather,hang:number,normalHang:number):ConditionsReading{
  const hangDiff=hang-normalHang;
  const hangEffect:Effect=hangDiff>=4?'helps':hangDiff<=-4?'hurts':'neutral';
  const nightsDiff=year.coolNights-normal.coolNights;
  const nights:Condition={id:'nights',icon:'moon',label:'Cool nights',value:`${Math.round(year.coolNights*100)}%`,usual:`usual ${Math.round(normal.coolNights*100)}%`,
    effect:nightsDiff>=.05?'helps':nightsDiff<=-.05?'hurts':'neutral'};
  const heat:Condition={id:'heat',icon:'flame',label:'Heat stress',value:`${year.heatStressDays} day${year.heatStressDays===1?'':'s'}`,usual:`usual ${Math.round(normal.heatStressDays)}`,
    effect:year.heatStressDays>normal.heatStressDays+1?'hurts':year.heatStressDays<=normal.heatStressDays?'helps':'neutral'};
  const hangTile:Condition={id:'hang',icon:'clock',label:'Hang time',value:`${hang} days`,usual:`usual ${normalHang}`,effect:hangEffect};
  const rainPct=pct(year.rain,normal.rain);
  const tempDiff=year.meanTemp-normal.meanTemp;

  let conditions:Condition[];let title:string;
  if(grape==='chardonnay'){
    title='Freshness & acidity';
    const acidity:Effect=tempDiff<=-.6?'helps':tempDiff>=.6?'hurts':'neutral';
    conditions=[
      {id:'acidity',icon:'spark',label:'Acidity',value:acidity==='helps'?'Higher':acidity==='hurts'?'Lower':'Usual',usual:'vs usual',effect:acidity},
      {id:'warmth',icon:'therm',label:'Avg warmth',value:`${year.meanTemp.toFixed(1)} °C`,usual:`usual ${normal.meanTemp.toFixed(1)}`,effect:tempDiff<=-.6?'helps':tempDiff>=.6?'hurts':'neutral'},
      nights,heat,hangTile,
      {id:'rain',icon:'drop',label:'Late rain',value:`${Math.round(year.rain)} mm`,usual:`usual ${Math.round(normal.rain)}`,effect:rainPct>=.3?'hurts':'neutral'}
    ];
  }else{
    title='Colour & tannin';
    // Sugar runs ahead of skins and seeds when a short, hot finish rushes it.
    const rushed=tempDiff>=1.2&&hangDiff<=-3;
    const sunPct=pct(year.radiation,normal.radiation);
    conditions=[
      {id:'balance',icon:'scale',label:'Balance',value:rushed?'Sugar ahead':'In step',usual:rushed?'of tannin':'with sugar',effect:rushed?'hurts':'helps'},
      nights,heat,hangTile,
      {id:'sun',icon:'sun',label:'Sunshine',value:`${signed(Math.round(sunPct*100))}%`,usual:'vs usual',effect:sunPct>=.08?'helps':sunPct<=-.08?'hurts':'neutral'},
      {id:'rain',icon:'drop',label:'Late rain',value:`${Math.round(year.rain)} mm`,usual:`usual ${Math.round(normal.rain)}`,effect:rainPct>=.3?'hurts':rainPct<=-.3?'helps':'neutral'}
    ];
  }
  const score=conditions.reduce((total,item)=>total+(item.effect==='helps'?1:item.effect==='hurts'?-1:0),0);
  return {title,verdict:score>=2?'Favourable':score<=-2?'Challenging':'Mixed',conditions};
}

/* ---------- One village, one year: everything the detail page shows ---------- */

export type GrapeReading={
  grape:GrapeId;
  ripe:number|null;
  normalRipe:number|null;
  veraison:number;
  picking:PickingReading|null;
  normalPicking:PickingReading|null;
  /** Days between picking starting and full ripeness; positive = picked before ripe. */
  pickGap:number|null;
  normalPickGap:number|null;
  conditions:ConditionsReading|null;
};

export function readGrape(grape:GrapeId,year:number,season:GrapeSeason,normal:VillageNormal['grapes'][GrapeId],harvest:HarvestReading|null,ripeSugar:number):GrapeReading{
  const veraison=isoDay(season.veraison);
  const ripe=dayReaching(season.sugar,year,ripeSugar);
  const normalRipe=normal?dayReaching(normal.sugar,year,ripeSugar):null;
  const picking=harvest?sugarAtPicking(season.sugar,year,harvest.start,harvest.end):null;
  const normalPicking=harvest&&normal?sugarAtPicking(normal.sugar,year,harvest.typicalStart,addDays(harvest.typicalStart,PICKING_DAYS)):null;
  let conditions:ConditionsReading|null=null;
  if(harvest&&normal){
    const normalHarvest={...harvest,start:harvest.typicalStart,end:addDays(harvest.typicalStart,PICKING_DAYS)};
    conditions=ripeningConditions(grape,season.ripening,normal.ripening,hangTime(veraison,harvest),hangTime(seasonDay(year,normal.veraison),normalHarvest));
  }
  return {
    grape,ripe,normalRipe,veraison,picking,normalPicking,
    pickGap:harvest&&ripe!=null?daysBetween(harvest.start,ripe):null,
    normalPickGap:harvest&&normalRipe!=null?daysBetween(harvest.typicalStart,normalRipe):null,
    conditions
  };
}

export type SeasonReading={
  year:number;
  harvest:HarvestReading|null;
  levels:SeasonLevels;
  distance:number;
  score:SeasonScore;
  character:string;
};

export function readSeason(year:number,season:VillageSeason,normal:VillageNormal,harvest:AreaHarvest|undefined):SeasonReading{
  const reading=harvestFor(harvest,year);
  const levels=seasonLevels(season,normal);
  const shift=reading?.shiftDays??0;
  const distance=seasonDistance(levels,shift);
  return {year,harvest:reading,levels,distance,score:seasonScore(distance),character:seasonCharacter(levels,shift)};
}

/** The year whose whole season sat closest to the typical one. */
export function closestToTypical(readings:readonly SeasonReading[]){
  return readings.reduce<SeasonReading|null>((best,item)=>!best||item.distance<best.distance?item:best,null)?.year??null;
}

/** The warm-early ↔ cool-late tint shared by the strip and the year tiles. */
export function shiftTone(days:number){
  if(days<=-15)return 'early-3';
  if(days<=-8)return 'early-2';
  if(days<=-3)return 'early-1';
  if(days<3)return 'typical';
  if(days<8)return 'late-1';
  if(days<13)return 'late-2';
  return 'late-3';
}

export { signed };

/* ---------- "Same era" comparison ---------- */

export type Baseline='standard'|'era';
export const ERA_YEARS=30;

/** The 30 seasons around `year`, shifted inward at either end of the record. */
export function eraWindow(year:number,first:number,last:number){
  let from=year-15,to=year+14;
  if(from<first){to+=first-from;from=first}
  if(to>last){from-=to-last;to=last}
  return {from:Math.max(first,from),to};
}

const avg=(values:number[])=>values.reduce((total,value)=>total+value,0)/Math.max(1,values.length);
const quantile=(values:number[],q:number)=>{
  const sorted=[...values].sort((a,b)=>a-b);
  const k=(sorted.length-1)*q,low=Math.floor(k),high=Math.ceil(k);
  return sorted[low]+(sorted[high]-sorted[low])*(k-low);
};
const dayOfYear=(iso:string)=>daysBetween(Date.UTC(Number(iso.slice(0,4)),0,1),isoDay(iso))+1;
const monthDayOf=(doy:number)=>{const d=new Date(Date.UTC(2001,0,Math.round(doy)));return `${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`};

/**
 * A village's normal over the 30 seasons around `year`, built from its own
 * record, with the area's typical harvest start over the same seasons. Lets an
 * old vintage be read against its own time, not against today's warmer normal.
 */
export function eraNormal(years:Record<string,VillageSeason>,harvest:AreaHarvest,year:number){
  const all=Object.keys(years).map(Number).sort((a,b)=>a-b);
  const {from,to}=eraWindow(year,all[0],all[all.length-1]);
  const seasons=all.filter(y=>y>=from&&y<=to).map(y=>years[String(y)]);
  const field=(read:(season:VillageSeason)=>number)=>avg(seasons.map(read));
  const grapes:VillageNormal['grapes']={};
  for(const grape of ['pinot-noir','chardonnay'] as const){
    const own=seasons.map(season=>season.grapes[grape]).filter((item):item is GrapeSeason=>!!item);
    if(!own.length)continue;
    const columns=own[0].sugar.values.map((_,i)=>own.map(item=>item.sugar.values[i]));
    grapes[grape]={
      veraison:monthDayOf(avg(own.map(item=>dayOfYear(item.veraison)))),
      sugar:{...own[0].sugar,values:columns.map(column=>Math.round(avg(column)*10)/10)},
      sugarLow:columns.map(column=>quantile(column,.1)),
      sugarHigh:columns.map(column=>quantile(column,.9)),
      ripening:{
        meanTemp:avg(own.map(item=>item.ripening.meanTemp)),
        coolNights:avg(own.map(item=>item.ripening.coolNights)),
        heatStressDays:avg(own.map(item=>item.ripening.heatStressDays)),
        rain:avg(own.map(item=>item.ripening.rain)),
        radiation:avg(own.map(item=>item.ripening.radiation))
      }
    };
  }
  const normal:VillageNormal={
    gdd:Math.round(field(s=>s.gdd)),rainAprSep:Math.round(field(s=>s.rainAprSep)),augNights:Math.round(field(s=>s.augNights)*10)/10,
    frostDays:Math.round(field(s=>s.frostDays)*10)/10,heatDays:Math.round(field(s=>s.heatDays)),sepRain:Math.round(field(s=>s.sepRain)),grapes
  };
  const starts=Object.entries(harvest.years).filter(([y])=>Number(y)>=from&&Number(y)<=to).map(([,entry])=>dayOfYear(entry.date));
  return {normal,harvest:{...harvest,typical:starts.length?monthDayOf(avg(starts)):harvest.typical},from,to};
}
