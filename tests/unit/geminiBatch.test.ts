import { describe,expect,it } from 'vitest';
import { extractBatchResponses,inlineResponseText,isTerminalBatchState,normalizeBatchState,responsesByKey } from '../../src/lib/research/geminiBatch';

describe('Gemini Batch helpers',()=>{
  it('normalizes Gemini batch state names',()=>{
    expect(normalizeBatchState({state:'BATCH_STATE_SUCCEEDED'})).toBe('JOB_STATE_SUCCEEDED');
    expect(normalizeBatchState({metadata:{state:'JOB_STATE_RUNNING'}})).toBe('JOB_STATE_RUNNING');
    expect(isTerminalBatchState('JOB_STATE_SUCCEEDED')).toBe(true);
    expect(isTerminalBatchState('JOB_STATE_RUNNING')).toBe(false);
  });

  it('extracts keyed inline responses from the batch destination',()=>{
    const payload={dest:{inlinedResponses:[
      {metadata:{key:'profile'},response:{candidates:[{content:{parts:[{text:'{"profile":"ok"}'}]}}]}},
      {metadata:{key:'catalog'},error:{message:'failed'}}
    ]}};
    const responses=extractBatchResponses(payload),byKey=responsesByKey(responses);
    expect(responses).toHaveLength(2);
    expect(inlineResponseText(byKey.get('profile')!)).toBe('{"profile":"ok"}');
    expect(byKey.get('catalog')?.error?.message).toBe('failed');
  });

  it('also accepts operation response inline results',()=>{
    const payload={response:{dest:{inlinedResponses:[{metadata:{key:'wine-research'},response:{candidates:[{content:{parts:[{text:'{}'}]}}]}}]}}};
    expect(extractBatchResponses(payload)[0]?.metadata?.key).toBe('wine-research');
  });
});
