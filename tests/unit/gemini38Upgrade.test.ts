import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { AI_MODELS,AI_ROUTES } from '../../src/lib/ai/policy';
import { RECOGNITION_ESCALATION_MODEL,RECOGNITION_FLEX_ESCALATION_MODEL } from '../../src/lib/recognition/escalation';

const read=(path:string)=>readFileSync(path,'utf8');

describe('WineLog AI model policy',()=>{
  it('keeps Gemini 3.1 Flash Lite on the intentionally cheap primary paths',()=>{
    expect(AI_MODELS.recognitionPrimary).toBe('gemini-3.1-flash-lite');
    expect(AI_MODELS.vintagePrimary).toBe('gemini-3.1-flash-lite');
    expect(AI_ROUTES.recognitionInteractive.models).toEqual([AI_MODELS.recognitionPrimary]);
    expect(AI_ROUTES.champagneExtraction.models).toEqual([AI_MODELS.recognitionPrimary]);
    expect(AI_ROUTES.vintageIntelligence.models[0]).toBe(AI_MODELS.vintagePrimary);
  });

  it('keeps 3.8 primary and 3.7 as the grounded-research availability fallback',()=>{
    expect(AI_MODELS.groundedResearchPrimary).toBe('gemini-3.8-flash');
    expect(AI_MODELS.groundedResearchFallback).toBe('gemini-3.7-flash');
    expect(AI_ROUTES.wineDeepSearch.models).toEqual([AI_MODELS.groundedResearchPrimary,AI_MODELS.groundedResearchFallback]);
    expect(AI_ROUTES.producerResearch.models).toEqual([AI_MODELS.groundedResearchPrimary,AI_MODELS.groundedResearchFallback]);
  });

  it('keeps synchronous and Flex recognition escalation independently wired',()=>{
    expect(RECOGNITION_ESCALATION_MODEL).toBe(AI_MODELS.recognitionEscalationSync);
    expect(RECOGNITION_FLEX_ESCALATION_MODEL).toBe(AI_MODELS.recognitionEscalationFlex);
    expect(AI_ROUTES.recognitionEscalationSync.models).toEqual([AI_MODELS.recognitionEscalationSync]);
    expect(AI_ROUTES.recognitionBatch.models).toEqual([AI_MODELS.recognitionPrimary,AI_MODELS.recognitionEscalationFlex]);
    const flex=read('worker/vertexBatchRecognition.ts');
    expect(flex).toContain('RECOGNITION_FLEX_ESCALATION_MODEL');
    expect(flex).not.toContain('RECOGNITION_ESCALATION_MODEL');
  });

  it('keeps live research routing diagnostics bound to the policy',()=>{
    const queue=read('worker/researchQueueEntry.ts');
    expect(queue).toContain("import { AI_MODELS } from '../src/lib/ai/policy'");
    expect(queue).toContain('route:AI_MODELS.groundedResearchFallback');
    expect(queue).toContain('AI_MODELS.groundedResearchPrimary');
    expect(queue).not.toContain("route:'gemini-3.7-flash'");
    expect(queue).not.toContain('fell back from Gemini 3.8 to Gemini 3.7');
  });

  it('keeps the main AI consumers wired to policy values instead of local current-model constants',()=>{
    expect(read('src/lib/research/batchWineResearch.ts')).toContain('AI_MODELS.groundedResearchPrimary');
    expect(read('src/lib/producers/batchResearch.ts')).toContain('AI_MODELS.groundedResearchPrimary');
    expect(read('src/lib/research/geminiBatch.ts')).toContain('AI_MODELS.groundedResearchPrimary');
    expect(read('src/lib/research/modelHealth.ts')).toContain('AI_MODELS.groundedResearchPrimary');
    expect(read('src/lib/recognition/geminiRequest.ts')).toContain('AI_MODELS.recognitionPrimary');
    expect(read('worker/vintageWindowHandler.ts')).toContain('AI_MODELS.vintagePrimary');
    expect(read('src/lib/producers/catalogDirectResearch.ts')).toContain('AI_MODELS.producerRangeZai');
    expect(read('src/lib/producers/catalogWorkersAiFallback.ts')).toContain('AI_MODELS.producerRangeWorkers');
    expect(read('src/lib/journal/semanticSearch.ts')).toContain('AI_MODELS.semanticWorkers');
  });

  it('prices 3.8 independently without deleting 3.7 history',()=>{
    const config=read('wrangler.jsonc');
    expect(config).toContain('\\"gemini-3.7-flash\\"');
    expect(config).toContain('\\"gemini-3.8-flash\\"');
    expect(config).toContain('\\"from\\":\\"2026-09-02\\"');
  });
});
