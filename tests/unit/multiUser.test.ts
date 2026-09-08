import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { realD1 } from './support/realD1';
import { authenticate,authRoute,bindGoogleAccount,verifyOrigin } from '../../worker/multiUser/auth';
import { exportJWK,generateKeyPair,SignJWT } from 'jose';
import { hash,seconds,stamp,type Member,type PilotSettings } from '../../worker/multiUser/common';
import { quote,reserve,settle,reconcileOperation,creditRead } from '../../worker/multiUser/credits';
import { durableProvider } from '../../worker/multiUser/provider';
import publicWorker from '../../worker/multiUserEntry';
import { socialRoute,stripJpegMetadata,sharedWine } from '../../worker/multiUser/social';
import { sharedSubjectKey,publishResearch } from '../../src/lib/research/shared';
import { producerSubjectKey,reusableProducer } from '../../src/lib/research/sharedProducer';
import { buildResearchTargets,loadResearchCache,upsertResearchCache } from '../../src/lib/research/cache';
import { startWineBatchResearch } from '../../src/lib/research/batchWineResearch';
import { deploymentAiCost } from '../../worker/multiUser/admin';
import { flushOutbox,durableQueue,maintainJobs } from '../../worker/multiUser/jobs';

let database:ReturnType<typeof realD1>;
const member=(id:string):Member=>({id,email:`${id}@example.com`,display_name:id,role:id==='owner'?'owner':'member',status:'active'});
const config:PilotSettings={memberLimit:25,memberStorageBytes:100_000_000,totalStorageBytes:8_000_000_000,aiConcurrency:4,aiDailyOperations:100,aiMonthlyBudgetUsd:100,aiUnitBudgetUsd:1,cloudflareWarningUsd:5,cloudflareStopUsd:10,cloudflareObservedUsd:0,cloudflareObservedMonth:stamp().slice(0,7),allowOverages:true};
const request=(body='{}',extra:Record<string,string>={})=>new Request('https://wine.example/api/recognition',{method:'POST',headers:{'Content-Type':'multipart/form-data; boundary=scan',Origin:'https://wine.example',...extra},body:`--scan\r\nContent-Disposition: form-data; name="images"; filename="label.jpg"\r\nContent-Type: image/jpeg\r\n\r\n${body}\r\n--scan--\r\n`});
beforeEach(()=>{
 database=realD1();
 for(const id of ['owner','alice','bob','carol']){const u=member(id);database.sql.prepare('INSERT INTO app_users(id,email,display_name,role) VALUES(?,?,?,?)').run(u.id,u.email,u.display_name,u.role);database.sql.prepare('INSERT INTO credit_wallets(user_id) VALUES(?)').run(id)}
 database.sql.prepare('INSERT INTO pilot_settings(id,value_json) VALUES(1,?)').run(JSON.stringify(config));
 database.sql.prepare('INSERT INTO credit_prices(id,action,credits,created_at,created_by) VALUES(?,?,?,?,?)').run('price1','scan_single',5,stamp(),'owner');
 database.sql.exec("INSERT INTO credit_ledger(id,user_id,kind,amount,actor_id,reason) VALUES('g1','alice','grant',10,'owner','trial')");
});
afterEach(()=>{database.close();vi.restoreAllMocks();vi.unstubAllGlobals()});
const env=()=>({DB:database.db,AUTH_SECRET:'a'.repeat(48),APP_URL:'https://wine.example',OWNER_GOOGLE_SUB:'explicit-owner-sub'});
const wallet=()=>database.sql.prepare("SELECT balance,reserved FROM credit_wallets WHERE user_id='alice'").get();
describe('account boundary',()=>{
 it('binds only the configured Google subject while preserving legacy owner data',async()=>{
  database.close();database=realD1();
  database.sql.exec("DELETE FROM credit_wallets WHERE user_id='owner'; DELETE FROM app_users WHERE id='owner'; INSERT INTO wines(id,owner_id,producer,wine_name,created_at,updated_at) VALUES('legacy','owner','Legacy','Bottle','now','now')");
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
 it('disables unpriced AI routes',async()=>{await expect(quote(request('{}',{'X-WineLog-Recognition-Mode':'group'}),env(),member('alice'))).rejects.toMatchObject({status:503})});
 it('includes outstanding work in the provider budget',async()=>{
  const q=await quote(request(),env(),member('alice'));await expect(reserve(request('{}',{'X-WineLog-Quote':q.id,'Idempotency-Key':'budget'}),env(),member('alice'),100)).rejects.toMatchObject({status:409});
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
  const allowed=await (await read('bob'))!.json();expect(allowed).toMatchObject({tastingNotes:'Lovely'});expect(allowed).not.toHaveProperty('price');expect(allowed).not.toHaveProperty('venue');
  await expect(read('carol')).rejects.toMatchObject({status:404});
  await socialRoute(new Request('https://wine.example/api/friends/alice',{method:'DELETE'}),e,member('bob'));await expect(read('bob')).rejects.toMatchObject({status:404});
 });
 it('has an explicit personal-field allowlist',()=>{expect(sharedWine({id:'w',price:10,venue:'x',latitude:1,tags_json:'["secret"]'})).not.toHaveProperty('tags')});
 it('removes JPEG application metadata and rejects non-JPEG inputs',()=>{
  const jpeg=Uint8Array.from([255,216,255,225,0,5,71,80,83,255,218,0,2,255,217]);expect([...stripJpegMetadata(jpeg)]).toEqual([255,216,255,218,0,2,255,217]);expect(()=>stripJpegMetadata(new Uint8Array([1,2,3]))).toThrow('JPEG');
 });
 it('distinguishes vintages, styles, editions and Unicode names',()=>{
  const target=(wineName:string,vintage:number|null=2020,wineStyle='red')=>buildResearchTargets({producer:'赤恋酒庄',wineName,country:'China',region:'Ningxia',vintage,wineStyle}).find(t=>t.scope==='wine_vintage')!;
  const key=sharedSubjectKey(target('山'));
  for(const t of [target('水'),target('山',2021),target('山',2020,'white'),target('山 Edition 1',null),target('山 Edition 2',null)])expect(sharedSubjectKey(t)).not.toBe(key);
  expect(sharedSubjectKey({...target('山'),subject:{...target('山').subject,country:null}})).toBeNull();
  expect(sharedSubjectKey(target('山',null))).toBeNull();
  const red=buildResearchTargets({country:'France',region:'Burgundy',vintage:2021,wineStyle:'red'}).find(t=>t.scope==='vintage_context')!;
  expect(sharedSubjectKey(red)).not.toBe(sharedSubjectKey({...red,subject:{...red.subject,wineStyle:'white'}}));
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
