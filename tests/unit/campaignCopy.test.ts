import { describe,expect,it } from 'vitest';
import { campaignSummary,formatDuration,planSummary } from '../../src/features/producers/campaignCopy';
import type { ResearchCampaign,ResearchCampaignPlan } from '../../src/features/producers/api';

const plan=(over:Partial<ResearchCampaignPlan>={}):ResearchCampaignPlan=>({
  unresearched:120,willRun:25,maxPerRun:200,concurrency:2,geminiRequests:150,perProducerMs:240000,estimatedMs:3000000,active:null,...over
});
const campaign=(over:Partial<ResearchCampaign>={}):ResearchCampaign=>({
  id:'c1',status:'running',requested:25,concurrency:2,createdAt:'',updatedAt:'',finishedAt:null,dismissedAt:null,
  counts:{pending:20,running:2,complete:3,failed:0,skipped:0},items:[],failures:[],running:[],...over
});

describe('what a batch run is going to cost',()=>{
  it('says it in producers, requests and time',()=>{
    // The confirmation has to be answerable: how much work, how much API, how
    // long. Each producer is a profile plus five catalogue slices, so 25
    // producers is 150 grounded requests - a number worth seeing before
    // clicking, not after.
    expect(planSummary(plan())).toBe('25 producers · 150 grounded Gemini requests · about 50 min at 2 at a time');
  });

  it('does not invent a time when nothing has been measured',()=>{
    // A first-ever run has no completed producer research to average.
    expect(planSummary(plan({perProducerMs:null,estimatedMs:null})))
      .toBe('25 producers · 150 grounded Gemini requests');
  });

  it('reads hours as hours',()=>{
    expect(formatDuration(3000000)).toBe('50 min');
    expect(formatDuration(7_200_000)).toBe('2h');
    expect(formatDuration(9_300_000)).toBe('2h 35m');
    expect(formatDuration(20_000)).toBe('1 min');
  });
});

describe('where a batch run has got to',()=>{
  it('counts everything that has settled, not only the successes',()=>{
    expect(campaignSummary(campaign({counts:{pending:18,running:2,complete:4,failed:1,skipped:0}})))
      .toBe('5 of 25 done · 2 running · 18 waiting');
  });

  it('reports the outcome once it has finished',()=>{
    expect(campaignSummary(campaign({status:'complete',counts:{pending:0,running:0,complete:23,failed:2,skipped:0}})))
      .toBe('23 researched · 2 failed');
    expect(campaignSummary(campaign({status:'complete',counts:{pending:0,running:0,complete:25,failed:0,skipped:0}})))
      .toBe('25 researched');
  });
});
