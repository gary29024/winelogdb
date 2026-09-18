import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { realD1 } from './support/realD1';
import { authenticate,authRoute,bindGoogleAccount,verifyOrigin } from '../../worker/multiUser/auth';
import { exportJWK,generateKeyPair,SignJWT } from 'jose';
import { hash,seconds,stamp,type Member,type PilotSettings } from '../../worker/multiUser/common';
import { quote,reserve,settle,reconcileOperation,creditRead } from '../../worker/multiUser/credits';
import { durableProvider } from '../../worker/multiUser/provider';
import publicWorker from '../../worker/multiUserEntry';
import { SHARED_WINES_LIST_SQL,socialRoute,sharedWine } from '../../worker/multiUser/social';
import { sharedSubjectKey,publishResearch } from '../../src/lib/research/shared';
import { producerSubjectKey,reusableProducer } from '../../src/lib/research/sharedProducer';
import { buildResearchTargets,loadResearchCache,upsertResearchCache } from '../../src/lib/research/cache';
import { startWineBatchResearch } from '../../src/lib/research/batchWineResearch';
import { deploymentAiCost } from '../../worker/multiUser/admin';
import { flushOutbox,durableQueue,maintainJobs } from '../../worker/multiUser/jobs';
import { meteredBucket } from '../../worker/multiUser/storage';
import { wineSaveStatements } from '../../src/lib/db/wineSave';
import { buildJourneyPayload } from '../../worker/journeyHandler';
import { listJournalPage } from '../../src/lib/journal/list';
import { sparklingDetailsSchema } from '../../src/lib/wine/sparklingDetails';
import type { WineInput } from '../../src/lib/db/schema';
import { thumbnailObjectKey } from '../../src/lib/r2/thumbnails';

let database:ReturnType<typeof realD1>;
const member=(id:string):Member=>({id,email:`${id}@example.com`,display_name:id,role:id==='owner'?'owner':'member',status:'active'});
const config:PilotSettings={memberLimit:25,memberStorageBytes:100_000_000,totalStorageBytes:8_000_000_000,aiConcurrency:4,aiDailyOperations:100,aiDailyEmbeddingRequests:400,aiMonthlyBudgetUsd:100,aiUnitBudgetUsd:1,cloudflareWarningUsd:5,cloudflareStopUsd:10,cloudflareObservedUsd:0,cloudflareObservedMonth:stamp().slice(0,7),allowOverages:true};
const request=(body='{}',extra:Record<string,string>={})=>new Request('https://wine.example/api/recognition',{method:'POST',headers:{'Content-Type':'multipart/form-data; boundary=scan',Origin:'https://wine.example',...extra},body:`--scan\r\nContent-Disposition: form-data; name="images"; filename="label.jpg"\r\nContent-Type: image/jpeg\r\n\r\n${body}\r\n--scan--\r\n`});
beforeEach(()=>{
 database=realD1();
 for(const id of ['owner','alice','bob','carol']){const u=member(id);database.sql.prepare('INSERT INTO app_users(id,email,display_name,role) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,display_name=excluded.display_name,role=excluded.role').run(u.id,u.email,u.display_name,u.role);database.sql.prepare('INSERT OR IGNORE INTO credit_wallets(user_id) VALUES(?)').run(id)}
 database.sql.prepare('INSERT INTO pilot_settings(id,value_json) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value_json=excluded.value_json').run(JSON.stringify(config));
 database.sql.prepare('INSERT INTO credit_prices(id,action,credits,created_at,created_by) VALUES(?,?,?,?,?)').run('price1','scan_single',5,stamp(),'owner');
 database.sql.exec("INSERT INTO credit_ledger(id,user_id,kind,amount,actor_id,reason) VALUES('g1','alice','grant',10,'owner','trial')");
});
afterEach(()=>{database.close();vi.restoreAllMocks();vi.unstubAllGlobals()});
const env=()=>({DB:database.db,AUTH_SECRET:'a'.repeat(48),APP_URL:'https://wine.example',OWNER_GOOGLE_SUB:'explicit-owner-sub'});
const wallet=()=>database.sql.prepare("SELECT balance,reserved FROM credit_wallets WHERE user_id='alice'").get();
describe('account boundary',()=>{
 it('binds only the configured Google subject while preserving legacy owner data',async()=>{
  database.close();database=realD1();
  database.sql.exec("DELETE FROM credit_prices WHERE created_by='owner'; DELETE FROM member_ai_action_policies WHERE updated_by='owner'; DELETE FROM credit_wallets WHERE user_id='owner'; DELETE FROM app_users WHERE id='owner'; INSERT INTO wines(id,owner_id,producer,wine_name,created_at,updated_at) VALUES('legacy','owner','Legacy','Bottle','now','now')");
  const account=await bindGoogleAccount(env(),{sub:'explicit-owner-sub',email:'me@example.com',name:'Owner'},null);expect(account.id).toBe('owner');expect(database.sql.prepare("SELECT owner_id FROM wines WHERE id='legacy'").get()!.owner_id).toBe('owner');
 });
 it('verifies signed Google callbacks, nonce, one-use state, and cookie flags',async()=>{
  const keys=await generateKeyPair('RS256'),jwk={...await exportJWK(keys.publicKey),kid:'test',alg:'RS256',use:'sig'};
  database.sql.prepare('INSERT INTO auth_identities(provider,subject,user_id) VALUES(?,?,?)').run('google','google-alice','alice');
  const e={...env(),GOOGLE_CLIENT_ID:'client',GOOGLE_CLIENT_SECRET:'secret'};
  const start=await authRoute(new Request('https://wine.example/api/auth/google/start'),e),url=new URL(start!.headers.get('Location')!);expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  const state=url.searchParams.get('state')!,nonce=url.searchParams.get('nonce')!;
  const token=await new SignJWT({email:'alice@example.com',email_verified:true,nonce}).setProtectedHeader({alg:'RS256',kid:'test'}).setSubject('google-alice').setIssuer('https://accounts.google.com').setAudience('client').setIssuedAt().setExpirationTime('5m').sign(keys.privateKey);
  vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>String(input).includes('certs')?Response.json({keys:[jwk]}):Response.json({id_token:token})));
  const callback=new Request(`https://wine.example/api/auth/google/callback?state=${state}&code=code`,{headers:{Cookie:`__Host-winelog-flow=${state}`}});
  const response=await authRoute(callback,e);expect(response!.status).toBe(302);expect(response!.headers.get('Set-Cookie')).toContain('Secure; HttpOnly; SameSite=Lax');
  await expect(authRoute(callback,e)).rejects.toMatchObject({status:400});
  await expect(authRoute(new Request(callback.url,{headers:{Cookie:'__Host-winelog-flow=wrong'}}),e)).rejects.toMatchObject({status:400});
  const another=await authRoute(new Request('https://wine.example/api/auth/google/start'),e),fresh=new URL(another!.headers.get('Location')!).searchParams.get('state')!;
  await expect(authRoute(new Request(`https://wine.example/api/auth/google/callback?state=${fresh}&code=another`,{headers:{Cookie:`__Host-winelog-flow=${fresh}`}}),e)).rejects.toMatchObject({status:401});
 });
 it('rejects legacy bearer tokens and requires an active revocable cookie',async()=>{
  await expect(authenticate(new Request('https://wine.example/api/me',{headers:{Authorization:'Bearer old-owner-token'}}),env())).rejects.toMatchObject({status:401});
  database.sql.prepare('INSERT INTO auth_sessions VALUES(?,?,?)').run(await hash('session'),'alice',seconds()+3600);
  const req=new Request('https://wine.example/api/me',{headers:{Cookie:'__Host-winelog=session'}});
  expect((await authenticate(req,env())).id).toBe('alice');database.sql.exec("UPDATE app_users SET status='suspended' WHERE id='alice'");
  await expect(authenticate(req,env())).rejects.toMatchObject({status:401});
 });
 it('rejects cross-origin mutations',()=>{expect(()=>verifyOrigin(request('{}',{Origin:'https://attacker.example'}),env())).toThrow('origin')});
 it('does not bind an email match or an arbitrary signup to existing owner data',async()=>{
  await expect(bindGoogleAccount(env(),{sub:'not-owner',email:'owner@example.com',name:'Pretender'},null)).rejects.toMatchObject({status:403});
  expect(database.sql.prepare('SELECT count(*) AS n FROM auth_identities').get()!.n).toBe(0);
 });
 it('consumes an email-bound invitation once and creates a zero-credit member',async()=>{
  database.sql.prepare('INSERT INTO member_invitations(token_hash,email,created_by,expires_at) VALUES(?,?,?,?)').run('invite','new@example.com','owner',seconds()+60);
  await expect(bindGoogleAccount(env(),{sub:'bad',email:'other@example.com',name:'Other'},'invite')).rejects.toMatchObject({status:403});
  const user=await bindGoogleAccount(env(),{sub:'new',email:'new@example.com',name:'New'},'invite');
  expect(database.sql.prepare('SELECT balance FROM credit_wallets WHERE user_id=?').get(user.id)!.balance).toBe(0);
  await expect(bindGoogleAccount(env(),{sub:'second',email:'new@example.com',name:'Second'},'invite')).rejects.toMatchObject({status:403});
 });
});
describe('credit transactions',()=>{
 it('deduplicates matching friend vintage lookups and resolves followers without AI polling',async()=>{
  database.sql.exec("INSERT INTO friendships(user_id,friend_id) VALUES('alice','bob'),('bob','alice')");
  database.sql.prepare('INSERT INTO credit_prices VALUES(?,?,?,?,?)').run('vintage-price','vintage_window',1,stamp(),'owner');
  const req=(headers:Record<string,string>={},wineStyle='red')=>new Request('https://wine.example/api/maturity/vintage',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify({country:'France',region:'Burgundy',vintage:2020,wineStyle})});
  const q=await quote(req(),env(),member('alice')),sponsor=await reserve(req({'X-WineLog-Quote':q.id,'Idempotency-Key':'vintage'}),env(),member('alice'));
  expect((await quote(req({},'white'),env(),member('bob'))).total).toBe(1);
  expect((await quote(req(),env(),member('carol'))).total).toBe(1);
  const followerQuote=await quote(req(),env(),member('bob'));expect(followerQuote).toMatchObject({total:0,waitingForFriend:true});
  const follower=await reserve(req({'X-WineLog-Quote':followerQuote.id,'Idempotency-Key':'vintage-follow'}),env(),member('bob'));
  database.sql.prepare("UPDATE credit_operations SET status='running' WHERE id=?").run(follower.operation.id);
  await settle(database.db,sponsor.operation,1,{body:{window:{}},status:200});
  const provider=vi.fn();vi.stubGlobal('fetch',provider);
  const response=await creditRead(new Request(`https://wine.example/api/credits/operations/${follower.operation.id}`),env(),member('bob'));
  expect(await response!.json()).toMatchObject({status:'complete',captured:0});expect(provider).not.toHaveBeenCalled();
 });
 it('rejects changed research subjects both after quoting and after queue dispatch',async()=>{
  database.sql.exec("INSERT INTO wines(id,owner_id,producer,wine_name,vintage,country,region,appellation,wine_style,created_at,updated_at) VALUES('quoted-wine','alice','Domaine Test','Clos Test',2020,'France','Burgundy','Clos Test','red','now','now')");
  for(const action of ['wine_producer','wine_terroir','wine_vintage_context','wine_wine_vintage'])database.sql.prepare('INSERT INTO credit_prices VALUES(?,?,?,?,?)').run(action,action,1,stamp(),'owner');
  const req=(headers:Record<string,string>={})=>new Request('https://wine.example/api/wines/quoted-wine/deep-search',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:'{}'});
  const q=await quote(req(),env(),member('alice'));
  database.sql.exec("UPDATE wines SET wine_style='white' WHERE id='quoted-wine'");
  await expect(reserve(req({'X-WineLog-Quote':q.id,'Idempotency-Key':'changed'}),env(),member('alice'))).rejects.toMatchObject({status:409});
  database.sql.exec("UPDATE wines SET wine_style='red' WHERE id='quoted-wine'");
  const {operation}=await reserve(req({'X-WineLog-Quote':q.id,'Idempotency-Key':'queued'}),env(),member('alice'));
  database.sql.exec("UPDATE wines SET wine_name='Different Wine' WHERE id='quoted-wine'");
  const provider=vi.fn();vi.stubGlobal('fetch',provider);
  const result=await startWineBatchResearch({DB:database.db,RESEARCH_QUEUE:{send:vi.fn()} as unknown as Queue<unknown>,CREDIT_CONTEXT:{db:database.db,operationId:operation.id,namespace:'queue'}},'alice','quoted-wine','run','none');
  expect(result).toMatchObject({ok:false,error:expect.stringContaining('identity changed')});expect(provider).not.toHaveBeenCalled();
 });
 it('continues the same truncated sheet page without charging another scan',async()=>{
  database.sql.prepare('INSERT INTO credit_prices VALUES(?,?,?,?,?)').run('sheet-price','scan_sheet',5,stamp(),'owner');
  database.sql.exec("INSERT INTO tastings(id,owner_id,name,tasting_date,created_at,updated_at) VALUES('t','alice','Tasting','2026-09-01','now','now')");
  const sheet=(parent?:string,changed=false,extra:Record<string,string>={})=>new Request('https://wine.example/api/tastings/t/sheet/parse',{method:'POST',headers:{'Content-Type':'multipart/form-data; boundary=winelog-sheet-boundary',...(parent?{'X-WineLog-Continuation':parent}:{}),...extra},body:`--winelog-sheet-boundary\r\nContent-Disposition: form-data; name="images"; filename="page.jpg"\r\nContent-Type: image/jpeg\r\n\r\n${changed?'other':'page'}\r\n${parent?'--winelog-sheet-boundary\r\nContent-Disposition: form-data; name="afterLine"\r\n\r\n20\r\n':''}--winelog-sheet-boundary--\r\n`});
  const first=await quote(sheet(),env(),member('alice')),root=await reserve(sheet(undefined,false,{'X-WineLog-Quote':first.id,'Idempotency-Key':'sheet'}),env(),member('alice'));
  await settle(database.db,root.operation,5,{body:{truncated:true,resumeAfterLine:20},status:200});
  const next=await quote(sheet(root.operation.id),env(),member('alice'));expect(next.total).toBe(0);
  const following=await reserve(sheet(root.operation.id,false,{'X-WineLog-Quote':next.id,'Idempotency-Key':'continuation'}),env(),member('alice'));await settle(database.db,following.operation,0,{body:{truncated:false},status:200});
  expect(wallet()).toMatchObject({balance:5,reserved:0});await expect(quote(sheet(root.operation.id,true),env(),member('alice'))).rejects.toMatchObject({status:409});
 });
 it('lets an accepted friend follow identical active research at zero credits',async()=>{
  database.sql.exec("INSERT INTO friendships(user_id,friend_id) VALUES('alice','bob'),('bob','alice')");
  for(const user of ['alice','bob'])database.sql.prepare('INSERT INTO wines(id,owner_id,producer,wine_name,vintage,country,region,appellation,wine_style,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(`w-${user}`,user,'Domaine Test','Clos Test',2020,'France','Burgundy','Clos Test','red',stamp(),stamp());
  for(const action of ['wine_producer','wine_terroir','wine_vintage_context','wine_wine_vintage'])database.sql.prepare('INSERT INTO credit_prices VALUES(?,?,?,?,?)').run(action,action,1,stamp(),'owner');
  const research=(user:string,headers:Record<string,string>={})=>new Request(`https://wine.example/api/wines/w-${user}/deep-search`,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:'{}'});
  const a=await quote(research('alice'),env(),member('alice')),sponsor=await reserve(research('alice',{'X-WineLog-Quote':a.id,'Idempotency-Key':'sponsor'}),env(),member('alice'));
  database.sql.exec("UPDATE wines SET wine_name='Another Cuvee' WHERE owner_id='bob'");
  await expect(quote(research('bob'),env(),member('bob'))).rejects.toMatchObject({status:409,message:expect.stringContaining('researching part')});
  database.sql.exec("UPDATE wines SET wine_name='Clos Test' WHERE owner_id='bob'");
  const b=await quote(research('bob'),env(),member('bob'));expect(b.total).toBe(0);expect(b.waitingForFriend).toBe(true);
  const follower=await reserve(research('bob',{'X-WineLog-Quote':b.id,'Idempotency-Key':'follow'}),env(),member('bob'));await settle(database.db,sponsor.operation,4,{body:{ok:true},status:200});await reconcileOperation(database.db,follower.operation);
  expect(database.sql.prepare("SELECT balance,reserved FROM credit_wallets WHERE user_id='bob'").get()).toMatchObject({balance:0,reserved:0});expect(database.sql.prepare('SELECT status FROM credit_operations WHERE id=?').get(follower.operation.id)!.status).toBe('complete');
 });
 it('serializes concurrent reservations without an overdraft',async()=>{
  const quotes=await Promise.all([quote(request(),env(),member('alice')),quote(request(),env(),member('alice')),quote(request(),env(),member('alice'))]);
  const results=await Promise.allSettled(quotes.map((q,i)=>reserve(request('{}',{'X-WineLog-Quote':q.id,'Idempotency-Key':`parallel-${i}`}),env(),member('alice'))));
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(2);expect(wallet()).toMatchObject({balance:10,reserved:10});
 });
 it('quotes every image in a combined single-wine scan',async()=>{
  const form=new FormData();form.append('images',new Blob(['front'],{type:'image/jpeg'}),'front.jpg');form.append('images',new Blob(['back'],{type:'image/jpeg'}),'back.jpg');
  const q=await quote(new Request('https://wine.example/api/recognition',{method:'POST',body:form}),env(),member('alice'));
  expect(q.total).toBe(10);expect(q.units).toHaveLength(2);
 });
 it('reserves once, captures once and leaves a permanent ledger',async()=>{
  const q=await quote(request(),env(),member('alice')),r=request('{}',{'X-WineLog-Quote':q.id,'Idempotency-Key':'one'});
  const {operation}=await reserve(r,env(),member('alice'));expect(wallet()).toMatchObject({balance:10,reserved:5});
  expect((await reserve(r,env(),member('alice'))).existing).toBe(true);
  await settle(database.db,operation,3,{body:{ok:true},status:200});await settle(database.db,operation,3);
  expect(wallet()).toMatchObject({balance:7,reserved:0});
  expect(()=>database.sql.exec("DELETE FROM credit_ledger WHERE kind='capture'")).toThrow('append-only');
 });
 it('rolls back an overdraft including its operation and reservation ledger entry',async()=>{
  database.sql.exec("UPDATE credit_wallets SET balance=2 WHERE user_id='alice'");
  const q=await quote(request(),env(),member('alice'));
  await expect(reserve(request('{}',{'X-WineLog-Quote':q.id,'Idempotency-Key':'low'}),env(),member('alice'))).rejects.toMatchObject({status:409});
  expect(wallet()).toMatchObject({balance:2,reserved:0});expect(database.sql.prepare('SELECT count(*) AS n FROM credit_operations').get()!.n).toBe(0);
 });
 it('binds quotes to owner and exact request and rejects expiry',async()=>{
  const q=await quote(request(),env(),member('alice')),headers={'X-WineLog-Quote':q.id,'Idempotency-Key':'bound'};
  await expect(reserve(request('{}',headers),env(),member('bob'))).rejects.toMatchObject({status:409});
  await expect(reserve(request('{"different":true}',headers),env(),member('alice'))).rejects.toMatchObject({status:409});
  database.sql.exec('UPDATE credit_quotes SET expires_at=1');await expect(reserve(request('{}',headers),env(),member('alice'))).rejects.toMatchObject({status:409});
 });
 it('keeps the quoted tariff when prices change and refunds failed work',async()=>{
  const q=await quote(request(),env(),member('alice'));database.sql.prepare('INSERT INTO credit_prices VALUES(?,?,?,?,?)').run('price2','scan_single',9,'9999','owner');
  const {operation}=await reserve(request('{}',{'X-WineLog-Quote':q.id,'Idempotency-Key':'price'}),env(),member('alice'));
  expect(operation.reserved).toBe(5);await settle(database.db,operation,0,{body:{error:'Provider failed'},status:502});expect(wallet()).toMatchObject({balance:10,reserved:0});
 });
 it('sponsors group scans for members',async()=>{
  const q=await quote(request('{}',{'X-WineLog-Recognition-Mode':'group'}),env(),member('alice'));
  expect(q.total).toBe(0);expect(q.units).toHaveLength(1);expect(q.units[0]).toMatchObject({action:'scan_group',credits:0,priceId:'pilot-free-scan-group'});
 });
 it('includes outstanding work in the provider budget',async()=>{
  const q=await quote(request(),env(),member('alice'));await expect(reserve(request('{}',{'X-WineLog-Quote':q.id,'Idempotency-Key':'budget'}),env(),member('alice'),100)).rejects.toMatchObject({status:409});
 });
});
describe('shared wines as recipient journal history',()=>{
 it('projects a shared wine into the recipient history without copying private owner fields',()=>{
  database.sql.exec(`
   INSERT INTO friendships(user_id,friend_id) VALUES('alice','bob'),('bob','alice');
   INSERT INTO wines(id,owner_id,producer,wine_name,vintage,country,region,appellation,grapes_json,wine_style,tasting_notes,rating,tasting_date,venue,price,currency,created_at,updated_at)
   VALUES('shared-history','alice','Domaine Shared','Clos Shared',2022,'France','Burgundy','Volnay','["Pinot Noir"]','red','Floral and fine',93,'2026-09-10','Private home',888,'HKD','2026-09-10T12:00:00Z','2026-09-10T12:00:00Z');
   INSERT INTO wine_shares(wine_id,owner_id,recipient_id,created_at) VALUES('shared-history','alice','bob','2026-09-11T12:00:00Z');
  `);
  const visible=database.sql.prepare("SELECT id,producer,is_shared,shared_by,tasting_notes,rating,tasting_date,venue,price,currency,favorite,country FROM member_visible_wines WHERE owner_id='bob'").get()!;
  // The drinking date crosses from 0077 on, so a shared bottle sorts and buckets
  // by when it was drunk rather than by the instant it was received. Everything
  // else the owner wrote about drinking it stays theirs.
  expect(visible).toMatchObject({id:'shared-history',producer:'Domaine Shared',is_shared:1,shared_by:'alice',tasting_notes:'',rating:null,tasting_date:'2026-09-10',venue:null,price:null,currency:null,favorite:0,country:'France'});
  const summary=database.sql.prepare("SELECT count(*) AS total_wines,sum(CASE WHEN price IS NOT NULL THEN 1 ELSE 0 END) AS priced_wines,count(DISTINCT country) AS countries FROM member_visible_wines WHERE owner_id='bob'").get()!;
  expect(summary).toMatchObject({total_wines:1,priced_wines:0,countries:1});
  expect(database.sql.prepare("SELECT count(*) AS n FROM wines WHERE owner_id='bob'").get()!.n).toBe(0);
 });
 it('lets the recipient favorite a shared journal wine without changing the source owner',async()=>{
  database.sql.exec(`
   INSERT INTO friendships(user_id,friend_id) VALUES('alice','bob'),('bob','alice');
   INSERT INTO wines(id,owner_id,producer,wine_name,vintage,country,region,appellation,grapes_json,wine_style,tasting_notes,rating,tasting_date,favorite,created_at,updated_at)
   VALUES('shared-favorite','alice','Domaine Shared','Favorite Me',2021,'France','Burgundy','Volnay','["Pinot Noir"]','red','Silky',94,'2026-09-09',0,'2026-09-09T12:00:00Z','2026-09-09T12:00:00Z');
   INSERT INTO wine_shares(wine_id,owner_id,recipient_id,created_at) VALUES('shared-favorite','alice','bob','2026-09-10T12:00:00Z');
  `);
  database.sql.prepare('INSERT INTO auth_sessions VALUES(?,?,?)').run(await hash('bob-session'),'bob',seconds()+3600);
  const e={...env(),WINE_IMAGES:{},RESEARCH_QUEUE:{send:vi.fn()},ASSETS:{fetch:vi.fn(async()=>Response.json({error:'Not found'},{status:404}))}} as unknown as Parameters<typeof publicWorker.fetch>[1];
  const pending:Promise<unknown>[]=[],context={waitUntil:(p:Promise<unknown>)=>pending.push(p)} as unknown as ExecutionContext;
  const call=async(favorite:boolean)=>publicWorker.fetch(new Request('https://wine.example/api/wines/shared-favorite/favorite',{
   method:'PUT',headers:{Cookie:'__Host-winelog=bob-session',Origin:'https://wine.example','Content-Type':'application/json'},body:JSON.stringify({favorite})
  }),e,context);

  const added=await call(true);
  expect(added.status).toBe(200);
  expect(await added.json()).toMatchObject({id:'shared-favorite',favorite:true,changed:true});
  expect(database.sql.prepare("SELECT favorite FROM wines WHERE owner_id='alice' AND id='shared-favorite'").get()!.favorite).toBe(0);
  expect(database.sql.prepare("SELECT favorite FROM member_visible_wines WHERE owner_id='bob' AND id='shared-favorite'").get()!.favorite).toBe(1);
  expect(database.sql.prepare("SELECT sum(favorite) AS favorites FROM member_visible_wines WHERE owner_id='bob'").get()!.favorites).toBe(1);

  const removed=await call(false);
  expect(removed.status).toBe(200);
  expect(await removed.json()).toMatchObject({id:'shared-favorite',favorite:false,changed:true});
  expect(database.sql.prepare("SELECT favorite FROM shared_wine_preferences WHERE recipient_id='bob' AND wine_id='shared-favorite'").get()!.favorite).toBe(0);
  expect(database.sql.prepare("SELECT favorite FROM member_visible_wines WHERE owner_id='bob' AND id='shared-favorite'").get()!.favorite).toBe(0);
  await Promise.all(pending);
 });

 it('stores the sharee experience separately and keeps it when favorite changes',async()=>{
  database.sql.exec(`
   INSERT INTO friendships(user_id,friend_id) VALUES('alice','bob'),('bob','alice');
   INSERT INTO wines(id,owner_id,producer,wine_name,tasting_notes,rating,tasting_date,venue,price,currency,created_at,updated_at)
   VALUES('shared-experience','alice','Domaine Shared','Personal Pour','Owner note',96,'2026-09-01','Owner home',1200,'HKD','now','now');
   INSERT INTO wine_shares(wine_id,owner_id,recipient_id) VALUES('shared-experience','alice','bob');
   INSERT INTO shared_wine_preferences(recipient_id,owner_id,wine_id,favorite) VALUES('bob','alice','shared-experience',1);
  `);
  const e={...env(),WINE_IMAGES:{} as R2Bucket};
  const response=await socialRoute(new Request('https://wine.example/api/shared/wines/shared-experience/experience',{method:'PUT',body:JSON.stringify({
   tastingNotes:'My note',rating:91,tastingDate:'2026-09-18',tastingName:'Friday dinner',venue:'My venue',locationName:'Central',price:680,currency:'hkd'
  })}),e,member('bob'));
  expect(response?.status).toBe(200);
  expect(database.sql.prepare("SELECT favorite,tasting_notes,rating,tasting_date,tasting_name,venue,price,currency FROM shared_wine_preferences WHERE recipient_id='bob' AND wine_id='shared-experience'").get())
   .toMatchObject({favorite:1,tasting_notes:'My note',rating:91,tasting_date:'2026-09-18',tasting_name:'Friday dinner',venue:'My venue',price:680,currency:'HKD'});
  const source=database.sql.prepare("SELECT tasting_notes,rating,tasting_date,venue,price FROM wines WHERE owner_id='alice' AND id='shared-experience'").get();
  expect(source).toMatchObject({tasting_notes:'Owner note',rating:96,tasting_date:'2026-09-01',venue:'Owner home',price:1200});
  const detail=await (await socialRoute(new Request('https://wine.example/api/shared/wines/shared-experience'),e,member('bob')))!.json();
  expect(detail).toMatchObject({tastingNotes:'My note',rating:91,tastingDate:'2026-09-18',tastingName:'Friday dinner',venue:'My venue',price:680,currency:'HKD',favorite:true});
 });

 it('rejects an experience it cannot store faithfully instead of coercing it',async()=>{
  database.sql.exec(`
   INSERT INTO friendships(user_id,friend_id) VALUES('alice','bob'),('bob','alice');
   INSERT INTO wines(id,owner_id,producer,wine_name,created_at,updated_at)
   VALUES('shared-validated','alice','Domaine Shared','Checked Pour','now','now');
   INSERT INTO wine_shares(wine_id,owner_id,recipient_id) VALUES('shared-validated','alice','bob');
  `);
  const e={...env(),WINE_IMAGES:{} as R2Bucket};
  const put=(payload:Record<string,unknown>)=>socialRoute(new Request('https://wine.example/api/shared/wines/shared-validated/experience',
   {method:'PUT',body:JSON.stringify(payload)}),e,member('bob'));
  // A two-letter code and a country name both look like currencies to a human
  // and neither round-trips as one, so both have to come back as a 400 rather
  // than being stored and shown next to a number.
  await expect(put({currency:'HK'})).rejects.toMatchObject({status:400});
  await expect(put({currency:'dollars'})).rejects.toMatchObject({status:400});
  // 2026-02-30 passes a /^\d{4}-\d{2}-\d{2}$/ shape check but is not a day.
  await expect(put({tastingDate:'2026-02-30'})).rejects.toMatchObject({status:400});
  await expect(put({tastingDate:'18-09-2026'})).rejects.toMatchObject({status:400});
  await expect(put({rating:101})).rejects.toMatchObject({status:400});
  await expect(put({rating:-1})).rejects.toMatchObject({status:400});
  await expect(put({price:-5})).rejects.toMatchObject({status:400});
  expect(database.sql.prepare("SELECT count(*) AS n FROM shared_wine_preferences WHERE recipient_id='bob' AND wine_id='shared-validated'").get()!.n).toBe(0);
  const ok=await put({rating:88,tastingDate:'2026-02-28',currency:'eur',price:42});
  expect(ok?.status).toBe(200);
  expect(database.sql.prepare("SELECT rating,tasting_date,currency,price FROM shared_wine_preferences WHERE recipient_id='bob' AND wine_id='shared-validated'").get())
   .toMatchObject({rating:88,tasting_date:'2026-02-28',currency:'EUR',price:42});
 });

 it('shares the wine facts the owner sees, and the research they already paid for',async()=>{
  const deep={summary:'Forest floor and dried rose.',vintageQuality:'A cool year.',producerDetails:'Domaine notes.',
   producerWinemakingPractices:'Whole cluster.',winemakingTechniques:'Long maceration.',terroir:'Limestone.',
   drinkingWindow:'2026-2040',sources:[{title:'Vinous',url:'https://example.test/v'}],model:'gemini-3.7-flash',
   researchedAt:'2026-09-01T00:00:00.000Z'};
  database.sql.exec(`
   INSERT INTO friendships(user_id,friend_id) VALUES('alice','bob'),('bob','alice');
   -- Same producer, one row per account: that is what match_key bridges.
   INSERT INTO producers(id,owner_id,canonical_name,match_key,home_country,created_at,updated_at)
   VALUES('prod-alice','alice','Domaine Shared','domaine-shared','France','now','now'),
         ('prod-bob','bob','Domaine Shared','domaine-shared','France','now','now');
  `);
  database.sql.prepare(`INSERT INTO wines(id,owner_id,producer_id,producer,wine_name,region,appellation,recognized_region,recognized_appellation,grapes_json,grape_blend_json,deep_search_json,created_at,updated_at)
   VALUES('shared-facts','alice','prod-alice','Domaine Shared','Full Facts','Burgundy','Volnay','Bourgogne','Volnay 1er','["Pinot Noir"]',?,?,'now','now')`)
   .run('[{"grape":"Pinot Noir","percentage":100}]',JSON.stringify(deep));
  database.sql.exec("INSERT INTO wine_shares(wine_id,owner_id,recipient_id) VALUES('shared-facts','alice','bob')");
  const e={...env(),WINE_IMAGES:{} as R2Bucket};
  const detail=await (await socialRoute(new Request('https://wine.example/api/shared/wines/shared-facts'),e,member('bob')))!.json() as Record<string,unknown>;
  expect(detail).toMatchObject({
   recognizedRegion:'Bourgogne',recognizedAppellation:'Volnay 1er',
   grapeBlend:[{grape:'Pinot Noir',percentage:100}]
  });
  expect((detail.deepSearch as {summary:string}).summary).toBe('Forest floor and dried rose.');
  // The producer link resolves to BOB's own producer row, never alice's: ids are
  // keyed (owner_id,id), so alice's id would 404 in bob's account.
  expect(detail.producerId).toBe('prod-bob');
 });

 it('gives no producer link when the recipient has never logged that producer',async()=>{
  database.sql.exec(`
   INSERT INTO friendships(user_id,friend_id) VALUES('alice','bob'),('bob','alice');
   INSERT INTO producers(id,owner_id,canonical_name,match_key,home_country,created_at,updated_at)
   VALUES('prod-alice','alice','Domaine Solo','domaine-solo','France','now','now');
   INSERT INTO wines(id,owner_id,producer_id,producer,wine_name,created_at,updated_at)
   VALUES('shared-noprod','alice','prod-alice','Domaine Solo','Unmatched','now','now');
   INSERT INTO wine_shares(wine_id,owner_id,recipient_id) VALUES('shared-noprod','alice','bob');
  `);
  const e={...env(),WINE_IMAGES:{} as R2Bucket};
  const detail=await (await socialRoute(new Request('https://wine.example/api/shared/wines/shared-noprod'),e,member('bob')))!.json() as Record<string,unknown>;
  expect(detail.producerId).toBeNull();
 });

 it('keeps perceived structure per viewer and validates it',async()=>{
  database.sql.exec(`
   INSERT INTO friendships(user_id,friend_id) VALUES('alice','bob'),('bob','alice');
   INSERT INTO wines(id,owner_id,producer,wine_name,created_at,updated_at)
   VALUES('shared-structure','alice','Domaine Shared','Structured','now','now');
   INSERT INTO wine_shares(wine_id,owner_id,recipient_id) VALUES('shared-structure','alice','bob');
   INSERT INTO wine_tasting_structures(owner_id,wine_id,structure_json,created_at,updated_at)
   VALUES('alice','shared-structure','{"acidity":"low"}','now','now');
  `);
  const e={...env(),WINE_IMAGES:{} as R2Bucket};
  const put=(payload:Record<string,unknown>)=>socialRoute(new Request('https://wine.example/api/shared/wines/shared-structure/experience',
   {method:'PUT',body:JSON.stringify(payload)}),e,member('bob'));
  // A scale value from the wrong axis and an unknown axis are both 400s, not a
  // blob stored now and silently dropped when it is read back.
  await expect(put({structure:{acidity:'pronounced'}})).rejects.toMatchObject({status:400});
  await expect(put({structure:{sweetness:'high'}})).rejects.toMatchObject({status:400});
  expect((await put({structure:{acidity:'high',tannin:'medium_plus'}}))?.status).toBe(200);
  const detail=await (await socialRoute(new Request('https://wine.example/api/shared/wines/shared-structure'),e,member('bob')))!.json() as Record<string,unknown>;
  expect(detail.structure).toMatchObject({acidity:'high',tannin:'medium_plus'});
  // Alice's own structure is untouched and never reaches bob.
  expect(database.sql.prepare("SELECT structure_json FROM wine_tasting_structures WHERE owner_id='alice' AND wine_id='shared-structure'").get()!.structure_json).toBe('{"acidity":"low"}');
 });

 it('publishes only the research text, never the run diagnostics',async()=>{
  // deepSearchSchema also parses model, quality and provenance. Those answer
  // "should I trust this run" and belong to whoever paid for it, so the shared
  // JSON must not carry them - the page not drawing them is not a boundary.
  const deep={summary:'Forest floor.',vintageQuality:'A cool year.',producerDetails:'Notes.',
   producerWinemakingPractices:'Whole cluster.',winemakingTechniques:'Long maceration.',terroir:'Limestone.',
   drinkingWindow:'2026-2040',sources:[{title:'Vinous',url:'https://example.test/v'}],
   model:'gemini-3.7-flash',researchedAt:'2026-09-01T00:00:00.000Z',
   quality:{status:'mixed',score:62,sourceTier:'specialist',warnings:['no-grounding-source'],scoreNote:'thin'},
   provenance:{version:1}};
  database.sql.exec("INSERT INTO friendships(user_id,friend_id) VALUES('alice','bob'),('bob','alice')");
  database.sql.prepare(`INSERT INTO wines(id,owner_id,producer,wine_name,deep_search_json,created_at,updated_at)
   VALUES('shared-deep','alice','Domaine Shared','Researched',?,'now','now')`).run(JSON.stringify(deep));
  database.sql.exec("INSERT INTO wine_shares(wine_id,owner_id,recipient_id) VALUES('shared-deep','alice','bob')");
  const e={...env(),WINE_IMAGES:{} as R2Bucket};
  const detail=await (await socialRoute(new Request('https://wine.example/api/shared/wines/shared-deep'),e,member('bob')))!.json() as Record<string,unknown>;
  const shared=detail.deepSearch as Record<string,unknown>;
  expect(shared.summary).toBe('Forest floor.');
  expect(shared.sources).toHaveLength(1);
  for(const secret of ['model','quality','provenance'])
   expect(shared,`${secret} must not cross accounts`).not.toHaveProperty(secret);
  // Belt and braces: the serialized body must not mention them either.
  const body=JSON.stringify(detail);
  expect(body).not.toContain('gemini-3.7-flash');
  expect(body).not.toContain('no-grounding-source');
 });

 it('counts the recipient\'s own structure in their journey analytics',async()=>{
  database.sql.exec(`
   INSERT INTO friendships(user_id,friend_id) VALUES('alice','bob'),('bob','alice');
   INSERT INTO wines(id,owner_id,producer,wine_name,created_at,updated_at)
   VALUES('shared-journey','alice','Domaine Shared','Analysed','now','now');
   INSERT INTO wine_shares(wine_id,owner_id,recipient_id) VALUES('shared-journey','alice','bob');
   -- Alice's own perception of her bottle, which must stay out of bob's numbers.
   INSERT INTO wine_tasting_structures(owner_id,wine_id,structure_json,created_at,updated_at)
   VALUES('alice','shared-journey','{"acidity":"low"}','now','now');
  `);
  const before=await buildJourneyPayload(database.db,'bob',true) as {summary:{structuredTastings:number};structures:unknown[]};
  expect(before.summary.structuredTastings).toBe(0);
  expect(before.structures).toHaveLength(0);

  const e={...env(),WINE_IMAGES:{} as R2Bucket};
  const saved=await socialRoute(new Request('https://wine.example/api/shared/wines/shared-journey/experience',
   {method:'PUT',body:JSON.stringify({rating:91,structure:{acidity:'high',tannin:'medium_plus'}})}),e,member('bob'));
  expect(saved?.status).toBe(200);

  const after=await buildJourneyPayload(database.db,'bob',true) as {summary:{structuredTastings:number};structures:Array<{structure:{acidity?:string};rating:number|null}>};
  expect(after.summary.structuredTastings).toBe(1);
  expect(after.structures).toHaveLength(1);
  // Bob's own axis and his own score, not alice's.
  expect(after.structures[0].structure.acidity).toBe('high');
  expect(after.structures[0].rating).toBe(91);
  // Alice's page still reflects only alice's own perception.
  const alice=await buildJourneyPayload(database.db,'alice',true) as {structures:Array<{structure:{acidity?:string}}>};
  expect(alice.structures.map(row=>row.structure.acidity)).toEqual(['low']);
 });

 it('shares the bottle\'s release details, and nothing the schema does not cover',async()=>{
  // Dosage, disgorgement, assemblage and the rest are facts about the bottle
  // that was shared, not anyone's experience of it, so they travel with it.
  const details={dosageGPerL:6,dosageCategory:'Extra Brut',disgorgement:'Spring 2024',
   baseVintage:2018,reserveWinePercentage:35,leesAgeingMonths:48,assemblage:'60% Pinot Noir, 40% Chardonnay'};
  database.sql.exec(`
   INSERT INTO friendships(user_id,friend_id) VALUES('alice','bob'),('bob','alice');
   INSERT INTO wines(id,owner_id,producer,wine_name,created_at,updated_at)
   VALUES('shared-fizz','alice','Maison Shared','Grand Brut','now','now');
   INSERT INTO wine_shares(wine_id,owner_id,recipient_id) VALUES('shared-fizz','alice','bob');
  `);
  database.sql.prepare("INSERT INTO wine_sparkling_details(owner_id,wine_id,details_json,updated_at) VALUES('alice','shared-fizz',?,'now')")
   .run(JSON.stringify(details));
  const e={...env(),WINE_IMAGES:{} as R2Bucket};
  const detail=await (await socialRoute(new Request('https://wine.example/api/shared/wines/shared-fizz'),e,member('bob')))!.json() as Record<string,unknown>;
  expect(detail.sparklingDetails).toMatchObject(details);

  // The schema is the boundary, so pin it two ways. Absent optional fields stay
  // absent rather than coming back null, so the payload is a subset of the
  // schema's keys - and the schema's own key list is fixed here, so the day a
  // private field is added to it this fails instead of quietly shipping it.
  const allowed=Object.keys(sparklingDetailsSchema.shape).sort();
  expect(allowed).toEqual([
   'assemblage','baseVintage','disgorgement','dosageCategory','dosageGPerL','fermentationElevage',
   'leesAgeingMonths','lotCode','malolactic','otherTechnicalDetails','reserveWineDetail','reserveWinePercentage','tirage'
  ]);
  expect(Object.keys(detail.sparklingDetails as object).filter(key=>!allowed.includes(key)),'nothing outside the schema crosses').toEqual([]);
 });

 it('sends no sparkling details for a wine that has none',async()=>{
  database.sql.exec(`
   INSERT INTO friendships(user_id,friend_id) VALUES('alice','bob'),('bob','alice');
   INSERT INTO wines(id,owner_id,producer,wine_name,created_at,updated_at)
   VALUES('shared-still','alice','Domaine Shared','Still Red','now','now');
   INSERT INTO wine_shares(wine_id,owner_id,recipient_id) VALUES('shared-still','alice','bob');
   INSERT INTO wine_sparkling_details(owner_id,wine_id,details_json,updated_at) VALUES('alice','shared-still','{}','now');
  `);
  const e={...env(),WINE_IMAGES:{} as R2Bucket};
  const detail=await (await socialRoute(new Request('https://wine.example/api/shared/wines/shared-still'),e,member('bob')))!.json() as Record<string,unknown>;
  expect(detail.sparklingDetails).toBeNull();
 });

 it('orders a bulk share by when each bottle was drunk, not when it arrived',async()=>{
  // Sharing many wines at once gives every one of them the same shared_at. When
  // that was the only date a recipient had, all the date keys tied and the order
  // fell through to wine id, so a friend's journal came out shuffled.
  database.sql.exec("INSERT INTO friendships(user_id,friend_id) VALUES('alice','bob'),('bob','alice')");
  const wine=database.sql.prepare(`INSERT INTO wines(id,owner_id,producer,wine_name,tasting_date,created_at,updated_at)
   VALUES(?,'alice','Domaine Shared',?,?,?,?)`);
  const share=database.sql.prepare("INSERT INTO wine_shares(wine_id,owner_id,recipient_id,created_at) VALUES(?,'alice','bob','2026-09-18T12:00:00Z')");
  // Ids deliberately run opposite to the drinking dates: under the old order the
  // id tiebreak decided, so this would come back exactly backwards.
  const bottles=[['w-a','Oldest','2026-01-05'],['w-b','Middle','2026-05-20'],['w-c','Newest','2026-09-01']];
  for(const [id,name,date] of bottles){wine.run(id,name,date,`${date}T12:00:00Z`,`${date}T12:00:00Z`);share.run(id)}

  const page=await listJournalPage(database.db,'bob',{},[],true);
  expect(page.items.map(item=>item.wineName)).toEqual(['Newest','Middle','Oldest']);
  expect(page.items.map(item=>item.tastingDate)).toEqual(['2026-09-01','2026-05-20','2026-01-05']);

  // A recipient's own date is still theirs and still wins.
  const e={...env(),WINE_IMAGES:{} as R2Bucket};
  await socialRoute(new Request('https://wine.example/api/shared/wines/w-a/experience',
   {method:'PUT',body:JSON.stringify({tastingDate:'2026-12-25'})}),e,member('bob'));
  const after=await listJournalPage(database.db,'bob',{},[],true);
  expect(after.items.map(item=>item.wineName)).toEqual(['Oldest','Newest','Middle']);
 });

 it('refuses an experience for a wine the member was never shared',async()=>{
  database.sql.exec(`
   INSERT INTO friendships(user_id,friend_id) VALUES('alice','bob'),('bob','alice');
   INSERT INTO wines(id,owner_id,producer,wine_name,created_at,updated_at)
   VALUES('never-shared','alice','Domaine Shared','Private Pour','now','now');
  `);
  const e={...env(),WINE_IMAGES:{} as R2Bucket};
  await expect(socialRoute(new Request('https://wine.example/api/shared/wines/never-shared/experience',
   {method:'PUT',body:JSON.stringify({rating:95})}),e,member('bob'))).rejects.toMatchObject({status:404});
  expect(database.sql.prepare("SELECT count(*) AS n FROM shared_wine_preferences WHERE wine_id='never-shared'").get()!.n).toBe(0);
 });
});
describe('sharing boundaries',()=>{
 it('skips malformed or failing newer producer research and preserves private corrections',async()=>{
  database.sql.exec("INSERT INTO friendships(user_id,friend_id) VALUES('alice','bob'),('alice','carol'),('alice','owner'); INSERT INTO producers(id,owner_id,canonical_name,match_key,home_country,profile,created_at,updated_at) VALUES('p','alice','Domaine Test','domaine test','France','My corrected producer profile','now','now')");
  const key=producerSubjectKey({canonical_name:'Domaine Test',home_country:'France'});
  const valid={profile:'A documented Burgundy producer.',winemakingPractices:'Practices vary by vintage; the cellar uses traditional barrels.',sources:[{title:'Producer',url:'https://example.com/producer'}],catalog:[]};
  for(const [user,data,date] of [['bob',JSON.stringify(valid),'2026-01-01'],['carol',JSON.stringify({profile:'Unknown',sources:[]}),'2026-02-01'],['owner','{broken','2026-03-01']])database.sql.prepare("INSERT INTO reusable_research(contributor_id,subject_key,scope,entry_json,quality_version,researched_at) VALUES(?,?,'producer_catalog',?,1,?)").run(user,key,data,date);
  expect(await reusableProducer(database.db,'alice','p')).toMatchObject({researchContributorId:'bob',profile:'My corrected producer profile',winemakingPractices:valid.winemakingPractices});
  database.sql.exec("DELETE FROM friendships WHERE user_id='alice' AND friend_id='bob'");
  expect(await reusableProducer(database.db,'alice','p')).toBeNull();
 });
 it('reuses original friend contributions without copying them or spreading to friends of friends',async()=>{
  database.sql.exec("INSERT INTO friendships(user_id,friend_id) VALUES('alice','bob'),('bob','alice'),('bob','carol'),('carol','bob')");
  const targets=buildResearchTargets({producer:'Domaine Test',country:'France',wineName:'Clos Test',wineStyle:'red',vintage:2020}),target=targets.find(t=>t.scope==='producer')!;
  const contribution={target,payload:{producerDetails:'A documented Burgundy producer.',producerWinemakingPractices:'Practices vary by vintage; the cellar uses traditional barrels.'},sources:[{title:'Producer',url:'https://example.com/producer'}],model:'test',researchedAt:stamp()};
  await publishResearch(database.db,'alice',contribution);
  const borrowed=await loadResearchCache(database.db,'bob',[target],true);expect(borrowed.get('producer')?.contributorId).toBe('alice');
  await upsertResearchCache(database.db,'bob',borrowed.get('producer')!);expect((await loadResearchCache(database.db,'carol',[target],true)).size).toBe(0);
  expect(database.sql.prepare("SELECT count(*) AS n FROM research_cache WHERE owner_id='bob'").get()!.n).toBe(0);
  database.sql.exec("DELETE FROM friendships WHERE user_id='bob' AND friend_id='alice'");expect((await loadResearchCache(database.db,'bob',[target],true)).size).toBe(0);
 });
 function wines(){database.sql.exec("INSERT INTO wines(id,owner_id,producer,wine_name,tasting_notes,price,venue,tags_json,created_at,updated_at) VALUES('w','alice','Dujac','Clos de la Roche','Lovely',999,'Private venue','[\"secret\"]','now','now'); INSERT INTO friendships(user_id,friend_id) VALUES('alice','bob'),('bob','alice'),('bob','carol'),('carol','bob')")}
 it('shares only with selected accepted friends and revokes after unfriending',async()=>{
  wines();const e={...env(),WINE_IMAGES:{} as R2Bucket};
  await socialRoute(new Request('https://wine.example/api/wines/w/shares',{method:'PUT',body:JSON.stringify({recipientIds:['bob']})}),e,member('alice'));
  const read=(user:string)=>socialRoute(new Request('https://wine.example/api/shared/wines/w'),e,member(user));
  const allowed=await (await read('bob'))!.json();expect(allowed).toMatchObject({tastingNotes:'',rating:null,tastingDate:null,price:null,venue:null});
  await expect(read('carol')).rejects.toMatchObject({status:404});
  await socialRoute(new Request('https://wine.example/api/friends/alice',{method:'DELETE'}),e,member('bob'));await expect(read('bob')).rejects.toMatchObject({status:404});
 });
 it('lets a tasting tag cover existing and future tasting wines without copying direct grants',async()=>{
  wines();
  database.sql.exec("INSERT INTO tastings(id,owner_id,name,created_at,updated_at) VALUES('t-share','alice','Friends tasting','now','now'); INSERT INTO wine_experiences(id,owner_id,wine_id,tasting_id,created_at,updated_at) VALUES('e-share','alice','w','t-share','now','now')");
  const e={...env(),WINE_IMAGES:{} as R2Bucket};
  await socialRoute(new Request('https://wine.example/api/tastings/t-share/shares',{method:'PUT',body:JSON.stringify({recipientIds:['bob']})}),e,member('alice'));
  expect(database.sql.prepare("SELECT count(*) AS n FROM wine_shares WHERE wine_id='w'").get()!.n).toBe(0);
  const allowed=await (await socialRoute(new Request('https://wine.example/api/shared/wines/w'),e,member('bob')))!.json();
  expect(allowed).toMatchObject({wineName:'Clos de la Roche',tastingNotes:'',rating:null,tastingDate:null,price:null});
  const feed=await (await socialRoute(new Request('https://wine.example/api/shared/wines'),e,member('bob')))!.json() as {items:Array<{id:string}>};
  expect(feed.items.map(item=>item.id)).toContain('w');
  const filler=database.sql.prepare("INSERT INTO wines(id,owner_id,producer,wine_name,created_at,updated_at) VALUES(?,'alice','P',?,'now','now')");
  for(let index=0;index<300;index++)filler.run(`unshared-${index}`,`Unshared ${index}`);
  const plan=database.sql.prepare(`EXPLAIN QUERY PLAN ${SHARED_WINES_LIST_SQL}`).all('bob','bob','bob',0,'bob');
  const planText=JSON.stringify(plan);
  expect(planText).toContain('MATERIALIZE page');
  expect(planText).not.toMatch(/SEARCH w USING (?:COVERING )?INDEX idx_wines_owner/);
  expect(planText).toMatch(/SEARCH w USING .*sqlite_autoindex_wines_1/);
  database.sql.exec("DELETE FROM wine_experiences WHERE id='e-share'");
  await expect(socialRoute(new Request('https://wine.example/api/shared/wines/w'),e,member('bob'))).rejects.toMatchObject({status:404});
 });
 it('stores a per-friend default and applies it to the next saved wine',async()=>{
  database.sql.exec("INSERT INTO friendships(user_id,friend_id) VALUES('alice','bob'),('bob','alice')");
  const e={...env(),WINE_IMAGES:{} as R2Bucket};
  await socialRoute(new Request('https://wine.example/api/friends/bob/default-share',{method:'PUT',body:JSON.stringify({enabled:true})}),e,member('alice'));
  const friends=await (await socialRoute(new Request('https://wine.example/api/friends'),e,member('alice')))!.json() as {items:Array<{id:string;defaultShare:boolean}>};
  expect(friends.items.find(item=>item.id==='bob')?.defaultShare).toBe(true);
  const id='default-shared-wine',input={producer:'Test',wineName:'Default share',grapes:[],grapeBlend:[],tags:[],tastingNotes:''} as unknown as WineInput;
  await database.db.batch([
   database.db.prepare("INSERT INTO wines(id,owner_id,producer,wine_name,created_at,updated_at) VALUES(?,?,?,?,?,?)").bind(id,'alice','Test','Default share','now','now'),
   ...wineSaveStatements(database.db,'alice',id,input)
  ]);
  expect(database.sql.prepare('SELECT recipient_id FROM wine_shares WHERE wine_id=?').get(id)?.recipient_id).toBe('bob');
 });
 it('writes a touched friend selection in the same wine batch instead of reapplying defaults',async()=>{
  database.sql.exec("INSERT INTO friendships(user_id,friend_id) VALUES('alice','bob'),('bob','alice'),('alice','carol'),('carol','alice'); INSERT INTO member_share_defaults(owner_id,recipient_id) VALUES('alice','bob')");
  const id='manual-share',input={producer:'Test',wineName:'Manual share',grapes:[],grapeBlend:[],tags:[],tastingNotes:'',shareRecipientIds:['carol']} as unknown as WineInput;
  await database.db.batch([
   database.db.prepare("INSERT INTO wines(id,owner_id,producer,wine_name,created_at,updated_at) VALUES(?,?,?,?,?,?)").bind(id,'alice','Test','Manual share','now','now'),
   ...wineSaveStatements(database.db,'alice',id,input)
  ]);
  const recipients=database.sql.prepare('SELECT recipient_id FROM wine_shares WHERE wine_id=? ORDER BY recipient_id').all(id).map(row=>row.recipient_id);
  expect(recipients).toEqual(['carol']);
 });
 it('bulk-tags more than 100 wines so Journal selections up to 500 do not fail',async()=>{
  database.sql.exec("INSERT INTO friendships(user_id,friend_id) VALUES('alice','bob'),('bob','alice')");
  const insert=database.sql.prepare("INSERT INTO wines(id,owner_id,producer,wine_name,created_at,updated_at) VALUES(?,'alice','P',?,'now','now')");
  const wineIds=Array.from({length:101},(_,index)=>`bulk-${index}`);for(const [index,id] of wineIds.entries())insert.run(id,`Wine ${index}`);
  const response=await socialRoute(new Request('https://wine.example/api/wines/shares',{method:'PUT',body:JSON.stringify({wineIds,recipientIds:['bob'],mode:'add'})}),{...env(),WINE_IMAGES:{} as R2Bucket},member('alice'));
  expect(response?.status).toBe(200);expect((await response!.json() as {count:number}).count).toBe(101);
  expect(database.sql.prepare("SELECT count(*) AS n FROM wine_shares WHERE owner_id='alice' AND recipient_id='bob'").get()!.n).toBe(101);
 });
 it('supports replacing friend tags in bulk without retaining the old recipient',async()=>{
  database.sql.exec("INSERT INTO friendships(user_id,friend_id) VALUES('alice','bob'),('bob','alice'),('alice','carol'),('carol','alice'); INSERT INTO wines(id,owner_id,producer,wine_name,created_at,updated_at) VALUES('set-wine','alice','P','Set wine','now','now'); INSERT INTO wine_shares(wine_id,owner_id,recipient_id) VALUES('set-wine','alice','bob')");
  const e={...env(),WINE_IMAGES:{} as R2Bucket};
  await socialRoute(new Request('https://wine.example/api/wines/shares',{method:'PUT',body:JSON.stringify({wineIds:['set-wine'],recipientIds:['carol'],mode:'set'})}),e,member('alice'));
  const recipients=database.sql.prepare("SELECT recipient_id FROM wine_shares WHERE wine_id='set-wine' ORDER BY recipient_id").all().map(row=>row.recipient_id);
  expect(recipients).toEqual(['carol']);
 });
 it('keeps sharing derivatives out of the next personal upload allowance check',async()=>{
  database.sql.prepare('UPDATE pilot_settings SET value_json=? WHERE id=1').run(JSON.stringify({...config,memberStorageBytes:5,totalStorageBytes:1000}));
  const bucket={put:vi.fn(async()=>({})),delete:vi.fn(async()=>undefined)} as unknown as R2Bucket;
  const personal=meteredBucket(bucket,database.db,'alice'),sharing=meteredBucket(bucket,database.db,'alice',{skipMemberLimit:true,countsTowardMemberLimit:false});
  await personal.put('owners/alice/original-a',new Uint8Array(4));await sharing.put('shared/alice/copy-a.jpg',new Uint8Array(4));
  await expect(personal.put('owners/alice/original-b',new Uint8Array(1))).resolves.toBeDefined();
  await expect(personal.put('owners/alice/original-c',new Uint8Array(1))).rejects.toMatchObject({status:413});
  expect(database.sql.prepare("SELECT byte_size,metered_byte_size FROM storage_totals WHERE owner_id='alice'").get()).toMatchObject({byte_size:9,metered_byte_size:5});
  expect(database.sql.prepare("SELECT counts_toward_member_limit FROM stored_objects WHERE object_key='shared/alice/copy-a.jpg'").get()!.counts_toward_member_limit).toBe(0);
 });
 it('treats zero storage caps as unlimited while continuing to account bytes',async()=>{
  database.sql.prepare('UPDATE pilot_settings SET value_json=? WHERE id=1').run(JSON.stringify({...config,memberStorageBytes:0,totalStorageBytes:0}));
  const bucket={put:vi.fn(async()=>({})),delete:vi.fn(async()=>undefined)} as unknown as R2Bucket;
  const personal=meteredBucket(bucket,database.db,'alice');
  await expect(personal.put('owners/alice/unlimited-a',new Uint8Array(12))).resolves.toBeDefined();
  await expect(personal.put('owners/alice/unlimited-b',new Uint8Array(18))).resolves.toBeDefined();
  expect(database.sql.prepare("SELECT byte_size,metered_byte_size FROM storage_totals WHERE owner_id='alice'").get()).toMatchObject({byte_size:30,metered_byte_size:30});
  expect(database.sql.prepare("SELECT byte_size FROM storage_totals WHERE owner_id='*'").get()!.byte_size).toBe(30);
 });
 it('lets the owner bypass a per-member storage cap without bypassing accounting',async()=>{
  database.sql.prepare('UPDATE pilot_settings SET value_json=? WHERE id=1').run(JSON.stringify({...config,memberStorageBytes:1,totalStorageBytes:100}));
  const bucket={put:vi.fn(async()=>({})),delete:vi.fn(async()=>undefined)} as unknown as R2Bucket;
  const ownerBucket=meteredBucket(bucket,database.db,'owner',{skipMemberLimit:true});
  await expect(ownerBucket.put('owners/owner/large',new Uint8Array(8))).resolves.toBeDefined();
  expect(database.sql.prepare("SELECT byte_size,metered_byte_size FROM storage_totals WHERE owner_id='owner'").get()).toMatchObject({byte_size:8,metered_byte_size:8});
  expect(database.sql.prepare("SELECT byte_size FROM storage_totals WHERE owner_id='*'").get()!.byte_size).toBe(8);
 });
 it('lists canonical wine photos for inherited tasting shares without creating sharing copies',async()=>{
  wines();
  database.sql.exec("INSERT INTO tastings(id,owner_id,name,created_at,updated_at) VALUES('t-photo','alice','Photo tasting','now','now'); INSERT INTO wine_experiences(id,owner_id,wine_id,tasting_id,created_at,updated_at) VALUES('e-photo','alice','w','t-photo','now','now'); INSERT INTO tasting_shares(tasting_id,owner_id,recipient_id) VALUES('t-photo','alice','bob'); INSERT INTO wine_images(id,owner_id,wine_id,object_key,content_type,byte_size,width,height,upload_status,recognition_status,created_at) VALUES('img-photo','alice','w','owners/alice/original.jpg','image/jpeg',8,10,10,'uploaded','complete','now')");
  const detail=await (await socialRoute(new Request('https://wine.example/api/shared/wines/w'),{...env(),WINE_IMAGES:{} as R2Bucket},member('bob')))!.json() as {photos:Array<{id:string}>};
  expect(detail.photos).toEqual([{id:'img-photo',url:'/api/shared/wines/w/photos/img-photo'}]);
  expect(database.sql.prepare("SELECT count(*) AS n FROM shared_photos").get()!.n).toBe(0);
  expect(database.sql.prepare("SELECT count(*) AS n FROM shared_photo_attempts").get()!.n).toBe(0);
 });

 it('serves the canonical permanent thumbnail to a friend without any shared R2 object',async()=>{
  wines();
  database.sql.exec("INSERT INTO wine_shares(wine_id,owner_id,recipient_id) VALUES('w','alice','bob'); INSERT INTO wine_images(id,owner_id,wine_id,object_key,content_type,byte_size,width,height,upload_status,recognition_status,created_at) VALUES('img-1','alice','w','owners/alice/1.jpg','image/jpeg',8,10,10,'uploaded','complete','now')");
  const thumbKey=thumbnailObjectKey('owners/alice/1.jpg');
  const get=vi.fn(async(key:string)=>key===thumbKey?{body:new Response('canonical-thumb').body!,httpMetadata:{contentType:'image/webp'}}:key==='owners/alice/1.jpg'?{body:new Response('original').body!,httpMetadata:{contentType:'image/jpeg'}}:null);
  const put=vi.fn(async()=>({}));
  const e={...env(),WINE_IMAGES:{get,put,delete:vi.fn()} as unknown as R2Bucket};
  const response=await socialRoute(new Request('https://wine.example/api/shared/wines/w/photos/img-1?variant=thumbnail'),e,member('bob'),{waitUntil:vi.fn()});
  expect(response?.status).toBe(200);
  expect(get).toHaveBeenCalledWith(thumbKey);
  expect(get.mock.calls.some(([key])=>String(key).startsWith('shared/'))).toBe(false);
  expect(put).not.toHaveBeenCalled();
  expect(database.sql.prepare("SELECT count(*) AS n FROM shared_photos").get()!.n).toBe(0);
 });

 it('serves the canonical original to a friend when full size is requested',async()=>{
  wines();
  database.sql.exec("INSERT INTO wine_shares(wine_id,owner_id,recipient_id) VALUES('w','alice','bob'); INSERT INTO wine_images(id,owner_id,wine_id,object_key,content_type,byte_size,width,height,upload_status,recognition_status,created_at) VALUES('img-original','alice','w','owners/alice/original.jpg','image/jpeg',8,10,10,'uploaded','complete','now')");
  const get=vi.fn(async(key:string)=>key==='owners/alice/original.jpg'?{body:new Response('original').body!,httpMetadata:{contentType:'image/jpeg'}}:null);
  const response=await socialRoute(new Request('https://wine.example/api/shared/wines/w/photos/img-original'),{...env(),WINE_IMAGES:{get,put:vi.fn(),delete:vi.fn()} as unknown as R2Bucket},member('bob'),{waitUntil:vi.fn()});
  expect(response?.status).toBe(200);
  expect(get).toHaveBeenCalledWith('owners/alice/original.jpg');
  expect(get.mock.calls.some(([key])=>String(key).startsWith('shared/'))).toBe(false);
 });

 it('refuses an image from another wine owned by the same friend',async()=>{
  wines();
  database.sql.exec("INSERT INTO wine_shares(wine_id,owner_id,recipient_id) VALUES('w','alice','bob'); INSERT INTO wines(id,owner_id,producer,wine_name,created_at,updated_at) VALUES('other','alice','P','Other','now','now'); INSERT INTO wine_images(id,owner_id,wine_id,object_key,content_type,byte_size,width,height,upload_status,recognition_status,created_at) VALUES('other-image','alice','other','owners/alice/other.jpg','image/jpeg',8,10,10,'uploaded','complete','now')");
  await expect(socialRoute(new Request('https://wine.example/api/shared/wines/w/photos/other-image'),{...env(),WINE_IMAGES:{} as R2Bucket},member('bob'))).rejects.toMatchObject({status:404});
 });

 it('refuses a shared photo to someone the wine was never shared with',async()=>{
  wines();
  database.sql.exec("INSERT INTO wine_images(id,owner_id,wine_id,object_key,content_type,byte_size,width,height,upload_status,recognition_status,created_at) VALUES('img-private','alice','w','owners/alice/private.jpg','image/jpeg',8,10,10,'uploaded','complete','now')");
  await expect(socialRoute(new Request('https://wine.example/api/shared/wines/w/photos/img-private'),{...env(),WINE_IMAGES:{} as R2Bucket},member('carol'))).rejects.toMatchObject({status:404});
 });

 it('invalidates recipient summaries when the canonical photo set changes',()=>{
  wines();
  database.sql.exec("INSERT INTO wine_shares(wine_id,owner_id,recipient_id) VALUES('w','alice','bob')");
  const before=Number(database.sql.prepare("SELECT revision FROM achievement_cache_state WHERE owner_id='bob'").get()?.revision??0);
  database.sql.exec("INSERT INTO wine_images(id,owner_id,wine_id,object_key,content_type,byte_size,width,height,upload_status,recognition_status,created_at) VALUES('img-rev','alice','w','owners/alice/rev.jpg','image/jpeg',8,10,10,'uploaded','complete','now')");
  const afterInsert=Number(database.sql.prepare("SELECT revision FROM achievement_cache_state WHERE owner_id='bob'").get()?.revision??0);
  expect(afterInsert).toBeGreaterThan(before);
  database.sql.exec("DELETE FROM wine_images WHERE id='img-rev'");
  const afterDelete=Number(database.sql.prepare("SELECT revision FROM achievement_cache_state WHERE owner_id='bob'").get()?.revision??0);
  expect(afterDelete).toBeGreaterThan(afterInsert);
 });
 it('has an explicit personal-field allowlist',()=>{expect(sharedWine({id:'w',price:10,venue:'x',latitude:1,tags_json:'["secret"]'})).not.toHaveProperty('tags')});
 it('distinguishes vintages, styles, editions and Unicode names',()=>{
  const target=(wineName:string,vintage:number|null=2020,wineStyle='red')=>buildResearchTargets({producer:'赤恋酒庄',wineName,country:'China',region:'Ningxia',vintage,wineStyle}).find(t=>t.scope==='wine_vintage')!;
  const key=sharedSubjectKey(target('山'));
  for(const t of [target('水'),target('山',2021),target('山',2020,'white'),target('山 Edition 1',null),target('山 Edition 2',null)])expect(sharedSubjectKey(t)).not.toBe(key);
  expect(sharedSubjectKey({...target('山'),identity:{...target('山').identity!,country:null}})).toBeNull();
  expect(sharedSubjectKey(target('山',null))).toBeNull();
  const red=buildResearchTargets({country:'France',region:'Burgundy',vintage:2021,wineStyle:'red'}).find(t=>t.scope==='vintage_context')!;
  expect(sharedSubjectKey(red)).not.toBe(sharedSubjectKey({...red,identity:{...red.identity!,wineStyle:'white'}}));
 });
});
describe('background durability and costs',()=>{
 it('keeps old delivery records until both delivery and credit operation are terminal',async()=>{
  const q=await quote(request(),env(),member('alice'));const {operation}=await reserve(request('{}',{'X-WineLog-Quote':q.id,'Idempotency-Key':'retention'}),env(),member('alice'));
  const queue={send:vi.fn()} as unknown as Queue<unknown>;
  await durableQueue(queue,database.db,operation.id).send({owner:'alice',kind:'wine'});
  database.sql.prepare("UPDATE credit_operations SET status='running' WHERE id=?").run(operation.id);
  database.sql.exec('UPDATE queue_outbox SET sent_at=1; INSERT INTO queue_deliveries(id,lease_until,done) SELECT id,1,1 FROM queue_outbox');
  await maintainJobs(database.db,queue);
  expect(database.sql.prepare('SELECT count(*) AS n FROM queue_outbox').get()!.n).toBe(1);
  expect(database.sql.prepare('SELECT count(*) AS n FROM queue_deliveries').get()!.n).toBe(1);
  await settle(database.db,operation,0);await maintainJobs(database.db,queue);
  expect(database.sql.prepare('SELECT count(*) AS n FROM queue_outbox').get()!.n).toBe(0);
  expect(database.sql.prepare('SELECT count(*) AS n FROM queue_deliveries').get()!.n).toBe(0);
 });
 it('replays a durably saved provider response without another provider call',async()=>{
  const q=await quote(request(),env(),member('alice'));const {operation}=await reserve(request('{}',{'X-WineLog-Quote':q.id,'Idempotency-Key':'provider'}),env(),member('alice'));
  const context={db:database.db,operationId:operation.id,namespace:'queue'},send=vi.fn(async()=>Response.json({result:'saved'}));
  await durableProvider(context,'unit',send);expect(await (await durableProvider(context,'unit',send)).json()).toEqual({result:'saved'});expect(send).toHaveBeenCalledTimes(1);
 });
 it('holds uncertain provider work across retries and reconciliation',async()=>{
  const q=await quote(request(),env(),member('alice'));const {operation}=await reserve(request('{}',{'X-WineLog-Quote':q.id,'Idempotency-Key':'crash'}),env(),member('alice'));
  const context={db:database.db,operationId:operation.id,namespace:'queue'},send=vi.fn(async()=>{throw new Error('Connection lost after submission')});
  await expect(durableProvider(context,'unit',send)).rejects.toThrow('Connection lost');await expect(durableProvider(context,'unit',send)).rejects.toThrow('reconciliation');
  await reconcileOperation(database.db,operation);expect(wallet()).toMatchObject({balance:10,reserved:5});expect(send).toHaveBeenCalledTimes(1);
  expect(database.sql.prepare('SELECT status FROM credit_operations WHERE id=?').get(operation.id)!.status).toBe('review');
 });
 it('retains a failed outbox send and retries it without losing its credit link',async()=>{
  const q=await quote(request(),env(),member('alice'));const {operation}=await reserve(request('{}',{'X-WineLog-Quote':q.id,'Idempotency-Key':'queue'}),env(),member('alice'));
  const send=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined),queue={send} as unknown as Queue<unknown>;
  await durableQueue(queue,database.db,operation.id).send({owner:'alice',kind:'wine'});await flushOutbox(database.db,queue);
  expect(database.sql.prepare('SELECT sent_at FROM queue_outbox').get()!.sent_at).toBeNull();database.sql.exec('UPDATE queue_outbox SET due_at=0');await flushOutbox(database.db,queue);expect(send).toHaveBeenCalledTimes(2);expect(send.mock.calls[1][0]._creditOperationId).toBe(operation.id);
 });
 it('applies the grounding allowance once across all members',async()=>{
  for(const owner of ['alice','bob'])database.sql.prepare('INSERT INTO ai_usage_monthly(owner_id,month,kind,model,tier,search_queries,updated_at) VALUES(?,?,?,?,?,?,?)').run(owner,new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7),'wine_research','test','standard',4000,stamp());
  const result=await deploymentAiCost(database.db,{AI_COST_GROUNDING_FREE_PER_MONTH:'5000',AI_COST_GROUNDING_USD_PER_1K:'10'});expect(result.searches).toBe(8000);expect(result.usd).toBe(30);
 });
});
describe('public Worker authorization',()=>{
 it('rejects foreign resource IDs throughout the nested handlers before any AI call',async()=>{
  database.sql.exec("INSERT INTO wines(id,owner_id,producer,wine_name,created_at,updated_at) VALUES('private-wine','alice','Private','Wine','now','now')");
  database.sql.prepare('INSERT INTO auth_sessions VALUES(?,?,?)').run(await hash('bob-session'),'bob',seconds()+3600);
  const provider=vi.fn(()=>{throw new Error('Unexpected provider call')});vi.stubGlobal('fetch',provider);
  const e={...env(),WINE_IMAGES:{},RESEARCH_QUEUE:{send:vi.fn()},ASSETS:{fetch:vi.fn(async()=>Response.json({error:"Not found"},{status:404}))}} as unknown as Parameters<typeof publicWorker.fetch>[1];
  const pending:Promise<unknown>[]=[],context={waitUntil:(p:Promise<unknown>)=>pending.push(p)} as unknown as ExecutionContext;
  for(const [method,path] of [['GET','/api/wines/private-wine'],['PATCH','/api/wines/private-wine'],['DELETE','/api/wines/private-wine'],['GET','/api/images/private-image'],['GET','/api/producers/private-producer'],['GET','/api/cuvees/private-cuvee'],['GET','/api/tastings/private-tasting'],['GET','/api/shared/wines/private-wine'],['GET','/api/admin/overview'],['POST','/api/credits/quotes?path=/api/wines/private-wine/deep-search']]){
   const response=await publicWorker.fetch(new Request(`https://wine.example${path}`,{method,headers:{Cookie:'__Host-winelog=bob-session',Origin:'https://wine.example','Content-Type':'application/json'},...method==='GET'?{}:{body:'{}'}}),e,context);
   expect(response.status,`${method} ${path}`).toBeGreaterThanOrEqual(400);expect(response.status,path).toBeLessThan(500);expect(await response.text()).not.toContain('Private');
  }
  await Promise.all(pending);expect(provider).not.toHaveBeenCalled();expect(database.sql.prepare("SELECT count(*) AS n FROM wines WHERE owner_id='alice'").get()!.n).toBe(1);
 });
});