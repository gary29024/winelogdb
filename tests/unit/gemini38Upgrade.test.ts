import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { RECOGNITION_ESCALATION_MODEL } from '../../src/lib/recognition/escalation';

const read=(path:string)=>readFileSync(path,'utf8');

describe('Gemini 3.8 Flash rollout',()=>{
  it('uses 3.8 for current primary and escalation paths',()=>{
    expect(RECOGNITION_ESCALATION_MODEL).toBe('gemini-3.8-flash');
    expect(read('src/lib/research/modelHealth.ts')).toContain("PRIMARY_MODEL='gemini-3.8-flash'");
    expect(read('src/lib/research/geminiBatch.ts')).toContain("PRIMARY_MODEL='gemini-3.8-flash'");
    expect(read('src/lib/research/batchWineResearch.ts')).toContain("PRIMARY_MODEL='gemini-3.8-flash'");
    expect(read('src/lib/producers/batchResearch.ts')).toContain("PRIMARY_MODEL='gemini-3.8-flash'");
    expect(read('worker/vintageWindowHandler.ts')).toContain("ESCALATION_MODEL='gemini-3.8-flash'");
  });

  it('keeps 3.7 as the Deep Search availability fallback',()=>{
    expect(read('src/lib/research/batchWineResearch.ts')).toContain("FALLBACK_MODEL='gemini-3.7-flash'");
    expect(read('src/lib/producers/batchResearch.ts')).toContain("FALLBACK_MODEL='gemini-3.7-flash'");
    expect(read('worker/researchQueueEntry.ts')).toContain("route:'gemini-3.7-flash'");
  });

  it('prices 3.8 independently without deleting 3.7 history',()=>{
    const config=read('wrangler.jsonc');
    expect(config).toContain('\\"gemini-3.7-flash\\"');
    expect(config).toContain('\\"gemini-3.8-flash\\"');
    expect(config).toContain('\\"from\\":\\"2026-09-02\\"');
  });
});
