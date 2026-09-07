import type { BottleBox,BottleFrame } from '../../lib/images/bottleFrame';

/**
 * Drawing sixteen photographs as though they were taken from the same place.
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

const spanX=(box:BottleBox)=>(box.xMax-box.xMin)/1000;
const midX=(box:BottleBox)=>(box.xMin+box.xMax)/2000;
const midY=(box:BottleBox)=>(box.yMin+box.yMax)/2000;

/** Cover-fit: the photograph as it is framed, filling the cell. */
export function coverRect(imageWidth:number,imageHeight:number,cell:FitCell,focus:number):DrawRect{
  const scale=Math.max(cell.width/imageWidth,cell.height/imageHeight);
  const width=imageWidth*scale,height=imageHeight*scale;
  return {x:cell.x+(cell.width-width)/2,y:cell.y+(cell.height-height)*focus,width,height};
}

/**
 * The same, aligned on a measured bottle.
 *
 * Both offsets are clamped to the cell: however far the arithmetic would like
 * to slide the photograph to centre a bottle standing at the edge of its frame,
 * an edge of the photograph must never come inside the cell. A bottle that far
 * off-centre ends up as close to the middle as its own photograph allows.
 */
export function alignedRect(imageWidth:number,imageHeight:number,cell:FitCell,focus:number,frame?:BottleFrame|null):DrawRect{
  const bottle=frame?.bottle;
  if(!imageWidth||!imageHeight)return {x:cell.x,y:cell.y,width:cell.width,height:cell.height};
  if(!bottle||spanX(bottle)<=0)return coverRect(imageWidth,imageHeight,cell,focus);
  const cover=Math.max(cell.width/imageWidth,cell.height/imageHeight);
  const wanted=TARGET_BOTTLE*cell.width/(spanX(bottle)*imageWidth);
  const scale=Math.min(Math.max(cover,wanted),cover*MAX_ZOOM);
  const width=imageWidth*scale,height=imageHeight*scale;
  const anchorY=frame?.label?midY(frame.label):bottle.yMin/1000+(bottle.yMax-bottle.yMin)/1000*LABEL_DEPTH;
  const x=cell.x+cell.width/2-midX(bottle)*width;
  const y=cell.y+cell.height*LABEL_HEIGHT-anchorY*height;
  return {
    x:Math.min(cell.x,Math.max(cell.x+cell.width-width,x)),
    y:Math.min(cell.y,Math.max(cell.y+cell.height-height,y)),
    width,height
  };
}
