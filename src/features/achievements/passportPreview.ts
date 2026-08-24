import type { AchievementProgress } from './types';

const defaultPreviewIds=[
  'bordeaux-first-growths',
  'michelin-grapes-burgundy-2026-three',
  'judgment-of-paris-1976'
] as const;

function compareActive(a:AchievementProgress,b:AchievementProgress){
  return b.percent-a.percent||b.completed-a.completed||a.total-b.total||a.definition.title.localeCompare(b.definition.title);
}

function compareComplete(a:AchievementProgress,b:AchievementProgress){
  return a.total-b.total||a.definition.title.localeCompare(b.definition.title);
}

function comparePossible(a:AchievementProgress,b:AchievementProgress){
  return b.possible-a.possible||compareActive(a,b);
}

export function selectPassportCollections(collections:AchievementProgress[],limit=3){
  if(limit<=0)return [];
  const selected:AchievementProgress[]=[];
  const seen=new Set<string>();
  const add=(collection:AchievementProgress|undefined)=>{
    if(!collection||selected.length>=limit||seen.has(collection.definition.id))return;
    selected.push(collection);seen.add(collection.definition.id);
  };

  const completed=collections.filter(item=>item.complete).sort(compareComplete);
  const active=collections.filter(item=>!item.complete&&item.completed>0).sort(compareActive);
  const possible=collections.filter(item=>!item.complete&&item.completed===0&&item.possible>0).sort(comparePossible);
  const byId=new Map(collections.map(item=>[item.definition.id,item]));

  // Keep an earned stamp visible, then prioritize the user's closest unfinished challenges.
  add(completed[0]);
  for(const item of active)add(item);
  for(const item of possible)add(item);
  for(const id of defaultPreviewIds)add(byId.get(id));
  for(const item of collections)add(item);
  return selected.slice(0,limit);
}

export function passportCollectionSummary(collections:AchievementProgress[]){
  return {
    complete:collections.filter(item=>item.complete).length,
    active:collections.filter(item=>item.completed>0&&!item.complete).length,
    possible:collections.reduce((sum,item)=>sum+item.possible,0),
    total:collections.length
  };
}

export function passportCollectionKicker(collection:AchievementProgress){
  if(collection.complete)return 'STAMP EARNED';
  if(collection.completed>0)return 'IN PROGRESS';
  if(collection.possible>0)return 'NEEDS LINKING';
  if(collection.definition.series)return `${collection.definition.series.authority.toUpperCase()} · ${collection.definition.series.edition}`;
  return 'COLLECTION';
}
