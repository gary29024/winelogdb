import { describe,expect,it } from 'vitest';
import { dedupeGroupRecognitionWines,groupRecognitionSchema,groupRecognitionWineSchema,parseGroupRecognition } from '../../src/features/recognition/groupSchema';
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

  it('survives the round trip the worker actually performs',()=>{
    // The reported failure: every group scan came back
    // {code:'unrecognized_keys',keys:['classification'],path:['wines',0]}. The
    // worker canonicalises during dedupe, which fills fields the model was
    // never asked for, then the browser re-parses that response with this same
    // strict schema. A field with no home here rejects the entire scan.
    const overWire=JSON.parse(JSON.stringify(parseGroupRecognition(JSON.stringify({wines:[
      wine({producer:'Domaine Leflaive',wineName:'Puligny-Montrachet 1er Cru Clavoillon',vintage:2021,region:'Burgundy',appellation:'Puligny-Montrachet 1er Cru',style:'white'}),
      wine({producer:'Domaine Leflaive',wineName:'Bourgogne Blanc',vintage:2021,region:'Burgundy',appellation:'Bourgogne',style:'white',boundingBox:{xMin:500,yMin:100,xMax:700,yMax:900}})
    ],unresolvedCount:0}))));
    const parsed=groupRecognitionSchema.safeParse(overWire);
    expect(parsed.success).toBe(true);
    expect(parsed.success&&parsed.data.wines.map(item=>item.classification)).toEqual(['premier_cru',null]);
  });

  it('accepts every field canonicalisation adds, not just the ones known today',()=>{
    // A guard on the class of bug rather than the one instance: the next field
    // canonicalizeWineFields learns to fill should fail here, in CI, rather
    // than in the browser after a real scan.
    const canonical=dedupeGroupRecognitionWines([wine()] as never)[0];
    const result=groupRecognitionWineSchema.safeParse(canonical);
    expect(result.success?[]:result.error.issues.flatMap(issue=>issue.code==='unrecognized_keys'?issue.keys:[])).toEqual([]);
  });

  it('accepts a canonicalised wine on the way into server session history',()=>{
    // groupRecognitionSessions parses each stored item with this same schema,
    // so the save that keeps a scan resumable across devices failed too.
    const canonical=JSON.parse(JSON.stringify(dedupeGroupRecognitionWines([
      wine({wineName:'Chambertin Grand Cru',region:'Burgundy',appellation:'Chambertin Grand Cru',style:'red'})
    ] as never)[0]));
    expect(groupRecognitionWineSchema.safeParse(canonical).success).toBe(true);
  });

  it('crops a bottle to its own shape instead of squaring it up',()=>{
    // The crop used to expand the short axis to match the long one, to suit
    // near-square thumbnails. A bottle is about one part wide to five tall, so
    // that reached far enough sideways to take in whichever bottles were
    // standing next to it - the one thing a group photo exists to separate.
    const region=groupCropRegion(1290,1295,{xMin:459,yMin:224,xMax:544,yMax:577});
    expect(region.sourceWidth).toBeLessThan(region.sourceHeight/2);
    expect(region.sx).toBeGreaterThanOrEqual(0);
    expect(region.sy).toBeGreaterThanOrEqual(0);
    expect(region.sx+region.sourceWidth).toBeLessThanOrEqual(1290);
    expect(region.sy+region.sourceHeight).toBeLessThanOrEqual(1295);
  });

  it('leaves the bottle standing next to it out of frame',()=>{
    // Measured on the reported photo: squaring produced a 531x531 crop that
    // overlapped the neighbouring bottle by 124px. The margin is the only
    // overlap now.
    const neighbour={xMin:552,xMax:648};
    const region=groupCropRegion(1290,1295,{xMin:459,yMin:224,xMax:544,yMax:577});
    const overlap=Math.max(0,(region.sx+region.sourceWidth)-(neighbour.xMin/1000)*1290);
    expect(Math.round(overlap)).toBeLessThan(12);
  });

  it('keeps a little air around the bottle rather than shaving its edges',()=>{
    // A detection sits tight to the glass; without a margin the crop clips the
    // shoulders and the label runs to the edge.
    const box={xMin:400,yMin:200,xMax:500,yMax:800};
    const region=groupCropRegion(1000,1000,box);
    expect(region.sx).toBeLessThan(400);
    expect(region.sx+region.sourceWidth).toBeGreaterThan(500);
  });

  it('never reaches outside the photo for a bottle at the edge',()=>{
    const region=groupCropRegion(1000,1000,{xMin:0,yMin:0,xMax:120,yMax:990});
    expect(region.sx).toBe(0);
    expect(region.sy).toBe(0);
    expect(region.sx+region.sourceWidth).toBeLessThanOrEqual(1000);
    expect(region.sy+region.sourceHeight).toBeLessThanOrEqual(1000);
  });
});
