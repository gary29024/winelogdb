import type { LwinReferenceProduct } from './lwinImport';
import { lwinRedirects,referenceRows,type ElidReferenceRecord } from './referenceCatalog';

export const vintageKinds=['vintage','non_vintage','multi_vintage','unknown'] as const;
export type VintageKind=typeof vintageKinds[number];
export type IdentityMatchStatus='matched'|'suggested'|'ambiguous'|'unmatched'|'manual'|'conflict';
export type ReferenceIdentityInput={
 producer:string;wineName:string;vintage?:number|null;vintageKind?:VintageKind|null;releaseDesignation?:string|null;
 recognizedProducer?:string|null;recognizedWineName?:string|null;recognizedVintageText?:string|null;
 country?:string|null;region?:string|null;wineStyle?:string|null;
 referenceProductKey?:string|null;lwin7?:string|null;lwin11?:string|null;elid?:string|null;
 identityMatchStatus?:IdentityMatchStatus|null;identityMatchConfidence?:number|null;
 colour?:string|null;productType?:string|null;productSubtype?:string|null;
};

export function normalizeReferenceText(value:string|null|undefined){
 return (value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
   .replace(/[’'`]/g,'').replace(/&/g,' and ').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
}
export function referenceWineKey(wineName:string|null|undefined,releaseDesignation?:string|null){
 const base=normalizeReferenceText(wineName),release=normalizeReferenceText(releaseDesignation);
 if(!release||base.includes(release))return base;
 return normalizeReferenceText(`${wineName??''} ${releaseDesignation??''}`);
}
export function normalizeLwinId(value:unknown){
 if(value==null)return null;const text=String(value).trim();if(!text||/^na$/i.test(text))return null;
 const normalized=text.replace(/\.0+$/,'');return /^\d{7}$/.test(normalized)?normalized:null;
}
export function isValidElid(value:string|null|undefined){
 if(!value)return false;
 return /^[A-Z]{2}-[A-Z]{3}-[A-Z0-9]{6}-(?:\d{4}|XXXX|NVXX|N[A-Z0-9]{3})(?:\+[A-Z0-9]{3,4})?$/.test(value.trim().toUpperCase());
}
export function normalizedVintageKind(vintage:number|null|undefined,kind:VintageKind|null|undefined):VintageKind{
 if(kind&&vintageKinds.includes(kind))return kind;return vintage==null?'unknown':'vintage';
}
export function vintageReferenceCode(vintage:number|null|undefined,kind:VintageKind|null|undefined){
 const resolved=normalizedVintageKind(vintage,kind);return resolved==='vintage'&&vintage!=null?String(vintage):'';
}
function colourFromStyle(style:string|null|undefined){
 const value=(style??'').trim().toLowerCase();return ['red','white','rose','orange'].includes(value)?value:'';
}
function elidVintageClue(wine:ReferenceResolvable){
 if(wine.vintageKind==='vintage'&&wine.vintage!=null)return String(wine.vintage);
 if(wine.vintageKind==='non_vintage'||wine.vintageKind==='multi_vintage'){
  const digits=wine.releaseDesignation?.match(/\b(\d{3})\b/)?.[1];return digits?`N${digits}`:'NVXX';
 }
 return '';
}

export function referenceIdentityStatements(
 db:D1Database,owner:string,wineId:string,w:ReferenceIdentityInput,stamp=new Date().toISOString(),updateExisting=false
){
 const vintageKind=normalizedVintageKind(w.vintage,w.vintageKind);
 const evidence=updateExisting
  ?db.prepare(`UPDATE wines SET recognized_producer=coalesce(recognized_producer,?),recognized_wine_name=coalesce(recognized_wine_name,?),
    recognized_vintage_text=coalesce(recognized_vintage_text,?),vintage_kind=?,release_designation=? WHERE owner_id=? AND id=?`)
    .bind(w.recognizedProducer??w.producer,w.recognizedWineName??w.wineName,w.recognizedVintageText??(w.vintage!=null?String(w.vintage):null),vintageKind,w.releaseDesignation??null,owner,wineId)
  :db.prepare(`UPDATE wines SET recognized_producer=?,recognized_wine_name=?,recognized_vintage_text=?,vintage_kind=?,release_designation=? WHERE owner_id=? AND id=?`)
    .bind(w.recognizedProducer??w.producer,w.recognizedWineName??w.wineName,w.recognizedVintageText??(w.vintage!=null?String(w.vintage):null),vintageKind,w.releaseDesignation??null,owner,wineId);
 const lookupCompleted=w.identityMatchStatus!=null,matched=w.identityMatchStatus==='matched'&&Boolean(w.lwin7);
 // A missing match after a completed lookup clears an old external mapping
 // because the user may have changed the identity. A lookup that did not
 // complete at all preserves the previous mapping on edits: an R2 hiccup must
 // never make an otherwise-valid wine edit destructive.
 const identity=updateExisting&&!lookupCompleted
  ?db.prepare('UPDATE wines SET identity_match_status=identity_match_status WHERE owner_id=? AND id=?').bind(owner,wineId)
  :db.prepare(`UPDATE wines SET reference_product_key=?,lwin7=?,lwin11=?,elid=?,colour=?,product_type=?,product_subtype=?,
    identity_match_status=?,identity_match_confidence=?,identity_matched_at=? WHERE owner_id=? AND id=?`)
    .bind(matched?w.referenceProductKey??null:null,matched?w.lwin7??null:null,matched?w.lwin11??null:null,matched?w.elid??null:null,
     matched?w.colour??null:null,matched?w.productType??null:null,matched?w.productSubtype??null:null,
     w.identityMatchStatus??'unmatched',matched?w.identityMatchConfidence??1:null,matched?stamp:null,owner,wineId);
 return [evidence,identity];
}

type ReferenceResolvable={
 producer?:string|null;wineName?:string|null;vintage?:number|null;vintageKind?:VintageKind|null;releaseDesignation?:string|null;
 country?:string|null;region?:string|null;style?:string|null;wineStyle?:string|null;
};
export type ReferenceMatch={
 referenceProductKey:string|null;lwin7:string|null;lwin11:string|null;elid:string|null;
 identityMatchStatus:IdentityMatchStatus;identityMatchConfidence:number|null;
 colour:string|null;productType:string|null;productSubtype:string|null;
 referenceSubRegion:string|null;referenceSite:string|null;referenceParcel:string|null;
 referenceDesignation:string|null;referenceClassification:string|null;country:string|null;region:string|null;
};
const unmatched=(status:IdentityMatchStatus='unmatched'):ReferenceMatch=>({
 referenceProductKey:null,lwin7:null,lwin11:null,elid:null,identityMatchStatus:status,identityMatchConfidence:null,
 colour:null,productType:null,productSubtype:null,referenceSubRegion:null,referenceSite:null,referenceParcel:null,
 referenceDesignation:null,referenceClassification:null,country:null,region:null
});
const compatible=(candidate:LwinReferenceProduct,countryKey:string,regionKey:string,colourKey:string)=>
 (!countryKey||!candidate.countryKey||candidate.countryKey===countryKey)&&
 (!regionKey||!candidate.regionKey||candidate.regionKey===regionKey)&&
 (!colourKey||!candidate.colourKey||candidate.colourKey===colourKey);

async function registeredElid(bucket:R2Bucket,product:LwinReferenceProduct,wine:ReferenceResolvable){
 const rows=await referenceRows<ElidReferenceRecord>(bucket,'elid',product.producerKey);if(!rows.length)return null;
 const baseWine=normalizeReferenceText(wine.wineName),clue=elidVintageClue(wine);
 const candidates=rows.filter(row=>row.producerKey===product.producerKey&&row.wineKey===baseWine&&(!clue||row.vintageCode===clue));
 return candidates.length===1&&isValidElid(candidates[0].elid)?candidates[0].elid:null;
}

export async function resolveWineReference(bucket:R2Bucket,wine:ReferenceResolvable):Promise<ReferenceMatch>{
 const producerKey=normalizeReferenceText(wine.producer),wineKey=referenceWineKey(wine.wineName,wine.releaseDesignation);
 if(!producerKey||!wineKey)return unmatched();
 const countryKey=normalizeReferenceText(wine.country),regionKey=normalizeReferenceText(wine.region),colourKey=colourFromStyle(wine.style??wine.wineStyle);
 const rows=await referenceRows<LwinReferenceProduct>(bucket,'lwin',producerKey);if(!rows.length)return unmatched();
 const candidates=rows.filter(row=>row.producerKey===producerKey&&row.wineKey===wineKey&&compatible(row,countryKey,regionKey,colourKey));
 if(candidates.length!==1)return unmatched(candidates.length>1?'ambiguous':'unmatched');
 let product=candidates[0];
 if(product.status==='Deleted')return unmatched();
 if(product.status==='Combined'&&product.referenceLwin7){
  const redirects=await lwinRedirects<LwinReferenceProduct>(bucket),target=redirects[product.lwin7];
  if(!target)return unmatched('conflict');product=target;
 }
 if(product.status!=='Live')return unmatched();
 const elid=await registeredElid(bucket,product,wine);
 return {referenceProductKey:product.productKey,lwin7:product.lwin7,lwin11:null,elid,identityMatchStatus:'matched',identityMatchConfidence:1,
  colour:product.colour,productType:product.productType,productSubtype:product.productSubtype,
  referenceSubRegion:product.subRegion,referenceSite:product.site,referenceParcel:product.parcel,
  referenceDesignation:product.designation,referenceClassification:product.classification,country:product.country,region:product.region};
}
export async function enrichRecognitionReference<T extends ReferenceResolvable>(bucket:R2Bucket,wine:T){
 try{
  const match=await resolveWineReference(bucket,wine);
  return {...wine,...match,country:wine.country??match.country,region:wine.region??match.region};
 }catch(error){
  console.warn(JSON.stringify({event:'wine-reference-lookup-failed',error:error instanceof Error?error.message:String(error)}));
  return wine;
 }
}
