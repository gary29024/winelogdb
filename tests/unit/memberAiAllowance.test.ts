import { afterEach,describe,expect,it } from 'vitest';
import { realD1 } from './support/realD1';
import { claimResearchAllowance,ownerOnlyResearchPath,researchAllowance,researchWeek,usesWeeklyResearchAllowance } from '../../worker/multiUser/allowance';

const databases:Array<ReturnType<typeof realD1>>=[];
afterEach(()=>{for(const database of databases.splice(0))database.close()});

function setup(){
 const database=realD1();databases.push(database);
 database.sql.prepare("INSERT INTO app_users(id,email,display_name,role) VALUES('alice','alice@example.com','Alice','member')").run();
 database.sql.prepare("INSERT INTO credit_wallets(user_id) VALUES('alice')").run();
 return database;
}
function operation(database:ReturnType<typeof realD1>,id:string){
 database.sql.prepare('INSERT INTO credit_quotes(id,user_id,path,fingerprint,units_json,total,expires_at) VALUES(?,?,?,?,?,?,?)').run(`q-${id}`,'alice','/api/wines/w/deep-search','fp','[]',0,2_000_000_000);
 database.sql.prepare("INSERT INTO credit_operations(id,user_id,request_key,quote_id,path,fingerprint,units_json,reserved,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
  .run(id,'alice',`key-${id}`,`q-${id}`,'/api/wines/w/deep-search','fp','[]',0,'reserved','2026-09-17T00:00:00.000Z','2026-09-17T00:00:00.000Z');
}

describe('member AI allowance',()=>{
 it('uses a Monday UTC non-rollover week',()=>{
  const window=researchWeek(new Date('2026-09-17T16:00:00.000Z'));
  expect(window.weekStart).toBe('2026-09-14T00:00:00.000Z');
  expect(window.resetsAt).toBe('2026-09-21T00:00:00.000Z');
 });

 it('counts one user-facing research operation once and caps the week',async()=>{
  const database=setup();for(const id of ['op1','op2','op3'])operation(database,id);
  const now=new Date('2026-09-17T16:00:00.000Z');
  expect(await researchAllowance(database.db,'alice',2,now)).toMatchObject({used:0,remaining:2,limit:2});
  expect((await claimResearchAllowance(database.db,'alice','op1',2,now)).claimed).toBe(true);
  expect((await claimResearchAllowance(database.db,'alice','op1',2,now)).allowance).toMatchObject({used:1,remaining:1});
  expect((await claimResearchAllowance(database.db,'alice','op2',2,now)).claimed).toBe(true);
  const denied=await claimResearchAllowance(database.db,'alice','op3',2,now);
  expect(denied.claimed).toBe(false);expect(denied.allowance).toMatchObject({used:2,remaining:0});
 });

 it('separates individual research from owner-only batch research',()=>{
  expect(usesWeeklyResearchAllowance('/api/wines/w1/deep-search')).toBe(true);
  expect(usesWeeklyResearchAllowance('/api/producers/p1/research')).toBe(true);
  expect(usesWeeklyResearchAllowance('/api/maturity/vintage')).toBe(true);
  expect(usesWeeklyResearchAllowance('/api/recognition')).toBe(false);
  expect(ownerOnlyResearchPath('/api/producers/research-batch')).toBe(true);
 });

 it('seeds every pilot AI tariff at zero while retaining the quote ledger',()=>{
  const database=setup();
  const prices=database.sql.prepare('SELECT action,credits FROM credit_prices ORDER BY action').all() as Array<{action:string;credits:number}>;
  expect(prices.length).toBeGreaterThan(0);expect(prices.every(price=>price.credits===0)).toBe(true);
  const setting=JSON.parse(String(database.sql.prepare('SELECT value_json FROM pilot_settings WHERE id=1').get()!.value_json));
  expect(setting.researchRunsPerWeek).toBe(2);
 });
});
