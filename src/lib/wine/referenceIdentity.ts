import type { LwinReferenceProduct } from './lwinImport';
import { elidProducerIndex,lwinRedirects,lwinStrictRowsForProducer,lwinReferenceIdentity,normalizeReferenceText,producerLookupKeys,referenceRows,referenceRowsByShard,type ReferenceSource,type ElidReferenceRecord } from './referenceCatalog';
import { buildReferenceSuggestions } from './referenceSuggestions';
import { canonicalizeWineFields } from './canonicalize';
import { compatibleLwinProduct,sameLwinProducer,parentheticalProducerAlias,unqualifiedLwinHouse,type LwinClues } from './lwinMatching';
import { enrichLwinTaxonomy,parseLwinCode,readLwinReference,type LwinReference } from './lwinMetadata';
import { referenceManifest } from './referenceCatalog';

export { normalizeReferenceText } from './referenceCatalog';
export const vintageKinds=['vintage','non_vintage','multi_vintage','unknown'] as const;
export type VintageKind=typeof vintageKinds[number];
export type IdentityMatchStatus='matched'|'suggested'|'ambiguous'|'unmatched'|'manual'|'conflict';
export type ReferenceIdentityInput={
 lwinReference?:LwinReference|null;
 producer:string;wineName:string;vintage?:number|null;vintageKind?:VintageKind|null;releaseDesignation?:string|null;
 recognizedProducer?:string|null;recognizedWineName?:string|null;recognizedVintageText?:string|null;
 country?:string|null;region?:string|null;wineStyle?:string|null;classification?:string|null;classificationOverride?:string|null;
 referenceProductKey?:string|null;lwin7?:string|null;lwin11?:string|null;elid?:string|null;
 identityMatchStatus?:IdentityMatchStatus|null;identityMatchConfidence?:number|null;identityMatchCandidates?:string[]|null;
 colour?:string|null;productType?:string|null;productSubtype?:string|null;
 referenceProducer?:string|null;referenceWineName?:string|null;referenceCountry?:string|null;referenceRegion?:string|null;referenceClassification?:string|null;
 referenceSite?:string|null;referenceParcel?:string|null;
};

export function referenceWineKey(wineName:string|null|undefined,releaseDesignation?:string|null){
 const base=normalizeReferenceText(wineName),release=normalizeReferenceText(releaseDesignation);
 if(!release||base.includes(release))return base;
 return normalizeReferenceText(`${wineName??''} ${releaseDesignation??''}`);
}
export function normalizeLwinId(value:unknown){
 if(value==null)return null;const text=String(value).trim();if(!text||/^na$/i.test(text))return null;
 const normalized=text.replace(/\.0+$/,'');const parsed=parseLwinCode(normalized);return parsed?.precision===7?parsed.lwin7:null;
}
export function isValidElid(value:string|null|undefined){
 if(!value)return false;
 return /^[A-Z]{2}-[A-Z]{3}-[A-Z0-9]{6}-(?:\d{4}|XXXX|NVXX|N[A-Z0-9]{3})(?:\+[A-Z0-9]{3,4})?$/.test(value.trim().toUpperCase());
}
export function normalizedVintageKind(vintage:number|null|undefined,kind:VintageKind|null|undefined):VintageKind{
 if(vintage!=null)return 'vintage';
 if(kind&&kind!=='vintage'&&vintageKinds.includes(kind))return kind;
 return 'unknown';
}
export function vintageReferenceCode(vintage:number|null|undefined,kind:VintageKind|null|undefined){
 const resolved=normalizedVintageKind(vintage,kind);return resolved==='vintage'&&vintage!=null?String(vintage):'';
}
function elidVintageClue(wine:ReferenceResolvable):string|null{
 const kind=normalizedVintageKind(wine.vintage,wine.vintageKind);
 if(kind==='vintage'&&wine.vintage!=null)return String(wine.vintage);
 if(kind==='unknown'||kind==='multi_vintage')return null;
 const release=(wine.releaseDesignation??'').trim();
 if(!release)return 'NVXX';
 const explicit=release.toUpperCase().match(/\bN([A-Z0-9]{3})\b/)?.[1];
 if(explicit)return `N${explicit}`;
 const numbered=release.match(/\b(\d{3})\b/)?.[1];
 return numbered?`N${numbered}`:null;
}

export type StoredReferenceIdentity={producer:string;wine_name:string;lwin7:string|null;colour?:string|null;product_type?:string|null;product_subtype?:string|null;identity_match_status?:string|null;lwin_reference_json?:string|null;vintage?:number|null;release_designation?:string|null;country?:string|null;region?:string|null;wine_style?:string|null;classification?:string|null;elid?:string|null};
export function referenceIdentityStatements(
 db:D1Database,owner:string,wineId:string,w:ReferenceIdentityInput,stamp=new Date().toISOString(),updateExisting=false,previous?:StoredReferenceIdentity
){
 const accepted=readLwinReference(previous?.lwin_reference_json);
 const stableAi=previous?.identity_match_status==='matched'&&accepted?.method==='ai'&&accepted.lwin7===previous.lwin7&&
  normalizeReferenceText(previous.producer)===normalizeReferenceText(w.producer)&&normalizeReferenceText(previous.wine_name)===normalizeReferenceText(w.wineName)&&
  normalizeReferenceText(previous.country)===normalizeReferenceText(w.country)&&normalizeReferenceText(previous.region)===normalizeReferenceText(w.region)&&
  normalizeReferenceText(previous.wine_style)===normalizeReferenceText(w.wineStyle)&&normalizeReferenceText(previous.classification)===normalizeReferenceText(w.classification)&&
  (previous.vintage??null)===(w.vintage??null)&&(previous.release_designation??null)===(w.releaseDesignation??null);
 // An ordinary edit must not invalidate an accepted alias just because the
 // strict name matcher cannot independently reproduce an earlier AI decision.
 if(stableAi&&w.identityMatchStatus&&['unmatched','ambiguous','suggested'].includes(w.identityMatchStatus))w={...w,
  lwin7:accepted.lwin7,lwin11:lwin11For(accepted,w),elid:previous.elid??null,referenceProductKey:'lwin:'+accepted.lwin7,
  identityMatchStatus:'matched',identityMatchConfidence:accepted.confidence,identityMatchCandidates:[],lwinReference:accepted,
  referenceSite:accepted.site,referenceParcel:accepted.parcel,referenceProducer:accepted.producer,referenceWineName:accepted.wineName,referenceCountry:accepted.country,referenceRegion:accepted.region,referenceClassification:accepted.classification};
 const vintageKind=normalizedVintageKind(w.vintage,w.vintageKind);
 const evidence=updateExisting
  ?db.prepare(`UPDATE wines SET recognized_producer=coalesce(recognized_producer,?),recognized_wine_name=coalesce(recognized_wine_name,?),
    recognized_vintage_text=coalesce(recognized_vintage_text,?),vintage_kind=?,release_designation=? WHERE owner_id=? AND id=?`)
    .bind(w.recognizedProducer??w.producer,w.recognizedWineName??w.wineName,w.recognizedVintageText??(w.vintage!=null?String(w.vintage):null),vintageKind,w.releaseDesignation??null,owner,wineId)
  :db.prepare(`UPDATE wines SET recognized_producer=?,recognized_wine_name=?,recognized_vintage_text=?,vintage_kind=?,release_designation=? WHERE owner_id=? AND id=?`)
    .bind(w.recognizedProducer??w.producer,w.recognizedWineName??w.wineName,w.recognizedVintageText??(w.vintage!=null?String(w.vintage):null),vintageKind,w.releaseDesignation??null,owner,wineId);

 const evidenceStatements=[evidence];
 if(updateExisting&&previous?.identity_match_status==='manual'){
  const reference=readLwinReference(previous.lwin_reference_json),lwin11=reference&&reference.lwin7===previous.lwin7?lwin11For(reference,w):null;
  const changedVintage=(previous.vintage??null)!==(w.vintage??null)||(previous.release_designation??null)!==(w.releaseDesignation??null);
  if(changedVintage)evidenceStatements.push(db.prepare("UPDATE wines SET lwin11=?,elid=NULL WHERE owner_id=? AND id=? AND identity_match_status='manual' AND lwin7 IS ?").bind(lwin11,owner,wineId,previous.lwin7));
 }
 const lookupCompleted=w.identityMatchStatus!=null;
 if(!lookupCompleted)return [...evidenceStatements];

 const persistIdentity=w.identityMatchStatus==='matched'
  ?Boolean(w.lwin7)
  :w.identityMatchStatus==='manual'&&Boolean(w.lwin7||w.elid);
 const suggestions=persistIdentity&&w.identityMatchStatus==='matched'?buildReferenceSuggestions({
   producer:w.producer,wineName:w.wineName,country:w.country,region:w.region,classification:w.classification,classificationOverride:w.classificationOverride,
   referenceProducer:w.referenceProducer,referenceWineName:w.referenceWineName,referenceCountry:w.referenceCountry,referenceRegion:w.referenceRegion,referenceClassification:w.referenceClassification
  }):[];
 const referenceValues=[
  persistIdentity?w.referenceProductKey??null:null,persistIdentity?w.lwin7??null:null,persistIdentity?w.lwin11??null:null,persistIdentity?w.elid??null:null,
  persistIdentity?w.referenceSite??null:null,persistIdentity?w.referenceParcel??null:null,
  persistIdentity?w.colour??null:null,persistIdentity?w.productType??null:null,persistIdentity?w.productSubtype??null:null
 ] as const;
 const prior=previous?.lwin7===w.lwin7?readLwinReference(previous?.lwin_reference_json):null;
 const reference=w.lwinReference?enrichLwinTaxonomy({...w,colour:previous?.colour??w.colour,productType:previous?.product_type??w.productType,productSubtype:previous?.product_subtype??w.productSubtype},{...w.lwinReference,filled:{...prior?.filled,...w.lwinReference.filled}}).lwinReference:null;
 const candidatesJson=w.identityMatchCandidates?.length?JSON.stringify(w.identityMatchCandidates):null;
 const identityStatement=(guard='',guardValues:unknown[]=[])=>db.prepare(`UPDATE wines SET reference_product_key=?,lwin7=?,lwin11=?,elid=?,reference_site=?,reference_parcel=?,colour=coalesce(nullif(trim(colour),''),?),product_type=coalesce(nullif(trim(product_type),''),?),product_subtype=coalesce(nullif(trim(product_subtype),''),?),lwin_reference_json=?,
   identity_match_status=?,identity_match_confidence=?,identity_match_candidates_json=?,identity_matched_at=?,identity_checked_at=?,reference_suggestions_json=?,reference_suggestions_updated_at=? WHERE owner_id=? AND id=? ${guard}`)
   .bind(...referenceValues,persistIdentity&&reference?JSON.stringify(reference):null,w.identityMatchStatus,persistIdentity?w.identityMatchConfidence??(w.identityMatchStatus==='manual'?null:1):null,
    candidatesJson,persistIdentity?stamp:null,stamp,suggestions.length?JSON.stringify(suggestions):null,suggestions.length?stamp:null,owner,wineId,...guardValues);
 if(!updateExisting||w.identityMatchStatus==='manual')return [...evidenceStatements,identityStatement()];

 // A deliberate name correction accepts a new deterministic match or clears
 // an obsolete automatic identity when the new name is absent from the catalogue.
 // Formatting changes, incomplete lookups, ambiguity and manual IDs stay protected.
 const corrected=previous&&(normalizeReferenceText(previous.producer)!==normalizeReferenceText(w.producer)||normalizeReferenceText(previous.wine_name)!==normalizeReferenceText(w.wineName));
 if(corrected&&((persistIdentity&&w.identityMatchStatus==='matched')||w.identityMatchStatus==='unmatched'))return [...evidenceStatements,identityStatement("AND coalesce(identity_match_status,'')<>'manual'")];

 // An edit may re-run matching after the catalogue or naming rules changed.
 // Never silently destroy or replace a stored automatic identity in that case:
 // keep the current reference, mark the disagreement, and let owner validation
 // decide it explicitly. Manual identities remain authoritative as well.
 const incomingLwin=persistIdentity?w.lwin7??null:null,incomingElid=persistIdentity?w.elid??null:null;
 const conflictCandidates=[...new Set([...(previous?.lwin7?[previous.lwin7]:[]),...(w.identityMatchCandidates??[]),...(incomingLwin?[incomingLwin]:[])])];
 const conflict=db.prepare(`UPDATE wines SET identity_match_status='conflict',identity_match_confidence=NULL,
   identity_match_candidates_json=coalesce(?,identity_match_candidates_json),identity_checked_at=?
   WHERE owner_id=? AND id=? AND coalesce(identity_match_status,'')<>'manual'
   AND (lwin7 IS NOT NULL OR elid IS NOT NULL)
   AND NOT ((? IS NOT NULL AND lwin7=?) OR (lwin7 IS NULL AND ? IS NOT NULL AND elid=?))`)
  .bind(conflictCandidates.length?JSON.stringify(conflictCandidates):null,stamp,owner,wineId,incomingLwin,incomingLwin,incomingElid,incomingElid);
 const safeIdentity=identityStatement(`AND coalesce(identity_match_status,'')<>'manual'
   AND ((lwin7 IS NULL AND elid IS NULL) OR (? IS NOT NULL AND lwin7=?) OR (lwin7 IS NULL AND ? IS NOT NULL AND elid=?))`,[incomingLwin,incomingLwin,incomingElid,incomingElid]);
 return [...evidenceStatements,conflict,safeIdentity];
}

export type ReferenceResolvable=LwinClues&{
 producer?:string|null;wineName?:string|null;vintage?:number|null;vintageKind?:VintageKind|null;releaseDesignation?:string|null;
 country?:string|null;region?:string|null;style?:string|null;wineStyle?:string|null;classification?:string|null;classificationOverride?:string|null;
};
export type ReferenceMatch={
 lwinReference?:LwinReference|null;
 referenceProductKey:string|null;lwin7:string|null;lwin11:string|null;elid:string|null;
 identityMatchStatus:IdentityMatchStatus;identityMatchConfidence:number|null;identityMatchCandidates:string[];
 colour:string|null;productType:string|null;productSubtype:string|null;
 referenceSubRegion:string|null;referenceSite:string|null;referenceParcel:string|null;
 referenceDesignation:string|null;referenceClassification:string|null;referenceProducer:string|null;referenceWineName:string|null;country:string|null;region:string|null;
};
const unmatched=(status:IdentityMatchStatus='unmatched',identityMatchCandidates:string[]=[]):ReferenceMatch=>({
 referenceProductKey:null,lwin7:null,lwin11:null,elid:null,identityMatchStatus:status,identityMatchConfidence:null,identityMatchCandidates,
 colour:null,productType:null,productSubtype:null,referenceSubRegion:null,referenceSite:null,referenceParcel:null,
 referenceDesignation:null,referenceClassification:null,referenceProducer:null,referenceWineName:null,country:null,region:null
});
function canonicalReferencePlace(country:string|null|undefined,region:string|null|undefined){
 const place=canonicalizeWineFields({country:country??null,region:region??null});
 return {country:place.country??null,region:place.region??null};
}
function lwin11For(product:Pick<LwinReferenceProduct,'lwin7'|'vintageConfig'|'firstVintage'|'finalVintage'>,wine:ReferenceResolvable){
 const vintage=wine.vintage,kind=normalizedVintageKind(vintage,wine.vintageKind);
 if(kind!=='vintage'||vintage==null||!Number.isInteger(vintage)||vintage<1000||vintage>9999)return null;
 if(product.firstVintage!=null&&vintage<product.firstVintage)return null;
 if(product.finalVintage!=null&&vintage>product.finalVintage)return null;
 if(product.vintageConfig==='singleVintageOnly')return product.firstVintage===vintage?`${product.lwin7}${vintage}`:null;
 // nonSequential means selected vintages. This import does not carry the
 // provider's exact vintageValues list, so a range alone is not enough proof.
 return product.vintageConfig==='sequential'?`${product.lwin7}${vintage}`:null;
}

function elidWineNameKeys(product:LwinReferenceProduct,wine:ReferenceResolvable){
 const keys=new Set([normalizeReferenceText(wine.wineName),normalizeReferenceText(product.wineName)].filter(Boolean));
 const release=normalizeReferenceText(wine.releaseDesignation);
 if(release)for(const key of [...keys])if(key.endsWith(release)){
  const base=key.slice(0,-release.length).trim();if(base)keys.add(base);
 }
 return [...keys];
}
async function registeredElid(bucket:ReferenceSource,product:LwinReferenceProduct,wine:ReferenceResolvable){
 const clue=elidVintageClue(wine);if(!clue)return null;
 if(!product.producerName)return null;
 const index=await elidProducerIndex(bucket),codes=[...new Set(producerLookupKeys(product.producerName).flatMap(key=>index[key]??[]))];
 if(!codes.length){
  console.warn(JSON.stringify({event:'elid-producer-unmapped',lwin7:product.lwin7,producer:product.producerName}));
  return null;
 }
 const wineKeys=elidWineNameKeys(product,wine),groups=await Promise.all(codes.map(code=>referenceRows<ElidReferenceRecord>(bucket,'elid',code)));
 const candidates=groups.flat().filter(row=>codes.includes(row.producerCode)&&wineKeys.includes(row.wineKey)&&row.vintageCode===clue);
 if(candidates.length!==1){
  console.warn(JSON.stringify({event:candidates.length?'elid-match-ambiguous':'elid-match-missing',lwin7:product.lwin7,producer:product.producerName,wineKeys,vintageCode:clue,candidates:candidates.length}));
  return null;
 }
 return isValidElid(candidates[0].elid)?candidates[0].elid:null;
}

export async function resolveWineReference(bucket:ReferenceSource,wine:ReferenceResolvable):Promise<ReferenceMatch>{
 const producerKey=normalizeReferenceText(wine.producer),wineKey=referenceWineKey(wine.wineName,wine.releaseDesignation),baseWineKey=normalizeReferenceText(wine.wineName);
 if(!producerKey||!wineKey)return unmatched();
 const rows=await lwinStrictRowsForProducer<LwinReferenceProduct>(bucket,wine.producer);if(!rows.length)return unmatched();
 const eligible=(key:string,includeHouses=false)=>rows.filter(row=>{
  const identity=lwinReferenceIdentity(row),producerMatches=sameLwinProducer(wine.producer,row)||(includeHouses&&unqualifiedLwinHouse(wine.producer,row));
  return row.status!=='Deleted'&&producerMatches&&(identity.wineKey===key||identity.displayWineKey===key)&&compatibleLwinProduct(row,wine);
 });
 // Prefer an edition/release-specific LWIN row when one exists. The real LWIN
 // export also files some release families (for example Krug Grande Cuvee) only
 // under the base wine name, so a recognized release designation must not turn
 // an otherwise valid reference match into a miss.
 let selectedKey=wineKey,candidates=eligible(selectedKey);
 if(!candidates.length&&baseWineKey&&baseWineKey!==wineKey){selectedKey=baseWineKey;candidates=eligible(selectedKey)}
 // A newly eligible estate alias must not conceal an otherwise excluded
 // qualified house carrying the same wine under the unqualified producer.
 if(candidates.some(row=>parentheticalProducerAlias(wine.producer,row)))candidates=eligible(selectedKey,true);
 if(candidates.length!==1)return unmatched(candidates.length>1?'ambiguous':'unmatched',candidates.map(row=>row.lwin7));
 let product=candidates[0];
 if(product.status==='Combined'){
  const redirects=await lwinRedirects(bucket),seen=new Set<string>();
  while(product.status==='Combined'){
   if(seen.has(product.lwin7)||seen.size>=16)return unmatched('conflict');
   seen.add(product.lwin7);
   const redirect=redirects[product.lwin7];if(!redirect)return unmatched('conflict');
   const targetRows=await referenceRowsByShard<LwinReferenceProduct>(bucket,'lwin',redirect.targetShard);
   const target=targetRows.find(row=>row.lwin7===redirect.targetLwin7);if(!target)return unmatched('conflict');
   product=target;
  }
 }
 if(product.status!=='Live')return unmatched();
 return referenceMatchForProduct(bucket,product,wine);
}

/** Share vintage and metadata rules between automatic matching and an explicit code selection. */
export async function referenceMatchForProduct(bucket:ReferenceSource,product:LwinReferenceProduct,wine:ReferenceResolvable,options:{includeElid?:boolean}={}):Promise<ReferenceMatch>{
 const elid=options.includeElid===false?null:await registeredElid(bucket,product,wine),place=canonicalReferencePlace(product.country,product.region),identity=lwinReferenceIdentity(product);
 const manifest=await referenceManifest(bucket,'lwin');
 const lwinReference:LwinReference={source:'lwin',version:manifest?.version??product.importedAt,lwin7:product.lwin7,displayName:product.displayName,producerTitle:product.producerTitle,producer:identity.producerName,wineName:identity.wineName,
  country:place.country,region:place.region,subRegion:product.subRegion,site:product.site,parcel:product.parcel,designation:product.designation,classification:product.classification,
  colour:product.colour,productType:product.productType,productSubtype:product.productSubtype,vintageConfig:product.vintageConfig,firstVintage:product.firstVintage,finalVintage:product.finalVintage,sourceUpdatedAt:product.sourceUpdatedAt,method:'deterministic',confidence:1,filled:{},conflicts:[],input:{producer:wine.producer??null,wineName:wine.wineName??null}};
 return {lwinReference,referenceProductKey:product.productKey,lwin7:product.lwin7,lwin11:lwin11For(product,wine),elid,identityMatchStatus:'matched',identityMatchConfidence:1,identityMatchCandidates:[],
  colour:product.colour,productType:product.productType,productSubtype:product.productSubtype,
  referenceSubRegion:product.subRegion,referenceSite:product.site,referenceParcel:product.parcel,
  referenceDesignation:product.designation,referenceClassification:product.classification,referenceProducer:identity.producerName,referenceWineName:identity.wineName,country:place.country,region:place.region};
}
export async function enrichRecognitionReference<T extends ReferenceResolvable>(bucket:ReferenceSource,wine:T){
 try{
  const match=await resolveWineReference(bucket,wine);
  const enriched=match.lwinReference?enrichLwinTaxonomy(wine,match.lwinReference):wine;
  return {...wine,...match,...enriched,referenceCountry:match.country,referenceRegion:match.region};
 }catch(error){
  console.warn(JSON.stringify({event:'wine-reference-lookup-failed',error:error instanceof Error?error.message:String(error)}));
  return wine;
 }
}
