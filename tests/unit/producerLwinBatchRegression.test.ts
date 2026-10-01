import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { realD1 } from './support/realD1';
import { ensureProducerEntity } from '../../src/lib/producers/entities';
import { lwinCatalog,lwinRangeFirst,producerLwinReferences } from '../../src/lib/producers/lwinRange';
import layered from '../../worker/layered';
import { createSession } from '../../src/lib/auth/session';
import { parseLwinReference,type LwinReferenceProduct } from '../../src/lib/wine/lwinImport';
import { COMBINED_PRODUCER_KEY,pollProducerBatchResearch,startProducerBatchResearch } from '../../src/lib/producers/batchResearch';
import { createQueuedProducerResearchRun,getProducerResearchRun } from '../../src/lib/producers/research';
import { advanceCampaign,countUnresearchedProducers,createCampaign,measuredSearchesPerRequest,plannedGeminiRequests,unresearchedProducers } from '../../src/lib/producers/researchCampaign';
import worker from '../../worker/multiUserEntry';
import { loadResearchCache,buildResearchTargets } from '../../src/lib/research/cache';
import { durableProvider,providerNeedsReconciliation } from '../../src/lib/credits/provider';
import { configureGeminiBatchGateway,clearGeminiBatchGateway,ResearchPersistenceError } from '../../src/lib/research/geminiBatch';
import { quote,reserve,reconcileOperation,plannedUnits,releaseHeldOperation,type CreditOperation } from '../../worker/multiUser/credits';
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
 it('shows a linked producer\'s LWIN range first and searches only the profile until asked to verify',async()=>{
  const reference=bucket([row(),row('1234568','Morey-Saint-Denis')]),[linked]=await producerLwinReferences(database.db,'owner',producerId,reference);
  database.sql.prepare("INSERT INTO wines(id,owner_id,producer,producer_id,wine_name,vintage,lwin7,identity_match_status,lwin_reference_json,created_at,updated_at) VALUES('w1','owner',?,?,'Clos de la Roche',2019,?,'matched',?,'now','now')")
   .run(producer,producerId,linked.lwin7,JSON.stringify(linked));
  expect(await lwinRangeFirst(database.db,'owner',producerId)).toBe(true);
  const response=await layered.fetch(new Request(`https://wine.example/api/producers/${producerId}`,{headers:{Authorization:`Bearer ${await createSession('owner','secret')}`}}),
   {DB:database.db,REFERENCE_DATA:reference,AUTH_SECRET:'secret'} as never,{waitUntil:()=>undefined,passThroughOnException:()=>undefined} as never);
  const detail=await response.json() as {catalogSource:string;catalog:{name:string;category:string}[]};
  expect(detail.catalogSource).toBe('lwin');
  expect(detail.catalog.map(wine=>wine.name)).toEqual(['Clos de la Roche','Morey-Saint-Denis']);
  const fetcher=vi.fn<(input:RequestInfo|URL,init?:RequestInit)=>Promise<Response>>(async()=>new Response(JSON.stringify({name:'batches/lwin-first'})));vi.stubGlobal('fetch',fetcher);
  const keys=(call:number)=>(JSON.parse(String(fetcher.mock.calls[call][1]?.body)).batch.input_config.requests.requests as {metadata:{key:string}}[]).map(request=>request.metadata.key);
  await createQueuedProducerResearchRun(database.db,'owner',producerId,requestId);
  await startProducerBatchResearch(researchEnv(vi.fn(),reference),'owner',producerId,requestId);
  expect(keys(0)).toEqual(['profile']);
  const verify='22222222-2222-4333-8444-555555555555';
  await createQueuedProducerResearchRun(database.db,'owner',producerId,verify);
  await startProducerBatchResearch(researchEnv(vi.fn(),reference),'owner',producerId,verify,false,true);
  expect(keys(1)).toHaveLength(1);expect(keys(1)[0]).toMatch(/^catalog_slice_/);
  database.sql.prepare('UPDATE producers SET catalog_json=? WHERE id=?').run(JSON.stringify(complete.range),producerId);
  expect(await lwinRangeFirst(database.db,'owner',producerId)).toBe(false);
 });
 it('plans one request for a producer shown from LWIN and stops picking it once its profile exists',async()=>{
  const [linked]=await producerLwinReferences(database.db,'owner',producerId,bucket());
  database.sql.prepare("INSERT INTO wines(id,owner_id,producer,producer_id,wine_name,vintage,lwin7,identity_match_status,lwin_reference_json,created_at,updated_at) VALUES('w1','owner',?,?,'Clos de la Roche',2019,?,'matched',?,'now','now')")
   .run(producer,producerId,linked.lwin7,JSON.stringify(linked));
  const other=(await ensureProducerEntity(database.db,'owner','Domaine Ponsot')).id;
  expect((await unresearchedProducers(database.db,'owner',10)).map(p=>p.id).sort()).toEqual([producerId,other].sort());
  expect(await plannedGeminiRequests(database.db,'owner',10)).toBe(3);
  database.sql.prepare('UPDATE producers SET profile_researched_at=? WHERE id=?').run('2026-10-01T00:00:00.000Z',producerId);
  expect((await unresearchedProducers(database.db,'owner',10)).map(p=>p.id)).toEqual([other]);
  expect(await plannedGeminiRequests(database.db,'owner',10)).toBe(2);
 });
 it('still searches the range when the only linked wine is one LWIN records as long ended',async()=>{
  const [linked]=await producerLwinReferences(database.db,'owner',producerId,bucket());
  database.sql.prepare("INSERT INTO wines(id,owner_id,producer,producer_id,wine_name,vintage,lwin7,identity_match_status,lwin_reference_json,created_at,updated_at) VALUES('w1','owner',?,?,'Clos de la Roche',1990,?,'matched',?,'now','now')")
   .run(producer,producerId,linked.lwin7,JSON.stringify({...linked,finalVintage:1995}));
  expect(await lwinRangeFirst(database.db,'owner',producerId)).toBe(false);
  database.sql.prepare('UPDATE producers SET profile_researched_at=? WHERE id=?').run('2026-10-01T00:00:00.000Z',producerId);
  expect((await unresearchedProducers(database.db,'owner',10)).map(p=>p.id)).toEqual([producerId]);
 });
 it('builds the unverified LWIN range without ended or duplicate wines',async()=>{
  const references=await producerLwinReferences(database.db,'owner',producerId,bucket([row(),row('1234568','Morey-Saint-Denis'),row('1234569','Gevrey-Chambertin')]));
  const ended=references.map(reference=>reference.wineName==='Gevrey-Chambertin'?{...reference,finalVintage:2001}:reference);
  const range=lwinCatalog([...ended,{...ended[0],lwin7:'1234570'}],new Date('2026-10-01'));
  expect(range.map(wine=>[wine.name,wine.category,wine.appellation])).toEqual([['Clos de la Roche','red','Clos de la Roche'],['Morey-Saint-Denis','red','Morey-Saint-Denis']]);
  expect(range.every(wine=>wine.lwinReference?.lwin7)).toBe(true);
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
 it('retries a combined answer that ran out of room as separate profile and range requests',async()=>{
  const send=vi.fn();let batches=0;
  const fetcher=vi.fn<(input:RequestInfo|URL,init?:RequestInit)=>Promise<Response>>(async input=>{
   if(String(input).includes(':batchGenerateContent'))return new Response(JSON.stringify({name:`batches/overflow-${++batches}`}));
   const overflow=grounded(complete);overflow.candidates[0].finishReason='MAX_TOKENS';
   return new Response(JSON.stringify({state:'JOB_STATE_SUCCEEDED',dest:{inlinedResponses:[{metadata:{key:COMBINED_PRODUCER_KEY},response:overflow}]}}));
  });
  vi.stubGlobal('fetch',fetcher);await createQueuedProducerResearchRun(database.db,'owner',producerId,requestId);
  const env=researchEnv(send);await startProducerBatchResearch(env,'owner',producerId,requestId);
  await pollProducerBatchResearch(env,'owner',producerId,requestId,send.mock.calls[0][0].jobId,0);
  const submitted=fetcher.mock.calls.filter(call=>String(call[0]).includes(':batchGenerateContent'))
   .map(call=>(JSON.parse(String(call[1]?.body)).batch.input_config.requests.requests as {metadata:{key:string}}[]).map(request=>request.metadata.key));
  expect(submitted[0]).toEqual([COMBINED_PRODUCER_KEY]);
  expect(submitted[1]).toHaveLength(2);expect(submitted[1]).toContain('profile');expect(submitted[1]).not.toContain(COMBINED_PRODUCER_KEY);
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
 it('lets the owner release a held batch: saved work is charged, the rest stops and can run again',async()=>{
  const second=(await ensureProducerEntity(database.db,'owner','Other Estate')).id;
  database.sql.prepare('UPDATE producers SET home_country=? WHERE id=?').run('France',second);
  const op=await operation(producerRequest('/api/producers/research-batch',{limit:25}));
  const campaign=await createCampaign(researchEnv(),'owner',await unresearchedProducers(database.db,'owner',25));
  database.sql.prepare("UPDATE credit_operations SET run_id=?,status='review' WHERE id=?").run(campaign,op.id);
  database.sql.prepare("UPDATE producer_research_campaign_items SET status=CASE producer_id WHEN ? THEN 'complete' ELSE 'running' END WHERE campaign_id=?").run(second,campaign);
  await expect(durableProvider({db:database.db,operationId:op.id,namespace:`queue:producer:${producerId}`},'first',async()=>{throw new Error('Connection lost')})).rejects.toThrow();
  await expect(operation(producerRequest('/api/producers/research-batch',{limit:25}))).rejects.toMatchObject({status:409});
  const result=await releaseHeldOperation(database.db,op.id);
  const units=JSON.parse(String(database.sql.prepare('SELECT units_json FROM credit_operations WHERE id=?').get(op.id)!.units_json)) as {targetId:string;credits:number}[];
  expect(result.captured).toBe(units.filter(unit=>unit.targetId===second).reduce((sum,unit)=>sum+unit.credits,0));
  expect(database.sql.prepare('SELECT status FROM credit_operations WHERE id=?').get(op.id)!.status).toBe('complete');
  expect(database.sql.prepare('SELECT status FROM producer_research_campaigns WHERE id=?').get(campaign)!.status).toBe('cancelled');
  expect(database.sql.prepare('SELECT status FROM producer_research_campaign_items WHERE producer_id=?').get(producerId)!.status).toBe('failed');
  expect(database.sql.prepare('SELECT count(*) AS n FROM research_work WHERE operation_id=?').get(op.id)!.n).toBe(0);
  // The receipt stays for investigation, but no longer holds new work.
  expect(database.sql.prepare("SELECT state FROM provider_operations WHERE operation_id=?").get(op.id)!.state).toBe('uncertain');
  await expect(operation(producerRequest('/api/producers/research-batch',{limit:25}))).resolves.toMatchObject({status:'reserved'});
  await expect(releaseHeldOperation(database.db,op.id)).rejects.toMatchObject({status:409});
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
