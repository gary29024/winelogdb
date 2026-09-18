import { CREDIT_ACTIONS } from './credits';
import { ApiError,body,hash,json,ownerOnly,positive,randomToken,seconds,settings,stamp,textField,type IdentityEnv,type Member,type PilotSettings } from './common';
import { MEMBER_AI_ACTIONS,memberAccessWeek,memberAiAccessForUsers,memberAiPolicies,type MemberAiAction } from './memberAccess';
import { marginalCostUsd,monthGroundingUsd,readAiRates,tokenCostUsd,type AiRateEnv } from '../../src/lib/usage/rates';
import { billingMonth } from '../../src/lib/usage/billingPeriod';

type MemberUsageRow={owner_id:string;kind:string;model:string;tier:string;requests:number;search_queries:number;prompt_tokens:number;output_tokens:number;units:number};
type MemberUsageKind={kind:string;requests:number;searchQueries:number;units:number;estimatedMarginalUsd:number};
type MemberUsage={userId:string;requests:number;searchQueries:number;promptTokens:number;outputTokens:number;smartSearchRequests:number;smartSearchUnits:number;estimatedMarginalUsd:number;kinds:MemberUsageKind[]};

export async function deploymentAiCost(db:D1Database,env:AiRateEnv){
 const rates=readAiRates(env),month=billingMonth();
 const rows=(await db.prepare('SELECT model,tier,sum(search_queries) AS searchQueries,sum(prompt_tokens) AS promptTokens,sum(output_tokens) AS outputTokens FROM ai_usage_monthly WHERE month=? GROUP BY model,tier').bind(month).all<{model:string;tier:string;searchQueries:number;promptTokens:number;outputTokens:number}>()).results;
 const searches=rows.reduce((n,r)=>n+r.searchQueries,0),tokens=rows.reduce((n,r)=>n+tokenCostUsd(r,rates,r.model,{tier:r.tier}),0);
 return {month,usd:tokens+monthGroundingUsd(searches,rates),searches,freeRemaining:Math.max(0,rates.groundingFreePerMonth-searches)};
}

/**
 * Attribute the current month's provider activity to the account that caused it.
 * This deliberately uses marginal/list pricing rather than allocating the shared
 * monthly grounding allowance between members. The deployment-wide figure above
 * remains the billing estimate; this one is for fair usage attribution and abuse
 * monitoring. Workers AI embeddings can have zero estimated dollars when the
 * provider response exposes no billable-token metadata, but their request/wine
 * counts are still retained here.
 */
export async function memberAiUsage(db:D1Database,env:AiRateEnv){
 const rates=readAiRates(env),month=billingMonth();
 const rows=(await db.prepare(`SELECT owner_id,kind,model,tier,requests,search_queries,prompt_tokens,output_tokens,units
   FROM ai_usage_monthly WHERE month=? ORDER BY owner_id,kind`).bind(month).all<MemberUsageRow>()).results;
 const byUser=new Map<string,MemberUsage>();
 for(const row of rows){
  const requests=Number(row.requests)||0,searchQueries=Number(row.search_queries)||0,promptTokens=Number(row.prompt_tokens)||0,
   outputTokens=Number(row.output_tokens)||0,units=Number(row.units)||0,
   estimatedMarginalUsd=marginalCostUsd({searchQueries,promptTokens,outputTokens},rates,row.model,{tier:row.tier});
  const usage=byUser.get(row.owner_id)??{userId:row.owner_id,requests:0,searchQueries:0,promptTokens:0,outputTokens:0,smartSearchRequests:0,smartSearchUnits:0,estimatedMarginalUsd:0,kinds:[]};
  usage.requests+=requests;usage.searchQueries+=searchQueries;usage.promptTokens+=promptTokens;usage.outputTokens+=outputTokens;usage.estimatedMarginalUsd+=estimatedMarginalUsd;
  if(row.kind==='search_embedding'){usage.smartSearchRequests+=requests;usage.smartSearchUnits+=units}
  let kind=usage.kinds.find(item=>item.kind===row.kind);
  if(!kind){kind={kind:row.kind,requests:0,searchQueries:0,units:0,estimatedMarginalUsd:0};usage.kinds.push(kind)}
  kind.requests+=requests;kind.searchQueries+=searchQueries;kind.units+=units;kind.estimatedMarginalUsd+=estimatedMarginalUsd;
  byUser.set(row.owner_id,usage);
 }
 return {month,items:[...byUser.values()].map(item=>({...item,kinds:item.kinds.sort((a,b)=>b.estimatedMarginalUsd-a.estimatedMarginalUsd||b.requests-a.requests)}))};
}

export async function adminRoute(request:Request,env:IdentityEnv&AiRateEnv,member:Member):Promise<Response|null>{
 const path=new URL(request.url).pathname;if(!path.startsWith('/api/admin/'))return null;ownerOnly(member);
 if(path==='/api/admin/overview'&&request.method==='GET'){
  const [members,prices,settingsValue,aiCost,memberUsage,storage,rollout,reviewOperations,actionPolicies]=await Promise.all([
   env.DB.prepare('SELECT u.*,w.balance,w.reserved FROM app_users u JOIN credit_wallets w ON w.user_id=u.id ORDER BY u.created_at').all(),
   env.DB.prepare('SELECT * FROM credit_prices ORDER BY created_at DESC LIMIT 100').all(),
   settings(env.DB).catch(()=>null),deploymentAiCost(env.DB,env),memberAiUsage(env.DB,env),
   env.DB.prepare('SELECT owner_id,byte_size,metered_byte_size FROM storage_totals').all(),env.DB.prepare('SELECT * FROM rollout_state').all(),
   env.DB.prepare("SELECT id,user_id,path,status,reserved,created_at FROM credit_operations WHERE status='review' LIMIT 50").all(),
   memberAiPolicies(env.DB)
  ]);
  const memberRows=members.results as Array<{id:string;role:string}>,memberIds=memberRows.filter(item=>item.role==='member').map(item=>item.id);
  const actionAccess=await memberAiAccessForUsers(env.DB,memberIds);
  return json({members:members.results,prices:prices.results,settings:settingsValue,aiCost,memberUsage,actionPolicies,actionAccess,storage:storage.results,rollout:rollout.results,reviewOperations:reviewOperations.results,actions:CREDIT_ACTIONS});
 }
 if(path==='/api/admin/settings'&&request.method==='PUT'){
  const b=await body(request),amount=(key:string)=>{const v=Number(b[key]);if(!Number.isFinite(v)||v<0||v>1e9)throw new ApiError(400,`Invalid ${key}`);return v};
  const storage=(key:string,max:number)=>{const v=Number(b[key]);if(!Number.isSafeInteger(v)||v<0||v>max)throw new ApiError(400,`Invalid ${key}`);return v};
  const value:PilotSettings={memberLimit:positive(b.memberLimit,25),memberStorageBytes:storage('memberStorageBytes',100_000_000_000),totalStorageBytes:storage('totalStorageBytes',1_000_000_000_000),aiConcurrency:positive(b.aiConcurrency,4),aiDailyOperations:positive(b.aiDailyOperations,1000),aiDailyEmbeddingRequests:positive(b.aiDailyEmbeddingRequests,100_000),aiMonthlyBudgetUsd:amount('aiMonthlyBudgetUsd'),aiUnitBudgetUsd:amount('aiUnitBudgetUsd'),cloudflareWarningUsd:amount('cloudflareWarningUsd'),cloudflareStopUsd:amount('cloudflareStopUsd'),cloudflareObservedUsd:amount('cloudflareObservedUsd'),cloudflareObservedMonth:textField(b.cloudflareObservedMonth),allowOverages:b.allowOverages===true};
  if(value.cloudflareWarningUsd>=value.cloudflareStopUsd||value.aiMonthlyBudgetUsd<=0||value.aiUnitBudgetUsd<=0||!/^\d{4}-\d{2}$/.test(value.cloudflareObservedMonth))throw new ApiError(400,'Set a positive AI budget and a Cloudflare stop threshold above the warning threshold');
  await env.DB.prepare('INSERT INTO pilot_settings(id,value_json) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value_json=excluded.value_json,updated_at=?').bind(JSON.stringify(value),stamp()).run();return json({settings:value});
 }
 if(path==='/api/admin/action-policies'&&request.method==='PUT'){
  const b=await body(request),raw=b.policies;if(!Array.isArray(raw)||raw.length!==MEMBER_AI_ACTIONS.length)throw new ApiError(400,'Provide one access rule for every member AI action');
  const seen=new Set<string>(),statements:D1PreparedStatement[]=[];
  for(const item of raw){
   if(!item||typeof item!=='object'||Array.isArray(item))throw new ApiError(400,'Invalid member AI access rule');
   const row=item as Record<string,unknown>,action=String(row.action) as MemberAiAction,accessMode=String(row.accessMode),weeklyLimit=Number(row.weeklyLimit);
   if(!MEMBER_AI_ACTIONS.includes(action)||seen.has(action))throw new ApiError(400,'Unknown or duplicate member AI action');
   if(accessMode!=='included'&&accessMode!=='allowance')throw new ApiError(400,'Access mode must be included or allowance');
   if(!Number.isSafeInteger(weeklyLimit)||weeklyLimit<0||weeklyLimit>10_000)throw new ApiError(400,'Weekly free-run limit must be a non-negative integer');
   seen.add(action);statements.push(env.DB.prepare('UPDATE member_ai_action_policies SET access_mode=?,weekly_limit=?,updated_at=?,updated_by=? WHERE action=?').bind(accessMode,weeklyLimit,stamp(),member.id,action));
  }
  if(seen.size!==MEMBER_AI_ACTIONS.length)throw new ApiError(400,'Provide one access rule for every member AI action');
  await env.DB.batch(statements);return json({policies:await memberAiPolicies(env.DB)});
 }
 if(path==='/api/admin/action-grants'&&request.method==='POST'){
  const b=await body(request),userId=textField(b.userId),action=String(b.action) as MemberAiAction,runs=positive(b.runs,1000),key=textField(b.idempotencyKey,128);
  const reason=typeof b.reason==='string'?b.reason.trim():'';if(reason.length>300)throw new ApiError(400,'Grant reason is too long');
  if(!MEMBER_AI_ACTIONS.includes(action))throw new ApiError(400,'Unknown member AI action');
  if(!await env.DB.prepare("SELECT id FROM app_users WHERE id=? AND role='member'").bind(userId).first())throw new ApiError(404,'Member not found');
  const policy=await env.DB.prepare('SELECT access_mode FROM member_ai_action_policies WHERE action=?').bind(action).first<{access_mode:string}>();
  if(policy?.access_mode!=='allowance')throw new ApiError(400,'This action is already included for all members');
  const weekStart=memberAccessWeek().weekStart,id=`action-grant:${member.id}:${key}`;
  const prior=await env.DB.prepare('SELECT user_id,action,week_start,runs,reason FROM member_ai_action_grants WHERE id=?').bind(id).first<{user_id:string;action:string;week_start:string;runs:number;reason:string}>();
  if(prior&&(prior.user_id!==userId||prior.action!==action||prior.week_start!==weekStart||prior.runs!==runs||prior.reason!==reason))throw new ApiError(409,'Grant key already used');
  await env.DB.prepare('INSERT OR IGNORE INTO member_ai_action_grants(id,user_id,action,week_start,runs,created_at,created_by,reason) VALUES(?,?,?,?,?,?,?,?)').bind(id,userId,action,weekStart,runs,stamp(),member.id,reason).run();
  const saved=await env.DB.prepare('SELECT user_id,action,week_start,runs,reason FROM member_ai_action_grants WHERE id=?').bind(id).first<{user_id:string;action:string;week_start:string;runs:number;reason:string}>();
  if(!saved||saved.user_id!==userId||saved.action!==action||saved.week_start!==weekStart||saved.runs!==runs||saved.reason!==reason)throw new ApiError(409,'Grant key already used');
  return json({ok:true,weekStart},201);
 }
 // Kept as internal compatibility endpoints for the zero-tariff quote ledger.
 if(path==='/api/admin/prices'&&request.method==='POST'){
  const b=await body(request),action=String(b.action);if(!CREDIT_ACTIONS.includes(action as typeof CREDIT_ACTIONS[number]))throw new ApiError(400,'Unknown action');
  await env.DB.prepare('INSERT INTO credit_prices(id,action,credits,created_at,created_by) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),action,positive(b.credits),stamp(),member.id).run();return json({ok:true},201);
 }
 if(path==='/api/admin/credits/grant'&&request.method==='POST'){
  const b=await body(request),user=textField(b.userId),amount=positive(b.credits),key=textField(b.idempotencyKey,128),reason=textField(b.reason,500),id=`grant:${member.id}:${key}`;
  if(!await env.DB.prepare('SELECT user_id FROM credit_wallets WHERE user_id=?').bind(user).first())throw new ApiError(404,'Member not found');
  const prior=await env.DB.prepare('SELECT user_id,amount,reason FROM credit_ledger WHERE id=?').bind(id).first<{user_id:string;amount:number;reason:string}>();
  if(prior&&(prior.user_id!==user||prior.amount!==amount||prior.reason!==reason))throw new ApiError(409,'Grant key already used');
  await env.DB.prepare("INSERT OR IGNORE INTO credit_ledger(id,user_id,kind,amount,actor_id,reason) VALUES(?,?,'grant',?,?,?)").bind(id,user,amount,member.id,reason).run();
  const saved=await env.DB.prepare('SELECT user_id,amount,reason FROM credit_ledger WHERE id=?').bind(id).first<{user_id:string;amount:number;reason:string}>();
  if(!saved||saved.user_id!==user||saved.amount!==amount||saved.reason!==reason)throw new ApiError(409,'Grant key already used');return json({ok:true});
 }
 if(path==='/api/admin/invitations'&&request.method==='POST'){
  await settings(env.DB);const readiness=(await env.DB.prepare("SELECT name FROM rollout_state WHERE name IN ('storage_inventory','research_index') AND value='complete'").all()).results;
  if(readiness.length!==2)throw new ApiError(409,'Complete storage inventory and research indexing before inviting members');
  const b=await body(request),email=textField(b.email,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new ApiError(400,'Invalid email');
  const token=randomToken();await env.DB.prepare('INSERT INTO member_invitations(token_hash,email,created_by,expires_at) VALUES(?,?,?,?)').bind(await hash(token),email,member.id,seconds()+7*86400).run();return json({url:`${env.APP_URL}/login?invitation=${token}`},201);
 }
 const memberRoute=path.match(/^\/api\/admin\/members\/([^/]+)$/);
 if(memberRoute&&request.method==='PATCH'){
  if(memberRoute[1]===member.id)throw new ApiError(400,'Cannot suspend the owner');const b=await body(request);if(!['active','suspended'].includes(String(b.status)))throw new ApiError(400,'Invalid status');
  await env.DB.batch([env.DB.prepare('UPDATE app_users SET status=? WHERE id=? AND role=\'member\'').bind(String(b.status),memberRoute[1]),env.DB.prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(memberRoute[1])]);return json({ok:true});
 }
 return json({error:'Unknown administration endpoint'},404);
}
