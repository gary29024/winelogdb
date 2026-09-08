import { describe,expect,it } from 'vitest';
import { drawStoryCard } from '../../src/features/share/renderStoryCollage';
import { collageLayout } from '../../src/features/share/storyCollage';

function render(width:number,blur:'supported'|'missing'|'ignored'='supported'){
  type Draw={args:unknown[];alpha:number;filter:unknown;clipped:boolean};
  const draws:Draw[]=[],fills:Array<{color:unknown;clipped:boolean}>=[];
  const stack:Array<{alpha:number;filter:unknown;clipped:boolean}>=[];
  let clipped=false,filter='none';
  const noop=()=>undefined;
  const ctx={
    globalAlpha:1,fillStyle:'',
    save(){stack.push({alpha:this.globalAlpha,filter,clipped})},
    restore(){const state=stack.pop()!;this.globalAlpha=state.alpha;filter=String(state.filter);clipped=state.clipped},
    clip(){clipped=true},fill(){fills.push({color:this.fillStyle,clipped})},
    drawImage(...args:unknown[]){draws.push({args,alpha:this.globalAlpha,filter,clipped})},
    beginPath:noop,moveTo:noop,lineTo:noop,quadraticCurveTo:noop,closePath:noop,
    fillRect:noop,fillText:noop,translate:noop,rotate:noop,measureText:()=>({width:1})
  };
  if(blur!=='missing')Object.defineProperty(ctx,'filter',{get:()=>filter,set:(value:string)=>{if(blur==='supported')filter=value}});
  const canvas={getContext:()=>ctx} as unknown as HTMLCanvasElement;
  const photo={image:{} as CanvasImageSource,width:1200,height:1600};
  drawStoryCard(canvas,{title:'Evening',subtitle:'Today',wines:[{id:'1',imageId:'1',producer:'P',wineName:'W',vintage:2020,favorite:false}]},
    new Map([['1',photo]]),new Map([['1',{
      bottle:{xMin:500-width*500,xMax:500+width*500,yMin:100,yMax:900},
      label:{xMin:500-width*400,xMax:500+width*400,yMin:450,yMax:550},axis:null
    }]]));
  return {draws,fills,cell:collageLayout(1).cells[0]};
}

describe('story cell background coverage belongs to the renderer',()=>{
  it('draws one blurred cover behind a close-up that scales below cell width',()=>{
    const {draws,cell}=render(.8);
    expect(draws).toHaveLength(2);
    const [background,foreground]=draws;
    expect(background).toMatchObject({alpha:.45,filter:'blur(16px)',clipped:true});
    const [,x,y,width,height]=background.args as [unknown,number,number,number,number];
    expect(x).toBeLessThanOrEqual(cell.x);expect(y).toBeLessThanOrEqual(cell.y);
    expect(x+width).toBeGreaterThanOrEqual(cell.x+cell.width);
    expect(y+height).toBeGreaterThanOrEqual(cell.y+cell.height);
    expect(foreground).toMatchObject({alpha:1,filter:'none',clipped:true});
    expect(Number(foreground.args[3])).toBeLessThan(cell.width);
  });

  it('does not draw a redundant background when the foreground covers the cell',()=>{
    const {draws}=render(.2);
    expect(draws).toHaveLength(1);
    expect(draws[0]).toMatchObject({alpha:1,filter:'none',clipped:true});
  });

  it.each(['missing','ignored'] as const)('uses neutral fill instead of a sharp duplicate when blur is %s',mode=>{
    const {draws,fills}=render(.8,mode);
    expect(draws).toHaveLength(1);
    expect(draws[0]).toMatchObject({alpha:1,filter:'none',clipped:true});
    expect(fills.some(fill=>fill.color==='#ffffff')).toBe(true);
  });
});
