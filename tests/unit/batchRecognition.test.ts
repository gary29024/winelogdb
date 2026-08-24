import { describe,expect,it } from 'vitest';
import { canRetrySubmittedBatch,chunkItemsByPreparedBytes,countConfirmedBatchItems,isBatchUploadComplete,unclaimedSubmittedItems } from '../../worker/batchRecognition';
import { buildRecognitionPrompt } from '../../src/lib/recognition/geminiRequest';

describe('Batch Scan payload splitting',()=>{
  it('keeps each wine intact and splits only between wines',()=>{
    const items=[{id:'a',preparedBytes:5},{id:'b',preparedBytes:6},{id:'c',preparedBytes:4}];
    expect(chunkItemsByPreparedBytes(items,10).map(x=>x.map(y=>y.id))).toEqual([['a'],['b','c']]);
  });
  it('does not split one wine even when it alone exceeds the target',()=>{
    const items=[{id:'a',preparedBytes:12}];
    expect(chunkItemsByPreparedBytes(items,10)).toEqual([items]);
  });
  it('does not submit a partially uploaded expected batch',()=>{
    expect(isBatchUploadComplete(12,19)).toBe(false);
    expect(isBatchUploadComplete(19,19)).toBe(true);
    expect(isBatchUploadComplete(2,0)).toBe(true);
  });
  it('allows waiting recognition to be recovered even while the session still says running',()=>{
    expect(canRetrySubmittedBatch('queued',2)).toBe(true);
    expect(canRetrySubmittedBatch('running',2)).toBe(true);
    expect(canRetrySubmittedBatch('ready',2)).toBe(true);
    expect(canRetrySubmittedBatch('partial',1)).toBe(true);
    expect(canRetrySubmittedBatch('failed',3)).toBe(true);
    expect(canRetrySubmittedBatch('uploading',2)).toBe(false);
    expect(canRetrySubmittedBatch('complete',2)).toBe(false);
    expect(canRetrySubmittedBatch('running',0)).toBe(false);
  });
  it('does not resubmit submitted items already claimed by an active Gemini job',()=>{
    const items=[{id:'a',status:'submitted'},{id:'b',status:'submitted'},{id:'c',status:'ready'}];
    expect(unclaimedSubmittedItems(items,new Set(['b'])).map(item=>item.id)).toEqual(['a']);
  });
  it('derives the confirmed count from item state instead of a stale session counter',()=>{
    expect(countConfirmedBatchItems([{status:'confirmed'},{status:'ready'},{status:'confirmed'},{status:'submitted'}])).toBe(2);
  });
});

describe('shared recognition semantics',()=>{
  it('keeps one batch item explicitly scoped to one bottle',()=>{
    const {prompt}=buildRecognitionPrompt([]);
    expect(prompt).toContain('SAME wine bottle');
    expect(prompt).toContain('rather than treating them as separate wines');
  });
});
