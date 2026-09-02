/**
 * The in-memory caches that summarise everything an owner has drunk.
 *
 * The Passport, Insights and the collections each hold their answer for thirty
 * seconds so that moving between them is free. Nothing told them when that
 * answer stopped being true, so deleting a wine and walking to the Passport
 * showed the count from before the delete - for up to half a minute, with no
 * way to force it but a reload.
 *
 * A registry rather than direct imports, for two reasons. The journey and
 * achievement modules are lazily loaded with their pages, and importing them
 * from the wine API to call a reset would pull both into every bundle that can
 * save a wine. And a cache that registers itself cannot be forgotten by the
 * next person to add one: there is one thing to call, and it reaches all of
 * them.
 */
const resets=new Set<()=>void>();

/** Called by a cache as it loads, so it is reset with the rest. */
export function registerSummaryCache(reset:()=>void){
  resets.add(reset);
  return()=>{resets.delete(reset)};
}

/**
 * Something changed about what has been drunk. Every summary is now a guess.
 *
 * Call it after a write lands, not before: a reset that runs while the write is
 * in flight would be refilled with the answer it is trying to throw away.
 */
export function summariesChanged(){
  for(const reset of resets)reset();
}
