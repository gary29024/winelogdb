/**
 * What a Gemini call costs, as configuration rather than code.
 *
 * Every rate here is a number a provider can change without telling us, so all
 * of them are `vars` in wrangler.jsonc: correcting a price is a config edit,
 * not a deploy of new logic. The defaults are the fallback for a model nobody
 * has priced yet, and the grounding pair is the one that matters - it is where
 * the money goes.
 *
 * Prices are *dated*. A rate is not one number but a list of windows, each
 * with the date it took effect, and every usage event is priced by the window
 * in force on the day it happened. That distinction is the difference between
 * two things this file has to do at once:
 *
 *   - **correcting** a rate we had wrong should reprice history, because the
 *     old figure was never true;
 *   - **recording** a rate that changed on a date must not, because a run last
 *     July really did cost July's price, and a spend panel that quietly
 *     restates it is lying about the past.
 *
 * So a price rise is appended as a new window rather than replacing the old
 * one, and it can be appended *before* it takes effect - Google publishes
 * introductory pricing with an end date, and a window dated to that day means
 * the panel starts charging the new rate on the morning it applies with no
 * edit needed.
 *
 * Prices also vary by service *tier*. The same model on Vertex's flex tier
 * bills about half of standard, which is the whole reason batch recognition
 * queues its calls there - so the tier is recorded on the event and applied as
 * a multiplier here, or the ledger overstates every batch scan.
 */

/** One model's price from `from` onwards, in USD per million tokens. */
export type RateWindow={from:string;input:number;output:number};
/** Grounding's price from `from` onwards, in USD per 1,000 search queries. */
export type GroundingWindow={from:string;usdPer1k:number};

export type AiRates={
  currency:string;
  /** Units of `currency` per US dollar. */
  fxPerUsd:number;
  /** USD per 1,000 Google Search queries the model runs while grounding. */
  groundingUsdPer1k:number;
  /** Dated grounding prices. When empty, `groundingUsdPer1k` applies throughout. */
  groundingWindows:GroundingWindow[];
  /** Search queries included each month before any are billed. */
  groundingFreePerMonth:number;
  /** USD per million tokens for a model with no listed price of its own. */
  inputUsdPerM:number;
  outputUsdPerM:number;
  /** Dated prices per model, oldest window first. */
  perModel:Record<string,RateWindow[]>;
  /** What a service tier bills relative to standard - flex is about half. */
  tierMultipliers:Record<string,number>;
};

export type AiRateEnv={
  AI_COST_CURRENCY?:string;AI_COST_FX_PER_USD?:string;AI_COST_GROUNDING_USD_PER_1K?:string;
  AI_COST_GROUNDING_FREE_PER_MONTH?:string;AI_COST_INPUT_USD_PER_M?:string;AI_COST_OUTPUT_USD_PER_M?:string;
  AI_COST_MODEL_RATES?:string;AI_COST_TIER_MULTIPLIERS?:string;AI_COST_GROUNDING_RATES?:string;
};

const num=(value:unknown,fallback:number)=>{const parsed=Number(value);return Number.isFinite(parsed)&&parsed>=0?parsed:fallback};
const positive=(value:unknown,fallback:number)=>{const parsed=Number(value);return Number.isFinite(parsed)&&parsed>0?parsed:fallback};
/**
 * The day a rate took effect. Anything unparseable becomes the beginning of
 * time rather than being dropped: a window with a typo in its date should
 * still price something, and pricing it as the oldest rate is the reading that
 * cannot silently lose money.
 */
const EPOCH='0000-01-01';
const day=(value:unknown)=>{const text=String(value??'').trim();return /^\d{4}-\d{2}-\d{2}/.test(text)?text.slice(0,10):EPOCH};
/** An event's own date, from its `created_at` stamp. */
export const rateDay=(value?:string|null)=>day(value??new Date().toISOString());

/**
 * The window in force on `on` - the latest one that had started by then.
 *
 * A date earlier than every window falls back to the oldest, because a window
 * we only started recording in March is still the best evidence of what
 * February cost. Falling through to the generic default instead would make a
 * priced model look unpriced for its own history.
 */
function windowOn<T extends {from:string}>(windows:T[],on:string):T|undefined{
  let found:T|undefined;
  for(const entry of windows){if(entry.from<=on)found=entry;else break}
  return found??windows[0];
}

function readWindows(raw:unknown,fallback:{input:number;output:number}):RateWindow[]{
  // Two shapes, because the first release wrote the flat one and its config
  // must keep working: {"input":n,"output":n} is a price that has always
  // applied, [{from,input,output},...] is a price with a history.
  const list=Array.isArray(raw)?raw:[raw];
  const windows=list
    .filter((entry):entry is Record<string,unknown>=>Boolean(entry)&&typeof entry==='object')
    .map(entry=>({from:day(entry.from),input:num(entry.input,fallback.input),output:num(entry.output,fallback.output)}));
  return windows.sort((a,b)=>a.from.localeCompare(b.from));
}

export const DEFAULT_RATES:AiRates={
  currency:'HKD',fxPerUsd:7.843,groundingUsdPer1k:14,groundingWindows:[],groundingFreePerMonth:5000,
  inputUsdPerM:0.3,outputUsdPerM:2.5,perModel:{},tierMultipliers:{}
};

export function readAiRates(env:AiRateEnv):AiRates{
  const inputUsdPerM=num(env.AI_COST_INPUT_USD_PER_M,DEFAULT_RATES.inputUsdPerM);
  const outputUsdPerM=num(env.AI_COST_OUTPUT_USD_PER_M,DEFAULT_RATES.outputUsdPerM);
  const groundingUsdPer1k=num(env.AI_COST_GROUNDING_USD_PER_1K,DEFAULT_RATES.groundingUsdPer1k);
  let perModel:AiRates['perModel']={};
  try{
    const parsed=JSON.parse(String(env.AI_COST_MODEL_RATES??'{}')) as Record<string,unknown>;
    for(const [model,rate] of Object.entries(parsed??{})){
      const windows=readWindows(rate,{input:inputUsdPerM,output:outputUsdPerM});
      if(windows.length)perModel[model]=windows;
    }
  }catch{perModel={}}
  let tierMultipliers:AiRates['tierMultipliers']={};
  try{
    const parsed=JSON.parse(String(env.AI_COST_TIER_MULTIPLIERS??'{}')) as Record<string,unknown>;
    for(const [tier,factor] of Object.entries(parsed??{}))tierMultipliers[tier]=positive(factor,1);
  }catch{tierMultipliers={}}
  let groundingWindows:GroundingWindow[]=[];
  try{
    const parsed=JSON.parse(String(env.AI_COST_GROUNDING_RATES??'[]')) as unknown;
    groundingWindows=(Array.isArray(parsed)?parsed:[])
      .filter((entry):entry is Record<string,unknown>=>Boolean(entry)&&typeof entry==='object')
      .map(entry=>({from:day(entry.from),usdPer1k:num(entry.usdPer1k,groundingUsdPer1k)}))
      .sort((a,b)=>a.from.localeCompare(b.from));
  }catch{groundingWindows=[]}
  return {
    currency:String(env.AI_COST_CURRENCY??DEFAULT_RATES.currency).trim()||DEFAULT_RATES.currency,
    fxPerUsd:num(env.AI_COST_FX_PER_USD,DEFAULT_RATES.fxPerUsd),
    groundingUsdPer1k,groundingWindows,
    groundingFreePerMonth:num(env.AI_COST_GROUNDING_FREE_PER_MONTH,DEFAULT_RATES.groundingFreePerMonth),
    inputUsdPerM,outputUsdPerM,perModel,tierMultipliers
  };
}

export type UsageTotals={searchQueries:number;promptTokens:number;outputTokens:number};
/** When a call happened and how it was billed, so it is priced as it was then. */
export type PriceContext={on?:string;tier?:string};

/** What one model's million tokens cost on a given day, at a given tier. */
export function modelRateOn(rates:AiRates,model:string|undefined,context:PriceContext={}){
  const on=rateDay(context.on),windows=model?rates.perModel[model]:undefined;
  const base=(windows&&windowOn(windows,on))??{input:rates.inputUsdPerM,output:rates.outputUsdPerM};
  const multiplier=context.tier?rates.tierMultipliers[context.tier]??1:1;
  return {input:base.input*multiplier,output:base.output*multiplier,multiplier};
}

/** What 1,000 grounded searches cost on a given day. Grounding is not tiered. */
export function groundingRateOn(rates:AiRates,on?:string){
  return windowOn(rates.groundingWindows,rateDay(on))?.usdPer1k??rates.groundingUsdPer1k;
}

export function tokenCostUsd(totals:UsageTotals,rates:AiRates,model?:string,context:PriceContext={}){
  const rate=modelRateOn(rates,model,context);
  return totals.promptTokens*rate.input/1e6+totals.outputTokens*rate.output/1e6;
}

/**
 * What one more run of this shape costs today.
 *
 * The free allowance is deliberately ignored: it is consumed once a month and
 * then gone, so the honest answer to "what does another producer run cost" is
 * the billed rate. The allowance is applied separately, to the month.
 */
export function marginalCostUsd(totals:UsageTotals,rates:AiRates,model?:string,context:PriceContext={}){
  return totals.searchQueries*groundingRateOn(rates,context.on)/1000+tokenCostUsd(totals,rates,model,context);
}

/** What a whole month costs, with the free search allowance applied once. */
export function monthCostUsd(totals:UsageTotals,rates:AiRates,on?:string){
  const billable=Math.max(0,totals.searchQueries-rates.groundingFreePerMonth);
  return billable*groundingRateOn(rates,on)/1000+tokenCostUsd(totals,rates,undefined,{on});
}

export const toLocal=(usd:number,rates:AiRates)=>usd*rates.fxPerUsd;
