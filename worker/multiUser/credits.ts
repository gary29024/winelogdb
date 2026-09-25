import { wineRowResearchTargets,loadWineResearchCache,loadResearchCache,type ResearchScope } from '../../src/lib/research/cache';
import { readableWine,researchWine,withSourceResearch } from '../../src/lib/research/readableWine';
import { unresearchedProducers } from '../../src/lib/producers/researchCampaign';
import { producerSubjectKey,reusableProducer } from '../../src/lib/research/sharedProducer';
import { sharedSubjectKeys } from '../../src/lib/research/shared';
import { producerRangeAllowed } from '../../src/lib/producers/rangeAccess';
import { readVintageWindow,type VintageSubject } from '../../src/lib/maturity/vintageWindow';
import { champagneExtractionRoute } from '../../src/lib/ai/reservedRoutes';
import { champagneInputFingerprint,readChampagnePhotos,readChampagneWine,requireChampagneWine } from '../champagneInput';
import { workKey,activeFriendWork } from './researchWork';
import { researchInputFingerprint } from './provider';
import { ApiError,boundedBytes,hash,json,seconds,settings,stamp,type Member } from './common';
import { WINE_RESEARCH_RECOVERY_MS } from '../../src/lib/research/recoveryPolicy';

export { requiresAiReservation as aiRoute } from '../../src/lib/ai/reservedRoutes';
export const CREDIT_ACTIONS=['scan_single','scan_batch','scan_group','scan_sheet','champagne_extraction','producer_research','producer_profile','wine_producer','wine_terroir','wine_vintage_context','wine_wine_vintage','vintage_window'] as const;
export type CreditAction=typeof CREDIT_ACTIONS[number];
export type CreditUnit={id:string;action:CreditAction;priceId:string;credits:number;targetId?:string;targetFingerprint?:string;researchKey?:string;resultId?:string;scope?:ResearchScope;cacheKey?:string;parentOperationId?:string;depth?:number;
 /** Why this scope could not be shared with friends, when it could not. Recorded
  * so a run that quietly misses reuse is visible rather than invisible. */
 notShareable?:string};
export type CreditOperation={id:string;user_id:string;path:string;fingerprint:string;units_json:string;reserved:number;captured:number;status:string;response_json:string|null;response_status:number|null;run_id:string|null;created_at:string;updated_at:string};
export type CreditEnv={DB:D1Database};
export const creditSummary=(op:CreditOperation)=>({status:op.status,captured:op.captured,reserved:['reserved','running','review'].includes(op.status)?op.reserved-op.captured:0});
/** Recognition clients validate a strict wine/group schema. Credit bookkeeping is transport metadata, not recognition data, so keep it off that public JSON contract while retaining it for async AI routes that consume the operation id. */
export function publicAiResponse(path:string,data:Record<string,unknown>,op:CreditOperation){
 if(path==='/api/recognition'){
  const recognition={...data};
  delete recognition.creditOperationId;delete recognition.creditSettlement;
  return recognition;
 }
 return {...data,creditOperationId:op.id,creditSettlement:data.creditSettlement??creditSummary(op)};
}
export async function requestFingerprint(request:Request){
 const bytes=await boundedBytes(request.clone().body,16*1024*1024);
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 return hash(`${new URL(request.url).pathname}|${request.headers.get('X-WineLog-Recognition-Mode')||'single'}|${request.headers.get('X-WineLog-Continuation')||''}|${digest}`);
}
export const wineTargets=wineRowResearchTargets;
export async function plannedUnits(request:Request,db:D1Database,user:string):Promise<Omit<CreditUnit,'priceId'|'credits'>[]>{
 const path=new URL(request.url).pathname;
 const data=request.headers.get('Content-Type')?.includes('application/json')?await request.clone().json() as Record<string,unknown>:{};
 const unit=(action:CreditAction,id='one',targetId?:string)=>({action,id,targetId});
 const champagne=champagneExtractionRoute(path);
 if(champagne){
  const wineId=decodeURIComponent(champagne[1]),wine=await readChampagneWine(db,user,wineId);
  requireChampagneWine(wine);
  const {imageIds}=await readChampagnePhotos(request.clone(),db,user,wineId);
  // One extraction of one bottle, even when several label photos are selected.
  return [{...unit('champagne_extraction',wineId,wineId),targetFingerprint:await champagneInputFingerprint(wine,imageIds)}];
 }
 if(path==='/api/recognition'){
  const form=await request.clone().formData().catch(()=>null),images=form?.getAll('images').filter(x=>typeof x!=='string')??[];
  if(!images.length||images.length>12)throw new ApiError(400,'Choose between 1 and 12 scan images');
  return images.map((_,i)=>unit(request.headers.get('X-WineLog-Recognition-Mode')==='group'?'scan_group':'scan_single',String(i)));
 }
 const sheet=path.match(/^\/api\/tastings\/([^/]+)\/sheet\/parse$/);
 if(sheet){
  if(!await db.prepare('SELECT id FROM tastings WHERE id=? AND owner_id=?').bind(sheet[1],user).first())throw new ApiError(404,'Tasting not found');
  const form=await request.clone().formData(),images=form.getAll('images').filter(x=>typeof x!=='string');if(images.length!==1)throw new ApiError(400,'Read one sheet page at a time');
  const cacheKey=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await images[0].arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
  const parentOperationId=request.headers.get('X-WineLog-Continuation')||undefined;let depth=0;
  if(parentOperationId){const parent=await db.prepare("SELECT units_json,response_json FROM credit_operations WHERE id=? AND user_id=? AND path=? AND status='complete'").bind(parentOperationId,user,path).first<{units_json:string;response_json:string}>();
   const previous=parent?JSON.parse(parent.units_json)[0] as CreditUnit:null,result=parent?JSON.parse(parent.response_json):null;
   if(!previous||previous.cacheKey!==cacheKey||!result?.truncated||Number(form.get('afterLine'))!==result.resumeAfterLine||(previous.depth??0)>=4)throw new ApiError(409,'Invalid sheet continuation');depth=(previous.depth??0)+1;
  }
  return [{...unit('scan_sheet',sheet[1],sheet[1]),cacheKey,parentOperationId,depth}];
 }
 const wine=path.match(/^\/api\/wines\/([^/]+)\/deep-search$/);
 if(wine){
  // Own or shared with this reader. A recipient pays only for the sections
  // neither they, a friend's published research, nor the owner already has.
  const found=await readableWine(db,user,wine[1]);if(!found)throw new ApiError(404,'Wine not found');
  // Keyed by the reader's own producer/cuvée, as execution keys it.
  const row=await researchWine(db,user,found,found.deep_search_json),own=row.source_owner_id===user;
  const refreshing=new Set<ResearchScope>(data.refresh==='all'?wineTargets(row).map(t=>t.scope):data.refresh==='vintage'?['wine_vintage','vintage_context']:[]);
  const targets=wineTargets(row),cache=await withSourceResearch(db,user,row,targets,await loadWineResearchCache(db,user,targets,true,own?found.deep_search_json:null),refreshing),targetFingerprint=await researchInputFingerprint('wine',row);
  return targets.filter(t=>data.refresh==='all'||(data.refresh==='vintage'&&['wine_vintage','vintage_context'].includes(t.scope))||!cache.has(t.scope)).map(t=>{
   const shared=sharedSubjectKeys(t),key=shared.keys[0];
   return {...unit(`wine_${t.scope}`,t.scope,wine[1]),scope:t.scope,cacheKey:t.cacheKey,targetFingerprint,researchKey:key?`${t.scope}:${key}`:undefined,notShareable:shared.skipped};
  });
 }
 const producer=path.match(/^\/api\/producers\/([^/]+)\/research$/);
 const rangeAllowed=await producerRangeAllowed(db,user);
 async function producerUnit(id:string){const row=await db.prepare('SELECT id,canonical_name,home_country FROM producers WHERE id=? AND owner_id=?').bind(id,user).first<Record<string,unknown>>();if(!row)throw new ApiError(404,'Producer not found');const key=producerSubjectKey(row);return {...unit(rangeAllowed?'producer_research':'producer_profile',id,id),targetFingerprint:await researchInputFingerprint('producer',row),researchKey:key?`producer:${key}`:undefined}}
 if(producer){const planned=await producerUnit(producer[1]);if(data.refresh!==true&&await reusableProducer(db,user,producer[1]))return [];return [planned]}
 if(path==='/api/producers/research-batch'){const units=[];for(const p of await unresearchedProducers(db,user,Math.min(8,Number(data.limit)||8)))if(!await reusableProducer(db,user,p.id))units.push(await producerUnit(p.id));return units}
 const batch=path.match(/^\/api\/batch-recognition\/sessions\/([^/]+)\/submit$/);
 if(batch){
  const rows=await db.prepare("SELECT i.id,p.id AS image_id FROM batch_recognition_items i JOIN batch_recognition_images p ON p.item_id=i.id AND p.owner_id=i.owner_id WHERE i.session_id=? AND i.owner_id=? AND i.status IN ('staged','failed') ORDER BY i.position,p.id").bind(batch[1],user).all<{id:string;image_id:string}>();
  if(!rows.results.length)throw new ApiError(400,'No staged scan images');return rows.results.map(row=>({...unit('scan_batch',row.image_id,batch[1]),resultId:row.id}));
 }
 if(path==='/api/maturity/vintage'){if(data.refresh!==true&&await readVintageWindow(db,user,data as VintageSubject,true))return [];return [unit('vintage_window')]}
 throw new ApiError(400,'Unknown AI action');
}
/** Browser request identity survives replacement of an HTTP retry key. */
async function reusableOperation(request:Request,db:D1Database,user:string,fingerprint:string){
 const path=new URL(request.url).pathname;
 if(/^\/api\/wines\/[^/]+\/deep-search$/.test(path)){
  const body=await request.clone().json() as {requestId?:unknown};
  if(typeof body.requestId==='string'&&body.requestId){
   const prior=await db.prepare('SELECT * FROM credit_operations WHERE user_id=? AND path=? AND run_id=? ORDER BY created_at DESC LIMIT 1').bind(user,path,body.requestId).first<CreditOperation>();
   if(prior){if(prior.fingerprint!==fingerprint)throw new ApiError(409,'Research request ID was used for different work');return prior}
  }
 }
 if(path==='/api/recognition'||path==='/api/maturity/vintage'||path.endsWith('/sheet/parse'))return null;
 return db.prepare("SELECT * FROM credit_operations WHERE user_id=? AND path=? AND status IN ('reserved','running','review') LIMIT 1").bind(user,path).first<CreditOperation>();
}
export async function quote(request:Request,env:CreditEnv,member:Member){
 await settings(env.DB);
 const fingerprint=await requestFingerprint(request);
 const existing=new URL(request.url).pathname.endsWith('/deep-search')?await reusableOperation(request,env.DB,member.id,fingerprint):null;
 const units:CreditUnit[]=[],prices=new Map<string,{id:string;credits:number}>();
 const sponsor=await activeFriendWork(env.DB,member.id,await workKey(env.DB,member.id,new URL(request.url).pathname,request));
 for(const unit of existing||sponsor?[]:await plannedUnits(request,env.DB,member.id)){
  // The owner pays provider bills directly and must keep the pre-rollout workflow
  // after cutover. Keep a zero-credit operation for idempotency/auditability, but
  // do not require the owner to invent member prices or grant credits to themself.
  if(member.role==='owner'){units.push({...unit,priceId:'owner-exempt',credits:0});continue}
  const price=prices.get(unit.action)??await env.DB.prepare('SELECT id,credits FROM credit_prices WHERE action=? ORDER BY created_at DESC,rowid DESC LIMIT 1').bind(unit.action).first<{id:string;credits:number}>();if(price)prices.set(unit.action,price);
  if(!price)throw new ApiError(503,`The owner has not priced ${unit.action.replaceAll('_',' ')}`);units.push({...unit,priceId:price.id,credits:unit.parentOperationId?0:price.credits});
 }
 if(!sponsor)await rejectOverlappingWork(env.DB,member.id,units);
 const id=crypto.randomUUID(),total=units.reduce((n,u)=>n+u.credits,0),expires=seconds()+600;
 await env.DB.prepare('INSERT INTO credit_quotes(id,user_id,path,fingerprint,units_json,total,expires_at) VALUES(?,?,?,?,?,?,?)').bind(id,member.id,new URL(request.url).pathname,fingerprint,JSON.stringify(units),total,expires).run();
 const wallet=await env.DB.prepare('SELECT balance,reserved FROM credit_wallets WHERE user_id=?').bind(member.id).first<{balance:number;reserved:number}>();
 return {id,total,units,expiresAt:expires,available:(wallet?.balance??0)-(wallet?.reserved??0),waitingForFriend:Boolean(sponsor),existingOperationId:existing?.id};
}
async function rejectOverlappingWork(db:D1Database,user:string,units:Array<{researchKey?:string}>){
 const keys=units.flatMap(unit=>unit.researchKey?[unit.researchKey]:[]);if(!keys.length)return;
 if(await db.prepare(`SELECT w.operation_id FROM research_work w JOIN friendships f ON f.friend_id=w.owner_id AND f.user_id=?
 WHERE w.subject_key IN (SELECT value FROM json_each(?)) LIMIT 1`).bind(user,JSON.stringify(keys)).first())throw new ApiError(409,'A friend is researching part of this request. Their result will be reused when it finishes; request a new quote then.');
}
export async function reserve(request:Request,env:CreditEnv,member:Member,observedUsd=0):Promise<{operation:CreditOperation;existing:boolean}>{
 const quoteId=request.headers.get('X-WineLog-Quote'),key=request.headers.get('Idempotency-Key');
 if(!quoteId||!key||key.length>128)throw new ApiError(402,'Review an AI credit quote before starting');
 const fingerprint=await requestFingerprint(request);
 const previous=await env.DB.prepare('SELECT * FROM credit_operations WHERE user_id=? AND request_key=?').bind(member.id,key).first<CreditOperation>();
 if(previous){if(previous.fingerprint!==fingerprint)throw new ApiError(409,'Idempotency key was used for different work');return {operation:previous,existing:true}}
 const path=new URL(request.url).pathname;
 const running=await reusableOperation(request,env.DB,member.id,fingerprint);
 if(running)return {operation:running,existing:true};
 const quoted=await env.DB.prepare('SELECT * FROM credit_quotes WHERE id=? AND user_id=? AND expires_at>?').bind(quoteId,member.id,seconds()).first<{path:string;fingerprint:string;units_json:string;total:number}>();
 if(!quoted||quoted.fingerprint!==fingerprint||quoted.path!==new URL(request.url).pathname)throw new ApiError(409,'Quote expired or request changed; review a new quote');
 const config=await settings(env.DB);
 if(config.cloudflareObservedMonth!==stamp().slice(0,7))throw new ApiError(503,'Owner must update this month’s Cloudflare usage estimate');
 if(config.cloudflareObservedUsd>=config.cloudflareStopUsd||!config.allowOverages&&config.cloudflareObservedUsd>0)throw new ApiError(503,'Cloudflare budget reached');
 // Keep the accepted tariff, but remove units that became reusable since quoting.
 const subjectKey=await workKey(env.DB,member.id,path,request),sponsor=await activeFriendWork(env.DB,member.id,subjectKey);
 const needed=sponsor?[]:await plannedUnits(request,env.DB,member.id),quotedUnits=JSON.parse(quoted.units_json) as CreditUnit[];
 if(needed.some(u=>!quotedUnits.some(q=>q.id===u.id&&q.action===u.action&&q.cacheKey===u.cacheKey&&q.targetFingerprint===u.targetFingerprint)))throw new ApiError(409,'Work changed; review a new quote');
 const units=quotedUnits.filter(q=>needed.some(u=>u.id===q.id&&u.action===q.action));
 if(!sponsor)await rejectOverlappingWork(env.DB,member.id,units);
 const lockKeys=[...new Set([...(subjectKey?[subjectKey]:[]),...units.flatMap(unit=>unit.researchKey?[unit.researchKey]:[])])];
 const total=units.reduce((n,u)=>n+u.credits,0),id=crypto.randomUUID(),now=stamp();
 try{
  await env.DB.batch([
   env.DB.prepare(`INSERT INTO credit_operations(id,user_id,request_key,quote_id,path,fingerprint,units_json,reserved,status,created_at,updated_at,budget_hold_usd)
    SELECT ?,?,?,?,?,?,?,?,'reserved',?,?,? WHERE
    (?=0 OR ((SELECT count(*) FROM credit_operations WHERE status IN ('reserved','running','review') AND units_json<>'[]')<? AND
    (SELECT count(*) FROM credit_operations WHERE created_at>=? AND units_json<>'[]')<? AND
    coalesce((SELECT sum(budget_hold_usd) FROM credit_operations WHERE status IN ('reserved','running','review')),0)+?+?<=?)) AND
    (?=1 OR NOT EXISTS(SELECT 1 FROM credit_operations WHERE user_id=? AND path=? AND status IN ('reserved','running','review'))) AND
    (?=0 OR NOT EXISTS(SELECT 1 FROM research_work w JOIN friendships f ON f.friend_id=w.owner_id AND f.user_id=? WHERE w.subject_key IN (SELECT value FROM json_each(?))))`)
    .bind(id,member.id,key,quoteId,quoted.path,fingerprint,JSON.stringify(units),total,now,now,units.length*config.aiUnitBudgetUsd,units.length,config.aiConcurrency,now.slice(0,10),config.aiDailyOperations,units.length*config.aiUnitBudgetUsd,observedUsd,config.aiMonthlyBudgetUsd,path==='/api/recognition'||path==='/api/maturity/vintage'||path.endsWith('/sheet/parse')?1:0,member.id,path,units.length,member.id,JSON.stringify(lockKeys)),
   // Foreign key + wallet CHECK constraints roll the entire batch back on rejection.
   env.DB.prepare("INSERT INTO credit_ledger(id,user_id,operation_id,kind,amount,actor_id,reason) VALUES(?,?,?,'reserve',?,?,?)").bind(`${id}:reserve`,member.id,id,total,member.id,'AI quote accepted'),
   ...(sponsor?[env.DB.prepare('INSERT INTO research_followers(operation_id,sponsor_operation_id,sponsor_id) VALUES(?,?,?)').bind(id,sponsor.id,sponsor.user_id)]:units.length>0?lockKeys.map(lockKey=>env.DB.prepare('INSERT INTO research_work(subject_key,operation_id,owner_id) VALUES(?,?,?)').bind(lockKey,id,member.id)):[]),
   ...units.filter(u=>u.parentOperationId).map(u=>env.DB.prepare('INSERT INTO sheet_continuations(parent_operation_id,operation_id) VALUES(?,?)').bind(u.parentOperationId!,id))
  ]);
 }catch{
  const raced=await env.DB.prepare('SELECT * FROM credit_operations WHERE user_id=? AND request_key=?').bind(member.id,key).first<CreditOperation>();
  if(raced&&raced.fingerprint===fingerprint)return {operation:raced,existing:true};
  const running=await reusableOperation(request,env.DB,member.id,fingerprint);
  if(running)return {operation:running,existing:true};
  throw new ApiError(409,'Insufficient available credits or AI capacity; no work was submitted');
 }
 const operation=await env.DB.prepare('SELECT * FROM credit_operations WHERE id=?').bind(id).first<CreditOperation>();if(!operation)throw new ApiError(503,'Could not reserve credits');return {operation,existing:false};
}
/**
 * The capture/release ledger pair that closes a reservation. Every settlement
 * path writes it through here so the amounts and reasons cannot drift apart.
 * `gate` makes both rows conditional on a claim made earlier in the same batch.
 */
function settlementLedger(db:D1Database,op:CreditOperation,captured:number,gate?:{sql:string;binds:unknown[]}){
 const amount=Math.min(op.reserved,Math.max(0,captured));
 return (['capture','release'] as const).map(kind=>db.prepare(`INSERT OR IGNORE INTO credit_ledger(id,user_id,operation_id,kind,amount,actor_id,reason)
  SELECT ?,?,?,?,?,?,?${gate?` WHERE ${gate.sql}`:''}`)
  .bind(`${op.id}:${kind}`,op.user_id,op.id,kind,kind==='capture'?amount:op.reserved-amount,op.user_id,kind==='capture'?'Validated AI results saved':'Unused AI reservation',...gate?.binds??[]));
}
export async function settle(db:D1Database,op:CreditOperation,captured:number,response?:{body:unknown;status:number},successful?:boolean){
 const amount=Math.min(op.reserved,Math.max(0,captured)),now=stamp();
 const complete=successful??(amount>0||response?.status===200);
 const finalResponse=response??(op.path.endsWith('/deep-search')&&op.run_id?{body:{researchRequestId:op.run_id,status:complete?'complete':'failed',...complete?{}:{error:'Deep Search did not complete',supportId:op.run_id}},status:complete?200:409}:undefined);
 await db.batch([
  ...(response?.body&&typeof response.body==='object'&&'cached' in response.body&&response.body.cached===true
   ?[db.prepare("DELETE FROM member_ai_action_usage WHERE operation_id=? AND status='pending'").bind(op.id)]:[]),
  ...settlementLedger(db,op,captured),
  db.prepare("UPDATE credit_operations SET captured=(SELECT amount FROM credit_ledger WHERE id=?),status=?,response_json=coalesce(?,response_json),response_status=coalesce(?,response_status),updated_at=? WHERE id=? AND status IN ('reserved','running','review')")
   .bind(`${op.id}:capture`,complete?'complete':'failed',finalResponse?JSON.stringify(finalResponse.body):null,finalResponse?.status??null,now,op.id),
  db.prepare('DELETE FROM research_work WHERE operation_id=?').bind(op.id)
 ]);
}
export async function saveOperationResponse(db:D1Database,op:CreditOperation,response:Response){
 const data=await response.clone().json().catch(()=>({error:'Invalid AI response'})) as Record<string,unknown>;
 if(await db.prepare("SELECT id FROM provider_operations WHERE operation_id=? AND state IN ('submitted','uncertain') LIMIT 1").bind(op.id).first()){
  await db.prepare("UPDATE credit_operations SET status='review',response_json=?,response_status=?,updated_at=? WHERE id=? AND status IN ('reserved','running','review')").bind(JSON.stringify(data),response.status,stamp(),op.id).run();
  const current=await db.prepare('SELECT * FROM credit_operations WHERE id=?').bind(op.id).first<CreditOperation>();
  return {...data,creditSettlement:current&&['complete','failed'].includes(current.status)?creditSummary(current):'held_for_reconciliation'};
 }
 const runId=String(data.researchRequestId||data.sessionId||(data.campaign as {id?:string}|undefined)?.id||(data.run as {requestId?:string}|undefined)?.requestId||'')||null;
 if(response.status===202){
  // Another request or cron can finish this job before the HTTP response is
  // saved. Never reopen terminal settlement, clear review, or lose its run ID.
  await db.prepare("UPDATE credit_operations SET status=CASE WHEN status='review' THEN 'review' ELSE 'running' END,response_json=?,response_status=?,run_id=coalesce(run_id,?),updated_at=? WHERE id=? AND status IN ('reserved','running','review')").bind(JSON.stringify(data),202,runId,stamp(),op.id).run();
 }else{
  const successful=response.ok&&!data.error;
  await settle(db,op,successful&&data.cached!==true?op.reserved:0,{body:data,status:response.status},successful);
 }
 const current=await db.prepare('SELECT * FROM credit_operations WHERE id=?').bind(op.id).first<CreditOperation>();return {...data,creditSettlement:creditSummary(current??op)};
}
async function validatedWineUnits(db:D1Database,op:CreditOperation){
 const units=JSON.parse(op.units_json) as CreditUnit[],wineId=units[0]?.targetId;
 if(!wineId)return [];
 const found=await readableWine(db,op.user_id,wineId);
 if(!found)return [];
 const row=await researchWine(db,op.user_id,found,found.deep_search_json);
 const cache=await loadResearchCache(db,op.user_id,wineTargets(row)),saved:CreditUnit[]=[];
 for(const unit of units){
  const entry=unit.scope&&cache.get(unit.scope);
  if(!entry||entry.target.cacheKey!==unit.cacheKey||Date.parse(entry.researchedAt)<Date.parse(op.created_at))continue;
  if(await db.prepare('SELECT 1 FROM research_cache WHERE owner_id=? AND scope=? AND cache_key=? AND (source_user_id IS NULL OR source_user_id=owner_id)').bind(op.user_id,unit.scope!,unit.cacheKey!).first())saved.push(unit);
 }
 return saved;
}
/** End a held wine request explicitly, retaining receipts and validated results. */
export async function stopWaitingForWineResearch(db:D1Database,op:CreditOperation){
 if(!op.path.endsWith('/deep-search'))throw new ApiError(400,'Not a wine research request');
 if(!['reserved','running','review'].includes(op.status))return {ok:true,cancelled:false,alreadyTerminal:true,requestId:op.run_id??op.id};
 const units=await validatedWineUnits(db,op),captured=Math.min(op.reserved,units.reduce((sum,unit)=>sum+unit.credits,0));
 const unresolved=Boolean(await db.prepare("SELECT 1 FROM provider_operations WHERE operation_id=? AND state IN ('submitted','uncertain') LIMIT 1").bind(op.id).first());
 const message=unresolved?'Stopped waiting for this request. The provider outcome is still unknown. Any saved research is kept.':'Stopped waiting for this request. Any saved research is kept.';
 const body=JSON.stringify({status:'failed',outcome:unresolved?'uncertain':'interrupted',stoppedWaiting:true,stopId:crypto.randomUUID(),error:message,supportId:op.run_id??op.id,researchRequestId:op.run_id}),now=stamp();
 // Claim and settle in one transaction. A consumer that already holds a lease
 // prevents the stop; one claiming later observes the terminal operation.
 const result=await db.batch([
  db.prepare(`UPDATE credit_operations SET status=?,captured=?,response_json=?,response_status=409,updated_at=?
   WHERE id=? AND status IN ('reserved','running','review')
   AND ((run_id IS NULL AND status='review') OR EXISTS(SELECT 1 FROM wine_research_runs r WHERE r.owner_id=credit_operations.user_id AND r.request_id=credit_operations.run_id AND r.status='failed'))
   AND NOT EXISTS(SELECT 1 FROM queue_outbox o JOIN queue_deliveries d ON d.id=o.id WHERE o.operation_id=credit_operations.id AND d.done=0 AND d.lease_until>?)`)
   .bind(units.length?'complete':'failed',captured,body,now,op.id,seconds()),
  ...settlementLedger(db,op,captured,{sql:'EXISTS(SELECT 1 FROM credit_operations WHERE id=? AND response_json=?)',binds:[op.id,body]}),
  db.prepare(`UPDATE research_batch_jobs SET status='failed',error=coalesce(error,?),updated_at=?
   WHERE owner_id=? AND request_id=? AND status='running' AND EXISTS(SELECT 1 FROM credit_operations WHERE id=? AND response_json=?)`).bind(message,now,op.user_id,op.run_id??'',op.id,body),
  db.prepare(`UPDATE wine_research_runs SET message=coalesce(message,'')||?,updated_at=?,completed_at=coalesce(completed_at,?)
   WHERE owner_id=? AND request_id=? AND status='failed' AND EXISTS(SELECT 1 FROM credit_operations WHERE id=? AND response_json=?)`)
   .bind(` · ${message}`,now,now,op.user_id,op.run_id??'',op.id,body),
  db.prepare('DELETE FROM research_work WHERE operation_id=? AND EXISTS(SELECT 1 FROM credit_operations WHERE id=? AND response_json=?)').bind(op.id,op.id,body)
 ]);
 if(!result[0].meta.changes){
  const current=await db.prepare('SELECT status FROM credit_operations WHERE id=?').bind(op.id).first<{status:string}>();
  if(current&&['complete','failed'].includes(current.status))return {ok:true,cancelled:false,alreadyTerminal:true,requestId:op.run_id??op.id};
  throw new ApiError(409,'Research is still finishing an active step. Check status and try stopping again in a few minutes.');
 }
 // The provider may still bill for a send whose outcome is unknown, while the
 // member is released. Log it so the owner can see that unrecovered cost.
 if(unresolved)console.warn(JSON.stringify({event:'deep_search_stopped_unresolved',operationId:op.id,userId:op.user_id,requestId:op.run_id??op.id,reserved:op.reserved,captured}));
 return {ok:true,cancelled:true,alreadyTerminal:false,stoppedWaiting:true,requestId:op.run_id??op.id};
}
export async function reconcileOperation(db:D1Database,op:CreditOperation){
 if(!['running','reserved','review'].includes(op.status))return;
 if(op.path.endsWith('/deep-search')&&Date.parse(op.created_at)<Date.now()-WINE_RESEARCH_RECOVERY_MS
  &&!await db.prepare("SELECT 1 FROM wine_research_runs WHERE owner_id=? AND request_id=? AND status='complete'").bind(op.user_id,op.run_id??'').first()){
  // Do not race a still-live queue invocation. The next maintenance pass can
  // close it after its finite delivery lease; new provider sends are fenced.
  const live=await db.prepare(`SELECT 1 FROM queue_outbox o JOIN queue_deliveries d ON d.id=o.id
   WHERE o.operation_id=? AND d.done=0 AND d.lease_until>? LIMIT 1`).bind(op.id,seconds()).first();
  if(live)return;
  const unresolved=await db.prepare("SELECT id FROM provider_operations WHERE operation_id=? AND state IN ('submitted','uncertain') LIMIT 1").bind(op.id).first();
  let captured=0,successfulUnits=0;
  for(const unit of await validatedWineUnits(db,op)){captured+=unit.credits;successfulUnits++}
  const supportId=op.run_id??op.id,outcome=unresolved?'uncertain':'interrupted';
  const message=unresolved?'WineLog could not confirm the research outcome within the recovery window. Any saved research is kept.':'Research recovery did not finish within the recovery window. Any saved research is kept.';
  // Keep provider rows and the original run diagnostic for owner investigation.
  if(op.run_id)await db.batch([
   db.prepare("UPDATE research_batch_jobs SET status='failed',error=coalesce(error,?),updated_at=? WHERE owner_id=? AND request_id=? AND status='running'").bind(message,stamp(),op.user_id,op.run_id),
   db.prepare("UPDATE wine_research_runs SET status='failed',stage='failed',message=coalesce(message,'')||?,updated_at=?,completed_at=? WHERE owner_id=? AND request_id=? AND status<>'complete'")
    .bind(` · ${message}`,stamp(),stamp(),op.user_id,op.run_id)
  ]);
  await settle(db,op,captured,{body:{status:'failed',outcome,error:message,supportId,researchRequestId:op.run_id},status:409},successfulUnits>0);
  return;
 }
 if(await db.prepare("SELECT id FROM provider_operations WHERE operation_id=? AND state IN ('submitted','uncertain') LIMIT 1").bind(op.id).first()){
  await db.prepare("UPDATE credit_operations SET status='review',updated_at=? WHERE id=? AND status IN ('reserved','running','review')").bind(stamp(),op.id).run();return;
 }
 const dependency=await db.prepare('SELECT * FROM research_followers WHERE operation_id=?').bind(op.id).first<{sponsor_operation_id:string;sponsor_id:string}>();
 if(dependency){
  const access=await db.prepare("SELECT 1 FROM friendships f JOIN app_users u ON u.id=f.friend_id AND u.status='active' WHERE f.user_id=? AND f.friend_id=?").bind(op.user_id,dependency.sponsor_id).first();
  const sponsor=await db.prepare('SELECT status FROM credit_operations WHERE id=?').bind(dependency.sponsor_operation_id).first<{status:string}>();
  if(!access||!sponsor||['complete','failed'].includes(sponsor.status))await settle(db,op,0,{body:{cached:Boolean(access&&sponsor?.status==='complete'),friendResearch:true},status:access&&sponsor?.status==='complete'?200:409},Boolean(access&&sponsor?.status==='complete'));
  return;
 }
 const units=JSON.parse(op.units_json) as CreditUnit[];let terminal=false,captured=0,successfulUnits=0;
 const first=units[0];
 if(first?.action==='champagne_extraction'&&op.run_id){
  const read=()=>db.prepare('SELECT status,created_at,updated_at FROM wine_champagne_extractions WHERE owner_id=? AND wine_id=? AND request_id=?').bind(op.user_id,first.targetId!,op.run_id!).first<{status:string;created_at:string;updated_at:string}>();
  let run=await read();
  // Maintenance also releases abandoned runs when the user never reopens the
  // wine. Never reset them to queued or repeat an uncertain paid submission.
  const interrupted=run&&['queued','running'].includes(run.status)&&Date.parse(run.updated_at)<Date.now()-15*60_000;
  const expired=run?.status==='submitted'&&Date.parse(run.created_at)<Date.now()-30*3600_000;
  if(run&&(interrupted||expired)){
   await db.prepare("UPDATE wine_champagne_extractions SET status='failed',error=?,updated_at=? WHERE owner_id=? AND wine_id=? AND request_id=? AND status=? AND updated_at=?")
    .bind(interrupted?'Extraction was interrupted. Please try again.':'Extraction exceeded the batch waiting period. Please try again.',stamp(),op.user_id,first.targetId!,op.run_id,run.status,run.updated_at).run();
   run=await read();
  }
  // Deleting the bottle (or superseding an old run) cannot strand its hold.
  terminal=!run||['complete','failed'].includes(run.status);
  successfulUnits=run?.status==='complete'?1:0;captured=successfulUnits?op.reserved:0;
 }else if(op.path.includes('/deep-search')&&op.run_id){
  const run=await db.prepare('SELECT status,attempt FROM wine_research_runs WHERE owner_id=? AND request_id=?').bind(op.user_id,op.run_id).first<{status:string;attempt:number}>();
  const active=await db.prepare("SELECT id FROM research_batch_jobs WHERE owner_id=? AND request_id=? AND status='running' LIMIT 1").bind(op.user_id,op.run_id).first();
  terminal=Boolean(run&&run.status!=='running'&&!active);
  if(terminal&&run?.status==='complete'&&run.attempt===0){
   await settle(db,op,0,{body:{cached:true,status:'complete',researchRequestId:op.run_id},status:200},true);return;
  }
  if(terminal)for(const unit of await validatedWineUnits(db,op)){captured+=unit.credits;successfulUnits++}
  if(terminal){
   const complete=run?.status==='complete';
   await settle(db,op,captured,{body:{researchRequestId:op.run_id,status:complete?'complete':'failed',...complete?successfulUnits?{}:{cached:true}:{partial:successfulUnits>0,error:'Deep Search did not complete. Any saved research is kept.',supportId:op.run_id}},status:complete?200:409},complete||successfulUnits>0);
   return;
  }
 }else if(first?.action==='scan_batch'){
  const rows=await db.prepare('SELECT id,status,recognition_json FROM batch_recognition_items WHERE owner_id=? AND session_id=?').bind(op.user_id,first.targetId!).all<{id:string;status:string;recognition_json:string|null}>();
  terminal=units.every(u=>rows.results.some(r=>r.id===(u.resultId??u.id)&&!['staged','submitted'].includes(r.status)));
  const successful=units.filter(u=>rows.results.some(r=>r.id===(u.resultId??u.id)&&r.recognition_json));
  successfulUnits=successful.length;captured=successful.reduce((sum,u)=>sum+u.credits,0);
 }else if((first?.action==='producer_research'||first?.action==='producer_profile')&&op.run_id){
  if(op.path==='/api/producers/research-batch'){
   const rows=await db.prepare('SELECT producer_id,status FROM producer_research_campaign_items WHERE campaign_id=?').bind(op.run_id).all<{producer_id:string;status:string}>();
   terminal=rows.results.length>0&&rows.results.every(r=>!['pending','running'].includes(r.status));
   const successful=units.filter(u=>rows.results.some(r=>r.producer_id===u.targetId&&r.status==='complete'));
   successfulUnits=successful.length;captured=successful.reduce((sum,u)=>sum+u.credits,0);
  }else{
   const run=await db.prepare('SELECT status FROM producer_research_runs WHERE owner_id=? AND request_id=?').bind(op.user_id,op.run_id).first<{status:string}>();
   const active=await db.prepare("SELECT id FROM research_batch_jobs WHERE owner_id=? AND request_id=? AND status='running' LIMIT 1").bind(op.user_id,op.run_id).first();
   terminal=Boolean(run&&run.status!=='running'&&!active);successfulUnits=run?.status==='complete'?1:0;captured=successfulUnits?op.reserved:0;
  }
 }
 if(terminal)await settle(db,op,captured,undefined,successfulUnits>0);
 else if(Date.parse(op.created_at)<Date.now()-48*3600_000)await db.prepare("UPDATE credit_operations SET status='review',updated_at=? WHERE id=? AND status IN ('reserved','running')").bind(stamp(),op.id).run();
}
export async function creditRead(request:Request,env:CreditEnv,member:Member):Promise<Response|null>{
 const path=new URL(request.url).pathname;if(request.method!=='GET')return null;
 if(path==='/api/credits')return json(await env.DB.prepare('SELECT balance,reserved,balance-reserved AS available FROM credit_wallets WHERE user_id=?').bind(member.id).first());
 if(path==='/api/credits/history')return json({items:(await env.DB.prepare('SELECT id,kind,amount,reason,created_at FROM credit_ledger WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT 100').bind(member.id).all()).results});
 if(path==='/api/credits/operations')return json({items:(await env.DB.prepare('SELECT id,path,status,reserved,captured,created_at FROM credit_operations WHERE user_id=? ORDER BY created_at DESC LIMIT 50').bind(member.id).all()).results});
 const match=path.match(/^\/api\/credits\/operations\/([^/]+)$/);if(match){
  let op=await env.DB.prepare('SELECT * FROM credit_operations WHERE id=? AND user_id=?').bind(match[1],member.id).first<CreditOperation>();if(!op)throw new ApiError(404,'Operation not found');
  if((op.units_json==='[]'&&op.status==='running')||champagneExtractionRoute(op.path)){
   await reconcileOperation(env.DB,op); // Reconciliation never submits provider work.
   op=await env.DB.prepare('SELECT * FROM credit_operations WHERE id=? AND user_id=?').bind(match[1],member.id).first<CreditOperation>()??op;
  }
  return json({id:op.id,status:op.status,runId:op.run_id,reserved:op.reserved,captured:op.captured,result:op.response_json?JSON.parse(op.response_json):null});
 }
 return null;
}
