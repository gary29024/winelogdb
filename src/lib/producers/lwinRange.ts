import { reliableLwinReference,publicLwinTaxonomy,type LwinReference,type LwinTaxonomy } from '../wine/lwinMetadata';
import { lwinReferenceIdentity,lwinStrictRowsForProducer,normalizeReferenceText,producerHouseQualifier,producerLookupKeys,referenceManifest,ReferenceReadScope } from '../wine/referenceCatalog';
import type { LwinReferenceProduct } from '../wine/lwinImport';
import { stripProducerCatalogPrefix } from './catalogName';
import type { CatalogLike } from './researchQuality';

// Retries and page views ask for the same producer within minutes. The imported
// catalogue is versioned, so its rows can be reused briefly, per bucket, in this isolate.
const LWIN_ROWS_TTL_MS=10*60_000,LWIN_ROWS_MAX=500;
const lwinRowsCache=new WeakMap<R2Bucket,Map<string,{at:number;rows:Promise<LwinReferenceProduct[]>}>>();
function cachedProducerRows(bucket:R2Bucket,scope:ReferenceReadScope,version:string,name:string){
 let cache=lwinRowsCache.get(bucket);if(!cache){cache=new Map();lwinRowsCache.set(bucket,cache)}
 const key=`${version}\u0000${name}`,hit=cache.get(key),now=Date.now();
 if(hit&&now-hit.at<LWIN_ROWS_TTL_MS)return hit.rows;
 const rows=lwinStrictRowsForProducer<LwinReferenceProduct>(scope,name);
 rows.catch(()=>cache.delete(key));
 if(cache.size>=LWIN_ROWS_MAX)cache.delete(cache.keys().next().value!);
 cache.set(key,{at:now,rows});return rows;
}

export async function producerLwinReferences(db:D1Database,owner:string,producerId:string,bucket?:R2Bucket){
 const rows=await db.prepare(`SELECT lwin7,identity_match_status,lwin_reference_json FROM wines
  WHERE owner_id=? AND producer_id=? AND lwin7 IS NOT NULL AND lwin_reference_json IS NOT NULL
  AND identity_match_status IN ('matched','manual') ORDER BY id LIMIT 150`).bind(owner,producerId).all<{lwin7:string;identity_match_status:string;lwin_reference_json:string}>();
 const references=new Map<string,LwinReference>();
 for(const row of rows.results){const reference=reliableLwinReference(row);if(reference)references.set(reference.lwin7,reference)}
 if(bucket){
  try{
  const scope=new ReferenceReadScope(bucket),manifest=await referenceManifest(scope,'lwin');
  if(manifest){
   const producer=await db.prepare('SELECT canonical_name FROM producers WHERE owner_id=? AND id=?').bind(owner,producerId).first<{canonical_name:string}>();
   const aliases=await db.prepare('SELECT display_alias FROM producer_aliases WHERE owner_id=? AND producer_id=?').bind(owner,producerId).all<{display_alias:string}>();
   const names=[...new Set([producer?.canonical_name,...aliases.results.map(row=>row.display_alias),...[...references.values()].map(row=>row.producer)].filter((name):name is string=>Boolean(name)))];
   for(const name of names){
    const keys=producerLookupKeys(name),qualifier=producerHouseQualifier(name);
    const candidates=(await cachedProducerRows(bucket,scope,manifest.version,name)).filter(row=>{
     const identity=lwinReferenceIdentity(row),other=producerHouseQualifier(identity.producerName);
     return row.status==='Live'&&Boolean(identity.wineName)&&(!row.productType||/^(?:Wine|Fortified Wine)$/i.test(row.productType))
      &&!(qualifier&&other&&qualifier!==other)&&producerLookupKeys(identity.producerName).some(key=>keys.includes(key));
    });
    // An unqualified name cannot combine a domaine and a négociant house.
    const exact=candidates.filter(row=>normalizeReferenceText(lwinReferenceIdentity(row).producerName)===normalizeReferenceText(name));
    const identities=new Set(candidates.map(row=>normalizeReferenceText(lwinReferenceIdentity(row).producerName)));
    const accepted=exact.length?exact:identities.size===1?candidates:[];
    for(const row of accepted){
     const identity=lwinReferenceIdentity(row);
     references.set(row.lwin7,{identityVersion:2,source:'lwin',version:manifest.version,lwin7:row.lwin7,displayName:row.displayName,producerTitle:row.producerTitle,
      producer:identity.producerName,wineName:identity.wineName,country:row.country,region:row.region,subRegion:row.subRegion,site:row.site,parcel:row.parcel,
      designation:row.designation,classification:row.classification,colour:row.colour,productType:row.productType,productSubtype:row.productSubtype,
      vintageConfig:row.vintageConfig,firstVintage:row.firstVintage,finalVintage:row.finalVintage,sourceUpdatedAt:row.sourceUpdatedAt,
      method:'deterministic',confidence:1,filled:{},conflicts:[]});
    }
   }
  }
  }catch(error){console.warn(JSON.stringify({event:'producer_lwin_lookup_unavailable',producerId,error:error instanceof Error?error.message:String(error)}))}
 }
 return [...references.values()];
}
export function producerLwinContext(references:LwinReference[]){
 if(!references.length)return '';
 const facts=references.slice(0,150).map(({lwin7,producer,wineName,country,region,subRegion,classification,colour,productSubtype,finalVintage})=>({lwin7,producer,wineName,country,region,subRegion,classification,colour,productSubtype,finalVintage}));
 return `Known imported LWIN identity and taxonomy (${references.length} records; ${facts.length} shown); this is not the complete or current producer range. Use this identity checklist instead of rediscovering names and classifications. Verify current/recent availability and find additions from the official range pages; catalogue records can include historical wines. Preserve distinct house identities, cuvees and regional classification systems. LWIN is not evidence for history, viticulture, winemaking or tasting characteristics.\n${JSON.stringify(facts)}`;
}
/** Attach only a unique, name/style/producer-compatible identity. Never merge cuvees by taxonomy. */
export function attachLwinRange<T extends CatalogLike>(range:T[],references:LwinReference[],producerNames:string[]):Array<T&{lwinReference?:LwinTaxonomy}>{
 const names=new Set(producerNames.map(normalizeReferenceText));
 return range.map(item=>{
  const name=normalizeReferenceText(stripProducerCatalogPrefix(item.name,producerNames));
  const matches=references.filter(reference=>{
   if(!names.has(normalizeReferenceText(reference.producer))||normalizeReferenceText(reference.wineName)!==name)return false;
   // Existing manual/researched taxonomy wins a populated disagreement. The
   // reference must not silently change a catalogue correction's presentation.
   const classification=normalizeReferenceText(item.classification).replace(/^1er cru$/,'premier cru');
   if(classification&&classification!==normalizeReferenceText(reference.classification).replace(/^1er cru$/,'premier cru'))return false;
   if(item.appellation&&reference.subRegion&&normalizeReferenceText(item.appellation)!==normalizeReferenceText(reference.subRegion))return false;
   const style=normalizeReferenceText(item.category??item.style),colour=normalizeReferenceText(reference.colour),subtype=normalizeReferenceText(reference.productSubtype);
   return (!['red','white','rose'].includes(style)||style===colour&&subtype!=='sparkling')&&(style!=='sparkling'||subtype==='sparkling');
  });
  return {...item,lwinReference:matches.length===1?publicLwinTaxonomy(matches[0]):undefined};
 });
}

/** True when a producer has no researched range yet but at least one logged
 * wine reliably linked to LWIN. Its imported range is shown first, unverified,
 * and the paid range search runs only when someone asks to verify it. */
export async function lwinRangeFirst(db:D1Database,owner:string,producerId:string){
 const producer=await db.prepare('SELECT catalog_json FROM producers WHERE owner_id=? AND id=?').bind(owner,producerId).first<{catalog_json:string|null}>();
 if(!producer||hasResearchedRange(producer.catalog_json))return false;
 const rows=await db.prepare(`SELECT lwin7,identity_match_status,lwin_reference_json FROM wines
  WHERE owner_id=? AND producer_id=? AND lwin7 IS NOT NULL AND lwin_reference_json IS NOT NULL
  AND identity_match_status IN ('matched','manual') LIMIT 20`).bind(owner,producerId).all<{lwin7:string;identity_match_status:string;lwin_reference_json:string}>();
 // Same test the producer page applies, so a skipped range search always has a
 // range to show instead (a linked wine LWIN records as long ended does not count).
 return lwinCatalog(rows.results.map(reliableLwinReference).filter((reference):reference is LwinReference=>Boolean(reference))).length>0;
}
function hasResearchedRange(catalogJson:string|null){
 try{const value=JSON.parse(catalogJson??'[]') as unknown;return Array.isArray(value)&&value.length>0}catch{return false}
}
function lwinCategory(reference:LwinReference){
 const subtype=normalizeReferenceText(reference.productSubtype),type=normalizeReferenceText(reference.productType),colour=normalizeReferenceText(reference.colour);
 if(subtype.includes('sparkling'))return 'sparkling' as const;
 if(type.includes('fortified'))return 'fortified' as const;
 if(subtype.includes('sweet')||subtype.includes('dessert'))return 'dessert' as const;
 if(colour==='red'||colour==='white'||colour==='rose'||colour==='orange')return colour;
 return 'other' as const;
}
export const LWIN_ENDED_GRACE_YEARS=3;
/** Imported LWIN identities as a read-only range. Wines LWIN records as ended
 * more than a few vintages ago are left out; nothing here proves current production. */
export function lwinCatalog(references:LwinReference[],now=new Date()){
 const cutoff=now.getUTCFullYear()-LWIN_ENDED_GRACE_YEARS,seen=new Set<string>();
 return references.filter(reference=>{
  if(!reference.wineName||(reference.finalVintage!=null&&Number(reference.finalVintage)<cutoff))return false;
  const key=`${normalizeReferenceText(reference.wineName)}|${lwinCategory(reference)}`;
  if(seen.has(key))return false;seen.add(key);return true;
 }).map(reference=>({name:String(reference.wineName),category:lwinCategory(reference),appellation:reference.subRegion??reference.region??null,
  classification:reference.classification??null,style:null,notes:null,lwinReference:publicLwinTaxonomy(reference)}))
  .sort((a,b)=>a.name.localeCompare(b.name));
}
