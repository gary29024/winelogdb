import { benchmarkCourseHeadings } from './benchmarkCourseDefinition';
import { checklistHeadings } from './expandedDefinitions';

export type AchievementChecklistHeading={section:string|null;subsection:string|null};

const NONE:AchievementChecklistHeading={section:null,subsection:null};

/**
 * The heading one checklist row sits under, or nothing for a collection that
 * does not divide.
 *
 * Answered from the item, never from where it sits in the list. A growth, a
 * classification and a commune are all facts about the wine; a position is
 * only a fact about an array, and the two came apart in production - the
 * checklist is served from a per-owner cache that can be a release behind, so
 * reordering the Graves estates by what they are classified for left the old
 * order in the cache with new headings laid over it, and Château Pape Clément
 * was shown as classified for white. The lists are still grouped in heading
 * order, because the page heads consecutive runs, but that now decides only
 * how tidily the page groups - never what a wine is called.
 */
export function achievementChecklistHeading(definitionId:string,itemId:string):AchievementChecklistHeading{
  if(definitionId==='world-benchmark-producers')return benchmarkCourseHeadings[itemId]??NONE;
  return checklistHeadings[definitionId]?.[itemId]??NONE;
}
