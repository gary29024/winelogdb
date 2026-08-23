import { describe,expect,it } from 'vitest';
import { buildResearchTargets,splitDeepSearchResult } from '../../src/lib/research/cache';
import { assessResearchField,bestResearchSourceTier,explicitResearchStatus } from '../../src/lib/research/qualityGate';

const grounded=[{title:'Producer technical sheet',url:'https://example.com/technical-sheet'}];

describe('research evidence quality gate',()=>{
  it('requires grounding for an asserted fact',()=>{
    const subject={producer:'Domaine Test',wineName:'Clos Test',vintage:2021};
    expect(assessResearchField('winemakingTechniques','For 2021, the wine was matured for 16 months.',subject,grounded).pass).toBe(true);
    const ungrounded=assessResearchField('winemakingTechniques','For 2021, the wine was matured for 16 months.',subject,[]);
    expect(ungrounded.pass).toBe(false);
    expect(ungrounded.warnings).toContain('no-grounding-source');
  });

  it('treats an explicit not-found conclusion as completed research rather than forcing invented detail',()=>{
    const text='Exact 2021 whole-cluster information could not be verified in reliable public sources.';
    expect(explicitResearchStatus(text)).toBe('not_found');
    const quality=assessResearchField('winemakingTechniques',text,{vintage:2021},[]);
    expect(quality.pass).toBe(true);
    expect(quality.status).toBe('not_found');
  });

  it('rejects vintage leakage in vintage-sensitive fields',()=>{
    const quality=assessResearchField('winemakingTechniques','The 2020 wine used 50% whole bunch and 30% new oak.',{vintage:2021},grounded);
    expect(quality.pass).toBe(false);
    expect(quality.warnings).toContain('wrong-vintage-reference');
  });

  it('rejects producer-wide habits presented as exact-vintage technique',()=>{
    const quality=assessResearchField('winemakingTechniques','The domaine typically uses whole bunches and older barrels.',{vintage:2021},grounded);
    expect(quality.pass).toBe(false);
    expect(quality.warnings).toContain('general-practice-presented-as-exact-vintage');
  });

  it('flags but does not discard contextual vintage examples in producer-wide practice when variability is clear',()=>{
    const quality=assessResearchField('producerWinemakingPractices','Practices vary by vintage; for example, 2021 used more whole bunches.',{},grounded);
    expect(quality.pass).toBe(true);
  });

  it('ranks appellation and specialist evidence above generic grounded pages',()=>{
    expect(bestResearchSourceTier([{title:'BIVB',url:'https://www.bourgogne-wines.com/foo'}])).toBe('authoritative');
    expect(bestResearchSourceTier([{title:'Decanter',url:'https://www.decanter.com/foo'}])).toBe('specialist');
    expect(bestResearchSourceTier(grounded)).toBe('grounded');
  });

  it('drops only the failed reusable scope so the batch retry can target it',()=>{
    const targets=buildResearchTargets({producer:'Domaine Test',producerId:'p1',cuveeId:'c1',wineName:'Clos Test',vintage:2021,country:'France',region:'Burgundy',appellation:'Clos de la Roche'});
    const result={
      summary:'The exact 2021 wine is documented by the cited source.',
      vintageQuality:'The 2020 growing season was warm and dry.',
      producerDetails:'A documented Burgundy producer.',
      producerWinemakingPractices:'The domaine uses parcel-sensitive élevage and practices vary by cuvée.',
      winemakingTechniques:'For 2021, the exact wine was matured in barrel.',
      terroir:'The cru has limestone-rich soils and an east-facing slope.',
      drinkingWindow:'A reasonable drinking window is 2028–2040.',
      sources:grounded,
      model:'gemini-3.7-flash',
      researchedAt:'2026-08-23T00:00:00.000Z'
    };
    const entries=splitDeepSearchResult(result,targets);
    expect(entries.map(entry=>entry.target.scope).sort()).toEqual(['producer','terroir','wine_vintage']);
  });
});
