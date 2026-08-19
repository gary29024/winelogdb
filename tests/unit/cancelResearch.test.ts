import { describe,expect,it } from 'vitest';
import { geminiBatchCancelUrl,nextCancelSweepDelay } from '../../src/lib/research/cancelResearch';

describe('research cancellation helpers',()=>{
  it('builds the official Gemini Batch cancel endpoint only for batch resource names',()=>{
    expect(geminiBatchCancelUrl('batches/abc-123_xyz')).toBe('https://generativelanguage.googleapis.com/v1beta/batches/abc-123_xyz:cancel');
    expect(()=>geminiBatchCancelUrl('models/gemini-3.7-flash')).toThrow('Invalid Gemini batch name');
    expect(()=>geminiBatchCancelUrl('../batches/abc')).toThrow('Invalid Gemini batch name');
  });

  it('uses bounded delayed sweeps to catch an in-flight batch creation race',()=>{
    expect(nextCancelSweepDelay(0)).toBe(30);
    expect(nextCancelSweepDelay(1)).toBe(120);
    expect(nextCancelSweepDelay(2)).toBeNull();
  });
});
