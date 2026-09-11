import { describe,expect,it } from 'vitest';
import { buildDeepResearchQuality,SOURCE_CONFIDENCE_EXPLANATION } from '../../src/lib/research/qualityGate';

const source=(url:string)=>({title:url,url});
const entry=(sources:Array<{title:string;url:string}>)=>({
  scope:'terroir' as const,
  payload:{terroir:'Limestone and marl on an east-facing slope.'},
  subject:{},
  sources
});

describe('Deep Search confidence explanation',()=>{
  it('explains a warning-free mixed score caused only by generic source tiering',()=>{
    const quality=buildDeepResearchQuality([entry([source('https://example-winery.com/terroir')])]);

    expect(quality.status).toBe('mixed');
    expect(quality.score).toBe(82);
    expect(quality.fields.terroir?.warnings).toEqual([]);
    expect(quality.warnings).toEqual([SOURCE_CONFIDENCE_EXPLANATION]);
  });

  it('does not add the explanation after corroboration reaches verified',()=>{
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
