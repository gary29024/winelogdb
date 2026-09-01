import { describe,expect,it } from 'vitest';
import app from '../../worker/cuveeEntry';
import { createSession } from '../../src/lib/auth/session';
import { createD1Stub,type StubReply } from './support/d1Stub';

const AUTH_SECRET='test-secret-value-long-enough-for-hmac';
const env=(db:D1Database)=>({DB:db,AUTH_SECRET,APP_URL:'https://x',APP_PASSWORD:'p',GEMINI_API_KEY:'k',
  WINE_IMAGES:{put:async()=>undefined,delete:async()=>undefined},
  ASSETS:{fetch:async()=>new Response('spa')}} as never);
const ctx={waitUntil:()=>undefined,passThroughOnException:()=>undefined} as never;

const holdingRow={id:'h1',producer_id:'p1',cuvee_id:'c1',producer:'Cusumano',wine_name:'Feudo di Mezzo',vintage:2020,
  country:'Italy',region:'Sicily',appellation:'Etna',wine_style:'red',classification:null,
  bottles:6,bottle_size_ml:750,purchase_price:280,currency:'HKD',purchased_at:'2026-08-01',
  merchant:null,location:'Rack 3',notes:'',created_at:'2026-08-01T00:00:00.000Z',updated_at:'2026-08-01T00:00:00.000Z'};

async function call(path:string,init:RequestInit,reply:(sql:string)=>StubReply|undefined=()=>undefined){
  const stub=createD1Stub(sql=>reply(sql));
  const response=await app.fetch(new Request(`https://x${path}`,{
    ...init,
    headers:{authorization:`Bearer ${await createSession('owner',AUTH_SECRET)}`,...(init.headers??{})}
  }),env(stub.db),ctx);
  return {response,stub};
}

const wineBody={producer:'Cusumano',wineName:'Feudo di Mezzo',vintage:2020,country:'Italy',region:'Sicily',
  appellation:'Etna',recognizedRegion:null,recognizedAppellation:null,classification:null,classificationOverride:null,
  grapes:[],grapeBlend:[],wineStyle:'red',alcoholPercentage:null,tastingNotes:'',rating:92,tastingDate:null,
  tastingName:null,event:null,venue:null,locationName:null,latitude:null,longitude:null,price:null,currency:null,
  tags:[],recognitionStatus:'complete',recognitionConfidence:null};

describe('the cellar routes',()=>{
  it('turns bottles away without touching a wines row',async()=>{
    const {response,stub}=await call('/api/cellar',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({producer:'Cusumano',wineName:'Feudo di Mezzo',vintage:2020,appellation:'Etna',wineStyle:'red',bottles:6,bottleSizeMl:750})
    },sql=>/FROM cellar_holdings/.test(sql)?{first:null}:undefined);
    expect(response.status).toBe(201);
    expect(stub.writes().some(call=>/INTO wines|UPDATE wines/.test(call.sql))).toBe(false);
  });

  it('refuses an entry with no bottles in it',async()=>{
    const {response}=await call('/api/cellar',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({producer:'Cusumano',wineName:'Feudo di Mezzo',bottles:0})
    });
    expect(response.status).toBe(400);
  });

  it('removing bottles logs no tasting: sold is not drunk',async()=>{
    const {response,stub}=await call('/api/cellar/h1',{method:'DELETE'},()=>({changes:1}));
    expect(response.status).toBe(204);
    expect(stub.writes().every(call=>/DELETE FROM cellar_holdings/.test(call.sql))).toBe(true);
  });
});

describe('opening a bottle',()=>{
  const openReply=(sql:string):StubReply|undefined=>{
    if(/FROM cellar_holdings/.test(sql))return {first:holdingRow,changes:1};
    if(/SELECT producer,producer_id,cuvee_id,country FROM wines/.test(sql))return {first:{producer:'Cusumano',producer_id:'p1',cuvee_id:'c1',country:'Italy'}};
    return undefined;
  };

  it('takes the bottle only once the wine is saved',async()=>{
    const {response,stub}=await call('/api/wines?holding=h1',{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(wineBody)
    },openReply);
    expect(response.status).toBe(201);
    expect(stub.writes().some(call=>/UPDATE cellar_holdings SET bottles=bottles-1/.test(call.sql))).toBe(true);
    // and the wine itself is written, so the bottle is accounted for
    expect(stub.writes().some(call=>/INSERT INTO wines/.test(call.sql))).toBe(true);
  });

  it('takes nothing when no holding was named',async()=>{
    const {stub}=await call('/api/wines',{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(wineBody)
    },openReply);
    expect(stub.writes().some(call=>/cellar_holdings/.test(call.sql))).toBe(false);
  });

  it('still saves the wine when the holding has already gone',async()=>{
    // The last bottle taken on another device is not a reason to lose the
    // tasting that was just written.
    const {response}=await call('/api/wines?holding=h1',{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(wineBody)
    },sql=>/cellar_holdings/.test(sql)?{changes:0,first:null}:openReply(sql));
    expect(response.status).toBe(201);
  });
});
