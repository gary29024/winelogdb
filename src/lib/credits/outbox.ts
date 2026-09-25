/** One durable dispatch record, also usable inside a caller's D1 transaction. */
export function outboxStatement(db:D1Database,job:unknown,operationId?:string,delaySeconds=0,id:string=crypto.randomUUID()){
 return db.prepare(`INSERT INTO queue_outbox(id,operation_id,body_json,due_at)
  SELECT ?,?,?,? WHERE ? IS NULL OR EXISTS(SELECT 1 FROM credit_operations WHERE id=? AND status IN ('reserved','running','review'))`)
  .bind(id,operationId??null,JSON.stringify({...job as object,_creditOperationId:operationId,_outboxId:id}),Math.floor(Date.now()/1000)+Math.max(0,delaySeconds),operationId??null,operationId??null);
}
