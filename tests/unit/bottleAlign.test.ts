import { describe,expect,it } from 'vitest';
import { alignedRect,coverRect } from '../../src/features/share/bottleAlign';
import type { BottleFrame } from '../../src/lib/images/bottleFrame';

const cell={x:100,y:200,width:300,height:450};
/** A bottle taking `width` of the frame's width, centred at `center`. */
const frame=(width:number,center=0.5,label=true):BottleFrame=>{
  const bottle={xMin:(center-width/2)*1000,yMin:120,xMax:(center+width/2)*1000,yMax:880};
  return {bottle,label:label?{xMin:bottle.xMin+10,yMin:520,xMax:bottle.xMax-10,yMax:700}:null};
};
const covers=(rect:{x:number;y:number;width:number;height:number})=>
  rect.x<=cell.x&&rect.y<=cell.y&&rect.x+rect.width>=cell.x+cell.width&&rect.y+rect.height>=cell.y+cell.height;

describe('drawing sixteen photographs as though they were taken from one place',()=>{
  it('brings every bottle to the same width, however far away it was shot',()=>{
    const widths=[0.18,0.25,0.3,0.45].map(width=>{
      const rect=alignedRect(1200,1600,cell,.5,frame(width));
      return width*rect.width/cell.width;   // the bottle, as a share of the cell
    });
    for(const width of widths)expect(width,`bottle ${width}`).toBeCloseTo(widths[0],2);
    expect(widths[0],'and big enough to be the subject of the cell').toBeGreaterThan(.5);
  });

  it('stops enlarging before a phone photograph turns to porridge',()=>{
    // A bottle shot from across the room cannot be brought all the way up
    // without magnifying it four times, which shows on a 1080-wide card. It
    // comes as far as it can and stays a little smaller than the rest.
    const rect=alignedRect(1200,1600,cell,.5,frame(.06));
    const cover=coverRect(1200,1600,cell,.5);
    expect(rect.width/cover.width).toBeCloseTo(4,5);
    expect(.06*rect.width/cell.width).toBeLessThan(.62);
  });

  it('never pulls back past the photograph, however big the bottle already is',()=>{
    // A bottle that fills its frame cannot be made smaller without showing
    // paper down the side of the cell, so it stays as it was shot.
    const wide=alignedRect(1200,1600,cell,.5,frame(.92));
    const plain=coverRect(1200,1600,cell,.5);
    expect(wide.width).toBeCloseTo(plain.width,5);
  });

  it('keeps the photograph over the whole cell, wherever the bottle stood in it',()=>{
    for(const center of [0.08,0.25,0.5,0.75,0.94])
      for(const width of [0.12,0.3,0.6])
        expect(covers(alignedRect(1200,1600,cell,.5,frame(width,center))),`${width} at ${center}`).toBe(true);
  });

  it('puts the labels of two differently shot bottles at the same height',()=>{
    const heights=[0.15,0.28,0.4].map(width=>{
      const rect=alignedRect(1200,1600,cell,.5,frame(width));
      const label=frame(width).label!;
      return rect.y+((label.yMin+label.yMax)/2000)*rect.height;
    });
    for(const height of heights)expect(height).toBeCloseTo(heights[0],1);
  });

  it('falls back to the middle of the bottle when the label could not be boxed',()=>{
    const withLabel=alignedRect(1200,1600,cell,.5,frame(.3));
    const without=alignedRect(1200,1600,cell,.5,frame(.3,.5,false));
    expect(without.width).toBeCloseTo(withLabel.width,5);
    // Not the same y - the guess is a fraction down the glass, not the label -
    // but still inside the cell rather than off the top of it.
    expect(covers(without)).toBe(true);
  });

  it('draws a photograph that was never measured exactly as it always did',()=>{
    for(const frames of [null,undefined,{bottle:null,label:null}]){
      const rect=alignedRect(1200,1600,cell,.72,frames);
      expect(rect).toEqual(coverRect(1200,1600,cell,.72));
    }
  });

  it('does not divide by a photograph of no size',()=>{
    const rect=alignedRect(0,0,cell,.5,frame(.3));
    expect(Number.isFinite(rect.width)&&Number.isFinite(rect.height)).toBe(true);
  });
});
