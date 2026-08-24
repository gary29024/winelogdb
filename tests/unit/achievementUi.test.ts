import { describe,expect,it } from 'vitest';
import { AchievementIcon } from '../../src/features/achievements/AchievementIcon';
import { achievementDefinitions } from '../../src/features/achievements/definitions';
import type { AchievementIconKey } from '../../src/features/achievements/types';

const supportedIcons:AchievementIconKey[]=['first-growth','judgment-paris','beaujolais-crus','bordeaux-classification','sauternes','graves','saint-emilion','burgundy-grand-cru','gevrey-grand-cru','rhone-crus','michelin-grapes'];

describe('achievement collection UI',()=>{
  it('has a custom SVG renderer for every launch collection icon',()=>{
    const used=[...new Set(achievementDefinitions.map(item=>item.icon))];
    expect(used.every(icon=>supportedIcons.includes(icon))).toBe(true);
    for(const icon of supportedIcons)expect(AchievementIcon({kind:icon})).toBeTruthy();
  });
});
