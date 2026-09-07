import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { createD1Stub } from './support/d1Stub';
import { MAX_FRAME_LOOKUP,parseBottleFrame,readBottleFrames,serializeBottleFrame,writeBottleFrame } from '../../src/lib/images/bottleFrame';
import { frameOf,parseBottleFrameResult } from '../../src/features/recognition/bottleFrameSchema';
import { AI_USAGE_KINDS,kindLabels,unitOf } from '../../src/lib/usage/aiUsage';

const box={xMin:120,yMin:80,xMax:640,yMax:960};

describe('what the model is asked for when a card wants its bottles the same size',()=>{
  it('reads a bottle and a label off the reply',()=>{
    const result=parseBottleFrameResult(JSON.stringify({bottle:box,label:{xMin:200,yMin:400,xMax:600,yMax:700},confidence:.9}));
    expect(frameOf(result).bottle).toEqual(box);
    expect(frameOf(result).label?.yMin).toBe(400);
  });

  it('takes "there is no bottle in this photograph" for an answer',()=>{
    // The distinction the stored column exists for: a null box is a measured
    // photograph with nothing in it, not a bottle that fills the frame.
    const result=parseBottleFrameResult('{"bottle":null,"label":null,"confidence":0}');
    expect(frameOf(result)).toEqual({bottle:null,label:null});
  });

  it('accepts the shapes Gemini actually answers with',()=>{
    // ymin/xmin arrays and box_2d wrappers, already survived once by the group
    // scan; the same preprocessing is reused rather than met again here.
    const array=parseBottleFrameResult('{"bottle":[80,120,960,640],"label":null,"confidence":0.5}');
    expect(frameOf(array).bottle).toEqual(box);
  });

  it('refuses a reply with a fenced or missing field rather than storing nonsense',()=>{
    expect(()=>parseBottleFrameResult('not json')).toThrow();
    expect(()=>parseBottleFrameResult('{"bottle":{"xMin":900,"yMin":80,"xMax":100,"yMax":960},"label":null,"confidence":1}')).toThrow();
  });

  it('reads a fenced reply, because the model still sometimes fences one',()=>{
    expect(frameOf(parseBottleFrameResult('```json\n{"bottle":null,"label":null,"confidence":0}\n```')).bottle).toBeNull();
  });
});

describe('storing a measured frame',()=>{
  it('round-trips through the column',()=>{
    const frame={bottle:box,label:null};
    expect(parseBottleFrame(serializeBottleFrame(frame))).toEqual(frame);
  });

  it('treats an unmeasured photograph and a broken value alike, as unknown',()=>{
    for(const stored of [null,'','{','[1,2]'])expect(parseBottleFrame(stored)).toBeNull();
  });

  it('drops a half a box rather than drawing with three corners',()=>{
    expect(parseBottleFrame('{"bottle":{"xMin":10,"yMin":10,"xMax":900}}')).toEqual({bottle:null,label:null});
  });

  it('reads frames for the photographs on a card in one query, scoped to the owner',async()=>{
    const stub=createD1Stub(()=>({all:[{id:'a',bottle_box:serializeBottleFrame({bottle:box,label:null})},{id:'b',bottle_box:null}]}));
    const frames=await readBottleFrames(stub.db,'owner-1',['a','b','a']);
    expect(frames.get('a')?.bottle).toEqual(box);
    expect(frames.has('b'),'a row that was never measured is not an answer').toBe(false);
    expect(stub.calls).toHaveLength(1);
    expect(stub.calls[0].sql).toMatch(/owner_id=\?/);
    expect(stub.calls[0].args,'asked once per distinct id').toEqual(['owner-1','a','b']);
    expect(stub.writes(),'reading frames writes nothing').toEqual([]);
  });

  it('will not be asked about more photographs than fit on a card',async()=>{
    const stub=createD1Stub(()=>({all:[]}));
    await readBottleFrames(stub.db,'owner-1',Array.from({length:40},(_,index)=>`i${index}`));
    expect(stub.calls[0].args).toHaveLength(MAX_FRAME_LOOKUP+1);
  });

  it('asks for nothing when the card has no photographs',async()=>{
    const stub=createD1Stub();
    expect(await readBottleFrames(stub.db,'owner-1',[])).toEqual(new Map());
    expect(stub.calls).toEqual([]);
  });

  it('writes the frame against the owner, so one account cannot measure another',async()=>{
    const stub=createD1Stub(()=>({changes:1}));
    await writeBottleFrame(stub.db,'owner-1','image-9',{bottle:box,label:null});
    expect(stub.writes()).toHaveLength(1);
    expect(stub.writes()[0].sql).toMatch(/UPDATE wine_images SET bottle_box=\? WHERE owner_id=\? AND id=\?/);
    expect(stub.writes()[0].args.slice(1)).toEqual(['owner-1','image-9']);
  });
});

describe('the column it is stored in',()=>{
  const migration=readFileSync('src/lib/db/migrations/0051_wine_images_bottle_box.sql','utf8');

  it('adds one nullable column and nothing else',()=>{
    expect(migration).toContain('ALTER TABLE wine_images ADD COLUMN bottle_box TEXT');
    expect(migration).not.toMatch(/CREATE TRIGGER/i);
    // wine_images carries no achievement trigger and must not gain one:
    // measuring a photograph changes nothing anybody has earned.
    expect(migration.match(/ALTER TABLE/g)).toHaveLength(1);
  });
});

describe('what it costs, on the record',()=>{
  it('meters framing as its own kind, quoted per bottle',()=>{
    expect(AI_USAGE_KINDS).toContain('bottle_frame');
    expect(kindLabels.bottle_frame).toBe('Bottle framing');
    expect(unitOf.bottle_frame,'a card of sixteen is sixteen measurements, not one run').toBe('wine');
  });
});
