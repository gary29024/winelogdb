import type { LwinReferenceProduct } from './lwinImport';
import { canonicalizeWineFields } from './canonicalize';
import { lwinReferenceIdentity,normalizeReferenceText,producerHouseQualifier,producerLookupKeys } from './referenceCatalog';

export type LwinClues={producer?:string|null;country?:string|null;region?:string|null;colour?:string|null;wineStyle?:string|null;style?:string|null;productType?:string|null;productSubtype?:string|null;appellation?:string|null;subRegion?:string|null;site?:string|null;parcel?:string|null;designation?:string|null;classification?:string|null;vintage?:number|null};
const key=(value:string|null|undefined)=>normalizeReferenceText(value).replace(/^1er cru$/,'premier cru');
export function compatibleLwinProduct(row:LwinReferenceProduct,input:LwinClues){
 const place=canonicalizeWineFields({country:input.country,region:input.region,appellation:input.appellation}),candidate=canonicalizeWineFields({country:row.country,region:row.region,appellation:row.subRegion});
 const style=key(input.style??input.wineStyle),colour=input.colour||(['red','white','rose'].includes(style)?style:null);
 const subtype=input.productSubtype||(style==='sparkling'?'Sparkling':null);
 const type=input.productType||(style==='fortified'?'Fortified Wine':null);
 const pairs=[ [place.country,candidate.country],[place.region,candidate.region],[colour,row.colour],[subtype,row.productSubtype],[type,row.productType],
  [input.appellation?place.appellation:input.subRegion,candidate.appellation??row.subRegion],[input.site,row.site],[input.parcel,row.parcel],[input.designation,row.designation],[input.classification,row.classification] ];
 if(pairs.some(([a,b])=>a?.trim()&&b?.trim()&&key(a)!==key(b)))return false;
 if(['red','white','rose','orange'].includes(style)&&key(row.productSubtype)==='sparkling')return false;
 if(['red','white','rose','orange','sparkling','dessert','sweet'].includes(style)&&row.productType&&key(row.productType)!=='wine')return false;
 if(input.vintage!=null&&((row.firstVintage!=null&&input.vintage<row.firstVintage)||(row.finalVintage!=null&&input.vintage>row.finalVintage)))return false;
 return true;
}

/** Only the catalogue's explicit parenthetical suffix can supply an estate alias. */
export function parentheticalProducerAlias(producer:string|null|undefined,row:LwinReferenceProduct){
 const identity=lwinReferenceIdentity(row),name=identity.producerName??'';
 const base=name.match(/^(.+?)\s+\([^()]+\)$/)?.[1];if(!base)return false;
 const qualifier=producerHouseQualifier(producer),other=producerHouseQualifier(name);
 if(qualifier&&other&&qualifier!==other)return false;
 const bases=producerLookupKeys(base).filter(value=>!producerHouseQualifier(value)&&value.split(' ').length>=2);
 return producerLookupKeys(producer).some(value=>bases.includes(value));
}

/** Retrieval equivalence only: an unqualified name cannot choose a house. */
export function unqualifiedLwinHouse(producer:string|null|undefined,row:LwinReferenceProduct){
 if(producerHouseQualifier(producer))return false;
 const keys=producerLookupKeys(producer);
 return producerLookupKeys(lwinReferenceIdentity(row).producerName).some(value=>keys.includes(value));
}

export function sameLwinProducer(producer:string|null|undefined,row:LwinReferenceProduct){
 const identity=lwinReferenceIdentity(row),input=key(producer),candidate=key(identity.producerName);
 const qualifier=producerHouseQualifier(producer),other=producerHouseQualifier(identity.producerName);
 if(qualifier&&other&&qualifier!==other)return false;
 if(input===candidate)return true;
 // A catalogue-authored parenthetical estate is a possible short-name alias.
 // The caller must still require the wine identity and a unique compatible row.
 if(parentheticalProducerAlias(producer,row))return true;
 // Ch./Chateau are spelling aliases of the same explicit house type.
 if(qualifier&&qualifier===other)return producerLookupKeys(producer).some(a=>producerLookupKeys(identity.producerName).includes(a));
 return !qualifier&&input===identity.structuredProducerKey;
}
