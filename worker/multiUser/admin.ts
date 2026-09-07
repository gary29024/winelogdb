import { CREDIT_ACTIONS } from './credits';
import { ApiError,body,hash,json,ownerOnly,positive,randomToken,seconds,settings,stamp,textField,type IdentityEnv,type Member,type PilotSettings } from './common';
import { readAiRates,tokenCostUsd,monthGroundingUsd,type AiRateEnv } from '../../src/lib/usage/rates';
import { billingMonth } from '../../src/lib/usage/billingPeriod';

export async function deploymentAiCost(db:D1Database,env:AiRateEnv){
 const rates=readAiRates(env),month=billingMonth();
 const rows=(await db.prepare('SELECT model,tier,sum(search_queries) AS searchQueries,sum(prompt_tokens) AS promptTokens,sum(output_tokens) AS outputTokens FROM ai_usage_monthly WHERE month=? GROUP BY model,tier').bind(month).all<{model:string;tier:string;searchQueries:number;promptTokens:number;outputTokens:number}>()).results;
 const searches=rows.reduce((n,r)=>n+r.searchQueries,0),tokens=rows.reduce((n,r)=>n+tokenCostUsd(r,rates,r.model,{tier:r.tier}),0);
 return {month,usd:tokens+monthGroundingUsd(searches,rates),searches,freeRemaining:Math.max(0,rates.groundingFreePerMonth-searches)};
}
export async function adminRoute(request:Request,env:IdentityEnv&AiRateEnv,member:Member):Promise<Response|null>{
 const path=new URL(request.url).pathname;if(!path.startsWith('/api/admin/'))return null;ownerOnly(member);
 if(path==='/api/admin/overview'&&request.method==='GET'){
  return json({members:(await env.DB.prepare('SELECT u.*,w.balance,w.reserved FROM app_users u JOIN credit_wallets w ON w.user_id=u.id ORDER BY u.created_at').all()).results,
   prices:(await env.DB.prepare('SELECT * FROM credit_prices ORDER BY created_at DESC LIMIT 100').all()).results,
   settings:await settings(env.DB).catch(()=>null),aiCost:await deploymentAiCost(env.DB,env),storage:(await env.DB.prepare('SELECT * FROM storage_totals').all()).results,
   rollout:(await env.DB.prepare('SELECT * FROM rollout_state').all()).results,
   reviewOperations:(await env.DB.prepare("SELECT id,user_id,path,status,reserved,created_at FROM credit_operations WHERE status='review' LIMIT 50").all()).results,
   actions:CREDIT_ACTIONS});
 }
 if(path==='/api/admin/settings'&&request.method==='PUT'){
  const b=await body(request),amount=(key:string)=>{const v=Number(b[key]);if(!Number.isFinite(v)||v<0||v>1e9)throw new ApiError(400,`Invalid ${key}`);return v};
  const value:PilotSettings={memberLimit:positive(b.memberLimit,25),memberStorageBytes:positive(b.memberStorageBytes,100_000_000_000),totalStorageBytes:positive(b.totalStorageBytes,1_000_000_000_000),aiConcurrency:positive(b.aiConcurrency,4),aiDailyOperations:positive(b.aiDailyOperations,1000),aiMonthlyBudgetUsd:amount('aiMonthlyBudgetUsd'),aiUnitBudgetUsd:amount('aiUnitBudgetUsd'),cloudflareWarningUsd:amount('cloudflareWarningUsd'),cloudflareStopUsd:amount('cloudflareStopUsd'),cloudflareObservedUsd:amount('cloudflareObservedUsd'),cloudflareObservedMonth:textField(b.cloudflareObservedMonth),allowOverages:b.allowOverages===true};
  if(value.cloudflareWarningUsd>=value.cloudflareStopUsd||value.aiMonthlyBudgetUsd<=0||value.aiUnitBudgetUsd<=0||!/^\d{4}-\d{2}$/.test(value.cloudflareObservedMonth))throw new ApiError(400,'Set a positive AI budget and a Cloudflare stop threshold above the warning threshold');
  await env.DB.prepare('INSERT INTO pilot_settings(id,value_json) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value_json=excluded.value_json,updated_at=?').bind(JSON.stringify(value),stamp()).run();return json({settings:value});
 }
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
  const priced=(await env.DB.prepare('SELECT DISTINCT action FROM credit_prices').all<{action:string}>()).results;
  if(CREDIT_ACTIONS.some(action=>!priced.some(p=>p.action===action)))throw new ApiError(409,'Configure every AI action price before inviting members');
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
