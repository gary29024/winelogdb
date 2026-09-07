import { labelFocusPosition } from '../../lib/wine/labelFocus';
import { MAX_STORY_WINES,STORY_HEIGHT,STORY_WIDTH,captionsFit,collageLayout,starMark,type Cell } from './storyCollage';

/**
 * The card itself, drawn.
 *
 * A story is a photograph, not a web page: whatever is shared has to be one
 * flat image, so this paints the lot onto a canvas rather than screenshotting
 * markup. Keeping it apart from the arithmetic means the layout can be argued
 * with in a test and this file only has to be looked at.
 */
export type StoryWine={id:string;producer:string;wineName:string;vintage:number|null;favorite:boolean;imageId:string|null};
export type StoryCard={title:string;subtitle:string;wines:StoryWine[]};

const PAPER='#f7f3ec',INK='#141c2b',MUTED='#6d7789',WINE='#c51f45',FRAME='#ffffff';
const SERIF='"Playfair Display",Georgia,serif',SANS='"DM Sans",system-ui,sans-serif';

/** roundRect is recent enough that a phone two years old may not have it. */
function roundedPath(ctx:CanvasRenderingContext2D,x:number,y:number,width:number,height:number,radius:number){
  const r=Math.min(radius,width/2,height/2);
  ctx.beginPath();
  ctx.moveTo(x+r,y);ctx.lineTo(x+width-r,y);ctx.quadraticCurveTo(x+width,y,x+width,y+r);
  ctx.lineTo(x+width,y+height-r);ctx.quadraticCurveTo(x+width,y+height,x+width-r,y+height);
  ctx.lineTo(x+r,y+height);ctx.quadraticCurveTo(x,y+height,x,y+height-r);
  ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}

/**
 * Cover-fit, with the same downward nudge the journal thumbnails use.
 *
 * A group-photo crop is one part wide to four tall; centred in a portrait cell
 * only its shoulder shows, which is the part of a bottle with nothing written
 * on it.
 */
function drawCover(ctx:CanvasRenderingContext2D,image:CanvasImageSource,width:number,height:number,cell:Cell){
  const scale=Math.max(cell.width/width,cell.height/height);
  const drawn={width:width*scale,height:height*scale};
  const focus=labelFocusPosition(width,height)?0.72:0.5;
  const x=cell.x+(cell.width-drawn.width)/2;
  const y=cell.y+(cell.height-drawn.height)*focus;
  ctx.drawImage(image,x,y,drawn.width,drawn.height);
}

function fitText(ctx:CanvasRenderingContext2D,text:string,max:number){
  if(ctx.measureText(text).width<=max)return text;
  let cut=text;
  while(cut.length>1&&ctx.measureText(`${cut}…`).width>max)cut=cut.slice(0,-1);
  return `${cut}…`;
}

function drawStar(ctx:CanvasRenderingContext2D,x:number,y:number,size:number){
  ctx.save();
  ctx.beginPath();ctx.arc(x+size/2,y+size/2,size/2,0,Math.PI*2);
  ctx.fillStyle='#ffffffee';ctx.fill();
  ctx.fillStyle=WINE;ctx.font=`${Math.round(size*0.62)}px ${SANS}`;
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('★',x+size/2,y+size/2+size*0.04);
  ctx.restore();
}

export type LoadedPhoto={image:CanvasImageSource;width:number;height:number}|null;

/**
 * Draws the card and hands back the canvas.
 *
 * Photographs are passed in already loaded rather than fetched here: a wine may
 * have none, a fetch may fail, and neither is a reason to have no card - the
 * cell falls back to the producer's initial on a tinted ground.
 */
export function drawStoryCard(canvas:HTMLCanvasElement,card:StoryCard,photos:Map<string,LoadedPhoto>){
  const wines=card.wines.slice(0,MAX_STORY_WINES);
  canvas.width=STORY_WIDTH;canvas.height=STORY_HEIGHT;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('This browser cannot draw the story card');
  ctx.fillStyle=PAPER;ctx.fillRect(0,0,STORY_WIDTH,STORY_HEIGHT);

  ctx.textAlign='center';ctx.textBaseline='alphabetic';
  ctx.fillStyle=WINE;ctx.font=`600 30px ${SANS}`;
  ctx.fillText(fitText(ctx,card.subtitle.toUpperCase(),STORY_WIDTH-160),STORY_WIDTH/2,120);
  ctx.fillStyle=INK;ctx.font=`700 72px ${SERIF}`;
  ctx.fillText(fitText(ctx,card.title,STORY_WIDTH-140),STORY_WIDTH/2,196);

  const {cells}=collageLayout(wines.length),captions=captionsFit(wines.length);
  wines.forEach((wine,index)=>{
    const cell=cells[index];if(!cell)return;
    const photo=wine.imageId?photos.get(wine.imageId)??null:null;
    ctx.save();
    roundedPath(ctx,cell.x,cell.y,cell.width,cell.height,18);
    ctx.fillStyle=FRAME;ctx.fill();
    ctx.clip();
    if(photo)drawCover(ctx,photo.image,photo.width,photo.height,cell);
    else{
      ctx.fillStyle='#e7e2d8';ctx.fillRect(cell.x,cell.y,cell.width,cell.height);
      ctx.fillStyle=MUTED;ctx.font=`700 ${Math.round(cell.width*0.3)}px ${SERIF}`;
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText((wine.producer.trim()[0]??'W').toUpperCase(),cell.x+cell.width/2,cell.y+cell.height/2);
    }
    if(captions){
      // A gradient rather than a bar: the name has to be readable over a dark
      // bottle and a white tablecloth alike, without boxing in the photograph.
      const band=Math.min(96,cell.height*0.3),top=cell.y+cell.height-band;
      const wash=ctx.createLinearGradient(0,top,0,cell.y+cell.height);
      wash.addColorStop(0,'#0d132000');wash.addColorStop(1,'#0d1320e6');
      ctx.fillStyle=wash;ctx.fillRect(cell.x,top,cell.width,band);
      ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.fillStyle='#ffffff';
      ctx.font=`700 ${Math.round(Math.max(19,cell.width*0.062))}px ${SANS}`;
      ctx.fillText(fitText(ctx,wine.wineName,cell.width-32),cell.x+16,cell.y+cell.height-42);
      ctx.fillStyle='#ffffffc4';ctx.font=`500 ${Math.round(Math.max(16,cell.width*0.05))}px ${SANS}`;
      const line=[wine.producer,wine.vintage?String(wine.vintage):'NV'].filter(Boolean).join(' · ');
      ctx.fillText(fitText(ctx,line,cell.width-32),cell.x+16,cell.y+cell.height-16);
    }
    ctx.restore();
    if(wine.favorite){const mark=starMark(cell);drawStar(ctx,mark.x,mark.y,mark.size)}
  });

  ctx.textAlign='center';ctx.textBaseline='alphabetic';
  ctx.fillStyle=MUTED;ctx.font=`600 26px ${SANS}`;
  ctx.fillText(`${wines.length} wine${wines.length===1?'':'s'}`,STORY_WIDTH/2,STORY_HEIGHT-96);
  ctx.fillStyle=INK;ctx.font=`700 38px ${SERIF}`;
  ctx.fillText('WineLog',STORY_WIDTH/2,STORY_HEIGHT-48);
  return canvas;
}
