import { ApiError,stamp } from './common';
import { champagneExtractionRoute } from '../../src/lib/ai/reservedRoutes';

export const MEMBER_AI_ACTIONS=[
 'scan_single','scan_group','scan_batch','scan_sheet','champagne_extraction','wine_deep_search','producer_research','producer_batch_research','vintage_window'
] as const;
export type MemberAiAction=typeof MEMBER_AI_ACTIONS[number];
export type MemberAiAccessMode='included'|'allowance';
export type MemberAiPolicy={action:MemberAiAction;accessMode:MemberAiAccessMode;weeklyLimit:number;label:string};
export type MemberAiAllowance={
 action:MemberAiAction;label:string;accessMode:MemberAiAccessMode;baseLimit:number;granted:number;limit:number;
 used:number;pending:number;remaining:number|null;weekStart:string;resetsAt:string;
};

export const MEMBER_AI_LABELS:Record<MemberAiAction,string>={
 scan_single:'Single wine scan',scan_group:'Group photo scan',scan_batch:'Batch scan',scan_sheet:'Tasting sheet scan',
 champagne_extraction:'Champagne label details extraction',
 wine_deep_search:'Wine Deep Search',producer_research:'Producer research',producer_batch_research:'Batch producer research',vintage_window:'Vintage Window'
};

export function memberActionForRequest(request:Request):MemberAiAction|null{
 const path=new URL(request.url).pathname;
 if(path==='/api/recognition')return request.headers.get('X-WineLog-Recognition-Mode')==='group'?'scan_group':'scan_single';
 if(/^\/api\/batch-recognition\/sessions\/[^/]+\/submit$/.test(path))return 'scan_batch';
 if(/^\/api\/tastings\/[^/]+\/sheet\/parse$/.test(path))return 'scan_sheet';
 if(champagneExtractionRoute(path))return 'champagne_extraction';
 if(/^\/api\/wines\/[^/]+\/deep-search$/.test(path))return 'wine_deep_search';
 if(/^\/api\/producers\/[^/]+\/research$/.test(path))return 'producer_research';
 if(path==='/api/producers/research-batch')return 'producer_batch_research';
 if(path==='/api/maturity/vintage')return 'vintage_window';
 return null;
}

/** ISO-style, non-rollover pilot allowance week: Monday 00:00 UTC. */
export function memberAccessWeek(now=new Date()){
 const date=new Date(now.getTime()),day=date.getUTCDay(),back=(day+6)%7;
 date.setUTCDate(date.getUTCDate()-back);date.setUTCHours(0,0,0,0);
 const next=new Date(date.getTime());next.setUTCDate(next.getUTCDate()+7);
 return {weekStart:date.toISOString(),resetsAt:next.toISOString()};
}

export async function memberAiPolicies(db:D1Database):Promise<MemberAiPolicy[]>{
 const rows=(await db.prepare('SELECT action,access_mode,weekly_limit FROM member_ai_action_policies').all<{action:string;access_mode:string;weekly_limit:number}>()).results;
 const byAction=new Map(rows.map(row=>[row.action,row]));
 return MEMBER_AI_ACTIONS.map(action=>{
  const row=byAction.get(action);if(!row)throw new ApiError(503,`Member AI policy is missing for ${MEMBER_AI_LABELS[action]}`);
  const accessMode=row.access_mode==='included'?'included':row.access_mode==='allowance'?'allowance':null;
  if(!accessMode)throw new ApiError(503,`Member AI policy is invalid for ${MEMBER_AI_LABELS[action]}`);
  return {action,accessMode,weeklyLimit:Math.max(0,Number(row.weekly_limit)||0),label:MEMBER_AI_LABELS[action]};
 });
}

/** Batch all per-member allowance reads so Owner controls does not do N×actions D1 round trips. */
export async function memberAiAccessForUsers(db:D1Database,userIds:string[],now=new Date()):Promise<Array<{userId:string;actions:MemberAiAllowance[]}>>{
 const policies=await memberAiPolicies(db),window=memberAccessWeek(now),ids=[...new Set(userIds.filter(Boolean))];
 if(!ids.length)return [];
 const encoded=JSON.stringify(ids);
 const [grantRows,usageRows]=await Promise.all([
  db.prepare(`SELECT user_id,action,sum(runs) AS granted FROM member_ai_action_grants
    WHERE week_start=? AND user_id IN (SELECT value FROM json_each(?)) GROUP BY user_id,action`).bind(window.weekStart,encoded).all<{user_id:string;action:string;granted:number}>(),
  db.prepare(`SELECT u.user_id,u.action,
      sum(CASE WHEN u.status='success' THEN 1 ELSE 0 END) AS used,
      sum(CASE WHEN u.status='pending' AND o.status IN ('reserved','running','review') THEN 1 ELSE 0 END) AS pending
    FROM member_ai_action_usage u LEFT JOIN credit_operations o ON o.id=u.operation_id
    WHERE u.week_start=? AND u.user_id IN (SELECT value FROM json_each(?)) GROUP BY u.user_id,u.action`).bind(window.weekStart,encoded).all<{user_id:string;action:string;used:number;pending:number}>()
 ]);
 const grants=new Map(grantRows.results.map(row=>[`${row.user_id}\n${row.action}`,Number(row.granted)||0]));
 const usage=new Map(usageRows.results.map(row=>[`${row.user_id}\n${row.action}`,{used:Number(row.used)||0,pending:Number(row.pending)||0}]));
 return ids.map(userId=>({userId,actions:policies.map(policy=>{
  const key=`${userId}\n${policy.action}`,granted=grants.get(key)??0,current=usage.get(key)??{used:0,pending:0},limit=policy.weeklyLimit+granted;
  return {action:policy.action,label:policy.label,accessMode:policy.accessMode,baseLimit:policy.weeklyLimit,granted,limit,
   used:current.used,pending:current.pending,remaining:policy.accessMode==='included'?null:Math.max(0,limit-current.used-current.pending),...window};
 })}));
}

export async function memberAiAccess(db:D1Database,userId:string,now=new Date()){
 return (await memberAiAccessForUsers(db,[userId],now))[0]?.actions??[];
}

export async function memberAiActionAccess(db:D1Database,userId:string,action:MemberAiAction,now=new Date()){
 const item=(await memberAiAccess(db,userId,now)).find(entry=>entry.action===action);
 if(!item)throw new ApiError(503,`Member AI policy is missing for ${MEMBER_AI_LABELS[action]}`);
 return item;
}

/**
 * Reserve one allowance slot while provider work is in flight. Pending slots are
 * counted for concurrency safety, but failed operations are later removed by the
 * D1 settlement trigger, so only successful runs remain consumed. Included
 * actions create no claim.
 */
export async function reserveMemberAiAllowance(db:D1Database,userId:string,operationId:string,action:MemberAiAction,now=new Date()){
 const existing=await db.prepare('SELECT action,status FROM member_ai_action_usage WHERE operation_id=? AND user_id=?').bind(operationId,userId).first<{action:string;status:string}>();
 if(existing){if(existing.action!==action)throw new ApiError(409,'AI allowance operation changed action');return {allowed:true,claimed:true,access:await memberAiActionAccess(db,userId,action,now)}}
 const access=await memberAiActionAccess(db,userId,action,now);
 if(access.accessMode==='included')return {allowed:true,claimed:false,access};
 const result=await db.prepare(`INSERT INTO member_ai_action_usage(operation_id,user_id,action,week_start,status,created_at)
   SELECT ?,?,?,?,'pending',? WHERE
   (SELECT count(*) FROM member_ai_action_usage u LEFT JOIN credit_operations o ON o.id=u.operation_id
      WHERE u.user_id=? AND u.action=? AND u.week_start=?
        AND (u.status='success' OR (u.status='pending' AND o.status IN ('reserved','running','review'))))
   <
   (SELECT weekly_limit FROM member_ai_action_policies WHERE action=? AND access_mode='allowance')+
   coalesce((SELECT sum(runs) FROM member_ai_action_grants WHERE user_id=? AND action=? AND week_start=?),0)`)
  .bind(operationId,userId,action,access.weekStart,stamp(),userId,action,access.weekStart,action,userId,action,access.weekStart).run();
 if(result.meta.changes)return {allowed:true,claimed:true,access:await memberAiActionAccess(db,userId,action,now)};
 const latest=await memberAiActionAccess(db,userId,action,now);
 return {allowed:latest.accessMode==='included',claimed:false,access:latest};
}
