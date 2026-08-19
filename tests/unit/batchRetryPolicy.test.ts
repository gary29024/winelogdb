import { describe,expect,it } from 'vitest';
import { researchBatchErrorPollDelay,researchBatchPollDelay,researchBatchStallAction,researchBatchTransientAction } from '../../src/lib/research/batchRetryPolicy';

describe('research Batch polling backoff',()=>{
  it('checks quickly at first and backs off long-running jobs',()=>{
    expect([0,1,2,3,4,5,20].map(researchBatchPollDelay)).toEqual([15,30,60,120,300,900,900]);
  });

  it('backs off transient status errors without hot polling',()=>{
    expect([0,1,2,3,4,20].map(researchBatchErrorPollDelay)).toEqual([30,60,120,300,900,900]);
  });

  it('fails the primary model over after a bounded transient-error budget',()=>{
    expect([0,1,2,3].map(count=>researchBatchTransientAction(1,count))).toEqual(['retry','retry','fallback','fallback']);
    expect([0,1,2,3,4,5].map(count=>researchBatchTransientAction(2,count))).toEqual(['retry','retry','retry','retry','fail','fail']);
  });

  it('fails a non-terminal primary Batch over before it can sit for twenty minutes',()=>{
    expect([0,1,2,3,4,5].map(count=>researchBatchStallAction(1,count))).toEqual(['retry','retry','retry','retry','fallback','fallback']);
    expect([0,1,2,3,4,5,6].map(count=>researchBatchStallAction(2,count))).toEqual(['retry','retry','retry','retry','retry','fail','fail']);
  });
});
