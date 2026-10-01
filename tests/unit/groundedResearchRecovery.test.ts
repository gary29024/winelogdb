import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { realD1 } from './support/realD1';
import { ensureProducerEntity } from '../../src/lib/producers/entities';
import { createQueuedProducerResearchRun,getProducerResearchRun } from '../../src/lib/producers/research';
import { pollProducerBatchResearch,startProducerBatchResearch } from '../../src/lib/producers/batchResearch';
import { createWineResearchRun,getWineResearchRun } from '../../src/lib/research/backgroundJobs';
import { pollWineBatchResearch,startWineBatchResearch } from '../../src/lib/research/batchWineResearch';
import { buildResearchTargets,loadResearchCache } from '../../src/lib/research/cache';
import { AI_MODELS } from '../../src/lib/ai/policy';
import type { GeminiBatchRequest,GeminiInlineResponse } from '../../src/lib/research/geminiBatch';

let database:ReturnType<typeof realD1>,producerId:string;
const producer='Example Estate',previous=[{name:'Previous wine',category:'red'}];
const profile={homeCountry:'France',homeRegion:'Burgundy',homeLocality:'Morey-Saint-Denis',officialWebsiteUrl:null,instagramUrl:null,contactEmail:null,contactPhone:null,profile:'Example Estate is based in Morey-Saint-Denis.',winemakingPractices:'The estate farms organically; cellar practices vary by cuvée.'};
const range={rangeComplete:true,range:[{name:'Clos A',category:'red',appellation:'Morey-Saint-Denis',classification:null,style:'Still dry red',notes:null}]};
const wineAnswer={summary:'The 2024 Clos A is a red Burgundy.',expectedProfile:'Exact 2024 tasting notes could not be verified.',producerDetails:profile.profile,producerWinemakingPractices:profile.winemakingPractices,terroir:'The vineyard grows on limestone-rich soils.',vintageQuality:'The 2024 growing season in Burgundy was wet.',winemakingTechniques:'For 2024, the wine was aged in barrel for 14 months.',drinkingWindow:'An exact drinking window could not be verified.'};
const prose=(values:Record<string,unknown>)=>Object.entries(values).map(([name,value])=>`## ${name}\n${value==null?'null':String(value)}`).join('\n\n');
function response(key:string,text:string,grounded=true,searches=1):GeminiInlineResponse{
  return {metadata:{key},response:{candidates:[{content:{parts:[{text}]},finishReason:'STOP',groundingMetadata:{
    ...(grounded?{groundingChunks:[{web:{title:'Estate',uri:'https://estate.example/wines'}}],groundingSupports:[{segment:{text:wineAnswer.winemakingTechniques},groundingChunkIndices:[0]}]}:{}),webSearchQueries:Array.from({length:searches},(_,i)=>`query ${i}`)
  }}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:200}}};
}
function nativeProvider(reply:(index:number,keys:string[])=>GeminiInlineResponse[]){
  const submitted:Array<{url:string;entries:GeminiBatchRequest[]}>=[];
  const fetcher=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
    const url=String(input);
    if(url.includes(':batchGenerateContent')){
      const body=JSON.parse(String(init?.body));submitted.push({url,entries:body.batch.input_config.requests.requests.map((entry:{request:Record<string,unknown>;metadata:{key:string}})=>({key:entry.metadata.key,request:entry.request}))});
      return Response.json({name:`batches/test-${submitted.length-1}`});
    }
    const index=Number(url.match(/batches\/test-(\d+)/)?.[1]);
    return Response.json({state:'JOB_STATE_SUCCEEDED',dest:{inlinedResponses:reply(index,submitted[index].entries.map(entry=>entry.key))}});
  });
  vi.stubGlobal('fetch',fetcher);return {fetcher,submitted};
}
function environment(){const send=vi.fn();return {send,env:{DB:database.db,GEMINI_API_KEY:'key',WINE_IMAGES:{} as R2Bucket,RESEARCH_QUEUE:{send} as unknown as Queue<unknown>}}}
async function driveProducer(runId:string,flow:ReturnType<typeof environment>){
  await createQueuedProducerResearchRun(database.db,'owner',producerId,runId);
  await startProducerBatchResearch(flow.env,'owner',producerId,runId);
  for(let i=0;i<flow.send.mock.calls.length&&i<10;i++)await pollProducerBatchResearch(flow.env,'owner',producerId,runId,flow.send.mock.calls[i][0].jobId,0);
  return getProducerResearchRun(database.db,'owner',producerId,runId);
}
beforeEach(async()=>{
  database=realD1();producerId=(await ensureProducerEntity(database.db,'owner',producer)).id;
  database.sql.prepare('UPDATE producers SET home_country=?,catalog_json=? WHERE id=?').run('France',JSON.stringify(previous),producerId);
  database.sql.prepare('INSERT INTO wines(id,owner_id,producer,producer_id,wine_name,vintage,country,region,appellation,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('wine1','owner',producer,producerId,'Clos A',2024,'France','Burgundy','Morey-Saint-Denis','now','now');
  vi.spyOn(console,'log').mockImplementation(()=>{});vi.spyOn(console,'warn').mockImplementation(()=>{});vi.spyOn(console,'error').mockImplementation(()=>{});
});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();database.close()});

describe('paid research failure recovery',()=>{
  it('saves cited wine prose with direct technical evidence in a single request',async()=>{
    const provider=nativeProvider((_index,keys)=>keys.map(key=>response(key,prose(wineAnswer))));
    const flow=environment();await createWineResearchRun(database.db,'owner','wine1','none','wine-success');
    expect(await startWineBatchResearch(flow.env,'owner','wine1','wine-success','none')).toMatchObject({ok:true});
    await pollWineBatchResearch(flow.env,'owner','wine1','wine-success',flow.send.mock.calls[0][0].jobId,0);
    expect(await getWineResearchRun(database.db,'owner','wine1','wine-success')).toMatchObject({status:'complete',attempt:1});
    const stored=JSON.parse(String(database.sql.prepare("SELECT deep_search_json FROM wines WHERE id='wine1'").get()!.deep_search_json));
    expect(stored.winemakingTechniques).toBe(wineAnswer.winemakingTechniques);expect(stored.provenance.fields.winemakingTechniques.supportedCount).toBe(1);
    expect(provider.submitted).toHaveLength(1);expect(provider.submitted[0].entries[0].request.generationConfig).toMatchObject({thinkingConfig:{thinkingLevel:'low'}});
  });

  it('keeps and reports a saved profile when the catalogue has no sources on either model',async()=>{
    const provider=nativeProvider((_index,keys)=>keys.map(key=>response(key,key==='profile'?prose(profile):JSON.stringify(range),key==='profile',3)));
    const run=await driveProducer('partial-profile',environment());
    expect(run).toMatchObject({status:'failed',attempt:2});expect(run!.message).toMatch(/^Producer profile and practices saved\./);
    const row=database.sql.prepare('SELECT profile,winemaking_practices,catalog_json FROM producers WHERE id=?').get(producerId)!;
    expect(row.profile).toBe(profile.profile);expect(row.winemaking_practices).toBe(profile.winemakingPractices);expect(JSON.parse(String(row.catalog_json))).toEqual(previous);
    expect((await loadResearchCache(database.db,'owner',buildResearchTargets({producer,producerId}))).get('producer')?.payload.producerDetails).toBe(profile.profile);
    expect(provider.submitted.map(item=>item.entries.map(entry=>entry.key))).toEqual([['profile','catalog_slice_a_z_other'],['catalog_slice_a_z_other']]);
    expect(JSON.stringify(provider.submitted[1].entries)).toContain('no grounded web sources');
  });

  it('stops after two source-free replies and blocks further wine and producer spend during cooldown',async()=>{
    const provider=nativeProvider((_index,keys)=>keys.map(key=>response(key,key==='profile'?JSON.stringify(profile):JSON.stringify(range),false,2)));
    expect(await driveProducer('producer-no-evidence',environment())).toMatchObject({status:'failed',attempt:2});
    expect(provider.submitted).toHaveLength(2);
    const models=database.sql.prepare('SELECT model,grounding_failed_at FROM research_model_health WHERE grounding_failed_at IS NOT NULL').all();
    expect(models.map(row=>row.model).sort()).toEqual([AI_MODELS.groundedResearchPrimary,AI_MODELS.groundedResearchFallback].sort());
    const other=(await ensureProducerEntity(database.db,'owner','Other Estate')).id,flow=environment();
    await createQueuedProducerResearchRun(database.db,'owner',other,'other-producer');
    expect(await startProducerBatchResearch(flow.env,'owner',other,'other-producer')).toMatchObject({ok:false,error:expect.stringContaining('avoid further charges')});
    await createWineResearchRun(database.db,'owner','wine1','none','wine-cooldown');
    expect(await startWineBatchResearch(flow.env,'owner','wine1','wine-cooldown','none')).toMatchObject({ok:false,error:expect.stringContaining('avoid further charges')});
    expect(provider.submitted).toHaveLength(2);expect(flow.send).not.toHaveBeenCalled();
  });

  it('does not repeat profile fallback indefinitely after the wine range was committed',async()=>{
    const provider=nativeProvider((_index,keys)=>keys.map(key=>response(key,JSON.stringify(key==='profile'?{...profile,profile:''}:range))));
    const run=await driveProducer('profile-bounded',environment());
    expect(run).toMatchObject({status:'failed',attempt:2});expect(run!.message).toMatch(/^Wine range saved\./);
    expect(provider.submitted).toHaveLength(2);expect(provider.submitted[1].entries.map(entry=>entry.key)).toEqual(['profile']);
    expect(JSON.stringify(provider.submitted[1].entries)).toContain('required field was empty');
    expect(JSON.parse(String(database.sql.prepare('SELECT catalog_json FROM producers WHERE id=?').get(producerId)!.catalog_json))).toMatchObject(range.range);
  });

  it('stops additional requests after an over-budget result while keeping the successful profile',async()=>{
    const provider=nativeProvider((_index,keys)=>keys.map(key=>response(key,JSON.stringify(key==='profile'?profile:range),key==='profile',10)));
    const run=await driveProducer('producer-budget',environment());
    expect(run!.message).toContain('20 Google searches');expect(run!.message).toMatch(/^Producer profile and practices saved\./);
    expect(provider.submitted).toHaveLength(1);
  });

  it('never publishes an unfinished range when the next split exceeds the run budget',async()=>{
    const provider=nativeProvider((_index,keys)=>keys.map(key=>response(key,JSON.stringify(key==='profile'?profile:{...range,rangeComplete:false}),true,8)));
    const run=await driveProducer('split-budget',environment());
    expect(run!.message).toContain('incomplete');expect(run!.message).toContain('16 Google searches');
    expect(provider.submitted).toHaveLength(1);
    expect(JSON.parse(String(database.sql.prepare('SELECT catalog_json FROM producers WHERE id=?').get(producerId)!.catalog_json))).toEqual(previous);
  });

  it('does not let an unfinished parent mask a child without grounding',async()=>{
    const provider=nativeProvider((index,keys)=>keys.map(key=>response(key,JSON.stringify(key==='profile'?profile:index===0?{...range,rangeComplete:false}:key==='catalog_slice_a_m'?range:{rangeComplete:true,range:[]}),key!=='catalog_slice_n_z_other')));
    expect(await driveProducer('incomplete-children',environment())).toMatchObject({status:'failed'});
    expect(JSON.parse(String(database.sql.prepare('SELECT catalog_json FROM producers WHERE id=?').get(producerId)!.catalog_json))).toEqual(previous);
    expect(provider.submitted).toHaveLength(2);
  });
});
