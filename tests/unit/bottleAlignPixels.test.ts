import { describe,expect,it } from 'vitest';
import { alignedPlacement,bottleWidth,commonTilt } from '../../src/features/share/bottleAlign';
import type { BottleFrame } from '../../src/lib/images/bottleFrame';

const cell={x:0,y:0,width:300,height:450};
// Construct measurements from pixel geometry, not from a square normalized
// frame. That distinction is essential for portrait phone photographs.
function shot(tilt:number,width=220,imageWidth=1200,imageHeight=1600):BottleFrame{
  const t=tilt*Math.PI/180,c=Math.cos(t),s=Math.sin(t),height=700;
  const box=(w:number,h:number)=>({
    xMin:500-(w*c+h*Math.abs(s))/imageWidth*500,xMax:500+(w*c+h*Math.abs(s))/imageWidth*500,
    yMin:500-(w*Math.abs(s)+h*c)/imageHeight*500,yMax:500+(w*Math.abs(s)+h*c)/imageHeight*500
  });
  return {bottle:box(width,height),label:box(width*.8,180),axis:{
    topX:500-s*height/imageWidth*500,bottomX:500+s*height/imageWidth*500,
    topY:500-c*height/imageHeight*500,bottomY:500+c*height/imageHeight*500
  }};
}

describe('alignment in the pixels actually drawn',()=>{
  it.each([[1200,1600],[1600,1200],[1000,1000]])('settles upright and leaning bottles together in %s x %s photos',(w,h)=>{
    const frames=[shot(0,220,w,h),shot(14,220,w,h),shot(14,220,w,h),shot(25,220,w,h)];
    const lean=commonTilt(frames,frames.map(()=>w/h))!;
    for(const frame of frames){
      const p=alignedPlacement(w,h,cell,.5,frame,lean),axis=frame.axis!;
      const dx=(axis.bottomX-axis.topX)/1000*p.width,dy=(axis.bottomY-axis.topY)/1000*p.height;
      const rotatedX=dx*Math.cos(p.turn)-dy*Math.sin(p.turn);
      const rotatedY=dx*Math.sin(p.turn)+dy*Math.cos(p.turn);
      expect(Math.atan2(rotatedX,rotatedY)*180/Math.PI).toBeCloseTo(14,5);
    }
  });

  it('uses the greater of target size and minimum rotated cover for close-ups',()=>{
    for(const width of [220,400,800]){
      const frame=shot(0,width);
      const p=alignedPlacement(1200,1600,cell,.5,frame,14*Math.PI/180);
      const target=300*.62/bottleWidth(frame.bottle!,frame.axis,frame.label,.75);
      const coverWidth=Math.max(cell.width*Math.abs(Math.cos(p.turn))+cell.height*Math.abs(Math.sin(p.turn))+2,
        (cell.width*Math.abs(Math.sin(p.turn))+cell.height*Math.abs(Math.cos(p.turn))+2)*.75);
      expect(p.width).toBeCloseTo(Math.max(target,coverWidth),4);
    }
  });

  it('keeps coverage when the label cannot fit without revealing blank space',()=>{
    const frame: BottleFrame={bottle:{xMin:150,xMax:850,yMin:0,yMax:1000},label:{xMin:200,xMax:800,yMin:150,yMax:850},axis:{topX:500,topY:0,bottomX:500,bottomY:1000}};
    const small={x:0,y:0,width:300,height:400};
    const p=alignedPlacement(1000,1000,small,.5,frame,18*Math.PI/180);
    for(const x of [-150,150])for(const y of [-200,200]){
      const px=x*Math.cos(p.turn)+y*Math.sin(p.turn),py=-x*Math.sin(p.turn)+y*Math.cos(p.turn);
      expect(px).toBeGreaterThanOrEqual(p.x);expect(px).toBeLessThanOrEqual(p.x+p.width);
      expect(py).toBeGreaterThanOrEqual(p.y);expect(py).toBeLessThanOrEqual(p.y+p.height);
    }
  });

  it('covers every cell corner across photo shapes, rotations and edge positions',()=>{
    for(const [w,h] of [[1200,1600],[1600,1200],[400,1600]])
      for(const tilt of [-25,0,25])for(const offset of [-150,0,150]){
        const frame=shot(tilt,220,w,h);
        for(const box of [frame.bottle!,frame.label!]){box.xMin+=offset;box.xMax+=offset}
        const p=alignedPlacement(w,h,cell,.5,frame,14*Math.PI/180);
        for(const x of [-cell.width/2,cell.width/2])for(const y of [-cell.height/2,cell.height/2]){
          const px=x*Math.cos(p.turn)+y*Math.sin(p.turn),py=-x*Math.sin(p.turn)+y*Math.cos(p.turn);
          expect(px).toBeGreaterThanOrEqual(p.x-1e-8);expect(px).toBeLessThanOrEqual(p.x+p.width+1e-8);
          expect(py).toBeGreaterThanOrEqual(p.y-1e-8);expect(py).toBeLessThanOrEqual(p.y+p.height+1e-8);
        }
      }
  });

  it('does not let rejected measurements vote on the card angle',()=>{
    const rejected={...shot(30),bottle:{xMin:0,xMax:1000,yMin:0,yMax:1000}};
    expect(commonTilt([shot(0),rejected,rejected],[.75,.75,.75])).toBe(0);
  });
});
