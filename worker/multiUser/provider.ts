import { ApiError,boundedBytes,hash,stamp } from './common';
export type CreditContext={db:D1Database;operationId:string;namespace:string};
export function researchInputFingerprint(kind:'wine'|'producer',row:Record<string,unknown>){
 const fields=kind==='producer'?['canonical_name']:['producer','wine_name','vintage','country','region','appellation','wine_style','grapes_json','grape_blend_json'];
 return hash(JSON.stringify(fields.map(field=>row[field]??null)));
}
/** An accepted quote cannot fund a renamed/replaced subject in a later queue delivery. */
export async function assertResearchInput(context:CreditContext|undefined,owner:string,targetId:string,kind:'wine'|'producer',row:Record<string,unknown>){
 if(!context)return;
 const operation=await context.db.prepare('SELECT units_json FROM credit_operations WHERE id=? AND user_id=?').bind(context.operationId,owner).first<{units_json:string}>();
 const units=operation?JSON.parse(operation.units_json) as Array<{targetId?:string;targetFingerprint?:string;action:string}>:[];
 const unit=units.find(unit=>unit.targetId===targetId&&(kind==='wine'?unit.action.startsWith('wine_'):unit.action==='producer_research'));
 if(!unit?.targetFingerprint||unit.targetFingerprint!==await researchInputFingerprint(kind,row))throw new ApiError(409,'Research identity changed; request a new credit quote');
}
/** A saved provider response is replayable. A missing response is never permission to resubmit. */
export async function durableProvider(context:CreditContext|undefined,key:string,send:()=>Promise<Response>):Promise<Response>{
 if(!context)return send();
 const {db,operationId}=context,id=await hash(`${operationId}|${context.namespace}|${key}`);
 const existing=await db.prepare('SELECT * FROM provider_operations WHERE id=?').bind(id).first<{state:string;response_status:number;response_headers:string;response_body:string}>();
 if(existing?.state==='saved')return new Response(existing.response_body,{status:existing.response_status,headers:JSON.parse(existing.response_headers)});
 if(existing){await db.prepare("UPDATE provider_operations SET state='uncertain',updated_at=? WHERE id=? AND state='submitted'").bind(stamp(),id).run();throw new ApiError(409,'Provider completion needs reconciliation')}
 if(await db.prepare("SELECT id FROM provider_operations WHERE operation_id=? AND state='uncertain' LIMIT 1").bind(operationId).first())throw new ApiError(409,'Provider completion needs reconciliation');
 const claimed=await db.prepare("INSERT OR IGNORE INTO provider_operations(id,operation_id,state,created_at,updated_at) VALUES(?,?,'submitted',?,?)").bind(id,operationId,stamp(),stamp()).run();
 if(!claimed.meta.changes)throw new ApiError(409,'Provider operation already submitted');
 try{
  const response=await send(),bytes=await boundedBytes(response.body,1_800_000),body=new TextDecoder().decode(bytes);
  const headers={'Content-Type':response.headers.get('Content-Type')||'application/json'};
  await db.prepare("UPDATE provider_operations SET state='saved',response_status=?,response_headers=?,response_body=?,updated_at=? WHERE id=?").bind(response.status,JSON.stringify(headers),body,stamp(),id).run();
  return new Response(body,{status:response.status,headers});
 }catch(error){await db.prepare("UPDATE provider_operations SET state='uncertain',updated_at=? WHERE id=? AND state='submitted'").bind(stamp(),id).run();throw error}
}
