import { describe,expect,it } from 'vitest';
import { normalizeProducerAlias,producerMatchKey } from '../../src/lib/producers/entities';
import { buildResearchTargets } from '../../src/lib/research/cache';

describe('producer entity normalization',()=>{
  it('normalizes punctuation, accents and ampersands deterministically',()=>{
    expect(normalizeProducerAlias("Domaine Test Père & Fils")).toBe('domaine test pere and fils');
  });

  it('keeps potentially distinguishing producer words in automatic match keys',()=>{
    expect(producerMatchKey('Domaine Dujac')).toBe('domaine dujac');
    expect(producerMatchKey('Dujac')).toBe('dujac');
    expect(producerMatchKey('Domaine Test Père et Fils')).toBe('domaine test pere et fils');
    expect(producerMatchKey('Domaine Test')).not.toBe(producerMatchKey('Domaine Test Père et Fils'));
  });

  it('keys producer research by stable producer id instead of display spelling',()=>{
    const a=buildResearchTargets({producer:'Domaine Dujac',producerId:'producer-1',wineName:'Clos de la Roche',vintage:2022,region:'Burgundy',appellation:'Clos de la Roche'});
    const b=buildResearchTargets({producer:'Dujac',producerId:'producer-1',wineName:'Clos de la Roche',vintage:2022,region:'Burgundy',appellation:'Clos de la Roche'});
    expect(a.find(x=>x.scope==='producer')?.cacheKey).toBe(b.find(x=>x.scope==='producer')?.cacheKey);
    expect(a.find(x=>x.scope==='wine_vintage')?.cacheKey).toBe(b.find(x=>x.scope==='wine_vintage')?.cacheKey);
  });
});
