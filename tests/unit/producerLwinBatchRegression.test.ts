import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { realD1 } from './support/realD1';
import { ensureProducerEntity } from '../../src/lib/producers/entities';
import { producerLwinReferences } from '../../src/lib/producers/lwinRange';
import { parseLwinReference,type LwinReferenceProduct } from '../../src/lib/wine/lwinImport';
import { COMBINED_PRODUCER_KEY,pollProducerBatchResearch,startProducerBatchResearch } from '../../src/lib/producers/batchResearch';
import { createQueuedProducerResearchRun,getProducerResearchRun } from '../../src/lib/producers/research';
import { advanceCampaign,countUnresearchedProducers,createCampaign,measuredSearchesPerRequest,unresearchedProducers } from '../../src/lib/producers/researchCampaign';
import worker from '../../worker/multiUserEntry';
import { loadResearchCache,buildResearchTargets } from '../../src/lib/research/cache';
import { durableProvider,providerNeedsReconciliation } from '../../src/lib/credits/provider';
import { configureGeminiBatchGateway,clearGeminiBatchGateway,ResearchPersistenceError } from '../../src/lib/research/geminiBatch';
import { quote,reserve,reconcileOperation,plannedUnits,type CreditOperation } from '../../worker/multiUser/credits';
import { maintainOperation } from '../../worker/multiUser/jobs';
import { stamp,type Member } from '../../worker/multiUser/common';

let database:ReturnType<typeof realD1>,producerId:string;
const member:Member={id:'owner',role:'owner',email:'owner@example.com',display_name:'Owner',status:'active'};
const producer='Domaine Dujac',requestId='11111111-2222-4333-8444-555555555555';
const profile={homeCountry:'France',homeRegion:'Burgundy',homeLocality:'Morey-Saint-Denis',officialWebsiteUrl:null,instagramUrl:null,contactEmail:null,contactPhone:null,
 profile:'Domaine Dujac is an estate based in Morey-Saint-Denis.',winemakingPractices:'The estate farms its vineyards biodynamically. Cellar practices vary by cuvée.'};
const complete={...profile,rangeComplete:true,range:[{name:'Clos de la Roche',category:'red',appellation:'Clos de la Roche',classification:'Grand Cru',style:'Still dry red',notes:null}]};
const grounded=(result:unknown)=>({candidates:[{content:{parts:[{text:JSON.stringify(result)}]},finishReason:'STOP',groundingMetadata:{groundingChunks:[{web:{title:'Estate',uri:'https://dujac.example/wines'}}],webSearchQueries:['producer website','producer current range','producer practices']}}]});
const row=(lwin7='1234567',name='Clos de la Roche',title='Domaine'):LwinReferenceProduct=>parseLwinReference({LWIN:lwin7,STATUS:'Live',DISPLAY_NAME:`${title} Dujac, ${name}`,PRODUCER_TITLE:title,PRODUCER_NAME:'Dujac',WINE:name,COUNTRY:'France',REGION:'Burgundy',SUB_REGION:name,COLOUR:'Red',TYPE:'Wine',SUB_TYPE:'Still',CLASSIFICATION:'Grand Cru'},stamp());
function bucket(rows=[row()]){
 const objects:Record<string,unknown>={
  'reference/lwin/current.json':{provider:'lwin',version:'v1',prefix:'reference/lwin/v1',shardCount:256,producerIndexKey:'reference/lwin/v1/producers.json'},
  'reference/lwin/v1/producers.json':{'dujac':['001'],'domaine dujac':['001']},
  'reference/lwin/v1/shard-001.json':rows
 };
 return {get:vi.fn(async(key:string)=>{if(!key.startsWith('reference/'))throw new Error('Read outside reference prefix');return key in objects?{text:async()=>JSON.stringify(objects[key])}:null})} as unknown as R2Bucket;
}
const producerRequest=(path=`/api/producers/${producerId}/research`,body:Record<string,unknown>={confirmation:'RUN_PRODUCER_RESEARCH'})=>new Request(`https://wine.example${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
async function operation(request=producerRequest()){
 const q=await quote(request,{DB:database.db},member);request.headers.set('X-WineLog-Quote',q.id);request.headers.set('Idempotency-Key',crypto.randomUUID());
 return (await reserve(request,{DB:database.db},member)).operation;
}
const researchEnv=(send=vi.fn(),reference=bucket())=>({DB:database.db,GEMINI_API_KEY:'key',REFERENCE_DATA:reference,WINE_IMAGES:{} as R2Bucket,RESEARCH_QUEUE:{send} as unknown as Queue<unknown>});
beforeEach(async()=>{
 database=realD1();producerId=(await ensureProducerEntity(database.db,'owner',producer)).id;
 database.sql.prepare('UPDATE producers SET home_country=? WHERE id=?').run('France',producerId);
 vi.spyOn(console,'log').mockImplementation(()=>{});vi.spyOn(console,'warn').mockImplementation(()=>{});
});
afterEach(()=>{clearGeminiBatchGateway(undefined);vi.unstubAllGlobals();vi.restoreAllMocks();database.close()});

describe('LWIN-guided producer research',()=>{
 it('loads the imported producer range even when no wines have been logged',async()=>{
  const references=await producerLwinReferences(database.db,'owner',producerId,bucket([row(),row('1234568','Morey-Saint-Denis')]));
  expect(references.map(reference=>reference.wineName)).toEqual(['Clos de la Roche','Morey-Saint-Denis']);
 });
 it('does not blend a domaine and a maison under an ambiguous unqualified name',async()=>{
  database.sql.prepare('UPDATE producers SET canonical_name=? WHERE id=?').run('Dujac',producerId);
  database.sql.prepare('DELETE FROM producer_aliases WHERE producer_id=?').run(producerId);
  expect(await producerLwinReferences(database.db,'owner',producerId,bucket([row(),row('1234568','Maison Wine','Maison')]))).toEqual([]);
 });
 it('can still research when the optional imported catalogue cannot be read',async()=>{
  const unavailable={get:vi.fn(async()=>{throw new Error('R2 temporarily unavailable')})} as unknown as R2Bucket;
  expect(await producerLwinReferences(database.db,'owner',producerId,unavailable)).toEqual([]);
  const fetcher=vi.fn<(input:RequestInfo|URL,init?:RequestInit)=>Promise<Response>>(async()=>new Response(JSON.stringify({name:'batches/no-reference'})));vi.stubGlobal('fetch',fetcher);
  await createQueuedProducerResearchRun(database.db,'owner',producerId,requestId);
  await startProducerBatchResearch(researchEnv(vi.fn(),unavailable),'owner',producerId,requestId);
  expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body)).batch.input_config.requests.requests).toHaveLength(2);
 });
 it('researches a small imported range and profile in one call and saves both scopes',async()=>{
  const send=vi.fn(),fetcher=vi.fn<(input:RequestInfo|URL,init?:RequestInit)=>Promise<Response>>(async input=>String(input).includes(':batchGenerateContent')
   ?new Response(JSON.stringify({name:'batches/combined'}))
   :new Response(JSON.stringify({state:'JOB_STATE_SUCCEEDED',dest:{inlinedResponses:[{metadata:{key:COMBINED_PRODUCER_KEY},response:grounded(complete)}]}})));
  vi.stubGlobal('fetch',fetcher);await createQueuedProducerResearchRun(database.db,'owner',producerId,requestId);
  const env=researchEnv(send);await startProducerBatchResearch(env,'owner',producerId,requestId);
  const submitted=JSON.parse(String(fetcher.mock.calls[0][1]?.body));
  expect(submitted.batch.input_config.requests.requests).toHaveLength(1);
  const prompt=submitted.batch.input_config.requests.requests[0].request.contents[0].parts[0].text;
  expect(prompt).toContain('1234567');expect(prompt).toContain('not proof that a wine is currently produced');
  await pollProducerBatchResearch(env,'owner',producerId,requestId,send.mock.calls[0][0].jobId,0);
  expect(await getProducerResearchRun(database.db,'owner',producerId,requestId)).toMatchObject({status:'complete'});
  const stored=database.sql.prepare('SELECT catalog_json,profile FROM producers WHERE id=?').get(producerId)!;
  expect(JSON.parse(String(stored.catalog_json))).toMatchObject([{name:'Clos de la Roche'}]);expect(stored.profile).toBe(profile.profile);
  expect((await loadResearchCache(database.db,'owner',buildResearchTargets({producer,producerId}))).get('producer')?.payload.producerWinemakingPractices).toBe(profile.winemakingPractices);
  expect(await measuredSearchesPerRequest(database.db,'owner')).toBe(3);
 });
 it.each(['home_country','catalog_json'])('replays the saved result after a %s write fails without buying fallback research',async(field)=>{
  const send=vi.fn(),fetcher=vi.fn<(input:RequestInfo|URL,init?:RequestInit)=>Promise<Response>>(async input=>String(input).includes(':batchGenerateContent')
   ?new Response(JSON.stringify({name:'batches/storage-retry'}))
   :new Response(JSON.stringify({state:'JOB_STATE_SUCCEEDED',dest:{inlinedResponses:[{metadata:{key:COMBINED_PRODUCER_KEY},response:grounded(complete)}]}})));
  vi.stubGlobal('fetch',fetcher);await createQueuedProducerResearchRun(database.db,'owner',producerId,requestId);
  const env=researchEnv(send);await startProducerBatchResearch(env,'owner',producerId,requestId);
  let fail=true;const prepare=database.db.prepare.bind(database.db);
  vi.spyOn(database.db,'prepare').mockImplementation(query=>{
   const result=prepare(query);
   if(query.startsWith(`UPDATE producers SET ${field}=`)){
    const bind=result.bind.bind(result);
    result.bind=(...values:unknown[])=>{
     const bound=bind(...values),run=bound.run.bind(bound);
     bound.run=async<T=unknown>()=>{if(fail){fail=false;throw new Error('D1 temporarily unavailable')}return run<T>()};
     return bound;
    };
   }
   return result;
  });
  const jobId=send.mock.calls[0][0].jobId;
  await expect(pollProducerBatchResearch(env,'owner',producerId,requestId,jobId,0)).rejects.toBeInstanceOf(ResearchPersistenceError);
  expect(await getProducerResearchRun(database.db,'owner',producerId,requestId)).toMatchObject({status:'running',attempt:1});
  await pollProducerBatchResearch(env,'owner',producerId,requestId,jobId,0);
  expect(await getProducerResearchRun(database.db,'owner',producerId,requestId)).toMatchObject({status:'complete',attempt:1});
  expect(fetcher.mock.calls.filter(([url])=>String(url).includes(':batchGenerateContent'))).toHaveLength(1);
  expect(database.sql.prepare('SELECT count(*) AS n FROM research_batch_jobs WHERE request_id=?').get(requestId)!.n).toBe(1);
 });
 it('keeps larger ranges separate and never truncates their identity checklist to logged bottles',async()=>{
  const rows=Array.from({length:41},(_,i)=>row(String(1234567+i),`Wine ${i}`)),send=vi.fn();
  const fetcher=vi.fn<(input:RequestInfo|URL,init?:RequestInit)=>Promise<Response>>(async()=>new Response(JSON.stringify({name:'batches/large'})));vi.stubGlobal('fetch',fetcher);
  await createQueuedProducerResearchRun(database.db,'owner',producerId,requestId);
  await startProducerBatchResearch(researchEnv(send,bucket(rows)),'owner',producerId,requestId);
  const submitted=JSON.parse(String(fetcher.mock.calls[0][1]?.body));
  expect(submitted.batch.input_config.requests.requests).toHaveLength(2);
  expect(submitted.batch.input_config.requests.requests[1].request.contents[0].parts[0].text).toContain('Wine 40');
 });
 it('keeps an initial failed range eligible after a successful profile save',async()=>{
  database.sql.prepare('UPDATE producers SET profile=?,winemaking_practices=?,sources_json=?,researched_at=?,profile_researched_at=? WHERE id=?')
   .run(profile.profile,profile.winemakingPractices,JSON.stringify([{title:'Estate',url:'https://dujac.example/'}]),stamp(),stamp(),producerId);
  await createQueuedProducerResearchRun(database.db,'owner',producerId,requestId);
  database.sql.prepare("UPDATE producer_research_runs SET status='failed' WHERE request_id=?").run(requestId);
  expect(await countUnresearchedProducers(database.db,'owner')).toBe(1);
  expect((await plannedUnits(producerRequest('/api/producers/research-batch',{limit:25}),database.db,'owner')).map(unit=>unit.targetId)).toEqual([producerId]);
 });
});

describe('independent producer holds in one batch',()=>{
 it('assigns independent holds through the actual queue consumer and completes the next producer',async()=>{
  const second=(await ensureProducerEntity(database.db,'owner','Other Estate')).id;
  database.sql.prepare('UPDATE producers SET home_country=? WHERE id=?').run('France',second);
  const op=await operation(producerRequest('/api/producers/research-batch',{limit:25})),send=vi.fn();
  const gateway={DB:database.db,CF_AI_GATEWAY_TOKEN:'test',AI_GATEWAY_ACCOUNT_ID:'test',AI_GATEWAY_ID:'test',VERTEX_PROJECT_ID:'test',VERTEX_REGION:'global'};
  configureGeminiBatchGateway(undefined,gateway);
  const env={...researchEnv(send),...gateway,GEMINI_API_KEY:undefined};
  const campaign=await createCampaign(env,'owner',await unresearchedProducers(database.db,'owner',25));
  database.sql.prepare("UPDATE credit_operations SET run_id=?,status='running' WHERE id=?").run(campaign,op.id);
  const fetcher=vi.fn(async(...args:[RequestInfo|URL,RequestInit?])=>{
   const body=String(args[1]?.body);
   if(body.includes(producer))throw new Error('Connection lost after submission');
   return new Response(JSON.stringify(grounded({...complete,profile:'Other Estate is a wine producer based in Burgundy.'})));
  });vi.stubGlobal('fetch',fetcher);
  const consume=async(job:Record<string,unknown>)=>{
   const ack=vi.fn(),retry=vi.fn();
   await worker.queue({queue:'research',messages:[{id:crypto.randomUUID(),body:{...job,_creditOperationId:op.id},attempts:1,timestamp:new Date(),ack,retry}],ackAll:ack,retryAll:retry,metadata:{}} as never,env as never);
   expect(retry).not.toHaveBeenCalled();expect(ack).toHaveBeenCalledOnce();
  };
  await advanceCampaign(env,'owner',campaign!);
  const initial=send.mock.calls.map(([job])=>job).filter(job=>job.kind==='producer');
  for(const job of initial)await consume(job);
  const polls=send.mock.calls.map(([job])=>job).filter(job=>job.kind==='producer_batch_poll');
  await consume(polls.find(job=>job.producerId===producerId));
  expect(database.sql.prepare('SELECT status FROM credit_operations WHERE id=?').get(op.id)!.status).toBe('review');
  await consume(polls.find(job=>job.producerId===second));
  expect(database.sql.prepare('SELECT status FROM producer_research_runs WHERE producer_id=?').get(producerId)!.status).toBe('failed');
  expect(database.sql.prepare('SELECT status FROM producer_research_runs WHERE producer_id=?').get(second)!.status).toBe('complete');
  const receipts=database.sql.prepare('SELECT namespace,state FROM provider_operations WHERE operation_id=?').all(op.id);
  expect(receipts).toEqual(expect.arrayContaining([{namespace:`queue:producer:${producerId}`,state:'uncertain'},{namespace:`queue:producer:${second}`,state:'saved'}]));
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(database.sql.prepare('SELECT count(*) AS n FROM research_batch_jobs').get()!.n).toBe(2);
 });
 it('continues other producers after a timeout, while fencing the uncertain producer',async()=>{
  const second=(await ensureProducerEntity(database.db,'owner','Other Estate')).id;
  database.sql.prepare('UPDATE producers SET home_country=? WHERE id=?').run('France',second);
  const op=await operation(producerRequest('/api/producers/research-batch',{limit:25}));
  const a={db:database.db,operationId:op.id,namespace:`queue:producer:${producerId}`},b={...a,namespace:`queue:producer:${second}`};
  await expect(durableProvider(a,'first',async()=>{throw new Error('Connection lost')})).rejects.toThrow('Connection lost');
  database.sql.prepare("UPDATE credit_operations SET status='review' WHERE id=?").run(op.id);
  expect(await providerNeedsReconciliation(a)).toBe(true);expect(await providerNeedsReconciliation(b)).toBe(false);
  const send=vi.fn(async()=>new Response('saved'));expect(await (await durableProvider(b,'first',send)).text()).toBe('saved');
  await expect(durableProvider(a,'fallback',send)).rejects.toThrow('needs reconciliation');expect(send).toHaveBeenCalledTimes(1);
  const campaign=await createCampaign(researchEnv(),'owner',await unresearchedProducers(database.db,'owner',25));
  database.sql.prepare('UPDATE credit_operations SET run_id=? WHERE id=?').run(campaign,op.id);
  database.sql.prepare("UPDATE producer_research_campaign_items SET status=CASE WHEN producer_id=? THEN 'failed' ELSE 'complete' END WHERE campaign_id=?").run(producerId,campaign);
  await reconcileOperation(database.db,{...op,status:'review',run_id:campaign});
  const remaining=database.sql.prepare('SELECT subject_key FROM research_work WHERE operation_id=?').all(op.id);
  expect(remaining).toHaveLength(1);expect(String(remaining[0].subject_key)).toContain('dujac');
 });
 it('recovers a late producer receipt without making another provider call',async()=>{
  const op=await operation(),send=vi.fn(),gateway={DB:database.db,CF_AI_GATEWAY_TOKEN:'test',AI_GATEWAY_ACCOUNT_ID:'test',AI_GATEWAY_ID:'test',VERTEX_PROJECT_ID:'test',VERTEX_REGION:'global'};
  configureGeminiBatchGateway(undefined,gateway);
  const env={...researchEnv(send),...gateway,GEMINI_API_KEY:undefined,CREDIT_CONTEXT:{db:database.db,operationId:op.id,namespace:'queue'}};
  await createQueuedProducerResearchRun(database.db,'owner',producerId,requestId);
  database.sql.prepare("UPDATE credit_operations SET status='running',run_id=? WHERE id=?").run(requestId,op.id);
  const fetcher=vi.fn(async()=>{throw new Error('Connection lost after submission')});vi.stubGlobal('fetch',fetcher);
  await startProducerBatchResearch(env,'owner',producerId,requestId);
  const jobId=send.mock.calls[0][0].jobId;
  await pollProducerBatchResearch(env,'owner',producerId,requestId,jobId,0);
  expect(send).toHaveBeenCalledTimes(1);expect(await getProducerResearchRun(database.db,'owner',producerId,requestId)).toMatchObject({status:'failed',attempt:1});
  await reconcileOperation(database.db,{...op,status:'running',run_id:requestId});
  database.sql.prepare("UPDATE provider_operations SET state='saved',response_status=200,response_headers=?,response_body=? WHERE operation_id=?")
   .run(JSON.stringify({'Content-Type':'application/json'}),JSON.stringify(grounded(complete)),op.id);
  const held=await database.db.prepare('SELECT * FROM credit_operations WHERE id=?').bind(op.id).first<CreditOperation>();
  await maintainOperation(database.db,held!);
  expect(database.sql.prepare("SELECT count(*) AS n FROM queue_outbox WHERE id LIKE 'producer-recovery:%'").get()!.n).toBe(1);
  await pollProducerBatchResearch(env,'owner',producerId,requestId,jobId,0);
  expect(await getProducerResearchRun(database.db,'owner',producerId,requestId)).toMatchObject({status:'complete'});
  expect(fetcher).toHaveBeenCalledTimes(1);
 });
});
