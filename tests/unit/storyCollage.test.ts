import { describe,expect,it } from 'vitest';
import { MAX_STORY_WINES,STORY_HEIGHT,STORY_WIDTH,collageColumns,collageLayout,pickStoryWines,starMark,storyHeaderHeight,storyTitleLayout } from '../../src/features/share/storyCollage';

const counts=Array.from({length:MAX_STORY_WINES},(_,index)=>index+1);
const overlaps=(a:{x:number;y:number;width:number;height:number},b:typeof a)=>
  a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height;

describe('laying a lineup out on a story card',()=>{
  it('gives every wine a cell, up to sixteen',()=>{
    for(const count of counts)expect(collageLayout(count).cells,`${count} wines`).toHaveLength(count);
    expect(collageLayout(40).cells,'past sixteen a bottle is not recognisable').toHaveLength(MAX_STORY_WINES);
    expect(collageLayout(0).cells,'and a card is never empty').toHaveLength(1);
  });

  it('keeps every cell inside the card and clear of the title and the wordmark',()=>{
    for(const count of counts)for(const cell of collageLayout(count).cells){
      expect(cell.x).toBeGreaterThanOrEqual(0);
      expect(cell.y,`${count} wines clear of the title`).toBeGreaterThan(185);
      expect(cell.x+cell.width).toBeLessThanOrEqual(STORY_WIDTH);
      expect(cell.y+cell.height,`${count} wines clear of the wordmark`).toBeLessThanOrEqual(STORY_HEIGHT-96);
      expect(cell.width).toBeGreaterThan(0);expect(cell.height).toBeGreaterThan(0);
    }
  });

  it('never puts one photograph on top of another',()=>{
    for(const count of counts){
      const {cells}=collageLayout(count);
      for(let a=0;a<cells.length;a++)for(let b=a+1;b<cells.length;b++)
        expect(overlaps(cells[a],cells[b]),`${count} wines: cell ${a} over ${b}`).toBe(false);
    }
  });

  it('keeps the cells portrait, which is the shape a bottle photograph is',()=>{
    for(const count of counts){
      const cell=collageLayout(count).cells[0];
      expect(cell.height/cell.width,`${count} wines`).toBeGreaterThan(1);
    }
  });

  it('centres a short last row rather than hanging it off the left',()=>{
    // Five in a two-by-three leaves one over, and under the left column it
    // reads as a mistake rather than as the end of a list.
    const lastRow=(count:number)=>{
      const {columns,cells}=collageLayout(count);
      const over=count%columns;
      return over?cells.slice(-over):[];
    };
    for(const count of counts){
      const row=lastRow(count);if(!row.length)continue;
      const span=(row[row.length-1].x+row[row.length-1].width+row[0].x)/2;
      expect(Math.round(span),`${count} wines: the short row is centred`).toBe(STORY_WIDTH/2);
    }
    expect(lastRow(5),'five leaves a row of one').toHaveLength(1);
    // Full rows are centred too: a block that had to shrink to fit the height
    // is narrower than the card, and pinned left it would sit off to one side.
    for(const count of counts){
      const {columns,cells}=collageLayout(count);
      for(let start=0;start<cells.length;start+=columns){
        const row=cells.slice(start,start+columns),last=row[row.length-1];
        expect(Math.round((row[0].x+last.x+last.width)/2),`${count} wines, row at ${start}`).toBe(STORY_WIDTH/2);
      }
    }
  });

  it('never asks for more than four columns, whatever the count',()=>{
    // Past four a producer's name gives out at story size.
    for(const count of counts)expect(collageColumns(count),`${count} wines`).toBeLessThanOrEqual(4);
    expect(collageColumns(1)).toBe(1);
    expect(collageColumns(16)).toBe(4);
  });

  it('picks the grid that makes the photographs biggest',()=>{
    // Hand-picked column counts were wrong twice, so it is measured instead:
    // no other column count may produce a larger cell than the one chosen.
    for(const count of counts){
      const chosen=collageLayout(count).cells[0],area=chosen.width*chosen.height;
      for(let columns=1;columns<=4;columns++){
        const rows=Math.ceil(count/columns);
        let width=(STORY_WIDTH-128-18*(columns-1))/columns,height=width*(4/3);
        const block=rows*height+18*(rows-1),room=STORY_HEIGHT-250-132;
        if(block>room){const scale=room/block;width*=scale;height*=scale}
        expect(width*height,`${count} wines would be bigger in ${columns} columns`).toBeLessThanOrEqual(area+1);
      }
    }
  });

  it('puts the favourite star in the corner of its own photograph',()=>{
    for(const count of [1,4,9,16]){
      const cell=collageLayout(count).cells[0],mark=starMark(cell);
      expect(mark.x).toBeGreaterThan(cell.x);
      expect(mark.x+mark.size,'inside its own cell, not over the next one').toBeLessThan(cell.x+cell.width);
      expect(mark.y).toBeGreaterThan(cell.y);
      expect(mark.y+mark.size).toBeLessThan(cell.y+cell.height);
      expect(mark.x+mark.size/2,'in the upper right, away from the caption').toBeGreaterThan(cell.x+cell.width/2);
    }
  });

  /**
   * The complaint that produced this test: on a phone, where the card fills a
   * nine-by-sixteen frame with nothing around it, a band of paper top and
   * bottom reads as a photograph that failed rather than as composure.
   */
  it('fills the height of the card rather than floating a block in the middle',()=>{
    for(const count of counts){
      const {cells}=collageLayout(count);
      const top=Math.min(...cells.map(cell=>cell.y));
      const bottom=Math.max(...cells.map(cell=>cell.y+cell.height));
      expect(bottom-top,`${count} wines leave the card half empty`).toBeGreaterThan(STORY_HEIGHT*0.74);
    }
  });

  it('keeps every cell portrait, whatever it had to do to fill the card',()=>{
    for(const count of counts)for(const cell of collageLayout(count).cells){
      const aspect=cell.height/cell.width;
      expect(aspect,`${count} wines: a bottle is taller than it is wide`).toBeGreaterThan(1.1);
      expect(aspect,`${count} wines: past this a bottle looks stretched`).toBeLessThan(1.75);
    }
  });
});

describe('choosing which wines go on a card',()=>{
  const lineup=(count:number,favourites:number[])=>
    Array.from({length:count},(_,index)=>({favorite:favourites.includes(index)}));

  it('takes everything when everything fits',()=>{
    expect(pickStoryWines(lineup(5,[1]))).toEqual([0,1,2,3,4]);
  });

  it('keeps the favourites when more were picked than fit',()=>{
    const chosen=pickStoryWines(lineup(24,[20,21,22,23]));
    expect(chosen).toHaveLength(MAX_STORY_WINES);
    for(const favourite of [20,21,22,23])
      expect(chosen,`the starred wine at ${favourite} is the point of the card`).toContain(favourite);
  });

  it('hands them back in the order they came in, so the card is not resorted',()=>{
    const chosen=pickStoryWines(lineup(20,[19,0]));
    expect(chosen).toEqual([...chosen].sort((a,b)=>a-b));
  });

  it('does not drop a wine to make room for a favourite that is already on',()=>{
    expect(pickStoryWines(lineup(16,[15]))).toHaveLength(16);
  });
});

describe('story grids with optional headers',()=>{
  it.each([
    {title:true,subtitle:true},
    {title:true,subtitle:false},
    {title:false,subtitle:true},
    {title:false,subtitle:false}
  ])('fits all wine counts with header %j',header=>{
    for(const count of counts){
      const {cells}=collageLayout(count,header);
      const original=collageLayout(count).cells[0];
      expect(cells).toHaveLength(count);
      expect(cells[0].width*cells[0].height).toBeGreaterThanOrEqual(original.width*original.height-0.001);
      for(const cell of cells){
        expect(cell.y).toBeGreaterThanOrEqual(storyHeaderHeight(header)-0.001);
        expect(cell.y+cell.height).toBeLessThanOrEqual(STORY_HEIGHT-96+0.001);
        expect(cell.x).toBeGreaterThanOrEqual(56-0.001);
        expect(cell.x+cell.width).toBeLessThanOrEqual(STORY_WIDTH-56+0.001);
        expect(cell.height/cell.width).toBeGreaterThanOrEqual(1.2-0.001);
        expect(cell.height/cell.width).toBeLessThanOrEqual(1.7+0.001);
      }
      for(let a=0;a<cells.length;a++)for(let b=a+1;b<cells.length;b++)
        expect(overlaps(cells[a],cells[b])).toBe(false);
    }
  });

  it('expands the grid into the room freed by each hidden header line',()=>{
    const full=collageLayout(6).cells[0];
    const one=collageLayout(6,{title:true,subtitle:false}).cells[0];
    const none=collageLayout(6,{title:false,subtitle:false}).cells[0];
    expect(one.y).toBeLessThan(full.y);
    expect(none.y).toBeLessThan(one.y);
    expect(one.height).toBeGreaterThan(full.height);
    expect(none.height).toBeGreaterThan(one.height);
  });
});

describe('complete story titles',()=>{
  const measure=(text:string,size:number)=>Array.from(text).length*size*.6;
  it.each(['Vinosophy Walkaround Tasting September 2026','勃艮第葡萄酒品酒會與朋友分享美好時光','A'.repeat(180)])('wraps without dropping text: %s',name=>{
    const title=storyTitleLayout(name,measure);
    expect(title.lines.join('').replace(/ /g,'')).toBe(name.replace(/ /g,''));
    expect(title.lines.length).toBeLessThanOrEqual(3);
    for(const line of title.lines)expect(measure(line,title.fontSize)).toBeLessThanOrEqual(STORY_WIDTH-140);
    for(const count of counts){
      const header={title:true,subtitle:true,titleHeight:title.height};
      for(const cell of collageLayout(count,header).cells){
        expect(cell.y).toBeGreaterThanOrEqual(storyHeaderHeight(header)-.001);
        expect(cell.y+cell.height).toBeLessThanOrEqual(STORY_HEIGHT-96+.001);
      }
    }
  });
  it('preserves the original height for a short title and removes blank titles',()=>{
    expect(storyTitleLayout('Evening',measure)).toMatchObject({lines:['Evening'],fontSize:72,height:70});
    expect(storyTitleLayout('   ',measure)).toMatchObject({lines:[],height:0});
  });
});
