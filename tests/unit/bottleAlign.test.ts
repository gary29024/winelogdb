import { describe,expect,it } from 'vitest';
import { alignedPlacement,alignedRect,bottleTilt,bottleWidth,commonTilt,coverRect,measurementIsUsable,placementRect } from '../../src/features/share/bottleAlign';
import type { BottleFrame } from '../../src/lib/images/bottleFrame';

const cell={x:100,y:200,width:300,height:450};
/** A bottle taking `width` of the frame's width, centred at `center`. */
const frame=(width:number,center=0.5,label=true):BottleFrame=>{
  const bottle={xMin:(center-width/2)*1000,yMin:120,xMax:(center+width/2)*1000,yMax:880};
  return {bottle,label:label?{xMin:bottle.xMin+10,yMin:520,xMax:bottle.xMax-10,yMax:700}:null,axis:null};
};

/**
 * The same bottle - width w, height h - leaning at `tilt` degrees, as the model
 * would report it: an upright box big enough to hold the slant, and the axis
 * down the middle of the glass.
 */
const leaning=(w:number,h:number,tilt:number,center=0.5):BottleFrame=>{
  const t=tilt*Math.PI/180,cos=Math.cos(t),sin=Math.sin(t);
  // The box has to hold the slant whichever way it leans, so its sides are
  // built from magnitudes; the axis keeps the sign.
  const boxWidth=w*Math.abs(cos)+h*Math.abs(sin),boxHeight=w*Math.abs(sin)+h*Math.abs(cos);
  const midY=500;
  return {
    bottle:{xMin:(center*1000-boxWidth/2),yMin:midY-boxHeight/2,xMax:(center*1000+boxWidth/2),yMax:midY+boxHeight/2},
    label:null,
    axis:{topX:center*1000-sin*h/2,topY:midY-cos*h/2,bottomX:center*1000+sin*h/2,bottomY:midY+cos*h/2}
  };
};
const spanOf=(box:{xMin:number;xMax:number})=>(box.xMax-box.xMin)/1000;
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

  it('scales close-up bottles down to the same target width',()=>{
    const wide=alignedRect(1200,1600,cell,.5,frame(.92));
    const plain=coverRect(1200,1600,cell,.5);
    expect(wide.width).toBeLessThan(plain.width);
    expect(.92*wide.width/cell.width).toBeCloseTo(.62,5);
  });

  it('centres the subject even when it stood near the photograph edge',()=>{
    for(const center of [0.08,0.25,0.5,0.75,0.94])
      for(const width of [0.12,0.3,0.6])
        {const rect=alignedRect(1200,1600,cell,.5,frame(width,center));expect(rect.x+center*rect.width).toBeCloseTo(cell.x+cell.width/2,5)}
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
    for(const frames of [null,undefined,{bottle:null,label:null,axis:null}]){
      const rect=alignedRect(1200,1600,cell,.72,frames);
      expect(rect).toEqual(coverRect(1200,1600,cell,.72));
    }
  });

  it('does not divide by a photograph of no size',()=>{
    const rect=alignedRect(0,0,cell,.5,frame(.3));
    expect(Number.isFinite(rect.width)&&Number.isFinite(rect.height)).toBe(true);
  });
});

describe('a bottle held on a lean',()=>{
  it('is measured as the glass, not as the box the slant needs',()=>{
    // The defect this exists for: an axis-aligned box around a bottle at
    // twenty degrees is more than twice the width of the bottle, so scaling
    // boxes to a common width draws the tilted one less than half the size of
    // its upright neighbour.
    const upright=bottleWidth(leaning(60,246,0).bottle!,leaning(60,246,0).axis);
    for(const tilt of [8,15,20,25,30]){
      const shot=leaning(60,246,tilt);
      expect(bottleWidth(shot.bottle!,shot.axis),`${tilt} degrees`).toBeCloseTo(upright,2);
      expect(spanOf(shot.bottle!),`${tilt} degrees boxes wider than the glass`).toBeGreaterThan(upright);
    }
  });

  it('draws the leaning bottle the same size as the upright one',()=>{
    const widths=[0,10,20,28].map(tilt=>{
      const shot=leaning(60,246,tilt);
      return bottleWidth(shot.bottle!,shot.axis)*alignedRect(1200,1200,cell,.5,shot).width/cell.width;
    });
    for(const width of widths)expect(width).toBeCloseTo(widths[0],2);
  });

  it('leaves the photograph on its lean - only the size is made to agree',()=>{
    // Nothing here rotates: turning the bottle level would tip the room it was
    // photographed in, and a slanted table edge reads worse than a tilt.
    const rect=alignedRect(1200,1200,cell,.5,leaning(60,246,22));
    expect(Object.keys(rect).sort()).toEqual(['height','width','x','y']);
  });

  it('keeps the box when the axis is missing, absurd, or lying down',()=>{
    const shot=leaning(60,246,20);
    const box=spanOf(shot.bottle!);
    expect(bottleWidth(shot.bottle!,null)).toBeCloseTo(box,5);
    // A bottle on its side is a misread of some other object in the frame.
    expect(bottleWidth(shot.bottle!,{topX:100,topY:500,bottomX:900,bottomY:520})).toBeCloseTo(box,5);
    // And a lean past what anybody holds a bottle at is not inverted either.
    expect(bottleWidth(shot.bottle!,{topX:200,topY:200,bottomX:800,bottomY:700})).toBeCloseTo(box,5);
  });
});

const degrees=(radians:number)=>radians*180/Math.PI;

describe('settling a card on one lean',()=>{
  const at=(tilt:number)=>leaning(60,246,tilt);

  it('reads which way each bottle leans, and which way is which',()=>{
    expect(degrees(bottleTilt(at(0).axis)!)).toBeCloseTo(0,4);
    expect(degrees(bottleTilt(at(18).axis)!)).toBeCloseTo(18,4);
    expect(degrees(bottleTilt(at(-18).axis)!)).toBeCloseTo(-18,4);
    expect(bottleTilt(null),'a photograph never measured has no lean to report').toBeNull();
    expect(bottleTilt({topX:0,topY:500,bottomX:1000,bottomY:520}),'and one on its side is a misread').toBeNull();
  });

  it('takes the middle lean of the card, not vertical',()=>{
    // The whole point of the median: an evening shot at fifteen degrees
    // throughout is already consistent, and turning it upright would be
    // sixteen photographs of a tipped room for no gain.
    expect(degrees(commonTilt([at(15),at(15),at(15)])!)).toBeCloseTo(15,4);
    expect(degrees(commonTilt([at(-4),at(6),at(20)])!)).toBeCloseTo(6,4);
    expect(commonTilt([{bottle:null,label:null,axis:null},null]),'nothing measured, nothing to agree on').toBeNull();
  });

  it('brings the odd bottle out towards the rest, and leaves the rest alone',()=>{
    const lean=commonTilt([at(12),at(12),at(-6)])!;
    expect(alignedPlacement(1200,1200,cell,.5,at(12),lean).turn,'already at the card angle').toBe(0);
    const odd=alignedPlacement(1200,1200,cell,.5,at(-6),lean).turn;
    expect(degrees(odd),'canvas rotation is opposite to measured lean').toBeLessThan(0);
    expect(-6-degrees(odd)).toBeCloseTo(12,5);
  });

  it('never turns a photograph far enough to put the room on its side',()=>{
    const lean=commonTilt([at(20),at(20),at(-25)])!;
    const turn=degrees(alignedPlacement(1200,1200,cell,.5,at(-25),lean).turn);
    expect(turn,'forty-five degrees of correction is capped').toBeCloseTo(-40,4);
    // What is left of the difference stays as lean, which is the point.
    expect(-25-turn).toBeLessThanOrEqual(20);
  });

  it('leaves a lean that already agrees within half a degree untouched',()=>{
    const lean=commonTilt([at(10.8),at(11),at(11.2)])!;
    for(const tilt of [10.8,11,11.2])
      expect(alignedPlacement(1200,1200,cell,.5,at(tilt),lean).turn,`${tilt} degrees`).toBe(0);
  });

  it('turns nothing at all when a photograph was never measured, or the card has no angle',()=>{
    expect(alignedPlacement(1200,1200,cell,.5,frame(.3),commonTilt([at(20)])).turn,'no axis, no lean known').toBe(0);
    expect(alignedPlacement(1200,1200,cell,.5,at(20),null).turn,'and nothing to agree with').toBe(0);
  });

  it('still draws every bottle the same width once they have been turned',()=>{
    const lean=commonTilt([at(4),at(16),at(-10),at(24)])!;
    const widths=[4,16,-10,24].map(tilt=>{
      const shot=at(tilt);
      return bottleWidth(shot.bottle!,shot.axis)*alignedPlacement(1200,1200,cell,.5,shot,lean).width/cell.width;
    });
    for(const width of widths)expect(width).toBeCloseTo(widths[0],2);
  });
});

describe('when the measurement is wrong about the bottle',()=>{
  /** The label, as a share of the frame, on a bottle boxed at `boxWidth`. */
  const shot=(boxWidth:number,labelWidth:number,center=0.5):BottleFrame=>({
    bottle:{xMin:(center-boxWidth/2)*1000,yMin:100,xMax:(center+boxWidth/2)*1000,yMax:900},
    label:{xMin:(center-labelWidth/2)*1000,yMin:420,xMax:(center+labelWidth/2)*1000,yMax:640},
    axis:null
  });
  /** Every corner of the label, in the cell. */
  const labelCorners=(frame:BottleFrame,place=alignedPlacement(1200,1600,cell,.5,frame,null))=>{
    const label=frame.label!;
    return [label.xMin,label.xMax].flatMap(x=>[label.yMin,label.yMax]
      .map(y=>({x:place.x+x/1000*place.width,y:place.y+y/1000*place.height})));
  };

  it('never cuts the label, whatever the box claimed',()=>{
    // The reported case: a box covering only part of a bottle asks for far too
    // much magnification, and the name is sliced through.
    for(const [boxWidth,labelWidth,center] of [[.08,.30,.5],[.10,.34,.34],[.12,.40,.66],[.06,.5,.5]] as const){
      for(const corner of labelCorners(shot(boxWidth,labelWidth,center))){
        expect(Math.abs(corner.x),`box ${boxWidth} at ${center}: label off the side`).toBeLessThanOrEqual(cell.width/2+1);
        expect(Math.abs(corner.y),`box ${boxWidth} at ${center}: label off the end`).toBeLessThanOrEqual(cell.height/2+1);
      }
    }
  });

  it('uses the label centre when the bottle box is off-centre',()=>{
    // A box of a believable width whose centre is well off the bottle: the
    // width needs no correcting, so only the drop that keeps the label whole
    // is taken, and not a scrap more.
    const frame:BottleFrame={
      bottle:{xMin:180,yMin:100,xMax:520,yMax:900},
      label:{xMin:380,yMin:420,xMax:660,yMax:640},
      axis:null
    };
    const kept=alignedPlacement(1200,1600,cell,.5,frame,null);
    const cover=coverRect(1200,1600,cell,.5);
    expect(kept.width,'still enlarged past the photograph as framed').toBeGreaterThan(cover.width);
    const corners=labelCorners(frame,kept);
    expect((Math.min(...corners.map(p=>p.x))+Math.max(...corners.map(p=>p.x)))/2).toBeCloseTo(0,5);
    expect(corners.every(p=>Math.abs(p.x)<=cell.width/2&&Math.abs(p.y)<=cell.height/2)).toBe(true);
  });

  it('will not believe a bottle narrower than the label printed on it',()=>{
    // The Piccolo Derthona cell: a box over a third of its bottle asks for half
    // again too much magnification. A label cannot be wider than its bottle, so
    // the label settles it.
    const third={bottle:{xMin:420,yMin:300,xMax:530,yMax:760},label:{xMin:390,yMin:430,xMax:700,yMax:640},axis:null};
    const whole={bottle:{xMin:360,yMin:100,xMax:720,yMax:900},label:{xMin:390,yMin:430,xMax:700,yMax:640},axis:null};
    const narrow=alignedPlacement(1200,1600,cell,.5,third,null);
    const right=alignedPlacement(1200,1600,cell,.5,whole,null);
    // Not exact - the label bounds the box rather than replacing it - but a
    // fifth out instead of three times out.
    expect(narrow.width/right.width,'no longer half again too large').toBeLessThan(1.25);
  });

  it('will not believe a bottle half again wider than its label either',()=>{
    // The Alessandria cell: a box that took in the hand and the floor behind
    // it, so the bottle came out small among its neighbours.
    const wide={bottle:{xMin:120,yMin:100,xMax:900,yMax:900},label:{xMin:430,yMin:430,xMax:690,yMax:640},axis:null};
    const whole={bottle:{xMin:400,yMin:100,xMax:720,yMax:900},label:{xMin:430,yMin:430,xMax:690,yMax:640},axis:null};
    const loose=alignedPlacement(1200,1600,cell,.5,wide,null);
    const right=alignedPlacement(1200,1600,cell,.5,whole,null);
    expect(loose.width/right.width,'brought back up towards its neighbours').toBeGreaterThan(.8);
  });

  it('leaves a box that agrees with its label exactly as it was',()=>{
    const frame={bottle:{xMin:400,yMin:100,xMax:720,yMax:900},label:{xMin:430,yMin:430,xMax:690,yMax:640},axis:null};
    expect(bottleWidth(frame.bottle,null,frame.label)).toBeCloseTo(.32,5);
  });

  it('leaves a well measured bottle exactly where it was',()=>{
    // The guard must be invisible on the fourteen cells that came out right.
    const good=shot(.34,.26);
    const place=alignedPlacement(1200,1600,cell,.5,good,null);
    expect(.34*place.width/cell.width,'still brought up to the target width').toBeCloseTo(.62,2);
  });

  it('refuses a box that is the whole photograph, or a sliver of it',()=>{
    expect(measurementIsUsable({xMin:0,yMin:0,xMax:1000,yMax:1000}),'"I could not find it"').toBe(false);
    expect(measurementIsUsable({xMin:400,yMin:400,xMax:420,yMax:900}),'too thin to be a bottle held up').toBe(false);
    expect(measurementIsUsable({xMin:300,yMin:100,xMax:700,yMax:900}),'and an ordinary bottle is fine').toBe(true);
    // Refused means drawn as the photograph was framed, not magnified to fill.
    const refused=alignedPlacement(1200,1600,cell,.5,{bottle:{xMin:0,yMin:0,xMax:1000,yMax:1000},label:null,axis:null},null);
    expect(placementRect(cell,refused)).toEqual(coverRect(1200,1600,cell,.5));
  });
});
