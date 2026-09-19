import type { LwinReferenceProduct } from './lwinImport';
import { elidProducerIndex,lwinRedirects,normalizeReferenceText,producerLookupKeys,referenceRows,referenceRowsByShard,type ElidReferenceRecord } from './referenceCatalog';
import { appClassification,buildReferenceSuggestions } from './referenceSuggestions';

export { normalizeReferenceText } from './referenceCatalog';
export const vintageKinds=['vintage','non_vintage','multi_vintage','unknown'] as const;
export type VintageKind=typeof vintageKinds[number];
export type IdentityMatchStatus='matched'|'suggested'|'ambiguous'|'unmatched'|'manual'|'conflict';
export type ReferenceIdentityInput={
 producer:string;wineName:string;vintage?:number|null;vintageKind?:VintageKind|null;releaseDesignation?:string|null;
 recognizedProducer?:string|null;recognizedWineName?:string|null;recognizedVintageText?:string|null;
 country?:string|null;region?:string|null;wineStyle?:string|null;classification?:string|null;classificationOverride?:string|null;
 referenceProductKey?:string|null;lwin7?:string|null;lwin11?:string|null;elid?:string|null;
 identityMatchStatus?:IdentityMatchStatus|null;identityMatchConfidence?:number|null;
 colour?:string|null;productType?:string|null;productSubtype?:string|null;
 referenceProducer?:string|null;referenceWineName?:string|null;referenceCountry?:string|null;referenceRegion?:string|null;referenceClassification?:string|null;
};

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
 if(vintage!=null)return 'vintage';
 if(kind&&kind!=='vintage'&&vintageKinds.includes(kind))return kind;
 return 'unknown';
}
export function vintageReferenceCode(vintage:number|null|undefined,kind:VintageKind|null|undefined){
 const resolved=normalizedVintageKind(vintage,kind);return resolved==='vintage'&&vintage!=null?String(vintage):'';
}
function colourFromStyle(style:string|null|undefined){
 const value=(style??'').trim().toLowerCase();return ['red','white','rose','orange'].includes(value)?value:'';
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

 const lookupCompleted=w.identityMatchStatus!=null;
 if(!lookupCompleted)return [evidence];

 const persistIdentity=w.identityMatchStatus==='matched'
  ?Boolean(w.lwin7)
  :w.identityMatchStatus==='manual'&&Boolean(w.lwin7||w.elid);
 const suggestions=persistIdentity&&w.identityMatchStatus==='matched'?buildReferenceSuggestions({
   producer:w.producer,wineName:w.wineName,country:w.country,region:w.region,classification:w.classification,classificationOverride:w.classificationOverride,
   referenceProducer:w.referenceProducer,referenceWineName:w.referenceWineName,referenceCountry:w.referenceCountry,referenceRegion:w.referenceRegion,referenceClassification:w.referenceClassification
  }):[];
 const identity=db.prepare(`UPDATE wines SET reference_product_key=?,lwin7=?,lwin11=?,elid=?,colour=?,product_type=?,product_subtype=?,
   identity_match_status=?,identity_match_confidence=?,identity_matched_at=?,reference_suggestions_json=?,reference_suggestions_updated_at=? WHERE owner_id=? AND id=?`)
   .bind(persistIdentity?w.referenceProductKey??null:null,persistIdentity?w.lwin7??null:null,persistIdentity?w.lwin11??null:null,persistIdentity?w.elid??null:null,
    persistIdentity?w.colour??null:null,persistIdentity?w.productType??null:null,persistIdentity?w.productSubtype??null:null,
    w.identityMatchStatus,persistIdentity?w.identityMatchConfidence??(w.identityMatchStatus==='manual'?null:1):null,persistIdentity?stamp:null,
    suggestions.length?JSON.stringify(suggestions):null,suggestions.length?stamp:null,owner,wineId);
 return [evidence,identity];
}

type ReferenceResolvable={
 producer?:string|null;wineName?:string|null;vintage?:number|null;vintageKind?:VintageKind|null;releaseDesignation?:string|null;
 country?:string|null;region?:string|null;style?:string|null;wineStyle?:string|null;classification?:string|null;classificationOverride?:string|null;
};
export type ReferenceMatch={
 referenceProductKey:string|null;lwin7:string|null;lwin11:string|null;elid:string|null;
 identityMatchStatus:IdentityMatchStatus;identityMatchConfidence:number|null;
 colour:string|null;productType:string|null;productSubtype:string|null;
 referenceSubRegion:string|null;referenceSite:string|null;referenceParcel:string|null;
 referenceDesignation:string|null;referenceClassification:string|null;referenceProducer:string|null;referenceWineName:string|null;country:string|null;region:string|null;
};
const unmatched=(status:IdentityMatchStatus='unmatched'):ReferenceMatch=>({
 referenceProductKey:null,lwin7:null,lwin11:null,elid:null,identityMatchStatus:status,identityMatchConfidence:null,
 colour:null,productType:null,productSubtype:null,referenceSubRegion:null,referenceSite:null,referenceParcel:null,
 referenceDesignation:null,referenceClassification:null,referenceProducer:null,referenceWineName:null,country:null,region:null
});
const compatible=(candidate:LwinReferenceProduct,countryKey:string,regionKey:string,colourKey:string)=>
 (!countryKey||!candidate.countryKey||candidate.countryKey===countryKey)&&
 (!regionKey||!candidate.regionKey||candidate.regionKey===regionKey)&&
 (!colourKey||!candidate.colourKey||candidate.colourKey===colourKey);

function elidWineNameKeys(product:LwinReferenceProduct,wine:ReferenceResolvable){
 const keys=new Set([normalizeReferenceText(wine.wineName),normalizeReferenceText(product.wineName)].filter(Boolean));
 const release=normalizeReferenceText(wine.releaseDesignation);
 if(release)for(const key of [...keys])if(key.endsWith(release)){
  const base=key.slice(0,-release.length).trim();if(base)keys.add(base);
 }
 return [...keys];
}
async function registeredElid(bucket:R2Bucket,product:LwinReferenceProduct,wine:ReferenceResolvable){
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

export async function resolveWineReference(bucket:R2Bucket,wine:ReferenceResolvable):Promise<ReferenceMatch>{
 const producerKey=normalizeReferenceText(wine.producer),wineKey=referenceWineKey(wine.wineName,wine.releaseDesignation);
 if(!producerKey||!wineKey)return unmatched();
 const countryKey=normalizeReferenceText(wine.country),regionKey=normalizeReferenceText(wine.region),colourKey=colourFromStyle(wine.style??wine.wineStyle);
 const rows=await referenceRows<LwinReferenceProduct>(bucket,'lwin',producerKey);if(!rows.length)return unmatched();
 const candidates=rows.filter(row=>row.status!=='Deleted'&&row.producerKey===producerKey&&row.wineKey===wineKey&&compatible(row,countryKey,regionKey,colourKey));
 if(candidates.length!==1)return unmatched(candidates.length>1?'ambiguous':'unmatched');
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
 const elid=await registeredElid(bucket,product,wine);
 return {referenceProductKey:product.productKey,lwin7:product.lwin7,lwin11:null,elid,identityMatchStatus:'matched',identityMatchConfidence:1,
  colour:product.colour,productType:product.productType,productSubtype:product.productSubtype,
  referenceSubRegion:product.subRegion,referenceSite:product.site,referenceParcel:product.parcel,
  referenceDesignation:product.designation,referenceClassification:product.classification,referenceProducer:product.producerName,referenceWineName:product.wineName,country:product.country,region:product.region};
}
export async function enrichRecognitionReference<T extends ReferenceResolvable>(bucket:R2Bucket,wine:T){
 try{
  const match=await resolveWineReference(bucket,wine);
  const classification=wine.classification??(!wine.classificationOverride?appClassification(match.referenceClassification):null);
  return {...wine,...match,country:wine.country??match.country,region:wine.region??match.region,classification,referenceCountry:match.country,referenceRegion:match.region};
 }catch(error){
  console.warn(JSON.stringify({event:'wine-reference-lookup-failed',error:error instanceof Error?error.message:String(error)}));
  return wine;
 }
}
