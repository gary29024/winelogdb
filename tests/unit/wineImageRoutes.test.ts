import { describe,expect,it } from 'vitest';
import app from '../../worker/index';
import { createSession } from '../../src/lib/auth/session';
import { createD1Stub,type StubReply } from './support/d1Stub';

const AUTH_SECRET='test-secret-value-long-enough-for-hmac';

const photo=(name='bottle.jpg',bytes=2048)=>
  new File([new Uint8Array(bytes)],name,{type:'image/jpeg'});

/**
 * A wine that exists, holding `existing` photos already. Everything else falls
 * through to the caller so a case can say what it wants to be different.
 */
function stubWine(existing:number,reply:(sql:string,args:unknown[])=>StubReply|undefined=()=>undefined){
  return createD1Stub((sql,args)=>{
    if(/SELECT id,location_name FROM wines/.test(sql))return {first:{id:'w1',location_name:'Clubhouse'}};
    if(/count\(\*\) AS count FROM wine_images/.test(sql))return {first:{count:existing}};
    return reply(sql,args);
  });
}

async function post(files:File[],{existing=0,dimensions,metadata,bucket,stub}:{
  existing?:number;dimensions?:unknown;metadata?:unknown;bucket?:Record<string,unknown>;stub?:ReturnType<typeof createD1Stub>
}={}){
  const db=stub??stubWine(existing);
  const form=new FormData();
  for(const file of files)form.append('images',file);
  form.append('dimensions',JSON.stringify(dimensions??files.map(()=>({width:1200,height:1600}))));
  form.append('metadata',JSON.stringify(metadata??files.map(()=>({capturedAt:'2026-08-28T19:00:00.000Z',latitude:22.3,longitude:114.2,source:'exif'}))));
  const put:string[]=[],deleted:string[]=[];
  const WINE_IMAGES={
    put:async(key:string)=>{put.push(key);if(bucket?.fail)throw new Error('R2 is having a day');return undefined},
    delete:async(key:string)=>{deleted.push(key)}
  };
  const response=await app.fetch(new Request('https://x/api/wines/w1/images',{
    method:'POST',headers:{authorization:`Bearer ${await createSession('owner',AUTH_SECRET)}`},body:form
  }),{DB:db.db,WINE_IMAGES,AUTH_SECRET,APP_URL:'https://x',APP_PASSWORD:'p',GEMINI_API_KEY:'k'} as never);
  return {response,put,deleted,stub:db};
}

describe('adding photos to a wine that already exists',()=>{
  it('stores them and links them to the wine',async()=>{
    // Until now a photo could only arrive when the wine did, so a wine read off
    // a printed list could never have one - the only way was to delete it and
    // scan the bottle, losing the price and the evening it was attached to.
    const {response,put,stub}=await post([photo()]);
    expect(response.status).toBe(201);
    expect(((await response.json()) as {imageIds:string[]}).imageIds).toHaveLength(1);
    expect(put,'written to R2').toHaveLength(1);
    const inserts=stub.calls.filter(call=>/INSERT INTO wine_images/.test(call.sql));
    expect(inserts).toHaveLength(1);
    expect(inserts[0].args,'owned, and pointed at this wine').toContain('w1');
    expect(inserts[0].args).toContain('owner');
  });

  it('keeps the capture time and place off the file',async()=>{
    const {stub}=await post([photo()]);
    const args=stub.calls.find(call=>/INSERT INTO wine_images/.test(call.sql))!.args;
    expect(args).toContain('2026-08-28T19:00:00.000Z');
    expect(args).toContain(22.3);
    // the wine's own place, not one invented for the photo
    expect(args).toContain('Clubhouse');
  });

  it('will not add photos to a wine that is not yours',async()=>{
    // The lookup is scoped by owner, so someone else's id reads as gone rather
    // than as forbidden - the same answer whether or not the wine exists.
    const stub=createD1Stub(sql=>/SELECT id,location_name FROM wines/.test(sql)?{first:null}:undefined);
    const {response,put}=await post([photo()],{stub});
    expect(response.status).toBe(404);
    expect(put,'nothing written before the check').toHaveLength(0);
  });

  it('counts the cap against what the wine already holds',async()=>{
    // A cap on one upload is a cap any number of uploads walks straight past.
    const {response,put}=await post([photo(),photo('back.jpg')],{existing:11});
    expect(response.status).toBe(400);
    expect(await response.text()).toContain('already has 11');
    expect(put).toHaveLength(0);
  });

  it('refuses an upload whose dimensions do not line up with its files',async()=>{
    const {response,put}=await post([photo(),photo('back.jpg')],{dimensions:[{width:1200,height:1600}]});
    expect(response.status).toBe(400);
    expect(put).toHaveLength(0);
  });

  it('asks for at least one photo',async()=>{
    const {response}=await post([]);
    expect(response.status).toBe(400);
  });

  it('deletes what it wrote when the insert fails',async()=>{
    // An object left in R2 that nothing points at is storage billed forever for
    // a photo nobody can see.
    const stub=stubWine(0,sql=>{if(/INSERT INTO wine_images/.test(sql))throw new Error('D1 is having a day');return undefined});
    const {response,put,deleted}=await post([photo()],{stub});
    expect(response.status).toBe(500);
    expect(put).toHaveLength(1);
    expect(deleted,'the orphan is cleaned up').toEqual(put);
  });
});
