import { handleRecognitionRequest } from '../../worker/recognitionHandler';
import { afterEach,describe,expect,it,vi } from 'vitest';
import { handleGroupRecognitionRequest } from '../../worker/groupRecognitionHandler';
import { createSession } from '../../src/lib/auth/session';
import { createD1Stub } from './support/d1Stub';

/**
 * What the group recognition handler actually does over the wire.
 *
 * Written before the mode-spec extraction, deliberately: the existing group
 * tests cover the schema, the crop and the escalation predicates, and none of
 * them exercises the handler. Without this, "the tests still pass" would have
 * said nothing about a refactor of the retry, fallback, escalation and metering
 * that only live here.
 */
const AUTH_SECRET='test-secret-value-long-enough-for-hmac';

const wine=(overrides:Record<string,unknown>={})=>({
  producer:'Krug',wineName:'Grande Cuvée',vintage:null,country:'France',region:'Champagne',
  appellation:'Champagne',grapes:[],grapeBlend:[],style:'sparkling',alcoholPercentage:null,
  locationName:null,confidence:.92,boundingBox:{xMin:100,yMin:100,xMax:300,yMax:900},...overrides
});

const geminiReply=(result:unknown,usage={promptTokenCount:1200,candidatesTokenCount:400})=>
  new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(result)}]},finishReason:'STOP'}],usageMetadata:usage}),
    {status:200,headers:{'content-type':'application/json'}});

type Call={url:string;body:Record<string,unknown>};

function stubGemini(replies:Array<()=>Response>){
  const calls:Call[]=[];
  let index=0;
  vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{
    calls.push({url:String(url),body:JSON.parse(String(init?.body??'{}')) as Record<string,unknown>});
    const reply=replies[Math.min(index++,replies.length-1)];
    return reply();
  }));
  return calls;
}

async function run(files:File[]=[new File([new Uint8Array([1,2,3])],'lineup.jpg',{type:'image/jpeg'})],options:{anonymous?:boolean;single?:boolean}={}){
  const form=new FormData();
  for(const file of files)form.append('images',file);
  form.append('metadata',JSON.stringify(files.map(()=>({capturedAt:null,latitude:null,longitude:null,source:'none'}))));
  const headers=new Headers();
  if(!options.anonymous)headers.set('authorization',`Bearer ${await createSession('owner',AUTH_SECRET)}`);
  const stub=createD1Stub();
  const response=await (options.single?handleRecognitionRequest:handleGroupRecognitionRequest)(new Request('https://x/api/recognition',{method:'POST',headers,body:form}),
    {DB:stub.db,AUTH_SECRET,GEMINI_API_KEY:'test-key'} as never);
  return {response,stub};
}

const usageWrites=(stub:ReturnType<typeof createD1Stub>)=>
  stub.calls.filter(call=>/INSERT INTO ai_usage_events/.test(call.sql));

afterEach(()=>vi.unstubAllGlobals());

describe('the group recognition handler, as it behaves today',()=>{
  it('sends one image and asks for the structured schema', async()=>{
    const calls=stubGemini([()=>geminiReply({wines:[wine()],unresolvedCount:0})]);
    const {response}=await run();
    expect(response.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('gemini');
    const contents=calls[0].body.contents as Array<{parts:Array<Record<string,unknown>>}>;
    expect(contents[0].parts.filter(part=>'inlineData' in part)).toHaveLength(1);
    const config=calls[0].body.generationConfig as Record<string,unknown>;
    expect(config.responseJsonSchema).toBeTruthy();
    expect(config.maxOutputTokens).toBe(8192);
  });

  it('meters the wines it found, once', async()=>{
    stubGemini([()=>geminiReply({wines:[wine(),wine({wineName:'Vintage',vintage:2013,boundingBox:{xMin:500,yMin:100,xMax:700,yMax:900}})],unresolvedCount:0})]);
    const {stub}=await run();
    const writes=usageWrites(stub);
    expect(writes).toHaveLength(1);
    // kind, run id, target, model, requests, searches, prompt, output, units
    expect(writes[0].args[2]).toBe('scan_group');
    expect(writes[0].args.at(-2)).toBe(2);
  });

  it('drops the response schema and retries when Gemini rejects it with a 400', async()=>{
    const calls=stubGemini([
      ()=>new Response('{"error":{"message":"bad schema"}}',{status:400}),
      ()=>geminiReply({wines:[wine()],unresolvedCount:0})
    ]);
    const {response}=await run();
    expect(response.status).toBe(200);
    expect(calls).toHaveLength(2);
    expect((calls[0].body.generationConfig as Record<string,unknown>).responseJsonSchema).toBeTruthy();
    expect((calls[1].body.generationConfig as Record<string,unknown>).responseJsonSchema).toBeUndefined();
  });

  it('retries a retryable upstream failure once before giving up', async()=>{
    const calls=stubGemini([
      ()=>new Response('upstream unavailable',{status:503}),
      ()=>geminiReply({wines:[wine()],unresolvedCount:0})
    ]);
    const {response}=await run();
    expect(response.status).toBe(200);
    expect(calls).toHaveLength(2);
  });

  it('escalates an unresolved lineup to the stronger model and meters it apart', async()=>{
    // The escalation is a second billed call on the same photo. It must be
    // metered as its own request but contribute no extra wines, or one lineup
    // would be counted twice.
    const calls=stubGemini([
      ()=>geminiReply({wines:[wine()],unresolvedCount:2}),
      ()=>geminiReply({wines:[wine(),wine({wineName:'Vintage',vintage:2013,boundingBox:{xMin:500,yMin:100,xMax:700,yMax:900}})],unresolvedCount:0})
    ]);
    const {response,stub}=await run();
    expect(response.status).toBe(200);
    expect(calls).toHaveLength(2);
    expect(calls[1].url).toContain('gemini-3.8-flash');
    const writes=usageWrites(stub);
    expect(writes).toHaveLength(2);
    expect(writes.map(write=>write.args.at(-2))).toEqual([2,0]);
  });

  it('refuses anything but exactly one photo, and an unauthenticated caller', async()=>{
    stubGemini([()=>geminiReply({wines:[],unresolvedCount:0})]);
    const two=[new File([new Uint8Array([1])],'a.jpg',{type:'image/jpeg'}),new File([new Uint8Array([1])],'b.jpg',{type:'image/jpeg'})];
    expect((await run(two)).response.status).toBe(400);
    expect((await run(undefined,{anonymous:true})).response.status).toBe(401);
  });
});

describe('what the log keeps when a scan will not parse',()=>{
  /**
   * Asked as: is it worth logging payloads through AI Gateway? Not as a
   * standing setting - recognition sends photographs as inline base64, so
   * payload logging keeps a copy of every bottle, table and priced wine list
   * outside D1. What was actually wanted, twice, is what the model said. A
   * schema error names the field that was wrong and says nothing about what was
   * put there, which is the half that took a screenshot and a guess to recover.
   */
  const logged=(spy:ReturnType<typeof vi.spyOn>)=>spy.mock.calls
    .map(call=>{try{return JSON.parse(String(call[0])) as Record<string,unknown>}catch{return {}}});

  it('keeps the reply itself, bounded, and never the request',async()=>{
    const error=vi.spyOn(console,'error').mockImplementation(()=>undefined);
    const wrong='{"wines":[{"producer":"Krug","boundingBox":{"xMin":0,"ymax":900}}],"unresolvedCount":0}';
    stubGemini([()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:wrong}]},finishReason:'STOP'}]}),
      {status:200,headers:{'content-type':'application/json'}})]);
    const {response}=await run();
    expect(response.status).toBe(502);
    const failure=logged(error).find(entry=>entry.event==='group-recognition-error');
    expect(failure,'the failure is logged at all').toBeTruthy();
    expect(String(failure!.reply),'and carries what the model actually said').toContain('ymax');
    expect(Number(failure!.replyChars)).toBe(wrong.length);
    expect(JSON.stringify(failure)).not.toContain('inlineData');
    expect(String(failure!.reply).length,'bounded, so a long reply cannot flood the log').toBeLessThanOrEqual(800);
    error.mockRestore();
  });

  it('says nothing about a reply that parsed',async()=>{
    const error=vi.spyOn(console,'error').mockImplementation(()=>undefined);
    stubGemini([()=>geminiReply({wines:[wine()],unresolvedCount:0})]);
    const {response}=await run();
    expect(response.status).toBe(200);
    expect(logged(error).some(entry=>entry.event==='group-recognition-error')).toBe(false);
    error.mockRestore();
  });
});

describe('accounting for unusable or rejected model answers',()=>{
  it('counts tokens from both malformed attempts, without inventing wine units',async()=>{
    stubGemini([()=>geminiReply('not valid recognition')]);
    const {response,stub}=await run();
    expect(response.status).toBe(502);
    const writes=usageWrites(stub);
    expect(writes).toHaveLength(2);
    expect(writes.map(write=>write.args.slice(9,12))).toEqual([[1200,400,0],[1200,400,0]]);
  });
  it('meters a malformed escalation and keeps the usable primary',async()=>{
    stubGemini([()=>geminiReply({wines:[wine()],unresolvedCount:1}),()=>geminiReply('invalid')]);
    const {response,stub}=await run();
    expect(((await response.json()) as {wines:unknown[]}).wines).toHaveLength(1);
    expect(usageWrites(stub).map(write=>write.args.slice(9,12))).toEqual([[1200,400,1],[1200,400,0]]);
  });
  it('keeps the fuller lineup but still meters the rejected escalation',async()=>{
    stubGemini([
      ()=>geminiReply({wines:[wine(),wine({wineName:'Vintage',vintage:2013})],unresolvedCount:1}),
      ()=>geminiReply({wines:[wine()],unresolvedCount:0})
    ]);
    const {response,stub}=await run();
    expect(((await response.json()) as {wines:unknown[]}).wines).toHaveLength(2);
    expect(usageWrites(stub).map(write=>write.args.at(-2))).toEqual([2,0]);
  });
  it('counts successful retry wines once and preserves failed attempt tokens',async()=>{
    stubGemini([()=>geminiReply('invalid'),()=>geminiReply({wines:[wine()],unresolvedCount:0})]);
    const {response,stub}=await run();
    expect(response.status).toBe(200);
    expect(usageWrites(stub).map(write=>write.args.slice(9,12))).toEqual([[1200,400,0],[1200,400,1]]);
  });
});


it('single scans retain primary and malformed escalation token costs',async()=>{
  stubGemini([()=>geminiReply({producer:'Krug',wineName:'Vintage',vintage:2013,confidence:0.6}),()=>geminiReply('invalid')]);
  const {response,stub}=await run(undefined,{single:true});
  expect(response.status).toBe(200);
  expect(usageWrites(stub).map(write=>write.args.slice(9,12))).toEqual([[1200,400,1],[1200,400,0]]);
});
