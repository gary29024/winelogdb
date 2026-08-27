import { achievementDefinitions as previousLaunch } from './definitions';
import { additionalAchievementDefinitions } from './additionalDefinitions';
import type { AchievementDefinition,AchievementDefinitionItem } from './types';

const removed=new Set([
  'bordeaux-second-growths',
  'sauternes-barsac-second-growths',
  'cote-de-nuits-24-grand-crus',
  'cote-de-beaune-8-grand-crus',
  'gevrey-nine-grand-crus'
]);

// These classifications apply to the named classified wine, not every bottle made
// by the producer. A producer-level selector would incorrectly award d'Yquem after
// tasting Y d'Yquem, Lafite after Carruades, Margaux after Pavillon Rouge, etc.
const classifiedWineCollections=new Set([
  'bordeaux-first-growths',
  'bordeaux-1855-red-classified-growths',
  'sauternes-barsac-top-1855',
  'sauternes-barsac-1855-all',
  'graves-crus-classes',
  'saint-emilion-2022-premiers'
]);

function classifiedWineItem(item:AchievementDefinitionItem):AchievementDefinitionItem{
  if(item.selector.type!=='producer')return item;
  const producerNames=item.selector.producerNames;
  return {
    ...item,
    selector:{
      type:'cuvee',
      producerNames,
      cuveeNames:[...new Set([item.label,...producerNames])],
      ...(item.selector.producerId?{producerId:item.selector.producerId}:{})
    }
  };
}

function applyCuratedMatchingSemantics(definition:AchievementDefinition):AchievementDefinition{
  return classifiedWineCollections.has(definition.id)
    ?{...definition,items:definition.items.map(classifiedWineItem)}
    :definition;
}

export const achievementDefinitions:AchievementDefinition[]=[
  ...previousLaunch.filter(definition=>!removed.has(definition.id)).map(applyCuratedMatchingSemantics),
  ...additionalAchievementDefinitions
];

if(achievementDefinitions.length!==25)throw new Error(`Expected 25 curated launch collections, found ${achievementDefinitions.length}`);

export function getAchievementDefinition(id:string){return achievementDefinitions.find(item=>item.id===id)??null}
