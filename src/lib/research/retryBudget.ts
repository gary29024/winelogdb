// These stop *additional* requests after billed searches are known. A prompt's
// search limit is advisory; Google's internal searches cannot be capped here.
export const WINE_RESEARCH_SEARCH_LIMIT=12;
export const PRODUCER_RESEARCH_SEARCH_LIMIT=16;

export async function assertResearchRetryBudget(db:D1Database,owner:string,requestId:string,limit:number){
  const row=await db.prepare('SELECT coalesce(sum(search_queries),0) AS searches FROM research_batch_jobs WHERE owner_id=? AND request_id=?')
    .bind(owner,requestId).first<{searches:number}>();
  if(Number(row?.searches??0)>=limit)throw new Error(`Research stopped after ${row!.searches} Google searches to avoid further charges. Any verified research already saved is kept.`);
}
