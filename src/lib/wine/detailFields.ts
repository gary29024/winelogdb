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

/** The Wine details rows, in reading order. Empty fields are dropped. */
export function wineFactRows(wine:WineFacts):FactRow[]{
 const {denominatedAppellation,denominatedRegion}=placeLabels(wine);
 return present([
  ['Region',denominatedRegion],
  ['Appellation',denominatedAppellation],
  ['As recorded',asRecordedLabel(wine)],
  ['Grapes / blend',blendLabels(wine).join(', ')],
  ['Alcohol',wine.alcoholPercentage!=null?`${wine.alcoholPercentage}%`:null]
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
