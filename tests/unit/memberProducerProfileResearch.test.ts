import { afterEach,beforeEach,describe,expect,it } from 'vitest';
import { realD1 } from './support/realD1';
import { assertResearchInput,researchInputFingerprint } from '../../src/lib/credits/provider';
import { reconcileOperation,type CreditOperation } from '../../worker/multiUser/credits';

let database:ReturnType<typeof realD1>;

beforeEach(()=>{
  database=realD1();
  database.sql.prepare("INSERT INTO app_users(id,email,display_name,role,status) VALUES('alice','alice@example.com','Alice','member','active') ON CONFLICT(id) DO UPDATE SET role='member',status='active'").run();
  database.sql.prepare("INSERT OR IGNORE INTO credit_wallets(user_id) VALUES('alice')").run();
  database.sql.prepare("INSERT INTO producers(id,owner_id,canonical_name,match_key,created_at,updated_at) VALUES('p1','alice','Thibault Liger-Belair','thibaultligerbelair','2026-09-18','2026-09-18')").run();
});
afterEach(()=>database.close());

async function seedOperation(id:string,runId:string,status:'running'|'complete'|'failed'='running'){
  const producer={canonical_name:'Thibault Liger-Belair'};
  const targetFingerprint=await researchInputFingerprint('producer',producer);
  const units=JSON.stringify([{id:'p1',action:'producer_profile',priceId:'member-profile',credits:0,targetId:'p1',targetFingerprint}]);
  const quoteId=`q-${id}`,now='2026-09-18T10:00:00.000Z';
  database.sql.prepare('INSERT INTO credit_quotes(id,user_id,path,fingerprint,units_json,total,expires_at) VALUES(?,?,?,?,?,?,?)')
    .run(quoteId,'alice','/api/producers/p1/research','request',units,0,9999999999);
  database.sql.prepare(`INSERT INTO credit_operations(id,user_id,request_key,quote_id,path,fingerprint,units_json,reserved,captured,status,response_json,response_status,run_id,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id,'alice',id,quoteId,'/api/producers/p1/research','request',units,0,0,'running',null,null,runId,now,now);
  database.sql.prepare(`INSERT INTO producer_research_runs(owner_id,request_id,producer_id,status,stage,attempt,message,started_at,updated_at,completed_at,duration_ms)
    VALUES(?,?,?,?,?,0,NULL,?,?,?,1000)`)
    .run('alice',runId,'p1',status,status==='running'?'searching':status==='complete'?'complete':'failed',now,now,status==='running'?null:now);
  return {producer,operation:database.sql.prepare('SELECT * FROM credit_operations WHERE id=?').get(id) as unknown as CreditOperation};
}

describe('member producer profile research',()=>{
  it('accepts the profile-only quoted unit for queued producer identity validation',async()=>{
    const {producer}=await seedOperation('op-auth','run-auth');
    await expect(assertResearchInput({db:database.db,operationId:'op-auth',namespace:'queue'},'alice','p1','producer',producer)).resolves.toBeUndefined();
    await expect(assertResearchInput({db:database.db,operationId:'op-auth',namespace:'queue'},'alice','p1','producer',{canonical_name:'Renamed producer'})).rejects.toMatchObject({status:409});
  });

  it('settles a failed profile-only run and releases its pending weekly allowance',async()=>{
    const {operation}=await seedOperation('op-failed','run-failed','failed');
    database.sql.prepare(`INSERT INTO member_ai_action_usage(operation_id,user_id,action,week_start,status,created_at)
      VALUES('op-failed','alice','producer_research','2026-09-14T00:00:00.000Z','pending','2026-09-18T10:00:00.000Z')`).run();

    await reconcileOperation(database.db,operation);

    expect(database.sql.prepare("SELECT status FROM credit_operations WHERE id='op-failed'").get()?.status).toBe('failed');
    expect(database.sql.prepare("SELECT count(*) AS n FROM member_ai_action_usage WHERE operation_id='op-failed'").get()?.n).toBe(0);
  });
});
