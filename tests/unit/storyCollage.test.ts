import { describe,expect,it } from 'vitest';
import { MAX_STORY_WINES,STORY_HEIGHT,STORY_WIDTH,captionsFit,collageColumns,collageLayout,starMark } from '../../src/features/share/storyCollage';

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
      expect(cell.y,`${count} wines clear of the title`).toBeGreaterThan(200);
      expect(cell.x+cell.width).toBeLessThanOrEqual(STORY_WIDTH);
      expect(cell.y+cell.height,`${count} wines clear of the wordmark`).toBeLessThan(STORY_HEIGHT-100);
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

  it('drops the per-wine captions once they would be unreadable',()=>{
    expect(captionsFit(9)).toBe(true);
    expect(captionsFit(10),'sixteen captions at story size is a wall of tiny type').toBe(false);
  });
});
