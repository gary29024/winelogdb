import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { readdirSync,readFileSync } from 'node:fs';
import { realD1 } from './support/realD1';
import { hash,seconds,stamp } from '../../worker/multiUser/common';
import { durableProvider,providerAuthorization } from '../../worker/multiUser/provider';
import publicWorker from '../../worker/multiUserEntry';

let database:ReturnType<typeof realD1>;
const config={memberLimit:25,memberStorageBytes:1e8,totalStorageBytes:8e9,aiConcurrency:4,aiDailyOperations:100,aiMonthlyBudgetUsd:100,aiUnitBudgetUsd:1,cloudflareWarningUsd:5,cloudflareStopUsd:10,cloudflareObservedUsd:0,cloudflareObservedMonth:stamp().slice(0,7),allowOverages:true};

beforeEach(()=>{
  database=realD1();
  for(const [id,role] of [['owner','owner'],['bob','member']]){
    database.sql.prepare('INSERT INTO app_users(id,email,display_name,role) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,display_name=excluded.display_name,role=excluded.role').run(id,`${id}@example.com`,id,role);
    database.sql.prepare('INSERT OR IGNORE INTO credit_wallets(user_id) VALUES(?)').run(id);
  }
  database.sql.prepare('INSERT INTO pilot_settings(id,value_json) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value_json=excluded.value_json').run(JSON.stringify(config));
});
afterEach(()=>{database.close();vi.restoreAllMocks();vi.unstubAllGlobals()});

describe('an AI path nobody priced',()=>{
  // The allowlist of AI routes loses a race it cannot win: each new endpoint
  // that reaches the provider is unmetered until somebody remembers to add it,
  // and the symptom is a bill rather than an error. bottle-frames is the
  // endpoint that proved it - it shipped on main outside aiRoute().
  it('refuses a member and never reaches the provider',async()=>{
    database.sql.exec("INSERT INTO wines(id,owner_id,producer,wine_name,created_at,updated_at) VALUES('w1','bob','P','W','now','now')");
    database.sql.exec("INSERT INTO wine_images(id,owner_id,wine_id,object_key,content_type,byte_size,width,height,upload_status,recognition_status,created_at) VALUES('img1','bob','w1','k','image/jpeg',10,800,600,'uploaded','complete','now')");
    database.sql.prepare('INSERT INTO auth_sessions VALUES(?,?,?)').run(await hash('bob-session'),'bob',seconds()+3600);
    const provider=vi.fn(()=>{throw new Error('Unexpected provider call')});vi.stubGlobal('fetch',provider);
    const env={DB:database.db,AUTH_SECRET:'a'.repeat(48),APP_URL:'https://wine.example',GEMINI_API_KEY:'k',
      WINE_IMAGES:{get:async()=>({body:null,httpMetadata:{}})},RESEARCH_QUEUE:{send:vi.fn()},
      ASSETS:{fetch:vi.fn(async()=>Response.json({},{status:404}))}} as unknown as Parameters<typeof publicWorker.fetch>[1];
    const pending:Promise<unknown>[]=[],ctx={waitUntil:(p:Promise<unknown>)=>pending.push(p)} as unknown as ExecutionContext;
    // A real multipart body, so the request gets past form validation and is
    // stopped by the metering gate rather than by a malformed-input check.
    const jpeg=String.fromCharCode(0xff,0xd8,0xff,0xd9);
    const body=`--scan\r\nContent-Disposition: form-data; name="images"; filename="bottle.jpg"\r\nContent-Type: image/jpeg\r\n\r\n${jpeg}\r\n--scan--\r\n`;
    const response=await publicWorker.fetch(new Request('https://wine.example/api/bottle-frames/img1',{method:'POST',
      headers:{Cookie:'__Host-winelog=bob-session',Origin:'https://wine.example','Content-Type':'multipart/form-data; boundary=scan'},body}),env,ctx);
    await Promise.all(pending);
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(await response.text()).toContain('credit price');
    expect(provider,'an unpriced path must fail before it can spend').not.toHaveBeenCalled();
  });
});

describe('the three metering states',()=>{
  const send=async()=>Response.json({ok:true});

  it('lets the owner through unmetered, because they pay the provider directly',async()=>{
    const calls=vi.fn(send);
    const response=await durableProvider(providerAuthorization('owner','unpriced'),'k',calls);
    expect(response.status).toBe(200);expect(calls).toHaveBeenCalledTimes(1);
  });

  it('refuses a member with the reason the caller gave',async()=>{
    const calls=vi.fn(send);
    await expect(durableProvider(providerAuthorization('member','/api/whatever has no price'),'k',calls))
      .rejects.toMatchObject({status:402,message:'/api/whatever has no price'});
    expect(calls).not.toHaveBeenCalled();
  });

  // Undefined is the single-tenant deployment that predates credits, where
  // there is one account and it owns everything.
  it('leaves a pre-credits deployment alone',async()=>{
    const calls=vi.fn(send);
    expect((await durableProvider(undefined,'k',calls)).status).toBe(200);
    expect(calls).toHaveBeenCalledTimes(1);
  });
});

describe('every route to the provider',()=>{
  const sources=()=>{
    const files:string[]=[];
    const walk=(dir:string)=>{for(const entry of readdirSync(dir,{withFileTypes:true})){
      const path=`${dir}/${entry.name}`;
      if(entry.isDirectory())walk(path);else if(/\.ts$/.test(entry.name))files.push(path);
    }};
    walk('worker');walk('src/lib');
    return files;
  };

  // The gate only holds while durableProvider is the one door. A new call that
  // reaches Google directly would be unmetered again, and no runtime test would
  // notice until the bill arrived - so the door is pinned here instead.
  it('goes through durableProvider and nowhere else',()=>{
    const provider=/[`'"]https:\/\/(generativelanguage\.googleapis\.com|[^`'"]*aiplatform|gateway\.ai\.cloudflare\.com)/;
    // Cancelling a batch is the one provider call that saves money rather than
    // spending it. Refusing it would strand a member's run and keep billing for
    // work nobody wants, so it is exempt by name rather than by accident.
    const spendsNothing=new Set(['src/lib/research/cancelResearch.ts']);
    // The direct range extractor streams its reply, which the durable wrapper
    // cannot buffer and replay. It is safe only because the range is owner-only,
    // so the exemption is asserted against that gate rather than taken on trust:
    // if the gate goes, this stops being exempt.
    const ownerOnly=new Map([['src/lib/producers/catalogDirectResearch.ts','producerRangeAllowed']]);
    for(const [file,gate] of ownerOnly)expect(readFileSync(file,'utf8'),`${file} is exempt only while it is owner-only`).toContain(gate);
    const offenders=sources().filter(file=>{
      if(spendsNothing.has(file)||ownerOnly.has(file))return false;
      const text=readFileSync(file,'utf8');
      return provider.test(text)&&!text.includes('durableProvider');
    });
    expect(offenders,'a file that reaches the provider must route through durableProvider').toEqual([]);
  });

  it('allows only explicitly usage-metered zero-credit Workers AI calls',()=>{
    const directWorkers=sources().filter(file=>readFileSync(file,'utf8').includes('.AI.run'));
    const allowed=new Map([
      ['src/lib/journal/semanticSearch.ts',['EMBEDDING_CREDIT_EXEMPTION','recordAiUsage','search_embedding']],
      ['src/lib/producers/catalogWorkersAiFallback.ts',['producerRangeAllowed']]
    ]);
    for(const [file,guards] of allowed){
      const text=readFileSync(file,'utf8');
      for(const guard of guards)expect(text,`${file} needs ${guard} to remain exempt`).toContain(guard);
    }
    expect(directWorkers.filter(file=>!allowed.has(file)),'new AI.run paths need an explicit credit policy').toEqual([]);
  });

  it('is handed a metering decision on every multi-user request',()=>{
    const entry=readFileSync('worker/multiUserEntry.ts','utf8');
    // The non-AI path is the one that shipped unmetered: it forwards straight to
    // the legacy worker, which is where an unpriced endpoint lives.
    expect(entry).toContain('providerAuthorization(member.role');
    expect(entry.match(/CREDIT_CONTEXT:/g)?.length,'both the request and the queue path decide').toBeGreaterThanOrEqual(3);
  });
});
