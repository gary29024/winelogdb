import { describe,expect,it } from 'vitest';
import { researchPrimaryCooldownUntil } from '../../src/lib/research/modelHealth';

describe('research model health',()=>{
  it('uses a 15 minute primary-model cooldown window',()=>{
    const start=Date.parse('2026-08-19T09:00:00.000Z');
    expect(researchPrimaryCooldownUntil(start)).toBe('2026-08-19T09:15:00.000Z');
  });
});
