import { lwinEnrichmentStatement,resolveStoredLwin,type StoredLwinWine } from './lwinEnrichment';
import { resolveWineReference,type VintageKind } from '../src/lib/wine/referenceIdentity';
import { lwinReferenceIdentity,lwinRowById } from '../src/lib/wine/referenceCatalog';
import type { LwinReferenceProduct } from '../src/lib/wine/lwinImport';
import { refreshPendingReferenceSuggestions,type ReferenceSuggestion } from '../src/lib/wine/referenceSuggestions';
import { canonicalizeWineFields } from '../src/lib/wine/canonicalize';

export const pendingReferenceReviewSql="(identity_match_status='conflict' OR coalesce(reference_suggestions_json,'[]') NOT IN ('[]','null',''))";

/** Recheck the stored identity without replacing it or the user's populated fields. */
export async function recheckWineReference(db:D1Database,bucket:R2Bucket,owner:string,id:string,refreshSuggestions=true){
 const row=await db.prepare('SELECT * FROM wines WHERE owner_id=? AND id=?').bind(owner,id).first<Record<string,unknown>>();
 if(!row)return false;
 if(!row.lwin7&&row.identity_match_status!=='manual'){
  const stored=row as StoredLwinWine,match=await resolveStoredLwin(bucket,stored),statement=match?lwinEnrichmentStatement(db,stored,match):null;
  if(statement)return Boolean((await statement.run()).meta.changes);
  return true;
 }
 const value=(key:string)=>row[key]==null?null:String(row[key]);
 const input={producer:value('producer'),wineName:value('wine_name'),country:value('country'),region:value('region'),classification:value('classification'),classificationOverride:value('classification_override')};
 const result=await resolveWineReference(bucket,{...input,vintage:row.vintage==null?null:Number(row.vintage),vintageKind:value('vintage_kind') as VintageKind|null,releaseDesignation:value('release_designation'),wineStyle:value('wine_style')});
 const verified=Boolean(row.lwin7)&&result.identityMatchStatus==='matched'&&result.lwin7===row.lwin7;
 if(verified){const statement=lwinEnrichmentStatement(db,row as StoredLwinWine,result,row.identity_match_status==='manual'?'manual':'deterministic');return statement?Boolean((await statement.run()).meta.changes):true}
 let suggestions:ReferenceSuggestion[]|null=null;
 if(refreshSuggestions){
  const product=row.lwin7?await lwinRowById<LwinReferenceProduct>(bucket,String(row.lwin7),input.producer):null;
  // If the local reference is unavailable, preserve the existing suggestions.
  if(product?.status==='Live'){const identity=lwinReferenceIdentity(product),place=canonicalizeWineFields({country:product.country,region:product.region});suggestions=refreshPendingReferenceSuggestions({...input,referenceProducer:identity.producerName,referenceWineName:identity.wineName,referenceCountry:place.country,referenceRegion:place.region,referenceClassification:product.classification},row.reference_suggestions_json)}
 }
 const now=new Date().toISOString();
 const saved=await db.prepare(`UPDATE wines SET
  identity_match_status=CASE WHEN identity_match_status='manual' THEN 'manual' WHEN ? THEN 'matched' ELSE identity_match_status END,
  identity_match_confidence=CASE WHEN ? THEN 1 ELSE identity_match_confidence END,
  identity_match_candidates_json=CASE WHEN ? THEN NULL ELSE identity_match_candidates_json END,
  identity_checked_at=?,reference_suggestions_json=CASE WHEN ? THEN ? ELSE reference_suggestions_json END,
  reference_suggestions_updated_at=CASE WHEN ? THEN ? ELSE reference_suggestions_updated_at END,updated_at=?
  WHERE owner_id=? AND id=? AND updated_at=? AND lwin7 IS ? AND reference_suggestions_json IS ? AND identity_match_status IS ?`)
  .bind(verified?1:0,verified?1:0,verified?1:0,now,suggestions!==null?1:0,suggestions?.length?JSON.stringify(suggestions):null,suggestions!==null?1:0,suggestions?.length?now:null,now,owner,id,row.updated_at,row.lwin7??null,row.reference_suggestions_json??null,row.identity_match_status??null).run();
 return Boolean(saved.meta.changes);
}
