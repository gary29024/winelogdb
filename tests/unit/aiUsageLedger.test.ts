import { afterEach,describe,expect,it,vi } from 'vitest';
import { createD1Stub } from './support/d1Stub';
import { geminiCallTokens,recordAiUsage,usageSummary,AI_USAGE_KINDS,kindLabels } from '../../src/lib/usage/aiUsage';
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

  it('prices a call at the rate in force on the day it ran, not today\'s',()=>{
    // The reason rates are dated at all. Google published Gemini 3.7 Flash at
    // an introductory price with an end date; when that date passes, last
    // month's runs must still show what last month cost. A panel that quietly
    // restates the past is worse than no panel.
    const rates=readAiRates({AI_COST_MODEL_RATES:JSON.stringify({
      'gemini-3.7-flash':[{from:'2026-01-01',input:0.75,output:3.75},{from:'2027-01-01',input:1.5,output:7.5}]
    })});
    const million={searchQueries:0,promptTokens:1e6,outputTokens:1e6};
    expect(tokenCostUsd(million,rates,'gemini-3.7-flash',{on:'2026-08-30'})).toBeCloseTo(4.5,6);
    expect(tokenCostUsd(million,rates,'gemini-3.7-flash',{on:'2026-12-31'})).toBeCloseTo(4.5,6);
    // the morning the introductory period ends, with no edit to the config
    expect(tokenCostUsd(million,rates,'gemini-3.7-flash',{on:'2027-01-01'})).toBeCloseTo(9,6);
  });

  it('prices a date older than every window at the oldest one, not the generic default',()=>{
    // A rate first recorded in June is still the best evidence of what May
    // cost. Falling through to the unlisted-model default would make a model
    // we have priced look unpriced for its own history.
    const rates=readAiRates({AI_COST_MODEL_RATES:JSON.stringify({'m':[{from:'2026-06-01',input:1,output:1}]})});
    expect(tokenCostUsd({searchQueries:0,promptTokens:1e6,outputTokens:0},rates,'m',{on:'2026-05-01'})).toBeCloseTo(1,6);
  });

  it('bills the flex tier at half, which is why batch scans queue there',()=>{
    // Recorded as: "why is the batch scan more expensive per wine than a single
    // scan?" - it was not. Every batch call goes out on Vertex's flex tier at
    // about half of standard, and the ledger priced it by the model alone, so
    // it showed roughly double what Google charged.
    const rates=readAiRates({
      AI_COST_MODEL_RATES:JSON.stringify({'gemini-3.1-flash-lite':[{from:'2026-01-01',input:0.25,output:1.5}]}),
      AI_COST_TIER_MULTIPLIERS:JSON.stringify({flex:0.5})
    });
    const call={searchQueries:0,promptTokens:1e6,outputTokens:1e6},on='2026-08-30';
    expect(tokenCostUsd(call,rates,'gemini-3.1-flash-lite',{on})).toBeCloseTo(1.75,6);
    expect(tokenCostUsd(call,rates,'gemini-3.1-flash-lite',{on,tier:'flex'})).toBeCloseTo(0.875,6);
    // an unknown tier is standard rather than free
    expect(tokenCostUsd(call,rates,'gemini-3.1-flash-lite',{on,tier:'made-up'})).toBeCloseTo(1.75,6);
  });

  it('dates the grounding rate too, since that is where the money goes',()=>{
    const rates=readAiRates({AI_COST_GROUNDING_RATES:JSON.stringify([
      {from:'2026-01-01',usdPer1k:14},{from:'2026-10-01',usdPer1k:20}
    ])});
    const run={searchQueries:1000,promptTokens:0,outputTokens:0};
    expect(marginalCostUsd(run,rates,undefined,{on:'2026-09-30'})).toBeCloseTo(14,6);
    expect(marginalCostUsd(run,rates,undefined,{on:'2026-10-01'})).toBeCloseTo(20,6);
  });

  it('still reads the flat per-model shape the first release wrote',()=>{
    // Config already deployed must not start pricing at the default because a
    // new shape exists.
    const rates=readAiRates({AI_COST_MODEL_RATES:JSON.stringify({'m':{input:0.1,output:0.4}})});
    expect(tokenCostUsd({searchQueries:0,promptTokens:1e6,outputTokens:1e6},rates,'m',{on:'2019-01-01'})).toBeCloseTo(0.5,6);
  });

  it('keeps a nonsense tier or window from pricing everything at zero',()=>{
    const rates=readAiRates({
      AI_COST_MODEL_RATES:JSON.stringify({'m':[{from:'nonsense',input:'free',output:2}]}),
      AI_COST_TIER_MULTIPLIERS:'{"flex":0}',
      AI_COST_GROUNDING_RATES:'not json'
    });
    // an unreadable amount falls back to the generic default, not to nothing
    expect(tokenCostUsd({searchQueries:0,promptTokens:1e6,outputTokens:0},rates,'m')).toBeCloseTo(DEFAULT_RATES.inputUsdPerM,6);
    expect(rates.tierMultipliers.flex,'a zero multiplier would make the tier free').toBe(1);
    expect(rates.groundingWindows).toEqual([]);
    expect(marginalCostUsd({searchQueries:1000,promptTokens:0,outputTokens:0},rates)).toBeCloseTo(DEFAULT_RATES.groundingUsdPer1k,6);
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
      events.push({owner_id:args[1],kind:args[2],run_id:args[3],target_id:args[4],model:args[5],tier:args[6],
        requests:Number(args[7]),search_queries:Number(args[8]),prompt_tokens:Number(args[9]),output_tokens:Number(args[10]),
        units:Number(args[11]),day:String(args[12]).slice(0,10)});
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
    if(/^SELECT kind,model,tier,date\(created_at\) AS day,sum\(requests\)/.test(sql)){
      const grouped=new Map<string,Row>();
      for(const row of events){
        const key=`${row.kind}|${row.model}|${row.tier}|${row.day}`;
        const entry=grouped.get(key)??{kind:row.kind,model:row.model,tier:row.tier,day:row.day,requests:0,search_queries:0,prompt_tokens:0,output_tokens:0,units:0};
        for(const field of ['requests','search_queries','prompt_tokens','output_tokens','units'])entry[field]=Number(entry[field])+Number(row[field]);
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
    await recordAiUsage(env,'owner',{kind:'scan_group',runId:'g-1',model:'gemini-3.6-flash',requests:1,units:9,promptTokens:9000,outputTokens:800});
    expect(analytics).toHaveLength(1);
    expect(analytics[0]).toMatchObject({indexes:['scan_group'],doubles:[1,0,9000,800,9]});
    expect(analytics[0].blobs).toContain('gemini-3.6-flash');
    expect(analytics[0].blobs,'the tier, so the time series can be priced too').toContain('standard');
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
  // A meter is only worth having if it covers everything. These are the six
  // places WineLog calls Gemini; a new one added without a ledger write would
  // be invisible in both the panel and the Cloudflare time series.
  //
  // Group Photo and Tasting Sheet declare their kind in a mode spec and hand it
  // to visionRecognition, which owns the retry, the escalation and the ledger
  // write for both. So the check is "this file declares its kind, and the write
  // happens either here or in the module it delegates to" - which is still the
  // thing that matters, and still fails if a mode is added that meters nothing.
  const sources:Array<[string,string]>=[
    ['src/lib/producers/batchResearch.ts',"kind:'producer_research'"],
    ['src/lib/research/batchWineResearch.ts',"kind:'wine_research'"],
    ['worker/recognitionHandler.ts',"kind:'scan_single'"],
    ['worker/vertexBatchRecognition.ts',"kind:'scan_batch'"],
    ['worker/groupRecognitionHandler.ts',"kind:'scan_group'"],
    ['worker/sheetRecognitionHandler.ts',"kind:'scan_sheet'"],
    ['worker/vintageWindowHandler.ts',"kind:'vintage_window'"]
  ];
  it.each(sources)('%s records usage',async(path,kind)=>{
    const { readFileSync }=await import('node:fs');
    const source=readFileSync(path,'utf8');
    const delegated=/from '\.\/visionRecognition'/.test(source);
    expect(source).toContain(kind);
    expect(delegated?readFileSync('worker/visionRecognition.ts','utf8'):source).toContain('recordAiUsage');
  });

  it('covers every kind the ledger knows about',()=>{
    expect(new Set(sources.map(([,kind])=>kind.replace(/kind:'|'/g,'')))).toEqual(new Set(AI_USAGE_KINDS));
  });

  it('bills thinking tokens as output, which is how Google prices them',()=>{
    // Google's pricing table labels the row "Output price (including thinking
    // tokens)" but reports them apart from the answer, in thoughtsTokenCount.
    // Counting only candidatesTokenCount undercounts the expensive half of the
    // bill - output bills at six times input on the recognition model.
    expect(geminiCallTokens({promptTokenCount:1800,candidatesTokenCount:350,thoughtsTokenCount:900}))
      .toEqual({promptTokens:1800,outputTokens:1250});
    // a reply that did not think is unchanged
    expect(geminiCallTokens({promptTokenCount:1800,candidatesTokenCount:350})).toEqual({promptTokens:1800,outputTokens:350});
    expect(geminiCallTokens(undefined)).toEqual({promptTokens:0,outputTokens:0});
  });

  it('leaves no metering path reading the answer tokens without the thinking ones',async()=>{
    // The undercount is invisible in every other way: the call succeeds, the
    // wine is right, and only the spend panel is quietly low. So the pairing is
    // asserted rather than trusted to survive the next edit.
    const { readFileSync }=await import('node:fs');
    for(const path of ['worker/recognitionHandler.ts','worker/visionRecognition.ts','worker/vertexBatchRecognition.ts','src/lib/research/geminiBatch.ts']){
      const source=readFileSync(path,'utf8');
      for(const line of source.split('\n')){
        if(!line.includes('candidatesTokenCount'))continue;
        // the diagnostic logs report the two apart on purpose; metering adds them
        const metering=!line.includes('console.');
        if(metering)expect(line,`${path}: ${line.trim()}`).toContain('thoughtsTokenCount');
      }
      expect(source,path).toContain('thoughtsTokenCount');
    }
  });

  it('records the flex tier on the one path that bills at it',async()=>{
    // The batch worker sends serviceTier:'flex' and is the only caller that
    // does. If the tier stops reaching the ledger the cost silently doubles,
    // which is exactly the bug this pairing exists to prevent - so the two are
    // asserted together rather than trusted to stay in step.
    const { readFileSync }=await import('node:fs');
    const source=readFileSync('worker/vertexBatchRecognition.ts','utf8');
    expect(source).toContain("serviceTier:'flex'");
    expect(source).toContain("tier:'flex'");
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

describe('what a cost is quoted per',()=>{
  // Reported as: "is the batch scan cost per run or per wine?" - and it was per
  // session, so a run of twelve bottles and a run of one read the same. The
  // context differs enough between the three recognition modes that only a
  // per-wine figure compares.
  it('quotes recognition per wine and research per run',async()=>{
    const {env}=ledger();
    // one batch session, three wines
    for(const item of ['i-1','i-2','i-3'])
      await recordAiUsage(env,'owner',{kind:'scan_batch',runId:'session-1',targetId:item,model:'gemini-3.6-flash',requests:1,units:1,promptTokens:1000,outputTokens:250});
    // one producer run, two grounded requests
    for(const searches of [5,9])
      await recordAiUsage(env,'owner',{kind:'producer_research',runId:'r-1',model:'gemini-3.7-flash',requests:1,searchQueries:searches,promptTokens:700,outputTokens:1800});

    const summary=await usageSummary(env.DB,'owner',DEFAULT_RATES);
    const batch=summary.kinds.find(kind=>kind.kind==='scan_batch')!;
    expect(batch.unit).toBe('wine');
    expect(batch.unitCount).toBe(3);
    expect(batch.runs,'one session').toBe(1);
    expect(batch.costPerUnit).toBeCloseTo(batch.cost/3,9);

    const producer=summary.kinds.find(kind=>kind.kind==='producer_research')!;
    expect(producer.unit).toBe('run');
    expect(producer.unitCount).toBe(1);
    expect(producer.costPerUnit).toBeCloseTo(producer.cost,9);
  });

  it('counts a wine once when its recognition escalated',async()=>{
    const {env}=ledger();
    await recordAiUsage(env,'owner',{kind:'scan_single',runId:'scan-1',model:'gemini-3.6-flash',requests:1,units:1,promptTokens:1200,outputTokens:300});
    await recordAiUsage(env,'owner',{kind:'scan_single',runId:'scan-1',model:'gemini-3.7-flash',requests:1,units:0,promptTokens:1200,outputTokens:300});
    const scan=(await usageSummary(env.DB,'owner',DEFAULT_RATES)).kinds.find(kind=>kind.kind==='scan_single')!;
    expect(scan.unitCount).toBe(1);
    expect(scan.requests).toBe(2);
    expect(scan.costPerUnit).toBe(scan.cost);
  });

  it('counts every wine a group photo produced, from one request',async()=>{
    const {env}=ledger();
    await recordAiUsage(env,'owner',{kind:'scan_group',runId:'g-1',model:'gemini-3.6-flash',requests:1,units:9,promptTokens:9000,outputTokens:1500});
    const group=(await usageSummary(env.DB,'owner',DEFAULT_RATES)).kinds.find(kind=>kind.kind==='scan_group')!;
    expect(group.unitCount).toBe(9);
    expect(group.runs).toBe(1);
    expect(group.costPerUnit).toBeCloseTo(group.cost/9,9);
  });

  it('files a multi-page wine list under its own kind, priced per wine',async()=>{
    // A sheet is several calls - one per photographed page - covering one
    // evening's wines. The panel should show one Tasting sheet line whose unit
    // is the wine, not seven runs of something unnamed, since a 200-wine list
    // and a 12-wine one are not the same purchase.
    const {env}=ledger();
    await recordAiUsage(env,'owner',{kind:'scan_sheet',runId:'page-1',model:'gemini-3.1-flash-lite',requests:1,units:80,promptTokens:20000,outputTokens:12000});
    await recordAiUsage(env,'owner',{kind:'scan_sheet',runId:'page-2',model:'gemini-3.1-flash-lite',requests:1,units:64,promptTokens:18000,outputTokens:9000});
    const sheet=(await usageSummary(env.DB,'owner',DEFAULT_RATES)).kinds.find(kind=>kind.kind==='scan_sheet')!;
    expect(sheet.label).toBe('Tasting sheet');
    expect(sheet.unit).toBe('wine');
    expect(sheet.unitCount).toBe(144);
    expect(sheet.runs).toBe(2);
    expect(sheet.costPerUnit).toBeCloseTo(sheet.cost/144,9);
  });

  it('falls back to the run figure for recognition recorded before wines were counted',async()=>{
    // Events written by the first release carry no unit count; dividing by
    // nothing would be worse than quoting the run.
    const {env}=ledger();
    await recordAiUsage(env,'owner',{kind:'scan_batch',runId:'old-session',model:'m',requests:1,promptTokens:900,outputTokens:200});
    const batch=(await usageSummary(env.DB,'owner',DEFAULT_RATES)).kinds.find(kind=>kind.kind==='scan_batch')!;
    expect(batch.unit).toBe('run');
    expect(batch.unitCount).toBe(1);
    expect(batch.costPerUnit).toBe(batch.cost);
  });
});

describe('what a price change does to the history',()=>{
  afterEach(()=>{vi.useRealTimers()});
  const at=(iso:string)=>{vi.setSystemTime(new Date(iso))};

  it('leaves last month at last month\'s price when a new one takes effect',async()=>{
    // The whole point of appending a window instead of overwriting a rate.
    vi.useFakeTimers();
    const {env}=ledger();
    const rates=readAiRates({AI_COST_FX_PER_USD:'1',AI_COST_MODEL_RATES:JSON.stringify({
      'gemini-3.7-flash':[{from:'2026-01-01',input:1,output:1},{from:'2026-08-20',input:2,output:2}]
    })});
    at('2026-08-19T04:00:00Z');
    await recordAiUsage(env,'owner',{kind:'wine_research',runId:'before',model:'gemini-3.7-flash',requests:1,promptTokens:1e6,outputTokens:0});
    at('2026-08-21T04:00:00Z');
    await recordAiUsage(env,'owner',{kind:'wine_research',runId:'after',model:'gemini-3.7-flash',requests:1,promptTokens:1e6,outputTokens:0});
    at('2026-08-30T04:00:00Z');
    const research=(await usageSummary(env.DB,'owner',rates)).kinds.find(kind=>kind.kind==='wine_research')!;
    // 1 dollar for the older run and 2 for the newer, not 4 for both
    expect(research.cost).toBeCloseTo(3,6);
  });

  it('halves a batch scan because it was billed on flex',async()=>{
    vi.useFakeTimers();at('2026-08-30T04:00:00Z');
    const {env}=ledger();
    const rates=readAiRates({AI_COST_FX_PER_USD:'1',
      AI_COST_MODEL_RATES:JSON.stringify({'gemini-3.1-flash-lite':[{from:'2026-01-01',input:1,output:1}]}),
      AI_COST_TIER_MULTIPLIERS:JSON.stringify({flex:0.5})});
    const call={model:'gemini-3.1-flash-lite',requests:1,units:1,promptTokens:1e6,outputTokens:0} as const;
    await recordAiUsage(env,'owner',{kind:'scan_single',runId:'s-1',...call});
    await recordAiUsage(env,'owner',{kind:'scan_batch',runId:'b-1',targetId:'i-1',tier:'flex',...call});
    const summary=await usageSummary(env.DB,'owner',rates);
    const single=summary.kinds.find(kind=>kind.kind==='scan_single')!;
    const batch=summary.kinds.find(kind=>kind.kind==='scan_batch')!;
    expect(single.costPerUnit).toBeCloseTo(1,6);
    expect(batch.costPerUnit,'the same call queued on flex').toBeCloseTo(0.5,6);
  });
});
