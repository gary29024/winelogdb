import { describe,expect,it } from 'vitest';
import app from '../../worker/cuveeEntry';
import { createSession } from '../../src/lib/auth/session';
import { createD1Stub,type StubReply } from './support/d1Stub';

const AUTH_SECRET='test-secret-value-long-enough-for-hmac';
const WINE='00000000-0000-4000-8000-000000000001';

async function call(path:string,init:RequestInit&{anonymous?:boolean}={},reply:(sql:string,args:unknown[])=>StubReply|undefined=()=>undefined){
  const stub=createD1Stub(reply);
  const headers=new Headers(init.headers);
  if(!init.anonymous)headers.set('authorization',`Bearer ${await createSession('owner',AUTH_SECRET)}`);
  const response=await app.fetch(new Request(`https://x${path}`,{...init,headers}),
    {DB:stub.db,WINE_IMAGES:{delete:async()=>undefined} as unknown as R2Bucket,AUTH_SECRET,APP_URL:'https://x',APP_PASSWORD:'p'} as never);
  return {response,stub};
}

describe('the tastings API',()=>{
  it('answers "nothing is open" with 200 rather than 404',async()=>{
    // The client reads this on every app load. A 404 for the ordinary case
    // would turn a normal answer into an error path.
    const {response}=await call('/api/tastings/active');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({tasting:null});
  });

  it('reads the literal /active before it reads an id',async()=>{
    // Registered the other way round, "active" would be looked up as a tasting
    // whose id is the string "active".
    const {stub}=await call('/api/tastings/active');
    expect(stub.sql().some(sql=>/SELECT \* FROM tastings WHERE owner_id=\? AND id=\?/.test(sql))).toBe(false);
  });

  it('refuses an unauthenticated caller',async()=>{
    const {response}=await call('/api/tastings/active',{anonymous:true});
    expect(response.status).toBe(401);
  });

  it('needs a name and an ISO date to start one',async()=>{
    const body=(payload:unknown)=>({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    expect((await call('/api/tastings',body({tastingDate:'2026-08-28'}))).response.status).toBe(400);
    expect((await call('/api/tastings',body({name:'Dinner',tastingDate:'28/08/2026'}))).response.status).toBe(400);
  });

  it('adds wines to a closed tasting',async()=>{
    // The printed wine list usually turns up after everyone has gone home, so
    // attaching must not require reopening the evening.
    const {response}=await call('/api/tastings/t1/wines',
      {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ids:[WINE]})},
      sql=>{
        if(/SELECT id FROM tastings/.test(sql))return {first:{id:'t1'}};
        if(/count\(\*\) AS count FROM wines/.test(sql))return {first:{count:1}};
        return undefined;
      });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({attached:1});
  });

  it('reports a wine that is not yours as not found',async()=>{
    const {response}=await call('/api/tastings/t1/wines',
      {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ids:[WINE]})},
      sql=>{
        if(/SELECT id FROM tastings/.test(sql))return {first:{id:'t1'}};
        if(/count\(\*\) AS count FROM wines/.test(sql))return {first:{count:0}};
        return undefined;
      });
    expect(response.status).toBe(404);
  });

  it('touches only wine_experiences when wines are attached',async()=>{
    // Where a bottle was poured is a fact about the pour. Writing wines.venue
    // would bump the owner revision through 0030's triggers and force a full
    // Passport recompute for a fourteen-wine attach.
    const {stub}=await call('/api/tastings/t1/wines',
      {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ids:[WINE]})},
      sql=>{
        if(/SELECT id FROM tastings/.test(sql))return {first:{id:'t1'}};
        if(/count\(\*\) AS count FROM wines/.test(sql))return {first:{count:1}};
        return undefined;
      });
    expect(stub.writes().some(call=>/^\s*(INSERT INTO|UPDATE) wines\b/i.test(call.sql))).toBe(false);
  });

  it('will not delete a tasting without the confirmation token',async()=>{
    const {response,stub}=await call('/api/tastings/t1',{method:'DELETE',headers:{'content-type':'application/json'},body:'{}'});
    expect(response.status).toBe(400);
    expect(stub.writes()).toHaveLength(0);
  });

  it('deletes the wine list objects with the tasting',async()=>{
    // The foreign key cascades the rows away, so R2 has to be told separately -
    // and the keys have to be read before the row goes.
    const deleted:string[]=[];
    const stub=createD1Stub(sql=>/SELECT object_key FROM tasting_documents/.test(sql)?{all:[{object_key:'owner/a.jpg'}]}:undefined);
    const response=await app.fetch(new Request('https://x/api/tastings/t1',{
      method:'DELETE',headers:{'content-type':'application/json',authorization:`Bearer ${await createSession('owner',AUTH_SECRET)}`},
      body:JSON.stringify({confirmation:'DELETE_TASTING'})
    }),{DB:stub.db,WINE_IMAGES:{delete:async(key:string)=>{deleted.push(key)}} as unknown as R2Bucket,
      AUTH_SECRET,APP_URL:'https://x',APP_PASSWORD:'p'} as never);
    expect(response.status).toBe(204);
    expect(deleted).toEqual(['owner/a.jpg']);
    const statements=stub.sql();
    expect(statements.findIndex(sql=>/SELECT object_key FROM tasting_documents/.test(sql)))
      .toBeLessThan(statements.findIndex(sql=>/^DELETE FROM tastings/.test(sql)));
  });
});
