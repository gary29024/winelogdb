import { describe,expect,it } from 'vitest';
import { createD1Stub } from './support/d1Stub';
import { recordAiUsage,usageSummary,AI_USAGE_KINDS,kindLabels } from '../../src/lib/usage/aiUsage';
import { DEFAULT_RATES,marginalCostUsd,monthCostUsd,readAiRates,tokenCostUsd,toLocal } from '../../src/lib/usage/rates';

describe('the rates',()=>{
  it('are read from configuration, with the defaults as the fallback',()=>{
    const rates=readAiRates({AI_COST_CURRENCY:'GBP',AI_COST_FX_PER_USD:'0.79',AI_COST_GROUNDING_USD_PER_1K:'10'});
    expect(rates).toMatchObject({currency:'GBP',fxPerUsd:0.79,groundingUsdPer1k:10});
    // untouched keys keep the defaults rather than becoming zero
    expect(rates.groundingFreePerMonth).toBe(DEFAULT_RATES.groundingFreePerMonth);
    expect(rates.outputUsdPerM).toBe(DEFAULT_RATES.outputUsdPerM);
  });

  it('ignores nonsense rather than pricing everything at zero',()=>{
    const rates=readAiRates({AI_COST_FX_PER_USD:'not a number',AI_COST_INPUT_USD_PER_M:'-3',AI_COST_MODEL_RATES:'{oops'});
    expect(rates.fxPerUsd).toBe(DEFAULT_RATES.fxPerUsd);
    expect(rates.inputUsdPerM).toBe(DEFAULT_RATES.inputUsdPerM);
    expect(rates.perModel).toEqual({});
  });

  it('prices a per-model override above the default',()=>{
    const rates=readAiRates({AI_COST_MODEL_RATES:JSON.stringify({'gemini-3.6-flash':{input:0.1,output:0.4}})});
    expect(tokenCostUsd({searchQueries:0,promptTokens:1e6,outputTokens:1e6},rates,'gemini-3.6-flash')).toBeCloseTo(0.5,6);
    expect(tokenCostUsd({searchQueries:0,promptTokens:1e6,outputTokens:1e6},rates,'gemini-3.7-flash')).toBeCloseTo(2.8,6);
  });

  it('reproduces the invoice that anchors the grounding rate',()=>{
    // 12,183 searches in a month billed HKD 788.73, which is the free 5,000
    // deducted and the rest at $14/1,000.
    const month=monthCostUsd({searchQueries:12183,promptTokens:0,outputTokens:0},DEFAULT_RATES);
    expect(toLocal(month,DEFAULT_RATES)).toBeCloseTo(788.7,0);
  });

  it('quotes the next run at the billed rate, not the free one',()=>{
    // The allowance is spent once a month and then gone, so "what does another
    // producer run cost" must not answer nothing.
    const run={searchQueries:14,promptTokens:1455,outputTokens:3700};
    expect(toLocal(marginalCostUsd(run,DEFAULT_RATES),DEFAULT_RATES)).toBeCloseTo(1.61,2);
    // Inside the allowance the same run bills its tokens and no grounding.
    expect(monthCostUsd(run,DEFAULT_RATES)).toBeCloseTo(tokenCostUsd(run,DEFAULT_RATES),9);
  });
});

type Row=Record<string,unknown>;
/** Keeps the two ledger tables, so a summary reads what the writes actually left. */
function ledger(){
  const events:Row[]=[],monthly:Row[]=[];const analytics:Row[]=[];
  const stub=createD1Stub((raw,args)=>{
    const sql=raw.replace(/\s+/g,' ').trim();
    if(/^INSERT INTO ai_usage_events/.test(sql)){
      events.push({owner_id:args[1],kind:args[2],run_id:args[3],target_id:args[4],model:args[5],
        requests:Number(args[6]),search_queries:Number(args[7]),prompt_tokens:Number(args[8]),output_tokens:Number(args[9])});
      return undefined;
    }
    if(/^INSERT INTO ai_usage_monthly/.test(sql)){
      const [owner,month,kind,requests,searches,input,output]=args as [string,string,string,number,number,number,number];
      const row=monthly.find(item=>item.owner_id===owner&&item.month===month&&item.kind===kind);
      if(row){row.requests=Number(row.requests)+requests;row.search_queries=Number(row.search_queries)+searches;
        row.prompt_tokens=Number(row.prompt_tokens)+input;row.output_tokens=Number(row.output_tokens)+output}
      else monthly.push({owner_id:owner,month,kind,requests,search_queries:searches,prompt_tokens:input,output_tokens:output});
      return undefined;
    }
    if(/^SELECT kind,model,sum\(requests\)/.test(sql)){
      const grouped=new Map<string,Row>();
      for(const row of events){
        const key=`${row.kind}|${row.model}`,entry=grouped.get(key)??{kind:row.kind,model:row.model,requests:0,search_queries:0,prompt_tokens:0,output_tokens:0};
        for(const field of ['requests','search_queries','prompt_tokens','output_tokens'])entry[field]=Number(entry[field])+Number(row[field]);
        grouped.set(key,entry);
      }
      return {all:[...grouped.values()]};
    }
    if(/^SELECT kind,count\(DISTINCT run_id\)/.test(sql)){
      const runs=new Map<string,Set<string>>();
      for(const row of events){
        const set=runs.get(String(row.kind))??new Set<string>();set.add(String(row.run_id));runs.set(String(row.kind),set);
      }
      return {all:[...runs.entries()].map(([kind,set])=>({kind,runs:set.size}))};
    }
    if(/FROM ai_usage_monthly WHERE owner_id=\? AND month=\?/.test(sql)){
      const rows=monthly.filter(row=>row.month===args[1]);
      return {first:{search_queries:rows.reduce((n,row)=>n+Number(row.search_queries),0),
        prompt_tokens:rows.reduce((n,row)=>n+Number(row.prompt_tokens),0),
        output_tokens:rows.reduce((n,row)=>n+Number(row.output_tokens),0)}};
    }
    return undefined;
  });
  const env={DB:stub.db,AI_USAGE:{writeDataPoint:(point:Row)=>{analytics.push(point)}}};
  return {env,events,monthly,analytics,stub};
}

describe('the usage ledger',()=>{
  it('turns the calls of one run into a cost per run',async()=>{
    const {env}=ledger();
    // two producer runs, two grounded requests each
    for(const run of ['r-1','r-2'])for(const searches of [5,9])
      await recordAiUsage(env,'owner',{kind:'producer_research',runId:run,model:'gemini-3.7-flash',requests:1,searchQueries:searches,promptTokens:700,outputTokens:1800});
    const summary=await usageSummary(env.DB,'owner',DEFAULT_RATES);
    const producer=summary.kinds.find(kind=>kind.kind==='producer_research')!;
    expect(producer.runs).toBe(2);
    expect(producer.requests).toBe(4);
    expect(producer.searchesPerRun).toBe(14);
    // 14 searches + 1,400 in + 3,600 out, at the configured rates
    expect(producer.costPerRun).toBeCloseTo(1.61,2);
    expect(producer.cost).toBeCloseTo(producer.costPerRun*2,6);
  });

  it('counts a run once even when it escalated to a second model',async()=>{
    const {env}=ledger();
    await recordAiUsage(env,'owner',{kind:'scan_single',runId:'scan-1',model:'gemini-3.6-flash',requests:1,promptTokens:1200,outputTokens:300});
    await recordAiUsage(env,'owner',{kind:'scan_single',runId:'scan-1',model:'gemini-3.7-flash',requests:1,promptTokens:1200,outputTokens:300});
    const summary=await usageSummary(env.DB,'owner',DEFAULT_RATES);
    const scan=summary.kinds.find(kind=>kind.kind==='scan_single')!;
    expect(scan.runs).toBe(1);
    expect(scan.requests).toBe(2);
    expect(scan.costPerRun).toBe(scan.cost);
  });

  it('tracks the monthly free allowance, which is what makes the bill a step',async()=>{
    const {env}=ledger();
    await recordAiUsage(env,'owner',{kind:'wine_research',runId:'w-1',model:'gemini-3.7-flash',requests:1,searchQueries:4200,promptTokens:0,outputTokens:0});
    let summary=await usageSummary(env.DB,'owner',DEFAULT_RATES);
    expect(summary.month.freeRemaining).toBe(800);
    expect(summary.month.billableSearches).toBe(0);
    expect(summary.month.cost).toBe(0);

    await recordAiUsage(env,'owner',{kind:'wine_research',runId:'w-2',model:'gemini-3.7-flash',requests:1,searchQueries:1000,promptTokens:0,outputTokens:0});
    summary=await usageSummary(env.DB,'owner',DEFAULT_RATES);
    expect(summary.month.freeRemaining).toBe(0);
    expect(summary.month.billableSearches).toBe(200);
    expect(summary.month.cost).toBeCloseTo(200*0.014*DEFAULT_RATES.fxPerUsd,4);
  });

  it('writes the same numbers to Analytics Engine',async()=>{
    const {env,analytics}=ledger();
    await recordAiUsage(env,'owner',{kind:'scan_group',runId:'g-1',model:'gemini-3.6-flash',requests:1,promptTokens:9000,outputTokens:800});
    expect(analytics).toHaveLength(1);
    expect(analytics[0]).toMatchObject({indexes:['scan_group'],doubles:[1,0,9000,800]});
    expect(analytics[0].blobs).toContain('gemini-3.6-flash');
  });

  it('never lets a metering failure break the call it is measuring',async()=>{
    const stub=createD1Stub(()=>{throw new Error('D1 is having a day')});
    const analytics:Row[]=[];
    await expect(recordAiUsage({DB:stub.db,AI_USAGE:{writeDataPoint:()=>{throw new Error('and so is analytics')}}},'owner',
      {kind:'scan_batch',runId:'s-1',model:'m',requests:1,promptTokens:10,outputTokens:10})).resolves.toBeUndefined();
    expect(analytics).toEqual([]);
  });

  it('writes nothing at all for a call that billed nothing',async()=>{
    const {env,stub}=ledger();
    await recordAiUsage(env,'owner',{kind:'scan_single',runId:'s-0',model:'m',requests:0});
    expect(stub.writes()).toEqual([]);
  });

  it('says so plainly before anything has been metered',async()=>{
    const {env}=ledger();
    const summary=await usageSummary(env.DB,'owner',DEFAULT_RATES);
    expect(summary.empty).toBe(true);
    expect(summary.kinds).toEqual([]);
  });

  it('labels every kind it can record',()=>{
    for(const kind of AI_USAGE_KINDS)expect(kindLabels[kind]).toBeTruthy();
  });
});

describe('every path that spends money is metered',()=>{
  // A meter is only worth having if it covers everything. These are the five
  // places WineLog calls Gemini; a new one added without a ledger write would
  // be invisible in both the panel and the Cloudflare time series.
  const sources:Array<[string,string]>=[
    ['src/lib/producers/batchResearch.ts',"kind:'producer_research'"],
    ['src/lib/research/batchWineResearch.ts',"kind:'wine_research'"],
    ['worker/recognitionHandler.ts',"kind:'scan_single'"],
    ['worker/vertexBatchRecognition.ts',"kind:'scan_batch'"],
    ['worker/groupRecognitionHandler.ts',"kind:'scan_group'"]
  ];
  it.each(sources)('%s records usage',async(path,kind)=>{
    const { readFileSync }=await import('node:fs');
    const source=readFileSync(path,'utf8');
    expect(source).toContain('recordAiUsage');
    expect(source).toContain(kind);
  });

  it('covers every kind the ledger knows about',()=>{
    expect(new Set(sources.map(([,kind])=>kind.replace(/kind:'|'/g,'')))).toEqual(new Set(AI_USAGE_KINDS));
  });
});

describe('the billing month',()=>{
  // Google resets the free searches at midnight Pacific on the 1st. From Hong
  // Kong that is mid-afternoon on the 1st, so a UTC month key would file the
  // hours in between under the wrong month - at exactly the boundary where the
  // allowance matters.
  it('follows Pacific midnight, not UTC midnight',async()=>{
    const { billingMonth }=await import('../../src/lib/usage/billingPeriod');
    // 22:00 on 31 August in Los Angeles, already 1 September in UTC
    expect(billingMonth(new Date('2026-09-01T05:00:00Z'))).toBe('2026-08');
    // 01:00 on 1 September in Los Angeles: the allowance has reset
    expect(billingMonth(new Date('2026-09-01T08:00:00Z'))).toBe('2026-09');
  });

  it('holds across both daylight-saving changes',async()=>{
    const { billingMonth }=await import('../../src/lib/usage/billingPeriod');
    // PST (UTC-8): 1 January resets at 08:00 UTC
    expect(billingMonth(new Date('2026-01-01T07:59:00Z'))).toBe('2025-12');
    expect(billingMonth(new Date('2026-01-01T08:00:00Z'))).toBe('2026-01');
    // PDT (UTC-7): 1 July resets at 07:00 UTC
    expect(billingMonth(new Date('2026-07-01T06:59:00Z'))).toBe('2026-06');
    expect(billingMonth(new Date('2026-07-01T07:00:00Z'))).toBe('2026-07');
  });

  it('says when the allowance next resets, as a real instant',async()=>{
    const { nextBillingReset }=await import('../../src/lib/usage/billingPeriod');
    expect(nextBillingReset(new Date('2026-08-27T02:00:00Z')).toISOString()).toBe('2026-09-01T07:00:00.000Z');
    // and across the year boundary, in standard time
    expect(nextBillingReset(new Date('2026-12-20T00:00:00Z')).toISOString()).toBe('2027-01-01T08:00:00.000Z');
  });
});
