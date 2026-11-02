import { afterEach,describe,expect,it,vi } from 'vitest';
import { handleRecognitionRequest } from '../../worker/recognitionHandler';
import { handleGroupRecognitionRequest } from '../../worker/groupRecognitionHandler';
import { processVertexBatchPollJob } from '../../worker/vertexBatchRecognition';
import { createSession } from '../../src/lib/auth/session';
import { createD1Stub } from './support/d1Stub';
import { placesBucket } from './support/placesFixture';

const AUTH_SECRET='test-secret-value-long-enough-for-hmac';
// Where the reported batch was photographed, and where the label model put it.
const TOKYO={capturedAt:'2026-10-28T11:00:00.000Z',latitude:35.608,longitude:139.672,source:'exif'};
const GUESS='Yoichi, Hokkaido';

function stubGemini(result:unknown){
  const sent:string[]=[];
  vi.stubGlobal('fetch',vi.fn(async(_url:string,init?:RequestInit)=>{
    sent.push(String(init?.body??''));
    return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(result)}]},finishReason:'STOP'}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:20}}),{status:200,headers:{'content-type':'application/json'}});
  }));
  return sent;
}
async function scan(handler:typeof handleRecognitionRequest,metadata:unknown[]){
  const form=new FormData();
  form.append('images',new File([new Uint8Array([1,2,3])],'label.jpg',{type:'image/jpeg'}));
  form.append('metadata',JSON.stringify(metadata));
  const headers=new Headers({authorization:`Bearer ${await createSession('owner',AUTH_SECRET)}`});
  const response=await handler(new Request('https://x/api/recognition',{method:'POST',headers,body:form}),
    {DB:createD1Stub().db,AUTH_SECRET,GEMINI_API_KEY:'test-key',REFERENCE_DATA:placesBucket().bucket} as never);
  return await response.json() as Record<string,unknown>;
}

afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks()});

describe('the place a scan was photographed',()=>{
  it('comes from the photo GPS, which never reaches the label model',async()=>{
    const sent=stubGemini({producer:'Domaine Yui',wineName:'Rosé',vintage:2024,locationName:GUESS,confidence:0.9});
    expect(await scan(handleRecognitionRequest,[TOKYO])).toMatchObject({locationName:'Jiyūgaoka, Tokyo',latitude:35.608,longitude:139.672});
    expect(sent.join('')).not.toMatch(/35\.608|139\.672/);
  });

  it('is the same for every wine in a group photo',async()=>{
    const wine=(wineName:string,xMin:number)=>({producer:'Domaine Yui',wineName,vintage:2024,country:'Japan',region:'Hokkaido',appellation:null,grapes:[],grapeBlend:[],style:'rose',
      alcoholPercentage:null,locationName:GUESS,confidence:.92,boundingBox:{xMin,yMin:100,xMax:xMin+200,yMax:900}});
    const sent=stubGemini({wines:[wine('Rosé',100),wine('Blanc',400)],unresolvedCount:0});
    const result=await scan(handleGroupRecognitionRequest,[TOKYO]) as {wines:Array<{locationName:string|null}>};
    expect(result.wines.map(wine=>wine.locationName)).toEqual(['Jiyūgaoka, Tokyo','Jiyūgaoka, Tokyo']);
    expect(sent.join('')).not.toMatch(/35\.608|139\.672/);
  });

  it('is empty without GPS, whatever the label model says',async()=>{
    stubGemini({producer:'Domaine Yui',wineName:'Rosé',vintage:2024,locationName:GUESS,confidence:0.9});
    expect(await scan(handleRecognitionRequest,[{capturedAt:null,latitude:null,longitude:null,source:'none'}])).toMatchObject({locationName:null});
  });

  it('comes from the photo GPS for a Batch Scan wine',async()=>{
    const stub=createD1Stub(sql=>{
      if(sql.startsWith('SELECT id,google_batch_name'))return {first:{id:'job',google_batch_name:'vertex-item/a',item_ids_json:'["a"]',status:'queued',updated_at:new Date().toISOString()}};
      if(sql.startsWith('SELECT id,metadata_json'))return {first:{id:'a',status:'submitted',metadata_json:JSON.stringify([TOKYO])}};
      if(sql.startsWith('SELECT recognition_object_key'))return {all:[{recognition_object_key:'image'}]};
    });
    const sent=stubGemini({producer:'Domaine Yui',wineName:'Rosé',vintage:2024,country:'Japan',region:'Hokkaido',style:'rose',locationName:GUESS,confidence:0.95});
    const env={DB:stub.db,GEMINI_API_KEY:'test',REFERENCE_DATA:placesBucket().bucket,WINE_IMAGES:{get:async()=>({arrayBuffer:async()=>new Uint8Array([1]).buffer})}};
    expect(await processVertexBatchPollJob(env as never,'owner','session','job',0)).toBe(true);
    const saved=stub.matching(/SET status='ready',recognition_json=\?/)[0];
    expect(JSON.parse(String(saved.args[0]))).toMatchObject({locationName:'Jiyūgaoka, Tokyo',latitude:35.608,longitude:139.672});
    expect(sent.join('')).not.toMatch(/35\.608|139\.672/);
  });
});
