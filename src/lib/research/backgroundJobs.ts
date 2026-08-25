export type WineResearchStage='queued'|'researching'|'saving'|'complete'|'failed';
export type WineResearchRun={
  requestId:string;
  wineId:string;
  status:'running'|'complete'|'failed';
  stage:WineResearchStage;
  refresh:'none'|'vintage'|'all';
  attempt:number;
  message:string|null;
  startedAt:string;
  updatedAt:string;
  completedAt:string|null;
  durationMs:number|null;
};

const now=()=>new Date().toISOString();
const cleanRequestId=(value?:string)=>value&&/^[A-Za-z0-9_-]{8,64}$/.test(value)?value:crypto.randomUUID();
const columns='request_id,wine_id,status,stage,refresh_mode,attempt,message,started_at,updated_at,completed_at,duration_ms';

function mapRun(row:Record<string,unknown>):WineResearchRun{
  return {
    requestId:String(row.request_id),wineId:String(row.wine_id),status:String(row.status) as WineResearchRun['status'],
    stage:String(row.stage) as WineResearchStage,refresh:(String(row.refresh_mode||'none') as WineResearchRun['refresh']),
    attempt:Number(row.attempt)||0,message:row.message?String(row.message):null,startedAt:String(row.started_at),updatedAt:String(row.updated_at),
    completedAt:row.completed_at?String(row.completed_at):null,durationMs:row.duration_ms==null?null:Number(row.duration_ms)
  };
}

export async function getWineResearchRun(db:D1Database,owner:string,wineId:string,requestId:string){
  const row=await db.prepare(`SELECT ${columns} FROM wine_research_runs WHERE owner_id=? AND wine_id=? AND request_id=?`).bind(owner,wineId,requestId).first<Record<string,unknown>>();
  return row?mapRun(row):null;
}

export async function getLatestWineResearchRun(db:D1Database,owner:string,wineId:string){
  const row=await db.prepare(`SELECT ${columns} FROM wine_research_runs WHERE owner_id=? AND wine_id=? ORDER BY updated_at DESC LIMIT 1`).bind(owner,wineId).first<Record<string,unknown>>();
  return row?mapRun(row):null;
}

export async function getActiveWineResearchRun(db:D1Database,owner:string,wineId:string){
  const row=await db.prepare(`SELECT ${columns} FROM wine_research_runs WHERE owner_id=? AND wine_id=? AND status='running' AND updated_at>datetime('now','-20 minutes') ORDER BY updated_at DESC LIMIT 1`).bind(owner,wineId).first<Record<string,unknown>>();
  return row?mapRun(row):null;
}

export async function createWineResearchRun(db:D1Database,owner:string,wineId:string,refresh:'none'|'vintage'|'all',requestedId?:string){
  const existing=await getActiveWineResearchRun(db,owner,wineId);if(existing)return {run:existing,created:false};
  const wine=await db.prepare('SELECT id FROM wines WHERE owner_id=? AND id=?').bind(owner,wineId).first<{id:string}>();
  if(!wine)return null;
  const requestId=cleanRequestId(requestedId),stamp=now();
  await db.prepare(`INSERT INTO wine_research_runs(owner_id,request_id,wine_id,status,stage,refresh_mode,attempt,message,started_at,updated_at,completed_at,duration_ms)
    VALUES(?,?,?,'running','queued',?,0,?,?,?,NULL,NULL)`).bind(owner,requestId,wineId,refresh,'Queued for background Deep Search',stamp,stamp).run();
  await db.prepare("DELETE FROM wine_research_runs WHERE owner_id=? AND updated_at<datetime('now','-30 days')").bind(owner).run().catch(()=>undefined);
  return {run:(await getWineResearchRun(db,owner,wineId,requestId))!,created:true};
}

export async function updateWineResearchRun(db:D1Database,owner:string,requestId:string,stage:WineResearchStage,message:string,status:'running'|'complete'|'failed'='running',attempt=1){
  const row=await db.prepare('SELECT started_at FROM wine_research_runs WHERE owner_id=? AND request_id=?').bind(owner,requestId).first<{started_at:string}>();
  const stamp=now(),done=status==='running'?null:stamp,duration=done&&row?.started_at?Math.max(0,Date.parse(done)-Date.parse(row.started_at)):null;
  await db.prepare('UPDATE wine_research_runs SET status=?,stage=?,attempt=?,message=?,updated_at=?,completed_at=?,duration_ms=? WHERE owner_id=? AND request_id=?')
    .bind(status,stage,attempt,message,stamp,done,duration,owner,requestId).run();
}
