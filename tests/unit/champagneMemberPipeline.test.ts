import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { realD1 } from './support/realD1';
import publicWorker from '../../worker/multiUserEntry';
import { hash,seconds,stamp } from '../../worker/multiUser/common';
import { aiRoute,reconcileOperation,type CreditOperation } from '../../worker/multiUser/credits';
import { durableQueue,flushOutbox,isQueueCleanup,maintainJobs,type JobEnvelope } from '../../worker/multiUser/jobs';
import { memberAiActionAccess,memberAiPolicies,memberActionForRequest } from '../../worker/multiUser/memberAccess';
import { durableProvider } from '../../src/lib/credits/provider';
import { postGeminiGenerateContent } from '../../worker/geminiTransport';
import { createGeminiBatch,fetchGeminiBatch } from '../../src/lib/research/geminiBatch';
import type { ChampagneExtractionStatus } from '../../src/lib/wine/champagneExtraction';
import type { ChampagneExtractionJob } from '../../worker/champagneExtraction';

vi.mock('../../worker/geminiTransport',async original=>({...await original<typeof import('../../worker/geminiTransport')>(),postGeminiGenerateContent:vi.fn()}));
vi.mock('../../src/lib/research/geminiBatch',async original=>({...await original<typeof import('../../src/lib/research/geminiBatch')>(),createGeminiBatch:vi.fn(),fetchGeminiBatch:vi.fn()}));

type Env=Parameters<typeof publicWorker.fetch>[1];
type Job=ChampagneExtractionJob&JobEnvelope;
type Accepted={run:ChampagneExtractionStatus;creditOperationId:string};
type Quote={id:string;total:number;units:Array<{action:string;credits:number;priceId:string}>};
let database:ReturnType<typeof realD1>;
let environment:Env;
let objects:Map<string,string>;
let delivered:Job[];
let provider:ReturnType<typeof vi.fn<()=>Promise<Response>>>;
const origin='https://wine.example';
const path=(wineId='member-wine')=>`/api/wines/${wineId}/champagne-extraction`;
const headers=(user='member',extra:Record<string,string>={})=>({Cookie:`__Host-winelog=${user}-session`,Origin:origin,...extra});
const reply=(details:unknown={dosageGPerL:3})=>({candidates:[{content:{parts:[{text:JSON.stringify({details})}]},finishReason:'STOP'}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:30}});
const operation=(id:string)=>database.sql.prepare('SELECT * FROM credit_operations WHERE id=?').get(id) as unknown as CreditOperation;
const currentRun=(wineId='member-wine')=>database.sql.prepare('SELECT * FROM wine_champagne_extractions WHERE wine_id=?').get(wineId)!;

beforeEach(async()=>{
  database=realD1();objects=new Map();delivered=[];
  for(const user of ['owner','member']){
    database.sql.prepare('INSERT INTO app_users(id,email,display_name,role) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET role=excluded.role,status=\'active\'').run(user,`${user}@example.com`,user,user==='owner'?'owner':'member');
    database.sql.prepare('INSERT OR IGNORE INTO credit_wallets(user_id) VALUES(?)').run(user);
    database.sql.prepare('INSERT INTO auth_sessions VALUES(?,?,?)').run(await hash(`${user}-session`),user,seconds()+3600);
    database.sql.prepare("INSERT INTO wines(id,owner_id,producer,wine_name,region,appellation,wine_style,created_at) VALUES(?,?,'Krug','Grande Cuvee','Champagne','Champagne','sparkling',?)").run(`${user}-wine`,user,stamp());
    for(const suffix of ['front','back'])database.sql.prepare("INSERT INTO wine_images(id,owner_id,wine_id,object_key,content_type,byte_size,width,height,upload_status,created_at) VALUES(?,?,?,?,'image/jpeg',100,1000,1000,'uploaded',?)").run(`${user}-${suffix}`,user,`${user}-wine`,`${user}/${suffix}.jpg`,stamp());
    database.sql.prepare('INSERT INTO wine_sparkling_details(owner_id,wine_id,details_json,updated_at) VALUES(?,?,?,?)').run(user,`${user}-wine`,'{"dosageGPerL":0}',stamp());
  }
  const config={memberLimit:25,memberStorageBytes:100_000_000,totalStorageBytes:8_000_000_000,aiConcurrency:4,aiDailyOperations:100,aiDailyEmbeddingRequests:400,aiMonthlyBudgetUsd:100,aiUnitBudgetUsd:1,cloudflareWarningUsd:5,cloudflareStopUsd:10,cloudflareObservedUsd:0,cloudflareObservedMonth:stamp().slice(0,7),allowOverages:true};
  database.sql.prepare('INSERT INTO pilot_settings(id,value_json) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value_json=excluded.value_json').run(JSON.stringify(config));
  const bucket={
    put:vi.fn(async(key:string,value:string|ArrayBuffer|ArrayBufferView)=>{
      const bytes=typeof value==='string'?new TextEncoder().encode(value):ArrayBuffer.isView(value)?new Uint8Array(value.buffer,value.byteOffset,value.byteLength):new Uint8Array(value);
      objects.set(key,new TextDecoder().decode(bytes));return {};
    }),
    get:vi.fn(async(key:string)=>objects.has(key)?{text:async()=>objects.get(key)!}:null),
    delete:vi.fn(async(keys:string|string[])=>{for(const key of typeof keys==='string'?[keys]:keys)objects.delete(key)})
  };
  environment={DB:database.db,AUTH_SECRET:'a'.repeat(48),APP_URL:origin,GEMINI_API_KEY:'test-key',WINE_IMAGES:bucket,RESEARCH_QUEUE:{send:vi.fn(async(job:Job)=>{delivered.push(job)})},ASSETS:{fetch:vi.fn()},CF_AI_GATEWAY_TOKEN:'token',AI_GATEWAY_ACCOUNT_ID:'account',AI_GATEWAY_ID:'gateway',VERTEX_PROJECT_ID:'project',VERTEX_REGION:'global'} as unknown as Env;
  provider=vi.fn(async()=>Response.json(reply()));
  vi.mocked(postGeminiGenerateContent).mockImplementation(async(env)=>({provider:'vertex-ai-gateway',response:await durableProvider(env.CREDIT_CONTEXT,'champagne-test-flex',provider)}));
  vi.mocked(createGeminiBatch).mockResolvedValue('batches/champagne');
});
afterEach(()=>{database.close();vi.resetAllMocks()});

async function request(target:string,init:RequestInit={},user='member'){
  const pending:Promise<unknown>[]=[],ctx={waitUntil:(promise:Promise<unknown>)=>{pending.push(promise)},passThroughOnException:()=>undefined} as unknown as ExecutionContext;
  const response=await publicWorker.fetch(new Request(origin+target,{...init,headers:{...headers(user),...Object.fromEntries(new Headers(init.headers))}}),environment,ctx);
  await Promise.all(pending);return response;
}
async function prepare(user='member',wineId=`${user}-wine`,ids=[`${user}-front`,`${user}-back`]){
  const form=new FormData();form.set('imageIds',JSON.stringify(ids));
  for(const id of ids)form.append('images',new File([new Uint8Array(30)],`${id}.jpg`,{type:'image/jpeg'}));
  const encoded=new Request(origin+path(wineId),{method:'POST',body:form}),body=await encoded.arrayBuffer(),contentType=encoded.headers.get('Content-Type')!;
  const quoted=await request(`/api/credits/quotes?path=${encodeURIComponent(path(wineId))}`,{method:'POST',headers:{'Content-Type':contentType},body},user);
  return {quoted,execute:async(quoteId:string,key:string=crypto.randomUUID(),bytes=body)=>request(path(wineId),{method:'POST',headers:{'Content-Type':contentType,'X-WineLog-Quote':quoteId,'Idempotency-Key':key},body:bytes},user)};
}
async function start(user='member'){
  const input=await prepare(user);expect(input.quoted.status).toBe(200);
  const quote=await input.quoted.json() as Quote,response=await input.execute(quote.id);
  expect(response.status).toBe(202);return await response.json() as Accepted;
}
async function process(job=delivered.find(item=>!item.cleanup)!){
  const ack=vi.fn(),retry=vi.fn();
  await publicWorker.queue({queue:'winelog-research',messages:[{id:crypto.randomUUID(),body:job,timestamp:new Date(),attempts:1,ack,retry}],ackAll:ack,retryAll:retry} as never,environment);
  return {ack,retry};
}
function allowance(limit=1){database.sql.prepare("UPDATE member_ai_action_policies SET access_mode='allowance',weekly_limit=? WHERE action='champagne_extraction'").run(limit)}
async function nextPoll(){database.sql.prepare("UPDATE queue_outbox SET due_at=? WHERE sent_at IS NULL AND json_extract(body_json,'$.cleanup') IS NULL").run(seconds());await flushOutbox(database.db,environment.RESEARCH_QUEUE);return delivered.at(-1)!}

// Unlike champagneExtraction.test.ts, these requests cross the public auth,
// quote, allowance, durable outbox and queue-consumer entrypoint used in production.
describe('Champagne extraction public multi-user pipeline',()=>{
  it('shares the browser/server route inventory and has an independent member action',()=>{
    expect(aiRoute(path(),'POST')).toBe(true);
    expect(aiRoute(path(),'GET')).toBe(false);
    expect(aiRoute(path()+'/other','POST')).toBe(false);
    expect(memberActionForRequest(new Request(origin+path(),{method:'POST'}))).toBe('champagne_extraction');
  });

  it('exposes the new control, saves its policy and supports owner-only per-member grants',async()=>{
    const overview=await request('/api/admin/overview',{},'owner');expect(overview.status).toBe(200);
    const data=await overview.json() as {actionPolicies:Array<{action:string;label:string;accessMode:string;weeklyLimit:number}>;actions:string[]};
    expect(data.actions).toContain('champagne_extraction');
    expect(data.actionPolicies).toContainEqual(expect.objectContaining({action:'champagne_extraction',label:'Champagne label details extraction',accessMode:'included',weeklyLimit:0}));
    const policies=data.actionPolicies.map(policy=>policy.action==='champagne_extraction'?{...policy,accessMode:'allowance',weeklyLimit:0}:policy);
    const init={method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({policies})};
    expect((await request('/api/admin/action-policies',init)).status).toBe(403);
    expect((await request('/api/admin/action-policies',init,'owner')).status).toBe(200);
    expect((await prepare()).quoted.status).toBe(429);
    const grant={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:'member',action:'champagne_extraction',runs:1,idempotencyKey:'champagne-grant',reason:'Test'})};
    expect((await request('/api/admin/action-grants',grant)).status).toBe(403);
    expect((await request('/api/admin/action-grants',grant,'owner')).status).toBe(201);
    expect((await request('/api/admin/action-grants',grant,'owner')).status).toBe(201);
    expect(await memberAiActionAccess(database.db,'member','champagne_extraction')).toMatchObject({granted:1,remaining:1});
    expect((await prepare()).quoted.status).toBe(200);
    expect((await memberAiPolicies(database.db)).find(p=>p.action==='wine_deep_search')).toMatchObject({accessMode:'allowance',weeklyLimit:2});
  });

  it('quotes one run for multiple photos without staging data or calling a provider',async()=>{
    const input=await prepare();expect(input.quoted.status).toBe(200);
    const quoted=await input.quoted.json() as Quote;
    expect(quoted.total).toBe(0);expect(quoted.units).toHaveLength(1);
    expect(quoted.units[0]).toMatchObject({action:'champagne_extraction',credits:0});
    expect(objects.size).toBe(0);expect(delivered).toHaveLength(0);
    expect(database.sql.prepare('SELECT count(*) AS n FROM credit_operations').get()!.n).toBe(0);
    expect(provider).not.toHaveBeenCalled();
  });

  it('runs for an owner with no tariff or wallet top-up and no member allowance',async()=>{
    allowance(0);database.sql.prepare("DELETE FROM credit_prices WHERE action='champagne_extraction'").run();
    const accepted=await start('owner');
    expect(operation(accepted.creditOperationId)).toMatchObject({user_id:'owner',reserved:0,run_id:accepted.run.requestId,status:'running'});
    await process();expect(operation(accepted.creditOperationId).status).toBe('complete');
    expect(provider).toHaveBeenCalledTimes(1);
    expect(database.sql.prepare("SELECT count(*) AS n FROM member_ai_action_usage WHERE user_id='owner'").get()!.n).toBe(0);
    expect(database.sql.prepare("SELECT balance,reserved FROM credit_wallets WHERE user_id='owner'").get()).toMatchObject({balance:0,reserved:0});
  });

  it('keeps included member work tracked without consuming an allowance',async()=>{
    const accepted=await start();await process();
    expect(operation(accepted.creditOperationId)).toMatchObject({status:'complete',reserved:0,captured:0});
    expect(database.sql.prepare('SELECT count(*) AS n FROM member_ai_action_usage').get()!.n).toBe(0);
    expect(await memberAiActionAccess(database.db,'member','champagne_extraction')).toMatchObject({accessMode:'included',remaining:null});
  });

  it('settles one successful allowance and one provider usage event despite duplicate delivery',async()=>{
    allowance();const input=await prepare(),q=await input.quoted.json() as Quote,key='same-submit';
    const accepted=await (await input.execute(q.id,key)).json() as Accepted;
    expect(await memberAiActionAccess(database.db,'member','champagne_extraction')).toMatchObject({pending:1,used:0,remaining:0});
    const replay=await input.execute(q.id,key);expect(replay.status).toBe(202);
    expect((await replay.json() as Accepted).creditOperationId).toBe(accepted.creditOperationId);
    expect(delivered.filter(job=>!job.cleanup)).toHaveLength(1);
    const job=delivered[0];await process(job);await process(job);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(operation(accepted.creditOperationId).status).toBe('complete');
    expect(await memberAiActionAccess(database.db,'member','champagne_extraction')).toMatchObject({used:1,pending:0,remaining:0});
    expect(await memberAiActionAccess(database.db,'member','wine_deep_search')).toMatchObject({used:0,pending:0,remaining:2});
    expect(database.sql.prepare('SELECT kind,target_id,tier,requests,units FROM ai_usage_events').all()).toEqual([expect.objectContaining({kind:'champagne_extraction',target_id:'member-wine',tier:'flex',requests:1,units:1})]);
    expect(database.sql.prepare("SELECT details_json FROM wine_sparkling_details WHERE owner_id='member'").get()!.details_json).toBe('{"dosageGPerL":0}');
    expect(objects.size).toBe(0);
    expect(vi.mocked(postGeminiGenerateContent).mock.calls[0][0].CREDIT_CONTEXT).toMatchObject({operationId:accepted.creditOperationId,namespace:'queue'});
    expect(vi.mocked(postGeminiGenerateContent).mock.calls[0][1]).toBe('gemini-3.1-flash-lite');
    expect(vi.mocked(postGeminiGenerateContent).mock.calls[0][5]).toMatchObject({serviceTier:'flex'});
  });

  it('releases a failed run, meters its unusable response and permits an explicit new attempt',async()=>{
    allowance();provider.mockImplementationOnce(async()=>Response.json(reply({dosageGPerL:-3})));
    const accepted=await start();await process();
    expect(currentRun().status).toBe('failed');expect(operation(accepted.creditOperationId).status).toBe('failed');
    expect(await memberAiActionAccess(database.db,'member','champagne_extraction')).toMatchObject({used:0,pending:0,remaining:1});
    expect(database.sql.prepare('SELECT count(*) AS n FROM ai_usage_events').get()!.n).toBe(1);
    const next=await start();expect(next.run.requestId).not.toBe(accepted.run.requestId);expect(next.creditOperationId).not.toBe(accepted.creditOperationId);
    await process(delivered.at(-1)!);expect(provider).toHaveBeenCalledTimes(2);
    expect(operation(next.creditOperationId).status).toBe('complete');
  });

  it('fails closed without a quote and rejects unauthorized or mismatched saved photos',async()=>{
    expect((await request(path(),{method:'POST',body:'{}'})).status).toBe(402);
    expect((await prepare('member','owner-wine')).quoted.status).toBe(404);
    expect((await prepare('member','member-wine',['owner-front'])).quoted.status).toBe(400);
    expect((await prepare('member','member-wine',['member-front','member-front'])).quoted.status).toBe(400);
    database.sql.prepare("UPDATE wines SET appellation='Cava' WHERE id='member-wine'").run();
    expect((await prepare()).quoted.status).toBe(400);
    expect(objects.size).toBe(0);expect(delivered).toHaveLength(0);expect(provider).not.toHaveBeenCalled();
  });

  it('revalidates wine eligibility at reservation and photos before queued provider work',async()=>{
    const input=await prepare(),q=await input.quoted.json() as Quote;
    database.sql.prepare("UPDATE wines SET appellation='Champagne Grand Cru' WHERE id='member-wine'").run();
    expect((await input.execute(q.id)).status).toBe(409);
    const accepted=await start();
    database.sql.prepare("DELETE FROM wine_images WHERE id='member-back'").run();
    await process();expect(provider).not.toHaveBeenCalled();
    expect(operation(accepted.creditOperationId).status).toBe('failed');
  });

  it('does not bypass the deployment budget just because the action is included',async()=>{
    database.sql.prepare("UPDATE pilot_settings SET value_json=json_set(value_json,'$.aiMonthlyBudgetUsd',0.5)").run();
    const input=await prepare(),q=await input.quoted.json() as Quote;
    expect((await input.execute(q.id)).status).toBe(409);
    expect(provider).not.toHaveBeenCalled();expect(delivered).toHaveLength(0);expect(objects.size).toBe(0);
  });

  it('retains a durable outbox when queue dispatch fails, then dispatches the same job',async()=>{
    vi.mocked(environment.RESEARCH_QUEUE.send).mockRejectedValueOnce(new Error('Queue unavailable'));
    const accepted=await start();expect(delivered).toHaveLength(0);expect(currentRun().status).toBe('queued');
    expect(operation(accepted.creditOperationId).run_id).toBe(accepted.run.requestId);
    const job=await nextPoll();await process(job);
    expect(provider).toHaveBeenCalledTimes(1);expect(operation(accepted.creditOperationId).status).toBe('complete');
  });

  it('passes the operation into native Batch and revives only its poll from a status read',async()=>{
    delete environment.CF_AI_GATEWAY_TOKEN;delete environment.AI_GATEWAY_ACCOUNT_ID;delete environment.AI_GATEWAY_ID;delete environment.VERTEX_PROJECT_ID;delete environment.VERTEX_REGION;
    const accepted=await start();await process();expect(currentRun().status).toBe('submitted');
    expect(vi.mocked(createGeminiBatch).mock.calls[0][4]).toMatchObject({operationId:accepted.creditOperationId,namespace:'queue'});
    const old=new Date(Date.now()-21*60_000).toISOString();
    database.sql.prepare("UPDATE wine_champagne_extractions SET updated_at=? WHERE wine_id='member-wine'").run(old);
    const before=delivered.length;expect((await request(path())).status).toBe(200);
    expect(delivered.length).toBeGreaterThan(before);expect(delivered.at(-1)!._creditOperationId).toBe(accepted.creditOperationId);
    vi.mocked(fetchGeminiBatch).mockResolvedValueOnce({ok:false,status:503,error:'Temporary status failure'});
    const poll=delivered.at(-1)!,failed=await process(poll);expect(failed.retry).toHaveBeenCalled();expect(currentRun().status).toBe('submitted');
    expect(operation(accepted.creditOperationId).status).toBe('running');
    vi.mocked(fetchGeminiBatch).mockResolvedValue({ok:true,state:'JOB_STATE_SUCCEEDED',payload:{},responses:[{metadata:{key:accepted.run.requestId},response:reply()}]});
    await process(poll);expect(operation(accepted.creditOperationId).status).toBe('complete');
    expect(createGeminiBatch).toHaveBeenCalledTimes(1);expect(provider).not.toHaveBeenCalled();
    expect(vi.mocked(fetchGeminiBatch).mock.calls[0][3]).toMatchObject({operationId:accepted.creditOperationId});
  });

  it('lets cleanup survive settlement and account suspension without permitting AI work',async()=>{
    const accepted=await start();await process();
    const cleanupRow=database.sql.prepare("SELECT operation_id,body_json FROM queue_outbox WHERE json_extract(body_json,'$.cleanup')=1").get()!;
    expect(cleanupRow.operation_id).toBeNull();const cleanup=JSON.parse(String(cleanupRow.body_json)) as Job;
    expect(cleanup._creditOperationId).toBeUndefined();
    objects.set(`champagne-extraction/${accepted.run.requestId}.json`,'leftover');
    database.sql.prepare("UPDATE app_users SET status='suspended' WHERE id='member'").run();
    const result=await process(cleanup);expect(result.ack).toHaveBeenCalled();expect(result.retry).not.toHaveBeenCalled();
    expect(objects.size).toBe(0);expect(provider).toHaveBeenCalledTimes(1);
    expect(isQueueCleanup({kind:'wine',cleanup:true})).toBe(false);
    await expect(durableQueue(environment.RESEARCH_QUEUE,database.db).send({kind:'wine',owner:'owner',cleanup:true,requestId:'unfunded'})).rejects.toThrow('credit reservation');
    await expect(durableQueue(environment.RESEARCH_QUEUE,database.db).send({kind:'champagne_extraction',owner:'owner',requestId:'unfunded'})).rejects.toThrow('credit reservation');
  });

  it('recovers lost operation-free cleanup deliveries during maintenance',async()=>{
    const accepted=await start();await process();
    database.sql.prepare("UPDATE queue_outbox SET sent_at=?,due_at=? WHERE json_extract(body_json,'$.cleanup')=1").run(seconds()-90_000,seconds()-90_000);
    await maintainJobs(database.db,environment.RESEARCH_QUEUE);
    expect(delivered.some(job=>job.cleanup&&job.requestId===accepted.run.requestId)).toBe(true);
  });

  it.each(['deleted','stale'] as const)('releases an abandoned %s run without another provider call',async(mode)=>{
    allowance();const accepted=await start();
    if(mode==='deleted')database.sql.prepare("DELETE FROM wines WHERE id='member-wine'").run();
    else database.sql.prepare("UPDATE wine_champagne_extractions SET updated_at=? WHERE wine_id='member-wine'").run(new Date(Date.now()-16*60_000).toISOString());
    await reconcileOperation(database.db,operation(accepted.creditOperationId));
    expect(operation(accepted.creditOperationId).status).toBe('failed');
    expect(await memberAiActionAccess(database.db,'member','champagne_extraction')).toMatchObject({used:0,pending:0,remaining:1});
    expect(provider).not.toHaveBeenCalled();
  });

  it('keeps ambiguous provider completion in review instead of authorizing another paid call',async()=>{
    allowance();provider.mockRejectedValueOnce(new Error('Connection lost after submission'));
    const accepted=await start();await process();
    expect(operation(accepted.creditOperationId).status).toBe('review');
    expect(database.sql.prepare('SELECT state FROM provider_operations WHERE operation_id=?').get(accepted.creditOperationId)!.state).toBe('uncertain');
    expect((await prepare()).quoted.status).toBe(429);
    await process(delivered[0]);expect(provider).toHaveBeenCalledTimes(1);
    expect(operation(accepted.creditOperationId).status).toBe('review');
  });
});
