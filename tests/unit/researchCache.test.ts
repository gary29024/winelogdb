import { describe,expect,it } from 'vitest';
import { assembleDeepSearch,buildResearchTargets,scopeIsComplete,type CachedResearch,type ResearchScope } from '../../src/lib/research/cache';

const byScope=(targets:ReturnType<typeof buildResearchTargets>)=>new Map(targets.map(target=>[target.scope,target]));

describe('layered research identities',()=>{
  it('reuses producer and terroir across vintages but not vintage-sensitive scopes',()=>{
    const a=byScope(buildResearchTargets({producer:'Domaine Dujac',wineName:'Clos de la Roche',vintage:2021,country:'France',region:'Burgundy',appellation:'Clos de la Roche'}));
    const b=byScope(buildResearchTargets({producer:'Domaine Dujac',wineName:'Clos de la Roche',vintage:2022,country:'France',region:'Burgundy',appellation:'Clos de la Roche'}));
    expect(a.get('producer')?.cacheKey).toBe(b.get('producer')?.cacheKey);
    expect(a.get('terroir')?.cacheKey).toBe(b.get('terroir')?.cacheKey);
    expect(a.get('vintage_context')?.cacheKey).not.toBe(b.get('vintage_context')?.cacheKey);
    expect(a.get('wine_vintage')?.cacheKey).not.toBe(b.get('wine_vintage')?.cacheKey);
  });

  it('reuses vintage context across producers in the same appellation and year',()=>{
    const a=byScope(buildResearchTargets({producer:'Producer A',wineName:'Wine A',vintage:2021,country:'France',region:'Burgundy',appellation:'Vosne-Romanée'}));
    const b=byScope(buildResearchTargets({producer:'Producer B',wineName:'Wine B',vintage:2021,country:'France',region:'Burgundy',appellation:'Vosne-Romanée'}));
    expect(a.get('producer')?.cacheKey).not.toBe(b.get('producer')?.cacheKey);
    expect(a.get('terroir')?.cacheKey).not.toBe(b.get('terroir')?.cacheKey);
    expect(a.get('vintage_context')?.cacheKey).toBe(b.get('vintage_context')?.cacheKey);
  });

  it('gives identical keys to the same wine and vintage',()=>{
    const first=buildResearchTargets({producer:'Domaine Dujac',wineName:'Clos de la Roche',vintage:2021,country:'France',region:'Burgundy',appellation:'Clos de la Roche'});
    const second=buildResearchTargets({producer:'Domaine Dujac',wineName:'Clos de la Roche',vintage:2021,country:'France',region:'Burgundy',appellation:'Clos de la Roche'});
    expect(first.map(x=>x.cacheKey)).toEqual(second.map(x=>x.cacheKey));
  });

  it('requires producer-wide practices in the producer scope but keeps exact techniques wine-vintage specific',()=>{
    expect(scopeIsComplete('producer',{producerDetails:'Profile'})).toBe(false);
    expect(scopeIsComplete('producer',{producerDetails:'Profile',producerWinemakingPractices:'General cellar philosophy'})).toBe(true);
    expect(scopeIsComplete('wine_vintage',{summary:'Wine',winemakingTechniques:'Exact 2021 élevage',drinkingWindow:'2028–2045'})).toBe(true);
  });
});

describe('layered research assembly',()=>{
  it('assembles one wine report from reusable cache scopes',()=>{
    const targets=buildResearchTargets({producer:'Domaine Dujac',wineName:'Clos de la Roche',vintage:2021,country:'France',region:'Burgundy',appellation:'Clos de la Roche'});
    const payloads:Record<ResearchScope,Record<string,string>>={
      producer:{producerDetails:'Producer profile',producerWinemakingPractices:'Producer-wide practices'},
      terroir:{terroir:'Stable cru facts'},
      vintage_context:{vintageQuality:'2021 weather and quality'},
      wine_vintage:{summary:'2021 exact wine',winemakingTechniques:'2021 verified vinification',drinkingWindow:'2028–2045'}
    };
    const cache=new Map<ResearchScope,CachedResearch>();
    for(const target of targets)cache.set(target.scope,{target,payload:payloads[target.scope],sources:[{title:target.scope,url:`https://example.com/${target.scope}`}],model:'gemini-3.7-flash',researchedAt:'2026-08-17T00:00:00.000Z'});
    const result=assembleDeepSearch(cache,targets);
    expect(result.producerDetails).toBe('Producer profile');
    expect(result.producerWinemakingPractices).toBe('Producer-wide practices');
    expect(result.terroir).toBe('Stable cru facts');
    expect(result.vintageQuality).toBe('2021 weather and quality');
    expect(result.winemakingTechniques).toBe('2021 verified vinification');
    expect(result.drinkingWindow).toBe('2028–2045');
    expect(result.sources).toHaveLength(4);
  });
});
