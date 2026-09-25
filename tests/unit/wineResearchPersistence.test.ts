import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {realD1} from './support/realD1';
import {quote,reserve,reconcileOperation,saveOperationResponse,settle,type CreditOperation} from '../../worker/multiUser/credits';
import {memberAiActionAccess,reserveMemberAiAllowance} from '../../worker/multiUser/memberAccess';
import {createWineResearchRun,getWineResearchRun,updateWineResearchRun} from '../../src/lib/research/backgroundJobs';
import {startWineBatchResearch,pollWineBatchResearch} from '../../src/lib/research/batchWineResearch';
import {configureGeminiBatchGateway,clearGeminiBatchGateway,createGeminiBatch,fetchGeminiBatch} from '../../src/lib/research/geminiBatch';
import {buildResearchTargets,loadResearchCache,splitDeepSearchResult,upsertResearchCache} from '../../src/lib/research/cache';
import worker from '../../worker/multiUserEntry';
import {hash,seconds} from '../../worker/multiUser/common';
import {claimDelivery,finishDelivery,flushOutbox,maintainJobs} from '../../worker/multiUser/jobs';
import {durableProvider} from '../../src/lib/credits/provider';

let database:ReturnType<typeof realD1>;
const requestId='11155b35-cb71-48b4-aaca-40d8f52bd9e0';
const owner='alice',wineId='krug';
const member={id:owner,role:'member' as const,email:'alice@example.com',display_name:'Alice',status:'active' as const};
const wine={producer:'Krug',wineName:'Grande Cuvée 173ème Édition',country:'France',region:'Champagne',wineStyle:'sparkling'};
const answer={
 summary:'Krug Grande Cuvée is a multi-vintage Champagne assembled to express the house style.',
 expectedProfile:'The wine has citrus aromas, a rich texture and a persistent finish.',
 producerDetails:'Krug is a Champagne house based in Reims.',
 producerWinemakingPractices:'The house evaluates individual wines before assembling its blends.',
 terroir:'Champagne vineyards grow on chalk-rich soils in a cool climate.',
 vintageQuality:'Not applicable to this multi-vintage wine.',
 winemakingTechniques:'Exact release techniques could not be verified from public sources.',
 drinkingWindow:'The wine is ready to drink, with development depending on storage.'
};
const payload=()=>({candidates:[{content:{parts:[{text:JSON.stringify(answer)}]},finishReason:'STOP',
 groundingMetadata:{groundingChunks:[{web:{title:'Krug',uri:'https://www.krug.com/'}}],webSearchQueries:['Krug Grande Cuvée']}}],
 usageMetadata:{promptTokenCount:100,candidatesTokenCount:200}});
const env=()=>({DB:database.db,CF_AI_GATEWAY_TOKEN:'test',AI_GATEWAY_ACCOUNT_ID:'test',AI_GATEWAY_ID:'test',VERTEX_PROJECT_ID:'test',VERTEX_REGION:'global'});

beforeEach(()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-25T04:00:00.000Z'));
 database=realD1();
 database.sql.exec("INSERT INTO app_users(id,email,display_name,role) VALUES('alice','alice@example.com','Alice','member'); INSERT INTO credit_wallets(user_id) VALUES('alice'); INSERT INTO wines(id,owner_id,producer,wine_name,country,region,wine_style,created_at,updated_at) VALUES('krug','alice','Krug','Grande Cuvée 173ème Édition','France','Champagne','sparkling','now','now')");
 configureGeminiBatchGateway(undefined,env());
 vi.spyOn(console,'log').mockImplementation(()=>{});vi.spyOn(console,'warn').mockImplementation(()=>{});
});
afterEach(()=>{clearGeminiBatchGateway(undefined);vi.unstubAllGlobals();vi.restoreAllMocks();vi.useRealTimers();database.close()});

async function setup(refresh:'none'|'vintage'|'all'='none'){
 const request=()=>new Request(`https://wine.example/api/wines/${wineId}/deep-search`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmation:'RUN_DEEP_SEARCH',refresh,requestId})});
 const q=await quote(request(),env(),member),req=request();req.headers.set('X-WineLog-Quote',q.id);req.headers.set('Idempotency-Key',requestId);
 const {operation}=await reserve(req,env(),member);
 expect((await reserveMemberAiAllowance(database.db,owner,operation.id,'wine_deep_search')).allowed).toBe(true);
 await createWineResearchRun(database.db,owner,wineId,refresh,requestId);
 database.sql.prepare("UPDATE credit_operations SET status='running',run_id=? WHERE id=?").run(requestId,operation.id);
 const send=vi.fn(),researchEnv={...env(),CREDIT_CONTEXT:{db:database.db,operationId:operation.id,namespace:'queue'},CREDIT_RESEARCH_SCOPES:['producer','terroir','wine_vintage'],RESEARCH_QUEUE:{send} as unknown as Queue<unknown>};
 expect(await startWineBatchResearch(researchEnv,owner,wineId,requestId,refresh)).toMatchObject({ok:true});
 const job=send.mock.calls[0][0] as {jobId:string};
 const provider=vi.fn<(url?:unknown,init?:RequestInit)=>Promise<Response>>(async()=>Response.json(payload()));vi.stubGlobal('fetch',provider);
 const poll=(pollCount=0)=>pollWineBatchResearch(researchEnv,owner,wineId,requestId,job.jobId,pollCount);
 return {operation,send,job,provider,poll,researchEnv};
}

async function assertComplete(operation:CreditOperation){
 expect(await getWineResearchRun(database.db,owner,wineId,requestId)).toMatchObject({status:'complete',stage:'complete',attempt:1});
 expect((await loadResearchCache(database.db,owner,buildResearchTargets(wine))).size).toBe(3);
 expect(database.sql.prepare('SELECT deep_search_json FROM wines WHERE id=?').get(wineId)!.deep_search_json).toEqual(expect.any(String));
 expect(database.sql.prepare("SELECT count(*) AS n FROM research_batch_jobs").get()!.n).toBe(1);
 const current=await database.db.prepare('SELECT * FROM credit_operations WHERE id=?').bind(operation.id).first<CreditOperation>();
 await reconcileOperation(database.db,current!);
 expect(await memberAiActionAccess(database.db,owner,'wine_deep_search')).toMatchObject({used:1,pending:0,remaining:1});
}

async function httpFlow(beforeStart?:()=>void,expectedStatus=202){
 await database.db.prepare('INSERT INTO auth_sessions VALUES(?,?,?)').bind(await hash('session'),owner,seconds()+7*86400).run();
 const delivered:Array<Record<string,unknown>>=[];
 const send=vi.fn(async(job:Record<string,unknown>)=>{delivered.push(job)});
 const workerEnv={...env(),AUTH_SECRET:'a'.repeat(48),APP_URL:'https://wine.example',OWNER_GOOGLE_SUB:'owner',WINE_IMAGES:{},RESEARCH_QUEUE:{send},ASSETS:{fetch:vi.fn()}} as unknown as Parameters<typeof worker.fetch>[1];
 const background:Promise<unknown>[]=[];
 const ctx={waitUntil:(promise:Promise<unknown>)=>{background.push(promise)}} as ExecutionContext;
 const body=JSON.stringify({confirmation:'RUN_DEEP_SEARCH',refresh:'none',requestId});
 const headers={Cookie:'__Host-winelog=session',Origin:'https://wine.example','Content-Type':'application/json'};
 const quoted=await worker.fetch(new Request(`https://wine.example/api/credits/quotes?path=/api/wines/${wineId}/deep-search`,{method:'POST',headers,body}),workerEnv,ctx);
 expect(quoted.status).toBe(200);
 const q=await quoted.json() as {id:string};
 const start=(key=requestId)=>worker.fetch(new Request(`https://wine.example/api/wines/${wineId}/deep-search`,{method:'POST',headers:{...headers,'X-WineLog-Quote':q.id,'Idempotency-Key':key},body}),workerEnv,ctx);
 const requote=()=>worker.fetch(new Request(`https://wine.example/api/credits/quotes?path=/api/wines/${wineId}/deep-search`,{method:'POST',headers,body}),workerEnv,ctx);
 const retry=async()=>{
  const requestId=crypto.randomUUID(),body=JSON.stringify({confirmation:'RUN_DEEP_SEARCH',refresh:'none',requestId});
  const quoted=await worker.fetch(new Request(`https://wine.example/api/credits/quotes?path=/api/wines/${wineId}/deep-search`,{method:'POST',headers,body}),workerEnv,ctx);
  expect(quoted.status).toBe(200);const q=await quoted.json() as {id:string};
  const response=await worker.fetch(new Request(`https://wine.example/api/wines/${wineId}/deep-search`,{method:'POST',headers:{...headers,'X-WineLog-Quote':q.id,'Idempotency-Key':requestId},body}),workerEnv,ctx);
  await Promise.all(background.splice(0));return response;
 };
 beforeStart?.();
 const response=await start();expect(response.status).toBe(expectedStatus);
 const accepted=await response.json() as {researchRequestId:string;creditOperationId:string};
 await Promise.all(background.splice(0));
 const provider=vi.fn<(url?:unknown,init?:RequestInit)=>Promise<Response>>(async()=>Response.json(payload()));vi.stubGlobal('fetch',provider);
 const request=(suffix:string,method='GET',data?:unknown,overrides:Record<string,string>={})=>worker.fetch(new Request(`https://wine.example/api/wines/${wineId}/${suffix}`,{method,headers:{...headers,...overrides},...data?{body:JSON.stringify(data)}:{}}),workerEnv,ctx);
 const status=async(check=false)=>{
  const response=await request(`deep-search-status?requestId=${accepted.researchRequestId??accepted.creditOperationId}`,check?'POST':'GET');
  expect(response.status).toBe(200);return response.json();
 };
 const stop=()=>request('deep-search-cancel','POST',{confirmation:'STOP_WAITING_DEEP_SEARCH',requestId:accepted.researchRequestId??accepted.creditOperationId});
 const consume=async(job=delivered.shift()!,attempts=1)=>{
  expect(job).toBeDefined();const ack=vi.fn(),retry=vi.fn();
  await worker.queue({messages:[{id:crypto.randomUUID(),body:job,attempts,ack,retry}]} as never,workerEnv);
  return {ack,retry,job};
 };
 return {start,requote,retry,accepted,provider,status,stop,request,consume,delivered,workerEnv,background};
}

describe('member Deep Search through HTTP and the queue',()=>{
 it.each([false,true])('keeps a friend follower waiting past 15 minutes until sponsor settlement (success: %s)',async success=>{
  database.sql.exec("UPDATE wines SET vintage=2020; INSERT INTO app_users(id,email,display_name,role) VALUES('bob','bob@example.com','Bob','member'); INSERT INTO credit_wallets(user_id) VALUES('bob'); INSERT INTO friendships(user_id,friend_id) VALUES('alice','bob'),('bob','alice'); INSERT INTO wines(id,owner_id,producer,wine_name,vintage,country,region,wine_style,created_at,updated_at) SELECT 'bob-wine','bob',producer,wine_name,vintage,country,region,wine_style,created_at,updated_at FROM wines WHERE id='krug'");
  const request=()=>new Request('https://wine.example/api/wines/bob-wine/deep-search',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),bob={...member,id:'bob'};
  const q=await quote(request(),env(),bob),req=request();req.headers.set('X-WineLog-Quote',q.id);req.headers.set('Idempotency-Key','sponsor');const sponsor=await reserve(req,env(),bob);
  await createWineResearchRun(database.db,'bob','bob-wine','none',crypto.randomUUID(),sponsor.operation.id);
  const flow=await httpFlow();
  expect(await flow.status()).toMatchObject({status:'running',waitingForFriend:true,creditOperationId:flow.accepted.creditOperationId});
  vi.setSystemTime(Date.now()+16*60_000);await maintainJobs(database.db,flow.workerEnv.RESEARCH_QUEUE);
  expect(await flow.status()).toMatchObject({status:'running',waitingForFriend:true});
  await settle(database.db,sponsor.operation,0,undefined,success);await maintainJobs(database.db,flow.workerEnv.RESEARCH_QUEUE);
  expect(await flow.status()).toMatchObject({status:success?'complete':'failed',retryBlocked:false});expect(flow.provider).not.toHaveBeenCalled();
 });
 it('does not let an expired delivery release its successor lease',async()=>{
  const first=await claimDelivery(database.db,'lease');vi.setSystemTime(Date.now()+601_000);
  await claimDelivery(database.db,'lease');
  const successor=database.sql.prepare('SELECT * FROM queue_deliveries').get();
  await finishDelivery(database.db,'lease',true,first);
  expect(database.sql.prepare('SELECT * FROM queue_deliveries').get()).toEqual(successor);
 });

 it('retries adoption persistence before reporting a free friend cache completion',async()=>{
  const flow=await httpFlow();
  database.sql.exec("INSERT INTO app_users(id,email,display_name,role) VALUES('bob','bob@example.com','Bob','member'); INSERT INTO friendships(user_id,friend_id) VALUES('alice','bob'),('bob','alice')");
  for(const entry of splitDeepSearchResult({...answer,sources:[{title:'Krug',url:'https://www.krug.com/'}],model:'fixture',researchedAt:new Date().toISOString()},buildResearchTargets(wine)))await upsertResearchCache(database.db,entry.target.scope==='wine_vintage'?owner:'bob',entry);
  expect((await loadResearchCache(database.db,owner,buildResearchTargets(wine),true)).size).toBe(3);
  database.sql.exec("CREATE TEMP TRIGGER injected_failure BEFORE INSERT ON research_cache WHEN new.owner_id='alice' BEGIN SELECT RAISE(ABORT,'injected adoption failure'); END");
  const delivery=await flow.consume();expect(delivery.retry).toHaveBeenCalledOnce();expect(delivery.ack).not.toHaveBeenCalled();
  database.sql.exec('DROP TRIGGER injected_failure');await flow.consume(delivery.job,2);
  expect(await flow.status()).toMatchObject({status:'complete',attempt:0});
  database.sql.exec('DELETE FROM friendships');
  expect((await loadResearchCache(database.db,owner,buildResearchTargets(wine))).size).toBe(3);
  expect(await memberAiActionAccess(database.db,owner,'wine_deep_search')).toMatchObject({used:0,pending:0});expect(flow.provider).not.toHaveBeenCalled();
 });

 it('recovers saved work after the physical queue exhausts retries',async()=>{
  const flow=await httpFlow();await flow.consume();
  database.sql.exec("CREATE TEMP TRIGGER injected_failure BEFORE UPDATE OF deep_search_json ON wines BEGIN SELECT RAISE(ABORT,'injected snapshot failure'); END");
  const delivery=await flow.consume(undefined,3);expect(delivery.retry).toHaveBeenCalledOnce();
  database.sql.exec('DROP TRIGGER injected_failure');vi.setSystemTime(Date.now()+25*3600_000);
  await maintainJobs(database.db,flow.workerEnv.RESEARCH_QUEUE);await flow.consume();
  expect(await getWineResearchRun(database.db,owner,wineId,requestId)).toMatchObject({status:'complete'});expect(flow.provider).toHaveBeenCalledOnce();
 });

 it('isolates emulated batches by operation even when clients choose the same request ID',async()=>{
  const entries=[{key:'wine-research',request:{contents:[]}}];
  const first=await createGeminiBatch(undefined,'model','same-display-name',entries,{db:database.db,operationId:'one',namespace:'queue'});
  const second=await createGeminiBatch(undefined,'model','same-display-name',entries,{db:database.db,operationId:'two',namespace:'queue'});
  expect(second).not.toBe(first);
 });

 it('deduplicates concurrent batch creation within the same operation',async()=>{
  const context={db:database.db,operationId:'one',namespace:'queue'},entries=[{key:'wine-research',request:{contents:[]}}];
  const names=await Promise.all([createGeminiBatch(undefined,'model','same-display-name',entries,context),createGeminiBatch(undefined,'model','same-display-name',entries,context)]);
  expect(names[0]).toBe(names[1]);
 });

 it('deduplicates exempt batches across concurrent creation and setup recovery',async()=>{
  const context={exempt:true as const,reason:'owner'},entries=[{key:'wine-research',request:{contents:[]}}];
  const names=await Promise.all([createGeminiBatch(undefined,'model','exempt-attempt',entries,context),createGeminiBatch(undefined,'model','exempt-attempt',entries,context)]);
  const provider=vi.fn(async()=>Response.json(payload()));vi.stubGlobal('fetch',provider);
  await fetchGeminiBatch(undefined,names[0],{},context);
  const recovered=await createGeminiBatch(undefined,'model','exempt-attempt',entries,context);
  await fetchGeminiBatch(undefined,recovered,{},context);
  expect(names[1]).toBe(names[0]);expect(recovered).toBe(names[0]);expect(provider).toHaveBeenCalledOnce();
 });

 it('reuses a legacy UUID batch when exempt setup is retried after an upgrade',async()=>{
  const entries=[{key:'wine-research',request:{contents:[]}}];
  const legacy=await createGeminiBatch(undefined,'model','legacy-exempt-attempt',entries);
  const recovered=await createGeminiBatch(undefined,'model','legacy-exempt-attempt',entries,{exempt:true,reason:'owner'});
  expect(recovered).toBe(legacy);
  expect(database.sql.prepare('SELECT count(*) AS n FROM vertex_batch_emulation_jobs').get()!.n).toBe(1);
 });

 it('fences an old lease reader from resetting a newly claimed emulation executor',async()=>{
  const {operation,provider}=await setup();
  const row=database.sql.prepare('SELECT id FROM vertex_batch_emulation_jobs').get()!;
  database.sql.prepare("UPDATE vertex_batch_emulation_jobs SET state='JOB_STATE_RUNNING',updated_at=?").run(new Date(Date.now()-14*60_000).toISOString());
  let releaseRead!:()=>void,readReached!:()=>void,reply!: (response:Response)=>void,sendReached!:()=>void;
  const heldRead=new Promise<void>(resolve=>{releaseRead=resolve}),readStarted=new Promise<void>(resolve=>{readReached=resolve});
  const sent=new Promise<void>(resolve=>{sendReached=resolve});
  provider.mockImplementation(()=>{sendReached();return new Promise<Response>(resolve=>{reply=resolve})});
  let intercept=true;
  const original=database.db.prepare.bind(database.db);
  vi.spyOn(database.db,'prepare').mockImplementation(sql=>{
   const statement=original(sql),bind=statement.bind.bind(statement);
   if(sql.startsWith('SELECT id,model,display_name'))statement.bind=(...args:unknown[])=>{
    const bound=bind(...args),first=bound.first.bind(bound);
    bound.first=async(...firstArgs:Parameters<typeof first>)=>{const value=await first(...firstArgs);if(intercept){intercept=false;readReached();await heldRead}return value};return bound;
   };
   return statement;
  });
  const context={db:database.db,operationId:operation.id,namespace:'queue'},name=`vertex-batches/${row.id}`;
  const stale=fetchGeminiBatch(undefined,name,{},context);await readStarted;
  const current=fetchGeminiBatch(undefined,name,{},context);await sent;
  releaseRead();await stale;
  const state=database.sql.prepare('SELECT state FROM vertex_batch_emulation_jobs').get()!.state;
  reply(Response.json(payload()));await current;
  expect(state).toBe('JOB_STATE_RUNNING');expect(provider).toHaveBeenCalledOnce();
 });

 it('converges concurrent different-key submissions onto one operation',async()=>{
  const request=()=>new Request(`https://wine.example/api/wines/${wineId}/deep-search`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmation:'RUN_DEEP_SEARCH',refresh:'none',requestId})});
  const quotes=await Promise.all([quote(request(),env(),member),quote(request(),env(),member)]);
  const results=await Promise.all(quotes.map((q,index)=>{const req=request();req.headers.set('X-WineLog-Quote',q.id);req.headers.set('Idempotency-Key',`concurrent-${index}`);return reserve(req,env(),member)}));
  expect(results[0].operation.id).toBe(results[1].operation.id);
  expect(database.sql.prepare('SELECT count(*) AS n FROM credit_operations').get()!.n).toBe(1);
 });

 it('lets a member rediscover their running request when its pending slot exhausts allowance',async()=>{
  database.sql.exec("UPDATE member_ai_action_policies SET weekly_limit=1 WHERE action='wine_deep_search'");
  const flow=await httpFlow();expect(await memberAiActionAccess(database.db,owner,'wine_deep_search')).toMatchObject({remaining:0});
  expect((await flow.requote()).status).toBe(200);
  expect(await (await flow.start('another-key')).json()).toMatchObject({creditOperationId:flow.accepted.creditOperationId,researchRequestId:requestId});
 });

 it('deduplicates a completed logical request even when a browser supplies a fresh HTTP key',async()=>{
  const flow=await httpFlow();await flow.consume();await flow.consume();
  const response=await flow.start('fresh-http-key');expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({creditOperationId:flow.accepted.creditOperationId,status:'complete'});
  expect(database.sql.prepare('SELECT count(*) AS n FROM credit_operations').get()!.n).toBe(1);
  expect(flow.provider).toHaveBeenCalledOnce();
 });
 it('retries initial batch setup persistence without cancelling or buying a fallback',async()=>{
  const flow=await httpFlow();
  database.sql.exec("CREATE TEMP TRIGGER injected_failure BEFORE INSERT ON research_batch_jobs WHEN new.attempt=1 BEGIN SELECT RAISE(ABORT,'injected setup failure'); END");
  const delivery=await flow.consume();expect(delivery.retry).toHaveBeenCalledOnce();expect(delivery.ack).not.toHaveBeenCalled();
  expect(flow.provider).not.toHaveBeenCalled();
  expect(database.sql.prepare('SELECT count(*) AS n FROM research_batch_jobs').get()!.n).toBe(0);
  database.sql.exec('DROP TRIGGER injected_failure');await flow.consume(delivery.job,2);await flow.consume();
  expect(await flow.status()).toMatchObject({status:'complete',attempt:1});expect(flow.provider).toHaveBeenCalledOnce();
 });

 it.each([
  ['batch row',"BEFORE INSERT ON research_batch_jobs WHEN new.attempt=2"],
  ['poll outbox',"BEFORE INSERT ON queue_outbox WHEN json_extract(new.body_json,'$.kind')='wine_batch_poll' AND (SELECT attempt FROM research_batch_jobs WHERE id=json_extract(new.body_json,'$.jobId'))=2"]
 ])('recovers the failed-attempt transition when saving its fallback %s fails',async(_boundary,trigger)=>{
  const flow=await httpFlow();await flow.consume();flow.provider.mockResolvedValueOnce(new Response('definite rejection',{status:400}));
  database.sql.exec(`CREATE TEMP TRIGGER injected_failure ${trigger} BEGIN SELECT RAISE(ABORT,'injected fallback failure'); END`);
  const delivery=await flow.consume();expect(delivery.retry).toHaveBeenCalledOnce();expect(delivery.ack).not.toHaveBeenCalled();
  expect(await flow.status()).toMatchObject({status:'running'});
  database.sql.exec('DROP TRIGGER injected_failure');await flow.consume(delivery.job,2);await flow.consume();
  expect(await flow.status()).toMatchObject({status:'complete',attempt:2});
  expect(flow.provider).toHaveBeenCalledTimes(2);
  expect(await memberAiActionAccess(database.db,owner,'wine_deep_search')).toMatchObject({used:1,pending:0});
 });
 it('ends an unresolved transport outcome at the recovery horizon, retaining uncertainty diagnostics',async()=>{
  const flow=await httpFlow();flow.provider.mockRejectedValue(new Error('connection lost after provider submission'));
  await flow.consume();await flow.consume();
  expect(database.sql.prepare('SELECT status FROM credit_operations').get()!.status).toBe('review');
  expect(await memberAiActionAccess(database.db,owner,'wine_deep_search')).toMatchObject({used:0,pending:1});
  vi.setSystemTime(Date.now()+49*3600_000);
  await maintainJobs(database.db,flow.workerEnv.RESEARCH_QUEUE);await maintainJobs(database.db,flow.workerEnv.RESEARCH_QUEUE);
  const operation=database.sql.prepare('SELECT status,response_json FROM credit_operations').get()!;
  expect(operation.status).toBe('failed');expect(JSON.parse(String(operation.response_json))).toMatchObject({outcome:'uncertain',supportId:requestId});
  expect(await memberAiActionAccess(database.db,owner,'wine_deep_search')).toMatchObject({used:0,pending:0});
  expect(database.sql.prepare('SELECT state FROM provider_operations').get()!.state).toBe('uncertain');
  expect(database.sql.prepare('SELECT message FROM wine_research_runs').get()!.message).toContain('connection lost');
  expect(flow.provider).toHaveBeenCalledOnce();
 });

 it.each(['maintenance','check'])('recovers a late durably saved reply via %s without a second provider send',async source=>{
  const flow=await httpFlow();await flow.consume();
  let reply!:(response:Response)=>void;
  let markStarted!:()=>void;const started=new Promise<void>(resolve=>{markStarted=resolve});
  flow.provider.mockImplementation(()=>new Promise<Response>(resolve=>{reply=resolve;markStarted()}));
  const pending=flow.consume();await started;await vi.advanceTimersByTimeAsync(600_001);await pending;
  expect(database.sql.prepare('SELECT status FROM credit_operations').get()!.status).toBe('review');
  reply(Response.json(payload()));
  for(let i=0;i<100&&database.sql.prepare('SELECT state FROM provider_operations').get()!.state!=='saved';i++)await Promise.resolve();
  expect(database.sql.prepare('SELECT state FROM provider_operations').get()!.state).toBe('saved');
  if(source==='check'){
   expect(await flow.status(true)).toMatchObject({status:'running',stage:'saving',retryBlocked:false});
   await flow.status(true);
  }else await maintainJobs(database.db,flow.workerEnv.RESEARCH_QUEUE);
  expect(flow.delivered).toHaveLength(1);
  await flow.consume();
  expect(await flow.status()).toMatchObject({status:'complete'});
  expect(await memberAiActionAccess(database.db,owner,'wine_deep_search')).toMatchObject({used:1,pending:0});
  expect(flow.provider).toHaveBeenCalledOnce();
 });

 it('explicit status checks preserve a recent hold and settle an expired one without sending AI',async()=>{
  const flow=await httpFlow();flow.provider.mockRejectedValue(new Error('connection lost after provider submission'));
  await flow.consume();await flow.consume();
  const held={status:'failed',retryBlocked:true,recoveryDeadline:'2026-09-27T04:00:00.000Z'};
  expect(await flow.status()).toMatchObject(held);expect(await flow.status(true)).toMatchObject(held);
  expect(await memberAiActionAccess(database.db,owner,'wine_deep_search')).toMatchObject({used:0,pending:1});
  vi.setSystemTime(Date.now()+49*3600_000);
  expect(await flow.status()).toMatchObject(held);
  expect(await flow.status(true)).toMatchObject({status:'failed',retryBlocked:false,outcome:'uncertain'});
  await flow.status(true);
  expect(await memberAiActionAccess(database.db,owner,'wine_deep_search')).toMatchObject({used:0,pending:0});
  expect(database.sql.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='release'").get()!.n).toBe(1);
  expect(flow.provider).toHaveBeenCalledOnce();
 });

 it.each([false,true])('stops waiting once, preserves saved scopes and releases the hold (partial: %s)',async partial=>{
  const flow=await httpFlow();flow.provider.mockRejectedValue(new Error('connection lost after provider submission'));
  await flow.consume();await flow.consume();
  if(partial){const entry=splitDeepSearchResult({...answer,sources:[{title:'Krug',url:'https://www.krug.com/'}],model:'fixture',researchedAt:new Date().toISOString()},buildResearchTargets(wine)).find(e=>e.target.scope==='producer')!;await upsertResearchCache(database.db,owner,entry)}
  const results=await Promise.all([flow.stop(),flow.stop()]);expect(results.map(r=>r.status)).toEqual([200,200]);
  expect(await flow.status()).toMatchObject({status:'failed',retryBlocked:false,outcome:'uncertain'});
  expect(await memberAiActionAccess(database.db,owner,'wine_deep_search')).toMatchObject({used:partial?1:0,pending:0});
  expect((await loadResearchCache(database.db,owner,buildResearchTargets(wine))).size).toBe(partial?1:0);
  expect(database.sql.prepare("SELECT count(*) n FROM credit_ledger WHERE kind='release'").get()!.n).toBe(1);
  expect(database.sql.prepare('SELECT state FROM provider_operations').get()!.state).toBe('uncertain');
  expect(database.sql.prepare('SELECT message FROM wine_research_runs').get()!.message).toContain('connection lost');
  expect(String(database.sql.prepare('SELECT message FROM wine_research_runs').get()!.message).match(/Stopped waiting/g)).toHaveLength(1);
  await maintainJobs(database.db,flow.workerEnv.RESEARCH_QUEUE);
  await flow.consume({owner,kind:'wine_batch_poll',requestId,wineId,_creditOperationId:flow.accepted.creditOperationId});
  await expect(durableProvider({db:database.db,operationId:flow.accepted.creditOperationId,namespace:'queue'},'new-attempt',flow.provider)).rejects.toThrow();
  expect(flow.provider).toHaveBeenCalledOnce();expect((await flow.requote()).status).toBe(200);
  vi.setSystemTime(Date.now()+1000);
  flow.provider.mockImplementation(async()=>Response.json(payload()));expect((await flow.retry()).status).toBe(202);
  await flow.consume();await flow.consume();
  const latest=await flow.request('deep-search-status');expect(await latest.json()).toMatchObject({status:'complete',retryBlocked:false});
  expect(flow.provider).toHaveBeenCalledTimes(2);
 });

 it('does not stop waiting while a queue delivery still owns the request',async()=>{
  const flow=await httpFlow();flow.provider.mockRejectedValue(new Error('connection lost'));
  await flow.consume();const delivery=await flow.consume();
  database.sql.prepare('UPDATE queue_deliveries SET done=0,lease_until=? WHERE id=?').run(seconds()+600,String(delivery.job._outboxId));
  expect((await flow.stop()).status).toBe(409);expect(await flow.status()).toMatchObject({retryBlocked:true});
  vi.setSystemTime(Date.now()+601_000);
  expect((await flow.stop()).status).toBe(200);expect(await flow.status()).toMatchObject({retryBlocked:false});
 });

 it('stops an abandoned tracked batch but rejects stopping a running run',async()=>{
  const flow=await httpFlow();expect((await flow.stop()).status).toBe(409);
  flow.provider.mockRejectedValue(new Error('connection lost'));await flow.consume();await flow.consume();
  database.sql.exec("UPDATE research_batch_jobs SET status='running'");
  expect((await flow.stop()).status).toBe(200);
  expect(database.sql.prepare('SELECT status FROM research_batch_jobs').get()!.status).toBe('failed');
  expect(flow.provider).toHaveBeenCalledOnce();
 });

 it('does not let another account recover or stop the held request',async()=>{
  const flow=await httpFlow();flow.provider.mockRejectedValue(new Error('connection lost'));await flow.consume();await flow.consume();
  database.sql.exec("INSERT INTO app_users(id,email,display_name,role) VALUES('bob','bob@example.com','Bob','member')");
  await database.db.prepare('INSERT INTO auth_sessions VALUES(?,?,?)').bind(await hash('bob-session'),'bob',seconds()+86400).run();
  const auth={Cookie:'__Host-winelog=bob-session'};
  expect((await flow.request(`deep-search-status?requestId=${requestId}`,'POST',undefined,auth)).status).toBe(404);
  expect((await flow.request('deep-search-cancel','POST',{confirmation:'STOP_WAITING_DEEP_SEARCH',requestId},auth)).status).toBe(404);
  expect(await flow.status()).toMatchObject({retryBlocked:true});expect(flow.provider).toHaveBeenCalledOnce();
 });

 it('stops an interrupted owner request even when no research run was committed',async()=>{
  database.sql.exec("UPDATE app_users SET role='owner' WHERE id='alice'");
  const flow=await httpFlow(()=>database.sql.exec("CREATE TEMP TRIGGER injected_failure BEFORE UPDATE OF run_id ON credit_operations WHEN new.run_id IS NOT NULL BEGIN SELECT RAISE(ABORT,'injected linkage failure'); END"),500);
  database.sql.exec('DROP TRIGGER injected_failure');
  const operation=database.sql.prepare('SELECT id FROM credit_operations').get()!;
  const response=await flow.request('deep-search-cancel','POST',{confirmation:'STOP_WAITING_DEEP_SEARCH',requestId:operation.id});
  expect(response.status).toBe(200);
  const status=await flow.request('deep-search-status');expect(await status.json()).toMatchObject({status:'failed',retryBlocked:false,outcome:'interrupted'});
  expect(flow.provider).not.toHaveBeenCalled();
 });

 it('rolls back stopping the request if reservation settlement cannot be persisted',async()=>{
  const flow=await httpFlow();flow.provider.mockRejectedValue(new Error('connection lost'));
  await flow.consume();await flow.consume();
  database.sql.exec("CREATE TEMP TRIGGER injected_failure BEFORE INSERT ON credit_ledger WHEN new.kind='release' BEGIN SELECT RAISE(ABORT,'injected settlement failure'); END");
  expect((await flow.stop()).status).toBe(500);expect(await flow.status()).toMatchObject({retryBlocked:true});
  expect(await memberAiActionAccess(database.db,owner,'wine_deep_search')).toMatchObject({used:0,pending:1});
  database.sql.exec('DROP TRIGGER injected_failure');expect((await flow.stop()).status).toBe(200);
 });

 it('requires same-origin authenticated, matching requests for explicit recovery and stopping',async()=>{
  const flow=await httpFlow();flow.provider.mockRejectedValue(new Error('connection lost'));
  await flow.consume();await flow.consume();vi.setSystemTime(Date.now()+49*3600_000);
  expect((await flow.request('deep-search-status','POST',undefined,{Origin:'https://elsewhere.example'})).status).toBe(403);
  expect((await flow.request('deep-search-status','POST',undefined,{Cookie:''})).status).toBe(401);
  expect((await flow.request('deep-search-status?requestId=wrong','POST')).status).toBe(404);
  expect((await flow.request('deep-search-cancel','POST',{confirmation:'STOP_WAITING_DEEP_SEARCH',requestId:'wrong'})).status).toBe(404);
  expect((await flow.request('deep-search-cancel','POST',{confirmation:'STOP_WAITING_DEEP_SEARCH',requestId},{Origin:'https://elsewhere.example'})).status).toBe(403);
  expect(await flow.status()).toMatchObject({retryBlocked:true});expect(flow.provider).toHaveBeenCalledOnce();
 });

 it('rejects a fresh provider submission using a terminal operation context',async()=>{
  const flow=await httpFlow();await flow.consume();await flow.consume();
  const context={db:database.db,operationId:flow.accepted.creditOperationId,namespace:'queue'};
  await expect(durableProvider(context,'unexpected-new-attempt',flow.provider)).rejects.toThrow();
  expect(flow.provider).toHaveBeenCalledOnce();
 });
 it('commits initial run, dispatch and operation linkage together',async()=>{
  const flow=await httpFlow(()=>database.sql.exec("CREATE TEMP TRIGGER injected_failure BEFORE UPDATE OF run_id ON credit_operations WHEN new.run_id IS NOT NULL BEGIN SELECT RAISE(ABORT,'injected linkage failure'); END"),500);
  expect(database.sql.prepare('SELECT count(*) AS n FROM queue_outbox').get()!.n).toBe(0);
  expect(database.sql.prepare('SELECT count(*) AS n FROM wine_research_runs').get()!.n).toBe(0);
  expect(flow.delivered).toHaveLength(0);
  database.sql.exec('DROP TRIGGER injected_failure');
  vi.setSystemTime(Date.now()+16*60_000);await maintainJobs(database.db,flow.workerEnv.RESEARCH_QUEUE);
  expect(await memberAiActionAccess(database.db,owner,'wine_deep_search')).toMatchObject({used:0,pending:0});
 });

 it('does not let a delayed accepted response reopen a completed operation',async()=>{
  const flow=await httpFlow();
  const operation=await database.db.prepare('SELECT * FROM credit_operations WHERE id=?').bind(flow.accepted.creditOperationId).first<CreditOperation>();
  await flow.consume();await flow.consume();
  await saveOperationResponse(database.db,operation!,Response.json({accepted:true,researchRequestId:requestId},{status:202}));
  expect(database.sql.prepare('SELECT status,response_status FROM credit_operations').get()).toMatchObject({status:'complete',response_status:200});
  expect(await memberAiActionAccess(database.db,owner,'wine_deep_search')).toMatchObject({used:1,pending:0});
 });
 it('does not consume allowance when all research becomes reusable before execution',async()=>{
  const flow=await httpFlow();vi.setSystemTime(Date.now()+1000);
  const entries=splitDeepSearchResult({...answer,sources:[{title:'Krug',url:'https://www.krug.com/'}],model:'fixture',researchedAt:new Date().toISOString()},buildResearchTargets(wine));
  expect(entries).toHaveLength(3);
  for(const entry of entries)await upsertResearchCache(database.db,owner,entry);
  await flow.consume();
  expect(await flow.status()).toMatchObject({status:'complete',attempt:0});
  expect(flow.provider).not.toHaveBeenCalled();
  expect(await memberAiActionAccess(database.db,owner,'wine_deep_search')).toMatchObject({used:0,pending:0,remaining:2});
 });

 it('keeps a definite failure terminal on HTTP replay without recreating a pending allowance',async()=>{
  const flow=await httpFlow();flow.provider.mockImplementation(async()=>new Response('definite rejection',{status:400}));
  await flow.consume();await flow.consume();await flow.consume();
  expect(await flow.status()).toMatchObject({status:'failed',retryBlocked:false});
  expect(database.sql.prepare('SELECT count(*) AS n FROM member_ai_action_usage').get()!.n).toBe(0);
  await flow.start();
  expect(database.sql.prepare('SELECT count(*) AS n FROM member_ai_action_usage').get()!.n).toBe(0);
  expect(flow.provider).toHaveBeenCalledTimes(2);
 });

 it('reports a completed HTTP replay as complete without resubmitting work',async()=>{
  const flow=await httpFlow();await flow.consume();await flow.consume();
  const replay=await flow.start();expect(replay.status).toBe(200);
  expect(await replay.json()).toMatchObject({status:'complete',researchRequestId:requestId,creditOperationId:flow.accepted.creditOperationId});
  expect(flow.provider).toHaveBeenCalledOnce();
  expect(await memberAiActionAccess(database.db,owner,'wine_deep_search')).toMatchObject({used:1,pending:0});
 });

 it('releases a running operation abandoned before dispatch, using the existing reservation window',async()=>{
  const flow=await httpFlow();
  // Snapshot of an abrupt HTTP termination before the run/outbox are committed.
  database.sql.exec("DELETE FROM queue_outbox; DELETE FROM wine_research_runs; UPDATE credit_operations SET run_id=NULL,response_json=NULL,response_status=NULL");
  flow.delivered.length=0;
  vi.setSystemTime(Date.now()+16*60_000);
  await maintainJobs(database.db,flow.workerEnv.RESEARCH_QUEUE);
  expect(database.sql.prepare('SELECT status FROM credit_operations').get()!.status).toBe('failed');
  expect(await memberAiActionAccess(database.db,owner,'wine_deep_search')).toMatchObject({used:0,pending:0,remaining:2});
  expect(flow.provider).not.toHaveBeenCalled();
 });

 it('finishes with the browser closed and reconstructs state on a later visit',async()=>{
  const flow=await httpFlow();
  expect(flow.provider).not.toHaveBeenCalled();
  expect(await memberAiActionAccess(database.db,owner,'wine_deep_search')).toMatchObject({used:0,pending:1});
  // No status polling or requesting-browser work drives either delivery.
  const first=await flow.consume();expect(first.ack).toHaveBeenCalledOnce();expect(first.retry).not.toHaveBeenCalled();
  const second=await flow.consume();expect(second.ack).toHaveBeenCalledOnce();expect(second.retry).not.toHaveBeenCalled();
  expect(await flow.status()).toMatchObject({requestId,status:'complete',stage:'complete'});
  expect(await memberAiActionAccess(database.db,owner,'wine_deep_search')).toMatchObject({used:1,pending:0});
  expect(flow.provider).toHaveBeenCalledOnce();
 });

 it('returns the existing run on refresh and repeated submit, and ignores duplicate deliveries',async()=>{
  const flow=await httpFlow();
  expect(await flow.status()).toMatchObject({requestId,status:'running',stage:'queued'});
  expect(await (await flow.start()).json()).toMatchObject({researchRequestId:requestId,creditOperationId:flow.accepted.creditOperationId});
  expect(database.sql.prepare('SELECT count(*) AS n FROM credit_operations').get()!.n).toBe(1);
  const first=await flow.consume();await flow.consume(first.job);
  expect(flow.delivered).toHaveLength(1);
  const second=await flow.consume();await flow.consume(second.job);
  expect(flow.provider).toHaveBeenCalledOnce();
  expect(await memberAiActionAccess(database.db,owner,'wine_deep_search')).toMatchObject({used:1,pending:0});
 });

 it('retries settlement without acknowledging the delivery before settlement succeeds',async()=>{
  const flow=await httpFlow();await flow.consume();
  database.sql.exec("CREATE TEMP TRIGGER injected_failure BEFORE UPDATE OF status ON credit_operations WHEN new.status='complete' BEGIN SELECT RAISE(ABORT,'injected settlement failure'); END");
  const failed=await flow.consume();
  expect(failed.retry).toHaveBeenCalledOnce();expect(failed.ack).not.toHaveBeenCalled();
  database.sql.exec('DROP TRIGGER injected_failure');
  await flow.consume(failed.job,2);
  expect(flow.provider).toHaveBeenCalledOnce();
  expect(await memberAiActionAccess(database.db,owner,'wine_deep_search')).toMatchObject({used:1,pending:0});
 });

 it('replays the same outbox identity if dispatch succeeded but its receipt did not persist',async()=>{
  const flow=await httpFlow();
  // Model the first dispatch having reached the queue just before the sender
  // crashed. The outbox's 60-second lease must expire before redispatch.
  const original=flow.delivered[0];
  database.sql.prepare('UPDATE queue_outbox SET sent_at=NULL,due_at=? WHERE id=?').run(seconds()+60,String(original._outboxId));
  await flushOutbox(database.db,flow.workerEnv.RESEARCH_QUEUE);expect(flow.delivered).toHaveLength(1);
  vi.setSystemTime(Date.now()+61_000);
  await flushOutbox(database.db,flow.workerEnv.RESEARCH_QUEUE);expect(flow.delivered).toHaveLength(2);
  expect(flow.delivered[1]._outboxId).toBe(original._outboxId);
  await flow.consume();await flow.consume();await flow.consume();
  expect(flow.provider).toHaveBeenCalledOnce();
  expect(await memberAiActionAccess(database.db,owner,'wine_deep_search')).toMatchObject({used:1,pending:0});
 });
});

describe('Wine Deep Search persistence boundaries',()=>{
 it('does not resurrect a terminal operation if settlement wins a maintenance recovery race',async()=>{
  const {operation}=await setup();
  database.sql.exec("UPDATE credit_operations SET status='review'; UPDATE wine_research_runs SET status='failed',stage='failed'; UPDATE research_batch_jobs SET status='failed'; UPDATE vertex_batch_emulation_jobs SET state='JOB_STATE_SUCCEEDED',result_json='{}'");
  const batch=database.db.batch.bind(database.db);
  vi.spyOn(database.db,'batch').mockImplementationOnce(async statements=>{await settle(database.db,operation,0,undefined,false);return batch(statements)});
  await maintainJobs(database.db,{send:vi.fn()} as unknown as Queue);
  expect(await getWineResearchRun(database.db,owner,wineId,requestId)).toMatchObject({status:'failed'});
  expect(database.sql.prepare('SELECT count(*) AS n FROM queue_outbox').get()!.n).toBe(0);
 });
 it('attributes newly generated scopes to this operation after a view adopted a friend cache mid-flight',async()=>{
  const {operation,poll}=await setup();
  for(const entry of splitDeepSearchResult({...answer,sources:[{title:'Krug',url:'https://www.krug.com/'}],model:'friend-fixture',researchedAt:new Date().toISOString()},buildResearchTargets(wine)))await upsertResearchCache(database.db,owner,entry);
  database.sql.exec("UPDATE research_cache SET source_user_id='friend'");
  await poll();await assertComplete(operation);
 });
 it('preserves the native batch route and reuses its submission after local setup fails',async()=>{
  const flow=await httpFlow();
  for(const key of ['CF_AI_GATEWAY_TOKEN','AI_GATEWAY_ACCOUNT_ID','AI_GATEWAY_ID','VERTEX_PROJECT_ID','VERTEX_REGION'])delete (flow.workerEnv as unknown as Record<string,unknown>)[key];
  flow.workerEnv.GEMINI_API_KEY='native-test';
  flow.provider.mockImplementation(async(url?:unknown,init?:RequestInit)=>init?.method==='POST'?Response.json({name:'batches/native-test'}):Response.json({state:'JOB_STATE_SUCCEEDED',dest:{inlinedResponses:[{metadata:{key:'wine-research'},response:payload()}]}}));
  database.sql.exec("CREATE TEMP TRIGGER injected_failure BEFORE INSERT ON research_batch_jobs BEGIN SELECT RAISE(ABORT,'injected native setup failure'); END");
  const delivery=await flow.consume();expect(delivery.retry).toHaveBeenCalledOnce();database.sql.exec('DROP TRIGGER injected_failure');
  // Replanning after the failed local write must not buy a second native batch
  // when reusable research arrives and changes the generated prompt.
  const [reusable]=splitDeepSearchResult({...answer,sources:[{title:'Krug',url:'https://www.krug.com/'}],model:'cache-fixture',researchedAt:new Date().toISOString()},buildResearchTargets(wine));await upsertResearchCache(database.db,owner,reusable);
  await flow.consume(delivery.job,2);vi.setSystemTime(Date.now()+61_000);await flushOutbox(database.db,flow.workerEnv.RESEARCH_QUEUE);await flow.consume();
  expect(await flow.status()).toMatchObject({status:'complete'});
  expect(flow.provider.mock.calls.filter(call=>(call[1] as RequestInit|undefined)?.method==='POST')).toHaveLength(1);
 });
 it('reports partial research honestly while preserving the one-successful-action policy',async()=>{
  const {operation}=await setup();database.sql.exec("UPDATE wine_research_runs SET status='failed',stage='failed'; UPDATE research_batch_jobs SET status='failed'");
  const [entry]=splitDeepSearchResult({...answer,sources:[{title:'Krug',url:'https://www.krug.com/'}],model:'fixture',researchedAt:new Date().toISOString()},buildResearchTargets(wine));await upsertResearchCache(database.db,owner,entry);
  await reconcileOperation(database.db,{...operation,status:'running',run_id:requestId});
  const final=database.sql.prepare('SELECT response_json FROM credit_operations').get()!;
  expect(JSON.parse(String(final.response_json))).toMatchObject({status:'failed',partial:true});
  expect(await memberAiActionAccess(database.db,owner,'wine_deep_search')).toMatchObject({used:1,pending:0});
 });

 it.each(['deleted','unshared'] as const)('terminates saved-result recovery when the bottle is %s',async mode=>{
  if(mode==='unshared')database.sql.exec("INSERT INTO app_users(id,email,display_name,role) VALUES('bob','bob@example.com','Bob','member'); INSERT INTO friendships(user_id,friend_id) VALUES('alice','bob'),('bob','alice'); UPDATE wines SET owner_id='bob' WHERE id='krug'; INSERT INTO wine_shares(wine_id,owner_id,recipient_id) VALUES('krug','bob','alice');");
  const {operation,provider,poll}=await setup();
  database.sql.exec("CREATE TEMP TRIGGER injected_failure BEFORE INSERT ON research_cache BEGIN SELECT RAISE(ABORT,'injected cache failure'); END");
  await expect(poll()).rejects.toThrow('injected cache failure');database.sql.exec('DROP TRIGGER injected_failure');
  database.sql.exec(mode==='deleted'?"DELETE FROM wines WHERE id='krug'":"DELETE FROM wine_shares WHERE wine_id='krug'");
  await expect(poll()).resolves.toBeUndefined();
  expect(database.sql.prepare('SELECT status FROM research_batch_jobs').get()!.status).toBe('failed');
  await reconcileOperation(database.db,{...operation,status:'running',run_id:requestId});
  expect(database.sql.prepare('SELECT status FROM credit_operations').get()!.status).toBe('failed');
  expect(await memberAiActionAccess(database.db,owner,'wine_deep_search')).toMatchObject({used:0,pending:0});
  expect(provider).toHaveBeenCalledOnce();
 });

 it('terminates incomplete-cache finalisation without buying another model attempt',async()=>{
  const {operation,provider,poll}=await setup();
  // The database accepts the write, but a scope is no longer available at finalisation.
  database.sql.exec("CREATE TEMP TRIGGER remove_scope AFTER INSERT ON research_cache WHEN new.scope='terroir' BEGIN DELETE FROM research_cache WHERE owner_id=new.owner_id AND scope=new.scope AND cache_key=new.cache_key; END");
  await expect(poll()).resolves.toBeUndefined();
  expect(await getWineResearchRun(database.db,owner,wineId,requestId)).toMatchObject({status:'failed',message:expect.stringContaining('cache is incomplete')});
  await reconcileOperation(database.db,{...operation,status:'running',run_id:requestId});
  expect(database.sql.prepare('SELECT count(*) AS n FROM research_batch_jobs').get()!.n).toBe(1);
  expect(await memberAiActionAccess(database.db,owner,'wine_deep_search')).toMatchObject({used:1,pending:0});
  await poll();expect(provider).toHaveBeenCalledOnce();
 });

 it('retries a failed terminal-state write without partially finishing the run',async()=>{
  const {provider,poll}=await setup();
  database.sql.exec("DELETE FROM wines WHERE id='krug'; CREATE TEMP TRIGGER injected_failure BEFORE UPDATE OF status ON wine_research_runs WHEN new.status='failed' BEGIN SELECT RAISE(ABORT,'injected terminal write failure'); END");
  await expect(poll()).rejects.toThrow('injected terminal write failure');
  expect(database.sql.prepare('SELECT status FROM research_batch_jobs').get()!.status).toBe('running');
  database.sql.exec('DROP TRIGGER injected_failure');await poll();
  expect(await getWineResearchRun(database.db,owner,wineId,requestId)).toMatchObject({status:'failed'});
  expect(database.sql.prepare('SELECT status FROM research_batch_jobs').get()!.status).toBe('failed');
  expect(provider).toHaveBeenCalledOnce();
 });
 it('preserves saved scopes when an initial refresh delivery is replayed during finalisation',async()=>{
  const {poll,researchEnv}=await setup('all');
  database.sql.exec("CREATE TEMP TRIGGER injected_failure BEFORE UPDATE OF deep_search_json ON wines BEGIN SELECT RAISE(ABORT,'injected snapshot failure'); END");
  await expect(poll()).rejects.toThrow('injected snapshot failure');database.sql.exec('DROP TRIGGER injected_failure');
  await startWineBatchResearch(researchEnv,owner,wineId,requestId,'all');
  expect((await loadResearchCache(database.db,owner,buildResearchTargets(wine))).size).toBe(3);
 });
 it('does not reopen completed research when a delayed progress update arrives',async()=>{
  const {poll}=await setup();await poll();
  await updateWineResearchRun(database.db,owner,requestId,'researching','Delayed progress','running');
  expect(await getWineResearchRun(database.db,owner,wineId,requestId)).toMatchObject({status:'complete'});
 });
 it('does not count invalid saved cache rows as a successful member action',async()=>{
  const {operation}=await setup();
  database.sql.exec("UPDATE wine_research_runs SET status='failed',stage='failed'; UPDATE research_batch_jobs SET status='failed'");
  for(const target of buildResearchTargets(wine))await upsertResearchCache(database.db,owner,{target,payload:{summary:'unverified'},sources:[],model:'bad-cache',researchedAt:new Date().toISOString()});
  await reconcileOperation(database.db,{...operation,status:'running',run_id:requestId});
  expect(await memberAiActionAccess(database.db,owner,'wine_deep_search')).toMatchObject({used:0,pending:0});
 });
 it('settles an already completed run as successful even after the recovery horizon',async()=>{
  const {operation,poll}=await setup();await poll();
  vi.setSystemTime(Date.now()+49*3600_000);
  const current=await database.db.prepare('SELECT * FROM credit_operations WHERE id=?').bind(operation.id).first<CreditOperation>();
  await reconcileOperation(database.db,current!);
  expect(database.sql.prepare('SELECT status,response_status FROM credit_operations').get()).toMatchObject({status:'complete',response_status:200});
 });

 it('keeps provider retry identity stable when recovery has a different remaining time budget',async()=>{
  const {operation,provider,poll}=await setup();
  let markStarted!:()=>void;const started=new Promise<void>(resolve=>{markStarted=resolve});
  provider.mockImplementationOnce(()=>{markStarted();return new Promise<Response>(resolve=>setTimeout(()=>resolve(new Response('busy',{status:503})),500_000))});
  database.sql.exec("CREATE TEMP TRIGGER injected_failure BEFORE UPDATE OF result_json ON vertex_batch_emulation_jobs WHEN new.state='JOB_STATE_SUCCEEDED' BEGIN SELECT RAISE(ABORT,'injected persistence failure'); END");
  // Response-body reads and receipt hashing can finish outside the fake timer
  // turn. Advance each retry only after its backoff has actually been queued.
  const schedule=setTimeout;let markRetryScheduled!:()=>void;
  let retryScheduled=new Promise<void>(resolve=>{markRetryScheduled=resolve});
  vi.spyOn(globalThis,'setTimeout').mockImplementation((handler,delay,...args)=>{
   const timer=schedule(handler,delay,...args);if(delay===900)markRetryScheduled();return timer;
  });
  const pending=expect(poll()).rejects.toThrow('injected persistence failure');
  await started;await vi.advanceTimersByTimeAsync(500_000);
  await retryScheduled;await vi.advanceTimersByTimeAsync(900);await pending;
  expect(provider).toHaveBeenCalledTimes(2);
  database.sql.exec('DROP TRIGGER injected_failure');vi.setSystemTime(Date.now()+13*60_000);
  retryScheduled=new Promise<void>(resolve=>{markRetryScheduled=resolve});
  const resumed=poll();
  await retryScheduled;await vi.advanceTimersByTimeAsync(900);await resumed;
  await assertComplete(operation);expect(provider).toHaveBeenCalledTimes(2);
 });
 it('settles research saved by a recipient for a shared bottle',async()=>{
  database.sql.exec("INSERT INTO app_users(id,email,display_name,role) VALUES('bob','bob@example.com','Bob','member'); INSERT INTO friendships(user_id,friend_id) VALUES('alice','bob'),('bob','alice'); UPDATE wines SET owner_id='bob' WHERE id='krug'; INSERT INTO wine_shares(wine_id,owner_id,recipient_id) VALUES('krug','bob','alice');");
  const {operation,provider,poll}=await setup();
  await poll();
  const current=await database.db.prepare('SELECT * FROM credit_operations WHERE id=?').bind(operation.id).first<CreditOperation>();
  await reconcileOperation(database.db,current!);
  expect(database.sql.prepare('SELECT status FROM credit_operations WHERE id=?').get(operation.id)!.status).toBe('complete');
  expect(await memberAiActionAccess(database.db,owner,'wine_deep_search')).toMatchObject({used:1,pending:0});
  expect(provider).toHaveBeenCalledTimes(1);
 });
 it('saves a member result, settles one allowance and ignores completed poll replays',async()=>{
  const {operation,provider,poll}=await setup();
  await poll();await assertComplete(operation);await poll();await assertComplete(operation);
  expect(provider).toHaveBeenCalledTimes(1);
 });

 it('repairs a previously split job/run completion without another provider request',async()=>{
  const {operation,provider,poll}=await setup();
  await poll();
  database.sql.exec("UPDATE wine_research_runs SET status='running',stage='saving',completed_at=NULL");
  await poll();await assertComplete(operation);
  expect(provider).toHaveBeenCalledTimes(1);
 });

 it('does not cancel a live emulation lease when a duplicate poll reaches the native-batch stall limit',async()=>{
  const {provider,poll}=await setup();
  database.sql.prepare("UPDATE vertex_batch_emulation_jobs SET state='JOB_STATE_RUNNING',updated_at=?").run(new Date().toISOString());
  await poll(4);
  expect(provider).not.toHaveBeenCalled();
  expect(database.sql.prepare('SELECT count(*) AS n FROM research_batch_jobs').get()!.n).toBe(1);
  expect(database.sql.prepare('SELECT state FROM vertex_batch_emulation_jobs').get()!.state).toBe('JOB_STATE_RUNNING');
 });

 it.each([
  ['emulation result',"BEFORE UPDATE OF result_json ON vertex_batch_emulation_jobs WHEN new.state='JOB_STATE_SUCCEEDED'"],
  ['scope cache','BEFORE INSERT ON research_cache'],
  ['sharing publication','BEFORE INSERT ON reusable_research'],
  ['wine snapshot','BEFORE UPDATE OF deep_search_json ON wines'],
  ['job completion',"BEFORE UPDATE OF status ON research_batch_jobs WHEN new.status='complete'"],
  ['run completion',"BEFORE UPDATE OF status ON wine_research_runs WHEN new.status='complete'"]
 ])('replays saved provider work after failure saving %s',async(_boundary,trigger)=>{
  const {operation,provider,poll}=await setup();
  database.sql.exec(`CREATE TEMP TRIGGER injected_failure ${trigger} BEGIN SELECT RAISE(ABORT,'injected persistence failure'); END`);
  await expect(poll()).rejects.toThrow('injected persistence failure');
  expect(provider).toHaveBeenCalledTimes(1);
  expect(await getWineResearchRun(database.db,owner,wineId,requestId)).toMatchObject({status:'running'});
  expect(database.sql.prepare("SELECT count(*) AS n FROM research_batch_jobs").get()!.n).toBe(1);
  database.sql.exec('DROP TRIGGER injected_failure');
  // A terminated executor's existing lease expires; the same saved response
  // must be consumed, without buying a fallback or a second logical run.
  vi.setSystemTime(Date.now()+13*60_000);
  await poll();await assertComplete(operation);
  expect(provider).toHaveBeenCalledTimes(1);
 });
});
