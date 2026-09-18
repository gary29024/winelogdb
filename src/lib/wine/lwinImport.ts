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
 const parsed=new Date(valueText);return Number.isNaN(parsed.getTime())?valueText:parsed.toISOString();
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

export const sqlLiteral=(value:unknown)=>{
 if(value==null)return 'NULL';
 if(typeof value==='number')return Number.isFinite(value)?String(value):'NULL';
 return `'${String(value).replace(/'/g,"''")}'`;
};

export function lwinUpsertSql(rows:LwinReferenceProduct[]){
 if(!rows.length)return '';
 const cols=['product_key','lwin7','status','reference_lwin7','display_name','producer_title','producer_name','wine_name','producer_key','wine_key','country','country_key','region','region_key','sub_region','site','parcel','colour','colour_key','product_type','product_subtype','designation','classification','vintage_config','first_vintage','final_vintage','source_added_at','source_updated_at','imported_at'];
 const values=rows.map(r=>[
  r.productKey,r.lwin7,r.status,r.referenceLwin7,r.displayName,r.producerTitle,r.producerName,r.wineName,r.producerKey,r.wineKey,
  r.country,r.countryKey,r.region,r.regionKey,r.subRegion,r.site,r.parcel,r.colour,r.colourKey,r.productType,r.productSubtype,r.designation,
  r.classification,r.vintageConfig,r.firstVintage,r.finalVintage,r.sourceAddedAt,r.sourceUpdatedAt,r.importedAt
 ].map(sqlLiteral).join(','));
 return `INSERT INTO wine_reference_products(${cols.join(',')}) VALUES\n(${values.join('),\n(')})\nON CONFLICT(product_key) DO UPDATE SET
  lwin7=excluded.lwin7,status=excluded.status,reference_lwin7=excluded.reference_lwin7,display_name=excluded.display_name,
  producer_title=excluded.producer_title,producer_name=excluded.producer_name,wine_name=excluded.wine_name,
  producer_key=excluded.producer_key,wine_key=excluded.wine_key,country=excluded.country,country_key=excluded.country_key,
  region=excluded.region,region_key=excluded.region_key,sub_region=excluded.sub_region,site=excluded.site,parcel=excluded.parcel,
  colour=excluded.colour,colour_key=excluded.colour_key,product_type=excluded.product_type,product_subtype=excluded.product_subtype,
  designation=excluded.designation,classification=excluded.classification,vintage_config=excluded.vintage_config,
  first_vintage=excluded.first_vintage,final_vintage=excluded.final_vintage,source_added_at=excluded.source_added_at,
  source_updated_at=excluded.source_updated_at,imported_at=excluded.imported_at;`;
}
