import { resolveWineReference,referenceMatchForProduct,type ReferenceMatch,type VintageKind,type StoredReferenceIdentity } from '../src/lib/wine/referenceIdentity';
import { lwinRowById,referenceManifest,normalizeReferenceText,type ReferenceSource } from '../src/lib/wine/referenceCatalog';
import type { LwinReferenceProduct } from '../src/lib/wine/lwinImport';
import { enrichLwinTaxonomy,readLwinReference } from '../src/lib/wine/lwinMetadata';
import { buildReferenceSuggestions,refreshPendingReferenceSuggestions } from '../src/lib/wine/referenceSuggestions';

export type StoredLwinWine=Record<string,unknown>&StoredReferenceIdentity&{id:string;owner_id:string};
export function lwinInput(row:Record<string,unknown>){
 const text=(key:string)=>row[key]==null?null:String(row[key]);
 return {producer:text('producer'),wineName:text('wine_name'),vintage:row.vintage==null?null:Number(row.vintage),vintageKind:text('vintage_kind') as VintageKind|null,
  releaseDesignation:text('release_designation'),appellation:text('appellation'),country:text('country'),region:text('region'),wineStyle:text('wine_style'),classification:text('classification'),classificationOverride:text('classification_override'),
  colour:text('colour'),productType:text('product_type'),productSubtype:text('product_subtype')};
}

// Snapshot comparison prevents an in-flight background result applying to an edited wine.
const guardColumns=['producer','wine_name','vintage','vintage_kind','release_designation','country','region','appellation','wine_style','classification','classification_override','colour','product_type','product_subtype','lwin7','lwin11','elid','identity_match_status','lwin_reference_json','reference_suggestions_json'] as const;
export function lwinUpdate(db:D1Database,row:StoredLwinWine,changes:Record<string,string|number|null>){
 const entries=Object.entries(changes).filter(([key,value])=>(row[key]??null)!==value);
 if(!entries.length)return null;
 return db.prepare(`UPDATE wines SET ${entries.map(([key])=>`${key}=?`).join(',')} WHERE owner_id=? AND id=? AND ${guardColumns.map(key=>`${key} IS ?`).join(' AND ')}`)
  .bind(...entries.map(([,value])=>value),row.owner_id,row.id,...guardColumns.map(key=>row[key]??null));
}

/** One reference-only writer for deterministic, AI and existing-identity enrichment. */
export function lwinEnrichmentStatement(db:D1Database,row:StoredLwinWine,match:ReferenceMatch,method:'deterministic'|'ai'|'manual'='deterministic'){
 const now=new Date().toISOString();
 if(row.identity_match_status==='manual'&&(!row.lwin7||row.lwin7!==match.lwin7))return null;
 if(row.lwin7&&row.lwin7!==match.lwin7){
  const candidates=JSON.stringify([...new Set([String(row.lwin7),...match.identityMatchCandidates,...(match.lwin7?[match.lwin7]:[])])]);
  return lwinUpdate(db,row,{identity_match_status:'conflict',identity_match_confidence:null,identity_match_candidates_json:candidates,
   ...(row.identity_match_status!=='conflict'||row.identity_match_candidates_json!==candidates?{identity_checked_at:now}:{})});
 }
 if(!match.lwin7||!match.lwinReference)return lwinUpdate(db,row,{identity_match_status:match.identityMatchStatus,identity_match_confidence:null,identity_match_candidates_json:match.identityMatchCandidates.length?JSON.stringify(match.identityMatchCandidates):null,...(!row.identity_checked_at?{identity_checked_at:now}:{})});
 const input=lwinInput(row),prior=readLwinReference(row.lwin_reference_json),reference={...match.lwinReference,method,confidence:match.identityMatchConfidence,filled:prior?.lwin7===match.lwin7?prior.filled:{}};
 const enriched=enrichLwinTaxonomy(input,reference);
 const comparison={...enriched,referenceProducer:reference.producer,referenceWineName:reference.wineName,referenceCountry:reference.country,referenceRegion:reference.region,referenceClassification:reference.classification};
 const suggestions=row.lwin7===match.lwin7?refreshPendingReferenceSuggestions(comparison,row.reference_suggestions_json):buildReferenceSuggestions(comparison);
 const suggestionsJson=suggestions.length?JSON.stringify(suggestions):null;
 return lwinUpdate(db,row,{
  reference_product_key:match.referenceProductKey,lwin7:match.lwin7,lwin11:match.lwin11,elid:match.elid,
  reference_site:match.referenceSite,reference_parcel:match.referenceParcel,lwin_reference_json:JSON.stringify(enriched.lwinReference),
  country:enriched.country??null,region:enriched.region??null,classification:enriched.classification??null,
  colour:enriched.colour??null,product_type:enriched.productType??null,product_subtype:enriched.productSubtype??null,
  identity_match_status:row.identity_match_status==='manual'?'manual':'matched',identity_match_confidence:row.identity_match_status==='manual'?null:match.identityMatchConfidence,
  identity_match_candidates_json:null,identity_matched_at:String(row.identity_matched_at??now),identity_checked_at:row.identity_match_status==='conflict'?now:String(row.identity_checked_at??now),
  reference_suggestions_json:suggestionsJson,reference_suggestions_updated_at:suggestionsJson?String(row.reference_suggestions_updated_at??now):null
 });
}

export async function resolveStoredLwin(bucket:ReferenceSource,row:StoredLwinWine):Promise<ReferenceMatch|null>{
 const manifest=await referenceManifest(bucket,'lwin');if(!manifest)throw new Error('LWIN catalogue unavailable; resume to retry.');
 if(row.identity_match_status==='manual'&&!row.lwin7)return null;
 const prior=readLwinReference(row.lwin_reference_json);
 if(row.lwin7&&(row.identity_match_status==='matched'||row.identity_match_status==='manual')){
  // A trusted versioned snapshot can be re-enriched without reading its R2 shard.
  if(prior?.lwin7===row.lwin7&&prior.version===manifest.version&&(row.identity_match_status==='manual'||(prior.input&&normalizeReferenceText(prior.input.producer)===normalizeReferenceText(row.producer)&&normalizeReferenceText(prior.input.wineName)===normalizeReferenceText(row.wine_name)))){
   const product:LwinReferenceProduct={...prior,productKey:`lwin:${prior.lwin7}`,status:'Live',referenceLwin7:null,displayName:null,producerTitle:null,producerName:prior.producer,producerKey:'',wineKey:'',countryKey:'',regionKey:'',colourKey:'',sourceAddedAt:null,importedAt:prior.version};
   const match=await referenceMatchForProduct(bucket,product,lwinInput(row),{includeElid:false});
   return {...match,elid:typeof row.elid==='string'?row.elid:null,lwinReference:prior,identityMatchConfidence:prior.confidence};
  }
  // Legacy automatic matches must pass the current matcher before becoming trusted.
  if(row.identity_match_status==='manual'||(prior?.lwin7===row.lwin7&&prior.input&&normalizeReferenceText(prior.input.producer)===normalizeReferenceText(row.producer)&&normalizeReferenceText(prior.input.wineName)===normalizeReferenceText(row.wine_name))){
   const product=await lwinRowById<LwinReferenceProduct>(bucket,String(row.lwin7),row.producer);
   if(product?.status==='Live'){const match=await referenceMatchForProduct(bucket,product,lwinInput(row),{includeElid:false});return {...match,identityMatchConfidence:prior?.confidence??match.identityMatchConfidence,lwinReference:match.lwinReference?{...match.lwinReference,method:prior?.method??'manual'}:null}}
   if(row.identity_match_status==='manual')return null;
  }
 }
 return resolveWineReference(bucket,lwinInput(row));
}
