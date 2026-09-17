import { ApiError,json,ownerOnly,stamp,type IdentityEnv,type Member } from './common';
import { deepSearchSchema } from '../../src/lib/db/schema';
import { loadResearchCache,splitDeepSearchResult,upsertResearchCache } from '../../src/lib/research/cache';
import { publishResearch } from '../../src/lib/research/shared';
import { wineTargets } from './credits';
import { publishProducerResearch } from '../../src/lib/research/sharedProducer';

export type RolloutKind='storage'|'research';
export type RolloutQueueJob={kind:'admin_rollout';owner:string;rollout:RolloutKind};
type RolloutEnv=IdentityEnv&{WINE_IMAGES:R2Bucket;RESEARCH_QUEUE:Queue<unknown>};
type TaskState='not_started'|'paused'|'running'|'complete';
export type RolloutStatus={
 storage:{state:TaskState;objects:number;error:string|null};
 research:{state:TaskState;wines:{processed:number;total:number};producers:{processed:number;total:number};error:string|null};
};

const STORAGE_BATCH=100,RESEARCH_BATCH=10,LEASE_SECONDS=180;
const jobKey=(kind:RolloutKind)=>`rollout_${kind}_job`;
const errorKey=(kind:RolloutKind)=>`rollout_${kind}_error`;
const leaseKey=(kind:RolloutKind)=>`rollout_${kind}_lease`;
const completionKey=(kind:RolloutKind)=>kind==='storage'?'storage_inventory':'research_index';
const cursorKey=(kind:RolloutKind)=>kind==='storage'?'storage_cursor':'research_cursor';

async function readState(db:D1Database,name:string){return (await db.prepare('SELECT value FROM rollout_state WHERE name=?').bind(name).first<{value:string}>())?.value??''}
async function writeState(db:D1Database,name:string,value:string){await db.prepare('INSERT INTO rollout_state(name,value) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET value=excluded.value').bind(name,value).run()}
async function writeStates(db:D1Database,entries:Array<[string,string]>){if(entries.length)await db.batch(entries.map(([name,value])=>db.prepare('INSERT INTO rollout_state(name,value) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET value=excluded.value').bind(name,value)))}
function taskState(complete:boolean,running:boolean,hasCursor:boolean):TaskState{return complete?'complete':running?'running':hasCursor?'paused':'not_started'}

/** Owner-visible status survives navigation and browser restarts. */
export async function rolloutStatus(db:D1Database):Promise<RolloutStatus>{
 const [storageComplete,storageJob,storageError,researchComplete,researchJob,researchError,wineCursor,producerCursor,storageObjects,wineTotal,producerTotal]=await Promise.all([
  readState(db,'storage_inventory'),readState(db,jobKey('storage')),readState(db,errorKey('storage')),
  readState(db,'research_index'),readState(db,jobKey('research')),readState(db,errorKey('research')),
  readState(db,'research_cursor'),readState(db,'producer_research_cursor'),
  db.prepare('SELECT count(*) AS n FROM stored_objects').first<{n:number}>(),
  db.prepare('SELECT count(*) AS n FROM wines').first<{n:number}>(),
  db.prepare('SELECT count(*) AS n FROM producers').first<{n:number}>()
 ]);
 const winesTotal=Number(wineTotal?.n)||0,producersTotal=Number(producerTotal?.n)||0;
 const [wineDone,producerDone]=await Promise.all([
  researchComplete==='complete'?Promise.resolve(winesTotal):wineCursor?db.prepare('SELECT count(*) AS n FROM wines WHERE id<=?').bind(wineCursor).first<{n:number}>().then(row=>Number(row?.n)||0):Promise.resolve(0),
  researchComplete==='complete'?Promise.resolve(producersTotal):producerCursor?db.prepare('SELECT count(*) AS n FROM producers WHERE id<=?').bind(producerCursor).first<{n:number}>().then(row=>Number(row?.n)||0):Promise.resolve(0)
 ]);
 return {
  storage:{state:taskState(storageComplete==='complete',storageJob==='running',Boolean(await readState(db,'storage_cursor'))),objects:Number(storageObjects?.n)||0,error:storageError||null},
  research:{state:taskState(researchComplete==='complete',researchJob==='running',Boolean(wineCursor||producerCursor)),wines:{processed:wineDone,total:winesTotal},producers:{processed:producerDone,total:producersTotal},error:researchError||null}
 };
}

async function acquireLease(db:D1Database,kind:RolloutKind){
 const now=Math.floor(Date.now()/1000),until=now+LEASE_SECONDS,name=leaseKey(kind),value=String(until);
 const result=await db.prepare(`INSERT INTO rollout_state(name,value) VALUES(?,?)
  ON CONFLICT(name) DO UPDATE SET value=excluded.value WHERE CAST(rollout_state.value AS INTEGER)<=?`).bind(name,value,now).run();
 return result.meta.changes?value:null;
}
async function releaseLease(db:D1Database,kind:RolloutKind,value:string){await db.prepare('UPDATE rollout_state SET value=\'0\' WHERE name=? AND value=?').bind(leaseKey(kind),value).run()}

async function inventoryStorageBatch(env:RolloutEnv){
 if(await readState(env.DB,'storage_inventory')==='complete')return {complete:true,processed:0};
 const cursor=await readState(env.DB,'storage_cursor');
 const listing=await env.WINE_IMAGES.list({limit:STORAGE_BATCH,...(cursor?{cursor}:{})});
 if(listing.objects.length)await env.DB.batch(listing.objects.map(object=>{
  const owner=object.key.match(/^owners\/([^/]+)\//)?.[1]??object.key.match(/^shared\/([^/]+)\//)?.[1]??'owner';
  return env.DB.prepare('INSERT INTO stored_objects(object_key,owner_id,byte_size,updated_at) VALUES(?,?,?,?) ON CONFLICT(object_key) DO UPDATE SET byte_size=excluded.byte_size,updated_at=excluded.updated_at').bind(object.key,owner,object.size,stamp());
 }));
 const complete=!listing.truncated;
 await writeStates(env.DB,[['storage_cursor',complete?'':listing.cursor],...(complete?[['storage_inventory','complete'],[jobKey('storage'),'complete']] as Array<[string,string]>:[])]);
 return {complete,processed:listing.objects.length};
}

async function indexResearchBatch(env:RolloutEnv){
 if(await readState(env.DB,'research_index')==='complete')return {complete:true,processed:0};
 const cursor=await readState(env.DB,'research_cursor');
 const rows=await env.DB.prepare(`SELECT * FROM wines WHERE id>? ORDER BY id LIMIT ${RESEARCH_BATCH}`).bind(cursor).all<Record<string,unknown>>();
 for(const row of rows.results){
  const owner=String(row.owner_id),targets=wineTargets(row),cache=await loadResearchCache(env.DB,owner,targets);
  if(row.producer_id)await publishProducerResearch(env.DB,owner,String(row.producer_id));
  if(row.deep_search_json){
   let raw:unknown=null;try{raw=JSON.parse(String(row.deep_search_json))}catch{/* malformed legacy snapshot: keep indexing other reusable scopes */}
   const parsed=deepSearchSchema.safeParse(raw);
   if(parsed.success)for(const entry of splitDeepSearchResult(parsed.data,targets))if(!cache.has(entry.target.scope)){await upsertResearchCache(env.DB,owner,entry);cache.set(entry.target.scope,entry)}
  }
  for(const target of targets){const entry=cache.get(target.scope);if(entry)await publishResearch(env.DB,owner,{...entry,target})}
 }
 if(rows.results.length)await writeState(env.DB,'research_cursor',String(rows.results.at(-1)!.id));
 let complete=false,producerCount=0;
 if(rows.results.length<RESEARCH_BATCH){
  const producerCursor=await readState(env.DB,'producer_research_cursor');
  const producers=await env.DB.prepare(`SELECT id,owner_id FROM producers WHERE id>? ORDER BY id LIMIT ${RESEARCH_BATCH}`).bind(producerCursor).all<{id:string;owner_id:string}>();
  for(const producer of producers.results)await publishProducerResearch(env.DB,producer.owner_id,producer.id);
  producerCount=producers.results.length;complete=producerCount<RESEARCH_BATCH;
  if(producerCount)await writeState(env.DB,'producer_research_cursor',producers.results.at(-1)!.id);
  if(complete)await writeStates(env.DB,[['research_index','complete'],[jobKey('research'),'complete']]);
 }
 return {complete,processed:rows.results.length+producerCount};
}

/** Process one bounded chunk. Queue chaining makes the overall job independent of the page lifetime. */
export async function processRolloutJob(env:RolloutEnv,kind:RolloutKind){
 const lease=await acquireLease(env.DB,kind);if(!lease)return {complete:false,processed:0,busy:true};
 try{
  await writeState(env.DB,errorKey(kind),'');
  const result=kind==='storage'?await inventoryStorageBatch(env):await indexResearchBatch(env);
  if(!result.complete)await env.RESEARCH_QUEUE.send({kind:'admin_rollout',owner:'owner',rollout:kind} satisfies RolloutQueueJob);
  return {...result,busy:false};
 }catch(error){
  await writeState(env.DB,errorKey(kind),error instanceof Error?error.message:String(error));
  throw error;
 }finally{await releaseLease(env.DB,kind,lease)}
}

/** The five-minute maintenance trigger repairs a lost/dead-lettered rollout dispatch. */
export async function recoverRollouts(env:RolloutEnv){
 for(const kind of ['storage','research'] as const){
  if(await readState(env.DB,completionKey(kind))==='complete')continue;
  if(await readState(env.DB,jobKey(kind))!=='running')continue;
  await env.RESEARCH_QUEUE.send({kind:'admin_rollout',owner:'owner',rollout:kind} satisfies RolloutQueueJob).catch(error=>console.error(JSON.stringify({event:'rollout_recovery_failed',kind,error:String(error)})));
 }
}

async function startRollout(env:RolloutEnv,member:Member,kind:RolloutKind){
 if(await readState(env.DB,completionKey(kind))==='complete')return {accepted:false,alreadyComplete:true,status:await rolloutStatus(env.DB)};
 await writeStates(env.DB,[[jobKey(kind),'running'],[errorKey(kind),'']]);
 try{await env.RESEARCH_QUEUE.send({kind:'admin_rollout',owner:member.id,rollout:kind} satisfies RolloutQueueJob)}
 catch(error){await writeStates(env.DB,[[jobKey(kind),'paused'],[errorKey(kind),error instanceof Error?error.message:String(error)]]);throw new ApiError(503,'Could not start the background rollout job')}
 return {accepted:true,status:await rolloutStatus(env.DB)};
}

/** Owner-only launch preparation: POST starts/resumes, GET reports durable progress. */
export async function rolloutRoute(request:Request,env:RolloutEnv,member:Member):Promise<Response|null>{
 const path=new URL(request.url).pathname;if(!path.startsWith('/api/admin/rollout/'))return null;ownerOnly(member);
 if(path==='/api/admin/rollout/status'&&request.method==='GET')return json(await rolloutStatus(env.DB));
 if(request.method!=='POST')throw new ApiError(405,'Use POST');
 if(path==='/api/admin/rollout/storage')return json(await startRollout(env,member,'storage'),202);
 if(path==='/api/admin/rollout/research')return json(await startRollout(env,member,'research'),202);
 throw new ApiError(404,'Unknown rollout task');
}
