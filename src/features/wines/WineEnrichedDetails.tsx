import { appClassification } from '../../lib/wine/referenceSuggestions';
import type { WineDetail } from './api';

/** Show saved values, not an alternative form populated from a disputed match. */
export function WineEnrichedDetails({wine}:{wine:WineDetail}){
 const accepted=Boolean(wine.lwin7)&&(wine.identityMatchStatus==='matched'||wine.identityMatchStatus==='manual');
 const reference=accepted&&wine.lwin7&&wine.lwinReference?.lwin7===wine.lwin7?wine.lwinReference:null;
 const facts=[
  ['Colour',wine.colour],['Product type',wine.productType],['Product subtype',wine.productSubtype],
  ['Sub-region',reference?.subRegion],['Site / vineyard',accepted?(wine.referenceSite||reference?.site):null],['Parcel',accepted?(wine.referenceParcel||reference?.parcel):null],
  ['Designation',reference?.designation],['Classification',reference?.classification&&!appClassification(reference.classification)?reference.classification:null]
 ].filter(([,value])=>value?.trim());
 if(!facts.length)return null;
 return <dl className="wine-enriched-details" aria-label="Saved wine details">{facts.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}
