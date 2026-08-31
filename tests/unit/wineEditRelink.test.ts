import { describe,expect,it } from 'vitest';
import app from '../../worker/cuveeEntry';
import { createSession } from '../../src/lib/auth/session';
import { createD1Stub,type StubReply } from './support/d1Stub';

const AUTH_SECRET='test-secret-value-long-enough-for-hmac';

/** Everything the wine schema insists on, so the edit itself is never the failure. */
const wineBody=(overrides:Record<string,unknown>={})=>({
  producer:'Bibi Graetz',wineName:'Testamatta',vintage:2016,country:'Italy',region:'Tuscany',
  appellation:null,recognizedRegion:null,recognizedAppellation:null,classification:null,
  classificationOverride:null,grapes:['Sangiovese'],grapeBlend:[],wineStyle:'red',
  alcoholPercentage:null,tastingNotes:'',rating:null,tastingDate:null,tastingName:null,event:null,
  venue:null,locationName:null,latitude:null,longitude:null,price:null,currency:null,tags:[],
  recognitionStatus:'complete',recognitionConfidence:null,...overrides
});

/** The wine as stored before the edit: named Testamatta, filed under an appellation. */
const stored={wine_name:'Testamatta',appellation:'Toscana IGT',wine_style:'red',country:'Italy'};

async function edit(body:Record<string,unknown>,before:Record<string,unknown>=stored,
  reply:(sql:string,args:unknown[])=>StubReply|undefined=()=>undefined){
  const stub=createD1Stub((sql,args)=>{
    if(/SELECT wine_name,appellation,wine_style,country FROM wines/.test(sql))return {first:before};
    if(/SELECT producer_id FROM wines/.test(sql))return {first:{producer_id:'p1'}};
    if(/SELECT producer,producer_id,cuvee_id,country FROM wines/.test(sql))return {first:{producer:'Bibi Graetz',producer_id:'p1',cuvee_id:'c1',country:'Italy'}};
    if(/FROM cuvees c WHERE c.owner_id=\? AND c.producer_id=\?/.test(sql))return {all:[]};
    return reply(sql,args);
  });
  const response=await app.fetch(new Request('https://x/api/wines/w1',{
    method:'PUT',
    headers:{authorization:`Bearer ${await createSession('owner',AUTH_SECRET)}`,'content-type':'application/json'},
    body:JSON.stringify(body)
  }),{DB:stub.db,AUTH_SECRET,APP_URL:'https://x',APP_PASSWORD:'p',GEMINI_API_KEY:'k',
    ASSETS:{fetch:async()=>new Response('spa')}} as never,
    {waitUntil:()=>undefined,passThroughOnException:()=>undefined} as never);
  return {response,stub,
    cleared:stub.calls.some(call=>/UPDATE wines SET .*cuvee_id=NULL/.test(call.sql.replace(/\s+/g,' '))),
    settled:stub.calls.some(call=>/FROM cuvees c WHERE c.owner_id=\? AND c.producer_id=\?/.test(call.sql))};
}

describe('editing a wine re-resolves the cuvée it belongs to',()=>{
  // Reported as two Testamattas under Bibi Graetz that would not come together.
  // A cuvée is keyed on the name, the appellation and the style together, but
  // only a rename cleared the link - so correcting an appellation left the wine
  // attached to the cuvée the old one had created, and ensureWineIdentity does
  // nothing for a wine that already has a link. The duplicate could not be
  // healed by any edit.

  it('lets go of the old cuvée when the appellation is corrected',async()=>{
    const {response,cleared,settled}=await edit(wineBody({appellation:null}));
    expect(response.status).toBe(200);
    expect(cleared,'the stale link is dropped').toBe(true);
    expect(settled,'and the producer is settled afterwards').toBe(true);
  });

  it('lets go when the style is corrected',async()=>{
    const {cleared}=await edit(wineBody({appellation:'Toscana IGT',wineStyle:'white'}));
    expect(cleared).toBe(true);
  });

  it('still lets go on a rename, as it always did',async()=>{
    const {cleared,stub}=await edit(wineBody({wineName:'Testamatta Bianco',appellation:'Toscana IGT'}));
    expect(cleared).toBe(true);
    // a rename also records what the label actually said
    expect(stub.calls.some(call=>/recognized_wine_name=\?/.test(call.sql))).toBe(true);
  });

  it('leaves a wine alone when nothing about its identity moved',async()=>{
    // Editing a tasting note must not re-key the wine, and must not pay for a
    // sweep that reads every cuvée the producer has.
    const {cleared,settled}=await edit(wineBody({appellation:'Toscana IGT',tastingNotes:'Lovely'}));
    expect(cleared).toBe(false);
    expect(settled,'no sweep on an edit that changed nothing identity-shaped').toBe(false);
  });

  it('does not read a missing field as a cleared one',async()=>{
    // A caller that omits appellation is not the same as one that emptied it;
    // treating the two alike would re-key a wine on every partial save.
    const partial=wineBody();delete (partial as Record<string,unknown>).appellation;
    const {cleared}=await edit(partial);
    expect(cleared).toBe(false);
  });

  it('ignores a difference only in wording',async()=>{
    // "Toscana  IGT" and "toscana igt" are the same appellation, and churning
    // the link over spacing would undo the grouping it is meant to protect.
    const {cleared}=await edit(wineBody({appellation:'toscana  igt'}));
    expect(cleared).toBe(false);
  });
});

describe('correcting a wine country reaches its producer',()=>{
  // Reported as one English estate filed under United Kingdom while its
  // neighbours sat under England. A producer's home country is seeded from the
  // first wine ever filed under it and then never revisited, so amending the
  // wine changed wines.country and nothing else - the producers page kept the
  // country the producer was first seen in, whatever the wine said afterwards.

  const homeRead=/SELECT home_country,researched_at FROM producers/;
  const settleReply=(sql:string)=>homeRead.test(sql)?{first:{home_country:'England',researched_at:null}}
    :/GROUP BY trim\(country\)/.test(sql)?{all:[{country:'United Kingdom',wines:1}]}:undefined;
  const rewrote=(stub:{calls:Array<{sql:string}>})=>
    stub.calls.some(call=>/UPDATE producers SET home_country=/.test(call.sql.replace(/\s+/g,' ')));

  it('settles the producer when the country is corrected',async()=>{
    const {stub}=await edit(wineBody({country:'France',region:null}),{...stored,country:'Italy'},settleReply);
    expect(rewrote(stub)).toBe(true);
  });

  it('settles it for a change of spelling too, which is the edit that unsticks it',async()=>{
    // England and the United Kingdom are one country, so nothing about the wine
    // has moved - but this is exactly the correction someone makes to pull a
    // producer out of the wrong panel, and it has to do something.
    const {stub}=await edit(wineBody({country:'United Kingdom',region:null}),{...stored,country:'England'},settleReply);
    expect(rewrote(stub)).toBe(true);
    expect(stub.writes().some(call=>call.args[0]==='United Kingdom')).toBe(true);
  });

  it('spends nothing on an edit that left the country where it was',async()=>{
    const {stub}=await edit(wineBody({tastingNotes:'Lovely'}));
    expect(stub.matching(homeRead)).toHaveLength(0);
  });

  it('does not read a missing country as a cleared one',async()=>{
    const partial=wineBody();delete (partial as Record<string,unknown>).country;
    const {stub}=await edit(partial);
    expect(stub.matching(homeRead)).toHaveLength(0);
  });
});
