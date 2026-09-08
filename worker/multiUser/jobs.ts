import { ApiError,seconds,stamp } from './common';
import type { CreditOperation } from './credits';
import { reconcileOperation,settle } from './credits';
import { meteredBucket } from './storage';

export type JobEnvelope={owner?:string;kind?:string;requestId?:string;sessionId?:string;campaignId?:string;_creditOperationId?:string;_outboxId?:string};
export function durableQueue(queue:Queue<unknown>,db:D1Database,operationId?:string):Queue<unknown>{
 const send=async(value:unknown,options?:QueueSendOptions)=>{
  const job=value as JobEnvelope;
  let opId=operationId;
  if(!opId&&job.kind!=='recognition_batch_cleanup'){
   const op=await db.prepare("SELECT id FROM credit_operations WHERE user_id=? AND run_id=? AND status IN ('reserved','running','review') LIMIT 1").bind(job.owner??'',job.requestId||job.sessionId||job.campaignId||'').first<{id:string}>();opId=op?.id;
   if(!opId)throw new ApiError(402,'Background AI work requires a credit reservation');
  }
  const id=crypto.randomUUID();await db.prepare('INSERT INTO queue_outbox(id,operation_id,body_json,due_at) VALUES(?,?,?,?)').bind(id,opId??null,JSON.stringify({...job,_creditOperationId:opId,_outboxId:id}),seconds()+Math.max(0,options?.delaySeconds??0)).run();
 };
 return new Proxy(queue,{get(target,key){if(key==='send')return send;if(key==='sendBatch')return async(items:Iterable<MessageSendRequest<unknown>>)=>{for(const item of items)await send(item.body,{delaySeconds:item.delaySeconds})};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value}});
}
export async function flushOutbox(db:D1Database,queue:Queue<unknown>){
 const rows=(await db.prepare('SELECT id,body_json FROM queue_outbox WHERE sent_at IS NULL AND due_at<=? ORDER BY due_at LIMIT 4').bind(seconds()).all<{id:string;body_json:string}>()).results;
 for(const row of rows){
  try{await queue.send(JSON.parse(row.body_json));await db.prepare('UPDATE queue_outbox SET sent_at=?,attempts=attempts+1 WHERE id=?').bind(seconds(),row.id).run()}
  catch{await db.prepare('UPDATE queue_outbox SET attempts=attempts+1,due_at=? WHERE id=? AND sent_at IS NULL').bind(seconds()+60,row.id).run()}
 }
}
export async function maintainJobs(db:D1Database,queue:Queue<unknown>,bucket?:R2Bucket){
 // Queue expiry or a DLQ delivery cannot erase the durable dispatch record.
 await db.prepare(`UPDATE queue_outbox SET sent_at=NULL,due_at=? WHERE id IN (
 SELECT o.id FROM queue_outbox o LEFT JOIN queue_deliveries d ON d.id=o.id JOIN credit_operations c ON c.id=o.operation_id
 WHERE o.sent_at<? AND coalesce(d.done,0)=0 AND c.status IN ('running','reserved','review') LIMIT 20)`).bind(seconds(),seconds()-86400).run();
 await flushOutbox(db,queue);
 const rows=await db.prepare("SELECT * FROM credit_operations WHERE status IN ('running','reserved','review') ORDER BY updated_at LIMIT 2").all<CreditOperation>();
 for(const op of rows.results){
  if(op.status==='reserved'&&Date.parse(op.created_at)<Date.now()-15*60_000&&!await db.prepare('SELECT id FROM queue_outbox WHERE operation_id=? LIMIT 1').bind(op.id).first()){
   const claimed=await db.prepare("UPDATE credit_operations SET status='review' WHERE id=? AND status='reserved'").bind(op.id).run();if(claimed.meta.changes)await settle(db,op,0,{body:{error:'Reservation expired before dispatch'},status:409});
  }
  else await reconcileOperation(db,op);
  await db.prepare("UPDATE credit_operations SET updated_at=? WHERE id=? AND status IN ('running','reserved','review')").bind(stamp(),op.id).run();
 }
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
export async function claimDelivery(db:D1Database,id:string){
 return Boolean((await db.prepare('INSERT INTO queue_deliveries(id,lease_until) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET lease_until=excluded.lease_until WHERE queue_deliveries.done=0 AND queue_deliveries.lease_until<?').bind(id,seconds()+600,seconds()).run()).meta.changes);
}
export async function finishDelivery(db:D1Database,id:string,retry:boolean){await db.prepare('UPDATE queue_deliveries SET done=?,lease_until=? WHERE id=?').bind(retry?0:1,retry?0:seconds(),id).run()}
export async function markUncertain(db:D1Database,id:string){await db.prepare("UPDATE credit_operations SET status='review',updated_at=? WHERE id=? AND status IN ('reserved','running')").bind(stamp(),id).run()}
