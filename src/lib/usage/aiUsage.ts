import { marginalCostUsd,monthGroundingUsd,tokenCostUsd,toLocal,type AiRates,type UsageTotals } from './rates';
import { billingMonth,nextBillingReset,BILLING_TIME_ZONE } from './billingPeriod';

/**
 * The AI usage ledger: one row per Gemini call, tagged with the run it belongs
 * to, so a per-run cost is a division rather than a guess.
 *
 * Writes are never allowed to fail a request. Recognition and research are the
 * product; this is the meter beside it, and a meter that can break the thing it
 * measures is worse than no meter.
 */
export const AI_USAGE_KINDS=['producer_research','wine_research','scan_single','scan_batch','scan_group','scan_sheet','vintage_window'] as const;
export type AiUsageKind=typeof AI_USAGE_KINDS[number];

export const kindLabels:Record<AiUsageKind,string>={
  producer_research:'Producer Deep Search',
  wine_research:'Wine Deep Search',
  scan_single:'Single scan',
  scan_batch:'Batch scan',
  scan_group:'Group photo',
  scan_sheet:'Tasting sheet',
  vintage_window:'Vintage window'
};

const whole=(value:unknown)=>{const parsed=Math.round(Number(value)||0);return parsed>0?parsed:0};

export type AiUsageEvent={
  kind:AiUsageKind;runId:string;targetId?:string|null;model:string;
  requests?:number;searchQueries?:number;promptTokens?:number;outputTokens?:number;
  /**
   * How many wines this call covered. Recognition is quoted per wine, so a
   * group photo of nine bottles is nine; a batch item is one; a second call on
   * the same wine (an escalation) is zero, or it would count twice.
   */
  units?:number;
  /**
   * The service tier the call was billed on. Batch recognition queues on flex,
   * which bills about half of standard, so leaving it off overstates every
   * batch scan by roughly double.
   */
  tier?:AiUsageTier;
};

/** Vertex bills the same model differently by tier; the ledger has to know which. */
export const AI_USAGE_TIERS=['standard','flex','priority'] as const;
export type AiUsageTier=typeof AI_USAGE_TIERS[number];

/**
 * What a kind's cost is naturally quoted in. Research is per run because a run
 * is one producer or one wine; recognition is per wine because a run is a
 * session or a photograph, and how many bottles were in it is the whole
 * difference between a cheap run and an expensive one.
 */
export const unitOf:Record<AiUsageKind,'run'|'wine'>={
  producer_research:'run',wine_research:'run',scan_single:'wine',scan_batch:'wine',scan_group:'wine',scan_sheet:'wine',
  // Priced per run, because one call answers for a whole region and vintage -
  // every wine you own from that cell, not the one that asked.
  vintage_window:'run'
};

/**
 * What one Gemini reply billed.
 *
 * Thinking tokens are priced as output - Google's own table labels the row
 * "Output price (including thinking tokens)" - but they are reported apart
 * from the answer, in `thoughtsTokenCount` rather than `candidatesTokenCount`.
 * Reading only the latter undercounts the expensive half of the bill on models
 * whose whole point is that they think: output bills at six times input on the
 * recognition model and five times on the escalation one.
 */
export const geminiCallTokens=(usage?:{promptTokenCount?:unknown;candidatesTokenCount?:unknown;thoughtsTokenCount?:unknown}|null)=>({
  promptTokens:whole(usage?.promptTokenCount),
  outputTokens:whole(usage?.candidatesTokenCount)+whole(usage?.thoughtsTokenCount)
});

/** Cloudflare's Analytics Engine, when a dataset is bound. */
export type AnalyticsSink={writeDataPoint:(point:{blobs?:string[];doubles?:number[];indexes?:string[]})=>void};
export type AiUsageEnv={DB:D1Database;AI_USAGE?:AnalyticsSink};

/** Raw events are the per-run detail; past this the monthly rollup is the record. */
export const RAW_EVENT_RETENTION_DAYS=90;

export async function recordAiUsage(env:AiUsageEnv,owner:string,event:AiUsageEvent){
  const requests=whole(event.requests??1),searchQueries=whole(event.searchQueries),units=whole(event.units);
  const promptTokens=whole(event.promptTokens),outputTokens=whole(event.outputTokens);
  if(!requests&&!searchQueries&&!promptTokens&&!outputTokens)return;
  // The row is stamped in UTC, but it is filed under the month Google's
  // allowance is counted in, which resets at midnight Pacific.
  const stamp=new Date().toISOString(),month=billingMonth(),tier=event.tier??'standard';
  try{
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO ai_usage_events(id,owner_id,kind,run_id,target_id,model,tier,requests,search_queries,prompt_tokens,output_tokens,units,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(crypto.randomUUID(),owner,event.kind,event.runId,event.targetId??null,event.model,tier,requests,searchQueries,promptTokens,outputTokens,units,stamp),
      // Rolled up by model and tier as well as kind, because those two decide
      // the price and the rollup outlives the events it is made from.
      env.DB.prepare(`INSERT INTO ai_usage_monthly(owner_id,month,kind,model,tier,requests,search_queries,prompt_tokens,output_tokens,units,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(owner_id,month,kind,model,tier) DO UPDATE SET
          requests=ai_usage_monthly.requests+excluded.requests,
          search_queries=ai_usage_monthly.search_queries+excluded.search_queries,
          prompt_tokens=ai_usage_monthly.prompt_tokens+excluded.prompt_tokens,
          output_tokens=ai_usage_monthly.output_tokens+excluded.output_tokens,
          units=ai_usage_monthly.units+excluded.units,
          updated_at=excluded.updated_at`)
        .bind(owner,month,event.kind,event.model,tier,requests,searchQueries,promptTokens,outputTokens,units,stamp),
      env.DB.prepare(`DELETE FROM ai_usage_events WHERE owner_id=? AND created_at<datetime('now','-${RAW_EVENT_RETENTION_DAYS} days')`).bind(owner)
    ]);
  }catch(e){console.error(JSON.stringify({event:'ai_usage_write_failed',kind:event.kind,error:(e as Error).message}))}
  // The same numbers into Analytics Engine, where they become a time series
  // the Cloudflare dashboard can chart and alert on without touching D1.
  try{
    env.AI_USAGE?.writeDataPoint({
      indexes:[event.kind],
      blobs:[event.kind,event.model,event.runId,owner,tier],
      doubles:[requests,searchQueries,promptTokens,outputTokens,units]
    });
  }catch(e){console.error(JSON.stringify({event:'ai_usage_analytics_failed',kind:event.kind,error:(e as Error).message}))}
}

export type KindSpend={
  kind:AiUsageKind;label:string;runs:number;requests:number;
  searchQueries:number;promptTokens:number;outputTokens:number;
  cost:number;searchesPerRun:number;
  /** Wines covered, for the kinds quoted per wine. */
  units:number;
  /** What the figure is per - 'run' or 'wine' - and the figure itself. */
  unit:'run'|'wine';unitCount:number;costPerUnit:number;
  /** Kept for callers that still want the run figure whatever the unit is. */
  costPerRun:number;
};
export type UsageSummary={
  currency:string;days:number;
  kinds:KindSpend[];
  month:{month:string;searchQueries:number;freeRemaining:number;cost:number;billableSearches:number;
    /** When the allowance next resets, so the page can say it in the reader's own time. */
    resetsAt:string;timeZone:string};
  /** True once nothing has been metered yet, so the page can say so rather than showing zeros. */
  empty:boolean;
};

type EventRow={kind:string;model:string;tier:string;day:string;requests:number;search_queries:number;prompt_tokens:number;output_tokens:number;units:number};
type RunRow={kind:string;runs:number};
type MonthRow={kind:string;model:string;tier:string;search_queries:number;prompt_tokens:number;output_tokens:number};

export async function usageSummary(db:D1Database,owner:string,rates:AiRates,days=30):Promise<UsageSummary>{
  const window=Math.max(1,Math.min(RAW_EVENT_RETENTION_DAYS,Math.floor(days)||30));
  const month=billingMonth();
  // Grouped by model, tier and day as well as kind, because all three change
  // what a call cost: a run can escalate to a second model, batch recognition
  // bills on flex at about half of standard, and a price that changed part-way
  // through the window has to price each side of the change at its own rate.
  // The window is 90 days at most, so this is a handful of rows either way.
  // Runs are counted separately, or a run spanning two of those buckets would
  // be counted twice.
  const [events,runs,monthTotals]=await Promise.all([
    db.prepare(`SELECT kind,model,tier,date(created_at) AS day,sum(requests) AS requests,sum(search_queries) AS search_queries,
        sum(prompt_tokens) AS prompt_tokens,sum(output_tokens) AS output_tokens,sum(units) AS units
      FROM ai_usage_events WHERE owner_id=? AND created_at>datetime('now','-${window} days') GROUP BY kind,model,tier,day`).bind(owner).all<EventRow>(),
    db.prepare(`SELECT kind,count(DISTINCT run_id) AS runs FROM ai_usage_events
      WHERE owner_id=? AND created_at>datetime('now','-${window} days') GROUP BY kind`).bind(owner).all<RunRow>(),
    // Per model and tier, not one summed row: the fallback rate is not what a
    // 3.7 run or a flex batch was billed at, and pricing the month with it put
    // a different number under the same runs the cards above priced properly.
    db.prepare(`SELECT kind,model,tier,search_queries,prompt_tokens,output_tokens
      FROM ai_usage_monthly WHERE owner_id=? AND month=?`).bind(owner,month).all<MonthRow>()
  ]);
  const runsByKind=new Map((runs.results??[]).map(row=>[row.kind,Number(row.runs)||0]));
  const byKind=new Map<string,KindSpend>();
  for(const row of events.results??[]){
    const totals:UsageTotals={searchQueries:Number(row.search_queries)||0,promptTokens:Number(row.prompt_tokens)||0,outputTokens:Number(row.output_tokens)||0};
    const kind=row.kind as AiUsageKind;
    const entry=byKind.get(kind)??{kind,label:kindLabels[kind]??kind,runs:runsByKind.get(kind)??0,requests:0,
      searchQueries:0,promptTokens:0,outputTokens:0,units:0,cost:0,costPerRun:0,
      unit:unitOf[kind]??'run',unitCount:0,costPerUnit:0,searchesPerRun:0};
    entry.requests+=Number(row.requests)||0;entry.units+=Number(row.units)||0;
    entry.searchQueries+=totals.searchQueries;entry.promptTokens+=totals.promptTokens;entry.outputTokens+=totals.outputTokens;
    // Priced as it was billed: at that day's rate, on that call's tier.
    entry.cost+=toLocal(marginalCostUsd(totals,rates,row.model,{on:row.day,tier:row.tier}),rates);
    byKind.set(kind,entry);
  }
  const kinds=[...byKind.values()].map(entry=>{
    // A per-wine kind with no counted wines - all its events predate the
    // column - falls back to the run figure rather than dividing by nothing.
    const unit=entry.unit==='wine'&&entry.units>0?'wine' as const:'run' as const;
    const unitCount=unit==='wine'?entry.units:entry.runs;
    return {...entry,unit,unitCount,
      costPerUnit:unitCount?entry.cost/unitCount:0,
      costPerRun:entry.runs?entry.cost/entry.runs:0,
      searchesPerRun:entry.runs?entry.searchQueries/entry.runs:0};
  }).sort((a,b)=>b.cost-a.cost);
  const monthRows=monthTotals.results??[];
  const monthUsage=monthRows.reduce<UsageTotals>((totals,row)=>({
    searchQueries:totals.searchQueries+(Number(row.search_queries)||0),
    promptTokens:totals.promptTokens+(Number(row.prompt_tokens)||0),
    outputTokens:totals.outputTokens+(Number(row.output_tokens)||0)
  }),{searchQueries:0,promptTokens:0,outputTokens:0});
  // Tokens at each row's own model and tier, then the allowance applied once
  // to the month's searches as a whole. The rollup keeps no day, so a rate that
  // changed part-way through the month prices the whole of it at today's - the
  // one thing here the per-day cards can say and this cannot.
  const monthTokenUsd=monthRows.reduce((total,row)=>total+tokenCostUsd(
    {searchQueries:0,promptTokens:Number(row.prompt_tokens)||0,outputTokens:Number(row.output_tokens)||0},
    rates,row.model,{tier:row.tier}),0);
  return {
    currency:rates.currency,days:window,kinds,
    month:{
      month,searchQueries:monthUsage.searchQueries,
      resetsAt:nextBillingReset().toISOString(),timeZone:BILLING_TIME_ZONE,
      freeRemaining:Math.max(0,rates.groundingFreePerMonth-monthUsage.searchQueries),
      billableSearches:Math.max(0,monthUsage.searchQueries-rates.groundingFreePerMonth),
      cost:toLocal(monthGroundingUsd(monthUsage.searchQueries,rates)+monthTokenUsd,rates)
    },
    empty:kinds.length===0&&monthUsage.searchQueries===0&&monthUsage.promptTokens===0
  };
}
