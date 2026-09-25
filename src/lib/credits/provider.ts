import { researchEditionOfRow } from '../research/cache';
import { ApiError,boundedBytes,hash,stamp } from './primitives';
import { WINE_RESEARCH_RECOVERY_MS } from '../research/recoveryPolicy';
export type CreditContext={db:D1Database;operationId:string;namespace:string;replayOnly?:boolean};
/** The owner pays the provider bill directly, so their calls are not metered. */
export type CreditExemption={exempt:true;reason:string};
/**
 * A member on a path that was never priced.
 *
 * An allowlist of AI routes loses a race it cannot win: every new endpoint that
 * reaches the provider is unmetered until somebody remembers to add it, and the
 * symptom is a bill rather than an error. Carrying an explicit denial instead
 * means an unpriced path fails loudly the first time a member tries it, and the
 * fix is to price it rather than to discover it on an invoice.
 */
export type CreditDenial={deny:true;reason:string};
export type ProviderAuthorization=CreditContext|CreditExemption|CreditDenial;
/** An unresolved send blocks retries and model fallbacks for the whole operation. */
export async function providerNeedsReconciliation(context?:ProviderAuthorization){
 if(!context||!('operationId' in context))return false;
 return Boolean(await context.db.prepare("SELECT id FROM provider_operations WHERE operation_id=? AND state IN ('submitted','uncertain') LIMIT 1").bind(context.operationId).first());
}
const exempted=(value?:ProviderAuthorization):value is CreditExemption=>Boolean(value&&'exempt' in value);
const denied=(value?:ProviderAuthorization):value is CreditDenial=>Boolean(value&&'deny' in value);
/** The metering decision for a request, made once where the account is known. */
export const providerAuthorization=(role:string|undefined,reason:string):ProviderAuthorization=>
  role==='owner'?{exempt:true,reason:'owner'}:{deny:true,reason};
export function researchInputFingerprint(kind:'wine'|'producer',row:Record<string,unknown>){
 const fields=kind==='producer'?['canonical_name']:['producer','wine_name','vintage','country','region','appellation','wine_style','grapes_json','grape_blend_json'];
 // A non-vintage release's edition, base year and disgorgement are part of its
 // research identity: they choose its exact-wine key and its prompt. They are
 // appended only when present, so every other wine keeps the fingerprint its
 // queued runs carry.
 const edition=kind==='wine'?researchEditionOfRow(row):null;
 return hash(JSON.stringify([...fields.map(field=>row[field]??null),...edition?[edition.releaseDesignation,edition.baseVintage,edition.disgorgement]:[]]));
}
/** An accepted quote cannot fund a renamed/replaced subject in a later queue delivery. */
export async function assertResearchInput(context:ProviderAuthorization|undefined,owner:string,targetId:string,kind:'wine'|'producer',row:Record<string,unknown>){
 // Only a metered run has a quote whose subject can have changed underneath it.
 if(!context||!('operationId' in context))return;
 const operation=await context.db.prepare('SELECT units_json FROM credit_operations WHERE id=? AND user_id=?').bind(context.operationId,owner).first<{units_json:string}>();
 const units=operation?JSON.parse(operation.units_json) as Array<{targetId?:string;targetFingerprint?:string;action:string}>:[];
 // Owner producer work is priced as producer_research; members deliberately
 // receive the cheaper profile-only producer_profile unit. Both authorize the
 // same producer identity check before their queued provider request runs.
 const unit=units.find(unit=>unit.targetId===targetId&&(kind==='wine'?unit.action.startsWith('wine_'):unit.action==='producer_research'||unit.action==='producer_profile'));
 if(!unit?.targetFingerprint||unit.targetFingerprint!==await researchInputFingerprint(kind,row))throw new ApiError(409,'Research identity changed; request a new credit quote');
}
/** A saved provider response is replayable. A missing response is never permission to resubmit. */
export async function durableProvider(context:ProviderAuthorization|undefined,key:string,send:()=>Promise<Response>):Promise<Response>{
 if(denied(context))throw new ApiError(402,context.reason);
 // Undefined is the single-tenant deployment that predates credits, where there
 // is one account and it owns everything. Multi-user requests always carry one
 // of the three states above, so they can never fall through to here.
 if(!context||exempted(context))return send();
 const {db,operationId}=context,id=await hash(`${operationId}|${context.namespace}|${key}`);
 const existing=await db.prepare('SELECT * FROM provider_operations WHERE id=?').bind(id).first<{state:string;response_status:number;response_headers:string;response_body:string}>();
 if(existing?.state==='saved')return new Response(existing.response_body,{status:existing.response_status,headers:JSON.parse(existing.response_headers)});
 if(context.replayOnly)throw new ApiError(409,'Saved provider response is unavailable for recovery');
 if(existing){await db.prepare("UPDATE provider_operations SET state='uncertain',updated_at=? WHERE id=? AND state='submitted'").bind(stamp(),id).run();throw new ApiError(409,'Provider completion needs reconciliation')}
 if(await db.prepare("SELECT id FROM provider_operations WHERE operation_id=? AND state='uncertain' LIMIT 1").bind(operationId).first())throw new ApiError(409,'Provider completion needs reconciliation');
 const claimed=await db.prepare(`INSERT OR IGNORE INTO provider_operations(id,operation_id,state,created_at,updated_at)
  SELECT ?,?,'submitted',?,? FROM credit_operations o WHERE o.id=? AND o.status IN ('reserved','running','review')
  AND (o.path NOT LIKE '/api/wines/%/deep-search' OR o.created_at>=?)
  AND NOT EXISTS(SELECT 1 FROM provider_operations p WHERE p.operation_id=o.id AND p.state='uncertain')`)
  .bind(id,operationId,stamp(),stamp(),operationId,new Date(Date.now()-WINE_RESEARCH_RECOVERY_MS).toISOString()).run();
 if(!claimed.meta.changes)throw new ApiError(409,'Provider operation already submitted or no longer available');
 try{
  const response=await send(),bytes=await boundedBytes(response.body,1_800_000),body=new TextDecoder().decode(bytes);
  const headers={'Content-Type':response.headers.get('Content-Type')||'application/json'};
  const saved=await db.prepare(`UPDATE provider_operations SET state='saved',response_status=?,response_headers=?,response_body=?,updated_at=? WHERE id=?
   RETURNING (SELECT status FROM credit_operations WHERE id=provider_operations.operation_id) AS operation_status`).bind(response.status,JSON.stringify(headers),body,stamp(),id).first<{operation_status:string|null}>();
  // A reply that lands after the operation settled (timed out, or the member
  // stopped waiting) is kept for diagnosis but never applied or charged.
  if(saved&&['complete','failed'].includes(saved.operation_status??''))console.warn(JSON.stringify({event:'provider_reply_after_settlement',operationId,namespace:context.namespace,status:response.status}));
  return new Response(body,{status:response.status,headers});
 }catch(error){await db.prepare("UPDATE provider_operations SET state='uncertain',updated_at=? WHERE id=? AND state='submitted'").bind(stamp(),id).run();throw error}
}
