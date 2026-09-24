import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {realD1} from './support/realD1';
import {quote,reserve,reconcileOperation,settle} from '../../worker/multiUser/credits';
import {hash,seconds,type Member} from '../../worker/multiUser/common';
import {createWineResearchRun,getWineResearchRun} from '../../src/lib/research/backgroundJobs';
import {startWineBatchResearch,pollWineBatchResearch} from '../../src/lib/research/batchWineResearch';
import {configureGeminiBatchGateway,clearGeminiBatchGateway} from '../../src/lib/research/geminiBatch';
import worker from '../../worker/multiUserEntry';

let database:ReturnType<typeof realD1>;
const requestId='11155b35-cb71-48b4-aaca-40d8f52bd9e0';
const member:Member={id:'owner',role:'owner',email:'owner@example.com',display_name:'Owner',status:'active'};
const request=()=>new Request('https://wine.example/api/wines/krug/deep-search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmation:'RUN_DEEP_SEARCH',refresh:'none',requestId})});
const env=()=>({DB:database.db,AUTH_SECRET:'a'.repeat(48),APP_URL:'https://wine.example',OWNER_GOOGLE_SUB:'owner',CF_AI_GATEWAY_TOKEN:'test',AI_GATEWAY_ACCOUNT_ID:'test',AI_GATEWAY_ID:'test',VERTEX_PROJECT_ID:'test',VERTEX_REGION:'global'});
beforeEach(()=>{
 database=realD1();
 database.sql.exec("INSERT OR IGNORE INTO app_users(id,email,display_name,role) VALUES('owner','owner@example.com','Owner','owner'); INSERT OR IGNORE INTO credit_wallets(user_id) VALUES('owner'); INSERT INTO wines(id,owner_id,producer,wine_name,country,region,wine_style,created_at,updated_at) VALUES('krug','owner','Krug','Grande Cuvée 173ème Édition','France','Champagne','sparkling','now','now')");
 configureGeminiBatchGateway(undefined,env());
 vi.spyOn(console,'log').mockImplementation(()=>{});vi.spyOn(console,'warn').mockImplementation(()=>{});
});
afterEach(()=>{clearGeminiBatchGateway(undefined);vi.unstubAllGlobals();vi.restoreAllMocks();vi.useRealTimers();database.close()});
async function setup(){
 const q=await quote(request(),env(),member),req=request();req.headers.set('X-WineLog-Quote',q.id);req.headers.set('Idempotency-Key',requestId);
 const {operation}=await reserve(req,env(),member);
 await createWineResearchRun(database.db,'owner','krug','none',requestId);
 database.sql.prepare("UPDATE credit_operations SET status='running',run_id=? WHERE id=?").run(requestId,operation.id);
 const send=vi.fn(),researchEnv={...env(),CREDIT_CONTEXT:{db:database.db,operationId:operation.id,namespace:'queue'},RESEARCH_QUEUE:{send} as unknown as Queue<unknown>};
 expect(await startWineBatchResearch(researchEnv,'owner','krug',requestId,'none')).toMatchObject({ok:true});
 const job=send.mock.calls[0][0] as {jobId:string};
 return {operation,researchEnv,send,job};
}

describe('Deep Search provider reconciliation',()=>{
 it.each(['connection','timeout'])('preserves a %s failure and stops without submitting a fallback',async failure=>{
  vi.useFakeTimers();
  const {operation,researchEnv,send,job}=await setup();
  let markStarted!:()=>void;const started=new Promise<void>(resolve=>{markStarted=resolve});
  const provider=vi.fn(()=>{markStarted();return failure==='connection'?Promise.reject(new Error('Connection lost after submission')):new Promise<Response>(()=>{})});vi.stubGlobal('fetch',provider);
  const pending=pollWineBatchResearch(researchEnv,'owner','krug',requestId,job.jobId,0);
  await started;
  if(failure==='timeout')await vi.advanceTimersByTimeAsync(600_000);
  await pending;
  const run=await getWineResearchRun(database.db,'owner','krug',requestId);
  expect(run).toMatchObject({status:'failed',attempt:1});
  expect(run?.message).toContain('Provider completion needs reconciliation');
  expect(run?.message).toContain(failure==='connection'?'Connection lost after submission':'timed out');
  expect(provider).toHaveBeenCalledTimes(1);expect(send).toHaveBeenCalledTimes(1);
  expect(database.sql.prepare('SELECT count(*) AS n FROM research_batch_jobs').get()!.n).toBe(1);
  await reconcileOperation(database.db,operation);
  expect(database.sql.prepare('SELECT status FROM credit_operations WHERE id=?').get(operation.id)!.status).toBe('review');
 });

 it('keeps normal HTTP retries and model fallback when every provider response was saved',async()=>{
  const {researchEnv,send,job}=await setup();
  const provider=vi.fn(async()=>new Response('Provider unavailable',{status:503}));vi.stubGlobal('fetch',provider);
  await pollWineBatchResearch(researchEnv,'owner','krug',requestId,job.jobId,0);
  expect(provider).toHaveBeenCalledTimes(2);expect(send).toHaveBeenCalledTimes(2);
  expect(await getWineResearchRun(database.db,'owner','krug',requestId)).toMatchObject({status:'running',attempt:2});
  expect(database.sql.prepare("SELECT count(*) AS n FROM provider_operations WHERE state='saved'").get()!.n).toBe(2);
 });

 it('reports the live hold on an old failure and permits retry after it is resolved',async()=>{
  const {operation}=await setup();
  database.sql.prepare("UPDATE wine_research_runs SET status='failed',stage='failed',message='Provider completion needs reconciliation' WHERE request_id=?").run(requestId);
  database.sql.prepare('INSERT INTO auth_sessions VALUES(?,?,?)').run(await hash('session'),'owner',seconds()+3600);
  const status=async()=>{
   const response=await worker.fetch(new Request('https://wine.example/api/wines/krug/deep-search-status',{headers:{Cookie:'__Host-winelog=session'}}),{...env(),WINE_IMAGES:{},RESEARCH_QUEUE:{send:vi.fn()},ASSETS:{fetch:vi.fn()}} as unknown as Parameters<typeof worker.fetch>[1],{} as ExecutionContext);
   expect(response.status).toBe(200);return response.json();
  };
  expect(await status()).toMatchObject({requestId,retryBlocked:true});
  // Simulate an operator resolving a known failure; the stale message is retained.
  await settle(database.db,operation,0,undefined,false);
  expect(await status()).toMatchObject({requestId,retryBlocked:false});
 });
});
