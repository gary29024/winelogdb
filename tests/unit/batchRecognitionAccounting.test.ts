import { processVertexBatchPollJob } from '../../worker/vertexBatchRecognition';
import { afterEach,describe,it,expect,vi } from 'vitest';
import { processBatchPollJob } from '../../worker/batchRecognition';
import { createD1Stub } from './support/d1Stub';
afterEach(()=>vi.unstubAllGlobals());
describe('Developer API Batch recognition accounting',()=>{
  it('records valid and malformed answers at the batch tier including thinking',async()=>{
    const stub=createD1Stub(sql=>sql.startsWith('SELECT google_batch_name')?{first:{google_batch_name:'batches/test',item_ids_json:'["a","b"]',status:'running'}}:undefined);
    const response=(key:string,text:string)=>({metadata:{key},response:{candidates:[{content:{parts:[{text}]}}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:20,thoughtsTokenCount:30}}});
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({state:'JOB_STATE_SUCCEEDED',dest:{inlinedResponses:[response('a',JSON.stringify({producer:'Krug',wineName:'Vintage',vintage:2013,confidence:0.95})),response('b','not JSON')]}})));
    await processBatchPollJob({DB:stub.db,GEMINI_API_KEY:'test'} as never,'owner','session','job',0);
    const events=stub.matching(/INSERT INTO ai_usage_events/);
    expect(events).toHaveLength(2);
    expect(events.map(call=>call.args[6])).toEqual(['batch','batch']);
    expect(events.map(call=>call.args.slice(9,12))).toEqual([[100,50,1],[100,50,0]]);
    expect(events.map(call=>call.args[0])).toEqual(['recognition:owner:job:a','recognition:owner:job:b']);
  });
});


it('Vertex Flex records tokens even when the answer cannot be parsed',async()=>{
  const stub=createD1Stub(sql=>{
    if(sql.startsWith('SELECT id,google_batch_name'))return {first:{id:'job',google_batch_name:'vertex-item/a',item_ids_json:'["a"]',status:'queued',updated_at:new Date().toISOString()}};
    if(sql.startsWith('SELECT id,metadata_json'))return {first:{id:'a',status:'submitted',metadata_json:'[]'}};
    if(sql.startsWith('SELECT recognition_object_key'))return {all:[{recognition_object_key:'image'}]};
  });
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({candidates:[{content:{parts:[{text:'invalid'}]}}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:20,thoughtsTokenCount:30}})));
  const env={DB:stub.db,GEMINI_API_KEY:'test',WINE_IMAGES:{get:async()=>({arrayBuffer:async()=>new Uint8Array([1]).buffer})}};
  expect(await processVertexBatchPollJob(env as never,'owner','session','job',0)).toBe(true);
  const events=stub.matching(/INSERT INTO ai_usage_events/);
  expect(events).toHaveLength(1);
  expect(events[0].args[6]).toBe('flex');
  expect(events[0].args.slice(9,12)).toEqual([100,50,0]);
});
