const PRIMARY_MODEL='gemini-3.7-flash';
const PRIMARY_COOLDOWN_MS=15*60*1000;

const nowIso=()=>new Date().toISOString();

export function researchPrimaryCooldownUntil(fromMs=Date.now()){
  return new Date(fromMs+PRIMARY_COOLDOWN_MS).toISOString();
}

export async function shouldBypassPrimaryResearch(db:D1Database,owner:string){
  try{
    const row=await db.prepare('SELECT unavailable_until FROM research_model_health WHERE owner_id=? AND model=?').bind(owner,PRIMARY_MODEL).first<{unavailable_until:string|null}>();
    return Boolean(row?.unavailable_until&&Date.parse(row.unavailable_until)>Date.now());
  }catch{return false}
}

export async function markPrimaryResearchUnavailable(db:D1Database,owner:string,reason:string){
  const stamp=nowIso(),until=researchPrimaryCooldownUntil();
  try{
    await db.prepare(`INSERT INTO research_model_health(owner_id,model,unavailable_until,failure_count,last_failure_at,last_reason,updated_at)
      VALUES(?,?,?,1,?,?,?)
      ON CONFLICT(owner_id,model) DO UPDATE SET
        unavailable_until=excluded.unavailable_until,
        failure_count=research_model_health.failure_count+1,
        last_failure_at=excluded.last_failure_at,
        last_reason=excluded.last_reason,
        updated_at=excluded.updated_at`)
      .bind(owner,PRIMARY_MODEL,until,stamp,reason.slice(0,500),stamp).run();
  }catch{return false}
  return true;
}

export async function clearPrimaryResearchCooldown(db:D1Database,owner:string){
  try{
    await db.prepare(`UPDATE research_model_health SET unavailable_until=NULL,failure_count=0,last_reason=NULL,updated_at=? WHERE owner_id=? AND model=?`)
      .bind(nowIso(),owner,PRIMARY_MODEL).run();
  }catch{return false}
  return true;
}
