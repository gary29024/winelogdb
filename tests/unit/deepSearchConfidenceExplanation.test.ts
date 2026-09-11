import { describe,expect,it } from 'vitest';
import { bestResearchSourceTier,buildDeepResearchQuality,distinctSourceHosts,SOURCE_CONFIDENCE_EXPLANATION } from '../../src/lib/research/qualityGate';

const source=(url:string,title=url)=>({title,url});
const redirect=(title:string,id:string)=>source(`https://vertexaisearch.cloud.google.com/grounding-api-redirect/${id}`,title);
const entry=(sources:Array<{title:string;url:string}>)=>({
  scope:'terroir' as const,
  payload:{terroir:'Limestone and marl on an east-facing slope.'},
  subject:{},
  sources
});

describe('Deep Search confidence explanation',()=>{
  it('explains a warning-free mixed score caused only by one generic source',()=>{
    const quality=buildDeepResearchQuality([entry([source('https://example-winery.com/terroir')])]);

    expect(quality.status).toBe('mixed');
    expect(quality.score).toBe(82);
    expect(quality.fields.terroir?.warnings).toEqual([]);
    expect(quality.warnings).toEqual([]);
    expect(quality.scoreNote).toBe(SOURCE_CONFIDENCE_EXPLANATION);
  });

  it('uses Gemini redirect titles as the publisher hosts for corroboration',()=>{
    const sources=[redirect('one.example','a'),redirect('two.example','b'),redirect('three.example','c')];

    expect(distinctSourceHosts(sources)).toBe(3);
    const quality=buildDeepResearchQuality([entry(sources)]);
    expect(quality.status).toBe('verified');
    expect(quality.score).toBeGreaterThanOrEqual(85);
    expect(quality.warnings).toEqual([]);
  });

  it('recognises a specialist publisher behind a Gemini grounding redirect',()=>{
    const sources=[redirect('decanter.com','decanter')];

    expect(bestResearchSourceTier(sources)).toBe('specialist');
    const quality=buildDeepResearchQuality([entry(sources)]);
    expect(quality.status).toBe('verified');
    expect(quality.score).toBe(90);
  });

  it.each(['Our response to decanter.com ratings','decanter.com review','Read inao.gouv.fr for details'])('does not infer publisher authority from prose: %s',title=>{
    const sources=[redirect(title,'a')];
    expect(bestResearchSourceTier(sources)).toBe('grounded');
    expect(distinctSourceHosts(sources)).toBe(0);
    expect(buildDeepResearchQuality([entry(sources)]).score).toBe(82);
  });

  it.each(['Our vineyard soils','','vertexaisearch.cloud.google.com'])('does not count an unknown publisher as independent: %s',title=>{
    const sources=[redirect('example-winery.com','a'),redirect(title,'b')];
    expect(distinctSourceHosts(sources)).toBe(1);
    const quality=buildDeepResearchQuality([entry(sources)]);
    expect(quality.score).toBe(82);
    expect(quality.status).toBe('mixed');
  });

  it('keeps unidentified redirects grounded without inventing corroboration',()=>{
    const sources=[redirect('Vineyard soils','a'),redirect('Estate history','b')];
    expect(bestResearchSourceTier(sources)).toBe('grounded');
    expect(distinctSourceHosts(sources)).toBe(0);
    expect(buildDeepResearchQuality([entry(sources)]).score).toBe(82);
  });

  it('normalizes publisher domains and deduplicates direct and redirect sources',()=>{
    const sources=[redirect(' WWW.DECANTER.COM ','a'),source('https://decanter.com/wine')];
    expect(bestResearchSourceTier(sources)).toBe('specialist');
    expect(distinctSourceHosts(sources)).toBe(1);
    expect(buildDeepResearchQuality([entry(sources)]).score).toBe(90);
  });

  it('does not add the explanation after ordinary corroboration reaches verified',()=>{
    const quality=buildDeepResearchQuality([entry([
      source('https://one.example/terroir'),
      source('https://two.example/terroir'),
      source('https://three.example/terroir')
    ])]);

    expect(quality.status).toBe('verified');
    expect(quality.score).toBeGreaterThanOrEqual(85);
    expect(quality.warnings).toEqual([]);
  });

  it('keeps a real grounding failure distinct from source-tier confidence',()=>{
    const quality=buildDeepResearchQuality([entry([])]);

    expect(quality.warnings).toContain('no-grounding-source');
    expect(quality.scoreNote).toBeUndefined();
  });
});
