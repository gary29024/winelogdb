import type { BottleAxis,BottleBox,BottleFrame } from '../../lib/images/bottleFrame';

/**
 * Drawing sixteen photographs as though they were taken from the same place.
 *
 * And at the same angle - but the card's own angle, not vertical. Bottles are
 * held on a lean and photographed that way, and a grid where every one has been
 * stood bolt upright looks retouched; what reads as untidy is not the lean but
 * sixteen different leans. So the card picks the angle the evening was actually
 * shot at - the middle one of its own bottles - and brings the others towards
 * it, by a bounded amount, leaving the lean intact and only closing the spread.
 * A card whose bottles already agree is turned not at all.
 *
 * The photographs are not: one bottle was held at arm's length, the next closer
 * in, and on a collage that reads as a grid of unrelated snapshots. Given where
 * the bottle is in each frame, that is undone by arithmetic - every bottle is
 * scaled to the same width and every label put at the same height, so the eye
 * reads a lineup instead of sixteen different distances.
 *
 * The scale can only go up. Pulling back past cover-fit would show paper down
 * the side of a cell, so a bottle already larger than the target stays as it
 * is; in practice the photographs that need help are the distant ones.
 */
export type FitCell={x:number;y:number;width:number;height:number};
export type DrawRect={x:number;y:number;width:number;height:number};
/**
 * Where to draw the photograph, and how far to turn it.
 *
 * x and y are measured from the middle of the cell, in the frame the turn has
 * already been applied to - which is exactly what a canvas does after a
 * translate and a rotate, and saves the caller composing the transform twice.
 */
export type DrawPlacement={turn:number;x:number;y:number;width:number;height:number};

/**
 * How much of a cell's width the bottle should span.
 *
 * Measured against the look this was asked for: at 0.76 the label fills the
 * cell and the bottle it is on disappears, which is a picture of a label rather
 * than of a wine. This leaves the glass edges and some of the shoulder in
 * frame, which is what makes the row read as bottles standing side by side.
 * A tilted bottle boxes wider than its body and so lands a little smaller -
 * the safe direction to be wrong in.
 */
const TARGET_BOTTLE=0.62;
/** Where the label sits down the cell - a shade below centre, as a bottle reads. */
const LABEL_HEIGHT=0.52;
/**
 * Where the label sits down the bottle, for a photograph whose label the model
 * could not box. Burgundy carries it low, Bordeaux nearer the middle; this is
 * between them and only has to be better than the middle of the glass.
 */
const LABEL_DEPTH=0.62;
/** Past this a phone photograph starts showing its pixels on a 1080-wide card. */
const MAX_ZOOM=4;
/**
 * How far a photograph may be turned to join the rest.
 *
 * Turning the bottle turns the room behind it, so a table edge that was level
 * comes out sloping - which reads worse than the tilt did. Twelve degrees is
 * about as far as that goes unnoticed, and a bottle further out than that from
 * the card's angle keeps the remainder of its lean rather than the room being
 * put on its side for it.
 */
const MAX_TURN=12*Math.PI/180;
/** Under this the lean already agrees, and resampling the photo buys nothing. */
const TURN_DEADBAND=2.5*Math.PI/180;

const spanX=(box:BottleBox)=>(box.xMax-box.xMin)/1000;
const spanY=(box:BottleBox)=>(box.yMax-box.yMin)/1000;

/**
 * How much of the bottle's box is bottle, and how much of it is the lean.
 *
 * A box is axis-aligned and a bottle is usually held at an angle, so the box
 * has to be wide enough to contain a slanted bottle: at twenty degrees it is
 * more than twice the width of the glass. Scaling boxes to a common width
 * would then draw the tilted bottle less than half the size of an upright one -
 * which is the opposite of what this is for, and worse than never measuring.
 *
 * The photograph is not turned; only the arithmetic knows about the tilt. For a
 * rectangle w by h leaning at t, the box is (w cos t + h sin t) by
 * (w sin t + h cos t), and those two are solved back for w. Past forty degrees
 * that inversion falls apart - and nobody holds a bottle at forty degrees to be
 * photographed - so beyond it, and wherever the answer comes out absurd, the
 * box width stands as it did.
 */
const MAX_TILT=40*Math.PI/180;
/** However far it leans, the glass is never thinner than this share of its box. */
const MIN_RECOVERED=0.22;

export function bottleWidth(box:BottleBox,axis?:BottleAxis|null){
  const boxWidth=spanX(box);
  if(!axis)return boxWidth;
  const run=Math.abs(axis.bottomX-axis.topX),rise=Math.abs(axis.bottomY-axis.topY);
  if(!rise)return boxWidth;
  const tilt=Math.atan2(run,rise);
  if(tilt<0.03||tilt>MAX_TILT)return boxWidth;   // upright, or a misread
  const cos=Math.cos(tilt),sin=Math.sin(tilt),determinant=cos*cos-sin*sin;
  const recovered=(boxWidth*cos-spanY(box)*sin)/determinant;
  return recovered>boxWidth*MIN_RECOVERED&&recovered<=boxWidth?recovered:boxWidth;
}
/**
 * How far this bottle leans, signed, or null when it was never measured.
 *
 * Positive leans the way a right hand holds one - the base further right than
 * the neck - which is the same sense a canvas rotation turns in.
 */
export function bottleTilt(axis?:BottleAxis|null){
  if(!axis)return null;
  const run=axis.bottomX-axis.topX,rise=axis.bottomY-axis.topY;
  if(!rise)return null;
  // An axis handed back upside down is still the same line.
  const tilt=rise>0?Math.atan2(run,rise):Math.atan2(-run,-rise);
  return Math.abs(tilt)<=MAX_TILT?tilt:null;
}

/**
 * The angle a card should settle on: the middle lean of its own bottles.
 *
 * The median rather than the average, and rather than vertical, because it is
 * the angle that turns the fewest photographs and the least - an evening whose
 * bottles were all held at fifteen degrees is already consistent and should be
 * left alone. Photographs that were never measured have no say and are never
 * turned; they cannot be, their lean is not known.
 */
export function commonTilt(frames:Array<BottleFrame|null|undefined>){
  const tilts=frames.map(frame=>bottleTilt(frame?.axis)).filter((tilt):tilt is number=>tilt!=null).sort((a,b)=>a-b);
  if(!tilts.length)return null;
  const middle=tilts.length>>1;
  return tilts.length%2?tilts[middle]:(tilts[middle-1]+tilts[middle])/2;
}

const midX=(box:BottleBox)=>(box.xMin+box.xMax)/2000;
const midY=(box:BottleBox)=>(box.yMin+box.yMax)/2000;

/**
 * Whether a measurement is worth drawing with at all.
 *
 * The card trusts the boxes completely, so the boxes have to be refusable. A
 * box the size of the whole photograph is what "I could not find it" looks like
 * coming back, and a sliver is a misread of something else in the frame -
 * neither is a bottle somebody held up, and either would be magnified until it
 * filled a cell. Both fall back to the photograph as it was framed.
 */
const FULL_FRAME=0.97;
const MIN_BOTTLE_WIDTH=0.04,MIN_BOTTLE_HEIGHT=0.12;
export function measurementIsUsable(box:BottleBox){
  const width=spanX(box),height=spanY(box);
  if(width>=FULL_FRAME&&height>=FULL_FRAME)return false;
  return width>=MIN_BOTTLE_WIDTH&&height>=MIN_BOTTLE_HEIGHT;
}

/**
 * Is the whole label inside the cell?
 *
 * Exact rather than approximate: the label's corners are carried back out of
 * the turned frame and tested against the cell itself, because a card that
 * leans has its corners in different places than an upright one.
 */
function labelIsWhole(rect:DrawRect,turn:number,cell:FitCell,label:BottleBox){
  const cos=Math.cos(turn),sin=Math.sin(turn);
  const xs=[label.xMin,label.xMax].map(value=>rect.x+value/1000*rect.width);
  const ys=[label.yMin,label.yMax].map(value=>rect.y+value/1000*rect.height);
  for(const x of xs)for(const y of ys){
    if(Math.abs(x*cos-y*sin)>cell.width/2+0.5)return false;
    if(Math.abs(x*sin+y*cos)>cell.height/2+0.5)return false;
  }
  return true;
}

/** Cover-fit: the photograph as it is framed, filling the cell. */
export function coverRect(imageWidth:number,imageHeight:number,cell:FitCell,focus:number):DrawRect{
  const scale=Math.max(cell.width/imageWidth,cell.height/imageHeight);
  const width=imageWidth*scale,height=imageHeight*scale;
  return {x:cell.x+(cell.width-width)/2,y:cell.y+(cell.height-height)*focus,width,height};
}

/**
 * The same, aligned on a measured bottle.
 *
 * Every offset is clamped to the cell: however far the arithmetic would like to
 * slide or turn the photograph to bring a bottle standing at the edge of its
 * frame into the middle, an edge of the photograph must never come inside the
 * cell. A bottle that far off-centre ends up as close to the middle as its own
 * photograph allows.
 *
 * Coverage outranks the zoom cap. A turned photograph has to be a little larger
 * to keep its corners out of shot, and a soft bottle beats a triangle of blank
 * canvas in the corner of a card.
 */
export function alignedPlacement(imageWidth:number,imageHeight:number,cell:FitCell,focus:number,frame?:BottleFrame|null,lean?:number|null):DrawPlacement{
  const centred=(rect:DrawRect,turn=0):DrawPlacement=>
    ({turn,x:rect.x-(cell.x+cell.width/2),y:rect.y-(cell.y+cell.height/2),width:rect.width,height:rect.height});
  const bottle=frame?.bottle;
  if(!imageWidth||!imageHeight)return centred({x:cell.x,y:cell.y,width:cell.width,height:cell.height});
  if(!bottle||!measurementIsUsable(bottle))return centred(coverRect(imageWidth,imageHeight,cell,focus));

  const tilt=bottleTilt(frame?.axis);
  const wanted=lean==null||tilt==null?0:lean-tilt;
  const turn=Math.abs(wanted)<TURN_DEADBAND?0:Math.min(MAX_TURN,Math.max(-MAX_TURN,wanted));

  // The cell, seen from the turned photograph: what it has to cover.
  const cos=Math.cos(turn),sin=Math.sin(turn);
  const needWidth=cell.width*Math.abs(cos)+cell.height*Math.abs(sin);
  const needHeight=cell.width*Math.abs(sin)+cell.height*Math.abs(cos);

  const cover=Math.max(cell.width/imageWidth,cell.height/imageHeight);
  const sized=TARGET_BOTTLE*cell.width/(bottleWidth(bottle,frame?.axis)*imageWidth);
  const floor=Math.max(cover,needWidth/imageWidth,needHeight/imageHeight);
  const ceiling=Math.max(Math.min(Math.max(cover,sized),cover*MAX_ZOOM),floor);

  // Where the bottle should land, carried into the turned frame.
  const anchorY=frame?.label?midY(frame.label):bottle.yMin/1000+(bottle.yMax-bottle.yMin)/1000*LABEL_DEPTH;
  const targetY=cell.height*(LABEL_HEIGHT-0.5);
  const at=(scale:number):DrawRect=>{
    const width=imageWidth*scale,height=imageHeight*scale;
    return {
      x:Math.min(-needWidth/2,Math.max(needWidth/2-width,targetY*sin-midX(bottle)*width)),
      y:Math.min(-needHeight/2,Math.max(needHeight/2-height,targetY*cos-anchorY*height)),
      width,height
    };
  };

  /**
   * The largest scale that still shows all of the label.
   *
   * A box that covered only part of a bottle asks for too much magnification
   * and puts its centre in the wrong place, and the card then cuts the label in
   * half - which is the one thing a wine photograph must not do. Rather than
   * trusting the box, the zoom comes down until the label is whole again: a
   * bottle drawn a little small next to its neighbours is a blemish, a bottle
   * whose name is sliced through is a ruined card.
   *
   * Bisection because the placement clamps as it scales, so there is no tidy
   * expression to solve; twelve halvings settle it to well under a pixel.
   */
  let scale=ceiling;
  if(frame?.label&&!labelIsWhole(at(ceiling),turn,cell,frame.label)){
    let low=floor,high=ceiling;
    if(labelIsWhole(at(low),turn,cell,frame.label)){
      for(let step=0;step<12;step++){
        const middle=(low+high)/2;
        if(labelIsWhole(at(middle),turn,cell,frame.label))low=middle;else high=middle;
      }
    }
    // If even the smallest allowed drawing cuts it, the label is bigger than
    // the cell and nothing here can help; the photograph is used as framed.
    scale=low;
  }
  return {turn,...at(scale)};
}

/** The placement as a plain rectangle. Only meaningful while nothing is turned. */
export const placementRect=(cell:FitCell,placement:DrawPlacement):DrawRect=>
  ({x:cell.x+cell.width/2+placement.x,y:cell.y+cell.height/2+placement.y,width:placement.width,height:placement.height});

/** The unturned case, kept for callers that have no card to agree with. */
export const alignedRect=(imageWidth:number,imageHeight:number,cell:FitCell,focus:number,frame?:BottleFrame|null):DrawRect=>
  placementRect(cell,alignedPlacement(imageWidth,imageHeight,cell,focus,frame,null));
