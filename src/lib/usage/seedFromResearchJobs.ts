import { billingMonth } from './billingPeriod';

/**
 * Folds the search counts already recorded against research jobs into the usage
 * ledger, once.
 *
 * The ledger starts empty at deploy, but research_batch_jobs has been counting
 * search queries per submission for a while - and that is the grounding half,
 * which is both the bulk of the cost and the whole of the free allowance. Left
 * unseeded, the panel would report a full monthly allowance in a month where
 * most of it is already spent, which is worse than saying nothing.
 *
 * What it cannot recover is tokens: they were never stored. Seeded rows
 * therefore carry searches only, so their cost reads a few percent low. The
 * search count - the number the allowance is measured in - is exact.
 */
export const AI_USAGE_SEED_KEY='ai-usage-seed-v1';
/** Kept bounded so one pass cannot exhaust a worker's subrequests. */
const SEED_ROW_LIMIT=1000;
const WRITE_CHUNK=50;

const kindFor=(targetKind:string)=>targetKind==='wine'?'wine_research':'producer_research';

type JobRow={request_id:string;target_kind:string;target_id:string;model:string;search_queries:number;created_at:string};

export async function seedAiUsageOnce(db:D1Database,owner:string){
  const stamp=new Date().toISOString();
  // The claim row is the record that this has run. Nothing else guards against
  // a second pass, and a second pass would double every number it seeded.
  const claim=await db.prepare(`INSERT INTO maintenance_state(owner_id,maintenance_key,last_run_at) VALUES(?,?,?)
    ON CONFLICT(owner_id,maintenance_key) DO NOTHING`).bind(owner,AI_USAGE_SEED_KEY,stamp).run().catch(()=>null);
  if(!claim||!Number(claim.meta?.changes??0))return null;
  try{
    // Live metering began with the first event, so anything from then on is
    // already counted. Only what predates it is missing.
    const first=await db.prepare('SELECT min(created_at) AS first FROM ai_usage_events WHERE owner_id=?').bind(owner).first<{first:string|null}>();
    const cutoff=first?.first??stamp;
    const {results}=await db.prepare(
      `SELECT request_id,target_kind,target_id,model,search_queries,created_at FROM research_batch_jobs
       WHERE owner_id=? AND search_queries>0 AND created_at<? ORDER BY created_at ASC LIMIT ?`
    ).bind(owner,cutoff,SEED_ROW_LIMIT).all<JobRow>();
    const jobs=results??[];
    if(!jobs.length)return {events:0,months:0,searchQueries:0};

    const months=new Map<string,{month:string;kind:string;model:string;requests:number;searchQueries:number}>();
    const statements=jobs.map(job=>{
      const kind=kindFor(job.target_kind),month=billingMonth(new Date(job.created_at)),searches=Math.max(0,Math.round(Number(job.search_queries)||0));
      const model=job.model||'unknown';
      const key=`${month}|${kind}|${model}`,bucket=months.get(key)??{month,kind,model,requests:0,searchQueries:0};
      bucket.requests+=1;bucket.searchQueries+=searches;months.set(key,bucket);
      // Research is quoted per run, so these carry no wine count - and tokens
      // were never recorded against them.
      return db.prepare(`INSERT INTO ai_usage_events(id,owner_id,kind,run_id,target_id,model,requests,search_queries,prompt_tokens,output_tokens,units,created_at)
        VALUES(?,?,?,?,?,?,?,?,0,0,0,?)`)
        .bind(crypto.randomUUID(),owner,kind,job.request_id,job.target_id??null,job.model||'unknown',1,searches,job.created_at);
    });
    for(const bucket of months.values())statements.push(db.prepare(
      `INSERT INTO ai_usage_monthly(owner_id,month,kind,model,tier,requests,search_queries,prompt_tokens,output_tokens,updated_at)
       VALUES(?,?,?,?,'standard',?,?,0,0,?)
       ON CONFLICT(owner_id,month,kind,model,tier) DO UPDATE SET
         requests=ai_usage_monthly.requests+excluded.requests,
         search_queries=ai_usage_monthly.search_queries+excluded.search_queries,
         updated_at=excluded.updated_at`)
      .bind(owner,bucket.month,bucket.kind,bucket.model,bucket.requests,bucket.searchQueries,stamp));
    for(let index=0;index<statements.length;index+=WRITE_CHUNK)await db.batch(statements.slice(index,index+WRITE_CHUNK));
    const seeded={events:jobs.length,months:months.size,searchQueries:[...months.values()].reduce((total,bucket)=>total+bucket.searchQueries,0)};
    console.log(JSON.stringify({event:'ai_usage_seeded',owner,...seeded}));
    return seeded;
  }catch(e){
    // The claim is released so a failed seed is retried rather than silently
    // leaving the allowance under-counted forever.
    await db.prepare('DELETE FROM maintenance_state WHERE owner_id=? AND maintenance_key=?').bind(owner,AI_USAGE_SEED_KEY).run().catch(()=>undefined);
    console.error(JSON.stringify({event:'ai_usage_seed_failed',owner,error:(e as Error).message}));
    return null;
  }
}
