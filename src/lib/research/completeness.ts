import type { DeepSearchResult } from '../db/schema';

/** Reused scopes can produce a report before the whole wine has been researched. */
export function isDeepSearchComplete(result:DeepSearchResult|null|undefined,vintage:number|null|undefined){
  if(!result)return false;
  const required=['summary','producerDetails','producerWinemakingPractices','terroir','winemakingTechniques','drinkingWindow'] as const;
  return required.every(field=>Boolean(result[field]?.trim()))
    &&(vintage==null||Boolean(result.vintageQuality?.trim()));
}
