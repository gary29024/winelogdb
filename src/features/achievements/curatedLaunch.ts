import { achievementDefinitions as previousLaunch } from './definitions';
import { additionalAchievementDefinitions } from './additionalDefinitions';
import { benchmarkCourseDefinition } from './benchmarkCourseDefinition';
import { michelinAchievementDefinitions } from './michelinDefinitions';
import { pfvAndAmericanAvaDefinitions } from './pfvAndAmericanAvas';
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

// Curated cards are deliberately grouped by wine geography rather than by the
// date each definition happened to land in the repository. Within each region,
// foundational classifications/benchmarks come first and guide editions follow
// in tier order. Global and historic collections finish the library.
export const curatedCollectionOrder:readonly string[]=[
  'bordeaux-first-growths',
  'bordeaux-1855-red-classified-growths',
  'sauternes-barsac-top-1855',
  'sauternes-barsac-1855-all',
  'graves-crus-classes',
  'saint-emilion-2022-premiers',
  'pomerol-benchmark-estates',
  'michelin-grapes-bordeaux-2026-three',
  'michelin-grapes-bordeaux-2026-two',
  'michelin-grapes-bordeaux-2026-one',
  'michelin-grapes-bordeaux-2026-selected',
  'burgundy-33-grand-crus',
  'domaine-romanee-conti',
  'chablis-seven-grand-cru-climats',
  'beaujolais-ten-crus',
  'michelin-grapes-burgundy-2026-three',
  'michelin-grapes-burgundy-2026-two',
  'michelin-grapes-burgundy-2026-one',
  'michelin-grapes-burgundy-2026-selected',
  'northern-rhone-eight-crus',
  'southern-rhone-ten-crus',
  'champagne-prestige-houses',
  'champagne-special-club',
  'barolo-great-crus',
  'super-tuscans',
  'tuscany-appellations',
  'italy-istituto-grandi-marchi',
  'amarone-famiglie-storiche',
  'napa-historic-estates',
  'napa-cult-cabernets',
  'oregon-pinot-pioneers',
  'washington-benchmark-estates',
  'napa-valley-17-nested-avas',
  'willamette-valley-11-nested-avas',
  'australia-first-families',
  'new-zealand-family-of-twelve',
  'primum-familiae-vini-12',
  'world-benchmark-producers',
  'judgment-of-paris-1976'
];

const previousIds=new Set(previousLaunch.map(definition=>definition.id));
const unorderedDefinitions:AchievementDefinition[]=[
  ...previousLaunch.filter(definition=>!removed.has(definition.id)).map(applyCuratedMatchingSemantics),
  ...michelinAchievementDefinitions.filter(definition=>!previousIds.has(definition.id)),
  ...additionalAchievementDefinitions,
  ...pfvAndAmericanAvaDefinitions,
  benchmarkCourseDefinition
];

const curatedRank=new Map(curatedCollectionOrder.map((id,index)=>[id,index]));
export const achievementDefinitions:AchievementDefinition[]=unorderedDefinitions.sort((a,b)=>
  (curatedRank.get(a.id)??Number.MAX_SAFE_INTEGER)-(curatedRank.get(b.id)??Number.MAX_SAFE_INTEGER)
  ||a.title.localeCompare(b.title)
);

// No fixed count: the set grows. What has to hold is that every card is
// reachable and distinct - a duplicate id would make two collections share one
// page and one progress row.
const duplicate=achievementDefinitions.find((definition,index)=>achievementDefinitions.findIndex(item=>item.id===definition.id)!==index);
if(duplicate)throw new Error(`Duplicate curated collection id: ${duplicate.id}`);

export function getAchievementDefinition(id:string){return achievementDefinitions.find(item=>item.id===id)??null}
