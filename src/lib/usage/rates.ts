/**
 * What a Gemini call costs, as configuration rather than code.
 *
 * Every rate here is a number a provider can change without telling us, so all
 * of them are `vars` in wrangler.jsonc: correcting a price is a config edit,
 * not a deploy of new logic. The defaults are the rates that were in force when
 * this was written, and the grounding pair is the one that matters - it is
 * where the money goes.
 */
export type AiRates={
  currency:string;
  /** Units of `currency` per US dollar. */
  fxPerUsd:number;
  /** USD per 1,000 Google Search queries the model runs while grounding. */
  groundingUsdPer1k:number;
  /** Search queries included each month before any are billed. */
  groundingFreePerMonth:number;
  /** USD per million tokens, by model, with a fallback for anything unlisted. */
  inputUsdPerM:number;
  outputUsdPerM:number;
  perModel:Record<string,{input:number;output:number}>;
};

export type AiRateEnv={
  AI_COST_CURRENCY?:string;AI_COST_FX_PER_USD?:string;AI_COST_GROUNDING_USD_PER_1K?:string;
  AI_COST_GROUNDING_FREE_PER_MONTH?:string;AI_COST_INPUT_USD_PER_M?:string;AI_COST_OUTPUT_USD_PER_M?:string;
  AI_COST_MODEL_RATES?:string;
};

const num=(value:unknown,fallback:number)=>{const parsed=Number(value);return Number.isFinite(parsed)&&parsed>=0?parsed:fallback};

export const DEFAULT_RATES:AiRates={
  currency:'HKD',fxPerUsd:7.843,groundingUsdPer1k:14,groundingFreePerMonth:5000,
  inputUsdPerM:0.3,outputUsdPerM:2.5,perModel:{}
};

export function readAiRates(env:AiRateEnv):AiRates{
  let perModel:AiRates['perModel']={};
  try{
    const parsed=JSON.parse(String(env.AI_COST_MODEL_RATES??'{}')) as Record<string,{input?:unknown;output?:unknown}>;
    for(const [model,rate] of Object.entries(parsed??{}))
      perModel[model]={input:num(rate?.input,DEFAULT_RATES.inputUsdPerM),output:num(rate?.output,DEFAULT_RATES.outputUsdPerM)};
  }catch{perModel={}}
  return {
    currency:String(env.AI_COST_CURRENCY??DEFAULT_RATES.currency).trim()||DEFAULT_RATES.currency,
    fxPerUsd:num(env.AI_COST_FX_PER_USD,DEFAULT_RATES.fxPerUsd),
    groundingUsdPer1k:num(env.AI_COST_GROUNDING_USD_PER_1K,DEFAULT_RATES.groundingUsdPer1k),
    groundingFreePerMonth:num(env.AI_COST_GROUNDING_FREE_PER_MONTH,DEFAULT_RATES.groundingFreePerMonth),
    inputUsdPerM:num(env.AI_COST_INPUT_USD_PER_M,DEFAULT_RATES.inputUsdPerM),
    outputUsdPerM:num(env.AI_COST_OUTPUT_USD_PER_M,DEFAULT_RATES.outputUsdPerM),
    perModel
  };
}

export type UsageTotals={searchQueries:number;promptTokens:number;outputTokens:number};

export function tokenCostUsd(totals:UsageTotals,rates:AiRates,model?:string){
  const rate=(model&&rates.perModel[model])||{input:rates.inputUsdPerM,output:rates.outputUsdPerM};
  return totals.promptTokens*rate.input/1e6+totals.outputTokens*rate.output/1e6;
}

/**
 * What one more run of this shape costs today.
 *
 * The free allowance is deliberately ignored: it is consumed once a month and
 * then gone, so the honest answer to "what does another producer run cost" is
 * the billed rate. The allowance is applied separately, to the month.
 */
export function marginalCostUsd(totals:UsageTotals,rates:AiRates,model?:string){
  return totals.searchQueries*rates.groundingUsdPer1k/1000+tokenCostUsd(totals,rates,model);
}

/** What a whole month costs, with the free search allowance applied once. */
export function monthCostUsd(totals:UsageTotals,rates:AiRates){
  const billable=Math.max(0,totals.searchQueries-rates.groundingFreePerMonth);
  return billable*rates.groundingUsdPer1k/1000+tokenCostUsd(totals,rates);
}

export const toLocal=(usd:number,rates:AiRates)=>usd*rates.fxPerUsd;
