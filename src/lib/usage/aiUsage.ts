import { marginalCostUsd,monthCostUsd,toLocal,type AiRates,type UsageTotals } from './rates';

/**
 * The AI usage ledger: one row per Gemini call, tagged with the run it belongs
 * to, so a per-run cost is a division rather than a guess.
 *
 * Writes are never allowed to fail a request. Recognition and research are the
 * product; this is the meter beside it, and a meter that can break the thing it
 * measures is worse than no meter.
 */
export const AI_USAGE_KINDS=['producer_research','wine_research','scan_single','scan_batch','scan_group'] as const;
export type AiUsageKind=typeof AI_USAGE_KINDS[number];

export const kindLabels:Record<AiUsageKind,string>={
  producer_research:'Producer Deep Search',
  wine_research:'Wine Deep Search',
  scan_single:'Single scan',
  scan_batch:'Batch scan',
  scan_group:'Group photo'
};

export type AiUsageEvent={
  kind:AiUsageKind;runId:string;targetId?:string|null;model:string;
  requests?:number;searchQueries?:number;promptTokens?:number;outputTokens?:number;
};

/** Cloudflare's Analytics Engine, when a dataset is bound. */
export type AnalyticsSink={writeDataPoint:(point:{blobs?:string[];doubles?:number[];indexes?:string[]})=>void};
export type AiUsageEnv={DB:D1Database;AI_USAGE?:AnalyticsSink};

const whole=(value:unknown)=>{const parsed=Math.round(Number(value)||0);return parsed>0?parsed:0};
/** Raw events are the per-run detail; past this the monthly rollup is the record. */
export const RAW_EVENT_RETENTION_DAYS=90;

export async function recordAiUsage(env:AiUsageEnv,owner:string,event:AiUsageEvent){
  const requests=whole(event.requests??1),searchQueries=whole(event.searchQueries);
  const promptTokens=whole(event.promptTokens),outputTokens=whole(event.outputTokens);
  if(!requests&&!searchQueries&&!promptTokens&&!outputTokens)return;
  const stamp=new Date().toISOString(),month=stamp.slice(0,7);
  try{
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO ai_usage_events(id,owner_id,kind,run_id,target_id,model,requests,search_queries,prompt_tokens,output_tokens,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(crypto.randomUUID(),owner,event.kind,event.runId,event.targetId??null,event.model,requests,searchQueries,promptTokens,outputTokens,stamp),
      env.DB.prepare(`INSERT INTO ai_usage_monthly(owner_id,month,kind,requests,search_queries,prompt_tokens,output_tokens,updated_at)
        VALUES(?,?,?,?,?,?,?,?)
        ON CONFLICT(owner_id,month,kind) DO UPDATE SET
          requests=ai_usage_monthly.requests+excluded.requests,
          search_queries=ai_usage_monthly.search_queries+excluded.search_queries,
          prompt_tokens=ai_usage_monthly.prompt_tokens+excluded.prompt_tokens,
          output_tokens=ai_usage_monthly.output_tokens+excluded.output_tokens,
          updated_at=excluded.updated_at`)
        .bind(owner,month,event.kind,requests,searchQueries,promptTokens,outputTokens,stamp),
      env.DB.prepare(`DELETE FROM ai_usage_events WHERE owner_id=? AND created_at<datetime('now','-${RAW_EVENT_RETENTION_DAYS} days')`).bind(owner)
    ]);
  }catch(e){console.error(JSON.stringify({event:'ai_usage_write_failed',kind:event.kind,error:(e as Error).message}))}
  // The same numbers into Analytics Engine, where they become a time series
  // the Cloudflare dashboard can chart and alert on without touching D1.
  try{
    env.AI_USAGE?.writeDataPoint({
      indexes:[event.kind],
      blobs:[event.kind,event.model,event.runId,owner],
      doubles:[requests,searchQueries,promptTokens,outputTokens]
    });
  }catch(e){console.error(JSON.stringify({event:'ai_usage_analytics_failed',kind:event.kind,error:(e as Error).message}))}
}

export type KindSpend={
  kind:AiUsageKind;label:string;runs:number;requests:number;
  searchQueries:number;promptTokens:number;outputTokens:number;
  costPerRun:number;cost:number;searchesPerRun:number;
};
export type UsageSummary={
  currency:string;days:number;
  kinds:KindSpend[];
  month:{month:string;searchQueries:number;freeRemaining:number;cost:number;billableSearches:number};
  /** True once nothing has been metered yet, so the page can say so rather than showing zeros. */
  empty:boolean;
};

type EventRow={kind:string;model:string;requests:number;search_queries:number;prompt_tokens:number;output_tokens:number};
type RunRow={kind:string;runs:number};
type MonthRow={search_queries:number;prompt_tokens:number;output_tokens:number};

export async function usageSummary(db:D1Database,owner:string,rates:AiRates,days=30):Promise<UsageSummary>{
  const window=Math.max(1,Math.min(RAW_EVENT_RETENTION_DAYS,Math.floor(days)||30));
  const month=new Date().toISOString().slice(0,7);
  // Grouped by model as well as kind, because a run can escalate to a second
  // model and the two are not priced the same. Runs are counted separately, or
  // a run that used two models would be counted twice.
  const [events,runs,monthTotals]=await Promise.all([
    db.prepare(`SELECT kind,model,sum(requests) AS requests,sum(search_queries) AS search_queries,
        sum(prompt_tokens) AS prompt_tokens,sum(output_tokens) AS output_tokens
      FROM ai_usage_events WHERE owner_id=? AND created_at>datetime('now','-${window} days') GROUP BY kind,model`).bind(owner).all<EventRow>(),
    db.prepare(`SELECT kind,count(DISTINCT run_id) AS runs FROM ai_usage_events
      WHERE owner_id=? AND created_at>datetime('now','-${window} days') GROUP BY kind`).bind(owner).all<RunRow>(),
    db.prepare(`SELECT sum(search_queries) AS search_queries,sum(prompt_tokens) AS prompt_tokens,sum(output_tokens) AS output_tokens
      FROM ai_usage_monthly WHERE owner_id=? AND month=?`).bind(owner,month).first<MonthRow>()
  ]);
  const runsByKind=new Map((runs.results??[]).map(row=>[row.kind,Number(row.runs)||0]));
  const byKind=new Map<string,KindSpend>();
  for(const row of events.results??[]){
    const totals:UsageTotals={searchQueries:Number(row.search_queries)||0,promptTokens:Number(row.prompt_tokens)||0,outputTokens:Number(row.output_tokens)||0};
    const kind=row.kind as AiUsageKind;
    const entry=byKind.get(kind)??{kind,label:kindLabels[kind]??kind,runs:runsByKind.get(kind)??0,requests:0,
      searchQueries:0,promptTokens:0,outputTokens:0,cost:0,costPerRun:0,searchesPerRun:0};
    entry.requests+=Number(row.requests)||0;
    entry.searchQueries+=totals.searchQueries;entry.promptTokens+=totals.promptTokens;entry.outputTokens+=totals.outputTokens;
    entry.cost+=toLocal(marginalCostUsd(totals,rates,row.model),rates);
    byKind.set(kind,entry);
  }
  const kinds=[...byKind.values()].map(entry=>({
    ...entry,
    costPerRun:entry.runs?entry.cost/entry.runs:0,
    searchesPerRun:entry.runs?entry.searchQueries/entry.runs:0
  })).sort((a,b)=>b.cost-a.cost);
  const monthUsage:UsageTotals={
    searchQueries:Number(monthTotals?.search_queries)||0,
    promptTokens:Number(monthTotals?.prompt_tokens)||0,
    outputTokens:Number(monthTotals?.output_tokens)||0
  };
  return {
    currency:rates.currency,days:window,kinds,
    month:{
      month,searchQueries:monthUsage.searchQueries,
      freeRemaining:Math.max(0,rates.groundingFreePerMonth-monthUsage.searchQueries),
      billableSearches:Math.max(0,monthUsage.searchQueries-rates.groundingFreePerMonth),
      cost:toLocal(monthCostUsd(monthUsage,rates),rates)
    },
    empty:kinds.length===0&&monthUsage.searchQueries===0&&monthUsage.promptTokens===0
  };
}
