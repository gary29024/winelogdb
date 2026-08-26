import { describe,expect,it } from 'vitest';
import { campaignOutcomeLine } from '../../src/features/producers/campaignCopy';

const counts=(over:Partial<Record<string,number>>={})=>({pending:0,running:0,complete:0,failed:0,skipped:0,...over});

describe('how a past batch run reads in the list',()=>{
  it('leads with what it researched',()=>{
    expect(campaignOutcomeLine(counts({complete:23,failed:2}))).toBe('23 researched · 2 failed');
    expect(campaignOutcomeLine(counts({complete:10}))).toBe('10 researched');
  });

  it('says what is still to go while a run is live',()=>{
    expect(campaignOutcomeLine(counts({complete:4,running:2,pending:19}))).toBe('4 researched · 21 still to go');
  });

  it('mentions skipped producers, which are not failures',()=>{
    // A producer merged away mid-run is skipped, not failed - the batch did
    // nothing wrong and nothing is owed.
    expect(campaignOutcomeLine(counts({complete:9,skipped:1}))).toBe('9 researched · 1 skipped');
  });

  it('says something rather than nothing for an empty run',()=>{
    expect(campaignOutcomeLine(counts())).toBe('Nothing to do');
  });
});
