import { afterEach,describe,expect,it,vi } from 'vitest';
import { realD1 } from './support/realD1';
import { processRolloutJob,rolloutRoute,rolloutStatus,type RolloutQueueJob } from '../../worker/multiUser/rollout';
import type { Member } from '../../worker/multiUser/common';
import { referenceShardId,type ReferenceManifest } from '../../src/lib/wine/referenceCatalog';
import { parseLwinReference } from '../../src/lib/wine/lwinImport';

const owner:Member={id:'owner',email:'owner@example.com',display_name:'Owner',role:'owner',status:'active'};
const databases:Array<ReturnType<typeof realD1>>=[];

afterEach(()=>{for(const database of databases.splice(0))database.close();vi.restoreAllMocks()});

function setup(objects:Array<{key:string;size:number}>=[],referenceObjects:Record<string,unknown>={}){
 const database=realD1();databases.push(database);
 const sent:RolloutQueueJob[]=[];
 const list=vi.fn(async({cursor}:{cursor?:string}={})=>{
  if(cursor)return {objects:[],truncated:false,cursor:undefined};
  return {objects:objects.map(object=>({...object,uploaded:new Date(),etag:'etag',httpEtag:'etag',checksums:{toJSON:()=>({})},storageClass:'Standard'})),truncated:false,cursor:undefined};
 });
 const referenceGet=vi.fn(async(key:string)=>key in referenceObjects?{text:async()=>JSON.stringify(referenceObjects[key])}:null);
 const env={
  DB:database.db,AUTH_SECRET:'a'.repeat(48),APP_URL:'https://wine.example',
  WINE_IMAGES:{list} as unknown as R2Bucket,REFERENCE_DATA:{get:referenceGet} as unknown as R2Bucket,
  RESEARCH_QUEUE:{send:vi.fn(async(job:RolloutQueueJob)=>{sent.push(job)})} as unknown as Queue<unknown>
 };
 return {database,env,sent,list,referenceGet};
}

describe('background launch preparation',()=>{
 it.each([
  ['lwin','strict',null,'unmatched'],
  ['lwin','strict','1000001','matched'],
  ['lwin','strict','1000001','manual'],
  ['lwin_validate','strict','1000001','matched'],
  ['lwin_ai','strict',null,'unmatched'],
  ['lwin_ai','tokens',null,'unmatched']
 ] as const)('continues %s after a %s lookup limit, preserving %s / %s',async(kind,stage,storedCode,storedStatus)=>{
  const product=parseLwinReference({LWIN:'1234567',STATUS:'Live',PRODUCER_NAME:'Krug',WINE:'Grande Cuvee',COUNTRY:'France'});
  const shard=referenceShardId('krug'),broad=Array.from({length:17},(_,i)=>String(i).padStart(3,'0'));
  const {database,env,referenceGet}=setup([],{
   'reference/lwin/current.json':{version:'limit',prefix:'limit',shardCount:256,producerIndexKey:'limit/producers.json'},
   'limit/producers.json':{krug:[shard],[stage==='strict'?'broad producer estates':'t:broad']:broad},
   [`limit/shard-${shard}.json`]:[product]
  });
  const warning=vi.spyOn(console,'warn').mockImplementation(()=>{}),fetch=vi.spyOn(globalThis,'fetch');
  database.sql.prepare("INSERT INTO wines(id,owner_id,producer,wine_name,lwin7,identity_match_status,tasting_notes,created_at,updated_at) VALUES('a','owner','Broad Producer','Wine',?,?,'keep note','now','now')").run(storedCode,storedStatus);
  database.sql.prepare("INSERT INTO wines(id,owner_id,producer,wine_name,lwin7,identity_match_status,created_at,updated_at) VALUES('b','owner','Krug','Grande Cuvee',?,?,'now','now')").run(kind==='lwin_validate'?'1234567':null,kind==='lwin_validate'?'matched':'unmatched');
  await rolloutRoute(new Request(`https://wine.example/api/admin/rollout/${kind.replace('_','-')}`,{method:'POST'}),env,owner);
  for(let i=0;i<4;i++){if((await processRolloutJob(env,kind)).complete)break}
  const status=await rolloutStatus(database.db);
  const progress=kind==='lwin'?status.lwin:kind==='lwin_validate'?status.lwinValidation:status.lwinAi;
  expect(progress).toMatchObject({state:'complete',processed:2,total:2,error:null});
  expect(progress).toMatchObject(kind==='lwin'?{matched:storedStatus==='manual'?2:1,unmatched:storedCode?0:1,conflict:storedCode&&storedStatus!=='manual'?1:0}:kind==='lwin_validate'?{verified:1,review:1}:{matched:1,review:1,ai:0});
  expect(database.sql.prepare("SELECT lwin7,identity_match_status,tasting_notes FROM wines WHERE id='a'").get()).toEqual({lwin7:storedCode,identity_match_status:storedStatus==='manual'?'manual':storedCode?'conflict':'unmatched',tasting_notes:'keep note'});
  expect(database.sql.prepare("SELECT lwin7,identity_match_status FROM wines WHERE id='b'").get()).toEqual({lwin7:'1234567',identity_match_status:'matched'});
  expect(database.sql.prepare('SELECT value FROM rollout_state WHERE name=?').get(`${kind}_cursor`)!.value).toBe('b');
  expect(warning).toHaveBeenCalledWith(JSON.stringify({event:'lwin_lookup_needs_review',wineId:'a',rollout:kind,reason:'producer_lookup_too_broad'}));
  expect(fetch).not.toHaveBeenCalled();
  expect(referenceGet.mock.calls.filter(([key])=>key.startsWith('limit/shard-')).every(([key])=>key===`limit/shard-${shard}.json`||key===`limit/shard-${referenceShardId('broad producer')}.json`)).toBe(true);
  await processRolloutJob(env,kind);
  expect((await rolloutStatus(database.db))[kind==='lwin'?'lwin':kind==='lwin_validate'?'lwinValidation':'lwinAi'].processed).toBe(2);
 });
 it('still pauses on a missing indexed shard without advancing the wine checkpoint',async()=>{
  const {database,env}=setup([],{
   'reference/lwin/current.json':{version:'missing',prefix:'missing',shardCount:256,producerIndexKey:'missing/producers.json'},
   'missing/producers.json':{'broad producer':['001']}
  });
  database.sql.exec("INSERT INTO wines(id,owner_id,producer,wine_name,created_at,updated_at) VALUES('a','owner','Broad Producer','Wine','now','now')");
  await rolloutRoute(new Request('https://wine.example/api/admin/rollout/lwin',{method:'POST'}),env,owner);
  await expect(processRolloutJob(env,'lwin')).rejects.toThrow('shard unavailable');
  expect((await rolloutStatus(database.db)).lwin).toMatchObject({state:'paused',processed:0});
  expect(database.sql.prepare("SELECT value FROM rollout_state WHERE name='lwin_cursor'").get()!.value).toBe('');
 });
 it('explains missing legacy validation stamps and scopes stamped review lists',async()=>{
  const {database}=setup();
  database.sql.exec(`INSERT INTO rollout_state(name,value) VALUES ('lwin_validate_review','2'),('lwin_validation','complete');
   INSERT INTO wines(id,owner_id,producer,wine_name,lwin7,identity_match_status,identity_checked_at,created_at,updated_at) VALUES
   ('old','owner','Producer','Wine','1000001','conflict','2026-09-18','now','now'),
   ('new','owner','Producer','Wine','1000002','conflict','2026-09-20','now','now')`);
  expect((await rolloutStatus(database.db)).lwinValidation).toMatchObject({review:2,reviewListUnavailable:true,reviewItems:[]});
  database.sql.exec("INSERT INTO rollout_state(name,value) VALUES ('lwin_validate_started_at','2026-09-19')");
  const status=(await rolloutStatus(database.db)).lwinValidation;
  expect(status.reviewListUnavailable).toBe(false);
  expect(status.reviewItems.map(item=>item.id)).toEqual(['new']);
 });
 it('returns immediately, then inventories R2 from the queue without the page staying open',async()=>{
  const {database,env,sent,list}=setup([{key:'legacy/a.jpg',size:123},{key:'owners/owner/b.jpg',size:456}]);
  const response=await rolloutRoute(new Request('https://wine.example/api/admin/rollout/storage',{method:'POST'}),env,owner);
  expect(response?.status).toBe(202);expect(list).not.toHaveBeenCalled();expect(sent).toEqual([{kind:'admin_rollout',owner:'owner',rollout:'storage'}]);

  const result=await processRolloutJob(env,'storage');
  expect(result).toMatchObject({complete:true,processed:2,busy:false});
  expect(database.sql.prepare('SELECT count(*) AS n FROM stored_objects').get()!.n).toBe(2);
  expect((await rolloutStatus(database.db)).storage).toMatchObject({state:'complete',objects:2,error:null});
 });

 it('indexes research in bounded queue chunks and exposes resumable progress',async()=>{
  const {database,env,sent}=setup();
  for(let i=0;i<12;i++)database.sql.prepare('INSERT INTO wines(id,owner_id,producer,wine_name,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(`w${String(i).padStart(2,'0')}`,'owner','Producer',`Wine ${i}`,'now','now');

  const response=await rolloutRoute(new Request('https://wine.example/api/admin/rollout/research',{method:'POST'}),env,owner);
  expect(response?.status).toBe(202);expect(sent.at(-1)).toEqual({kind:'admin_rollout',owner:'owner',rollout:'research'});

  const first=await processRolloutJob(env,'research');
  expect(first).toMatchObject({complete:false,processed:10,busy:false});
  let status=await rolloutStatus(database.db);
  expect(status.research).toMatchObject({state:'running',wines:{processed:10,total:12},producers:{processed:0,total:0}});
  expect(sent.at(-1)).toEqual({kind:'admin_rollout',owner:'owner',rollout:'research'});

  const second=await processRolloutJob(env,'research');
  expect(second).toMatchObject({complete:true,processed:2,busy:false});
  status=await rolloutStatus(database.db);
  expect(status.research).toMatchObject({state:'complete',wines:{processed:12,total:12},producers:{processed:0,total:0},error:null});
 });

 it('refreshes an already-complete research index without revoking launch readiness',async()=>{
  const {database,env,sent}=setup();
  database.sql.prepare("INSERT INTO wines(id,owner_id,producer,wine_name,created_at,updated_at) VALUES('w1','owner','Producer','Wine 1','now','now')").run();
  await rolloutRoute(new Request('https://wine.example/api/admin/rollout/research',{method:'POST'}),env,owner);
  await processRolloutJob(env,'research');
  expect((await rolloutStatus(database.db)).research.state).toBe('complete');
  expect(database.sql.prepare("SELECT value FROM rollout_state WHERE name='research_index'").get()!.value).toBe('complete');

  database.sql.prepare("INSERT INTO wines(id,owner_id,producer,wine_name,created_at,updated_at) VALUES('w2','owner','Producer','Wine 2','now','now')").run();
  const before=sent.length;
  const response=await rolloutRoute(new Request('https://wine.example/api/admin/rollout/research',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh:true})}),env,owner);
  expect(response?.status).toBe(202);expect(sent).toHaveLength(before+1);expect(sent.at(-1)).toEqual({kind:'admin_rollout',owner:'owner',rollout:'research'});
  // Initial readiness remains complete while the refresh walks current records,
  // so inviting a member is not temporarily disabled by routine maintenance.
  expect(database.sql.prepare("SELECT value FROM rollout_state WHERE name='research_index'").get()!.value).toBe('complete');
  expect((await rolloutStatus(database.db)).research).toMatchObject({state:'running',wines:{processed:0,total:2}});

  const refreshed=await processRolloutJob(env,'research');
  expect(refreshed).toMatchObject({complete:true,processed:2,busy:false});
  expect((await rolloutStatus(database.db)).research).toMatchObject({state:'complete',wines:{processed:2,total:2},error:null});
  expect(database.sql.prepare("SELECT value FROM rollout_state WHERE name='rollout_research_refresh'").get()!.value).toBe('complete');
 });
 it('backfills only clear LWIN matches across existing accounts without touching manual identities',async()=>{
  const producerKey='krug',shard=referenceShardId(producerKey),manifest:ReferenceManifest={
   provider:'lwin',version:'l1',prefix:'reference/lwin/versions/l1',shardCount:256,rows:1,source:'LWIN.xlsx',sourceUpdatedAt:null,generatedAt:'now',
   redirectsKey:'reference/lwin/versions/l1/redirects.json'
  };
  const referenceObjects={
   'reference/lwin/current.json':manifest,
   [`reference/lwin/versions/l1/shard-${shard}.json`]:[{
    productKey:'lwin:1234567',lwin7:'1234567',status:'Live',referenceLwin7:null,displayName:'Krug, Grande Cuvee',producerTitle:null,producerName:'Krug',wineName:'Grande Cuvee',
    producerKey,wineKey:'grande cuvee',country:'France',countryKey:'france',region:'Champagne',regionKey:'champagne',subRegion:null,site:null,parcel:null,
    colour:'White',colourKey:'white',productType:'Wine',productSubtype:'Sparkling',designation:null,classification:'Grand Cru',vintageConfig:'sequential',firstVintage:2000,finalVintage:2026,
    sourceAddedAt:null,sourceUpdatedAt:null,importedAt:'now'
   }],
   'reference/lwin/versions/l1/redirects.json':{}
  };
  const {database,env,sent}=setup([],referenceObjects);
  database.sql.exec(`
   INSERT INTO wines(id,owner_id,producer,wine_name,vintage,country,region,tasting_notes,created_at,updated_at) VALUES
    ('w1','owner','Krug','Grande Cuvee',2019,NULL,NULL,'keep this note','now','now'),
    ('w2','member','Unknown','Mystery Wine',NULL,'France','Champagne','member note','now','now');
   INSERT INTO wines(id,owner_id,producer,wine_name,identity_match_status,elid,created_at,updated_at)
    VALUES('w3','owner','Krug','Grande Cuvee','manual','FR-CMP-KRUG01-N171','now','now');
  `);
  const response=await rolloutRoute(new Request('https://wine.example/api/admin/rollout/lwin',{method:'POST'}),env,owner);
  expect(response?.status).toBe(202);expect(sent.at(-1)).toMatchObject({kind:'admin_rollout',owner:'owner',rollout:'lwin'});
  expect((await rolloutStatus(database.db)).lwin).toMatchObject({state:'running',processed:0,total:2,matched:0});

  const result=await processRolloutJob(env,'lwin');
  expect(result).toMatchObject({complete:true,processed:2,matched:1,unmatched:1,busy:false});
  const status=await rolloutStatus(database.db);
  expect(status.lwin).toMatchObject({state:'complete',processed:2,total:2,matched:1,ambiguous:0,unmatched:1,conflict:0,error:null});

  const matched=database.sql.prepare('SELECT lwin7,lwin11,identity_match_status,identity_checked_at,tasting_notes,colour,product_type,country,region,classification,reference_suggestions_json FROM wines WHERE id=?').get('w1') as Record<string,unknown>;
  expect(matched).toMatchObject({lwin7:'1234567',lwin11:'12345672019',identity_match_status:'matched',tasting_notes:'keep this note',colour:'White',product_type:'Wine',country:'France',region:'Champagne',classification:'grand_cru',reference_suggestions_json:null});expect(matched.identity_checked_at).toBeTruthy();
  const unmatched=database.sql.prepare('SELECT lwin7,identity_match_status,identity_checked_at,tasting_notes FROM wines WHERE id=?').get('w2') as Record<string,unknown>;
  expect(unmatched).toMatchObject({lwin7:null,identity_match_status:'unmatched',tasting_notes:'member note'});expect(unmatched.identity_checked_at).toBeTruthy();
  const manual=database.sql.prepare('SELECT lwin7,identity_match_status,elid FROM wines WHERE id=?').get('w3') as Record<string,unknown>;
  expect(manual).toMatchObject({lwin7:null,identity_match_status:'manual',elid:'FR-CMP-KRUG01-N171'});
 });

 it('revalidates stored automatic LWINs without deleting a disputed identifier',async()=>{
  const producerKey='krug',shard=referenceShardId(producerKey),manifest:ReferenceManifest={provider:'lwin',version:'l1',prefix:'reference/lwin/versions/l1',shardCount:256,rows:1,source:'test',sourceUpdatedAt:null,generatedAt:'now'};
  const referenceObjects={'reference/lwin/current.json':manifest,[`reference/lwin/versions/l1/shard-${shard}.json`]:[{productKey:'lwin:1234567',lwin7:'1234567',status:'Live',referenceLwin7:null,displayName:'Krug, Grande Cuvee',producerTitle:null,producerName:'Krug',wineName:'Grande Cuvee',producerKey,wineKey:'grande cuvee',country:'France',countryKey:'france',region:'Champagne',regionKey:'champagne',subRegion:null,site:null,parcel:null,colour:'White',colourKey:'white',productType:'Wine',productSubtype:'Sparkling',designation:null,classification:null,vintageConfig:'sequential',firstVintage:2000,finalVintage:2026,sourceAddedAt:null,sourceUpdatedAt:null,importedAt:'now'}]};
  const {database,env,sent}=setup([],referenceObjects);
  database.sql.exec(`INSERT INTO wines(id,owner_id,producer,wine_name,lwin7,identity_match_status,created_at,updated_at) VALUES
   ('valid','owner','Krug','Grande Cuvee','1234567','matched','now','now'),
   ('suspect','owner','Maison Krug','Grande Cuvee','1234567','matched','now','now'),
   ('manual','owner','Maison Krug','Grande Cuvee','1234567','manual','now','now')`);
  const response=await rolloutRoute(new Request('https://wine.example/api/admin/rollout/lwin-validate',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),env,owner);
  expect(response?.status).toBe(202);expect(sent.at(-1)).toMatchObject({kind:'admin_rollout',owner:'owner',rollout:'lwin_validate'});
  const result=await processRolloutJob(env,'lwin_validate');expect(result).toMatchObject({complete:true,processed:2,verified:1,review:1,busy:false});
  const valid=database.sql.prepare("SELECT lwin7,identity_match_status FROM wines WHERE id='valid'").get() as Record<string,unknown>;
  const suspect=database.sql.prepare("SELECT lwin7,identity_match_status,identity_match_candidates_json FROM wines WHERE id='suspect'").get() as Record<string,unknown>;
  const manual=database.sql.prepare("SELECT lwin7,identity_match_status FROM wines WHERE id='manual'").get() as Record<string,unknown>;
  expect(valid).toMatchObject({lwin7:'1234567',identity_match_status:'matched'});
  expect(suspect).toMatchObject({lwin7:'1234567',identity_match_status:'conflict'});expect(String(suspect.identity_match_candidates_json)).toContain('1234567');
  expect(manual).toMatchObject({lwin7:'1234567',identity_match_status:'manual'});
  expect((await rolloutStatus(database.db)).lwinValidation).toMatchObject({state:'complete',processed:2,total:2,verified:1,review:1});
 });

 it('pauses a rollout without clearing its checkpoint and ignores stale queued work',async()=>{
  const {database,env,sent}=setup([]);
  database.sql.exec("INSERT INTO wines(id,owner_id,producer,wine_name,identity_match_status,created_at,updated_at) VALUES('w-ai','owner','Unknown Producer','Unknown Wine','unmatched','now','now')");
  await rolloutRoute(new Request('https://wine.example/api/admin/rollout/lwin-ai',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),env,owner);
  const queued=sent.length;
  const paused=await rolloutRoute(new Request('https://wine.example/api/admin/rollout/lwin-ai/pause',{method:'POST'}),env,owner);
  expect(paused?.status).toBe(202);expect((await rolloutStatus(database.db)).lwinAi.state).toBe('paused');
  const stale=await processRolloutJob(env,'lwin_ai');expect(stale).toMatchObject({processed:0,busy:false,paused:true});
  expect(sent).toHaveLength(queued);
  const resumed=await rolloutRoute(new Request('https://wine.example/api/admin/rollout/lwin-ai',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),env,owner);
  expect(resumed?.status).toBe(202);expect((await rolloutStatus(database.db)).lwinAi.state).toBe('running');
 });

 it('accepts the owner AI-assisted LWIN rollout endpoint and queues the AI job',async()=>{
  const {database,env,sent}=setup([]);
  database.sql.exec("INSERT INTO wines(id,owner_id,producer,wine_name,identity_match_status,created_at,updated_at) VALUES('w-ai','owner','Unknown Producer','Unknown Wine','unmatched','now','now')");
  const response=await rolloutRoute(new Request('https://wine.example/api/admin/rollout/lwin-ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh:false})}),env,owner);
  expect(response?.status).toBe(202);
  expect(sent.at(-1)).toMatchObject({kind:'admin_rollout',owner:'owner',rollout:'lwin_ai'});
  expect((await rolloutStatus(database.db)).lwinAi).toMatchObject({state:'running',processed:0,total:1,matched:0,deterministic:0,ai:0,review:0});
 });

 it('keeps AI LWIN queue chunks to one wine so progress is checkpointed within the Worker CPU budget',async()=>{
  const source=await import('node:fs/promises').then(fs=>fs.readFile(new URL('../../worker/multiUser/rollout.ts',import.meta.url),'utf8'));
  expect(source).toContain('LWIN_AI_BATCH=1');
 });

});
