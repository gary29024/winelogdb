import { describe,expect,it } from 'vitest';
import { labelFocusPosition } from '../../src/lib/wine/labelFocus';

describe('where a bottle thumbnail looks',()=>{
  it('nudges a group photo crop down onto the label',()=>{
    // The crop measured off the reported photo: 141x531, about one part wide to
    // four tall. Centred, a cover thumbnail of that shows the shoulder.
    expect(labelFocusPosition(141,531)).toBe('center 72%');
  });

  it('leaves a photo somebody framed themselves alone',()=>{
    // A person choosing what to photograph has already decided what matters.
    // Only shapes no camera produces get moved.
    expect(labelFocusPosition(3024,4032)).toBeUndefined();   // 3:4
    expect(labelFocusPosition(1080,1920)).toBeUndefined();   // 16:9 phone portrait
    expect(labelFocusPosition(1600,1200)).toBeUndefined();   // landscape
    expect(labelFocusPosition(1000,1000)).toBeUndefined();   // square
  });

  it('leaves the old squared crops centred',()=>{
    // Wines saved before the crop changed carry a square image holding the
    // whole scene. Nudging that down would show the table.
    expect(labelFocusPosition(531,531)).toBeUndefined();
  });

  it('draws the line past what a camera can produce',()=>{
    // 2.2:1 is beyond a 16:9 portrait, so nothing but a deliberate crop reaches
    // it - the threshold does not depend on guessing a bottle's proportions.
    expect(labelFocusPosition(100,219)).toBeUndefined();
    expect(labelFocusPosition(100,220)).toBe('center 72%');
  });

  it('says nothing when it has not been told the shape',()=>{
    // naturalWidth is 0 until an image decodes, and a broken one never reports.
    expect(labelFocusPosition(0,0)).toBeUndefined();
    expect(labelFocusPosition(undefined,undefined)).toBeUndefined();
    expect(labelFocusPosition(141,0)).toBeUndefined();
    expect(labelFocusPosition(-141,-531)).toBeUndefined();
  });
});
