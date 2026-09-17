import { describe,expect,it } from 'vitest';
import { isResearchStale,RESEARCH_STALE_DAYS } from '../../src/lib/research/freshness';
import { PROFILE_FRESH_DAYS,profileIsFresh } from '../../src/lib/producers/batchResearch';

const day=24*60*60*1000;
const now=Date.parse('2026-09-11T00:00:00.000Z');

describe('durable research freshness',()=>{
  it('uses one 365-day threshold for refresh policy and UI warnings',()=>{
    expect(RESEARCH_STALE_DAYS).toBe(365);
    expect(PROFILE_FRESH_DAYS).toBe(RESEARCH_STALE_DAYS);
  });

  it('marks old saved research stale without treating missing data as an old result',()=>{
    expect(isResearchStale(new Date(now-(RESEARCH_STALE_DAYS-1)*day).toISOString(),now)).toBe(false);
    expect(isResearchStale(new Date(now-RESEARCH_STALE_DAYS*day).toISOString(),now)).toBe(true);
    expect(isResearchStale(null,now)).toBe(false);
    expect(isResearchStale('not-a-date',now)).toBe(false);
  });

  it('refreshes a producer profile at the same boundary while keeping the saved fields available',()=>{
    const profile={profile:'Saved producer research',home_country:'France',profile_researched_at:new Date(now-RESEARCH_STALE_DAYS*day).toISOString()};
    expect(profile.profile).toBe('Saved producer research');
    expect(profileIsFresh(profile,now)).toBe(false);
  });
});
