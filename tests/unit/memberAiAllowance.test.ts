import { afterEach,describe,expect,it } from 'vitest';
import { realD1 } from './support/realD1';
import { memberAccessWeek,memberActionForRequest,memberAiAccess,memberAiActionAccess,memberAiPolicies,reserveMemberAiAllowance } from '../../worker/multiUser/memberAccess';

const databases:Array<ReturnType<typeof realD1>>=[];
afterEach(()=>{for(const database of databases.splice(0))database.close()});

function setup(){
 const database=realD1();databases.push(database);
 database.sql.prepare("INSERT INTO app_users(id,email,display_name,role) VALUES('alice','alice@example.com','Alice','member')").run();
 database.sql.prepare("INSERT INTO credit_wallets(user_id) VALUES('alice')").run();
 return database;
}
function operation(database:ReturnType<typeof realD1>,id:string,path='/api/wines/w/deep-search'){
 database.sql.prepare('INSERT INTO credit_quotes(id,user_id,path,fingerprint,units_json,total,expires_at) VALUES(?,?,?,?,?,?,?)').run(`q-${id}`,'alice',path,'fp','[]',0,2_000_000_000);
 database.sql.prepare("INSERT INTO credit_operations(id,user_id,request_key,quote_id,path,fingerprint,units_json,reserved,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
  .run(id,'alice',`key-${id}`,`q-${id}`,path,'fp','[]',0,'reserved','2026-09-17T00:00:00.000Z','2026-09-17T00:00:00.000Z');
}

describe('member AI action access',()=>{
 it('uses a Monday UTC non-rollover week',()=>{
  const window=memberAccessWeek(new Date('2026-09-17T16:00:00.000Z'));
  expect(window.weekStart).toBe('2026-09-14T00:00:00.000Z');
  expect(window.resetsAt).toBe('2026-09-21T00:00:00.000Z');
 });

 it('seeds independent included and allowance policies',async()=>{
  const database=setup(),policies=await memberAiPolicies(database.db),byAction=new Map(policies.map(item=>[item.action,item]));
  expect(byAction.get('scan_single')).toMatchObject({accessMode:'included',weeklyLimit:0});
  expect(byAction.get('scan_group')).toMatchObject({accessMode:'included',weeklyLimit:0});
  expect(byAction.get('scan_batch')).toMatchObject({accessMode:'included',weeklyLimit:0});
  expect(byAction.get('scan_sheet')).toMatchObject({accessMode:'included',weeklyLimit:0});
  expect(byAction.get('wine_deep_search')).toMatchObject({accessMode:'allowance',weeklyLimit:2});
  expect(byAction.get('producer_research')).toMatchObject({accessMode:'allowance',weeklyLimit:2});
  expect(byAction.get('producer_batch_research')).toMatchObject({accessMode:'allowance',weeklyLimit:0});
  expect(byAction.get('vintage_window')).toMatchObject({accessMode:'allowance',weeklyLimit:2});
 });

 it('maps routes to user-facing actions instead of internal research scopes',()=>{
  const recognition=(mode?:string)=>new Request('https://wine.example/api/recognition',{method:'POST',headers:mode?{'X-WineLog-Recognition-Mode':mode}:{}});
  expect(memberActionForRequest(recognition())).toBe('scan_single');
  expect(memberActionForRequest(recognition('group'))).toBe('scan_group');
  expect(memberActionForRequest(new Request('https://wine.example/api/batch-recognition/sessions/s/submit'))).toBe('scan_batch');
  expect(memberActionForRequest(new Request('https://wine.example/api/tastings/t/sheet/parse'))).toBe('scan_sheet');
  expect(memberActionForRequest(new Request('https://wine.example/api/wines/w/deep-search'))).toBe('wine_deep_search');
  expect(memberActionForRequest(new Request('https://wine.example/api/producers/p/research'))).toBe('producer_research');
  expect(memberActionForRequest(new Request('https://wine.example/api/producers/research-batch'))).toBe('producer_batch_research');
  expect(memberActionForRequest(new Request('https://wine.example/api/maturity/vintage'))).toBe('vintage_window');
 });

 it('counts only successful runs and releases failed reservations',async()=>{
  const database=setup(),now=new Date('2026-09-17T16:00:00.000Z');
  operation(database,'failed');
  const pending=await reserveMemberAiAllowance(database.db,'alice','failed','wine_deep_search',now);
  expect(pending.allowed).toBe(true);expect(pending.access).toMatchObject({used:0,pending:1,remaining:1,limit:2});
  database.sql.prepare("UPDATE credit_operations SET status='failed' WHERE id='failed'").run();
  expect(await memberAiActionAccess(database.db,'alice','wine_deep_search',now)).toMatchObject({used:0,pending:0,remaining:2});

  operation(database,'success');
  await reserveMemberAiAllowance(database.db,'alice','success','wine_deep_search',now);
  database.sql.prepare("UPDATE credit_operations SET status='complete' WHERE id='success'").run();
  expect(await memberAiActionAccess(database.db,'alice','wine_deep_search',now)).toMatchObject({used:1,pending:0,remaining:1});
 });

 it('keeps action allowances independent and supports member-specific extra grants',async()=>{
  const database=setup(),now=new Date('2026-09-17T16:00:00.000Z'),week=memberAccessWeek(now).weekStart;
  database.sql.prepare("INSERT INTO member_ai_action_grants(id,user_id,action,week_start,runs,created_at,created_by,reason) VALUES('g','alice','wine_deep_search',?,3,'now','owner','pilot tester')").run(week);
  expect(await memberAiActionAccess(database.db,'alice','wine_deep_search',now)).toMatchObject({baseLimit:2,granted:3,limit:5,remaining:5});
  expect(await memberAiActionAccess(database.db,'alice','producer_research',now)).toMatchObject({baseLimit:2,granted:0,limit:2,remaining:2});
 });

 it('does not create allowance usage for an included action',async()=>{
  const database=setup();operation(database,'scan','/api/recognition');
  const result=await reserveMemberAiAllowance(database.db,'alice','scan','scan_single');
  expect(result).toMatchObject({allowed:true,claimed:false});
  expect(database.sql.prepare('SELECT count(*) AS n FROM member_ai_action_usage').get()!.n).toBe(0);
 });

 it('enforces zero-limit allowance actions until an owner grants runs',async()=>{
  const database=setup(),now=new Date('2026-09-17T16:00:00.000Z');operation(database,'batch','/api/producers/research-batch');
  const denied=await reserveMemberAiAllowance(database.db,'alice','batch','producer_batch_research',now);
  expect(denied.allowed).toBe(false);expect(denied.access).toMatchObject({limit:0,remaining:0});
  const week=memberAccessWeek(now).weekStart;
  database.sql.prepare("INSERT INTO member_ai_action_grants(id,user_id,action,week_start,runs,created_at,created_by) VALUES('batch-grant','alice','producer_batch_research',?,1,'now','owner')").run(week);
  expect((await reserveMemberAiAllowance(database.db,'alice','batch','producer_batch_research',now)).allowed).toBe(true);
 });

 it('keeps internal pilot tariffs at zero for budget/idempotency plumbing',()=>{
  const database=setup();
  const prices=database.sql.prepare('SELECT action,credits FROM credit_prices ORDER BY action').all() as Array<{action:string;credits:number}>;
  expect(prices.length).toBeGreaterThan(0);expect(prices.every(price=>price.credits===0)).toBe(true);
  expect((database.sql.prepare('SELECT count(*) AS n FROM member_ai_action_policies').get() as {n:number}).n).toBeGreaterThan(0);
 });

 it('reports all configured actions together for the member UI',async()=>{
  const database=setup(),items=await memberAiAccess(database.db,'alice');
  expect(items.map(item=>item.action)).toEqual(['scan_single','scan_group','scan_batch','scan_sheet','wine_deep_search','producer_research','producer_batch_research','vintage_window']);
 });
});
