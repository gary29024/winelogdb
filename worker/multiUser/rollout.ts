import { ApiError,json,ownerOnly,stamp,type IdentityEnv,type Member } from './common';
import { deepSearchSchema } from '../../src/lib/db/schema';
import { loadResearchCache,RESEARCH_EDITION_COLUMNS,splitDeepSearchResult,upsertResearchCache } from '../../src/lib/research/cache';
import { publishResearch } from '../../src/lib/research/shared';
import { wineTargets } from './credits';
import { publishProducerResearch } from '../../src/lib/research/sharedProducer';
import { referenceMatchForProduct,type ReferenceMatch } from '../../src/lib/wine/referenceIdentity';
import { ReferenceReadScope,referenceManifest,LwinProducerLookupTooBroadError } from '../../src/lib/wine/referenceCatalog';
import { aiRepair,repairCandidates,LwinAiTransientError,LWIN_AI_LEASE_SECONDS } from './lwinRepair';
import type { GeminiTransportBindings } from '../geminiTransport';
import type { AiUsageEnv } from '../../src/lib/usage/aiUsage';
import { lwinEnrichmentStatement,lwinInput,lwinUpdate,resolveStoredLwin,type StoredLwinWine } from '../lwinEnrichment';
import { readLwinReference } from '../../src/lib/wine/lwinMetadata';
import { pendingReferenceReviewSql } from '../wineReferenceReview';
import { flushOutbox } from './jobs';

export type RolloutKind='storage'|'research'|'lwin'|'lwin_validate'|'lwin_ai';
export type RolloutQueueJob={kind:'admin_rollout';owner:string;rollout:RolloutKind;_outboxId?:string;generation?:string;cursor?:string};
type RolloutEnv=IdentityEnv&GeminiTransportBindings&AiUsageEnv&{WINE_IMAGES:R2Bucket;REFERENCE_DATA:R2Bucket;RESEARCH_QUEUE:Queue<unknown>};
type TaskState='not_started'|'paused'|'running'|'complete';
export type RolloutStatus={
 lwinCurrent?:{total:number;automatic:number;manual:number;identityConflicts:number;fieldUpdates:number;needsReview:number;withoutLwin:number;optedOut:number};
 storage:{state:TaskState;objects:number;error:string|null};
 research:{state:TaskState;wines:{processed:number;total:number};producers:{processed:number;total:number};error:string|null};
 lwin:{state:TaskState;processed:number;total:number;matched:number;ambiguous:number;unmatched:number;conflict:number;error:string|null};
 lwinValidation:{state:TaskState;processed:number;total:number;verified:number;review:number;error:string|null;reviewListUnavailable?:boolean;reviewItems:Array<{id:string;producer:string;wineName:string;lwin7:string;candidates:string[]}>};
 lwinAi:{state:TaskState;processed:number;total:number;matched:number;deterministic:number;ai:number;review:number;error:string|null};
};

const STORAGE_BATCH=100,RESEARCH_BATCH=10,LWIN_BATCH=25,LWIN_VALIDATE_BATCH=25,LWIN_AI_BATCH=1,LEASE_SECONDS=180,RESEARCH_REFRESH='rollout_research_refresh';
const jobKey=(kind:RolloutKind)=>`rollout_${kind}_job`;
const errorKey=(kind:RolloutKind)=>`rollout_${kind}_error`;
const leaseKey=(kind:RolloutKind)=>`rollout_${kind}_lease`;
const leaseSeconds=(kind:RolloutKind)=>kind==='lwin_ai'?LWIN_AI_LEASE_SECONDS:LEASE_SECONDS;
const completionKey=(kind:RolloutKind)=>kind==='storage'?'storage_inventory':kind==='research'?'research_index':kind==='lwin'?'lwin_backfill':kind==='lwin_validate'?'lwin_validation':'lwin_ai_backfill';

async function readState(db:D1Database,name:string){return (await db.prepare('SELECT value FROM rollout_state WHERE name=?').bind(name).first<{value:string}>())?.value??''}
async function writeState(db:D1Database,name:string,value:string){await db.prepare('INSERT INTO rollout_state(name,value) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET value=excluded.value').bind(name,value).run()}
async function writeStates(db:D1Database,entries:Array<[string,string]>){if(entries.length)await db.batch(entries.map(([name,value])=>db.prepare('INSERT INTO rollout_state(name,value) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET value=excluded.value').bind(name,value)))}
async function readCount(db:D1Database,name:string){const value=Number(await readState(db,name));return Number.isFinite(value)&&value>=0?value:0}
async function dispatchRollout(env:RolloutEnv,kind:RolloutKind,owner='owner'){
 if(!kind.startsWith('lwin'))return env.RESEARCH_QUEUE.send({kind:'admin_rollout',owner,rollout:kind} satisfies RolloutQueueJob);
 const generation=await readState(env.DB,`rollout_${kind}_generation`),cursor=await readState(env.DB,`${kind}_cursor`);
 const id=`rollout:${kind}:${generation}:${cursor}`,now=Math.floor(Date.now()/1000);
 const job:RolloutQueueJob={kind:'admin_rollout',owner,rollout:kind,generation,cursor,_outboxId:id};
 await env.DB.prepare('INSERT OR IGNORE INTO queue_outbox(id,operation_id,body_json,due_at) VALUES(?,NULL,?,?)').bind(id,JSON.stringify(job),now).run();
 // Resend a lost/dead-lettered delivery under the same logical job ID. A live
 // delivery claim and the rollout lease protect against concurrent processing.
 await env.DB.prepare(`UPDATE queue_outbox SET sent_at=NULL,due_at=? WHERE id=? AND sent_at<?
  AND NOT EXISTS(SELECT 1 FROM queue_deliveries WHERE id=? AND (done=1 OR lease_until>?))`).bind(now,id,now-600,id,now).run();
 await flushOutbox(env.DB,env.RESEARCH_QUEUE);
}
function taskState(complete:boolean,job:string,hasCursor:boolean):TaskState{return job==='running'?'running':complete?'complete':job==='paused'||hasCursor?'paused':'not_started'}

/** Owner-visible status survives navigation and browser restarts. */
export async function rolloutStatus(db:D1Database,ownerId?:string):Promise<RolloutStatus>{
 const lwinCurrent=ownerId?await db.prepare(`SELECT count(*) AS total,
  count(CASE WHEN lwin7 IS NOT NULL AND identity_match_status='matched' THEN 1 END) AS automatic,
  count(CASE WHEN lwin7 IS NOT NULL AND identity_match_status='manual' THEN 1 END) AS manual,
  count(CASE WHEN identity_match_status='conflict' THEN 1 END) AS identityConflicts,
  count(CASE WHEN coalesce(identity_match_status,'')<>'conflict' AND coalesce(reference_suggestions_json,'[]') NOT IN ('[]','null','') THEN 1 END) AS fieldUpdates,
  count(CASE WHEN ${pendingReferenceReviewSql} THEN 1 END) AS needsReview,
  count(CASE WHEN lwin7 IS NULL THEN 1 END) AS withoutLwin,
  count(CASE WHEN lwin7 IS NULL AND identity_match_status='manual' THEN 1 END) AS optedOut
  FROM wines WHERE owner_id=?`).bind(ownerId).first<NonNullable<RolloutStatus['lwinCurrent']>>():null;
 const [storageComplete,storageJob,storageError,researchComplete,researchJob,researchRefresh,researchError,wineCursor,producerCursor,storageObjects,wineTotal,producerTotal,
  lwinComplete,lwinJob,lwinError,lwinCursor,lwinProcessed,lwinTotal,lwinMatched,lwinAmbiguous,lwinUnmatched,lwinConflict]=await Promise.all([
  readState(db,'storage_inventory'),readState(db,jobKey('storage')),readState(db,errorKey('storage')),
  readState(db,'research_index'),readState(db,jobKey('research')),readState(db,RESEARCH_REFRESH),readState(db,errorKey('research')),
  readState(db,'research_cursor'),readState(db,'producer_research_cursor'),
  db.prepare('SELECT count(*) AS n FROM stored_objects').first<{n:number}>(),
  db.prepare('SELECT count(*) AS n FROM wines').first<{n:number}>(),
  db.prepare('SELECT count(*) AS n FROM producers').first<{n:number}>(),
  readState(db,'lwin_backfill'),readState(db,jobKey('lwin')),readState(db,errorKey('lwin')),readState(db,'lwin_cursor'),
  readCount(db,'lwin_processed'),readCount(db,'lwin_total'),readCount(db,'lwin_matched'),readCount(db,'lwin_ambiguous'),readCount(db,'lwin_unmatched'),readCount(db,'lwin_conflict')
 ]);
 const [lwinValidateComplete,lwinValidateJob,lwinValidateError,lwinValidateCursor,lwinValidateStartedAt,lwinValidateProcessed,lwinValidateTotal,lwinValidateVerified,lwinValidateReview]=await Promise.all([
  readState(db,'lwin_validation'),readState(db,jobKey('lwin_validate')),readState(db,errorKey('lwin_validate')),readState(db,'lwin_validate_cursor'),readState(db,'lwin_validate_started_at'),
  readCount(db,'lwin_validate_processed'),readCount(db,'lwin_validate_total'),readCount(db,'lwin_validate_verified'),readCount(db,'lwin_validate_review')
 ]);
 const [lwinAiComplete,lwinAiJob,lwinAiError,lwinAiCursor,lwinAiProcessed,lwinAiTotal,lwinAiMatched,lwinAiDeterministic,lwinAiModel,lwinAiReview]=await Promise.all([
  readState(db,'lwin_ai_backfill'),readState(db,jobKey('lwin_ai')),readState(db,errorKey('lwin_ai')),readState(db,'lwin_ai_cursor'),
  readCount(db,'lwin_ai_processed'),readCount(db,'lwin_ai_total'),readCount(db,'lwin_ai_matched'),readCount(db,'lwin_ai_deterministic'),readCount(db,'lwin_ai_model'),readCount(db,'lwin_ai_review')
 ]);
 const winesTotal=Number(wineTotal?.n)||0,producersTotal=Number(producerTotal?.n)||0,researchRefreshing=researchRefresh==='running'||researchRefresh==='paused';
 const [wineDone,producerDone]=await Promise.all([
  researchComplete==='complete'&&!researchRefreshing?Promise.resolve(winesTotal):wineCursor?db.prepare('SELECT count(*) AS n FROM wines WHERE id<=?').bind(wineCursor).first<{n:number}>().then(row=>Number(row?.n)||0):Promise.resolve(0),
  researchComplete==='complete'&&!researchRefreshing?Promise.resolve(producersTotal):producerCursor?db.prepare('SELECT count(*) AS n FROM producers WHERE id<=?').bind(producerCursor).first<{n:number}>().then(row=>Number(row?.n)||0):Promise.resolve(0)
 ]);
 const researchState:TaskState=researchJob==='running'?'running':researchRefresh==='paused'||researchJob==='paused'?'paused':taskState(researchComplete==='complete',researchJob,Boolean(wineCursor||producerCursor));
 let validationReviewItems:Array<{id:string;producer:string;wineName:string;lwin7:string;candidates:string[]}>=[]; 
 if(lwinValidateJob!=='running'&&lwinValidateReview>0&&lwinValidateStartedAt){
  const flagged=await db.prepare("SELECT id,producer,wine_name,lwin7,identity_match_candidates_json FROM wines WHERE lwin7 IS NOT NULL AND identity_match_status='conflict' AND identity_checked_at>=? ORDER BY identity_checked_at DESC LIMIT 20").bind(lwinValidateStartedAt).all<Record<string,unknown>>();
  validationReviewItems=flagged.results.map(row=>{
   let candidates:string[]=[];try{const parsed=JSON.parse(String(row.identity_match_candidates_json??'[]'));if(Array.isArray(parsed))candidates=parsed.filter((value):value is string=>typeof value==='string')}catch{/* keep malformed legacy candidate metadata out of owner UI */}
   return {id:String(row.id),producer:String(row.producer??''),wineName:String(row.wine_name??''),lwin7:String(row.lwin7??''),candidates};
  });
 }
 return {
  ...(lwinCurrent?{lwinCurrent}:{}),
  storage:{state:taskState(storageComplete==='complete',storageJob,Boolean(await readState(db,'storage_cursor'))),objects:Number(storageObjects?.n)||0,error:storageError||null},
  research:{state:researchState,wines:{processed:wineDone,total:winesTotal},producers:{processed:producerDone,total:producersTotal},error:researchError||null},
  lwin:{state:taskState(lwinComplete==='complete',lwinJob,Boolean(lwinCursor)),processed:lwinProcessed,total:lwinTotal,matched:lwinMatched,ambiguous:lwinAmbiguous,unmatched:lwinUnmatched,conflict:lwinConflict,error:lwinError||null},
  lwinValidation:{state:taskState(lwinValidateComplete==='complete',lwinValidateJob,Boolean(lwinValidateCursor)),processed:lwinValidateProcessed,total:lwinValidateTotal,verified:lwinValidateVerified,review:lwinValidateReview,error:lwinValidateError||null,reviewListUnavailable:lwinValidateReview>0&&!lwinValidateStartedAt,reviewItems:validationReviewItems},
  lwinAi:{state:taskState(lwinAiComplete==='complete',lwinAiJob,Boolean(lwinAiCursor)),processed:lwinAiProcessed,total:lwinAiTotal,matched:lwinAiMatched,deterministic:lwinAiDeterministic,ai:lwinAiModel,review:lwinAiReview,error:lwinAiError||null}
 };
}

async function acquireLease(db:D1Database,kind:RolloutKind){
 const now=Math.floor(Date.now()/1000),until=now+leaseSeconds(kind),name=leaseKey(kind),value=String(until)+':'+crypto.randomUUID();
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
  const memberMetered=object.key.startsWith('shared/')?0:1;
  return env.DB.prepare('INSERT INTO stored_objects(object_key,owner_id,byte_size,counts_toward_member_limit,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(object_key) DO UPDATE SET byte_size=excluded.byte_size,counts_toward_member_limit=excluded.counts_toward_member_limit,updated_at=excluded.updated_at').bind(object.key,owner,object.size,memberMetered,stamp());
 }));
 const complete=!listing.truncated;
 await writeStates(env.DB,[['storage_cursor',complete?'':listing.cursor],...(complete?[['storage_inventory','complete'],[jobKey('storage'),'complete']] as Array<[string,string]>:[])]);
 return {complete,processed:listing.objects.length};
}

async function indexResearchBatch(env:RolloutEnv){
 const refreshing=await readState(env.DB,RESEARCH_REFRESH)==='running';
 if(await readState(env.DB,'research_index')==='complete'&&!refreshing)return {complete:true,processed:0};
 const cursor=await readState(env.DB,'research_cursor');
 const rows=await env.DB.prepare(`SELECT w.*,${RESEARCH_EDITION_COLUMNS} FROM wines w WHERE w.id>? ORDER BY w.id LIMIT ${RESEARCH_BATCH}`).bind(cursor).all<Record<string,unknown>>();
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
  if(complete)await writeStates(env.DB,[['research_index','complete'],[jobKey('research'),'complete'],...(refreshing?[[RESEARCH_REFRESH,'complete']] as Array<[string,string]>:[])]);
 }
 return {complete,processed:rows.results.length+producerCount};
}

// Every wine and its durable counters/cursor commit together. An interruption can
// repeat a read or provider call, but can never count or skip a half-saved wine.
async function lwinBatch(env:RolloutEnv,kind:'lwin'|'lwin_validate'|'lwin_ai',lease:{value:string}){
 if(await readState(env.DB,completionKey(kind))==='complete')return {complete:true,processed:0};
 const prefix=kind,cursor=await readState(env.DB,prefix+'_cursor'),limit=kind==='lwin'?LWIN_BATCH:kind==='lwin_validate'?LWIN_VALIDATE_BATCH:LWIN_AI_BATCH;
 const filter=kind==='lwin_ai'?"lwin7 IS NULL AND coalesce(identity_match_status,'') NOT IN ('manual','conflict')":kind==='lwin_validate'?"lwin7 IS NOT NULL AND identity_match_status IN ('matched','conflict')":"coalesce(identity_match_status,'')<>'manual' OR lwin7 IS NOT NULL";
 const rows=await env.DB.prepare(`SELECT * FROM wines WHERE id>? AND (${filter}) ORDER BY id LIMIT ${limit}`).bind(cursor).all<StoredLwinWine>();
 const scope=new ReferenceReadScope(env.REFERENCE_DATA);
 if(rows.results.length&&!await referenceManifest(scope,'lwin'))throw new Error('LWIN catalogue unavailable; resume to retry.');
 const counts:Record<string,number>={processed:0,matched:0,ambiguous:0,unmatched:0,conflict:0,verified:0,review:0,deterministic:0,ai:0};
 for(const row of rows.results){
  if(await readState(env.DB,jobKey(kind))!=='running')return {complete:false,...counts};
  const renewed=String(Math.floor(Date.now()/1000)+leaseSeconds(kind))+':'+crypto.randomUUID();
  const renewal=await env.DB.prepare('UPDATE rollout_state SET value=? WHERE name=? AND value=?').bind(renewed,leaseKey(kind),lease.value).run();
  if(!renewal.meta.changes)throw new Error('LWIN lease expired; resume to retry.');lease.value=renewed;
  let result:ReferenceMatch|null=null,lookupTooBroad=false;
  let method:'deterministic'|'ai'|'manual'=readLwinReference(row.lwin_reference_json)?.method??(row.identity_match_status==='manual'?'manual':'deterministic');
  try{
   result=await resolveStoredLwin(scope,row);
   if(kind==='lwin_ai'&&result?.identityMatchStatus!=='matched'&&result?.identityMatchStatus!=='ambiguous'){
    const input=lwinInput(row),repairWine={...row,id:row.id,owner_id:row.owner_id,producer:input.producer,wine_name:input.wineName,country:input.country,region:input.region,wine_style:input.wineStyle,release_designation:input.releaseDesignation,vintage:input.vintage,appellation:input.appellation,classification:input.classification,colour:input.colour,product_type:input.productType,product_subtype:input.productSubtype};
    const candidates=await repairCandidates(env.REFERENCE_DATA,repairWine),choice=await aiRepair(env,repairWine,candidates);
    if(choice){const selected=candidates.find(item=>item.row.lwin7===choice.lwin7)!.row;result=await referenceMatchForProduct(scope,selected,input);result.identityMatchConfidence=choice.confidence;method=choice.method}
   }
   }catch(error){
   // A bounded lookup is a per-wine review outcome, not a catalogue outage.
   // Never retry AI with truncated candidates or swallow missing-shard errors.
   if(!(error instanceof LwinProducerLookupTooBroadError))throw error;
   lookupTooBroad=true;result=null;
   console.warn(JSON.stringify({event:'lwin_lookup_needs_review',wineId:row.id,rollout:kind,reason:'producer_lookup_too_broad'}));
  }
  const status=row.identity_match_status==='manual'&&row.lwin7?'matched':row.lwin7&&result?.lwin7!==row.lwin7?'conflict':result?.identityMatchStatus??'unmatched';
  const statement=lookupTooBroad
   ?row.identity_match_status==='manual'?null:lwinUpdate(env.DB,row,{identity_match_status:status,identity_match_confidence:null,identity_checked_at:stamp()})
   :result?lwinEnrichmentStatement(env.DB,row,result,method):null;
  const delta:Record<string,number>={processed:1};
  if(kind==='lwin_validate')delta[status==='matched'?'verified':'review']=1;
  else if(kind==='lwin_ai'){if(status==='matched'){delta.matched=1;delta[method==='ai'?'ai':'deterministic']=1}else delta.review=1}
  else delta[['matched','ambiguous','conflict'].includes(status)?status:'unmatched']=1;
  // If the wine changed during R2/AI I/O, abort the transaction and retry it from
  // the unchanged checkpoint. The assertion is implemented as a guarded cursor:
  // all statements are local SQL and no network work happens inside the batch.
  const checkpoint=env.DB.prepare('INSERT INTO rollout_state(name,value) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET value=excluded.value').bind(prefix+'_cursor',row.id);
  const counterStatements=Object.entries(delta).map(([key,value])=>env.DB.prepare('INSERT INTO rollout_state(name,value) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET value=CAST(rollout_state.value AS INTEGER)+CAST(excluded.value AS INTEGER)').bind(prefix+'_'+(key==='ai'?'model':key),String(value)));
  if(kind==='lwin_ai')counterStatements.push(env.DB.prepare("UPDATE rollout_state SET value='0' WHERE name IN ('lwin_ai_retry_count','lwin_ai_retry_at')"));
  // The update's compare-and-swap is checked before advancing. D1 batches are
  // transactional; a failed guard raises a constraint violation and rolls back.
  const assertion=statement?env.DB.prepare(`INSERT INTO rollout_state(name,value) SELECT 'lwin_assertion',NULL WHERE changes()=0`):null;
  try{
   await env.DB.batch([env.DB.prepare("INSERT INTO rollout_state(name,value) SELECT 'lwin_assertion',NULL WHERE NOT EXISTS(SELECT 1 FROM rollout_state WHERE name=? AND value=? AND CAST(value AS INTEGER)>?)").bind(leaseKey(kind),lease.value,Math.floor(Date.now()/1000)),...(statement?[statement,assertion!]:[]),checkpoint,...counterStatements]);
  }catch(error){
   if(String(error).includes('NOT NULL constraint failed: rollout_state.value'))throw new Error(`Wine ${row.id} changed or its LWIN processing lease expired. Resume to retry.`,{cause:error});
   throw error;
  }
  for(const [key,value] of Object.entries(delta))counts[key]+=value;
 }
 const complete=rows.results.length<limit&&await readState(env.DB,jobKey(kind))==='running';
 if(complete)await env.DB.batch([completionKey(kind),jobKey(kind)].map(name=>env.DB.prepare('INSERT INTO rollout_state(name,value) SELECT ?,? WHERE EXISTS(SELECT 1 FROM rollout_state WHERE name=? AND value=?) ON CONFLICT(name) DO UPDATE SET value=excluded.value').bind(name,'complete',leaseKey(kind),lease.value)));
 return {complete,...counts};
}

/** Process one bounded chunk. Queue chaining makes the overall job independent of the page lifetime. */
export async function processRolloutJob(env:RolloutEnv,kind:RolloutKind,job?:RolloutQueueJob){
 if(await readState(env.DB,jobKey(kind))!=='running')return {complete:false,processed:0,busy:false,paused:true};
 if(job?.generation!==undefined&&(job.generation!==await readState(env.DB,`rollout_${kind}_generation`)||job.cursor!==await readState(env.DB,`${kind}_cursor`)))return {complete:false,processed:0,busy:false,stale:true};
 const acquired=await acquireLease(env.DB,kind);if(!acquired)return {complete:false,processed:0,busy:true};
 const lease={value:acquired};
 try{
  // A refresh may have acquired the lease between the initial check and ours.
  if(job?.generation!==undefined&&(job.generation!==await readState(env.DB,`rollout_${kind}_generation`)||job.cursor!==await readState(env.DB,`${kind}_cursor`)))return {complete:false,processed:0,busy:false,stale:true};
  if(kind==='lwin_ai'){
   const retryAfterSeconds=await readCount(env.DB,'lwin_ai_retry_at')-Math.floor(Date.now()/1000);
   if(retryAfterSeconds>0)return {complete:false,processed:0,busy:false,retryAfterSeconds};
  }
  await writeState(env.DB,errorKey(kind),'');
  const result=kind==='storage'?await inventoryStorageBatch(env):kind==='research'?await indexResearchBatch(env):await lwinBatch(env,kind,lease);
  const stillRunning=await readState(env.DB,jobKey(kind))==='running';
  if(!result.complete&&stillRunning)await dispatchRollout(env,kind);
  return {...result,busy:false,...(!result.complete&&!stillRunning?{paused:true}: {})};
 }catch(error){
  const message=error instanceof Error?error.message:String(error);
  if(await readState(env.DB,leaseKey(kind))===lease.value){
   if(kind==='lwin_ai'&&error instanceof LwinAiTransientError&&await readState(env.DB,jobKey(kind))==='running'){
    const retries=await readCount(env.DB,'lwin_ai_retry_count');
    if(retries<2){
     const retryAfterSeconds=60*2**retries+Math.floor(Math.random()*15);
     await writeStates(env.DB,[['lwin_ai_retry_count',String(retries+1)],['lwin_ai_retry_at',String(Math.floor(Date.now()/1000)+retryAfterSeconds)],[errorKey(kind),`${message.replace(/ Resume AI LWIN resolution to retry this wine\.$/,'')} Retrying automatically (${retries+1}/2) in ${retryAfterSeconds} seconds.`]]);
     return {complete:false,processed:0,busy:false,retryAfterSeconds};
    }
   }
   await writeStates(env.DB,[[errorKey(kind),message],[jobKey(kind),'paused']]);
  }
  if(kind==='lwin_ai'&&message.includes('LWIN producer index is missing'))return {complete:false,processed:0,busy:false,paused:true};
  throw error;
 }finally{await releaseLease(env.DB,kind,lease.value)}
}

/** The five-minute maintenance trigger repairs a lost/dead-lettered rollout dispatch. */
export async function recoverRollouts(env:RolloutEnv){
 for(const kind of ['storage','research','lwin','lwin_validate','lwin_ai'] as const){
  const refreshRunning=kind==='research'&&await readState(env.DB,RESEARCH_REFRESH)==='running';
  if(await readState(env.DB,completionKey(kind))==='complete'&&!refreshRunning)continue;
  if(await readState(env.DB,jobKey(kind))!=='running')continue;
  if(kind==='lwin_ai'&&await readCount(env.DB,'lwin_ai_retry_at')>Math.floor(Date.now()/1000))continue;
  if(Number.parseInt(await readState(env.DB,leaseKey(kind)))>Math.floor(Date.now()/1000))continue;
  await dispatchRollout(env,kind).catch(error=>console.error(JSON.stringify({event:'rollout_recovery_failed',kind,error:String(error)})));
 }
}

async function startRollout(env:RolloutEnv,member:Member,kind:RolloutKind,refresh=false){
 const lease=await acquireLease(env.DB,kind);
 if(!lease)return {accepted:false,alreadyRunning:true,status:await rolloutStatus(env.DB,member.id)};
 try{return await startRolloutLocked(env,member,kind,refresh)}finally{await releaseLease(env.DB,kind,lease)}
}
async function startRolloutLocked(env:RolloutEnv,member:Member,kind:RolloutKind,refresh=false){
 const [complete,job,refreshState,cursor]=await Promise.all([
  readState(env.DB,completionKey(kind)),readState(env.DB,jobKey(kind)),kind==='research'?readState(env.DB,RESEARCH_REFRESH):Promise.resolve(''),
  kind==='lwin'?readState(env.DB,'lwin_cursor'):kind==='lwin_validate'?readState(env.DB,'lwin_validate_cursor'):kind==='lwin_ai'?readState(env.DB,'lwin_ai_cursor'):Promise.resolve('')
 ]);
 if(job==='running')return {accepted:false,alreadyRunning:true,status:await rolloutStatus(env.DB,member.id)};
 const resumingRefresh=kind==='research'&&refreshState==='paused';
 if(complete==='complete'&&!refresh&&!resumingRefresh)return {accepted:false,alreadyComplete:true,status:await rolloutStatus(env.DB,member.id)};
 if(refresh&&kind==='storage')throw new ApiError(400,'Storage inventory cannot be refreshed from this endpoint');
 const entries:Array<[string,string]>=[[jobKey(kind),'running'],[errorKey(kind),'']];
 if(kind==='lwin_ai')entries.push(['lwin_ai_retry_count','0'],['lwin_ai_retry_at','0']);
 if(kind.startsWith('lwin')){
  // A new generation also permits explicit retry of a completed ambiguous run.
  if(refresh||!await readState(env.DB,`rollout_${kind}_generation`))entries.push([`rollout_${kind}_generation`,crypto.randomUUID()]);
  // Explicit resume reopens the current logical dispatch, not a second job.
  const generation=await readState(env.DB,`rollout_${kind}_generation`),id=`rollout:${kind}:${generation}:${cursor}`;
  await env.DB.batch([env.DB.prepare('UPDATE queue_deliveries SET done=0,lease_until=0 WHERE id=?').bind(id),env.DB.prepare('UPDATE queue_outbox SET sent_at=NULL,due_at=0 WHERE id=?').bind(id)]);
 }
 if(kind==='research'&&(refresh||resumingRefresh)){
  entries.push([RESEARCH_REFRESH,'running']);
  if(refresh)entries.push(['research_cursor',''],['producer_research_cursor','']);
 }
 if(kind==='lwin_validate'&&(refresh||(!cursor&&complete!=='complete'))){
  const total=await env.DB.prepare("SELECT count(*) AS n FROM wines WHERE lwin7 IS NOT NULL AND identity_match_status IN ('matched','conflict')").first<{n:number}>();
  entries.push(['lwin_validation',''],['lwin_validate_cursor',''],['lwin_validate_started_at',stamp()],['lwin_validate_total',String(Number(total?.n)||0)],['lwin_validate_processed','0'],['lwin_validate_verified','0'],['lwin_validate_review','0']);
 }
 if(kind==='lwin_ai'&&(refresh||(!cursor&&complete!=='complete'))){
  const total=await env.DB.prepare("SELECT count(*) AS n FROM wines WHERE lwin7 IS NULL AND coalesce(identity_match_status,'') NOT IN ('manual','conflict')").first<{n:number}>();
  entries.push(['lwin_ai_backfill',''],['lwin_ai_cursor',''],['lwin_ai_total',String(Number(total?.n)||0)],['lwin_ai_processed','0'],['lwin_ai_matched','0'],['lwin_ai_deterministic','0'],['lwin_ai_model','0'],['lwin_ai_review','0']);
 }
 if(kind==='lwin'&&(refresh||(!cursor&&complete!=='complete'))){
  const total=await env.DB.prepare("SELECT count(*) AS n FROM wines WHERE coalesce(identity_match_status,'')<>'manual' OR lwin7 IS NOT NULL").first<{n:number}>();
  entries.push(['lwin_backfill',''],['lwin_cursor',''],['lwin_total',String(Number(total?.n)||0)],['lwin_processed','0'],['lwin_matched','0'],['lwin_ambiguous','0'],['lwin_unmatched','0'],['lwin_conflict','0']);
 }
 await writeStates(env.DB,entries);
 try{await dispatchRollout(env,kind,member.id)}
 catch(error){const failed:Array<[string,string]>=[[jobKey(kind),'paused'],[errorKey(kind),error instanceof Error?error.message:String(error)]];if(kind==='research'&&(refresh||resumingRefresh))failed.push([RESEARCH_REFRESH,'paused']);await writeStates(env.DB,failed);throw new ApiError(503,'Could not start the background rollout job')}
 return {accepted:true,refreshing:(kind==='research'&&Boolean(refresh||resumingRefresh))||((kind==='lwin'||kind==='lwin_validate'||kind==='lwin_ai')&&refresh),status:await rolloutStatus(env.DB,member.id)};
}

async function pauseRollout(env:RolloutEnv,kind:RolloutKind,member:Member){
 const job=await readState(env.DB,jobKey(kind));
 if(job!=='running')return {accepted:false,alreadyPaused:job==='paused',status:await rolloutStatus(env.DB,member.id)};
 const entries:Array<[string,string]>=[[jobKey(kind),'paused']];
 if(kind==='research'&&await readState(env.DB,RESEARCH_REFRESH)==='running')entries.push([RESEARCH_REFRESH,'paused']);
 await writeStates(env.DB,entries);
 return {accepted:true,status:await rolloutStatus(env.DB,member.id)};
}

/** Owner-only launch preparation: POST starts/resumes/refreshes, GET reports durable progress. */
export async function rolloutRoute(request:Request,env:RolloutEnv,member:Member):Promise<Response|null>{
 const path=new URL(request.url).pathname;if(!path.startsWith('/api/admin/rollout/'))return null;ownerOnly(member);
 if(path==='/api/admin/rollout/lwin-review'&&request.method==='GET'){
  const cursor=new URL(request.url).searchParams.get('after')??'';
  const [rows,count]=await Promise.all([
   env.DB.prepare(`SELECT id,producer,wine_name,vintage,lwin7,identity_match_status,reference_suggestions_json FROM wines WHERE owner_id=? AND ${pendingReferenceReviewSql} AND id>? ORDER BY id LIMIT 41`).bind(member.id,cursor).all<Record<string,unknown>>(),
   env.DB.prepare(`SELECT count(*) AS n FROM wines WHERE owner_id=? AND ${pendingReferenceReviewSql}`).bind(member.id).first<{n:number}>()
  ]);
  const items=rows.results.slice(0,40).map(row=>({id:String(row.id),producer:String(row.producer??''),wineName:String(row.wine_name??''),vintage:row.vintage,lwin7:row.lwin7,conflict:row.identity_match_status==='conflict'}));
  return json({items,total:Number(count?.n)||0,nextCursor:rows.results.length>40?items.at(-1)!.id:null});
 }
 if(path==='/api/admin/rollout/status'&&request.method==='GET')return json(await rolloutStatus(env.DB,member.id));
 if(request.method!=='POST')throw new ApiError(405,'Use POST');
 const pause=path.match(/^\/api\/admin\/rollout\/(storage|research|lwin|lwin-validate|lwin-ai)\/pause$/);
 if(pause){
  const kind:RolloutKind=pause[1]==='lwin-ai'?'lwin_ai':pause[1]==='lwin-validate'?'lwin_validate':pause[1] as RolloutKind;
  return json(await pauseRollout(env,kind,member),202);
 }
 if(path==='/api/admin/rollout/storage')return json(await startRollout(env,member,'storage'),202);
 if(path==='/api/admin/rollout/research'){
  const data=await request.json().catch(()=>({})) as {refresh?:unknown};
  return json(await startRollout(env,member,'research',data.refresh===true),202);
 }
 if(path==='/api/admin/rollout/lwin'){
  const data=await request.json().catch(()=>({})) as {refresh?:unknown};
  return json(await startRollout(env,member,'lwin',data.refresh===true),202);
 }
 if(path==='/api/admin/rollout/lwin-validate'){
  const data=await request.json().catch(()=>({})) as {refresh?:unknown};
  return json(await startRollout(env,member,'lwin_validate',data.refresh===true),202);
 }
 if(path==='/api/admin/rollout/lwin-ai'){
  const data=await request.json().catch(()=>({})) as {refresh?:unknown};
  return json(await startRollout(env,member,'lwin_ai',data.refresh===true),202);
 }
 throw new ApiError(404,'Unknown rollout task');
}
