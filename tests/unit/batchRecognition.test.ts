import { describe,expect,it } from 'vitest';
import { chunkItemsByPreparedBytes,isBatchUploadComplete } from '../../worker/batchRecognition';
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
});

describe('shared recognition semantics',()=>{
  it('keeps one batch item explicitly scoped to one bottle',()=>{
    const {prompt}=buildRecognitionPrompt([]);
    expect(prompt).toContain('SAME wine bottle');
    expect(prompt).toContain('rather than treating them as separate wines');
  });
});