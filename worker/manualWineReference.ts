import { ApiError,hash } from '../src/lib/credits/primitives';
import { lwinRedirects,lwinRowById,referenceManifest,referenceRowsByShard } from '../src/lib/wine/referenceCatalog';
import { referenceMatchForProduct,type VintageKind } from '../src/lib/wine/referenceIdentity';
import type { LwinReferenceProduct } from '../src/lib/wine/lwinImport';
import { buildReferenceSuggestions } from '../src/lib/wine/referenceSuggestions';

type Env={DB:D1Database;REFERENCE_DATA:R2Bucket};
// These fields affect the preview or the identity being replaced. Unrelated
// personal fields are never assigned by the linking UPDATE.
const snapshotColumns=['updated_at','producer','wine_name','vintage','vintage_kind','release_designation','country','region','wine_style','classification','classification_override','lwin7','reference_suggestions_json','identity_match_status'] as const;

export async function previewWineReference(env:Env,owner:string,id:string,code:unknown){
 const lwin7=typeof code==='string'?code.trim():'';
 if(!/^\d{7}$/.test(lwin7))throw new ApiError(400,'Enter a 7-digit LWIN code.');
 const row=await env.DB.prepare('SELECT * FROM wines WHERE owner_id=? AND id=?').bind(owner,id).first<Record<string,unknown>>();
 if(!row)throw new ApiError(404,'Wine not found.');
 const manifest=await referenceManifest(env.REFERENCE_DATA,'lwin');
 if(!manifest)throw new ApiError(503,'The LWIN catalogue is temporarily unavailable. Try again later.');
 const value=(key:string)=>row[key]==null?null:String(row[key]);
 const initial=await lwinRowById<LwinReferenceProduct>(env.REFERENCE_DATA,lwin7,value('producer'));
 if(!initial)throw new ApiError(404,manifest.lwinIdIndexPrefix?'This LWIN was not found in the imported catalogue.':'This LWIN was not found for the current producer. Check the code and producer name.');
 let product:LwinReferenceProduct=initial;
 const seen=new Set<string>();
 while(product.status==='Combined'){
  if(seen.has(product.lwin7)||seen.size>=16)throw new ApiError(422,'This LWIN has an invalid replacement chain.');
  seen.add(product.lwin7);
  const redirect=(await lwinRedirects(env.REFERENCE_DATA))[product.lwin7];
  if(!redirect)throw new ApiError(422,'This LWIN was combined, but its replacement is unavailable.');
  const next=(await referenceRowsByShard<LwinReferenceProduct>(env.REFERENCE_DATA,'lwin',redirect.targetShard)).find(item=>item.lwin7===redirect.targetLwin7);
  if(!next)throw new ApiError(422,'The replacement LWIN is unavailable.');
  product=next;
 }
 if(product.status!=='Live')throw new ApiError(422,'This LWIN has been deleted and cannot be linked.');
 const input={producer:value('producer'),wineName:value('wine_name'),country:value('country'),region:value('region'),classification:value('classification'),classificationOverride:value('classification_override'),vintage:row.vintage==null?null:Number(row.vintage),vintageKind:value('vintage_kind') as VintageKind|null,releaseDesignation:value('release_designation')};
 // A product code alone cannot verify the old ELID's edition/release. Clear it
 // rather than transferring a reference from the previous product.
 const match=await referenceMatchForProduct(env.REFERENCE_DATA,product,input,{includeElid:false});
 const suggestions=buildReferenceSuggestions({...input,referenceProducer:match.referenceProducer,referenceWineName:match.referenceWineName,referenceCountry:match.country,referenceRegion:match.region,referenceClassification:match.referenceClassification});
 const snapshot=snapshotColumns.map(column=>row[column]??null);
 const previewToken=await hash(JSON.stringify({owner,id,lwin7,snapshot,version:manifest.version,product,match,suggestions}));
 const preview={requestedLwin7:lwin7,lwin7:product.lwin7,displayName:product.displayName||[match.referenceProducer,match.referenceWineName].filter(Boolean).join(', '),producer:match.referenceProducer,wineName:match.referenceWineName,country:match.country,region:match.region,colour:match.colour,productType:match.productType,productSubtype:match.productSubtype,lwin11:match.lwin11,vintage:input.vintage,storedLwin7:value('lwin7'),suggestions,previewToken};
 return {preview,match,snapshot};
}

export async function linkWineReference(env:Env,owner:string,id:string,payload:{lwin7?:unknown;previewToken?:unknown}){
 if(typeof payload.previewToken!=='string'||!payload.previewToken)throw new ApiError(400,'Preview this LWIN before linking it.');
 const {preview,match,snapshot}=await previewWineReference(env,owner,id,payload.lwin7);
 if(payload.previewToken!==preview.previewToken)throw new ApiError(409,'The wine or catalogue changed. Preview the LWIN again before linking.');
 const now=new Date().toISOString(),suggestions=preview.suggestions;
 const result=await env.DB.prepare(`UPDATE wines SET reference_product_key=?,lwin7=?,lwin11=?,elid=?,reference_site=?,reference_parcel=?,colour=?,product_type=?,product_subtype=?,
  identity_match_status='manual',identity_match_confidence=NULL,identity_match_candidates_json=NULL,identity_matched_at=?,identity_checked_at=?,reference_suggestions_json=?,reference_suggestions_updated_at=?,updated_at=?
  WHERE owner_id=? AND id=? AND ${snapshotColumns.map(column=>`${column} IS ?`).join(' AND ')}`)
  .bind(match.referenceProductKey,match.lwin7,match.lwin11,match.elid,match.referenceSite,match.referenceParcel,match.colour,match.productType,match.productSubtype,now,now,suggestions.length?JSON.stringify(suggestions):null,suggestions.length?now:null,now,owner,id,...snapshot).run();
 if(!result.meta.changes)throw new ApiError(409,'The wine changed. Preview the LWIN again before linking.');
 return {ok:true,lwin7:match.lwin7,referenceSuggestions:suggestions};
}
