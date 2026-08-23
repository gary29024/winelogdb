import { describe,expect,it } from 'vitest';
import { buildFieldProvenance } from '../../src/lib/research/provenance';
import { highRiskTechnicalFailureMessage,highRiskTechnicalReasons,highRiskTechnicalScopePasses,highRiskTechnicalViolations } from '../../src/lib/research/technicalClaimGate';
import type { DeepSearchProvenance } from '../../src/lib/db/schema';
import type { GroundingMetadata } from '../../src/lib/research/geminiBatch';

const provenance=(field:'summary'|'winemakingTechniques',text:string,metadata?:GroundingMetadata):DeepSearchProvenance=>({version:1,fields:{[field]:buildFieldProvenance(text,metadata)}});
const payload=(summary:string,winemakingTechniques:string)=>({summary,winemakingTechniques,drinkingWindow:'Drink 2028–2040.'});

describe('strict high-risk technical claim gate',()=>{
  it('recognizes precise technical facts but not a vintage year by itself',()=>{
    expect(highRiskTechnicalReasons('The 2021 wine is structured and mineral.')).toEqual([]);
    expect(highRiskTechnicalReasons('The wine used 30% new oak.')).toContain('percentage');
    expect(highRiskTechnicalReasons('The wine was matured for 18 months in barrel.')).toContain('duration');
    expect(highRiskTechnicalReasons('Dosage was 6 g/L.')).toContain('dosage_or_concentration');
    expect(highRiskTechnicalReasons('It was disgorged in March 2024.')).toContain('disgorgement_or_bottling_date');
    expect(highRiskTechnicalReasons('Fermentation took place at 24°C.')).toContain('temperature');
    expect(highRiskTechnicalReasons('The wine matured in 228 litre barrels.')).toContain('vessel_size');
  });

  it('accepts a precise percentage only when Gemini maps direct grounding to the exact claim',()=>{
    const claim='The 2021 wine used 30% new oak.';
    const metadata:GroundingMetadata={groundingChunks:[{web:{title:'Producer technical sheet',uri:'https://producer.example/2021-tech'}}],groundingSupports:[{segment:{text:claim},groundingChunkIndices:[0]}]};
    const p=provenance('winemakingTechniques',claim,metadata);
    expect(highRiskTechnicalScopePasses('wine_vintage',payload('Exact wine summary.',claim),p)).toBe(true);
    expect(highRiskTechnicalViolations(payload('Exact wine summary.',claim),p)).toEqual([]);
  });

  it('rejects partial grounding for a precise technical assertion',()=>{
    const claim='The 2021 wine used 30% new oak and was bottled without filtration.';
    const metadata:GroundingMetadata={groundingChunks:[{web:{title:'Technical sheet',uri:'https://producer.example/tech'}}],groundingSupports:[{segment:{text:'The 2021 wine used 30% new oak.'},groundingChunkIndices:[0]}]};
    const p=provenance('winemakingTechniques',claim,metadata),violations=highRiskTechnicalViolations(payload('Exact wine summary.',claim),p);
    expect(p.fields.winemakingTechniques?.claims[0].supportStatus).toBe('partial');
    expect(violations).toHaveLength(1);
    expect(violations[0].supportStatus).toBe('partial');
    expect(highRiskTechnicalScopePasses('wine_vintage',payload('Exact wine summary.',claim),p)).toBe(false);
  });

  it('rejects precise technical claims when an old cache has no claim provenance',()=>{
    const claim='The wine was matured for 18 months in barrel.';
    const violations=highRiskTechnicalViolations(payload('Exact wine summary.',claim));
    expect(violations[0].supportStatus).toBe('missing');
    expect(highRiskTechnicalScopePasses('wine_vintage',payload('Exact wine summary.',claim))).toBe(false);
  });

  it('allows an honest cannot-verify result instead of forcing a number into the report',()=>{
    const claim='The exact new-oak percentage could not be verified in reliable public sources.';
    expect(highRiskTechnicalScopePasses('wine_vintage',payload('Exact wine summary.',claim))).toBe(true);
  });

  it('does not turn ordinary unsupported descriptive prose into a hard technical failure',()=>{
    const claim='The wine is concentrated, floral and mineral.';
    const p=provenance('summary',claim);
    expect(p.fields.summary?.claims[0].supportStatus).toBe('unsupported');
    expect(highRiskTechnicalScopePasses('wine_vintage',payload(claim,'Exact techniques could not be verified in reliable public sources.'),p)).toBe(true);
  });

  it('produces an actionable failure message for targeted retry logging',()=>{
    const claim='Dosage was 5.5 g/L and the wine was disgorged in June 2024.';
    const p=provenance('winemakingTechniques',claim);
    const message=highRiskTechnicalFailureMessage(payload('Exact wine summary.',claim),p);
    expect(message).toMatch(/Strict technical evidence gate rejected 1 precise claim/);
    expect(message).toContain('unsupported');
  });
});
