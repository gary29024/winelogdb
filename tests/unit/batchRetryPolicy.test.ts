import { describe,expect,it } from 'vitest';
import { researchBatchErrorPollDelay,researchBatchPollDelay } from '../../src/lib/research/batchRetryPolicy';

describe('research Batch polling backoff',()=>{
  it('checks quickly at first and backs off long-running jobs',()=>{
    expect([0,1,2,3,4,5,20].map(researchBatchPollDelay)).toEqual([15,30,60,120,300,900,900]);
  });

  it('backs off transient status errors without hot polling',()=>{
    expect([0,1,2,3,4,20].map(researchBatchErrorPollDelay)).toEqual([30,60,120,300,900,900]);
  });
});
