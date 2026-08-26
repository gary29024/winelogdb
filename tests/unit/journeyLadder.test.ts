import { describe,expect,it } from 'vitest';
import { journeyLadder,nextMilestones } from '../../src/features/journey/model';

const summary=(over:Partial<Record<string,number>>={})=>({
  totalWines:0,producers:0,appellations:0,regions:0,countries:0,vintages:0,structuredTastings:0,
  ...over
} as Parameters<typeof journeyLadder>[0]);

describe('how far to the next stamp',()=>{
  it('measures the band you are in, not the distance from zero',()=>{
    // The reported confusion: 858 of 1000 wines showing as 72%. It is correct -
    // the stamps either side are 500 and 1000, so 358 of 500 is 72% - but the
    // caption said "858 / 1000", which reads as 86%. The band is what the ring
    // draws, so previous is exposed for the caption to say so.
    const wines=nextMilestones(summary({totalWines:858})).find(m=>m.key==='totalWines')!;
    expect({previous:wines.previous,target:wines.target}).toEqual({previous:500,target:1000});
    expect(Math.round(wines.progress*100)).toBe(72);
    expect(wines.target-wines.current).toBe(142);
  });

  it('starts the first band at zero',()=>{
    const wines=nextMilestones(summary({totalWines:4})).find(m=>m.key==='totalWines')!;
    expect(wines.previous).toBe(0);
    expect(Math.round(wines.progress*100)).toBe(40);
  });

  it('sits at the start of the band on the stamp itself',()=>{
    // Logging the 500th wine earns the stamp; it does not also count towards
    // the next one.
    const wines=nextMilestones(summary({totalWines:500})).find(m=>m.key==='totalWines')!;
    expect({previous:wines.previous,target:wines.target,progress:wines.progress}).toEqual({previous:500,target:1000,progress:0});
  });
});

describe('the stamp ladder',()=>{
  it('shows every stamp on every track, not just the earned ones',()=>{
    // The passport showed the two most recently earned stamps and nothing else,
    // so there was nowhere to see what was being collected.
    const ladder=journeyLadder(summary({totalWines:858}));
    expect(ladder.map(track=>track.key))
      .toEqual(['totalWines','producers','appellations','regions','countries','vintages','structuredTastings']);
    const wines=ladder[0];
    expect(wines.stamps.map(stamp=>stamp.value)).toEqual([10,25,50,100,200,500,1000,2000,3000,5000]);
    expect(wines.earned).toBe(6);
    expect(wines.total).toBe(10);
  });

  it('marks exactly one stamp as next',()=>{
    const wines=journeyLadder(summary({totalWines:858}))[0];
    expect(wines.stamps.filter(stamp=>stamp.next).map(stamp=>stamp.value)).toEqual([1000]);
    expect(wines.remaining).toBe(142);
  });

  it('never marks an earned stamp as next',()=>{
    const wines=journeyLadder(summary({totalWines:858}))[0];
    expect(wines.stamps.filter(stamp=>stamp.earned&&stamp.next)).toEqual([]);
  });

  it('has nothing next once a track is finished',()=>{
    // The milestone sets are finite. Inventing a further stamp would promise
    // something the app never awards.
    const wines=journeyLadder(summary({totalWines:6000}))[0];
    expect(wines.stamps.every(stamp=>stamp.earned)).toBe(true);
    expect(wines.next).toBeNull();
    expect(wines.remaining).toBe(0);
  });

  it('keeps a stamp ahead of a journal this size',()=>{
    // The reported problem: at 957 wines, 566 producers and 214 appellations
    // three tracks had collected every stamp, so the section read as finished
    // rather than as something still being collected.
    const ladder=journeyLadder(summary({totalWines:957,producers:566,appellations:214,regions:120,countries:20,vintages:45,structuredTastings:0}));
    const finished=ladder.filter(track=>track.next===null).map(track=>track.key);
    expect(finished).toEqual([]);
  });

  it('starts empty rather than broken',()=>{
    const ladder=journeyLadder(summary());
    expect(ladder.every(track=>track.earned===0)).toBe(true);
    expect(ladder[0].next?.value).toBe(10);
    expect(ladder[0].remaining).toBe(10);
  });
});
