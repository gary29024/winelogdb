import { describe,expect,it } from 'vitest';
import { dedupeGroupRecognitionWines,groupRecognitionSchema } from '../../src/features/recognition/groupSchema';
import { groupCropRegion } from '../../src/features/uploads/cropGroupPhoto';

const wine=(overrides:Record<string,unknown>={})=>({
  producer:'Krug',wineName:'Grande Cuvée 170ème Édition',vintage:null,country:'France',region:'Champagne',appellation:'Champagne',grapes:['Pinot Noir','Chardonnay'],grapeBlend:[],style:'sparkling',alcoholPercentage:null,locationName:null,confidence:.8,boundingBox:{xMin:100,yMin:100,xMax:300,yMax:900},...overrides
});

describe('group photo recognition',()=>{
  it('rejects inverted or empty bounding boxes',()=>{
    expect(groupRecognitionSchema.safeParse({wines:[wine({boundingBox:{xMin:400,yMin:100,xMax:300,yMax:900}})],unresolvedCount:0}).success).toBe(false);
    expect(groupRecognitionSchema.safeParse({wines:[wine({boundingBox:{xMin:100,yMin:100,xMax:100,yMax:900}})],unresolvedCount:0}).success).toBe(false);
  });

  it('deduplicates repeated bottles of the same wine and keeps the strongest detection',()=>{
    const result=dedupeGroupRecognitionWines([
      wine({confidence:.55,boundingBox:{xMin:80,yMin:100,xMax:240,yMax:900}}),
      wine({confidence:.94,boundingBox:{xMin:500,yMin:100,xMax:680,yMax:900}})
    ] as never);
    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBe(.94);
    expect(result[0].boundingBox.xMin).toBe(500);
  });

  it('keeps different vintages as distinct wines and orders detections left to right',()=>{
    const result=dedupeGroupRecognitionWines([
      wine({wineName:'Vintage',vintage:2013,boundingBox:{xMin:600,yMin:100,xMax:760,yMax:900}}),
      wine({wineName:'Vintage',vintage:2008,boundingBox:{xMin:200,yMin:100,xMax:360,yMax:900}})
    ] as never);
    expect(result).toHaveLength(2);
    expect(result.map(item=>item.vintage)).toEqual([2008,2013]);
  });

  it('canonicalizes producer-prefixed wine names during dedupe',()=>{
    const result=dedupeGroupRecognitionWines([wine({wineName:'Krug Grande Cuvée 170ème Édition'})] as never);
    expect(result[0].wineName).toBe('Grande Cuvée 170ème Édition');
  });

  it('expands a tall detected bottle to a centred square crop when the source has room',()=>{
    const region=groupCropRegion(2400,1600,{xMin:420,yMin:120,xMax:560,yMax:880});
    expect(region.sourceWidth).toBe(region.sourceHeight);
    expect(region.sx).toBeGreaterThanOrEqual(0);
    expect(region.sy).toBeGreaterThanOrEqual(0);
    expect(region.sx+region.sourceWidth).toBeLessThanOrEqual(2400);
    expect(region.sy+region.sourceHeight).toBeLessThanOrEqual(1600);
    const detectedCenterX=((420+560)/2)/1000*2400;
    const cropCenterX=region.sx+region.sourceWidth/2;
    expect(Math.abs(cropCenterX-detectedCenterX)).toBeLessThan(2);
  });
});
