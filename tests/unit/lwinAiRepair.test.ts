import { afterEach,describe,expect,it,vi } from 'vitest';
import { aiRepair,deterministicRepair,repairCandidates,LWIN_AI_TIMEOUT_MS,LWIN_AI_LEASE_SECONDS } from '../../worker/multiUser/lwinRepair';
import * as transport from '../../worker/geminiTransport';
import { realD1 } from './support/realD1';
import { processRolloutJob,recoverRollouts,rolloutRoute,rolloutStatus } from '../../worker/multiUser/rollout';
import publicWorker from '../../worker/multiUserEntry';
import { claimDelivery } from '../../worker/multiUser/jobs';
import { lwinReferenceIdentity,producerLookupKeys,referenceShardId,type LwinProducerIndex,type ReferenceManifest } from '../../src/lib/wine/referenceCatalog';
import type { LwinReferenceProduct } from '../../src/lib/wine/lwinImport';

function bucket(rows:LwinReferenceProduct[],reads?:string[]){
 const index:LwinProducerIndex={},indexKey='reference/lwin/versions/v1/producer-index.json';
 const manifest:ReferenceManifest={provider:'lwin',version:'v1',prefix:'reference/lwin/versions/v1',shardCount:256,rows:rows.length,source:'test',sourceUpdatedAt:null,generatedAt:'now',producerIndexKey:indexKey};
 const objects:Record<string,unknown>={'reference/lwin/current.json':manifest,[indexKey]:index};
 for(const row of rows){
  const identity=lwinReferenceIdentity(row),shard=referenceShardId(row.producerKey||identity.producerKey),key=`reference/lwin/versions/v1/shard-${shard}.json`,list=(objects[key] as LwinReferenceProduct[]|undefined)??[];list.push(row);objects[key]=list;
  const lookupKeys=new Set([...producerLookupKeys(row.producerName),...producerLookupKeys(identity.producerName)]);
  for(const lookup of lookupKeys){for(const value of [lookup,...lookup.split(' ').filter(token=>token.length>=4).map(token=>`t:${token}`)]){const shards=index[value]??[];if(!shards.includes(shard))shards.push(shard);index[value]=shards}}
 }
 for(const key of Object.keys(index))if(key.startsWith('t:')&&index[key].length>8)delete index[key];
 return {get:async(key:string)=>{reads?.push(key);return key in objects?{text:async()=>JSON.stringify(objects[key])}:null}} as unknown as R2Bucket;
}
const product=(lwin7:string,producerName:string,wineName:string):LwinReferenceProduct=>({productKey:`lwin:${lwin7}`,lwin7,status:'Live',referenceLwin7:null,displayName:`${producerName}, ${wineName}`,producerTitle:null,producerName,wineName,producerKey:producerName.toLowerCase(),wineKey:wineName.toLowerCase(),country:'France',countryKey:'france',region:'Bordeaux',regionKey:'bordeaux',subRegion:null,site:null,parcel:null,colour:'Red',colourKey:'red',productType:'Wine',productSubtype:'Still',designation:null,classification:null,vintageConfig:'sequential',firstVintage:2000,finalVintage:2026,sourceAddedAt:null,sourceUpdatedAt:null,importedAt:'now'});

describe('LWIN AI response handling',()=>{
 const databases:Array<ReturnType<typeof realD1>>=[];
 afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers();for(const db of databases.splice(0))db.close()});
 function setup(){
  const database=realD1();databases.push(database);
  const wine={id:'w1',owner_id:'owner',producer:'Chateau Margaux',wine_name:'Pavillon',country:'France',region:'Bordeaux',wine_style:'red',release_designation:null};
  const candidates=[{row:product('1000001','Chateau Margaux','Pavillon Rouge'),score:.8}];
  return {database,run:()=>aiRepair({DB:database.db,REFERENCE_DATA:bucket([])},wine,candidates)};
 }
 function setupRollout(){
  const database=realD1();databases.push(database);
  const env={DB:database.db,AUTH_SECRET:'a'.repeat(48),APP_URL:'https://wine.example',
   REFERENCE_DATA:bucket([product('1000001','Chateau Margaux','Pavillon Rouge')]),
   WINE_IMAGES:bucket([]),RESEARCH_QUEUE:{send:vi.fn()} as unknown as Queue<unknown>};
  database.sql.exec(`INSERT INTO wines(id,owner_id,producer,wine_name,country,region,identity_match_status,created_at,updated_at)
   VALUES('w2','owner','Chateau Margaux','Pavillon','France','Bordeaux','unmatched','now','now');
   INSERT INTO rollout_state(name,value) VALUES ('rollout_lwin_ai_job','running'),('lwin_ai_cursor','w1'),('lwin_ai_processed','1'),('lwin_ai_total','2')`);
  return {database,env};
 }
 it.each([
  [504,'error code: 504 ','HTTP 504 Gateway Timeout'],
  [502,'<html>Bad Gateway</html>','HTTP 502'],
  [429,JSON.stringify({error:{message:'Resource exhausted'}}),'HTTP 429'],
  [403,JSON.stringify({error:{message:'Permission denied'}}),'HTTP 403']
 ])('reports HTTP %i without trying to decode the error body',async(status,body,message)=>{
  const response=new Response(body,{status}),json=vi.spyOn(response,'json');
  vi.spyOn(transport,'postGeminiGenerateContent').mockResolvedValue({response,provider:'vertex-ai-gateway'});
  const {run}=setup();
  await expect(run()).rejects.toThrow(message);
  expect(json).not.toHaveBeenCalled();
 });
 it.each(['<html>Unavailable</html>','null'])('reports a malformed successful response (%s) as a retryable failure',async(body)=>{
  vi.spyOn(transport,'postGeminiGenerateContent').mockResolvedValue({response:new Response(body),provider:'vertex-ai-gateway'});
  await expect(setup().run()).rejects.toThrow(/invalid .*response.*retry this wine/);
 });
 it('explains a local timeout and clears its timer',async()=>{
  vi.useFakeTimers();
  const post=vi.spyOn(transport,'postGeminiGenerateContent').mockImplementation(async(_env,_model,_body,signal)=>new Promise((_resolve,reject)=>{
   signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});
  }));
  const assertion=expect(setup().run()).rejects.toThrow('timed out after 11 minutes');
  await vi.advanceTimersByTimeAsync(45_000);
  expect(post.mock.calls[0][3].aborted).toBe(false);
  expect(post.mock.calls[0][5]).toEqual({serviceTier:'flex',serverTimeoutSeconds:600});
  await vi.advanceTimersByTimeAsync(LWIN_AI_TIMEOUT_MS-45_000);await assertion;
  expect(vi.getTimerCount()).toBe(0);
 });
 it('retries a 504 through the queue after backoff without recounting or manually resuming',async()=>{
  vi.useFakeTimers();const {database,env}=setupRollout();
  const post=vi.spyOn(transport,'postGeminiGenerateContent')
   .mockResolvedValueOnce({response:new Response('error code: 504 ',{status:504}),provider:'vertex-ai-gateway'})
   .mockResolvedValueOnce({response:Response.json({candidates:[{content:{parts:[{text:JSON.stringify({lwin7:null,confidence:0})}]}}]}),provider:'vertex-ai-gateway'});
  const retry=vi.fn(),ack=vi.fn(),message={id:'delivery',body:{kind:'admin_rollout',owner:'owner',rollout:'lwin_ai'},attempts:1,ack,retry};
  const deliver=()=>publicWorker.queue({messages:[message]} as never,env as never);
  await deliver();
  expect(retry).toHaveBeenCalledWith({delaySeconds:expect.any(Number)});expect(ack).not.toHaveBeenCalled();
  expect(database.sql.prepare("SELECT done FROM queue_deliveries WHERE id='delivery'").get()?.done).toBe(0);
  expect((await rolloutStatus(database.db)).lwinAi).toMatchObject({state:'running',processed:1,total:2,review:0,error:expect.stringContaining('Retrying automatically (1/2)')});
  expect(database.sql.prepare("SELECT value FROM rollout_state WHERE name='lwin_ai_cursor'").get()?.value).toBe('w1');
  await processRolloutJob(env,'lwin_ai');await recoverRollouts(env);
  expect(post).toHaveBeenCalledTimes(1);
  expect(env.RESEARCH_QUEUE.send).not.toHaveBeenCalled();
  const delay=retry.mock.calls[0][0].delaySeconds;expect(delay).toBeGreaterThanOrEqual(60);expect(delay).toBeLessThan(75);
  await vi.advanceTimersByTimeAsync(delay*1000);await deliver();
  expect(ack).toHaveBeenCalledTimes(1);
  expect(database.sql.prepare("SELECT done FROM queue_deliveries WHERE id='delivery'").get()?.done).toBe(1);
  expect(post).toHaveBeenCalledTimes(2);
  expect(post.mock.calls.map(call=>call[4]?.wine)).toEqual(['w2','w2']);
  expect((await rolloutStatus(database.db)).lwinAi).toMatchObject({state:'running',processed:2,review:1,error:null});
  expect(database.sql.prepare("SELECT value FROM rollout_state WHERE name='lwin_ai_cursor'").get()?.value).toBe('w2');
  expect(database.sql.prepare("SELECT value FROM rollout_state WHERE name='lwin_ai_retry_count'").get()?.value).toBe('0');
 });
 it('bounds automatic retries and lets an explicit resume retry the same checkpoint',async()=>{
  vi.useFakeTimers();const {database,env}=setupRollout();
  const post=vi.spyOn(transport,'postGeminiGenerateContent').mockImplementation(async()=>({response:new Response('busy',{status:429}),provider:'vertex-ai-gateway'}));
  for(const minimumDelay of [60,120]){
   const result=await processRolloutJob(env,'lwin_ai');
   expect(result).toMatchObject({retryAfterSeconds:expect.any(Number)});
   if(!('retryAfterSeconds' in result))throw new Error('Expected retry');
   expect(result.retryAfterSeconds).toBeGreaterThanOrEqual(minimumDelay);
   await vi.advanceTimersByTimeAsync(result.retryAfterSeconds!*1000);
  }
  await expect(processRolloutJob(env,'lwin_ai')).rejects.toThrow('HTTP 429');
  expect(post).toHaveBeenCalledTimes(3);
  expect((await rolloutStatus(database.db)).lwinAi).toMatchObject({state:'paused',processed:1,review:0});
  await recoverRollouts(env);expect(env.RESEARCH_QUEUE.send).not.toHaveBeenCalled();
  await rolloutRoute(new Request('https://wine.example/api/admin/rollout/lwin-ai',{method:'POST'}),env,{id:'owner',email:'owner@example.com',display_name:'Owner',role:'owner',status:'active'});
  expect(database.sql.prepare("SELECT value FROM rollout_state WHERE name='lwin_ai_retry_count'").get()?.value).toBe('0');
  expect(database.sql.prepare("SELECT value FROM rollout_state WHERE name='lwin_ai_cursor'").get()?.value).toBe('w1');
  expect(await processRolloutJob(env,'lwin_ai')).toMatchObject({retryAfterSeconds:expect.any(Number)});
 });
 it('keeps the delivery and rollout leased while a slow Flex result finishes',async()=>{
  vi.useFakeTimers();const {database,env}=setupRollout();
  await claimDelivery(database.db,'slow',LWIN_AI_LEASE_SECONDS);
  const post=vi.spyOn(transport,'postGeminiGenerateContent').mockImplementation(async()=>{
   vi.setSystemTime(Date.now()+620_000);
   expect(await claimDelivery(database.db,'slow',LWIN_AI_LEASE_SECONDS)).toBe(false);
   expect(await processRolloutJob(env,'lwin_ai')).toMatchObject({busy:true});
   await recoverRollouts(env);expect(env.RESEARCH_QUEUE.send).not.toHaveBeenCalled();
   return {response:Response.json({candidates:[{content:{parts:[{text:JSON.stringify({lwin7:'1000001',confidence:.95})}]}}]}),provider:'vertex-ai-gateway'};
  });
  await processRolloutJob(env,'lwin_ai');
  expect(post).toHaveBeenCalledTimes(1);
  expect((await rolloutStatus(database.db)).lwinAi).toMatchObject({processed:2,matched:1,ai:1});
  expect(database.sql.prepare("SELECT lwin7 FROM wines WHERE id='w2'").get()?.lwin7).toBe('1000001');
 });
 it('pauses immediately on permanent errors and respects pause during a transient failure',async()=>{
  const {database,env}=setupRollout();
  const post=vi.spyOn(transport,'postGeminiGenerateContent').mockResolvedValue({response:new Response('forbidden',{status:403}),provider:'vertex-ai-gateway'});
  await expect(processRolloutJob(env,'lwin_ai')).rejects.toThrow('HTTP 403');
  expect((await rolloutStatus(database.db)).lwinAi.state).toBe('paused');
  database.sql.exec("UPDATE rollout_state SET value='running' WHERE name='rollout_lwin_ai_job'");
  post.mockImplementation(async()=>{
   database.sql.exec("UPDATE rollout_state SET value='paused' WHERE name='rollout_lwin_ai_job'");
   return {response:new Response('busy',{status:503}),provider:'vertex-ai-gateway'};
  });
  await expect(processRolloutJob(env,'lwin_ai')).rejects.toThrow('HTTP 503');
  expect((await rolloutStatus(database.db)).lwinAi.state).toBe('paused');
  expect(env.RESEARCH_QUEUE.send).not.toHaveBeenCalled();
 });
 it.each([
  ['1000001',.95,{lwin7:'1000001',confidence:.95,method:'ai'}],
  ['9999999',.99,null],
  ['1000001',.5,null],
  [null,0,null]
 ])('preserves the candidate gate and usage accounting for %s at %s',async(lwin7,confidence,expected)=>{
  const payload={candidates:[{content:{parts:[{text:JSON.stringify({lwin7,confidence})}]}}],usageMetadata:{promptTokenCount:123,candidatesTokenCount:20}};
  vi.spyOn(transport,'postGeminiGenerateContent').mockResolvedValue({response:Response.json(payload),provider:'vertex-ai-gateway'});
  const {run,database}=setup();
  await expect(run()).resolves.toEqual(expected);
  expect(database.sql.prepare("SELECT prompt_tokens,output_tokens FROM ai_usage_events WHERE kind='lwin_backfill'").get()).toMatchObject({prompt_tokens:123,output_tokens:20});
 });
});

describe('AI-assisted LWIN repair candidate gate',()=>{
 it('finds plausible rows across different LWIN shards and deterministically accepts an obvious alias',async()=>{
  const rows=[product('1000001','Chateau Margaux','Margaux'),product('1000002','Domaine Test','Other Wine')];
  const candidates=await repairCandidates(bucket(rows),{id:'w1',owner_id:'owner',producer:'Chateau Margaux',wine_name:'Margaux',country:'France',region:'Bordeaux',wine_style:'red',release_designation:null});
  expect(candidates[0]?.row.lwin7).toBe('1000001');
  expect(deterministicRepair(candidates)).toMatchObject({lwin7:'1000001',method:'deterministic'});
 });
 it('keeps estate and negociant display identities separate even when PRODUCER_NAME is shared',async()=>{
  const base=product('1724273','Castagnier','Placeholder'),domaine={...base,displayName:'Domaine Castagnier, Chambolle-Musigny',producerTitle:'Domaine',wineName:null,wineKey:'',region:'Burgundy',regionKey:'burgundy',subRegion:'Chambolle-Musigny'},maison={...domaine,productKey:'lwin:1724274',lwin7:'1724274',displayName:'Maison Castagnier, Chambolle-Musigny',producerTitle:'Maison'};
  const candidates=await repairCandidates(bucket([domaine,maison]),{id:'w1',owner_id:'owner',producer:'Domaine Castagnier',wine_name:'Chambolle-Musigny',country:'France',region:'Burgundy',wine_style:'red',release_designation:null});
  expect(candidates.map(item=>item.row.lwin7)).toEqual(['1724273']);
  expect(deterministicRepair(candidates)).toMatchObject({lwin7:'1724273',method:'deterministic'});
 });
 it('does not let an unqualified producer name choose between qualified houses',async()=>{
  const base=product('1724273','Castagnier','Placeholder'),domaine={...base,displayName:'Domaine Castagnier, Chambolle-Musigny',producerTitle:'Domaine',wineName:null,wineKey:'',region:'Burgundy',regionKey:'burgundy'},maison={...domaine,productKey:'lwin:1724274',lwin7:'1724274',displayName:'Maison Castagnier, Chambolle-Musigny',producerTitle:'Maison'};
  const candidates=await repairCandidates(bucket([domaine,maison]),{id:'w1',owner_id:'owner',producer:'Castagnier',wine_name:'Chambolle-Musigny',country:'France',region:'Burgundy',wine_style:'red',release_designation:null});
  expect(candidates).toEqual([]);
 });
 it('keeps a qualified user alias when the official display omits the house word',async()=>{
  const rows=[product('1000003','Bollinger','Special Cuvee')];
  const candidates=await repairCandidates(bucket(rows),{id:'w1',owner_id:'owner',producer:'Champagne Bollinger',wine_name:'Special Cuvee',country:'France',region:'Bordeaux',wine_style:'red',release_designation:null});
  expect(candidates[0]?.row.lwin7).toBe('1000003');expect(candidates[0]?.score).toBeGreaterThanOrEqual(.93);
 });
 it('treats Ch. and Chateau as the same house qualifier without AI',async()=>{
  const rows=[product('1000001','Chateau Margaux','Margaux')];
  const candidates=await repairCandidates(bucket(rows),{id:'w1',owner_id:'owner',producer:'Ch. Margaux',wine_name:'Margaux',country:'France',region:'Bordeaux',wine_style:'red',release_designation:null});
  expect(deterministicRepair(candidates)).toMatchObject({lwin7:'1000001',method:'deterministic'});
 });
 it('does not auto-accept a weak or close candidate',async()=>{
  const rows=[product('1000001','Chateau Margaux','Pavillon Rouge'),product('1000002','Chateau Margaux','Pavillon Blanc')];
  const candidates=await repairCandidates(bucket(rows),{id:'w1',owner_id:'owner',producer:'Ch Margaux',wine_name:'Pavillon',country:'France',region:'Bordeaux',wine_style:'red',release_designation:null});
  expect(deterministicRepair(candidates)).toBeNull();
 });
 it('prunes generic producer tokens so candidate lookup stays bounded',async()=>{
  const rows=Array.from({length:64},(_,i)=>product(String(2000000+i),`Chateau Producer ${i}`,`Wine ${i}`));
  rows.push(product('2999999','Chateau Margaux','Margaux'));
  const reads:string[]=[];
  const candidates=await repairCandidates(bucket(rows,reads),{id:'w1',owner_id:'owner',producer:'Chateau Margaux',wine_name:'Margaux',country:'France',region:'Bordeaux',wine_style:'red',release_designation:null});
  expect(candidates[0]?.row.lwin7).toBe('2999999');
  expect(reads.filter(key=>key.includes('/shard-')).length).toBeLessThanOrEqual(8);
 });
});
