import { describe,expect,it } from 'vitest';
import { setCuveePrimaryName } from '../../src/lib/cuvees/primaryName';
import { cuveeIdentitySignature } from '../../src/lib/cuvees/entities';
import { createD1Stub,type StubReply } from './support/d1Stub';
import app from '../../worker/cuveeEntry';
import { createSession } from '../../src/lib/auth/session';

const AUTH_SECRET='test-secret-value-long-enough-for-hmac';

const PRODUCER='Cusumano';
const SIGNATURE=cuveeIdentitySignature('Feudo di Mezzo','Etna','red',[PRODUCER,'Alta Mora']);
const cuvee={id:'c1',producer_id:'p1',canonical_name:'Feudo di Mezzo',signature_key:SIGNATURE,
  appellation:'Etna',wine_style:'red',catalog_backed:1,created_at:'2025-10-31T00:00:00.000Z'};

/**
 * Cusumano makes its Etna wines under the Alta Mora name, which the journal
 * knows as a producer alias — so "Alta Mora Feudo di Mezzo" and "Feudo di
 * Mezzo" resolve to the same cuvée, and the label says the longer one.
 */
function cuveeReply(sql:string):StubReply|undefined{
  if(/FROM cuvees WHERE owner_id=\? AND id=\?/.test(sql))return {first:cuvee};
  if(/SELECT canonical_name FROM producers/.test(sql))return {first:{canonical_name:PRODUCER}};
  if(/FROM producer_aliases/.test(sql))return {all:[{display_alias:'Alta Mora'}]};
  if(/FROM cuvee_aliases a JOIN cuvees c/.test(sql))return {first:cuvee,all:[cuvee]};
  if(/SELECT \* FROM cuvees WHERE owner_id=\? AND producer_id=\?/.test(sql))return {all:[cuvee],first:cuvee};
  if(/SELECT DISTINCT vintage FROM wines/.test(sql))return {all:[{vintage:2020},{vintage:2017}]};
  if(/count\(\*\) AS count FROM wines/.test(sql))return {first:{count:2}};
  // No other cuvée holds the identity the new name would key on.
  if(/SELECT id FROM cuvees WHERE owner_id=\? AND producer_id=\? AND signature_key=\? AND id<>\?/.test(sql))return {first:null};
  return undefined;
}

const stub=()=>createD1Stub(cuveeReply);

describe('naming a cuvée the way the label does',()=>{
  it('keeps the wording asked for, even when it opens with a producer alias',async()=>{
    // Reported as the primary-name checkbox doing nothing: the request was
    // reduced to the name the cuvée already had and returned as a success.
    const db=stub();
    const result=await setCuveePrimaryName(db.db,'owner','c1','Alta Mora Feudo di Mezzo');
    expect(result.canonicalName).toBe('Alta Mora Feudo di Mezzo');
    const renames=db.writes().filter(call=>/UPDATE cuvees SET canonical_name=/.test(call.sql));
    expect(renames).toHaveLength(1);
    expect(renames[0].args[0]).toBe('Alta Mora Feudo di Mezzo');
  });

  it('carries every vintage of the cuvée with it',async()=>{
    const db=stub();
    await setCuveePrimaryName(db.db,'owner','c1','Alta Mora Feudo di Mezzo');
    const wines=db.writes().filter(call=>/UPDATE wines SET wine_name=/.test(call.sql));
    expect(wines).toHaveLength(1);
    expect(wines[0].args[0]).toBe('Alta Mora Feudo di Mezzo');
  });

  it('leaves the old wording searchable as an alias',async()=>{
    const db=stub();
    await setCuveePrimaryName(db.db,'owner','c1','Alta Mora Feudo di Mezzo');
    const aliases=db.writes().filter(call=>/INSERT INTO cuvee_aliases/.test(call.sql));
    expect(aliases.map(call=>call.args[5])).toEqual(['Feudo di Mezzo','Alta Mora Feudo di Mezzo']);
  });

  it('keeps the identity key the name resolves on, so the cuvée does not fork',async()=>{
    const db=stub();
    await setCuveePrimaryName(db.db,'owner','c1','Alta Mora Feudo di Mezzo');
    const [rename]=db.writes().filter(call=>/UPDATE cuvees SET canonical_name=/.test(call.sql));
    expect(rename.args[1]).toBe(SIGNATURE);
  });

  it('does nothing at all when the name asked for is the one it already has',async()=>{
    const db=stub();
    const result=await setCuveePrimaryName(db.db,'owner','c1','  Feudo di Mezzo  ');
    expect(result.canonicalName).toBe('Feudo di Mezzo');
    expect(db.writes()).toHaveLength(0);
  });

  it('still refuses an empty name',async()=>{
    const db=stub();
    await expect(setCuveePrimaryName(db.db,'owner','c1','   ')).rejects.toThrow(/required/i);
  });

});

describe('the primary-name checkbox on the wine form',()=>{
  const wineBody={producer:PRODUCER,wineName:'Alta Mora Feudo di Mezzo',vintage:2020,country:'Italy',region:'Sicily',
    appellation:'Etna',recognizedRegion:null,recognizedAppellation:null,classification:null,classificationOverride:null,
    grapes:['Nerello Mascalese'],grapeBlend:[],wineStyle:'red',alcoholPercentage:null,tastingNotes:'',rating:null,
    tastingDate:null,tastingName:null,event:null,venue:null,locationName:null,latitude:null,longitude:null,
    price:null,currency:null,tags:[],recognitionStatus:'complete',recognitionConfidence:null,preferCuveePrimaryName:true};

  async function save(body:Record<string,unknown>){
    const db=createD1Stub(sql=>{
      if(/SELECT wine_name,appellation,wine_style,country FROM wines/.test(sql))
        return {first:{wine_name:'Feudo di Mezzo',appellation:'Etna',wine_style:'red',country:'Italy'}};
      if(/SELECT cuvee_id FROM wines WHERE owner_id=\? AND id=\?/.test(sql))return {first:{cuvee_id:'c1'}};
      if(/SELECT producer,producer_id,cuvee_id,country FROM wines/.test(sql))
        return {first:{producer:PRODUCER,producer_id:'p1',cuvee_id:'c1',country:'Italy'}};
      if(/SELECT producer_id FROM wines WHERE owner_id=\? AND id=\?/.test(sql))return {first:{producer_id:'p1'}};
      return cuveeReply(sql);
    });
    const response=await app.fetch(new Request('https://x/api/wines/w1',{
      method:'PUT',
      headers:{authorization:`Bearer ${await createSession('owner',AUTH_SECRET)}`,'content-type':'application/json'},
      body:JSON.stringify(body)
    }),{DB:db.db,AUTH_SECRET,APP_URL:'https://x',APP_PASSWORD:'p',GEMINI_API_KEY:'k',
      ASSETS:{fetch:async()=>new Response('spa')}} as never,
      {waitUntil:()=>undefined,passThroughOnException:()=>undefined} as never);
    return {response,db};
  }

  it('renames the cuvée the wine belongs to',async()=>{
    const {response,db}=await save(wineBody);
    expect(response.status).toBe(200);
    const [rename]=db.writes().filter(call=>/UPDATE cuvees SET canonical_name=/.test(call.sql));
    expect(rename?.args[0]).toBe('Alta Mora Feudo di Mezzo');
  });

  it('leaves the cuvée alone when the box is not ticked',async()=>{
    const {db}=await save({...wineBody,preferCuveePrimaryName:false});
    expect(db.writes().filter(call=>/UPDATE cuvees SET canonical_name=/.test(call.sql))).toHaveLength(0);
  });
});
