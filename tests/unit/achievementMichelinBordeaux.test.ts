import { describe,expect,it } from 'vitest';
import { achievementDefinitions,getAchievementDefinition } from '../../src/features/achievements/definitions';

describe('2026 Bordeaux MICHELIN Grape achievements',()=>{
  it('registers all four frozen Bordeaux tiers with the published estate counts',()=>{
    expect(getAchievementDefinition('michelin-grapes-bordeaux-2026-three')?.items).toHaveLength(9);
    expect(getAchievementDefinition('michelin-grapes-bordeaux-2026-two')?.items).toHaveLength(16);
    expect(getAchievementDefinition('michelin-grapes-bordeaux-2026-one')?.items).toHaveLength(37);
    expect(getAchievementDefinition('michelin-grapes-bordeaux-2026-selected')?.items).toHaveLength(21);
  });

  it('keeps MICHELIN collections grouped with their wine region',()=>{
    const ids=achievementDefinitions.map(item=>item.id);
    expect(ids.indexOf('pomerol-benchmark-estates')).toBeLessThan(ids.indexOf('michelin-grapes-bordeaux-2026-three'));
    expect(ids.indexOf('michelin-grapes-bordeaux-2026-selected')).toBeLessThan(ids.indexOf('judgment-of-paris-1976'));
    expect(ids.indexOf('gevrey-nine-grand-crus')).toBeLessThan(ids.indexOf('michelin-grapes-burgundy-2026-three'));
    expect(ids.indexOf('michelin-grapes-burgundy-2026-selected')).toBeLessThan(ids.indexOf('beaujolais-ten-crus'));
  });

  it('uses producer selectors so existing tasting history is counted retroactively',()=>{
    const lafite=getAchievementDefinition('michelin-grapes-bordeaux-2026-three')?.items.find(item=>item.label==='Château Lafite Rothschild');
    expect(lafite?.selector.type).toBe('producer');
    expect(lafite && 'producerNames' in lafite.selector ? lafite.selector.producerNames : []).toContain('Chateau Lafite Rothschild');
  });
});
