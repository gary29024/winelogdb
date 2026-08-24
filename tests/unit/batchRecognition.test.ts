import { describe,expect,it } from 'vitest';
import { canRetrySubmittedBatch,chunkItemsByPreparedBytes,countConfirmedBatchItems,isBatchUploadComplete,unclaimedSubmittedItems } from '../../worker/batchRecognition';
import { shouldRequeueVertexJob } from '../../worker/vertexBatchRecognition';
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
  it('permits recovery for waiting items even while a stale session says running',()=>{
    expect(canRetrySubmittedBatch('ready',2)).toBe(true);
    expect(canRetrySubmittedBatch('partial',1)).toBe(true);
    expect(canRetrySubmittedBatch('failed',3)).toBe(true);
    expect(canRetrySubmittedBatch('running',2)).toBe(true);
    expect(canRetrySubmittedBatch('queued',2)).toBe(true);
    expect(canRetrySubmittedBatch('running',0)).toBe(false);
  });
  it('does not resubmit waiting items already claimed by an active Gemini job',()=>{
    const items=[{id:'a',status:'submitted'},{id:'b',status:'submitted'},{id:'c',status:'confirmed'}];
    expect(unclaimedSubmittedItems(items,new Set(['a'])).map(item=>item.id)).toEqual(['b']);
  });
  it('derives confirmed counts from item state instead of a stale session counter',()=>{
    expect(countConfirmedBatchItems([{status:'confirmed'},{status:'ready'},{status:'confirmed'},{status:'submitted'}])).toBe(2);
  });
  it('requeues queued or expired running Vertex jobs but preserves a live request lease',()=>{
    const now=Date.parse('2026-08-24T08:00:00.000Z');
    expect(shouldRequeueVertexJob('queued','2026-08-24T07:59:59.000Z',now)).toBe(true);
    expect(shouldRequeueVertexJob('running','2026-08-24T07:55:00.000Z',now)).toBe(false);
    expect(shouldRequeueVertexJob('running','2026-08-24T07:47:00.000Z',now)).toBe(true);
    expect(shouldRequeueVertexJob('complete','2026-08-24T07:00:00.000Z',now)).toBe(false);
  });
});

describe('shared recognition semantics',()=>{
  it('keeps one batch item explicitly scoped to one bottle',()=>{
    const {prompt}=buildRecognitionPrompt([]);
    expect(prompt).toContain('SAME wine bottle');
    expect(prompt).toContain('rather than treating them as separate wines');
  });
});