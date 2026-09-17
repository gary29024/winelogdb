import { describe,expect,it } from 'vitest';
import { buildLegacyResearchTargets,buildResearchTargets } from '../../src/lib/research/cache';
import { sharedSubjectKey } from '../../src/lib/research/shared';

const chinese={producer:'赤恋葡萄酒',wineName:'珍藏红',vintage:2019,country:'China',region:'Ningxia',appellation:null,wineStyle:'red'};
const latin={producer:'Domaine Dujac',wineName:'Clos de la Roche',vintage:2019,country:'France',region:'Burgundy',appellation:'Clos de la Roche',wineStyle:'red'};
const keys=(targets:ReturnType<typeof buildResearchTargets>)=>Object.fromEntries(targets.map(t=>[t.scope,t.cacheKey]));

describe('cache keys across the normalizer change',()=>{
  // The widening to \p{L}\p{N} was right, but it moved the key of every row
  // already written for a non-Latin name. Those rows must still be findable or
  // the research is silently re-bought.
  it('gives a non-Latin producer a different key than it had before',()=>{
    expect(keys(buildResearchTargets(chinese)).producer).not.toBe(keys(buildLegacyResearchTargets(chinese)).producer);
  });

  it('leaves Latin names on exactly the key they already had',()=>{
    expect(keys(buildResearchTargets(latin))).toEqual(keys(buildLegacyResearchTargets(latin)));
  });

  // The old normalizer erased the name entirely, which is the bug that made the
  // widening necessary: two different producers shared one empty key.
  it('no longer collapses two different non-Latin producers onto one key',()=>{
    const other={...chinese,producer:'联合丹麓酒庄'};
    expect(keys(buildLegacyResearchTargets(chinese)).producer).toBe(keys(buildLegacyResearchTargets(other)).producer);
    expect(keys(buildResearchTargets(chinese)).producer).not.toBe(keys(buildResearchTargets(other)).producer);
  });
});

describe('the sharing key reads identity, not the quality gate subject',()=>{
  it('keeps producer-scope subject free of the sharing inputs',()=>{
    const producer=buildResearchTargets(latin).find(t=>t.scope==='producer')!;
    expect(Object.keys(producer.subject).sort()).toEqual(['producer','producerId']);
    expect(producer.identity?.wineStyle).toBe('red');
    expect(sharedSubjectKey(producer)).toBe(JSON.stringify(['domaine dujac','france']));
  });

  it('still keys a vintage context on its own place and style',()=>{
    const context=buildResearchTargets(latin).find(t=>t.scope==='vintage_context')!;
    expect(context.subject.vintage).toBe(2019);
    expect(sharedSubjectKey(context)).toContain('burgundy');
  });
});
