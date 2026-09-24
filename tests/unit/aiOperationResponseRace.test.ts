import { afterEach,beforeEach,expect,it } from 'vitest';
import { realD1 } from './support/realD1';
import { saveOperationResponse,type CreditOperation } from '../../worker/multiUser/credits';
import { stamp,seconds } from '../../worker/multiUser/common';

let database:ReturnType<typeof realD1>;
beforeEach(()=>{
  database=realD1();
  database.sql.prepare("INSERT OR IGNORE INTO app_users(id,email,display_name,role) VALUES('race-owner','race@example.com','Owner','owner')").run();
  database.sql.prepare("INSERT OR IGNORE INTO credit_wallets(user_id) VALUES('race-owner')").run();
  database.sql.prepare("INSERT INTO credit_quotes(id,user_id,path,fingerprint,units_json,total,expires_at) VALUES('race-quote','race-owner','/api/wines/w/champagne-extraction','fingerprint','[]',0,?)").run(seconds()+600);
  database.sql.prepare("INSERT INTO credit_operations(id,user_id,request_key,quote_id,path,fingerprint,units_json,reserved,status,run_id,created_at,updated_at) VALUES('race-op','race-owner','race-key','race-quote','/api/wines/w/champagne-extraction','fingerprint','[]',0,'running','original-run',?,?)").run(stamp(),stamp());
});
afterEach(()=>database.close());
const read=()=>database.sql.prepare("SELECT * FROM credit_operations WHERE id='race-op'").get() as unknown as CreditOperation;

it.each(['complete','failed'])('does not reopen a %s operation when a late HTTP acceptance arrives',async(status)=>{
  const stale=read();
  database.sql.prepare("UPDATE credit_operations SET status=?,response_json='{}',response_status=200 WHERE id='race-op'").run(status);
  const result=await saveOperationResponse(database.db,stale,Response.json({run:{requestId:'original-run',status:'queued'}},{status:202}));
  expect(read()).toMatchObject({status,response_status:200,response_json:'{}',run_id:'original-run'});
  expect(result.creditSettlement).toMatchObject({status,reserved:0});
});
it('preserves a review hold and the run linked before dispatch',async()=>{
  const stale=read();database.sql.prepare("UPDATE credit_operations SET status='review' WHERE id='race-op'").run();
  await saveOperationResponse(database.db,stale,Response.json({accepted:true},{status:202}));
  expect(read()).toMatchObject({status:'review',run_id:'original-run',response_status:202});
});
it('records the nested Champagne request ID when it has not been linked yet',async()=>{
  database.sql.prepare("UPDATE credit_operations SET run_id=NULL WHERE id='race-op'").run();
  await saveOperationResponse(database.db,read(),Response.json({run:{requestId:'new-run',status:'queued'}},{status:202}));
  expect(read()).toMatchObject({status:'running',run_id:'new-run',response_status:202});
});
