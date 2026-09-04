const PRIMARY_MODEL='gemini-3.8-flash';
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

/**
 * How long a model that answered without grounding is routed around. Long
 * enough that a run does not keep rediscovering it, short enough that a
 * provider fix takes effect without anyone clearing state by hand.
 */
export const GROUNDING_COOLDOWN_MS=6*60*60*1000;

export type ModelGroundingRow={model:string;grounding_ok_at:string|null;grounding_failed_at:string|null};

/** Ranked worst-last: a model observed to ground beats one never seen, which beats one cooling off. */
export function rankGroundingState(row:ModelGroundingRow|undefined,nowMs=Date.now()){
  const ok=row?.grounding_ok_at?Date.parse(row.grounding_ok_at):NaN;
  const failed=row?.grounding_failed_at?Date.parse(row.grounding_failed_at):NaN;
  const failedRecently=Number.isFinite(failed)&&nowMs-failed<GROUNDING_COOLDOWN_MS;
  const okIsNewer=Number.isFinite(ok)&&(!Number.isFinite(failed)||ok>failed);
  if(failedRecently&&!okIsNewer)return 2;
  return okIsNewer?0:1;
}

/**
 * Record what a model just did with a grounded request. Both outcomes are
 * written: a model that grounds again clears its own cooldown, so a provider
 * recovering needs no intervention.
 */
export async function recordGroundingObservation(db:D1Database,owner:string,model:string,grounded:boolean){
  const stamp=nowIso();
  try{
    await db.prepare(`INSERT INTO research_model_health(owner_id,model,unavailable_until,failure_count,last_failure_at,last_reason,updated_at,grounding_ok_at,grounding_failed_at,grounding_failures)
      VALUES(?,?,NULL,0,NULL,NULL,?,?,?,?)
      ON CONFLICT(owner_id,model) DO UPDATE SET
        updated_at=excluded.updated_at,
        grounding_ok_at=coalesce(excluded.grounding_ok_at,research_model_health.grounding_ok_at),
        grounding_failed_at=coalesce(excluded.grounding_failed_at,research_model_health.grounding_failed_at),
        grounding_failures=research_model_health.grounding_failures+excluded.grounding_failures`)
      .bind(owner,model,stamp,grounded?stamp:null,grounded?null:stamp,grounded?0:1).run();
  }catch{return false}
  return true;
}

/**
 * Candidates ordered by how likely each is to ground, best first. Ties keep the
 * caller's order, so the configured preference still decides when nothing has
 * been observed either way.
 */
export async function orderModelsByGrounding(db:D1Database,owner:string,candidates:readonly string[]){
  if(candidates.length<2)return [...candidates];
  let rows:ModelGroundingRow[]=[];
  try{
    const placeholders=candidates.map(()=>'?').join(',');
    const result=await db.prepare(`SELECT model,grounding_ok_at,grounding_failed_at FROM research_model_health WHERE owner_id=? AND model IN (${placeholders})`)
      .bind(owner,...candidates).all<ModelGroundingRow>();
    rows=result.results;
  }catch{return [...candidates]}
  const byModel=new Map(rows.map(row=>[row.model,row]));
  return candidates.map((model,index)=>({model,index,rank:rankGroundingState(byModel.get(model))}))
    .sort((a,b)=>a.rank-b.rank||a.index-b.index).map(item=>item.model);
}
