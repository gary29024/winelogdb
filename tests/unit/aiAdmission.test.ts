import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { realD1 } from './support/realD1';
import { quote,reserve } from '../../worker/multiUser/credits';
import { stamp,type Member } from '../../worker/multiUser/common';
import { createWineResearchRun,updateWineResearchRun } from '../../src/lib/research/backgroundJobs';

const owner:Member={id:'owner',email:'owner@example.com',display_name:'Owner',role:'owner',status:'active'};
const member:Member={id:'member',email:'member@example.com',display_name:'Member',role:'member',status:'active'};
let database:ReturnType<typeof realD1>;
const env=()=>({DB:database.db});
const scan=(headers:Record<string,string>={})=>new Request('https://wine.example/api/recognition',{method:'POST',headers:{'Content-Type':'multipart/form-data; boundary=admission',...headers},body:'--admission\r\nContent-Disposition: form-data; name="images"; filename="label.jpg"\r\nContent-Type: image/jpeg\r\n\r\nlabel\r\n--admission--\r\n'});
const research=(wine:string,headers:Record<string,string>={})=>new Request(`https://wine.example/api/wines/${wine}/deep-search`,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:'{}'});
function settings(patch:Record<string,unknown>){
 const row=database.sql.prepare('SELECT value_json FROM pilot_settings WHERE id=1').get()!;
 database.sql.prepare('UPDATE pilot_settings SET value_json=? WHERE id=1').run(JSON.stringify({...JSON.parse(String(row.value_json)),...patch}));
}
async function startScan(who=owner){
 const q=await quote(scan(),env(),who);
 return reserve(scan({'X-WineLog-Quote':q.id,'Idempotency-Key':crypto.randomUUID()}),env(),who);
}
async function prepareResearch(wine:string,who=owner){
 const q=await quote(research(wine),env(),who),key=crypto.randomUUID();
 return {q,run:(observedUsd=0)=>reserve(research(wine,{'X-WineLog-Quote':q.id,'Idempotency-Key':key}),env(),who,observedUsd)};
}
function counts(){return Object.fromEntries(['credit_operations','credit_ledger','research_work','queue_outbox','research_followers'].map(table=>[table,database.sql.prepare(`SELECT count(*) AS n FROM ${table}`).get()!.n]))}
beforeEach(()=>{
 database=realD1();
 database.sql.exec("INSERT INTO app_users(id,email,display_name,role) VALUES('member','member@example.com','Member','member'); INSERT INTO credit_wallets(user_id) VALUES('member')");
 settings({cloudflareObservedMonth:stamp().slice(0,7)});
 for(const who of [owner,member])for(const [id,producer,name] of [['one','Producer One','Wine One'],['two','Producer Two','Wine Two'],['overlap','Producer One','Other Wine']]){
  database.sql.prepare('INSERT INTO wines(id,owner_id,producer,wine_name,vintage,country,region,appellation,wine_style,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(`${who.id}-${id}`,who.id,producer,name,2020,'France','Burgundy',name,'red',stamp(),stamp());
 }
});
afterEach(()=>{database.close();vi.restoreAllMocks()});

describe('unlimited owner AI admission',()=>{
 it('starts Deep Search beyond concurrency, daily, monthly and Cloudflare gates while preserving accounting and replay',async()=>{
  for(let i=0;i<5;i++)await startScan();
  database.sql.exec("UPDATE credit_operations SET status='review'");
  settings({aiConcurrency:1,aiDailyOperations:1,aiMonthlyBudgetUsd:0.01,aiUnitBudgetUsd:100,cloudflareObservedMonth:'2000-01',cloudflareStopUsd:1,cloudflareObservedUsd:100,allowOverages:false});
  const input=await prepareResearch('owner-one'),result=await input.run(99999);
  expect(input.q.total).toBe(0);expect(input.q.units).toHaveLength(4);
  expect(result.operation).toMatchObject({status:'reserved',reserved:0,user_id:'owner'});
  expect(database.sql.prepare('SELECT budget_hold_usd FROM credit_operations WHERE id=?').get(result.operation.id)).toMatchObject({budget_hold_usd:0});
  expect(database.sql.prepare("SELECT balance,reserved FROM credit_wallets WHERE user_id='owner'").get()).toMatchObject({balance:0,reserved:0});
  expect(database.sql.prepare('SELECT kind,amount FROM credit_ledger WHERE operation_id=?').get(result.operation.id)).toMatchObject({kind:'reserve',amount:0});
  expect(database.sql.prepare('SELECT count(*) AS n FROM research_work WHERE operation_id=?').get(result.operation.id)!.n).toBeGreaterThan(0);
  expect(await input.run()).toMatchObject({existing:true,operation:{id:result.operation.id}});
 });
 it('does not require pilot settings or member prices for owner work',async()=>{
  database.sql.exec('DELETE FROM pilot_settings; DELETE FROM credit_prices');
  const input=await prepareResearch('owner-one');expect((await input.run()).operation.reserved).toBe(0);
 });
 it('reports an owner research overlap at quote time instead of a capacity error',async()=>{
  await (await prepareResearch('owner-one')).run();
  await expect(prepareResearch('owner-overlap')).rejects.toMatchObject({status:409,message:expect.stringContaining('Another research request in your account')});
 });
 it('atomically rejects overlap introduced after quoting without partial bookkeeping',async()=>{
  const second=await prepareResearch('owner-overlap');
  await (await prepareResearch('owner-one')).run();const before=counts();
  await expect(second.run()).rejects.toMatchObject({status:409,message:expect.stringContaining('Another research request in your account')});
  expect(counts()).toEqual(before);
 });
 it('clears a terminal operation’s leftover locks before quoting another wine',async()=>{
  const {operation}=await (await prepareResearch('owner-one')).run();
  database.sql.prepare("UPDATE credit_operations SET status='failed' WHERE id=?").run(operation.id);
  const next=await prepareResearch('owner-overlap');
  expect(next.q.units.length).toBeGreaterThan(0);
  expect(database.sql.prepare('SELECT count(*) AS n FROM research_work WHERE operation_id=?').get(operation.id)!.n).toBe(0);
  expect((await next.run()).existing).toBe(false);
 });
 it('releases an abandoned reservation that never dispatched or submitted work',async()=>{
  const {operation}=await (await prepareResearch('owner-one')).run();
  database.sql.prepare('UPDATE credit_operations SET created_at=? WHERE id=?').run(new Date(Date.now()-16*60_000).toISOString(),operation.id);
  const next=await prepareResearch('owner-overlap');
  expect(database.sql.prepare('SELECT status FROM credit_operations WHERE id=?').get(operation.id)!.status).toBe('failed');
  expect((await next.run()).operation.status).toBe('reserved');
 });
 it('releases the same wine’s undispatched reservation instead of reusing it indefinitely',async()=>{
  const {operation}=await (await prepareResearch('owner-one')).run();
  database.sql.prepare('UPDATE credit_operations SET created_at=? WHERE id=?').run(new Date(Date.now()-16*60_000).toISOString(),operation.id);
  const next=await prepareResearch('owner-one');
  expect(next.q.existingOperationId).toBeUndefined();expect(next.q.units).toHaveLength(4);
  expect(database.sql.prepare('SELECT status FROM credit_operations WHERE id=?').get(operation.id)!.status).toBe('failed');
  expect((await next.run()).operation.id).not.toBe(operation.id);
 });
 it('reconciles a failed same-wine run before deciding that an old request is still active',async()=>{
  const {operation}=await (await prepareResearch('owner-one')).run();
  await createWineResearchRun(database.db,'owner','owner-one','none','known-failed-run',operation.id);
  await updateWineResearchRun(database.db,'owner','known-failed-run','failed','Grounding was unavailable','failed');
  const next=await prepareResearch('owner-one');
  expect(next.q.existingOperationId).toBeUndefined();expect(next.q.units).toHaveLength(4);
  expect(database.sql.prepare('SELECT status FROM credit_operations WHERE id=?').get(operation.id)!.status).toBe('failed');
  expect((await next.run()).existing).toBe(false);
 });
 it('describes an uncertain previous request as a hold instead of claiming another run is active',async()=>{
  const {operation}=await (await prepareResearch('owner-one')).run();
  database.sql.prepare("UPDATE credit_operations SET status='review' WHERE id=?").run(operation.id);
  database.sql.prepare("INSERT INTO provider_operations(id,operation_id,state,created_at,updated_at) VALUES(?,?,'uncertain',?,?)").run('held-provider',operation.id,stamp(),stamp());
  await expect(prepareResearch('owner-overlap')).rejects.toMatchObject({status:409,message:expect.stringContaining('previous research request')});
  expect(database.sql.prepare('SELECT count(*) AS n FROM research_work WHERE operation_id=?').get(operation.id)!.n).toBeGreaterThan(0);
 });
});

describe('specific member admission errors',()=>{
 it.each([
  [{cloudflareObservedUsd:10},'Cloudflare spending limit'],
  [{cloudflareObservedUsd:1,allowOverages:false},'Paid Cloudflare usage is disabled'],
 ] as const)('retains the Cloudflare gate %j for members',async(patch,message)=>{
  settings(patch);const input=await prepareResearch('member-one',member),before=counts();
  await expect(input.run()).rejects.toMatchObject({status:503,message:expect.stringContaining(message)});
  expect(counts()).toEqual(before);
 });
 it('rolls a stale Cloudflare month forward instead of pausing members',async()=>{
  // The month used to have to be updated by hand before members could start AI work.
  settings({cloudflareObservedMonth:'2000-01',cloudflareObservedUsd:10});
  const result=await (await prepareResearch('member-one',member)).run();
  expect(result.operation).toMatchObject({status:'reserved',user_id:'member'});
  const stored=JSON.parse(String(database.sql.prepare('SELECT value_json FROM pilot_settings WHERE id=1').get()!.value_json));
  expect(stored).toMatchObject({cloudflareObservedMonth:stamp().slice(0,7),cloudflareObservedUsd:0,cloudflareAutoRolled:true});
 });
 it.each(['reserved','running','review'])('counts %s work toward member concurrency and writes nothing when full',async(status)=>{
  await startScan();database.sql.prepare('UPDATE credit_operations SET status=?').run(status);settings({aiConcurrency:1});
  const input=await prepareResearch('member-one',member),before=counts();
  await expect(input.run()).rejects.toMatchObject({status:429,message:expect.stringContaining('simultaneous AI action limit')});
  expect(counts()).toEqual(before);
 });
 it('distinguishes the daily cap with no active work',async()=>{
  await startScan();database.sql.exec("UPDATE credit_operations SET status='complete'");settings({aiDailyOperations:1});
  const input=await prepareResearch('member-one',member),before=counts();
  await expect(input.run()).rejects.toMatchObject({status:429,message:expect.stringContaining('daily AI operation limit')});expect(counts()).toEqual(before);
 });
 it('distinguishes insufficient monthly headroom including outstanding holds',async()=>{
  await startScan(member);settings({aiMonthlyBudgetUsd:4});
  const input=await prepareResearch('member-one',member),before=counts();
  await expect(input.run()).rejects.toMatchObject({status:503,message:expect.stringContaining('monthly AI budget')});expect(counts()).toEqual(before);
 });
 it('includes already measured provider cost in the member budget',async()=>{
  const input=await prepareResearch('member-one',member),before=counts();
  await expect(input.run(22)).rejects.toMatchObject({status:503,message:expect.stringContaining('monthly AI budget')});expect(counts()).toEqual(before);
 });
 it('distinguishes a real credit shortage from free owner work',async()=>{
  database.sql.prepare('INSERT INTO credit_prices(id,action,credits,created_at,created_by) VALUES(?,?,?,?,?)').run('priced','scan_single',5,stamp(),'owner');
  const q=await quote(scan(),env(),member),before=counts();
  await expect(reserve(scan({'X-WineLog-Quote':q.id,'Idempotency-Key':'poor'}),env(),member)).rejects.toMatchObject({status:402,message:expect.stringContaining('Insufficient available credits.')});expect(counts()).toEqual(before);
  expect((await startScan(owner)).operation.reserved).toBe(0);
 });
 it('enforces the cap atomically when member requests race',async()=>{
  settings({aiConcurrency:1});
  const qs=await Promise.all([quote(scan(),env(),member),quote(scan(),env(),member)]);
  const results=await Promise.allSettled(qs.map((q,index)=>reserve(scan({'X-WineLog-Quote':q.id,'Idempotency-Key':`race-${index}`}),env(),member)));
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  expect(results.find(r=>r.status==='rejected')).toMatchObject({reason:{status:429,message:expect.stringContaining('simultaneous AI action limit')}});
  expect(counts()).toMatchObject({credit_operations:1,credit_ledger:1});
 });
 it('distinguishes a friend overlap appearing after the quote',async()=>{
  database.sql.exec("INSERT INTO friendships(user_id,friend_id) VALUES('member','owner'),('owner','member')");
  const input=await prepareResearch('member-overlap',member);
  await (await prepareResearch('owner-one')).run();const before=counts();
  await expect(input.run()).rejects.toMatchObject({status:409,message:expect.stringContaining('A friend is researching part')});expect(counts()).toEqual(before);
 });
});

describe('reservation failures and retries',()=>{
 it('reports quote reuse separately and preserves same-key idempotency',async()=>{
  const q=await quote(scan(),env(),owner),headers={'X-WineLog-Quote':q.id,'Idempotency-Key':'first'};
  const accepted=await reserve(scan(headers),env(),owner),before=counts();
  expect(await reserve(scan(headers),env(),owner)).toMatchObject({existing:true,operation:{id:accepted.operation.id}});
  await expect(reserve(scan({...headers,'Idempotency-Key':'second'}),env(),owner)).rejects.toMatchObject({status:409,message:expect.stringContaining('quote was already used')});expect(counts()).toEqual(before);
 });
 it('reports and logs a database failure with full transaction rollback',async()=>{
  const input=await prepareResearch('owner-one'),before=counts(),batch=database.db.batch.bind(database.db);
  vi.spyOn(database.db,'batch').mockImplementationOnce(items=>batch([...items,database.db.prepare('INSERT INTO nonexistent_admission_table VALUES(1)')]));
  const log=vi.spyOn(console,'error').mockImplementation(()=>{});
  await expect(input.run()).rejects.toMatchObject({status:503,message:expect.stringContaining('database error')});expect(counts()).toEqual(before);
  expect(log).toHaveBeenCalledWith(expect.stringContaining('ai_reservation_failed'));
  expect((await input.run()).operation.status).toBe('reserved');
 });
 it('does not mislabel a database failure as a full capacity limit',async()=>{
  await startScan();settings({aiConcurrency:1});const input=await prepareResearch('member-one',member),before=counts();
  vi.spyOn(database.db,'batch').mockRejectedValueOnce(new Error('D1 unavailable'));
  vi.spyOn(console,'error').mockImplementation(()=>{});
  await expect(input.run()).rejects.toMatchObject({status:503,message:expect.stringContaining('database error')});expect(counts()).toEqual(before);
 });
 it('keeps the database error specific when recovery reads also fail',async()=>{
  const input=await prepareResearch('owner-one');
  vi.spyOn(database.db,'batch').mockImplementationOnce(async()=>{
   vi.spyOn(database.db,'prepare').mockImplementation(()=>{throw new Error('D1 unavailable')});
   throw new Error('D1 unavailable');
  });
  vi.spyOn(console,'error').mockImplementation(()=>{});
  await expect(input.run()).rejects.toMatchObject({status:503,message:expect.stringContaining('database error')});
 });
 it('recovers a committed reservation after its batch response is lost',async()=>{
  const input=await prepareResearch('owner-one'),batch=database.db.batch.bind(database.db);
  vi.spyOn(database.db,'batch').mockImplementationOnce(async items=>{await batch(items);throw new Error('Batch response lost')});
  vi.spyOn(console,'error').mockImplementation(()=>{});
  const result=await input.run();expect(result.existing).toBe(true);expect(result.operation.reserved).toBe(0);
  expect(counts()).toMatchObject({credit_operations:1,credit_ledger:1});
 });
});
