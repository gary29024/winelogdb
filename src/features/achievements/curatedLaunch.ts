import { achievementDefinitions as previousLaunch } from './definitions';
import { additionalAchievementDefinitions } from './additionalDefinitions';
import type { AchievementDefinition } from './types';

const removed=new Set([
  'bordeaux-second-growths',
  'sauternes-barsac-second-growths',
  'cote-de-nuits-24-grand-crus',
  'cote-de-beaune-8-grand-crus',
  'gevrey-nine-grand-crus'
]);

export const achievementDefinitions:AchievementDefinition[]=[
  ...previousLaunch.filter(definition=>!removed.has(definition.id)),
  ...additionalAchievementDefinitions
];

if(achievementDefinitions.length!==20)throw new Error(`Expected 20 curated launch collections, found ${achievementDefinitions.length}`);

export function getAchievementDefinition(id:string){return achievementDefinitions.find(item=>item.id===id)??null}
