import { z } from 'zod';
import { normalizeReferenceText } from './referenceCatalog';
import { appClassification } from './referenceSuggestions';

const text=z.string().nullable();
export const lwinReferenceSchema=z.object({
 source:z.literal('lwin'),version:z.string(),lwin7:z.string().regex(/^\d{7}$/),
 displayName:text.optional(),producerTitle:text.optional(),
 producer:text,wineName:text,country:text,region:text,subRegion:text,site:text,parcel:text,
 designation:text,classification:text,colour:text,productType:text,productSubtype:text,
 vintageConfig:text,firstVintage:z.number().nullable(),finalVintage:z.number().nullable(),sourceUpdatedAt:text,
 method:z.enum(['deterministic','ai','manual']),confidence:z.number().min(0).max(1).nullable(),
 // Only record fields actually filled by LWIN. Existing values keep their origin.
 filled:z.record(z.string(),z.string()).default({}),
 conflicts:z.array(z.object({field:z.string(),current:z.string(),reference:z.string()})).default([]),
 input:z.object({producer:text,wineName:text}).optional()
});
export type LwinReference=z.infer<typeof lwinReferenceSchema>;
export function readLwinReference(raw:unknown):LwinReference|null{
 try{const result=lwinReferenceSchema.safeParse(typeof raw==='string'?JSON.parse(raw):raw);return result.success?result.data:null}catch{return null}
}
export type LwinTaxonomy=Pick<LwinReference,'source'|'version'|'lwin7'|'displayName'|'producerTitle'|'producer'|'wineName'|'country'|'region'|'subRegion'|'site'|'parcel'|'designation'|'classification'|'colour'|'productType'|'productSubtype'|'vintageConfig'|'firstVintage'|'finalVintage'|'sourceUpdatedAt'>;
/** Allowlisted catalogue facts, safe for an already-authorized shared response. */
export function publicLwinTaxonomy(reference:LwinReference):LwinTaxonomy{
 const {source,version,lwin7,displayName,producerTitle,producer,wineName,country,region,subRegion,site,parcel,designation,classification,colour,productType,productSubtype,vintageConfig,firstVintage,finalVintage,sourceUpdatedAt}=reference;
 return {source,version,lwin7,displayName,producerTitle,producer,wineName,country,region,subRegion,site,parcel,designation,classification,colour,productType,productSubtype,vintageConfig,firstVintage,finalVintage,sourceUpdatedAt};
}

export type TaxonomyInput={producer?:string|null;wineName?:string|null;country?:string|null;region?:string|null;classification?:string|null;classificationOverride?:string|null;colour?:string|null;productType?:string|null;productSubtype?:string|null};
export function enrichLwinTaxonomy<T extends TaxonomyInput>(wine:T,reference:LwinReference){
 const result={...wine},filled={...reference.filled},conflicts:LwinReference['conflicts']=[];
 const values={country:reference.country,region:reference.region,classification:appClassification(reference.classification),colour:reference.colour,productType:reference.productType,productSubtype:reference.productSubtype};
 for(const [field,value] of Object.entries(values) as Array<[keyof typeof values,string|null]>){
  if(!value)continue;
  const current=wine[field]?.trim();
  if(field==='classification'&&wine.classificationOverride){
   if(wine.classificationOverride!==value)conflicts.push({field,current:wine.classificationOverride,reference:value});
   continue;
  }
  if(!current){result[field]=value;filled[field]=value}
  else if(normalizeReferenceText(current)!==normalizeReferenceText(value))conflicts.push({field,current,reference:value});
  // A later edit is no longer an LWIN-derived field, even if the reference stays.
  if(current&&filled[field]&&current!==filled[field])delete filled[field];
 }
 for(const field of ['producer','wineName'] as const){const current=wine[field]?.trim(),value=reference[field];if(current&&value&&normalizeReferenceText(current)!==normalizeReferenceText(value))conflicts.push({field,current,reference:value})}
 return {...result,lwinReference:{...reference,filled,conflicts}};
}

/** Strings only: LWIN18 exceeds JavaScript's safe integer precision. No truncation. */
export function parseLwinCode(value:unknown){
 if(typeof value!=='string'||! /^(?:\d{7}|\d{11}|\d{16}|\d{18})$/.test(value.trim()))return null;
 const code=value.trim(),precision=code.length as 7|11|16|18;
 const vintageCode=precision>=11?code.slice(7,11):null;
 return {code,precision,lwin7:code.slice(0,7),vintageCode,bottleSizeMl:precision>=16?Number(code.slice(-5)):null,packSize:precision===18?Number(code.slice(11,13)):null};
}

/** A stored code and accepted match status must still agree with the snapshot. */
export function reliableLwinReference(row:{lwin7?:unknown;identity_match_status?:unknown;lwin_reference_json?:unknown}){
 const reference=readLwinReference(row.lwin_reference_json);
 return reference&&reference.lwin7===row.lwin7&&(row.identity_match_status==='manual'||row.identity_match_status==='matched')?reference:null;
}
export function lwinResearchContext(row:Parameters<typeof reliableLwinReference>[0]){
 const reference=reliableLwinReference(row);if(!reference)return '';
 const facts=publicLwinTaxonomy(reference),conflicts=reference.conflicts;
 return `Known LWIN identity/reference facts (imported catalogue; do not rediscover these): ${JSON.stringify(facts)}. Conflicting logged fields, requiring caution: ${JSON.stringify(conflicts)}. This is product identity and taxonomy only, not evidence of viticulture, winemaking, history, terroir interpretation or tasting characteristics. Research those subjects from sources. Do not infer bottle/pack size or a specific vintage from LWIN7.`;
}
