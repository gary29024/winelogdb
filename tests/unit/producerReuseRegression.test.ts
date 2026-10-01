import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { realD1 } from './support/realD1';
import { producerEntry } from './support/researchFixture';
import { ensureProducerEntity } from '../../src/lib/producers/entities';
import { assembleDeepSearch,buildResearchTargets,loadResearchCache,loadWineResearchCache,upsertResearchCache,type ResearchScope } from '../../src/lib/research/cache';
import { startWineBatchResearch,pollWineBatchResearch } from '../../src/lib/research/batchWineResearch';
import { createWineResearchRun,getWineResearchRun } from '../../src/lib/research/backgroundJobs';
import { plannedUnits } from '../../worker/multiUser/credits';

let database:ReturnType<typeof realD1>,producerId:string;
const producer='Domaine Dujac',stamp='2026-09-20T00:00:00.000Z';
const subject=(name='Clos de la Roche')=>({producer,producerId,wineName:name,vintage:2020,country:'France',region:'Burgundy',appellation:name,wineStyle:'red'});
const targets=(name?:string)=>buildResearchTargets(subject(name));
const request=(id='other')=>new Request(`https://wine.example/api/wines/${id}/deep-search`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
const sources=[{title:'Estate',url:'https://dujac.example/wines'}];
function addWine(id:string,name='Clos de la Roche'){
 database.sql.prepare('INSERT INTO wines(id,owner_id,producer,producer_id,wine_name,vintage,country,region,appellation,wine_style,created_at,updated_at) VALUES(?,?,?,?,?,2020,?,?,?,?,?,?)')
  .run(id,'owner',producer,producerId,name,'France','Burgundy',name,'red',stamp,stamp);
}
async function seedAll(){
 const payloads:Record<ResearchScope,Record<string,string>>={
  producer:producerEntry(targets()[0]).payload,terroir:{terroir:'The vineyard has limestone soils.'},
  vintage_context:{vintageQuality:'The 2020 growing season was warm.'},
  wine_vintage:{summary:'This is the estate’s 2020 Clos de la Roche.',expectedProfile:'Citrus and mineral notes were reported in 2020.',winemakingTechniques:'Exact 2020 vinification could not be verified.',drinkingWindow:'Development in the cellar is expected.'}
 };
 for(const target of targets())await upsertResearchCache(database.db,'owner',{target,payload:payloads[target.scope],sources,model:'original',researchedAt:stamp});
 return assembleDeepSearch(await loadResearchCache(database.db,'owner',targets()),targets());
}
beforeEach(async()=>{
 database=realD1();producerId=(await ensureProducerEntity(database.db,'owner',producer)).id;
 addWine('first');addWine('other','Morey-Saint-Denis');
 vi.spyOn(console,'log').mockImplementation(()=>{});vi.spyOn(console,'warn').mockImplementation(()=>{});
});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();database.close()});

describe('producer research reused by another wine',()=>{
 it('never overwrites a sourced scope from an older producer row with no sources',async()=>{
  const entry=producerEntry(targets()[0]);await upsertResearchCache(database.db,'owner',entry);
  database.sql.prepare('UPDATE producers SET profile=?,winemaking_practices=?,sources_json=? WHERE id=?').run(entry.payload.producerDetails,entry.payload.producerWinemakingPractices,'[]',producerId);
  const send=vi.fn(),fetcher=vi.fn<(input:RequestInfo|URL,init?:RequestInit)=>Promise<Response>>(async()=>new Response(JSON.stringify({name:'batches/other'})));vi.stubGlobal('fetch',fetcher);
  await createWineResearchRun(database.db,'owner','other','none','reuse-producer-1');
  await startWineBatchResearch({DB:database.db,GEMINI_API_KEY:'key',RESEARCH_QUEUE:{send} as unknown as Queue<unknown>},'owner','other','reuse-producer-1','none');
  const cached=(await loadResearchCache(database.db,'owner',targets('Morey-Saint-Denis'))).get('producer')!;
  expect(cached.payload).toEqual(entry.payload);expect(cached.sources).toEqual(entry.sources);
  const body=JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
  const prompt=body.batch.input_config.requests.requests[0].request.contents[0].parts[0].text;
  expect(prompt.split('Missing scopes:')[1].split('Scope boundaries')[0]).not.toContain('producer profile and general practices ->');
 });

 it('uses a producer run’s stored profile at quote and view time before any wine search',async()=>{
  const entry=producerEntry(targets()[0]);
  database.sql.prepare('UPDATE producers SET profile=?,winemaking_practices=?,sources_json=?,research_model=?,profile_researched_at=? WHERE id=?')
   .run(entry.payload.producerDetails,entry.payload.producerWinemakingPractices,JSON.stringify(entry.sources),entry.model,stamp,producerId);
  expect((await plannedUnits(request(),database.db,'owner')).map(unit=>unit.scope)).toEqual(['terroir','vintage_context','wine_vintage']);
  expect((await loadWineResearchCache(database.db,'owner',targets('Morey-Saint-Denis'))).get('producer')).toMatchObject({payload:entry.payload,researchedAt:stamp});
 });
 it('copies the wine’s general producer evidence without marking the expanded producer profile freshly researched',async()=>{
  const result=await seedAll();database.sql.exec('DELETE FROM research_cache');
  database.sql.prepare('UPDATE producers SET home_country=? WHERE id=?').run('France',producerId);
  const send=vi.fn();vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>String(input).includes(':batchGenerateContent')
   ?new Response(JSON.stringify({name:'batches/producer-evidence'}))
   :new Response(JSON.stringify({state:'JOB_STATE_SUCCEEDED',dest:{inlinedResponses:[{metadata:{key:'wine-research'},response:{candidates:[{content:{parts:[{text:JSON.stringify(result)}]},finishReason:'STOP',groundingMetadata:{groundingChunks:[{web:{title:'Estate',uri:sources[0].url}}]}}]}}]}}))));
  await createWineResearchRun(database.db,'owner','first','none','producer-evidence-1');
  const env={DB:database.db,GEMINI_API_KEY:'key',RESEARCH_QUEUE:{send} as unknown as Queue<unknown>};
  expect(await startWineBatchResearch(env,'owner','first','producer-evidence-1','none')).toMatchObject({ok:true,cached:false});
  await pollWineBatchResearch(env,'owner','first','producer-evidence-1',send.mock.calls[0][0].jobId,0);
  const stored=database.sql.prepare('SELECT profile,winemaking_practices,sources_json,profile_researched_at FROM producers WHERE id=?').get(producerId)!;
  expect(stored.profile).toBe(producerEntry(targets()[0]).payload.producerDetails);
  expect(JSON.parse(String(stored.sources_json))).toEqual(sources);expect(stored.profile_researched_at).toBeNull();
 });

 it('recovers evidence already lost by the old producer overwrite from an identical saved report',async()=>{
  const snapshot=await seedAll(),entry=producerEntry(targets()[0]);
  database.sql.prepare('UPDATE wines SET deep_search_json=?,deep_search_updated_at=? WHERE id=?').run(JSON.stringify(snapshot),stamp,'first');
  database.sql.prepare('UPDATE producers SET profile=?,winemaking_practices=?,sources_json=? WHERE id=?').run(entry.payload.producerDetails,entry.payload.producerWinemakingPractices,'[]',producerId);
  database.sql.exec("UPDATE research_cache SET sources_json='[]' WHERE scope='producer'");
  expect((await loadWineResearchCache(database.db,'owner',targets('Morey-Saint-Denis'))).get('producer')?.sources).toEqual(sources);
  const send=vi.fn();vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({name:'batches/repair'}))));
  await createWineResearchRun(database.db,'owner','other','none','repair-producer-1');
  await startWineBatchResearch({DB:database.db,GEMINI_API_KEY:'key',RESEARCH_QUEUE:{send} as unknown as Queue<unknown>},'owner','other','repair-producer-1','none');
  expect((await loadResearchCache(database.db,'owner',targets())).get('producer')?.sources).toEqual(sources);
 });

 it('keeps every saved scope visible when an explicit full refresh fails',async()=>{
  const original=await seedAll(),send=vi.fn();let creates=0;
  const ungrounded={...original,producerDetails:'No producer details verified.',producerWinemakingPractices:'No practices verified.'};
  vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>String(input).includes(':batchGenerateContent')
   ?new Response(JSON.stringify({name:`batches/refresh-${++creates}`}))
   :new Response(JSON.stringify({state:'JOB_STATE_SUCCEEDED',dest:{inlinedResponses:[{metadata:{key:'wine-research'},response:{candidates:[{content:{parts:[{text:JSON.stringify(ungrounded)}]},finishReason:'STOP'}]}}]}}))));
  await createWineResearchRun(database.db,'owner','first','all','failed-refresh-1');
  const env={DB:database.db,GEMINI_API_KEY:'key',RESEARCH_QUEUE:{send} as unknown as Queue<unknown>};
  await startWineBatchResearch(env,'owner','first','failed-refresh-1','all');
  expect((await loadResearchCache(database.db,'owner',targets())).size).toBe(4);
  for(let i=0;i<2;i++){
   const job=send.mock.calls[i][0] as {jobId:string};
   await pollWineBatchResearch(env,'owner','first','failed-refresh-1',job.jobId,0);
  }
  expect(await getWineResearchRun(database.db,'owner','first','failed-refresh-1')).toMatchObject({status:'failed'});
  expect(creates).toBe(2);
  expect(assembleDeepSearch(await loadResearchCache(database.db,'owner',targets()),targets())).toEqual(original);
 });
});
