import { readdirSync,readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { assessResearchField,bestResearchSourceTier,buildDeepResearchQuality,distinctSourceHosts,nonContextualYears } from '../../src/lib/research/qualityGate';
import { scopeRetryFeedback } from '../../src/lib/research/cache';
import type { ResearchTarget } from '../../src/lib/research/cache';

const source=(url:string)=>({title:url,url});
const grounded=[source('https://example-winery.com/a')];
const subject2016={vintage:2016};
const target=(scope:ResearchTarget['scope'],subject:Record<string,string|number|null>):ResearchTarget=>({scope,cacheKey:'k',subject});

describe('vintage reference heuristic',()=>{
  it('accepts a field that names the vintage it is about',()=>{
    const result=assessResearchField('vintageQuality','2016 brought damaging April frost; the warmest season since 2003.',subject2016,grounded);
    expect(result.pass).toBe(true);
    expect(result.warnings).not.toContain('wrong-vintage-reference');
  });

  it('accepts historical context that never names the vintage',()=>{
    // The real false positive: a correct technique note citing a founding date.
    const result=assessResearchField('winemakingTechniques','Whole-cluster fermentation in open wooden vats; the domaine converted to biodynamics in 2008 and was certified in 2011.',subject2016,grounded);
    expect(result.pass).toBe(true);
    expect(result.warnings).not.toContain('wrong-vintage-reference');
  });

  it('accepts a comparison against other vintages',()=>{
    const result=assessResearchField('vintageQuality','A cooler growing season, picked later than 2015 and well before 2018.',subject2016,grounded);
    expect(result.pass).toBe(true);
  });

  it('still rejects a different vintage asserted as this wine',()=>{
    const result=assessResearchField('winemakingTechniques','2019 saw 40% whole cluster and 18 months in barrel.',subject2016,grounded);
    expect(result.warnings).toContain('wrong-vintage-reference');
    expect(result.pass).toBe(false);
  });

  it('separates asserted years from contextual ones',()=>{
    expect(nonContextualYears('Converted to biodynamics in 2008')).toEqual([]);
    expect(nonContextualYears('The warmest since 2003')).toEqual([]);
    expect(nonContextualYears('2019 was picked in September')).toEqual([2019]);
  });
});

describe('source tiering',()=>{
  it('recognises official bodies outside France and the United States',()=>{
    expect(bestResearchSourceTier([source('https://www.consorziobrunello.it/x')])).toBe('authoritative');
    expect(bestResearchSourceTier([source('https://www.austrianwine.com/x')])).toBe('authoritative');
    expect(bestResearchSourceTier([source('https://www.wineaustralia.com/x')])).toBe('authoritative');
    expect(bestResearchSourceTier([source('https://www.agriculture.gov.au/x')])).toBe('authoritative');
    expect(bestResearchSourceTier([source('https://example.govt.nz/x')])).toBe('authoritative');
  });

  it('recognises non-anglophone specialist critics',()=>{
    expect(bestResearchSourceTier([source('https://www.falstaff.com/x')])).toBe('specialist');
    expect(bestResearchSourceTier([source('https://www.gamberorosso.it/x')])).toBe('specialist');
  });

  it('lets independently corroborated grounded sources reach verified',()=>{
    const one=[source('https://a-winery.example/x')];
    const three=[source('https://a-winery.example/x'),source('https://b-merchant.example/y'),source('https://c-guide.example/z')];
    expect(distinctSourceHosts(three)).toBe(3);
    const single=buildDeepResearchQuality([{scope:'terroir',payload:{terroir:'Limestone and marl on an east-facing slope.'},subject:{},sources:one}]);
    const corroborated=buildDeepResearchQuality([{scope:'terroir',payload:{terroir:'Limestone and marl on an east-facing slope.'},subject:{},sources:three}]);
    expect(single.status).toBe('mixed');
    expect(corroborated.status).toBe('verified');
    expect(corroborated.score).toBeGreaterThan(single.score);
  });

  it('gives no corroboration credit when there is no usable source at all',()=>{
    const result=assessResearchField('terroir','Limestone and marl.',{},[]);
    expect(result.score).toBe(0);
    expect(result.warnings).toContain('no-grounding-source');
  });
});

describe('retry feedback',()=>{
  it('turns a rejection into an instruction the retry can act on',()=>{
    const notes=scopeRetryFeedback('wine_vintage',
      {summary:'A fine wine.',winemakingTechniques:'2019 saw 40% whole cluster.',drinkingWindow:'2026-2040'},
      target('wine_vintage',subject2016),grounded);
    expect(notes.join(' ')).toMatch(/requested vintage/i);
  });

  it('reports an empty field rather than staying silent',()=>{
    const notes=scopeRetryFeedback('terroir',{terroir:''},target('terroir',{}),grounded);
    expect(notes.join(' ')).toMatch(/empty/i);
  });

  it('says nothing when the scope is sound',()=>{
    const notes=scopeRetryFeedback('terroir',{terroir:'Limestone and marl on an east-facing slope.'},target('terroir',{}),grounded);
    expect(notes).toEqual([]);
  });
});

describe('single research implementation',()=>{
  const workerFiles=readdirSync('worker').filter(name=>name.endsWith('.ts'));
  const sources=workerFiles.map(name=>({name,text:readFileSync(`worker/${name}`,'utf8')}));

  it('routes wine Deep Search and producer research through the queue only',()=>{
    for(const path of ["'/api/wines/:id/deep-search'","'/api/producers/:id/research'"]){
      const owners=sources.filter(file=>file.text.includes(`.post(${path}`)).map(file=>file.name);
      // cuveeEntry only forwards; researchQueueEntry owns the handler. A second
      // real handler is how a shadowed duplicate implementation crept back in.
      expect(owners.filter(name=>name!=='cuveeEntry.ts')).toEqual(['researchQueueEntry.ts']);
    }
  });

  it('keeps exactly one wine and one producer research implementation',()=>{
    const libs=[
      ...readdirSync('src/lib/research').map(name=>`src/lib/research/${name}`),
      ...readdirSync('src/lib/producers').map(name=>`src/lib/producers/${name}`)
    ].filter(path=>path.endsWith('.ts'));
    expect(libs.filter(path=>readFileSync(path,'utf8').includes('export async function startWineBatchResearch'))).toEqual(['src/lib/research/batchWineResearch.ts']);
    expect(libs.filter(path=>readFileSync(path,'utf8').includes('export async function startProducerBatchResearch'))).toEqual(['src/lib/producers/batchResearch.ts']);
    expect(libs).not.toContain('src/lib/producers/batchResearchV2.ts');
    expect(libs).not.toContain('src/lib/research/deepSearch.ts');
  });
});
