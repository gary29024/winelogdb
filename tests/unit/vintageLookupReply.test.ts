import { readFileSync } from 'node:fs';
import { describe,expect,it,vi,beforeEach,afterEach } from 'vitest';
import { researchVintageWindow } from '../../worker/vintageWindowHandler';
import { createD1Stub } from './support/d1Stub';

/**
 * A real reply, captured from the running app.
 *
 * The search plainly ran: every source is a vertexaisearch grounding-redirect
 * link, which only the search tool issues. But the reply carries no
 * groundingMetadata block at all, and the handler read its sources from there
 * and nowhere else - so it overwrote three real citations with an empty list
 * and threw the answer away as ungrounded. Every lookup failed this way.
 */
const reply=JSON.parse(readFileSync('tests/unit/fixtures/vintageLookupReply.json','utf8')) as Record<string,unknown>;

const subject={country:'France',region:'Burgundy',appellation:'Chambertin-Clos de Bèze',vintage:2011,
  wineStyle:'red',classification:'grand_cru'};

function env(){
  const db=createD1Stub(sql=>/FROM vintage_windows/.test(sql)
    ?{first:{country:'France',region:'Burgundy',appellation:'Chambertin-Clos de Bèze',vintage:2011,
      wine_style:'red',shift_from:-4,shift_to:5,vintage_note:'n',sources_json:'[]',model:'m',researched_at:'x'}}
    :undefined);
  return {db,env:{DB:db.db,GEMINI_API_KEY:'k'} as never};
}

describe('the reply that came back from a real lookup',()=>{
  beforeEach(()=>vi.unstubAllGlobals());
  afterEach(()=>vi.unstubAllGlobals());

  it('is accepted, not thrown away as ungrounded',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify(reply),{status:200,headers:{'content-type':'application/json'}})));
    const {db,env:bindings}=env();
    await expect(researchVintageWindow(bindings,'owner',subject,'r1')).resolves.toBeTruthy();
    const [write]=db.writes().filter(call=>/INSERT INTO vintage_windows/.test(call.sql));
    expect(write,'the answer is stored').toBeTruthy();
    // 2011 + the Burgundy grand cru baseline 8-25 gives 2019-2036; the reply
    // says 2015-2028, so a difficult year opens the window four years earlier
    // and closes it eight years sooner. That is the shift, and it is what is
    // stored - not the years, which belong to this wine alone.
    expect(write.args[8]).toBe(-4);
    expect(write.args[9]).toBe(-8);
  });

  it('keeps the citations the reply carried',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify(reply),{status:200,headers:{'content-type':'application/json'}})));
    const {db,env:bindings}=env();
    await researchVintageWindow(bindings,'owner',subject,'r1');
    const [write]=db.writes().filter(call=>/INSERT INTO vintage_windows/.test(call.sql));
    const sources=JSON.parse(String(write.args[11])) as Array<{url:string}>;
    expect(sources).toHaveLength(3);
    expect(sources.every(source=>source.url.includes('vertexaisearch.cloud.google.com'))).toBe(true);
  });

  it('still refuses an answer the search never touched',async()=>{
    // The guard that matters: sources the model made up carry no redirect, and
    // an answer from memory is what this whole pairing exists to exclude.
    const invented={...reply,candidates:[{content:{parts:[{text:JSON.stringify({drinkFrom:2015,drinkTo:2028,note:'n',
      sources:[{title:'Some wine page',url:'https://example.com/burgundy-2011'}]})}]}}]};
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify(invented),{status:200,headers:{'content-type':'application/json'}})));
    const {env:bindings}=env();
    await expect(researchVintageWindow(bindings,'owner',subject,'r1')).rejects.toThrow(/Nothing was retrieved/);
  });
});
