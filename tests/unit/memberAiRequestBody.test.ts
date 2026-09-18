import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { realD1 } from './support/realD1';
import { hash,seconds,stamp } from '../../worker/multiUser/common';
import publicWorker from '../../worker/multiUserEntry';

let database:ReturnType<typeof realD1>;

beforeEach(async()=>{
  database=realD1();
  database.sql.prepare("INSERT INTO app_users(id,email,display_name,role) VALUES('member','member@example.com','Member','member') ON CONFLICT(id) DO UPDATE SET role='member',status='active'").run();
  database.sql.prepare("INSERT OR IGNORE INTO credit_wallets(user_id) VALUES('member')").run();
  database.sql.prepare('INSERT INTO auth_sessions VALUES(?,?,?)').run(await hash('member-session'),'member',seconds()+3600);
  const config={memberLimit:25,memberStorageBytes:100_000_000,totalStorageBytes:8_000_000_000,aiConcurrency:4,aiDailyOperations:100,aiDailyEmbeddingRequests:400,aiMonthlyBudgetUsd:100,aiUnitBudgetUsd:1,cloudflareWarningUsd:5,cloudflareStopUsd:10,cloudflareObservedUsd:0,cloudflareObservedMonth:stamp().slice(0,7),allowOverages:true};
  database.sql.prepare('INSERT INTO pilot_settings(id,value_json) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value_json=excluded.value_json').run(JSON.stringify(config));
});
afterEach(()=>{database.close();vi.restoreAllMocks()});

function env(queueSend=vi.fn(async()=>undefined)){
  return {
    DB:database.db,AUTH_SECRET:'a'.repeat(48),APP_URL:'https://wine.example',GEMINI_API_KEY:'test',
    WINE_IMAGES:{get:async()=>null,put:async()=>({}),delete:async()=>undefined},
    RESEARCH_QUEUE:{send:queueSend},
    ASSETS:{fetch:vi.fn(async()=>Response.json({},{status:404}))}
  } as unknown as Parameters<typeof publicWorker.fetch>[1];
}
const ctx=()=>({waitUntil:vi.fn(),passThroughOnException:vi.fn()}) as unknown as ExecutionContext;
const headers=(extra:Record<string,string>={})=>({Cookie:'__Host-winelog=member-session',Origin:'https://wine.example','Content-Type':'application/json',...extra});

describe('multi-user AI request bodies',()=>{
  it('queues a member Batch Scan without locking the submit request stream',async()=>{
    const now=stamp(),expires=new Date(Date.now()+3600_000).toISOString();
    database.sql.prepare(`INSERT INTO batch_recognition_sessions(id,owner_id,status,total_items,expected_items,created_at,updated_at,expires_at)
      VALUES('batch','member','uploading',2,2,?,?,?)`).run(now,now,expires);
    for(const [position,item,image] of [[0,'item-1','image-1'],[1,'item-2','image-2']] as const){
      database.sql.prepare(`INSERT INTO batch_recognition_items(id,owner_id,session_id,position,status,metadata_json,created_at,updated_at)
        VALUES(?,'member','batch',?,'staged','[]',?,?)`).run(item,position,now,now);
      database.sql.prepare(`INSERT INTO batch_recognition_images(id,owner_id,item_id,original_object_key,recognition_object_key,content_type,byte_size,recognition_byte_size,width,height,created_at)
        VALUES(?,'member',?,?,?,?,100,80,600,800,?)`).run(image,item,`original/${image}.jpg`,`recognition/${image}.jpg`,'image/jpeg',now);
    }

    const e=env(),context=ctx(),path='/api/batch-recognition/sessions/batch/submit',body='{}';
    const quoted=await publicWorker.fetch(new Request(`https://wine.example/api/credits/quotes?path=${encodeURIComponent(path)}`,{method:'POST',headers:headers(),body}),e,context);
    expect(quoted.status).toBe(200);
    const quote=await quoted.json() as {id:string;units:Array<{action:string}>};
    expect(quote.units).toHaveLength(2);
    expect(quote.units.every(unit=>unit.action==='scan_batch')).toBe(true);

    const response=await publicWorker.fetch(new Request(`https://wine.example${path}`,{
      method:'POST',headers:headers({'X-WineLog-Quote':quote.id,'Idempotency-Key':'batch-submit'}),body
    }),e,context);

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({accepted:true,sessionId:'batch'});
    expect(database.sql.prepare("SELECT status FROM batch_recognition_sessions WHERE id='batch'").get()!.status).toBe('queued');
    expect(database.sql.prepare("SELECT count(*) AS n FROM credit_operations WHERE user_id='member' AND path=?").get(path)!.n).toBe(1);
  });

  it('keeps request forwarding after AI fingerprinting so every body-bearing AI route is safe',async()=>{
    // This is the structural regression guard for single/group scans, tasting
    // sheets and JSON research routes too. They all pass through the same branch.
    const source=(await import('node:fs')).readFileSync('worker/multiUserEntry.ts','utf8');
    const reserveAt=source.indexOf('await reserve(request,env,member');
    const forwardAt=source.indexOf('const forwarded=await internalRequest(request,env,member.id)',reserveAt);
    expect(reserveAt).toBeGreaterThan(-1);
    expect(forwardAt).toBeGreaterThan(reserveAt);
  });
});
