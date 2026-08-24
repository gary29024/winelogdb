import { describe,expect,it } from 'vitest';
import { backoffDelay } from '../../src/lib/polling/backoff';

describe('background research poll backoff',()=>{
  it('stays responsive on the first checks and then widens',()=>{
    expect(backoffDelay(0)).toBe(2000);
    expect(backoffDelay(1)).toBe(3000);
    expect(backoffDelay(2)).toBe(4500);
    expect(backoffDelay(20)).toBe(15000);
  });

  it('never exceeds the configured ceiling',()=>{
    for(let attempt=0;attempt<40;attempt++)expect(backoffDelay(attempt,{initialMs:10000,maxMs:30000})).toBeLessThanOrEqual(30000);
  });

  it('polls a ten-minute run far fewer times than a flat two-second interval',()=>{
    let elapsed=0,polls=0;
    while(elapsed<10*60*1000){elapsed+=backoffDelay(polls);polls++}
    expect(polls).toBeLessThan(60);
    expect(polls).toBeLessThan(10*60*1000/2000);
  });
});
