import { readdirSync,readFileSync } from 'node:fs';
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

  /**
   * The wiring test above proves a file imports the policy. It cannot prove the
   * file stopped naming a model in prose, and both forms drift the same way: the
   * research error text and the Deep Search stage label kept saying "Gemini 3.8"
   * while reading the model from policy. Error strings are persisted to run
   * history and the stage label is shown to the owner, so a stale name is not
   * only a comment. Absence is the only assertion that catches the prose form.
   */
  it('keeps current model names out of live code, in identifier and prose form',()=>{
    const displayName=(id:string)=>id.replace(/^gemini-([\d.]+)-flash.*$/,'Gemini $1');
    const current=[AI_MODELS.recognitionPrimary,AI_MODELS.recognitionEscalationSync,AI_MODELS.recognitionEscalationFlex,
      AI_MODELS.groundedResearchPrimary,AI_MODELS.groundedResearchFallback,AI_MODELS.vintagePrimary,AI_MODELS.vintageEscalation,
      AI_MODELS.producerRangeZai,AI_MODELS.producerRangeWorkers,AI_MODELS.semanticWorkers,AI_MODELS.semanticGemini];
    const forbidden=[...new Set(current.flatMap(id=>[id,displayName(id)]))];
    // policy.ts is where the literals belong. worker/index.ts holds the dead
    // /api/recognition route that entry.ts shadows - its own comment says so, and
    // rewiring a path nothing calls would only make the exemption harder to see.
    const exempt=new Set(['src/lib/ai/policy.ts','worker/index.ts']);
    const sources=['src','worker'].flatMap(root=>readdirSync(root,{recursive:true,encoding:'utf8'})
      .map(name=>`${root}/${name.replace(/\\/g,'/')}`).filter(path=>/\.tsx?$/.test(path)&&!exempt.has(path)));
    expect(sources.length).toBeGreaterThan(50);
    for(const file of sources){
      const text=read(file);
      for(const name of forbidden)expect(text,`${file} hard-codes "${name}"; read it from AI_MODELS instead`).not.toContain(name);
    }
  });

  it('prices 3.8 independently without deleting 3.7 history',()=>{
    const config=read('wrangler.jsonc');
    expect(config).toContain('\\"gemini-3.7-flash\\"');
    expect(config).toContain('\\"gemini-3.8-flash\\"');
    expect(config).toContain('\\"from\\":\\"2026-09-02\\"');
  });
});
