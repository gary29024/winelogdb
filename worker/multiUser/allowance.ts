import { stamp } from './common';

export type ResearchAllowance={limit:number;used:number;remaining:number;weekStart:string;resetsAt:string};

/** Member-facing research that consumes one weekly run when new provider work is needed. */
export function usesWeeklyResearchAllowance(path:string){
 return /^\/api\/wines\/[^/]+\/deep-search$/.test(path)||/^\/api\/producers\/[^/]+\/research$/.test(path)||path==='/api/maturity/vintage';
}

/** Batch producer research is an owner maintenance/power feature, not a way around the weekly member limit. */
export function ownerOnlyResearchPath(path:string){return path==='/api/producers/research-batch'}

/** ISO-style week boundary: Monday 00:00 UTC. */
export function researchWeek(now=new Date()){
 const date=new Date(now),day=date.getUTCDay(),back=(day+6)%7;
 date.setUTCDate(date.getUTCDate()-back);date.setUTCHours(0,0,0,0);
 const next=new Date(date);next.setUTCDate(next.getUTCDate()+7);
 return {weekStart:date.toISOString(),resetsAt:next.toISOString()};
}

export async function researchAllowance(db:D1Database,userId:string,limit:number,now=new Date()):Promise<ResearchAllowance>{
 const safeLimit=Math.max(0,Math.floor(Number(limit)||0)),window=researchWeek(now);
 const row=await db.prepare('SELECT count(*) AS n FROM research_allowance_claims WHERE user_id=? AND week_start=?').bind(userId,window.weekStart).first<{n:number}>();
 const used=Number(row?.n)||0;
 return {limit:safeLimit,used,remaining:Math.max(0,safeLimit-used),...window};
}

/**
 * Claim one user-facing research run atomically. The operation id is the
 * idempotency key for the allowance too, so provider retries and queue retries do
 * not consume extra runs. Cached/friend-reused requests never call this helper.
 */
export async function claimResearchAllowance(db:D1Database,userId:string,operationId:string,limit:number,now=new Date()){
 const existing=await db.prepare('SELECT operation_id FROM research_allowance_claims WHERE operation_id=? AND user_id=?').bind(operationId,userId).first();
 if(existing)return {claimed:true,allowance:await researchAllowance(db,userId,limit,now)};
 const window=researchWeek(now),safeLimit=Math.max(0,Math.floor(Number(limit)||0));
 const result=await db.prepare(`INSERT INTO research_allowance_claims(operation_id,user_id,week_start,created_at)
  SELECT ?,?,?,? WHERE (SELECT count(*) FROM research_allowance_claims WHERE user_id=? AND week_start=?)<?`)
  .bind(operationId,userId,window.weekStart,stamp(),userId,window.weekStart,safeLimit).run();
 return {claimed:Boolean(result.meta.changes),allowance:await researchAllowance(db,userId,safeLimit,now)};
}
