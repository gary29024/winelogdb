import { normalizeLwinId,normalizeReferenceText } from './referenceIdentity';

export const LWIN_HEADERS=[
 'LWIN','STATUS','DISPLAY_NAME','PRODUCER_TITLE','PRODUCER_NAME','WINE','COUNTRY','REGION','SUB_REGION','SITE','PARCEL',
 'COLOUR','TYPE','SUB_TYPE','DESIGNATION','CLASSIFICATION','VINTAGE_CONFIG','FIRST_VINTAGE','FINAL_VINTAGE','DATE_ADDED','DATE_UPDATED','REFERENCE'
] as const;

export type LwinInputRow=Record<string,string|number|null|undefined>;
export type LwinReferenceProduct={
 productKey:string;lwin7:string;status:'Live'|'Combined'|'Deleted';referenceLwin7:string|null;
 displayName:string;producerTitle:string|null;producerName:string;wineName:string;
 producerKey:string;wineKey:string;country:string|null;countryKey:string;region:string|null;regionKey:string;
 subRegion:string|null;site:string|null;parcel:string|null;colour:string|null;colourKey:string;
 productType:string|null;productSubtype:string|null;designation:string|null;classification:string|null;
 vintageConfig:string|null;firstVintage:number|null;finalVintage:number|null;sourceAddedAt:string|null;sourceUpdatedAt:string|null;importedAt:string;
};

const missing=(value:unknown)=>value==null||!String(value).trim()||/^na$/i.test(String(value).trim());
const text=(value:unknown)=>missing(value)?null:String(value).trim();
const year=(value:unknown)=>{const n=Number(String(value??'').replace(/\.0+$/,''));return Number.isInteger(n)&&n>=1000&&n<=2200?n:null};
const date=(value:unknown)=>{
 const valueText=text(value);if(!valueText)return null;
 const parsed=new Date(valueText);return Number.isNaN(parsed.getTime())?null:parsed.toISOString();
};

export function validateLwinHeaders(headers:string[]){
 const missingHeaders=LWIN_HEADERS.filter(header=>!headers.includes(header));
 if(missingHeaders.length)throw new Error(`LWIN export is missing required columns: ${missingHeaders.join(', ')}`);
}

export function parseLwinReference(row:LwinInputRow,importedAt=new Date().toISOString()):LwinReferenceProduct{
 const lwin7=normalizeLwinId(row.LWIN);if(!lwin7)throw new Error(`Invalid LWIN: ${String(row.LWIN??'')}`);
 const status=String(row.STATUS??'').trim();
 if(status!=='Live'&&status!=='Combined'&&status!=='Deleted')throw new Error(`Invalid LWIN status for ${lwin7}: ${status}`);
 const displayName=text(row.DISPLAY_NAME),producerName=text(row.PRODUCER_NAME),wineName=text(row.WINE);
 if(!displayName||!producerName||!wineName)throw new Error(`LWIN ${lwin7} is missing display/producer/wine identity`);
 const referenceLwin7=normalizeLwinId(row.REFERENCE);
 if(status==='Combined'&&!referenceLwin7)throw new Error(`Combined LWIN ${lwin7} has no valid REFERENCE`);
 const country=text(row.COUNTRY),region=text(row.REGION),colour=text(row.COLOUR);
 return {
  productKey:`lwin:${lwin7}`,lwin7,status,referenceLwin7,displayName,producerTitle:text(row.PRODUCER_TITLE),producerName,wineName,
  producerKey:normalizeReferenceText(producerName),wineKey:normalizeReferenceText(wineName),
  country,countryKey:normalizeReferenceText(country),region,regionKey:normalizeReferenceText(region),
  subRegion:text(row.SUB_REGION),site:text(row.SITE),parcel:text(row.PARCEL),colour,colourKey:normalizeReferenceText(colour),
  productType:text(row.TYPE),productSubtype:text(row.SUB_TYPE),designation:text(row.DESIGNATION),classification:text(row.CLASSIFICATION),
  vintageConfig:text(row.VINTAGE_CONFIG),firstVintage:year(row.FIRST_VINTAGE),finalVintage:year(row.FINAL_VINTAGE),
  sourceAddedAt:date(row.DATE_ADDED),sourceUpdatedAt:date(row.DATE_UPDATED),importedAt
 };
}

