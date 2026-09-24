import { afterEach,describe,expect,it,vi } from 'vitest';
import { lwinReferenceFixture } from './support/lwinReferenceFixture';
import { referenceRecognitionFields } from '../../src/features/recognition/identityFields';
import { parseRecognition,recognitionSchema } from '../../src/features/recognition/schema';
import { parseGroupRecognition,groupRecognitionSchema } from '../../src/features/recognition/groupSchema';
import { parseSheetPage,sheetPageSchema } from '../../src/features/recognition/sheetSchema';
import { enrichRecognitionReference } from '../../src/lib/wine/referenceIdentity';
import { createSession } from '../../src/lib/auth/session';
import { buildRecognitionPrompt,PRODUCER_NAME_RULE } from '../../src/lib/recognition/geminiRequest';
import { handleRecognitionRequest } from '../../worker/recognitionHandler';
import { handleGroupRecognitionRequest,groupRecognitionSpec } from '../../worker/groupRecognitionHandler';
import { sheetRecognitionSpec } from '../../worker/sheetRecognitionHandler';
import { handleVisionRecognitionRequest } from '../../worker/visionRecognition';
import { processBatchPollJob } from '../../worker/batchRecognition';
import { processVertexBatchPollJob } from '../../worker/vertexBatchRecognition';
import { createD1Stub } from './support/d1Stub';

const AUTH_SECRET='test-secret-value-long-enough-for-hmac';
const identity={producer:'Maison FANG',wineName:'Cuvée Zéphyr',vintage:2023,confidence:.95};
const invented={
 lwinReference:lwinReferenceFixture,
 referenceProductKey:'lwin:3061244',lwin7:'3061244',lwin11:'30612442023',elid:'FR-BRG-FANG01-2023',
 identityMatchStatus:'matched',identityMatchConfidence:1,identityMatchCandidates:['3061244'],
 colour:'White',productType:'Wine',productSubtype:'Still',referenceProducer:'Fang',referenceWineName:'Zephyr',
 referenceCountry:'France',referenceRegion:'Burgundy',referenceSubRegion:'Cote de Beaune',referenceSite:'Savigny',
 referenceParcel:'Parcel',referenceDesignation:'AOP',referenceClassification:'Premier Cru'
};
const failedBucket=()=>({get:vi.fn(async()=>{throw new Error('R2 temporarily unavailable')})});
const assertNoReference=(value:unknown)=>{
 expect(value).toMatchObject(identity);
 for(const key of Object.keys(referenceRecognitionFields))expect(value).not.toHaveProperty(key);
};
const reply=(value:unknown)=>Response.json({candidates:[{content:{parts:[{text:JSON.stringify(value)}]},finishReason:'STOP'}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:20}});
afterEach(()=>vi.unstubAllGlobals());

describe('raw recognition reference trust boundary (#292)',()=>{
 it.each(['single','group','sheet'])('strips every server-owned field before validating %s model JSON',async mode=>{
  const malformed=Object.fromEntries(Object.keys(referenceRecognitionFields).map(key=>[key,{invented:true}]));
  const raw={...identity,...malformed};
  const parsed=mode==='single'?parseRecognition(JSON.stringify(raw))
   :mode==='group'?parseGroupRecognition(JSON.stringify([raw])).wines[0]
   :parseSheetPage(JSON.stringify({wines:[raw]})).wines[0];
  const bucket=failedBucket();
  assertNoReference(await enrichRecognitionReference(bucket as unknown as R2Bucket,parsed));
  expect(bucket.get).toHaveBeenCalled();
  expect(parsed.recognizedProducer).toBe('Maison FANG');
 });
 it('continues accepting verified enrichment in all browser response schemas',()=>{
  expect(Object.keys(invented).sort()).toEqual(Object.keys(referenceRecognitionFields).sort());
  const verified={...identity,...invented};
  expect(recognitionSchema.parse(verified)).toMatchObject(invented);
  expect(groupRecognitionSchema.parse({wines:[verified]}).wines[0]).toMatchObject(invented);
  expect(sheetPageSchema.parse({wines:[verified]}).wines[0]).toMatchObject(invented);
 });
 it.each(['single','group','sheet'])('does not return invented IDs after %s schema fallback and failed R2 lookup',async mode=>{
  const payload={...identity,...invented},body=mode==='single'?payload:{wines:[payload],unresolvedCount:0};
  const fetch=vi.fn().mockResolvedValueOnce(new Response('{"error":{"message":"response schema rejected"}}',{status:400})).mockImplementation(async()=>reply(body));
  vi.stubGlobal('fetch',fetch);
  const bucket=failedBucket(),response=await run(mode,bucket);
  expect(response.status).toBe(200);
  const result=await response.json() as {wines:unknown[]};
  assertNoReference(mode==='single'?result:result.wines[0]);
  expect(bucket.get).toHaveBeenCalled();
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(JSON.parse(String(fetch.mock.calls[1][1].body)).generationConfig.responseJsonSchema).toBeUndefined();
 });
 it.each(['single','group','sheet'])('strips invented fields from the accepted %s synchronous escalation',async mode=>{
  const primary={...identity,confidence:.5},escalated={...identity,...invented};
  const envelope=(wine:unknown)=>mode==='single'?wine:{wines:[wine],unresolvedCount:0};
  const fetch=vi.fn().mockResolvedValueOnce(reply(envelope(primary))).mockResolvedValueOnce(reply(envelope(escalated)));
  vi.stubGlobal('fetch',fetch);
  const response=await run(mode,failedBucket());
  expect(response.status).toBe(200);
  const result=await response.json() as {wines:unknown[]};
  assertNoReference(mode==='single'?result:result.wines[0]);
  expect(fetch).toHaveBeenCalledTimes(2);
 });
 it('never persists invented references from Developer API batch responses',async()=>{
  const stub=createD1Stub(sql=>sql.startsWith('SELECT google_batch_name')?{first:{google_batch_name:'batches/test',item_ids_json:'["a"]',status:'running'}}:undefined);
  const response={metadata:{key:'a'},response:{candidates:[{content:{parts:[{text:JSON.stringify({...identity,...invented})}]}}]}};
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({state:'JOB_STATE_SUCCEEDED',dest:{inlinedResponses:[response]}})));
  const bucket=failedBucket();
  await processBatchPollJob({DB:stub.db,GEMINI_API_KEY:'test',REFERENCE_DATA:bucket} as never,'owner','session','job',0);
  const writes=stub.matching(/SET status='ready',recognition_json=/);
  expect(writes).toHaveLength(1);
  assertNoReference(JSON.parse(String(writes[0].args[0])));
  expect(bucket.get).toHaveBeenCalled();
 });
 it.each([false,true])('never persists invented Vertex references (escalation: %s)',async escalate=>{
  const stub=createD1Stub(sql=>{
   if(sql.startsWith('SELECT id,google_batch_name'))return {first:{id:'job',google_batch_name:'vertex-item/a',item_ids_json:'["a"]',status:'queued',updated_at:new Date().toISOString()}};
   if(sql.startsWith('SELECT id,metadata_json'))return {first:{id:'a',status:'submitted',metadata_json:'[]'}};
   if(sql.startsWith('SELECT recognition_object_key'))return {all:[{recognition_object_key:'image'}]};
  });
  const fetch=vi.fn().mockResolvedValueOnce(reply({...identity,...invented,confidence:escalate?.5:.95})).mockImplementation(async()=>reply({...identity,...invented}));
  vi.stubGlobal('fetch',fetch);
  const bucket=failedBucket(),env={DB:stub.db,GEMINI_API_KEY:'test',REFERENCE_DATA:bucket,WINE_IMAGES:{get:async()=>({arrayBuffer:async()=>new Uint8Array([1]).buffer})}};
  expect(await processVertexBatchPollJob(env as never,'owner','session','job',0)).toBe(true);
  const writes=stub.matching(/SET status='ready',recognition_json=/);
  expect(writes).toHaveLength(1);
  assertNoReference(JSON.parse(String(writes[0].args[0])));
  expect(bucket.get).toHaveBeenCalled();
  expect(fetch).toHaveBeenCalledTimes(escalate?2:1);
 });
});

async function run(mode:string,bucket:ReturnType<typeof failedBucket>){
 const form=new FormData();form.append('images',new File([new Uint8Array([1,2,3])],'label.jpg',{type:'image/jpeg'}));
 const request=new Request('https://x/api/recognition',{method:'POST',headers:{authorization:`Bearer ${await createSession('owner',AUTH_SECRET)}`},body:form});
 const env={DB:createD1Stub().db,AUTH_SECRET,GEMINI_API_KEY:'test',REFERENCE_DATA:bucket} as never;
 if(mode==='single')return handleRecognitionRequest(request,env);
 if(mode==='group')return handleGroupRecognitionRequest(request,env);
 return handleVisionRecognitionRequest(request,env,sheetRecognitionSpec);
}

it('asks every recognition mode to retain printed producer prefixes',()=>{
 for(const prompt of [buildRecognitionPrompt([]).prompt,groupRecognitionSpec.prompt('',null),sheetRecognitionSpec.prompt('',null)])expect(prompt).toContain(PRODUCER_NAME_RULE);
});
