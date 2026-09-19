import { afterEach,describe,expect,it,vi } from 'vitest';
import { realD1 } from './support/realD1';
import { processRolloutJob,rolloutRoute,rolloutStatus,type RolloutQueueJob } from '../../worker/multiUser/rollout';
import type { Member } from '../../worker/multiUser/common';
import { referenceShardId,type ReferenceManifest } from '../../src/lib/wine/referenceCatalog';

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
    colour:'White',colourKey:'white',productType:'Wine',productSubtype:'Sparkling',designation:null,classification:'Grand Cru',vintageConfig:null,firstVintage:null,finalVintage:null,
    sourceAddedAt:null,sourceUpdatedAt:null,importedAt:'now'
   }],
   'reference/lwin/versions/l1/redirects.json':{}
  };
  const {database,env,sent}=setup([],referenceObjects);
  database.sql.exec(`
   INSERT INTO wines(id,owner_id,producer,wine_name,country,region,tasting_notes,created_at,updated_at) VALUES
    ('w1','owner','Krug','Grande Cuvee',NULL,NULL,'keep this note','now','now'),
    ('w2','member','Unknown','Mystery Wine','France','Champagne','member note','now','now');
   INSERT INTO wines(id,owner_id,producer,wine_name,identity_match_status,elid,created_at,updated_at)
    VALUES('w3','owner','Krug','Grande Cuvee','manual','FR-CMP-KRUG01-N171','now','now');
  `);
  const response=await rolloutRoute(new Request('https://wine.example/api/admin/rollout/lwin',{method:'POST'}),env,owner);
  expect(response?.status).toBe(202);expect(sent.at(-1)).toEqual({kind:'admin_rollout',owner:'owner',rollout:'lwin'});
  expect((await rolloutStatus(database.db)).lwin).toMatchObject({state:'running',processed:0,total:2,matched:0});

  const result=await processRolloutJob(env,'lwin');
  expect(result).toMatchObject({complete:true,processed:2,matched:1,unmatched:1,busy:false});
  const status=await rolloutStatus(database.db);
  expect(status.lwin).toMatchObject({state:'complete',processed:2,total:2,matched:1,ambiguous:0,unmatched:1,conflict:0,error:null});

  const matched=database.sql.prepare('SELECT lwin7,identity_match_status,tasting_notes,colour,product_type,country,region,classification,reference_suggestions_json FROM wines WHERE id=?').get('w1') as Record<string,unknown>;
  expect(matched).toMatchObject({lwin7:'1234567',identity_match_status:'matched',tasting_notes:'keep this note',colour:'White',product_type:'Wine',country:'France',region:'Champagne',classification:'grand_cru',reference_suggestions_json:null});
  const unmatched=database.sql.prepare('SELECT lwin7,identity_match_status,tasting_notes FROM wines WHERE id=?').get('w2') as Record<string,unknown>;
  expect(unmatched).toMatchObject({lwin7:null,identity_match_status:null,tasting_notes:'member note'});
  const manual=database.sql.prepare('SELECT lwin7,identity_match_status,elid FROM wines WHERE id=?').get('w3') as Record<string,unknown>;
  expect(manual).toMatchObject({lwin7:null,identity_match_status:'manual',elid:'FR-CMP-KRUG01-N171'});
 });

});
