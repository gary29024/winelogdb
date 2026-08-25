import { describe,expect,it } from 'vitest';
import { buildResearchTargets,scopeQualityWarnings,splitDeepSearchResult,type ResearchTarget } from '../../src/lib/research/cache';
import { buildDeepSearchProvenance } from '../../src/lib/research/provenance';
import { highRiskTechnicalFailureMessage } from '../../src/lib/research/technicalClaimGate';

const payload={
  summary:'Château Example 2014 is a Pomerol of moderate concentration.',
  vintageQuality:'The 2014 growing season in Pomerol was cool and late, with a fine September rescuing the harvest.',
  producerDetails:'The estate has been family owned since the 19th century and sits on the Pomerol plateau.',
  producerWinemakingPractices:'The domaine generally ferments in concrete and matures in French oak.',
  winemakingTechniques:'For the 2014 vintage, technical records confirm a final blend of 93% Merlot and 7% Cabernet Franc.\n\nThe 2014 vintage was aged in French oak barriques for 18 to 22 months with 50% new oak.',
  terroir:'The vineyard sits on clay and gravel over a crasse de fer subsoil.',
  drinkingWindow:'Drinking well now and through the mid 2030s.'
};
const targets=buildResearchTargets({producer:'Château Example',producerId:'p1',cuveeId:'c1',wineName:'Château Example',vintage:2014,country:'France',region:'Bordeaux',appellation:'Pomerol'});
const fieldsOf:Record<string,string[]>={producer:['producerDetails','producerWinemakingPractices'],terroir:['terroir'],vintage_context:['vintageQuality'],wine_vintage:['summary','winemakingTechniques','drinkingWindow']};
const payloadFor=(target:ResearchTarget)=>Object.fromEntries(fieldsOf[target.scope].map(field=>[field,(payload as Record<string,string>)[field]]));
const result=(sources:Array<{title:string;url:string}>,metadata?:{groundingChunks?:unknown[];groundingSupports?:unknown[]})=>
  ({...payload,sources,model:'m',researchedAt:'2026-01-01T00:00:00.000Z',provenance:buildDeepSearchProvenance(payload,metadata as never)}) as never;

describe('an ungrounded Deep Search response',()=>{
  it('fails every scope, not just the one with technical claims',()=>{
    // This is the shape behind "nothing has been captured": no grounding at
    // all, so no scope can be verified and none is saved.
    const kept=splitDeepSearchResult(result([]),targets);
    expect(kept).toEqual([]);
    for(const target of targets)expect(scopeQualityWarnings(target.scope,payloadFor(target),target,[])).toContain('no-grounding-source');
  });

  it('is distinguishable from an unsupported technical claim',()=>{
    // The old report named the exact-wine technical gate for all four scopes,
    // because that message wins whenever wine_vintage is among the failures.
    // Both conditions hold at once here, so the codes are what tell them apart.
    const technical=highRiskTechnicalFailureMessage(payloadFor(targets[targets.length-1]),buildDeepSearchProvenance(payload,undefined));
    expect(technical).toMatch(/rejected 2 precise claims/);
    const everyScopeUngrounded=targets.every(target=>scopeQualityWarnings(target.scope,payloadFor(target),target,[]).includes('no-grounding-source'));
    expect(everyScopeUngrounded).toBe(true);
  });

  it('saves the scopes that hold up once any source comes back',()=>{
    // Sources present but no matching grounding segment: the three stable
    // scopes are keepable and only the exact-wine one fails its claim gate.
    const sources=[{title:'a',url:'https://example.com/a'}];
    const metadata={groundingChunks:[{web:{uri:'https://example.com/a',title:'a'}}],groundingSupports:[]};
    const kept=splitDeepSearchResult(result(sources,metadata),targets).map(entry=>entry.target.scope);
    expect(kept).toEqual(['producer','terroir','vintage_context']);
    for(const target of targets)expect(scopeQualityWarnings(target.scope,payloadFor(target),target,sources)).not.toContain('no-grounding-source');
  });

  it('reports an empty field as a missing field rather than a silence',()=>{
    const target=targets[0];
    expect(scopeQualityWarnings(target.scope,{producerDetails:'',producerWinemakingPractices:''},target,[{title:'a',url:'https://example.com/a'}])).toContain('missing-field');
  });
});

import { nextResearchAttempt } from '../../src/lib/research/batchWineResearch';

describe('whether a failed attempt is retried at all',()=>{
  it('gives a quality failure a second opinion',()=>{
    expect(nextResearchAttempt(1,false)).toBe(2);
  });

  it('stops after that when the answer was grounded but poor',()=>{
    // Failing twice on real evidence is a research limit, not an
    // infrastructure one, so a third call would just spend tokens.
    expect(nextResearchAttempt(2,false)).toBeNull();
  });

  it('gives an ungrounded answer one more attempt',()=>{
    // The observed failure: three scopes saved from a grounded answer, the
    // exact-wine scope retried on a model that returned zero grounding - which
    // no gate can accept, so that retry could never have succeeded.
    expect(nextResearchAttempt(2,true)).toBe(3);
  });

  it('does not retry forever on repeated ungrounded answers',()=>{
    expect(nextResearchAttempt(3,true)).toBeNull();
  });
});
