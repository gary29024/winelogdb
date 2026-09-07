/**
 * Where each bottle sits on a story card.
 *
 * Pure, and its own module, because the arithmetic is the whole of the design:
 * a phone story is 1080 by 1920, the photographs are portrait, and the grid has
 * to hold anywhere from one bottle to sixteen without ever looking like a
 * spreadsheet. Everything that needs a canvas - the images, the type, the
 * rounded corners - is somebody else's problem.
 */
export const STORY_WIDTH=1080;
export const STORY_HEIGHT=1920;
/** Sixteen is where a bottle stops being recognisable at story size. */
export const MAX_STORY_WINES=16;

export type Cell={x:number;y:number;width:number;height:number};
export type CollageLayout={columns:number;rows:number;cells:Cell[]};

const MARGIN=64;
const GAP=18;
/** Room for the title above and the wordmark below, so neither crowds the grid. */
const HEAD=250;
const FOOT=132;

/**
 * A cell is portrait, always, because a bottle photograph is.
 *
 * The grid is not stretched to fill the card: cells keep this shape and the
 * block they make is centred in what is left between the title and the
 * wordmark. Stretching was the first attempt and it put two wines in a pair of
 * landscape boxes, which crops a bottle through the middle.
 */
const CELL_ASPECT=4/3;

/** Past four columns a producer's name gives out at story size. */
const MAX_COLUMNS=4;

/** The cell a given number of columns would produce, once it is made to fit. */
function fittedCell(count:number,columns:number){
  const rows=Math.ceil(count/columns);
  const areaWidth=STORY_WIDTH-MARGIN*2,areaHeight=STORY_HEIGHT-HEAD-FOOT;
  let width=(areaWidth-GAP*(columns-1))/columns,height=width*CELL_ASPECT;
  const block=rows*height+GAP*(rows-1);
  // Tall grids run out of card before they run out of width, so the whole block
  // comes down together rather than the cells losing their shape.
  if(block>areaHeight){const scale=areaHeight/block;width*=scale;height*=scale}
  return {columns,rows,width,height};
}

/**
 * Columns for a given count: whichever makes the photographs biggest.
 *
 * Hand-picked numbers were wrong twice in a row. A story is nine by sixteen and
 * the cells are portrait, so the answer is not the one that looks tidy written
 * down - five wines fit better as two columns of three, where the grid fills
 * the card, than as three columns of two, where it floats in the middle with a
 * third of the height empty and smaller pictures besides. So it is measured
 * rather than decided: every column count up to four is laid out, and the one
 * with the largest cell wins.
 */
export function collageColumns(count:number){
  const total=Math.max(1,Math.min(Math.floor(count)||1,MAX_STORY_WINES));
  let best=fittedCell(total,1);
  for(let columns=2;columns<=Math.min(MAX_COLUMNS,total);columns++){
    const candidate=fittedCell(total,columns);
    if(candidate.width*candidate.height>best.width*best.height)best=candidate;
  }
  return best.columns;
}

/**
 * The grid, with a short last row centred rather than left-aligned.
 *
 * Five wines in a three-by-two leaves two cells over, and hanging them under
 * the left columns reads as a mistake. Centred, it reads as the end of a list.
 */
export function collageLayout(count:number):CollageLayout{
  const total=Math.max(1,Math.min(Math.floor(count)||1,MAX_STORY_WINES));
  const {columns,rows,width,height}=fittedCell(total,collageColumns(total));
  const areaWidth=STORY_WIDTH-MARGIN*2,areaHeight=STORY_HEIGHT-HEAD-FOOT;
  const top=HEAD+(areaHeight-(rows*height+GAP*(rows-1)))/2;
  const cells:Cell[]=[];
  for(let index=0;index<total;index++){
    const row=Math.floor(index/columns),column=index%columns;
    const inRow=Math.min(columns,total-row*columns);
    const rowWidth=inRow*width+GAP*(inRow-1),left=MARGIN+(areaWidth-rowWidth)/2;
    cells.push({x:left+column*(width+GAP),y:top+row*(height+GAP),width,height});
  }
  return {columns,rows,cells};
}

/** The favourite mark, in the corner of its own photograph. */
export function starMark(cell:Cell){
  const size=Math.max(30,Math.min(58,cell.width*0.16)),inset=Math.max(10,size*0.34);
  return {size,x:cell.x+cell.width-inset-size,y:cell.y+inset};
}

/**
 * What a card can say about each bottle without becoming unreadable.
 *
 * Sixteen captions at story size is a wall of five-point type, so past nine the
 * photographs speak for themselves and the names go with the wines they belong
 * to rather than being shrunk until nobody reads them.
 */
export const captionsFit=(count:number)=>count<=9;
