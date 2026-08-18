import { describe,expect,it } from 'vitest';
import { normalizeProducerAlias,producerMatchKey } from '../../src/lib/producers/entities';
import { buildResearchTargets } from '../../src/lib/research/cache';

describe('producer entity normalization',()=>{
  it('normalizes punctuation, accents and ampersands deterministically',()=>{
    expect(normalizeProducerAlias("Domaine Test Père & Fils")).toBe('domaine test pere and fils');
  });

  it('treats common domaine prefixes and family suffixes as the same match key',()=>{
    expect(producerMatchKey('Domaine Dujac')).toBe('dujac');
    expect(producerMatchKey('Dujac')).toBe('dujac');
    expect(producerMatchKey('Domaine Test Père et Fils')).toBe('test');
  });

  it('keys producer research by stable producer id instead of display spelling',()=>{
    const a=buildResearchTargets({producer:'Domaine Dujac',producerId:'producer-1',wineName:'Clos de la Roche',vintage:2022,region:'Burgundy',appellation:'Clos de la Roche'});
    const b=buildResearchTargets({producer:'Dujac',producerId:'producer-1',wineName:'Clos de la Roche',vintage:2022,region:'Burgundy',appellation:'Clos de la Roche'});
    expect(a.find(x=>x.scope==='producer')?.cacheKey).toBe(b.find(x=>x.scope==='producer')?.cacheKey);
    expect(a.find(x=>x.scope==='wine_vintage')?.cacheKey).toBe(b.find(x=>x.scope==='wine_vintage')?.cacheKey);
  });
});
