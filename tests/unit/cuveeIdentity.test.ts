import { describe,expect,it } from 'vitest';
import { cuveeSignature,normalizeCuveeAlias,stripKnownProducerPrefix } from '../../src/lib/cuvees/entities';
import { buildResearchTargets } from '../../src/lib/research/cache';

describe('cuvee identity',()=>{
  it('normalizes the same Maltroye cuvee across vintage identification wording',()=>{
    const a=cuveeSignature('Chassagne-Montrachet 1er Cru Clos du Chateau de la Maltroye Monopole','Chassagne-Montrachet Premier Cru');
    const b=cuveeSignature('Clos du Château de la Maltroye Chassagne-Montrachet Premier Cru','Chassagne-Montrachet Premier Cru');
    expect(a).toBe(b);
  });

  it('normalizes 1er Cru and Premier Cru without broad fuzzy matching',()=>{
    expect(normalizeCuveeAlias('Vosne-Romanée 1er Cru Les Suchots')).toBe(normalizeCuveeAlias('Vosne-Romanée Premier Cru Les Suchots'));
    expect(cuveeSignature('Vosne-Romanée 1er Cru Les Suchots','Vosne-Romanée Premier Cru')).not.toBe(cuveeSignature('Vosne-Romanée 1er Cru Les Beaux Monts','Vosne-Romanée Premier Cru'));
  });

  it('removes only an exact known producer prefix',()=>{
    expect(stripKnownProducerPrefix('Domaine Dujac Clos de la Roche',['Domaine Dujac','Dujac'])).toBe('Clos de la Roche');
    expect(stripKnownProducerPrefix('Dujac Clos de la Roche',['Domaine Dujac','Dujac'])).toBe('Clos de la Roche');
    expect(stripKnownProducerPrefix('Clos de la Roche',['Domaine Dujac','Dujac'])).toBe('Clos de la Roche');
  });

  it('keeps Deep Search keys stable when the display spelling changes for one cuvee ID',()=>{
    const first=buildResearchTargets({producer:'Domaine Test',producerId:'producer-1',cuveeId:'cuvee-1',wineName:'Clos du Château 1er Cru',vintage:2020,appellation:'Test Premier Cru',region:'Burgundy',country:'France'});
    const second=buildResearchTargets({producer:'Domaine Test',producerId:'producer-1',cuveeId:'cuvee-1',wineName:'Test Premier Cru Clos du Chateau Monopole',vintage:2020,appellation:'Test Premier Cru',region:'Burgundy',country:'France'});
    expect(first.find(x=>x.scope==='terroir')?.cacheKey).toBe(second.find(x=>x.scope==='terroir')?.cacheKey);
    expect(first.find(x=>x.scope==='wine_vintage')?.cacheKey).toBe(second.find(x=>x.scope==='wine_vintage')?.cacheKey);
  });
});
