import { afterEach,describe,expect,it,vi } from 'vitest';
import app from '../../worker/cuveeEntry';
import { sheetEscalationReasons } from '../../worker/sheetRecognitionHandler';
import { sheetPageSchema } from '../../src/features/recognition/sheetSchema';
import { createSession } from '../../src/lib/auth/session';
import { createD1Stub,type StubReply } from './support/d1Stub';

const AUTH_SECRET='test-secret-value-long-enough-for-hmac';

const sheetWine=(overrides:Record<string,unknown>={})=>({
  producer:'Domaine Dujac',wineName:'Morey-Saint-Denis',vintage:2019,country:'France',
  region:'Burgundy',appellation:'Morey-Saint-Denis',grapes:[],grapeBlend:[],style:'red',
  alcoholPercentage:null,priceOptions:[{amount:1280,label:null}],section:'FLIGHT 1',
  lineNumber:1,confidence:.9,...overrides
});

const geminiReply=(result:unknown,finishReason='STOP')=>
  new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(result)}]},finishReason}],
    usageMetadata:{promptTokenCount:2000,candidatesTokenCount:900}}),{status:200,headers:{'content-type':'application/json'}});

const page=(wines:unknown[],overrides:Record<string,unknown>={})=>
  ({wines,currency:'HKD',unresolvedCount:0,truncated:false,lastLineNumber:wines.length,...overrides});

function stubGemini(replies:Array<()=>Response>){
  const bodies:Record<string,unknown>[]=[];
  let index=0;
  vi.stubGlobal('fetch',vi.fn(async(_url:string,init?:RequestInit)=>{
    bodies.push(JSON.parse(String(init?.body??'{}')) as Record<string,unknown>);
    return replies[Math.min(index++,replies.length-1)]();
  }));
  return bodies;
}

async function parse(afterLine?:number,dbReply:(sql:string,args:unknown[])=>StubReply|undefined=()=>undefined){
  const stub=createD1Stub((sql,args)=>{
    if(/SELECT id FROM tastings/.test(sql))return {first:{id:'t1'}};
    if(/FROM wine_experiences we JOIN wines w/.test(sql))return {all:[{wine_id:'w1',producer:'Domaine Dujac',
      wine_name:'Morey-Saint-Denis',vintage:2019,producer_id:'p1',cuvee_id:'c1',price:null,currency:null}]};
    return dbReply(sql,args);
  });
  const form=new FormData();
  form.append('images',new File([new Uint8Array([1,2,3])],'list.jpg',{type:'image/jpeg'}));
  form.append('metadata',JSON.stringify([{capturedAt:null,latitude:null,longitude:null,source:'none'}]));
  if(afterLine)form.append('afterLine',String(afterLine));
  const response=await app.fetch(new Request('https://x/api/tastings/t1/sheet/parse',{
    method:'POST',headers:{authorization:`Bearer ${await createSession('owner',AUTH_SECRET)}`},body:form
  }),{DB:stub.db,AUTH_SECRET,APP_URL:'https://x',APP_PASSWORD:'p',GEMINI_API_KEY:'k'} as never);
  return {response,stub};
}

afterEach(()=>vi.unstubAllGlobals());

describe('reading a wine list into a tasting',()=>{
  it('returns each printed line already matched against the evening',async()=>{
    stubGemini([()=>geminiReply(page([sheetWine(),sheetWine({wineName:'Clos de la Roche',lineNumber:2})]))]);
    const {response}=await parse();
    expect(response.status).toBe(200);
    const body=await response.json() as {currency:string;matches:Array<{status:string}>};
    expect(body.currency).toBe('HKD');
    expect(body.matches.map(match=>match.status)).toEqual(['matched','new']);
  });

  it('asks for far more output than a group photo, because a list is long',async()=>{
    const bodies=stubGemini([()=>geminiReply(page([sheetWine()]))]);
    await parse();
    expect((bodies[0].generationConfig as Record<string,unknown>).maxOutputTokens).toBe(32768);
  });

  it('reports a page that was cut short, with where to resume',async()=>{
    // A sheet read 180 of 200 wines looks exactly like a sheet of 180. This is
    // the difference between continuing and losing the tail.
    stubGemini([()=>geminiReply(page([sheetWine({lineNumber:40})],{truncated:true,lastLineNumber:40}))]);
    const {response}=await parse();
    const body=await response.json() as {truncated:boolean;resumeAfterLine:number};
    expect(body.truncated).toBe(true);
    expect(body.resumeAfterLine).toBe(40);
  });

  it('treats an output budget stop as cut short even when the model says otherwise',async()=>{
    stubGemini([()=>geminiReply(page([sheetWine({lineNumber:12})]),'MAX_TOKENS')]);
    const {response}=await parse();
    expect((await response.json() as {truncated:boolean}).truncated).toBe(true);
  });

  it('passes a continuation line into the prompt',async()=>{
    const bodies=stubGemini([()=>geminiReply(page([sheetWine({lineNumber:41})]))]);
    await parse(40);
    const contents=bodies[0].contents as Array<{parts:Array<{text?:string}>}>;
    expect(contents[0].parts[0].text).toContain('AFTER line 40');
  });

  it('meters the page as a tasting sheet, per wine',async()=>{
    stubGemini([()=>geminiReply(page([sheetWine(),sheetWine({wineName:'Clos',lineNumber:2})]))]);
    const {stub}=await parse();
    const writes=stub.calls.filter(call=>/INSERT INTO ai_usage_events/.test(call.sql));
    expect(writes).toHaveLength(1);
    expect(writes[0].args[2]).toBe('scan_sheet');
    expect(writes[0].args.at(-2)).toBe(2);
  });

  it('refuses a tasting that is not yours before spending anything on Gemini',async()=>{
    const calls=stubGemini([()=>geminiReply(page([]))]);
    const stub=createD1Stub();
    const form=new FormData();
    form.append('images',new File([new Uint8Array([1])],'list.jpg',{type:'image/jpeg'}));
    const response=await app.fetch(new Request('https://x/api/tastings/nope/sheet/parse',{
      method:'POST',headers:{authorization:`Bearer ${await createSession('owner',AUTH_SECRET)}`},body:form
    }),{DB:stub.db,AUTH_SECRET,APP_URL:'https://x',APP_PASSWORD:'p',GEMINI_API_KEY:'k'} as never);
    expect(response.status).toBe(404);
    expect(calls).toHaveLength(0);
  });

  it('refuses an unauthenticated caller',async()=>{
    const stub=createD1Stub();
    const response=await app.fetch(new Request('https://x/api/tastings/t1/sheet/parse',{method:'POST',body:new FormData()}),
      {DB:stub.db,AUTH_SECRET,APP_URL:'https://x',APP_PASSWORD:'p'} as never);
    expect(response.status).toBe(401);
  });
});

describe('when a wine list is worth a second, stronger look',()=>{
  it('escalates on nothing read, unread lines, or a shaky line',()=>{
    const clean=sheetPageSchema.parse(page([sheetWine()]));
    expect(sheetEscalationReasons(clean)).toEqual([]);
    expect(sheetEscalationReasons(sheetPageSchema.parse(page([])))).toContain('no-wines');
    expect(sheetEscalationReasons(sheetPageSchema.parse(page([sheetWine()],{unresolvedCount:3})))).toContain('unresolved-wines');
    expect(sheetEscalationReasons(sheetPageSchema.parse(page([sheetWine({confidence:.4})])))).toContain('low-confidence');
  });

  it('does not escalate a list that simply has no prices on it',()=>{
    // An unpriced handout is an ordinary lineup, not a bad read, and paying for
    // a second model pass on every one of them would be waste.
    const unpriced=sheetPageSchema.parse(page([sheetWine({priceOptions:[]})],{currency:null}));
    expect(sheetEscalationReasons(unpriced)).toEqual([]);
  });
});
