import { ApiError,seconds,stamp } from './common';
import type { CreditOperation } from './credits';
import { reconcileOperation,settle } from './credits';
import { meteredBucket } from './storage';
import { outboxStatement } from '../../src/lib/credits/outbox';
import { WINE_RESEARCH_RECOVERY_MS } from '../../src/lib/research/recoveryPolicy';

/** Reuse the outbox and the existing poll handler to apply a late saved reply. */
async function recoverSavedWineReply(db:D1Database,op:CreditOperation){
 if(op.status!=='review'||!op.run_id||!op.path.endsWith('/deep-search')||Date.parse(op.created_at)<Date.now()-WINE_RESEARCH_RECOVERY_MS)return false;
 if(await db.prepare("SELECT id FROM provider_operations WHERE operation_id=? AND state IN ('submitted','uncertain') LIMIT 1").bind(op.id).first())return false;
 const job=await db.prepare(`SELECT b.id,b.target_id FROM research_batch_jobs b JOIN vertex_batch_emulation_jobs v ON 'vertex-batches/'||v.id=b.google_batch_name
  WHERE b.owner_id=? AND b.request_id=? AND b.status='failed' AND v.requests_json<>'[]' AND v.state='JOB_STATE_SUCCEEDED'
  ORDER BY b.attempt DESC LIMIT 1`).bind(op.user_id,op.run_id).first<{id:string;target_id:string}>();
 if(!job)return false;
 const id=`wine-recovery:${op.id}:${job.id}`;
 if(await db.prepare('SELECT id FROM queue_outbox WHERE id=?').bind(id).first())return false;
 try{await db.batch([
  outboxStatement(db,{kind:'wine_batch_poll',owner:op.user_id,wineId:job.target_id,requestId:op.run_id,jobId:job.id,pollCount:0},op.id,0,id),
  db.prepare("UPDATE research_batch_jobs SET status='running',updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM queue_outbox WHERE id=?)").bind(stamp(),job.id,id),
  db.prepare("UPDATE wine_research_runs SET status='running',stage='saving',completed_at=NULL,updated_at=? WHERE owner_id=? AND request_id=? AND EXISTS(SELECT 1 FROM queue_outbox WHERE id=?)").bind(stamp(),op.user_id,op.run_id,id),
  db.prepare("UPDATE credit_operations SET status='running',updated_at=? WHERE id=? AND status='review' AND EXISTS(SELECT 1 FROM queue_outbox WHERE id=?)").bind(stamp(),op.id,id)
 ])}catch(error){if(!await db.prepare('SELECT id FROM queue_outbox WHERE id=?').bind(id).first())throw error}
 return true;
}

export type JobEnvelope={owner?:string;kind?:string;requestId?:string;sessionId?:string;campaignId?:string;cleanup?:boolean;_creditOperationId?:string;_outboxId?:string};
/** Only these concrete handlers are cleanup-only; an arbitrary cleanup flag is not an AI exemption. */
export const isQueueCleanup=(job:JobEnvelope)=>job.kind==='recognition_batch_cleanup'||job.kind==='champagne_extraction'&&job.cleanup===true;
export function durableQueue(queue:Queue<unknown>,db:D1Database,operationId?:string):Queue<unknown>{
 const send=async(value:unknown,options?:QueueSendOptions)=>{
  const job=value as JobEnvelope,cleanup=isQueueCleanup(job);
  // Cleanup must survive settlement and never hold credits/budget open. Its
  // consumer receives an explicit provider denial, including for the owner.
  let opId=cleanup?undefined:operationId;
  if(!opId&&!cleanup){
   const op=await db.prepare("SELECT id FROM credit_operations WHERE user_id=? AND run_id=? AND status IN ('reserved','running','review') LIMIT 1").bind(job.owner??'',job.requestId||job.sessionId||job.campaignId||'').first<{id:string}>();opId=op?.id;
   if(!opId)throw new ApiError(402,'Background AI work requires a credit reservation');
  }
  await outboxStatement(db,job,opId,options?.delaySeconds).run();
 };
 return new Proxy(queue,{get(target,key){if(key==='send')return send;if(key==='sendBatch')return async(items:Iterable<MessageSendRequest<unknown>>)=>{for(const item of items)await send(item.body,{delaySeconds:item.delaySeconds})};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value}});
}
export async function flushOutbox(db:D1Database,queue:Queue<unknown>,operationId?:string){
 const rows=(await db.prepare('SELECT id,body_json FROM queue_outbox WHERE sent_at IS NULL AND due_at<=? AND (? IS NULL OR operation_id=?) ORDER BY due_at LIMIT 4').bind(seconds(),operationId??null,operationId??null).all<{id:string;body_json:string}>()).results;
 for(const row of rows){
  // Competing HTTP/cron/queue flushes may have read the same rows. Atomically
  // defer this row before sending; a crashed dispatcher becomes eligible again
  // after the lease. Delivery remains at-least-once and consumer claims still apply.
  const claimed=await db.prepare('UPDATE queue_outbox SET due_at=? WHERE id=? AND sent_at IS NULL AND due_at<=?').bind(seconds()+60,row.id,seconds()).run();
  if(!claimed.meta.changes)continue;
  try{await queue.send(JSON.parse(row.body_json));await db.prepare('UPDATE queue_outbox SET sent_at=?,attempts=attempts+1 WHERE id=?').bind(seconds(),row.id).run()}
  catch{await db.prepare('UPDATE queue_outbox SET attempts=attempts+1,due_at=? WHERE id=? AND sent_at IS NULL').bind(seconds()+60,row.id).run()}
 }
}
/** Reconcile one existing operation without reserving or submitting new AI work. */
export async function maintainOperation(db:D1Database,op:CreditOperation){
 if(!['reserved','running','review'].includes(op.status))return;
 if(await recoverSavedWineReply(db,op))return;
 const winePath=op.path.match(/^\/api\/wines\/([^/]+)\/deep-search$/);
 if((op.status==='reserved'||winePath)&&Date.parse(op.created_at)<Date.now()-15*60_000&&!await db.prepare('SELECT id FROM queue_outbox WHERE operation_id=? LIMIT 1').bind(op.id).first()){
  // HTTP can stop after marking the operation running but before dispatch.
  // Followers wait for their sponsor without dispatching their own work.
  // Only expire an operation that has never dispatched, submitted or followed.
  const claimed=await db.prepare(`UPDATE credit_operations SET status='review' WHERE id=? AND status IN ('reserved','running','review')
   AND NOT EXISTS(SELECT 1 FROM queue_outbox WHERE operation_id=?)
   AND NOT EXISTS(SELECT 1 FROM provider_operations WHERE operation_id=?)
   AND NOT EXISTS(SELECT 1 FROM research_followers WHERE operation_id=?)`).bind(op.id,op.id,op.id,op.id).run();
  if(claimed.meta.changes){
   if(winePath)await db.prepare(`UPDATE wine_research_runs SET status='failed',stage='failed',message='Reservation expired before dispatch',updated_at=?,completed_at=?
    WHERE owner_id=? AND wine_id=? AND started_at>=? AND status='running'`).bind(stamp(),stamp(),op.user_id,winePath[1],op.created_at).run();
   await settle(db,op,0,{body:{error:'Reservation expired before dispatch',supportId:op.run_id??op.id},status:409});
  }else await reconcileOperation(db,op);
 }
 else await reconcileOperation(db,op);
 await db.prepare("UPDATE credit_operations SET updated_at=? WHERE id=? AND status IN ('running','reserved','review')").bind(stamp(),op.id).run();
}

/**
 * Open operations reconciled per cron run (every five minutes). A held
 * operation costs about four indexed D1 queries, so a backlog after a provider
 * outage clears three times faster than the previous two per run, while each
 * run stays small. Raise with care: every run also does the cleanup below.
 */
export const MAINTAINED_OPERATIONS_PER_RUN=6;
export async function maintainJobs(db:D1Database,queue:Queue<unknown>,bucket?:R2Bucket){
 // Queue expiry or a DLQ delivery cannot erase the durable dispatch record.
 // Operation-free cleanup messages need the same recovery as active AI work.
 await db.prepare(`UPDATE queue_outbox SET sent_at=NULL,due_at=? WHERE id IN (
 SELECT o.id FROM queue_outbox o LEFT JOIN queue_deliveries d ON d.id=o.id LEFT JOIN credit_operations c ON c.id=o.operation_id
 WHERE o.sent_at<? AND coalesce(d.done,0)=0 AND (o.operation_id IS NULL OR c.status IN ('running','reserved','review')) LIMIT 20)`).bind(seconds(),seconds()-86400).run();
 const rows=await db.prepare("SELECT * FROM credit_operations WHERE status IN ('running','reserved','review') ORDER BY updated_at LIMIT ?").bind(MAINTAINED_OPERATIONS_PER_RUN).all<CreditOperation>();
 for(const op of rows.results)await maintainOperation(db,op);
 await flushOutbox(db,queue);
 await db.batch([
  db.prepare('DELETE FROM auth_sessions WHERE token_hash IN (SELECT token_hash FROM auth_sessions WHERE expires_at<? LIMIT 100)').bind(seconds()),
  db.prepare('DELETE FROM auth_flows WHERE state_hash IN (SELECT state_hash FROM auth_flows WHERE expires_at<? LIMIT 100)').bind(seconds()),
  db.prepare('DELETE FROM credit_quotes WHERE id IN (SELECT q.id FROM credit_quotes q LEFT JOIN credit_operations o ON o.quote_id=q.id WHERE q.expires_at<? AND o.id IS NULL LIMIT 100)').bind(seconds()),
  db.prepare(`DELETE FROM queue_outbox WHERE id IN (SELECT o.id FROM queue_outbox o
   JOIN queue_deliveries d ON d.id=o.id AND d.done=1 LEFT JOIN credit_operations c ON c.id=o.operation_id
   WHERE o.sent_at<? AND (o.operation_id IS NULL OR c.status IN ('complete','failed')) LIMIT 100)`).bind(seconds()-7*86400),
  db.prepare('DELETE FROM queue_deliveries WHERE id IN (SELECT d.id FROM queue_deliveries d LEFT JOIN queue_outbox o ON o.id=d.id WHERE d.done=1 AND d.lease_until<? AND o.id IS NULL LIMIT 100)').bind(seconds()-7*86400),
  db.prepare("DELETE FROM provider_operations WHERE id IN (SELECT p.id FROM provider_operations p JOIN credit_operations o ON o.id=p.operation_id WHERE o.status IN ('complete','failed') AND p.state='saved' AND p.updated_at<? LIMIT 100)").bind(new Date(Date.now()-7*86400_000).toISOString())
 ]);
 if(bucket){
  await db.prepare('DELETE FROM shared_photos WHERE image_id IN (SELECT p.image_id FROM shared_photos p LEFT JOIN wine_images i ON i.id=p.image_id WHERE i.wine_id IS NULL LIMIT 2)').run();
  const pending=await db.prepare('SELECT * FROM storage_deletions LIMIT 2').all<{object_key:string;owner_id:string}>();
  for(const row of pending.results){await meteredBucket(bucket,db,row.owner_id).delete(row.object_key);await db.prepare('DELETE FROM storage_deletions WHERE object_key=?').bind(row.object_key).run()}
 }
}
export async function claimDelivery(db:D1Database,id:string,leaseSeconds=600){
 const leaseUntil=seconds()+leaseSeconds;
 return (await db.prepare('INSERT INTO queue_deliveries(id,lease_until) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET lease_until=excluded.lease_until WHERE queue_deliveries.done=0 AND queue_deliveries.lease_until<?').bind(id,leaseUntil,seconds()).run()).meta.changes?leaseUntil:false;
}
export async function finishDelivery(db:D1Database,id:string,retry:boolean,leaseUntil:number|false){return Boolean((await db.prepare('UPDATE queue_deliveries SET done=?,lease_until=? WHERE id=? AND done=0 AND lease_until=?').bind(retry?0:1,retry?0:seconds(),id,leaseUntil||-1).run()).meta.changes)}
export async function markUncertain(db:D1Database,id:string){await db.prepare("UPDATE credit_operations SET status='review',updated_at=? WHERE id=? AND status IN ('reserved','running')").bind(stamp(),id).run()}
