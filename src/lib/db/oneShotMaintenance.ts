// D1 remains the durable claim across isolates. This memo only avoids repeating
// the same claim on every search/filter request in a warm Worker.
const checks=new WeakMap<D1Database,Map<string,{promise:Promise<void>;expires:number}>>();

export function runOneShotMaintenance(db:D1Database,owner:string,key:string,work:()=>Promise<{capped:boolean}>):Promise<void>{
  let byKey=checks.get(db);
  if(!byKey){byKey=new Map();checks.set(db,byKey)}
  const memoKey=JSON.stringify([owner,key]);
  const existing=byKey.get(memoKey);
  if(existing&&existing.expires>Date.now())return existing.promise;
  const entries=byKey;
  const entry={promise:Promise.resolve(),expires:Infinity};
  const check=(async()=>{
    const claim=await db.prepare(`INSERT INTO maintenance_state(owner_id,maintenance_key,last_run_at) VALUES(?,?,?)
      ON CONFLICT(owner_id,maintenance_key) DO NOTHING`).bind(owner,key,new Date().toISOString()).run();
    if(!claim.meta.changes)return;
    let complete=false;
    try{complete=!(await work()).capped}
    finally{
      if(!complete){
        await db.prepare('DELETE FROM maintenance_state WHERE owner_id=? AND maintenance_key=?').bind(owner,key).run();
        entries.delete(memoKey);
      }
    }
  })().then(()=>{
    // A different isolate may have held the durable claim and then released it
    // for a capped/failed pass. Recheck eventually instead of memoizing forever.
    entry.expires=Date.now()+60_000;
  }).catch(error=>{entries.delete(memoKey);throw error});
  entry.promise=check;
  entries.set(memoKey,entry);
  return check;
}
