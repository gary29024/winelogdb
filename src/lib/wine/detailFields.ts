import { resolvePlace } from '../places/resolve';
import { formatDate,formatPrice,formatRating } from './detailFormat';
import { normalizeReferenceText } from './referenceCatalog';
import type { IdentityMatchStatus } from './referenceIdentity';

/**
 * The single definition of what a wine detail page shows, for both the owner's
 * page and a recipient's. Adding or removing a field here changes both, which
 * is the point: the two pages drifted apart field by field until the shared one
 * was missing denomination and grape percentages unintentionally.
 *
 * Privacy is enforced by the types rather than by remembering. A recipient is
 * given SharedWine, which simply has no field for anything private, so a source
 * owner's note or price cannot reach these builders in the first place. A field
 * that must stay owner-only therefore belongs on WineDetail alone, and is
 * appended by DetailPage next to these rows - never added here.
 */

// WineDetail declares most of these optional and SharedWine declares them
// nullable, so the view accepts either shape rather than making a page
// normalise before it can ask for its own rows.
type Absent=null|undefined;
export type WineFacts={
 wineName?:string|Absent;
 country?:string|Absent;
 region?:string|Absent;
 appellation?:string|Absent;
 recognizedRegion?:string|Absent;
 recognizedAppellation?:string|Absent;
 grapes?:readonly string[];
 grapeBlend?:readonly {grape:string;percentage?:number|Absent}[];
 alcoholPercentage?:number|Absent;
 releaseDesignation?:string|Absent;
 vintageKind?:'vintage'|'non_vintage'|'multi_vintage'|'unknown'|Absent;
 colour?:string|Absent;productType?:string|Absent;productSubtype?:string|Absent;
 lwin7?:string|Absent;lwin11?:string|Absent;elid?:string|Absent;referenceSite?:string|Absent;referenceParcel?:string|Absent;
 identityMatchStatus?:IdentityMatchStatus|Absent;
};

export type WineExperience={
 rating?:number|Absent;
 tastingDate?:string|Absent;
 tastingName?:string|Absent;
 venue?:string|Absent;
 locationName?:string|Absent;
 price?:number|Absent;
 currency?:string|Absent;
};

export type FactRow=[string,string];
const present=(rows:Array<[string,string|null|undefined]>):FactRow[]=>
 rows.filter((row):row is FactRow=>Boolean(row[1]));

/**
 * The appellation scheme, and the two place strings it appears inside. Derived
 * from country/region/appellation, which every viewer of a wine already has, so
 * this needs nothing from the server on either page.
 */
export function placeLabels(wine:WineFacts){
 const denomination=resolvePlace({country:wine.country,region:wine.region,appellation:wine.appellation}).denomination;
 return {
  denomination,
  denominatedAppellation:wine.appellation?[wine.appellation,denomination].filter(Boolean).join(' '):null,
  denominatedRegion:[wine.appellation?wine.region:[wine.region,denomination].filter(Boolean).join(' '),wine.country].filter(Boolean).join(', ')
 };
}

/** Grapes with percentages where they were recorded, else the plain names. */
export function blendLabels(wine:WineFacts){
 const blend=wine.grapeBlend??[],grapes=wine.grapes??[];
 return blend.length?blend.map(part=>`${part.grape}${part.percentage!=null?` ${part.percentage}%`:''}`):grapes;
}

/** A reference site/parcel is useful only when the same words are not already
 * visible in the wine name or the legal place fields. */
function additionalReferencePlace(value:string|Absent,wine:WineFacts,extra:Array<string|Absent>=[]){
 const candidate=value?.trim();if(!candidate)return null;
 const candidateKey=normalizeReferenceText(candidate);if(!candidateKey)return null;
 const covered=[wine.wineName,wine.region,wine.appellation,...extra].some(item=>{
  const itemKey=normalizeReferenceText(item);return Boolean(itemKey&&` ${itemKey} `.includes(` ${candidateKey} `));
 });
 return covered?null:candidate;
}

/** The Wine details rows, in reading order. Empty fields are dropped. */
export function wineFactRows(wine:WineFacts):FactRow[]{
 const {denominatedAppellation,denominatedRegion}=placeLabels(wine),site=additionalReferencePlace(wine.referenceSite,wine),parcel=additionalReferencePlace(wine.referenceParcel,wine,[site]);
 const conflict=wine.identityMatchStatus==='conflict',referenceLabel=(label:string)=>conflict?`${label} (needs review)`:label;
 return present([
  ['Region',denominatedRegion],
  ['Appellation',denominatedAppellation],
  ['Release',wine.releaseDesignation],
  // A manual decision retires the review panel, so this row is the only place
  // left that says matching is off - and the only place that can say where to
  // undo it, now that there is no longer a control below to point at.
  ['Reference identity',conflict?'Conflict — stored reference details may not match this wine.':wine.identityMatchStatus==='manual'&&!wine.lwin7&&!wine.elid?'Kept without LWIN · automatic matching off · link one in Edit tasting':null],
  [referenceLabel('Type'),[wine.colour,wine.productSubtype??wine.productType].filter(Boolean).join(' · ')],
  ['Alcohol',wine.alcoholPercentage!=null?`${wine.alcoholPercentage}%`:null],
  ['Grapes / blend',blendLabels(wine).join(', ')],
  [referenceLabel('LWIN site'),site],[referenceLabel('LWIN parcel'),parcel],
  [referenceLabel('LWIN7'),wine.lwin7],[referenceLabel('LWIN11'),wine.lwin11],[referenceLabel('ELID'),wine.elid]
 ]);
}

/**
 * The Your experience rows, in reading order. The score leads because it is the
 * taster's own: in the pills it read as a property of the bottle.
 */
export function experienceRows(experience:WineExperience):FactRow[]{
 return present([
  ['Your rating',formatRating(experience.rating)],
  ['Drinking date',formatDate(experience.tastingDate)],
  ['Tasting / event',experience.tastingName],
  ['Venue',experience.venue],
  ['Location',experience.locationName],
  ['Price',formatPrice(experience.price,experience.currency)]
 ]);
}
