import type { AiUsageTier } from './tiers';
import { marginalCostUsd,monthGroundingUsd,tokenCostUsd,toLocal,type AiRates,type UsageTotals } from './rates';
import { billingMonth,nextBillingReset,BILLING_TIME_ZONE } from './billingPeriod';

/**
 * The AI usage ledger: one row per model call, tagged with the run it belongs
 * to, so a per-run cost is a division rather than a guess.
 *
 * Writes are never allowed to fail a request. Recognition, research and search
 * are the product; this is the meter beside them, and a meter that can break
 * the thing it measures is worse than no meter.
 */
export const AI_USAGE_KINDS=['producer_research','wine_research','scan_single','scan_batch','scan_group','scan_sheet','bottle_frame','vintage_window','search_embedding'] as const;
export type AiUsageKind=typeof AI_USAGE_KINDS[number];

export const kindLabels:Record<AiUsageKind,string>={
  producer_research:'Producer Deep Search',
  wine_research:'Wine Deep Search',
  scan_single:'Single scan',
  scan_batch:'Batch scan',
  scan_group:'Group photo',
  scan_sheet:'Tasting sheet',
  bottle_frame:'Bottle framing',
  vintage_window:'Vintage window',
  search_embedding:'Smart search'
};

const whole=(value:unknown)=>{const parsed=Math.round(Number(value)||0);return parsed>0?parsed:0};

export type AiUsageEvent={
  /** Stable only for a persisted provider response, never for a fresh API attempt. */
  eventId?:string;
  kind:AiUsageKind;runId:string;targetId?:string|null;model:string;
  requests?:number;searchQueries?:number;promptTokens?:number;outputTokens?:number;
  /**
   * How many wines this call covered. Recognition is quoted per wine, and
   * Smart-search document indexing uses the same unit. Query embeddings add a
   * request but deliberately add zero wine units.
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
export { AI_USAGE_TIERS,type AiUsageTier } from './tiers';

/** What a kind's cost is naturally quoted in. */
export const unitOf:Record<AiUsageKind,'run'|'wine'>={
  producer_research:'run',wine_research:'run',scan_single:'wine',scan_batch:'wine',scan_group:'wine',scan_sheet:'wine',
  bottle_frame:'wine',
  vintage_window:'run',
  search_embedding:'wine'
};

/**
 * What one Gemini reply billed. Thinking tokens are priced as output but are
 * reported separately from answer tokens, so both have to be counted.
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
  const stamp=new Date().toISOString(),month=billingMonth(),tier=event.tier??'standard',eventId=event.eventId??crypto.randomUUID();
  try{
    const writes=await env.DB.batch([
      env.DB.prepare(`INSERT INTO ai_usage_monthly(owner_id,month,kind,model,tier,requests,search_queries,prompt_tokens,output_tokens,units,updated_at)
        SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM ai_usage_events WHERE id=?)
        ON CONFLICT(owner_id,month,kind,model,tier) DO UPDATE SET
          requests=ai_usage_monthly.requests+excluded.requests,
          search_queries=ai_usage_monthly.search_queries+excluded.search_queries,
          prompt_tokens=ai_usage_monthly.prompt_tokens+excluded.prompt_tokens,
          output_tokens=ai_usage_monthly.output_tokens+excluded.output_tokens,
          units=ai_usage_monthly.units+excluded.units,
          updated_at=excluded.updated_at`)
        .bind(owner,month,event.kind,event.model,tier,requests,searchQueries,promptTokens,outputTokens,units,stamp,eventId),
      env.DB.prepare(`INSERT INTO ai_usage_events(id,owner_id,kind,run_id,target_id,model,tier,requests,search_queries,prompt_tokens,output_tokens,units,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`)
        .bind(eventId,owner,event.kind,event.runId,event.targetId??null,event.model,tier,requests,searchQueries,promptTokens,outputTokens,units,stamp),
      env.DB.prepare(`DELETE FROM ai_usage_events WHERE owner_id=? AND created_at<datetime('now','-${RAW_EVENT_RETENTION_DAYS} days')`).bind(owner)
    ]);
    if(writes[1]?.meta?.changes===0)return;
  }catch(e){console.error(JSON.stringify({event:'ai_usage_write_failed',kind:event.kind,error:(e as Error).message}))}
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

export type RunSpendPart={
  model:string;tier:string;createdAt:string;requests:number;searchQueries:number;
  promptTokens:number;outputTokens:number;cost:number;
};

export type AiUsageRunSpend={
  kind:AiUsageKind;runId:string;targetId:string|null;targetLabel:string|null;createdAt:string;
  requests:number;searchQueries:number;promptTokens:number;outputTokens:number;cost:number;
  parts:RunSpendPart[];
};

export type UsageSummary={
  currency:string;days:number;
  kinds:KindSpend[];
  month:{month:string;searchQueries:number;freeRemaining:number;cost:number;billableSearches:number;
    resetsAt:string;timeZone:string};
  empty:boolean;
};

export const AI_USAGE_RUN_HISTORY_KINDS=['producer_research','wine_research','vintage_window'] as const;
export type AiUsageRunHistoryKind=typeof AI_USAGE_RUN_HISTORY_KINDS[number];
export const isAiUsageRunHistoryKind=(value:string):value is AiUsageRunHistoryKind=>(AI_USAGE_RUN_HISTORY_KINDS as readonly string[]).includes(value);
export type UsageRunHistory={currency:string;days:number;kind:AiUsageRunHistoryKind;runs:AiUsageRunSpend[]};

type EventRow={kind:string;model:string;tier:string;day:string;requests:number;search_queries:number;prompt_tokens:number;output_tokens:number;units:number};
type RunPartRow={kind:string;run_id:string;target_id:string|null;target_label:string|null;model:string;tier:string;created_at:string;day:string;requests:number;search_queries:number;prompt_tokens:number;output_tokens:number};
type RunRow={kind:string;runs:number};
type MonthRow={kind:string;model:string;tier:string;search_queries:number;prompt_tokens:number;output_tokens:number};

const RUN_HISTORY_LIMIT=100;
const clampWindow=(days:number)=>Math.max(1,Math.min(RAW_EVENT_RETENTION_DAYS,Math.floor(days)||30));
const titleCase=(value:string)=>value.replace(/[_-]+/g,' ').replace(/\b[a-z]/g,letter=>letter.toUpperCase());
function vintageTargetLabel(targetId:string|null){
  if(!targetId)return null;
  try{
    const parsed=JSON.parse(targetId) as unknown;
    if(!Array.isArray(parsed)||parsed.length<2)return null;
    const anchor=String(parsed[0]??''),parts=anchor.split('|').filter(Boolean);
    const place=parts.at(-1)??anchor,vintage=String(parsed[1]??'').trim(),style=String(parsed[2]??'').trim();
    if(!place&&!vintage&&!style)return null;
    return [place?titleCase(place):null,vintage||null,style?titleCase(style):null].filter(Boolean).join(' · ');
  }catch{return null}
}

/** Aggregate spend for the Insights card. */
export async function usageSummary(db:D1Database,owner:string,rates:AiRates,days=30):Promise<UsageSummary>{
  const window=clampWindow(days),month=billingMonth();
  const [events,runs,monthTotals]=await Promise.all([
    db.prepare(`SELECT kind,model,tier,date(created_at) AS day,sum(requests) AS requests,sum(search_queries) AS search_queries,
        sum(prompt_tokens) AS prompt_tokens,sum(output_tokens) AS output_tokens,sum(units) AS units
      FROM ai_usage_events WHERE owner_id=? AND created_at>datetime('now','-${window} days') GROUP BY kind,model,tier,day`).bind(owner).all<EventRow>(),
    db.prepare(`SELECT kind,count(DISTINCT run_id) AS runs FROM ai_usage_events
      WHERE owner_id=? AND created_at>datetime('now','-${window} days') GROUP BY kind`).bind(owner).all<RunRow>(),
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
    entry.cost+=toLocal(marginalCostUsd(totals,rates,row.model,{on:row.day,tier:row.tier}),rates);
    byKind.set(kind,entry);
  }
  const kinds=[...byKind.values()].map(entry=>{
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

/** Individual run history is intentionally lazy and bounded. */
export async function usageRunHistory(db:D1Database,owner:string,rates:AiRates,kind:AiUsageRunHistoryKind,days=30):Promise<UsageRunHistory>{
  const window=clampWindow(days);
  const rows=await db.prepare(`WITH recent_runs AS (
      SELECT run_id,max(created_at) AS latest FROM ai_usage_events
      WHERE owner_id=? AND kind=? AND created_at>datetime('now','-${window} days')
      GROUP BY run_id ORDER BY latest DESC LIMIT ?
    )
    SELECT e.kind,e.run_id,e.target_id,e.model,e.tier,date(e.created_at) AS day,max(e.created_at) AS created_at,
      sum(e.requests) AS requests,sum(e.search_queries) AS search_queries,sum(e.prompt_tokens) AS prompt_tokens,sum(e.output_tokens) AS output_tokens,
      CASE
        WHEN e.kind='producer_research' THEN (SELECT p.canonical_name FROM producers p WHERE p.owner_id=e.owner_id AND p.id=e.target_id LIMIT 1)
        WHEN e.kind='wine_research' THEN (SELECT trim(w.producer || ' · ' || CASE WHEN w.vintage IS NOT NULL THEN cast(w.vintage AS TEXT) || ' · ' ELSE '' END || w.wine_name) FROM wines w WHERE w.owner_id=e.owner_id AND w.id=e.target_id LIMIT 1)
        ELSE NULL
      END AS target_label
    FROM ai_usage_events e JOIN recent_runs r ON r.run_id=e.run_id
    WHERE e.owner_id=? AND e.kind=? AND e.created_at>datetime('now','-${window} days')
    GROUP BY e.owner_id,e.kind,e.run_id,e.target_id,e.model,e.tier,date(e.created_at)
    ORDER BY r.latest DESC,created_at ASC`).bind(owner,kind,RUN_HISTORY_LIMIT,owner,kind).all<RunPartRow>();

  const runMap=new Map<string,AiUsageRunSpend>();
  for(const row of rows.results??[]){
    const runId=String(row.run_id||'');if(!runId)continue;
    const totals:UsageTotals={searchQueries:Number(row.search_queries)||0,promptTokens:Number(row.prompt_tokens)||0,outputTokens:Number(row.output_tokens)||0};
    const createdAt=String(row.created_at||''),cost=toLocal(marginalCostUsd(totals,rates,row.model,{on:row.day,tier:row.tier}),rates);
    const part:RunSpendPart={model:row.model,tier:row.tier,createdAt,requests:Number(row.requests)||0,
      searchQueries:totals.searchQueries,promptTokens:totals.promptTokens,outputTokens:totals.outputTokens,cost};
    const targetLabel=row.target_label??(kind==='vintage_window'?vintageTargetLabel(row.target_id):null),existing=runMap.get(runId);
    if(existing){
      existing.requests+=part.requests;existing.searchQueries+=part.searchQueries;existing.promptTokens+=part.promptTokens;
      existing.outputTokens+=part.outputTokens;existing.cost+=part.cost;existing.parts.push(part);
      if(createdAt>existing.createdAt)existing.createdAt=createdAt;
      if(!existing.targetLabel&&targetLabel)existing.targetLabel=targetLabel;
      if(!existing.targetId&&row.target_id)existing.targetId=row.target_id;
    }else runMap.set(runId,{kind,runId,targetId:row.target_id??null,targetLabel,createdAt,
      requests:part.requests,searchQueries:part.searchQueries,promptTokens:part.promptTokens,outputTokens:part.outputTokens,cost,parts:[part]});
  }
  const runs=[...runMap.values()].map(run=>({...run,parts:run.parts.sort((a,b)=>a.createdAt.localeCompare(b.createdAt))}))
    .sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  return {currency:rates.currency,days:window,kind,runs};
}
