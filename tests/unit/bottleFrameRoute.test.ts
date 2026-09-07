import { describe,expect,it,vi } from 'vitest';
import { createD1Stub } from './support/d1Stub';
import { serializeBottleFrame } from '../../src/lib/images/bottleFrame';

const box={xMin:100,yMin:60,xMax:700,yMax:940};
const measured={ok:true as const,result:{bottle:box,label:null,axis:null,confidence:.9},requestId:'r-1',durationMs:120,finishReason:null,wineCount:1,owner:'owner-1'};

async function handler(outcome:unknown){
  vi.resetModules();
  const runVisionRecognition=vi.fn(async()=>outcome);
  vi.doMock('../../worker/visionRecognition',()=>({runVisionRecognition}));
  const module=await import('../../worker/bottleFrameHandler');
  return {...module,runVisionRecognition};
}

describe('measuring one photograph',()=>{
  it('stores what it measured, so the same card never pays twice',async()=>{
    const {measureBottleFrame}=await handler(measured);
    const stub=createD1Stub(()=>({changes:1}));
    const result=await measureBottleFrame(new Request('https://x/api/bottle-frames/i-1',{method:'POST'}),{DB:stub.db} as never,'i-1');
    expect(result.ok&&result.frame.bottle).toEqual(box);
    expect(stub.writes()).toHaveLength(1);
    expect(stub.writes()[0].args).toEqual([serializeBottleFrame({bottle:box,label:null,axis:null}),'owner-1','i-1']);
  });

  it('records a photograph with no bottle in it, rather than leaving it to be asked again',async()=>{
    const {measureBottleFrame}=await handler({...measured,result:{bottle:null,label:null,axis:null,confidence:0},wineCount:0});
    const stub=createD1Stub(()=>({changes:1}));
    await measureBottleFrame(new Request('https://x/api/bottle-frames/i-2',{method:'POST'}),{DB:stub.db} as never,'i-2');
    expect(stub.writes()[0].args[0]).toBe('{"bottle":null,"label":null,"axis":null}');
  });

  it('writes nothing when the call itself failed',async()=>{
    const {measureBottleFrame}=await handler({ok:false,response:new Response('nope',{status:502})});
    const stub=createD1Stub();
    const result=await measureBottleFrame(new Request('https://x/api/bottle-frames/i-3',{method:'POST'}),{DB:stub.db} as never,'i-3');
    expect(result.ok).toBe(false);
    expect(stub.writes()).toEqual([]);
  });
});

describe('the spec it runs under',()=>{
  it('asks for boxes only, cheaply, and never escalates',async()=>{
    const {bottleFrameSpec}=await handler(measured);
    expect(bottleFrameSpec.kind).toBe('bottle_frame');
    // A stronger model cannot find a bottle that is not in the photograph, and
    // this reply is two rectangles - there is nothing for headroom to buy.
    expect(bottleFrameSpec.escalationReasons({bottle:null,label:null,axis:null,confidence:0})).toEqual([]);
    expect(bottleFrameSpec.maxOutputTokens).toBeLessThanOrEqual(1024);
    expect(bottleFrameSpec.wineCount({bottle:box,label:null,axis:null,confidence:1}),'a measured bottle is the metered unit').toBe(1);
    expect(bottleFrameSpec.wineCount({bottle:null,label:null,axis:null,confidence:0}),'nothing found is nothing billed as a unit').toBe(0);
  });

  it('tells the model to leave everything that is not the main bottle alone',async()=>{
    const {bottleFrameSpec}=await handler(measured);
    const prompt=bottleFrameSpec.prompt('',null);
    expect(prompt).toMatch(/normalized image coordinates from 0 to 1000/);
    expect(prompt,'a bottle held on a lean is the common case, not the exception').toMatch(/held at an angle/i);
    expect(prompt,'and the lean is what the axis is for').toMatch(/"axis": two points down the middle/);
    expect(prompt,'an empty answer has to be allowed or it will invent one').toMatch(/return null for the boxes and the axis/);
  });
});
