import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { realD1 } from './support/realD1';
import { hash,seconds,stamp } from '../../worker/multiUser/common';
import { settle,type CreditOperation } from '../../worker/multiUser/credits';
import publicWorker from '../../worker/multiUserEntry';
import { processVertexBatchSubmitJob } from '../../worker/vertexBatchRecognition';
import { getBatchSession } from '../../worker/batchRecognition';

let database:ReturnType<typeof realD1>;
const path='/api/batch-recognition/sessions/batch/submit';

beforeEach(async()=>{
  database=realD1();
  database.sql.prepare("INSERT INTO app_users(id,email,display_name,role) VALUES('member','member@example.com','Member','member') ON CONFLICT(id) DO UPDATE SET role='member',status='active'").run();
  database.sql.prepare("INSERT OR IGNORE INTO credit_wallets(user_id) VALUES('member')").run();
  database.sql.prepare('INSERT INTO auth_sessions VALUES(?,?,?)').run(await hash('member-session'),'member',seconds()+3600);
  const config={memberLimit:25,memberStorageBytes:100_000_000,totalStorageBytes:8_000_000_000,aiConcurrency:4,aiDailyOperations:100,aiDailyEmbeddingRequests:400,aiMonthlyBudgetUsd:100,aiUnitBudgetUsd:1,cloudflareWarningUsd:5,cloudflareStopUsd:10,cloudflareObservedUsd:0,cloudflareObservedMonth:stamp().slice(0,7),allowOverages:true};
  database.sql.prepare('INSERT INTO pilot_settings(id,value_json) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value_json=excluded.value_json').run(JSON.stringify(config));
  // One successful batch a week, so a retry that was counted as a second batch
  // would be refused instead of recovering the first.
  database.sql.exec("UPDATE member_ai_action_policies SET access_mode='allowance',weekly_limit=1 WHERE action='scan_batch'");
});
afterEach(()=>{database.close();vi.restoreAllMocks()});

const env=()=>({
  DB:database.db,AUTH_SECRET:'a'.repeat(48),APP_URL:'https://wine.example',GEMINI_API_KEY:'test',
  WINE_IMAGES:{get:async()=>null,put:async()=>({}),delete:async()=>undefined},
  RESEARCH_QUEUE:{send:vi.fn(async()=>undefined)},
  ASSETS:{fetch:vi.fn(async()=>Response.json({},{status:404}))}
}) as unknown as Parameters<typeof publicWorker.fetch>[1];
const ctx=()=>({waitUntil:vi.fn(),passThroughOnException:vi.fn()}) as unknown as ExecutionContext;
const headers=(extra:Record<string,string>={})=>({Cookie:'__Host-winelog=member-session',Origin:'https://wine.example','Content-Type':'application/json',...extra});

function stageBatch(sessionStatus='uploading',itemStatus='staged'){
  const now=stamp(),expires=new Date(Date.now()+3600_000).toISOString();
  database.sql.prepare(`INSERT INTO batch_recognition_sessions(id,owner_id,status,total_items,expected_items,created_at,updated_at,expires_at)
    VALUES('batch','member',?,2,2,?,?,?)`).run(sessionStatus,now,now,expires);
  for(const [position,item,image] of [[0,'item-1','image-1'],[1,'item-2','image-2']] as const){
    database.sql.prepare(`INSERT INTO batch_recognition_items(id,owner_id,session_id,position,status,metadata_json,created_at,updated_at)
      VALUES(?,'member','batch',?,?,'[]',?,?)`).run(item,position,itemStatus,now,now);
    database.sql.prepare(`INSERT INTO batch_recognition_images(id,owner_id,item_id,original_object_key,recognition_object_key,content_type,byte_size,recognition_byte_size,width,height,created_at)
      VALUES(?,'member',?,?,?,?,100,80,600,800,?)`).run(image,item,`original/${image}.jpg`,`recognition/${image}.jpg`,'image/jpeg',now);
  }
}

/** What the browser sends for both the first submit and the Retry button: a quote, then the run. */
async function submit(key:string,e=env()){
  const quoted=await publicWorker.fetch(new Request(`https://wine.example/api/credits/quotes?path=${encodeURIComponent(path)}`,{method:'POST',headers:headers(),body:'{}'}),e,ctx());
  const quote=await quoted.json() as {id:string;total:number;units:unknown[];existingOperationId?:string;error?:string};
  if(!quoted.ok)return {quote,quoteStatus:quoted.status,response:null};
  const response=await publicWorker.fetch(new Request(`https://wine.example${path}`,{method:'POST',headers:headers({'X-WineLog-Quote':quote.id,'Idempotency-Key':key}),body:'{}'}),e,ctx());
  return {quote,quoteStatus:quoted.status,response};
}
const operations=()=>database.sql.prepare('SELECT * FROM credit_operations WHERE path=? ORDER BY rowid').all(path) as unknown as CreditOperation[];
/** The operation each queued recognition_batch_submit is billed to, in dispatch order. */
const submitJobs=()=>database.sql.prepare("SELECT operation_id FROM queue_outbox WHERE json_extract(body_json,'$.kind')='recognition_batch_submit' ORDER BY rowid").all().map(row=>row.operation_id);
const allowanceClaims=()=>database.sql.prepare("SELECT count(*) AS n FROM member_ai_action_usage WHERE user_id='member' AND action='scan_batch'").get()!.n;

describe('Batch Scan retry',()=>{
  it('recovers waiting wines under the reservation still open, without reserving or counting the batch again',async()=>{
    stageBatch();
    const first=await submit('first');
    expect(first.response?.status).toBe(202);
    const [operation]=operations();
    expect(database.sql.prepare("SELECT count(*) AS n FROM batch_recognition_items WHERE status='submitted'").get()!.n).toBe(2);

    // Every wine is now waiting. This is what Retry waiting recognition sends.
    const retry=await submit('retry');
    expect(retry.quoteStatus).toBe(200);
    expect(retry.quote).toMatchObject({total:0,units:[],existingOperationId:operation.id});
    expect(retry.response?.status).toBe(202);
    await expect(retry.response!.json()).resolves.toMatchObject({accepted:true,sessionId:'batch',creditOperationId:operation.id});

    expect(operations()).toHaveLength(1);
    expect(submitJobs()).toEqual([operation.id,operation.id]);
    expect(allowanceClaims()).toBe(1);
    expect(operations()[0].status).toBe('running');
  });

  it('replays a repeated request rather than dispatching it twice',async()=>{
    stageBatch();
    const e=env(),first=await submit('first',e);
    const again=await publicWorker.fetch(new Request(`https://wine.example${path}`,{method:'POST',headers:headers({'X-WineLog-Quote':first.quote.id,'Idempotency-Key':'first'}),body:'{}'}),e,ctx());
    expect(again.status).toBe(202);
    expect(submitJobs()).toHaveLength(1);
  });

  it('reserves the waiting wines again once the original reservation has ended',async()=>{
    stageBatch();
    await submit('first');
    // The owner released the held submission; its wines are still waiting.
    const [original]=operations();
    await settle(database.db,original,0,{body:{status:'failed',outcome:'released'},status:409},false);

    const retry=await submit('retry');
    expect(retry.quote.units).toHaveLength(2);
    expect(retry.response?.status).toBe(202);
    const [, replacement]=operations();
    expect(replacement).toMatchObject({status:'running'});
    expect(submitJobs()).toEqual([original.id,replacement.id]);
    expect(allowanceClaims()).toBe(1);
  });

  it('says so when nothing in the batch is waiting',async()=>{
    stageBatch('ready','ready');
    const retry=await submit('retry');
    expect(retry.quoteStatus).toBe(400);
    expect(retry.quote.error).toBe('This batch has no wines waiting for recognition');
    expect(operations()).toHaveLength(0);
  });

  it('gives each waiting wine one recognition job when two recoveries overlap',async()=>{
    stageBatch('running','submitted');
    const send=vi.fn(async()=>undefined),recovery={DB:database.db,RESEARCH_QUEUE:{send}} as unknown as Parameters<typeof processVertexBatchSubmitJob>[0];
    await Promise.all([processVertexBatchSubmitJob(recovery,'member','batch'),processVertexBatchSubmitJob(recovery,'member','batch')]);
    const jobs=database.sql.prepare("SELECT google_batch_name,count(*) AS n FROM batch_recognition_jobs WHERE session_id='batch' GROUP BY google_batch_name ORDER BY google_batch_name").all();
    expect(jobs).toEqual([{google_batch_name:'vertex-item/item-1',n:1},{google_batch_name:'vertex-item/item-2',n:1}]);
  });
});

describe('Batch Scan activity',()=>{
  it('dates the batch by its latest wine or recognition job, not by the batch row alone',async()=>{
    stageBatch('running','submitted');
    const queued=new Date(Date.now()-20*60_000).toISOString(),started=new Date(Date.now()-5*60_000).toISOString(),finished=new Date(Date.now()-60_000).toISOString();
    database.sql.prepare('UPDATE batch_recognition_sessions SET updated_at=?').run(queued);
    database.sql.prepare('UPDATE batch_recognition_items SET updated_at=?').run(queued);
    database.sql.prepare(`INSERT INTO batch_recognition_jobs(id,owner_id,session_id,google_batch_name,item_ids_json,status,created_at,updated_at)
      VALUES('job','member','batch','vertex-item/item-1','["item-1"]','running',?,?)`).run(queued,started);
    expect(await getBatchSession(database.db,'member','batch')).toMatchObject({updatedAt:queued,lastActivityAt:started});

    database.sql.prepare("UPDATE batch_recognition_items SET status='ready',updated_at=? WHERE id='item-2'").run(finished);
    expect(await getBatchSession(database.db,'member','batch')).toMatchObject({updatedAt:queued,lastActivityAt:finished});
  });
});
