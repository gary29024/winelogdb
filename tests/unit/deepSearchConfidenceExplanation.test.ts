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
    expect(quality.warnings).toEqual([SOURCE_CONFIDENCE_EXPLANATION]);
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
    expect(quality.warnings).not.toContain(SOURCE_CONFIDENCE_EXPLANATION);
  });
});
