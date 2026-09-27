import { ApiError,type PilotSettings } from './common';

const errors={
 quote_used:[409,'This AI quote was already used. Request a new quote before starting different work.'],
 active_operation:[409,'This request already has AI work in progress. Check its status before retrying.'],
 own_research:[409,'Another research request in your account is working on the same producer, wine or vintage. Wait for it to finish, then retry to reuse its results.'],
 friend_research:[409,'A friend is researching part of this request. Their result will be reused when it finishes; request a new quote then.'],
 continuation_used:[409,'This sheet continuation was already submitted. Check the existing scan before retrying.'],
 credits:[402,'Insufficient available credits. Review your credit balance before retrying; no work was submitted.'],
 concurrency:[429,'The app’s simultaneous AI action limit has been reached. Wait for active work to finish or ask the owner to review held operations; no work was submitted.'],
 daily:[429,'The app’s daily AI operation limit has been reached. Retry after 00:00 UTC or ask the owner to raise the limit; no work was submitted.'],
 budget:[503,'The monthly AI budget cannot cover this request and outstanding work. Ask the owner to review the budget; no work was submitted.'],
} as const;
export type AdmissionReason=keyof typeof errors;
export function admissionError(reason:AdmissionReason){const [status,message]=errors[reason];return new ApiError(status,message)}

/** The same predicate admits work and explains a refusal inside one D1 batch. */
export function aiAdmission(input:{user:string;path:string;quoteId:string;lockKeys:string[];parents:string[];units:number;total:number;now:string;observedUsd:number;config:PilotSettings|null}){
 const {user,path,quoteId,lockKeys,parents,units,total,now,observedUsd,config}=input;
 const clauses:string[]=[],binds:(string|number)[]=[];
 const when=(condition:string,values:(string|number)[],reason:AdmissionReason)=>{clauses.push(`WHEN ${condition} THEN '${reason}'`);binds.push(...values)};
 when('EXISTS(SELECT 1 FROM credit_operations WHERE quote_id=?)',[quoteId],'quote_used');
 if(path!=='/api/recognition'&&path!=='/api/maturity/vintage'&&!path.endsWith('/sheet/parse')){
  when("EXISTS(SELECT 1 FROM credit_operations WHERE user_id=? AND path=? AND status IN ('reserved','running','review'))",[user,path],'active_operation');
 }
 if(units&&lockKeys.length){
  when('EXISTS(SELECT 1 FROM research_work WHERE owner_id=? AND subject_key IN (SELECT value FROM json_each(?)))',[user,JSON.stringify(lockKeys)],'own_research');
  when('EXISTS(SELECT 1 FROM research_work w JOIN friendships f ON f.friend_id=w.owner_id AND f.user_id=? WHERE w.subject_key IN (SELECT value FROM json_each(?)))',[user,JSON.stringify(lockKeys)],'friend_research');
 }
 if(parents.length)when('EXISTS(SELECT 1 FROM sheet_continuations WHERE parent_operation_id IN (SELECT value FROM json_each(?)))',[JSON.stringify(parents)],'continuation_used');
 // null config is the authenticated owner's exemption. Keep identity, replay
 // and research locks, but do not impose member credits or deployment budgets.
 if(config){
  if(total>0)when('coalesce((SELECT balance-reserved FROM credit_wallets WHERE user_id=?),0)<?',[user,total],'credits');
  if(units){
   when("(SELECT count(*) FROM credit_operations WHERE status IN ('reserved','running','review') AND units_json<>'[]')>=?",[config.aiConcurrency],'concurrency');
   when("(SELECT count(*) FROM credit_operations WHERE created_at>=? AND units_json<>'[]')>=?",[now.slice(0,10),config.aiDailyOperations],'daily');
   when("coalesce((SELECT sum(budget_hold_usd) FROM credit_operations WHERE status IN ('reserved','running','review')),0)+?+?>?",[units*config.aiUnitBudgetUsd,observedUsd,config.aiMonthlyBudgetUsd],'budget');
  }
 }
 return {sql:`CASE ${clauses.join('\n')} ELSE NULL END`,binds};
}
