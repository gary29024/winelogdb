import { readFileSync } from 'node:fs';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { researchVintageWindow } from '../../worker/vintageWindowHandler';
import { createD1Stub } from './support/d1Stub';

/** The captured reply from a real lookup: three grounding-redirect citations. */
const grounded=JSON.parse(readFileSync('tests/unit/fixtures/vintageLookupReply.json','utf8')) as Record<string,unknown>;

/**
 * A well-formed answer whose sources are the model's own invention: no
 * vertexaisearch redirect behind any of them, so nothing was retrieved and the
 * handler will not keep it.
 */
const fromMemory={
  candidates:[{content:{parts:[{text:JSON.stringify({drinkFrom:2015,drinkTo:2028,note:'A plausible sentence.',
    sources:[{title:'Some wine page',url:'https://example.com/burgundy-2011'}]})}]}}],
  usageMetadata:{promptTokenCount:300,candidatesTokenCount:400}
};

const subject={country:'France',region:'Burgundy',appellation:'Chambertin-Clos de Bèze',vintage:2011,
  wineStyle:'red',classification:'grand_cru'};

/** Which model a request went to, read off the URL the transport built. */
const modelOf=(url:string)=>url.match(/models\/([^:]+):generateContent/)?.[1]??'';

function world(...replies:Array<Record<string,unknown>|number>){
  const db=createD1Stub(sql=>/FROM vintage_windows/.test(sql)
    ?{first:{country:'France',region:'Burgundy',appellation:null,vintage:2011,wine_style:'red',
      shift_from:-4,shift_to:-8,vintage_note:'n',sources_json:'[]',model:'m',researched_at:'x'}}
    :undefined);
  const seen:string[]=[];
  const fetched=vi.fn(async(input:RequestInfo|URL)=>{
    seen.push(modelOf(String(input)));
    const reply=replies[Math.min(seen.length-1,replies.length-1)];
    return typeof reply==='number'
      ?new Response('upstream said no',{status:reply})
      :new Response(JSON.stringify(reply),{status:200,headers:{'content-type':'application/json'}});
  });
  vi.stubGlobal('fetch',fetched);
  return {db,seen,fetched,env:{DB:db.db,GEMINI_API_KEY:'k'} as never};
}

const stored=(db:ReturnType<typeof createD1Stub>)=>
  db.writes().filter(call=>/INSERT INTO vintage_windows/.test(call.sql));
const metered=(db:ReturnType<typeof createD1Stub>)=>
  db.writes().filter(call=>/INSERT INTO ai_usage_events/.test(call.sql)).map(call=>({model:call.args[5],units:call.args[11]}));

/** A grounded reply that says something before it answers, which they do. */
const answer={drinkFrom:2021,drinkTo:2036,note:'A cool year.',
  sources:[{title:'A page',url:'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc'}]};
const wrapped=(text:string,finishReason='STOP')=>({
  candidates:[{content:{parts:[{text}]},finishReason}],
  usageMetadata:{promptTokenCount:300,candidatesTokenCount:400}
});

describe('reading the JSON out of a grounded reply',()=>{
  beforeEach(()=>vi.unstubAllGlobals());
  afterEach(()=>vi.unstubAllGlobals());

  it('takes the answer whatever the model wrapped it in',async()=>{
    // Reported as "The vintage lookup did not come back as JSON". A grounded
    // model writes a sentence first, or fences the object mid-reply, or appends
    // its citations after it - and the answer was thrown away every time.
    for(const text of [
      `Here is what I found.\n${JSON.stringify(answer)}`,
      `Sure:\n\`\`\`json\n${JSON.stringify(answer)}\n\`\`\`\nHope that helps.`,
      `${JSON.stringify(answer)}\n\nSources: frw.co.uk, drouhin.com`
    ]){
      const {db,seen,env}=world(wrapped(text));
      await expect(researchVintageWindow(env,'owner',subject,'r1')).resolves.toBeTruthy();
      expect(seen,'and the cheap model answered, so nothing escalated').toEqual(['gemini-3.1-flash-lite']);
      expect(stored(db)).toHaveLength(1);
      vi.unstubAllGlobals();
    }
  });

  it('tells a reply that ran out of room from one it cannot read',async()=>{
    // Different failures wanting different answers: a truncated reply needs
    // more room, an unreadable one needs a different model. Thinking tokens
    // count against the cap, so the model that thinks is the one that hits it.
    const {env}=world(wrapped('{"drinkFrom":2021,"drinkTo":','MAX_TOKENS'));
    await expect(researchVintageWindow(env,'owner',subject,'r1'))
      .rejects.toThrow(/ran out of room/);
  });

  it('gives the model that thinks the larger share of it',async()=>{
    const handler=(await import('node:fs')).readFileSync('worker/vintageWindowHandler.ts','utf8');
    const primary=Number(handler.match(/const OUTPUT_TOKENS=([\d_]+)/)![1].replace(/_/g,''));
    const escalation=Number(handler.match(/const ESCALATION_OUTPUT_TOKENS=([\d_]+)/)![1].replace(/_/g,''));
    expect(primary).toBeGreaterThan(2048);
    expect(escalation).toBeGreaterThan(primary);
  });
});

describe('asking the cheap model first',()=>{
  beforeEach(()=>vi.unstubAllGlobals());
  afterEach(()=>vi.unstubAllGlobals());

  it('spends nothing on the stronger model when flash-lite grounds',async()=>{
    // The common case, and the whole reason for the pairing: the work is
    // retrieval, and the cheap model retrieves.
    const {db,seen,env}=world(grounded);
    await expect(researchVintageWindow(env,'owner',subject,'r1')).resolves.toBeTruthy();
    expect(seen).toEqual(['gemini-3.1-flash-lite']);
    expect(stored(db)[0].args[12],'and the row records which model answered').toBe('gemini-3.1-flash-lite');
    expect(metered(db)).toEqual([{model:'gemini-3.1-flash-lite',units:1}]);
  });

  it('escalates once when nothing came back from the search',async()=>{
    // An ungrounded answer is thrown away, so it would have cost a call and
    // returned nothing. That is exactly when the stronger model is worth paying
    // for - and the only time it is asked.
    const {db,seen,env}=world(fromMemory,grounded);
    await expect(researchVintageWindow(env,'owner',subject,'r1')).resolves.toBeTruthy();
    expect(seen).toEqual(['gemini-3.1-flash-lite','gemini-3.7-flash']);
    expect(stored(db)[0].args[12]).toBe('gemini-3.7-flash');
  });

  it('meters the attempt that failed, because it still billed',async()=>{
    // Tokens were spent and a search was run on the way to being refused.
    // Leaving that out is what would make the pairing look cheaper than it is.
    const {db,env}=world(fromMemory,grounded);
    await researchVintageWindow(env,'owner',subject,'r1');
    // One run, two calls: the wine is counted once, on the answer that was kept.
    expect(metered(db)).toEqual([
      {model:'gemini-3.1-flash-lite',units:0},
      {model:'gemini-3.7-flash',units:1}
    ]);
  });

  it('gives up after the second model, not after the third',async()=>{
    const {db,seen,env}=world(fromMemory);
    await expect(researchVintageWindow(env,'owner',subject,'r1'))
      .rejects.toThrow(/Nothing was retrieved for this vintage/);
    expect(seen).toEqual(['gemini-3.1-flash-lite','gemini-3.7-flash']);
    expect(stored(db),'and nothing is stored when neither model retrieved anything').toHaveLength(0);
  });

  it('tries the other model when the first one errors rather than answers',async()=>{
    // A refusal from the provider is a reason to ask the other one too: the
    // caller is waiting on a button either way.
    const {seen,env}=world(503,grounded);
    await expect(researchVintageWindow(env,'owner',subject,'r1')).resolves.toBeTruthy();
    expect(seen).toEqual(['gemini-3.1-flash-lite','gemini-3.7-flash']);
  });

  it('reports what the second model said when both refuse',async()=>{
    const {env}=world(503,500);
    await expect(researchVintageWindow(env,'owner',subject,'r1')).rejects.toThrow(/Vintage lookup failed \(500\)/);
  });
});
