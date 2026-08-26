export type JourneySummary={
  totalWines:number;
  producers:number;
  countries:number;
  regions:number;
  appellations:number;
  vintages:number;
  favorites:number;
  averageRating:number|null;
  ratedWines:number;
  pricedWines:number;
  structuredTastings:number;
};

export type MilestoneKey='totalWines'|'producers'|'appellations'|'countries'|'structuredTastings';
/**
 * `progress` is progress through the *current* band, not from zero: at 858
 * wines with stamps at 500 and 1000 it is 72%, not 86%. Whatever renders it has
 * to say so, which is what `previous` is for - a ring reading 72% beside the
 * words "858 / 1000" is a contradiction the reader has to resolve.
 */
export type Milestone={key:MilestoneKey;label:string;current:number;target:number;previous:number;progress:number};
export type Achievement={key:MilestoneKey;label:string;value:number};

const milestoneSets:Array<{key:MilestoneKey;label:string;thresholds:number[]}>= [
  {key:'totalWines',label:'Wines logged',thresholds:[10,25,50,100,200,500,1000]},
  {key:'producers',label:'Producers explored',thresholds:[10,25,50,100,200,500]},
  {key:'appellations',label:'Appellations explored',thresholds:[10,25,50,100,200]},
  {key:'countries',label:'Countries explored',thresholds:[5,10,20,30,50]},
  {key:'structuredTastings',label:'Structured tastings',thresholds:[10,25,50,100,250,500]}
];

export function nextMilestones(summary:JourneySummary):Milestone[]{
  return milestoneSets.map(set=>{
    const current=summary[set.key];
    const target=set.thresholds.find(value=>value>current)??Math.ceil((current+1)/100)*100;
    const previous=[...set.thresholds].reverse().find(value=>value<=current)??0;
    const span=Math.max(1,target-previous);
    return {key:set.key,label:set.label,current,target,previous,progress:Math.max(0,Math.min(1,(current-previous)/span))};
  });
}

/** One stamp on a track: a threshold, and whether it has been reached. */
export type LadderStamp={value:number;earned:boolean;next:boolean};
export type LadderTrack={key:MilestoneKey;label:string;current:number;earned:number;total:number;next:LadderStamp|null;remaining:number;stamps:LadderStamp[]};

/**
 * Every stamp on every track, so the passport can show what is being collected
 * rather than only the two most recently earned. A track past its last listed
 * threshold has no next stamp - the milestone sets are finite, and inventing
 * one would promise something the app does not award.
 */
export function journeyLadder(summary:JourneySummary):LadderTrack[]{
  return milestoneSets.map(set=>{
    const current=summary[set.key];
    const nextValue=set.thresholds.find(value=>value>current)??null;
    const stamps=set.thresholds.map(value=>({value,earned:value<=current,next:value===nextValue}));
    return {
      key:set.key,label:set.label,current,
      earned:stamps.filter(stamp=>stamp.earned).length,
      total:stamps.length,
      next:stamps.find(stamp=>stamp.next)??null,
      remaining:nextValue===null?0:nextValue-current,
      stamps
    };
  });
}

export function unlockedAchievements(summary:JourneySummary):Achievement[]{
  return milestoneSets.flatMap(set=>{
    const current=summary[set.key];
    const reached=[...set.thresholds].reverse().find(value=>value<=current);
    return reached?[{key:set.key,label:set.label,value:reached}]:[];
  });
}

export type StructureKey='flavourIntensity'|'acidity'|'tannin'|'body'|'finish'|'alcohol';
export type StructureSample={structure:Partial<Record<StructureKey,string>>;rating:number|null};
export type StructureProfileRow={key:StructureKey;label:string;all:string|null;top:string|null};
export type StructureProfile={rows:StructureProfileRow[];topRatedCutoff:number|null;topRatedCount:number;ratedCount:number};

const structureFields:Array<{key:StructureKey;label:string;values:string[]}>= [
  {key:'flavourIntensity',label:'Intensity',values:['light','medium_minus','medium','medium_plus','pronounced']},
  {key:'acidity',label:'Acidity',values:['low','medium_minus','medium','medium_plus','high']},
  {key:'tannin',label:'Tannin',values:['low','medium_minus','medium','medium_plus','high']},
  {key:'body',label:'Body',values:['light','medium_minus','medium','medium_plus','full']},
  {key:'finish',label:'Finish',values:['short','medium_minus','medium','medium_plus','long']},
  {key:'alcohol',label:'Perceived alcohol',values:['low','medium','high']}
];

export const structureDisplay:Record<string,string>={
  light:'Light',low:'Low',short:'Short',medium_minus:'M−',medium:'M',medium_plus:'M+',high:'High',full:'Full',long:'Long',pronounced:'Pronounced'
};

function dominantValue(samples:StructureSample[],key:StructureKey,allowed:string[]){
  const counts=new Map<string,number>();
  for(const sample of samples){const value=sample.structure[key];if(value&&allowed.includes(value))counts.set(value,(counts.get(value)??0)+1)}
  let best:string|null=null,bestCount=0;
  for(const value of allowed){const count=counts.get(value)??0;if(count>bestCount){best=value;bestCount=count}}
  return best;
}

export function buildStructureProfile(samples:StructureSample[]):StructureProfile{
  const rated=samples.filter((sample):sample is StructureSample&{rating:number}=>sample.rating!=null&&Number.isFinite(sample.rating)).sort((a,b)=>b.rating-a.rating);
  const topCount=rated.length?Math.max(1,Math.ceil(rated.length*.25)):0;
  const cutoff=topCount?rated[topCount-1].rating:null;
  const top=cutoff==null?[]:rated.filter(sample=>sample.rating>=cutoff);
  return {
    rows:structureFields.map(field=>({key:field.key,label:field.label,all:dominantValue(samples,field.key,field.values),top:dominantValue(top,field.key,field.values)})),
    topRatedCutoff:cutoff,
    topRatedCount:top.length,
    ratedCount:rated.length
  };
}
