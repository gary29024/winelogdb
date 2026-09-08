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

const MARGIN=56;
const GAP=16;
/**
 * Room for the title above and the wordmark below.
 *
 * Kept deliberately tight. Instagram shows the card in a nine-by-sixteen frame
 * with nothing around it, so every band left empty here is empty on the phone,
 * and generous margins that read as composure on a web page read as a photo
 * that failed to load.
 */
export type StoryHeader={title:boolean;subtitle:boolean};
const FULL_HEADER:StoryHeader={title:true,subtitle:true};
/** Reserve only the header lines actually drawn, plus the outer margin. */
export function storyHeaderHeight(header:StoryHeader){
  return MARGIN+(header.title?70:0)+(header.subtitle?70:0);
}
const FOOT=96;

/**
 * A cell is portrait, always, because a bottle photograph is - but how portrait
 * is allowed to move, so the grid fills the card.
 *
 * A single fixed ratio was the first attempt and it left a band of paper above
 * and below almost every count: four wines in two columns want cells slightly
 * taller than four-by-three, and holding them to it wasted 270px of a 1920px
 * card. So the ratio is a range: the cells take whatever height the card has
 * left, up to the point where a bottle would start to look stretched.
 */
const MIN_ASPECT=1.2;
const MAX_ASPECT=1.7;

/** Past four columns a producer's name gives out at story size. */
const MAX_COLUMNS=4;

/** The cell a given number of columns would produce, once it is made to fit. */
function fittedCell(count:number,columns:number,head:number){
  const rows=Math.ceil(count/columns);
  const areaWidth=STORY_WIDTH-MARGIN*2,areaHeight=STORY_HEIGHT-head-FOOT;
  const widest=(areaWidth-GAP*(columns-1))/columns,tallest=(areaHeight-GAP*(rows-1))/rows;
  let width=widest,height=Math.min(Math.max(tallest,widest*MIN_ASPECT),widest*MAX_ASPECT);
  // Only when even the squarest allowed cell is too tall for the card does the
  // block come down together, rather than the cells losing their shape.
  if(height>tallest){width*=tallest/height;height=tallest}
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
export function collageColumns(count:number,header:StoryHeader=FULL_HEADER){
  const head=storyHeaderHeight(header);
  const total=Math.max(1,Math.min(Math.floor(count)||1,MAX_STORY_WINES));
  let best=fittedCell(total,1,head);
  for(let columns=2;columns<=Math.min(MAX_COLUMNS,total);columns++){
    const candidate=fittedCell(total,columns,head);
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
export function collageLayout(count:number,header:StoryHeader=FULL_HEADER):CollageLayout{
  const head=storyHeaderHeight(header);
  const total=Math.max(1,Math.min(Math.floor(count)||1,MAX_STORY_WINES));
  const {columns,rows,width,height}=fittedCell(total,collageColumns(total,header),head);
  const areaWidth=STORY_WIDTH-MARGIN*2,areaHeight=STORY_HEIGHT-head-FOOT;
  const top=head+(areaHeight-(rows*height+GAP*(rows-1)))/2;
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
 * Which wines a card starts with when more were picked than fit.
 *
 * Favourites first, because a card that marks favourites and then drops one for
 * a bottle nobody starred has its priorities backwards - and because the
 * sixteen a long evening leaves you with are rarely the first sixteen poured.
 * The order on the card is still the order they came in: this chooses, it does
 * not sort.
 */
export function pickStoryWines(wines:Array<{favorite:boolean}>,limit=MAX_STORY_WINES){
  const indexes=wines.map((wine,index)=>({index,favorite:wine.favorite}));
  const chosen=[...indexes.filter(item=>item.favorite),...indexes.filter(item=>!item.favorite)].slice(0,limit);
  return chosen.map(item=>item.index).sort((a,b)=>a-b);
}
