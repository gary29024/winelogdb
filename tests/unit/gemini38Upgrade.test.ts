import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { AI_DYNAMIC_ROUTES,AI_MODELS,AI_ROUTES } from '../../src/lib/ai/policy';
import { RECOGNITION_ESCALATION_MODEL } from '../../src/lib/recognition/escalation';

const read=(path:string)=>readFileSync(path,'utf8');

describe('WineLog AI model policy',()=>{
  it('keeps Gemini 3.1 Flash Lite on the intentionally cheap primary paths',()=>{
    expect(AI_MODELS.recognitionPrimary).toBe('gemini-3.1-flash-lite');
    expect(AI_MODELS.vintagePrimary).toBe('gemini-3.1-flash-lite');
    expect(AI_ROUTES.recognitionInteractive.models).toEqual(['gemini-3.1-flash-lite']);
    expect(AI_ROUTES.champagneExtraction.models).toEqual(['gemini-3.1-flash-lite']);
    expect(AI_ROUTES.vintageIntelligence.models[0]).toBe('gemini-3.1-flash-lite');
  });

  it('keeps 3.8 primary and 3.7 as the grounded-research availability fallback',()=>{
    expect(AI_MODELS.groundedResearchPrimary).toBe('gemini-3.8-flash');
    expect(AI_MODELS.groundedResearchFallback).toBe('gemini-3.7-flash');
    expect(AI_ROUTES.wineDeepSearch.models).toEqual(['gemini-3.8-flash','gemini-3.7-flash']);
    expect(AI_ROUTES.producerResearch.models).toEqual(['gemini-3.8-flash','gemini-3.7-flash']);
  });

  it('defines Dynamic Route targets only for compatible synchronous inference',()=>{
    expect(AI_DYNAMIC_ROUTES.recognitionEscalation).toBe('dynamic/winelog-recognition-escalation');
    expect(AI_DYNAMIC_ROUTES.producerRangeExtraction).toBe('dynamic/winelog-producer-range-extraction');
    expect(AI_ROUTES.recognitionEscalation.dynamicReady).toBe(true);
    expect(AI_ROUTES.producerRangeDirect.dynamicReady).toBe(true);
    expect(AI_ROUTES.wineDeepSearch.dynamicReady).toBe(false);
    expect(AI_ROUTES.recognitionBatch.dynamicReady).toBe(false);
  });

  it('keeps the exported recognition escalation model aligned with policy',()=>{
    expect(RECOGNITION_ESCALATION_MODEL).toBe(AI_MODELS.recognitionEscalationPrimary);
  });

  it('prices 3.8 independently without deleting 3.7 history',()=>{
    const config=read('wrangler.jsonc');
    expect(config).toContain('\\"gemini-3.7-flash\\"');
    expect(config).toContain('\\"gemini-3.8-flash\\"');
    expect(config).toContain('\\"from\\":\\"2026-09-02\\"');
  });
});
