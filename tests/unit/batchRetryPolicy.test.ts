import { describe,expect,it } from 'vitest';
import { researchBatchErrorPollDelay,researchBatchFirstPollDelay,researchBatchPollDelay,researchBatchStallAction,researchBatchTransientAction } from '../../src/lib/research/batchRetryPolicy';

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

describe('when the first status poll runs',()=>{
  it('waits before polling a batch that is already working',()=>{
    // The real Batch API runs on its own schedule; polling it immediately would
    // only spend a read on an answer that cannot be ready yet.
    expect(researchBatchFirstPollDelay(false)).toBe(researchBatchPollDelay(0));
    expect(researchBatchFirstPollDelay(false)).toBeGreaterThan(0);
  });

  it('polls at once when that poll is what starts the work',()=>{
    // On the Vertex gateway path, submitting only writes a pending row and the
    // first poll makes the model call. Waiting there is dead time before any
    // research begins, on every run.
    expect(researchBatchFirstPollDelay(true)).toBe(0);
  });

  it('leaves the later polls alone',()=>{
    // Only the first poll changes: once work is under way the backoff still
    // applies, so a long run does not turn into a tight polling loop.
    expect([1,2,3,4,5].map(researchBatchPollDelay)).toEqual([30,60,120,300,900]);
  });
});
