import { describe,expect,it } from 'vitest';
import { compositionShares,foldToOther,OTHER_TONE,SERIES_TONES,withSeriesTones } from '../../src/lib/ui/composition';

const entry=(key:string,count:number)=>({key,label:key,count,tone:'series-1'});

describe('composition shares',()=>{
  it('always sums to exactly 100, which is what lets a stacked bar close',()=>{
    // Three equal thirds is the case that breaks naive rounding: 33+33+33 is 99,
    // so the track shows a sliver of empty rail at its right-hand end.
    const thirds=compositionShares([entry('a',1),entry('b',1),entry('c',1)]);
    expect(thirds.map(item=>item.percent)).toEqual([34,33,33]);
    expect(thirds.reduce((sum,item)=>sum+item.percent,0)).toBe(100);
  });

  it('sums to 100 across a spread of awkward splits',()=>{
    const splits=[[1,1,1],[1,1,1,1,1,1,1],[2,3,5,7,11],[1,2],[99,1],[1,1,1,1,1,1]];
    for(const counts of splits){
      const shares=compositionShares(counts.map((count,index)=>entry(String(index),count)));
      expect(shares.reduce((sum,item)=>sum+item.percent,0),`counts ${counts.join('+')}`).toBe(100);
    }
  });

  it('gives the leftover points to whoever lost most to rounding',()=>{
    // 7 of 12 is 58.33 and 5 of 12 is 41.66, so the spare point belongs to the
    // second entry, not to whichever happens to be first.
    const shares=compositionShares([entry('big',7),entry('small',5)]);
    expect(shares.map(item=>item.percent)).toEqual([58,42]);
  });

  it('never inflates an empty entry to keep the row full',()=>{
    // A tier with no wines drawing 1% of the bar is a lie about the range, and
    // it is the exact shape a naive largest-remainder pass produces.
    const shares=compositionShares([entry('a',1),entry('b',1),entry('c',1),entry('empty',0)]);
    expect(shares.find(item=>item.key==='empty')!.percent).toBe(0);
    expect(shares.reduce((sum,item)=>sum+item.percent,0)).toBe(100);
  });

  it('reports nothing rather than dividing by zero when nothing was counted',()=>{
    const shares=compositionShares([entry('a',0),entry('b',0)]);
    expect(shares.map(item=>item.percent)).toEqual([0,0]);
  });

  it('treats a negative or nonsense count as nothing',()=>{
    const shares=compositionShares([entry('good',3),entry('bad',-4),{...entry('worse',0),count:Number.NaN}]);
    expect(shares.find(item=>item.key==='good')!.percent).toBe(100);
    expect(shares.find(item=>item.key==='bad')!.percent).toBe(0);
    expect(shares.find(item=>item.key==='worse')!.percent).toBe(0);
  });

  it('keeps the caller’s order, so a filter cannot repaint the survivors',()=>{
    // Colour follows the entity. If shares came back sorted, hiding one village
    // would hand its hue to a different village and every other segment would
    // change colour for a reason that has nothing to do with the data.
    const shares=compositionShares([entry('z',1),entry('a',9)]);
    expect(shares.map(item=>item.key)).toEqual(['z','a']);
  });
});

describe('folding a long tail',()=>{
  it('keeps the largest entries and folds the rest into one row',()=>{
    const folded=foldToOther([entry('a',5),entry('b',4),entry('c',3),entry('d',2),entry('e',1)],3,OTHER_TONE);
    expect(folded.map(item=>item.key)).toEqual(['a','b','c','__other']);
    expect(folded.at(-1)).toMatchObject({count:3,label:'Other',tone:OTHER_TONE});
  });

  it('leaves a short list alone rather than adding an empty Other',()=>{
    const folded=foldToOther([entry('a',2),entry('b',1)],5,OTHER_TONE);
    expect(folded.map(item=>item.key)).toEqual(['a','b']);
  });

  it('drops the fold when the tail is all empty',()=>{
    const folded=foldToOther([entry('a',2),entry('b',0),entry('c',0)],1,OTHER_TONE);
    expect(folded.map(item=>item.key)).toEqual(['a']);
  });

  it('puts the fold last even though it may outweigh a named entry',()=>{
    // Other is not a village, so it does not compete for position with one.
    const folded=foldToOther([entry('a',5),entry('b',4),entry('c',4)],1,OTHER_TONE);
    expect(folded.map(item=>item.key)).toEqual(['a','__other']);
    expect(folded.at(-1)!.count).toBe(8);
  });
});

describe('categorical slots',()=>{
  it('assigns the fixed order in sequence and never cycles it',()=>{
    const toned=withSeriesTones([1,2,3,4,5,6,7].map((n)=>({key:`k${n}`,label:`k${n}`,count:n})));
    expect(toned.slice(0,5).map(item=>item.tone)).toEqual(SERIES_TONES);
    // Past the documented slots the answer is the neutral, never slot 1 again:
    // a repeated hue claims two different entities are the same one.
    expect(toned.slice(5).map(item=>item.tone)).toEqual([OTHER_TONE,OTHER_TONE]);
  });
});
