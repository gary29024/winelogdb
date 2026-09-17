/** Default token-price multipliers; grounded search pricing is separate. */
export const DEFAULT_TIER_MULTIPLIERS={standard:1,flex:0.5,priority:1.8,batch:0.5} as const;
export type AiUsageTier=keyof typeof DEFAULT_TIER_MULTIPLIERS;
export const AI_USAGE_TIERS=Object.keys(DEFAULT_TIER_MULTIPLIERS) as AiUsageTier[];
