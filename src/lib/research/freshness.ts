export const RESEARCH_STALE_DAYS=365;
const DAY_MS=24*60*60*1000;

/**
 * Research is durable knowledge, not an expiring cache. This helper only tells
 * presentation and refresh policy when to flag an existing result as old enough
 * to merit another look; it never removes or hides the stored result.
 */
export function isResearchStale(value:string|null|undefined,now=Date.now()){
  const researched=Date.parse(String(value??''));
  return Number.isFinite(researched)&&researched<=now&&now-researched>=RESEARCH_STALE_DAYS*DAY_MS;
}
