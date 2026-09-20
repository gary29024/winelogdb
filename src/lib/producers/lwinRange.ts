import { reliableLwinReference,publicLwinTaxonomy,type LwinReference,type LwinTaxonomy } from '../wine/lwinMetadata';
import { normalizeReferenceText } from '../wine/referenceCatalog';
import { stripProducerCatalogPrefix } from './catalogName';
import type { CatalogLike } from './researchQuality';

export async function producerLwinReferences(db:D1Database,owner:string,producerId:string){
 const rows=await db.prepare(`SELECT lwin7,identity_match_status,lwin_reference_json FROM wines
  WHERE owner_id=? AND producer_id=? AND lwin7 IS NOT NULL AND lwin_reference_json IS NOT NULL
  AND identity_match_status IN ('matched','manual') ORDER BY id LIMIT 150`).bind(owner,producerId).all<{lwin7:string;identity_match_status:string;lwin_reference_json:string}>();
 const references=new Map<string,LwinReference>();
 for(const row of rows.results){const reference=reliableLwinReference(row);if(reference)references.set(reference.lwin7,reference)}
 return [...references.values()];
}
export function producerLwinContext(references:LwinReference[]){
 return references.length?'Known LWIN identity and taxonomy for logged wines; this is not the complete or current producer range. Reuse these facts without rediscovering them. Preserve distinct house identities, cuvees and regional classification systems. LWIN is not evidence for history, viticulture, winemaking or tasting characteristics.\n'+JSON.stringify(references.slice(0,40).map(publicLwinTaxonomy)):'';
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
