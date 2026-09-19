import { resolvePlace } from '../places/resolve';
import { formatDate,formatPrice,formatRating } from './detailFormat';

/**
 * The single definition of what a wine detail page shows, for both the owner's
 * page and a recipient's. Adding or removing a field here changes both, which
 * is the point: the two pages drifted apart field by field until the shared one
 * was missing the denomination, the grape percentages and the As recorded line,
 * none of which had ever been withheld on purpose.
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
 lwin7?:string|Absent;lwin11?:string|Absent;elid?:string|Absent;
};

/**
 * The reference facts, which are a different kind of thing from the rest.
 *
 * Everything in WineFacts is either what the owner typed or something derived
 * from it. These came from the LWIN and ELID catalogues instead: nobody here
 * wrote them, and nobody here can edit them. They used to sit in the Wine
 * details table among the derived rows, which said the opposite.
 *
 * The two owner-only fields are declared optional rather than kept out. A
 * recipient is handed SharedWine, which has no field for either, so the rows
 * are dropped by `present` without anyone having to remember to drop them -
 * the same protection the private journal fields get from the type.
 */
export type WineReference=WineFacts&{
 identityMatchStatus?:'matched'|'suggested'|'ambiguous'|'unmatched'|'manual'|'conflict'|Absent;
 referenceProductKey?:string|Absent;
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

/**
 * What recognition first read off the label, shown only where it differs from
 * the corrected place - otherwise it is the same line printed twice.
 */
export function asRecordedLabel(wine:WineFacts){
 const recorded=[wine.recognizedRegion,wine.recognizedAppellation].filter(Boolean).join(' / ');
 return recorded&&recorded!==[wine.region,wine.appellation].filter(Boolean).join(' / ')?recorded:null;
}

/**
 * The Wine details rows, in reading order. Empty fields are dropped.
 *
 * Derived only: the identifiers and the catalogue's own product wording moved
 * to `referenceRows`, because a reader cannot tell a Liv-ex fact from a typed
 * one when the two sit in the same ruled table.
 */
export function wineFactRows(wine:WineFacts):FactRow[]{
 const {denominatedAppellation,denominatedRegion}=placeLabels(wine);
 return present([
  ['Region',denominatedRegion],
  ['Appellation',denominatedAppellation],
  ['As recorded',asRecordedLabel(wine)],
  ['Release',wine.releaseDesignation],
  ['Grapes / blend',blendLabels(wine).join(', ')],
  ['Alcohol',wine.alcoholPercentage!=null?`${wine.alcoholPercentage}%`:null]
 ]);
}

const matchStatusLabel:Record<string,string>={
 matched:'Verified',suggested:'Suggested',ambiguous:'Ambiguous',
 unmatched:'No match',manual:'Set by hand',conflict:'Conflicting'
};

/** Whether anything in the reference catalogues actually attached to this wine. */
export function hasReference(wine:WineReference):boolean{
 return Boolean(wine.lwin7||wine.lwin11||wine.elid||wine.referenceProductKey);
}

/**
 * The Official reference rows. Empty when nothing matched, so the panel is
 * absent rather than empty on a wine the catalogues have never heard of.
 *
 * `Site / parcel` is the exception to dropping empty fields, and it is
 * deliberate. LWIN can say a wine is Corton; it cannot yet say a wine is from
 * the Pernand side of Corton. Leaving the row out would let a reader assume the
 * question was never asked, when the truth is that it was asked and the
 * catalogue has no answer. A dash states the limit of the reference data.
 */
export function referenceRows(wine:WineReference):FactRow[]{
 if(!hasReference(wine))return [];
 return [
  ...present([
   ['Match status',wine.identityMatchStatus?matchStatusLabel[wine.identityMatchStatus]??wine.identityMatchStatus:null],
   ['LWIN7',wine.lwin7],
   ['LWIN11',wine.lwin11],
   ['ELID',wine.elid],
   ['Reference product',wine.referenceProductKey],
   ['Product type',wine.productSubtype??wine.productType],
   ['Colour',wine.colour]
  ]),
  ['Site / parcel','—']
 ];
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
