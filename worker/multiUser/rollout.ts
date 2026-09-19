import { ApiError,json,ownerOnly,stamp,type IdentityEnv,type Member } from './common';
import { deepSearchSchema } from '../../src/lib/db/schema';
import { loadResearchCache,splitDeepSearchResult,upsertResearchCache } from '../../src/lib/research/cache';
import { publishResearch } from '../../src/lib/research/shared';
import { wineTargets } from './credits';
import { publishProducerResearch } from '../../src/lib/research/sharedProducer';
import { resolveWineReference,type VintageKind } from '../../src/lib/wine/referenceIdentity';
import { appClassification,buildReferenceSuggestions } from '../../src/lib/wine/referenceSuggestions';
import { aiRepair,repairCandidates } from './lwinRepair';
import type { GeminiTransportBindings } from '../geminiTransport';
import type { AiUsageEnv } from '../../src/lib/usage/aiUsage';
import type { LwinReferenceProduct } from '../../src/lib/wine/lwinImport';

export type RolloutKind='storage'|'research'|'lwin'|'lwin_ai';
export type RolloutQueueJob={kind:'admin_rollout';owner:string;rollout:RolloutKind};
type RolloutEnv=IdentityEnv&GeminiTransportBindings&AiUsageEnv&{WINE_IMAGES:R2Bucket;REFERENCE_DATA:R2Bucket;RESEARCH_QUEUE:Queue<unknown>};
type TaskState='not_started'|'paused'|'running'|'complete';
export type RolloutStatus={
 storage:{state:TaskState;objects:number;error:string|null};
 research:{state:TaskState;wines:{processed:number;total:number};producers:{processed:number;total:number};error:string|null};
 lwin:{state:TaskState;processed:number;total:number;matched:number;ambiguous:number;unmatched:number;conflict:number;error:string|null};
 lwinAi:{state:TaskState;processed:number;total:number;matched:number;deterministic:number;ai:number;review:number;error:string|null};
};

const STORAGE_BATCH=100,RESEARCH_BATCH=10,LWIN_BATCH=25,LWIN_AI_BATCH=1,LEASE_SECONDS=180,RESEARCH_REFRESH='rollout_research_refresh';
const jobKey=(kind:RolloutKind)=>`rollout_${kind}_job`;
const errorKey=(kind:RolloutKind)=>`rollout_${kind}_error`;
const leaseKey=(kind:RolloutKind)=>`rollout_${kind}_lease`;
const completionKey=(kind:RolloutKind)=>kind==='storage'?'storage_inventory':kind==='research'?'research_index':kind==='lwin'?'lwin_backfill':'lwin_ai_backfill';

async function readState(db:D1Database,name:string){return (await db.prepare('SELECT value FROM rollout_state WHERE name=?').bind(name).first<{value:string}>())?.value??''}
async function writeState(db:D1Database,name:string,value:string){await db.prepare('INSERT INTO rollout_state(name,value) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET value=excluded.value').bind(name,value).run()}
async function writeStates(db:D1Database,entries:Array<[string,string]>){if(entries.length)await db.batch(entries.map(([name,value])=>db.prepare('INSERT INTO rollout_state(name,value) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET value=excluded.value').bind(name,value)))}
async function readCount(db:D1Database,name:string){const value=Number(await readState(db,name));return Number.isFinite(value)&&value>=0?value:0}
function taskState(complete:boolean,running:boolean,hasCursor:boolean):TaskState{return running?'running':complete?'complete':hasCursor?'paused':'not_started'}

/** Owner-visible status survives navigation and browser restarts. */
export async function rolloutStatus(db:D1Database):Promise<RolloutStatus>{
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
 const [lwinAiComplete,lwinAiJob,lwinAiError,lwinAiCursor,lwinAiProcessed,lwinAiTotal,lwinAiMatched,lwinAiDeterministic,lwinAiModel,lwinAiReview]=await Promise.all([
  readState(db,'lwin_ai_backfill'),readState(db,jobKey('lwin_ai')),readState(db,errorKey('lwin_ai')),readState(db,'lwin_ai_cursor'),
  readCount(db,'lwin_ai_processed'),readCount(db,'lwin_ai_total'),readCount(db,'lwin_ai_matched'),readCount(db,'lwin_ai_deterministic'),readCount(db,'lwin_ai_model'),readCount(db,'lwin_ai_review')
 ]);
 const winesTotal=Number(wineTotal?.n)||0,producersTotal=Number(producerTotal?.n)||0,researchRefreshing=researchRefresh==='running'||researchRefresh==='paused';
 const [wineDone,producerDone]=await Promise.all([
  researchComplete==='complete'&&!researchRefreshing?Promise.resolve(winesTotal):wineCursor?db.prepare('SELECT count(*) AS n FROM wines WHERE id<=?').bind(wineCursor).first<{n:number}>().then(row=>Number(row?.n)||0):Promise.resolve(0),
  researchComplete==='complete'&&!researchRefreshing?Promise.resolve(producersTotal):producerCursor?db.prepare('SELECT count(*) AS n FROM producers WHERE id<=?').bind(producerCursor).first<{n:number}>().then(row=>Number(row?.n)||0):Promise.resolve(0)
 ]);
 const researchState:TaskState=researchJob==='running'?'running':researchRefresh==='paused'?'paused':taskState(researchComplete==='complete',false,Boolean(wineCursor||producerCursor));
 return {
  storage:{state:taskState(storageComplete==='complete',storageJob==='running',Boolean(await readState(db,'storage_cursor'))),objects:Number(storageObjects?.n)||0,error:storageError||null},
  research:{state:researchState,wines:{processed:wineDone,total:winesTotal},producers:{processed:producerDone,total:producersTotal},error:researchError||null},
  lwin:{state:taskState(lwinComplete==='complete',lwinJob==='running',Boolean(lwinCursor)),processed:lwinProcessed,total:lwinTotal,matched:lwinMatched,ambiguous:lwinAmbiguous,unmatched:lwinUnmatched,conflict:lwinConflict,error:lwinError||null},
  lwinAi:{state:taskState(lwinAiComplete==='complete',lwinAiJob==='running',Boolean(lwinAiCursor)),processed:lwinAiProcessed,total:lwinAiTotal,matched:lwinAiMatched,deterministic:lwinAiDeterministic,ai:lwinAiModel,review:lwinAiReview,error:lwinAiError||null}
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
  if(complete)await writeStates(env.DB,[['research_index','complete'],[jobKey('research'),'complete'],...(refreshing?[[RESEARCH_REFRESH,'complete']] as Array<[string,string]>:[])]);
 }
 return {complete,processed:rows.results.length+producerCount};
}

type LwinBackfillRow={
 id:string;owner_id:string;producer:string|null;wine_name:string|null;vintage:number|null;vintage_kind:VintageKind|null;release_designation:string|null;
 country:string|null;region:string|null;wine_style:string|null;classification:string|null;classification_override:string|null;
};

async function backfillLwinBatch(env:RolloutEnv){
 if(await readState(env.DB,'lwin_backfill')==='complete')return {complete:true,processed:0};
 const cursor=await readState(env.DB,'lwin_cursor');
 const rows=await env.DB.prepare(`SELECT id,owner_id,producer,wine_name,vintage,vintage_kind,release_designation,country,region,wine_style,classification,classification_override
   FROM wines WHERE id>? AND lwin7 IS NULL AND coalesce(identity_match_status,'')<>'manual'
   ORDER BY id LIMIT ${LWIN_BATCH}`).bind(cursor).all<LwinBackfillRow>();
 let matched=0,ambiguous=0,unmatched=0,conflict=0;
 for(const row of rows.results){
  const result=await resolveWineReference(env.REFERENCE_DATA,{
   producer:row.producer,wineName:row.wine_name,vintage:row.vintage,vintageKind:row.vintage_kind,releaseDesignation:row.release_designation,
   country:row.country,region:row.region,wineStyle:row.wine_style,classification:row.classification,classificationOverride:row.classification_override
  });
  if(result.identityMatchStatus==='matched'&&result.lwin7){
   const safeCountry=row.country?.trim()?row.country:result.country,safeRegion=row.region?.trim()?row.region:result.region;
   const safeClassification=row.classification??(!row.classification_override?appClassification(result.referenceClassification):null);
   const suggestions=buildReferenceSuggestions({
    producer:row.producer,wineName:row.wine_name,country:safeCountry,region:safeRegion,classification:safeClassification,classificationOverride:row.classification_override,
    referenceProducer:result.referenceProducer,referenceWineName:result.referenceWineName,referenceCountry:result.country,referenceRegion:result.region,referenceClassification:result.referenceClassification
   }),now=stamp();
   const saved=await env.DB.prepare(`UPDATE wines SET reference_product_key=?,lwin7=?,lwin11=?,elid=?,reference_site=?,reference_parcel=?,
      country=coalesce(nullif(trim(country),''),?),region=coalesce(nullif(trim(region),''),?),
      classification=CASE WHEN classification IS NULL AND classification_override IS NULL THEN coalesce(?,classification) ELSE classification END,
      colour=coalesce(colour,?),product_type=coalesce(product_type,?),product_subtype=coalesce(product_subtype,?),
      identity_match_status='matched',identity_match_confidence=?,identity_match_candidates_json=NULL,identity_matched_at=?,identity_checked_at=?,reference_suggestions_json=?,reference_suggestions_updated_at=?
      WHERE id=? AND owner_id=? AND lwin7 IS NULL AND coalesce(identity_match_status,'')<>'manual'`)
     .bind(result.referenceProductKey,result.lwin7,result.lwin11,result.elid,result.referenceSite,result.referenceParcel,result.country,result.region,safeClassification,result.colour,result.productType,result.productSubtype,
      result.identityMatchConfidence,now,now,suggestions.length?JSON.stringify(suggestions):null,suggestions.length?now:null,row.id,row.owner_id).run();
   if(saved.meta.changes)matched++;
  }else{
   const status=result.identityMatchStatus==='ambiguous'?'ambiguous':result.identityMatchStatus==='conflict'?'conflict':'unmatched',now=stamp();
   const saved=await env.DB.prepare(`UPDATE wines SET identity_match_status=?,identity_match_confidence=NULL,identity_match_candidates_json=?,identity_matched_at=NULL,identity_checked_at=?
      WHERE id=? AND owner_id=? AND lwin7 IS NULL AND coalesce(identity_match_status,'')<>'manual'`)
    .bind(status,result.identityMatchCandidates.length?JSON.stringify(result.identityMatchCandidates):null,now,row.id,row.owner_id).run();
   if(saved.meta.changes){if(status==='ambiguous')ambiguous++;else if(status==='conflict')conflict++;else unmatched++}
  }
 }
 const processed=rows.results.length,last=rows.results.at(-1)?.id??cursor,complete=processed<LWIN_BATCH;
 const [priorProcessed,priorMatched,priorAmbiguous,priorUnmatched,priorConflict]=await Promise.all([
  readCount(env.DB,'lwin_processed'),readCount(env.DB,'lwin_matched'),readCount(env.DB,'lwin_ambiguous'),readCount(env.DB,'lwin_unmatched'),readCount(env.DB,'lwin_conflict')
 ]);
 await writeStates(env.DB,[
  ['lwin_cursor',last],['lwin_processed',String(priorProcessed+processed)],['lwin_matched',String(priorMatched+matched)],
  ['lwin_ambiguous',String(priorAmbiguous+ambiguous)],['lwin_unmatched',String(priorUnmatched+unmatched)],['lwin_conflict',String(priorConflict+conflict)],
  ...(complete?[['lwin_backfill','complete'],[jobKey('lwin'),'complete']] as Array<[string,string]>:[])
 ]);
 return {complete,processed,matched,ambiguous,unmatched,conflict};
}

async function aiBackfillLwinBatch(env:RolloutEnv){
 if(await readState(env.DB,'lwin_ai_backfill')==='complete')return {complete:true,processed:0};
 const cursor=await readState(env.DB,'lwin_ai_cursor');
 const rows=await env.DB.prepare(`SELECT id,owner_id,producer,wine_name,vintage,vintage_kind,release_designation,country,region,wine_style,classification,classification_override FROM wines WHERE id>? AND lwin7 IS NULL AND identity_match_status IN ('unmatched','ambiguous','suggested') ORDER BY id LIMIT ${LWIN_AI_BATCH}`).bind(cursor).all<LwinBackfillRow>();
 let matched=0,deterministic=0,ai=0,review=0;
 for(const row of rows.results){
  const candidates=await repairCandidates(env.REFERENCE_DATA,row),choice=await aiRepair(env,row,candidates);
  if(!choice){review++;continue}
  const selected=candidates.find(item=>item.row.lwin7===choice.lwin7)?.row as LwinReferenceProduct|undefined;if(!selected){review++;continue}
  const result=await resolveWineReference(env.REFERENCE_DATA,{producer:selected.producerName,wineName:selected.wineName,vintage:row.vintage,vintageKind:row.vintage_kind,releaseDesignation:row.release_designation,country:row.country,region:row.region,wineStyle:row.wine_style,classification:row.classification,classificationOverride:row.classification_override});
  if(result.identityMatchStatus!=='matched'||result.lwin7!==choice.lwin7){review++;continue}
  const now=stamp(),suggestions=buildReferenceSuggestions({producer:row.producer,wineName:row.wine_name,country:row.country,region:row.region,classification:row.classification,classificationOverride:row.classification_override,referenceProducer:result.referenceProducer,referenceWineName:result.referenceWineName,referenceCountry:result.country,referenceRegion:result.region,referenceClassification:result.referenceClassification});
  const saved=await env.DB.prepare(`UPDATE wines SET reference_product_key=?,lwin7=?,lwin11=?,elid=?,reference_site=?,reference_parcel=?,colour=coalesce(colour,?),product_type=coalesce(product_type,?),product_subtype=coalesce(product_subtype,?),identity_match_status='matched',identity_match_confidence=?,identity_match_candidates_json=NULL,identity_matched_at=?,identity_checked_at=?,reference_suggestions_json=?,reference_suggestions_updated_at=? WHERE id=? AND owner_id=? AND lwin7 IS NULL AND coalesce(identity_match_status,'')<>'manual'`).bind(result.referenceProductKey,result.lwin7,result.lwin11,result.elid,result.referenceSite,result.referenceParcel,result.colour,result.productType,result.productSubtype,choice.confidence,now,now,suggestions.length?JSON.stringify(suggestions):null,suggestions.length?now:null,row.id,row.owner_id).run();
  if(saved.meta.changes){matched++;if(choice.method==='ai')ai++;else deterministic++}
 }
 const processed=rows.results.length,last=rows.results.at(-1)?.id??cursor,complete=processed<LWIN_AI_BATCH;
 const [p,m,d,a,r]=await Promise.all([readCount(env.DB,'lwin_ai_processed'),readCount(env.DB,'lwin_ai_matched'),readCount(env.DB,'lwin_ai_deterministic'),readCount(env.DB,'lwin_ai_model'),readCount(env.DB,'lwin_ai_review')]);
 await writeStates(env.DB,[['lwin_ai_cursor',last],['lwin_ai_processed',String(p+processed)],['lwin_ai_matched',String(m+matched)],['lwin_ai_deterministic',String(d+deterministic)],['lwin_ai_model',String(a+ai)],['lwin_ai_review',String(r+review)],...(complete?[['lwin_ai_backfill','complete'],[jobKey('lwin_ai'),'complete']] as Array<[string,string]>:[])]);
 return {complete,processed,matched,deterministic,ai,review};
}

/** Process one bounded chunk. Queue chaining makes the overall job independent of the page lifetime. */
export async function processRolloutJob(env:RolloutEnv,kind:RolloutKind){
 const lease=await acquireLease(env.DB,kind);if(!lease)return {complete:false,processed:0,busy:true};
 try{
  await writeState(env.DB,errorKey(kind),'');
  const result=kind==='storage'?await inventoryStorageBatch(env):kind==='research'?await indexResearchBatch(env):kind==='lwin'?await backfillLwinBatch(env):await aiBackfillLwinBatch(env);
  if(!result.complete)await env.RESEARCH_QUEUE.send({kind:'admin_rollout',owner:'owner',rollout:kind} satisfies RolloutQueueJob);
  return {...result,busy:false};
 }catch(error){
  const message=error instanceof Error?error.message:String(error);
  await writeStates(env.DB,[[errorKey(kind),message],[jobKey(kind),'paused']]);
  if(kind==='lwin_ai'&&message.includes('LWIN producer index is missing'))return {complete:false,processed:0,busy:false,paused:true};
  throw error;
 }finally{await releaseLease(env.DB,kind,lease)}
}

/** The five-minute maintenance trigger repairs a lost/dead-lettered rollout dispatch. */
export async function recoverRollouts(env:RolloutEnv){
 for(const kind of ['storage','research','lwin','lwin_ai'] as const){
  const refreshRunning=kind==='research'&&await readState(env.DB,RESEARCH_REFRESH)==='running';
  if(await readState(env.DB,completionKey(kind))==='complete'&&!refreshRunning)continue;
  if(await readState(env.DB,jobKey(kind))!=='running')continue;
  await env.RESEARCH_QUEUE.send({kind:'admin_rollout',owner:'owner',rollout:kind} satisfies RolloutQueueJob).catch(error=>console.error(JSON.stringify({event:'rollout_recovery_failed',kind,error:String(error)})));
 }
}

async function startRollout(env:RolloutEnv,member:Member,kind:RolloutKind,refresh=false){
 const [complete,job,refreshState,cursor]=await Promise.all([
  readState(env.DB,completionKey(kind)),readState(env.DB,jobKey(kind)),kind==='research'?readState(env.DB,RESEARCH_REFRESH):Promise.resolve(''),
  kind==='lwin'?readState(env.DB,'lwin_cursor'):kind==='lwin_ai'?readState(env.DB,'lwin_ai_cursor'):Promise.resolve('')
 ]);
 if(job==='running')return {accepted:false,alreadyRunning:true,status:await rolloutStatus(env.DB)};
 const resumingRefresh=kind==='research'&&refreshState==='paused';
 if(complete==='complete'&&!refresh&&!resumingRefresh)return {accepted:false,alreadyComplete:true,status:await rolloutStatus(env.DB)};
 if(refresh&&kind==='storage')throw new ApiError(400,'Storage inventory cannot be refreshed from this endpoint');
 const entries:Array<[string,string]>=[[jobKey(kind),'running'],[errorKey(kind),'']];
 if(kind==='research'&&(refresh||resumingRefresh)){
  entries.push([RESEARCH_REFRESH,'running']);
  if(refresh)entries.push(['research_cursor',''],['producer_research_cursor','']);
 }
 if(kind==='lwin_ai'&&(refresh||(!cursor&&complete!=='complete'))){
  const total=await env.DB.prepare("SELECT count(*) AS n FROM wines WHERE lwin7 IS NULL AND identity_match_status IN ('unmatched','ambiguous','suggested')").first<{n:number}>();
  entries.push(['lwin_ai_backfill',''],['lwin_ai_cursor',''],['lwin_ai_total',String(Number(total?.n)||0)],['lwin_ai_processed','0'],['lwin_ai_matched','0'],['lwin_ai_deterministic','0'],['lwin_ai_model','0'],['lwin_ai_review','0']);
 }
 if(kind==='lwin'&&(refresh||(!cursor&&complete!=='complete'))){
  const total=await env.DB.prepare("SELECT count(*) AS n FROM wines WHERE lwin7 IS NULL AND coalesce(identity_match_status,'')<>'manual'").first<{n:number}>();
  entries.push(['lwin_backfill',''],['lwin_cursor',''],['lwin_total',String(Number(total?.n)||0)],['lwin_processed','0'],['lwin_matched','0'],['lwin_ambiguous','0'],['lwin_unmatched','0'],['lwin_conflict','0']);
 }
 await writeStates(env.DB,entries);
 try{await env.RESEARCH_QUEUE.send({kind:'admin_rollout',owner:member.id,rollout:kind} satisfies RolloutQueueJob)}
 catch(error){const failed:Array<[string,string]>=[[jobKey(kind),'paused'],[errorKey(kind),error instanceof Error?error.message:String(error)]];if(kind==='research'&&(refresh||resumingRefresh))failed.push([RESEARCH_REFRESH,'paused']);await writeStates(env.DB,failed);throw new ApiError(503,'Could not start the background rollout job')}
 return {accepted:true,refreshing:(kind==='research'&&Boolean(refresh||resumingRefresh))||(kind==='lwin'&&refresh),status:await rolloutStatus(env.DB)};
}

/** Owner-only launch preparation: POST starts/resumes/refreshes, GET reports durable progress. */
export async function rolloutRoute(request:Request,env:RolloutEnv,member:Member):Promise<Response|null>{
 const path=new URL(request.url).pathname;if(!path.startsWith('/api/admin/rollout/'))return null;ownerOnly(member);
 if(path==='/api/admin/rollout/status'&&request.method==='GET')return json(await rolloutStatus(env.DB));
 if(request.method!=='POST')throw new ApiError(405,'Use POST');
 if(path==='/api/admin/rollout/storage')return json(await startRollout(env,member,'storage'),202);
 if(path==='/api/admin/rollout/research'){
  const data=await request.json().catch(()=>({})) as {refresh?:unknown};
  return json(await startRollout(env,member,'research',data.refresh===true),202);
 }
 if(path==='/api/admin/rollout/lwin'){
  const data=await request.json().catch(()=>({})) as {refresh?:unknown};
  return json(await startRollout(env,member,'lwin',data.refresh===true),202);
 }
 if(path==='/api/admin/rollout/lwin-ai'){
  const data=await request.json().catch(()=>({})) as {refresh?:unknown};
  return json(await startRollout(env,member,'lwin_ai',data.refresh===true),202);
 }
 throw new ApiError(404,'Unknown rollout task');
}
