import { describe,expect,it } from 'vitest';
import { buildFieldProvenance } from '../../src/lib/research/provenance';
import { buildDeepResearchQuality,explicitResearchStatus } from '../../src/lib/research/qualityGate';
import { isUnverifiedPreciseFigure } from '../../src/lib/research/preciseFigures';
import { scopePassesQuality,type ResearchTarget } from '../../src/lib/research/cache';
import { uncitedFigures } from '../../src/features/wines/researchSections';
import type { DeepSearchProvenance } from '../../src/lib/db/schema';

// The two Champagne reports that used to fail the whole run.
const blend='The cepage for this release is 41% Pinot Meunier, 39% Chardonnay, and 20% Pinot Noir.';
const reserve='The exact proportion and harvest vintages of reserve wines blended into this base 2022 release are not stated in retrieved technical documentation.';
const sources=[{title:'Producer',url:'https://producer.example/cuvee'}];
const payload={summary:'A precise, chalky Champagne from a 2022 base.',expectedProfile:'Citrus and brioche.',winemakingTechniques:`Pressed gently and fermented in tank. ${blend}`,drinkingWindow:'Drink now to 2030.'};
const target={scope:'wine_vintage',cacheKey:'k',subject:{}} as unknown as ResearchTarget;
const provenance=(text:string):DeepSearchProvenance=>({version:1,fields:{winemakingTechniques:buildFieldProvenance(text)}});

describe('uncited precise figures are labelled, not fatal',()=>{
  it('reads "not stated" as honest uncertainty rather than a precise claim',()=>{
    expect(explicitResearchStatus(reserve)).toBe('not_found');
    expect(explicitResearchStatus('Dosage is not specified by the house.')).toBe('not_found');
    expect(buildFieldProvenance(reserve).claims[0].supportStatus).toBe('uncertainty');
  });

  it('keeps the exact-wine scope when a precise figure has no direct citation',()=>{
    expect(scopePassesQuality('wine_vintage',payload,target,sources,provenance(payload.winemakingTechniques))).toBe(true);
  });

  it('flags only precise figures without direct support',()=>{
    expect(isUnverifiedPreciseFigure({claim:blend,supportStatus:'unsupported'})).toBe(true);
    expect(isUnverifiedPreciseFigure({claim:blend,supportStatus:'partial'})).toBe(true);
    expect(isUnverifiedPreciseFigure({claim:blend,supportStatus:'supported'})).toBe(false);
    expect(isUnverifiedPreciseFigure({claim:'Pressed gently and fermented in tank.',supportStatus:'unsupported'})).toBe(false);
    expect(uncitedFigures({provenance:provenance(payload.winemakingTechniques)},'winemakingTechniques')).toEqual([blend]);
    expect(uncitedFigures({uncitedFigures:{summary:['x']}},'summary')).toEqual(['x']);
  });

  it('holds confidence below verified and names the reason',()=>{
    const quality=buildDeepResearchQuality([{scope:'wine_vintage',payload,subject:{},sources,provenance:provenance(payload.winemakingTechniques)}]);
    expect(quality.status).not.toBe('verified');
    expect(quality.warnings).toContain('uncited-precise-figure');
    expect(quality.fields.winemakingTechniques!.score).toBeLessThanOrEqual(78);
  });
});
