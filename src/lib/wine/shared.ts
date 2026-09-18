import type { DeepSearchResult } from '../db/schema';
import type { TastingStructure } from './tastingStructure';

/**
 * The published shape of a Deep Search result: the research a friend reads, and
 * nothing else. model, quality and provenance answer "should I trust this run"
 * and belong to whoever paid for it and can re-run it, so they are absent from
 * the type rather than merely unrendered - the page not drawing them is not a
 * boundary, and the JSON is what actually crosses between accounts.
 */
export type SharedDeepSearch=Pick<DeepSearchResult,
 'summary'|'vintageQuality'|'producerDetails'|'producerWinemakingPractices'
 |'winemakingTechniques'|'terroir'|'drinkingWindow'|'sources'|'researchedAt'>
 &{expectedProfile?:string;oldestResearchedAt?:string};

export type SharedWineExperience={
 tastingNotes:string;
 rating:number|null;
 tastingDate:string|null;
 tastingName:string|null;
 venue:string|null;
 locationName:string|null;
 price:number|null;
 currency:string|null;
 /** The viewer's own perceived structure, never the source owner's. */
 structure:TastingStructure|null;
};

/** Shared identity/facts plus the current viewer's own experience. Source-owner
 * journal fields are never copied into the recipient's experience. */
export type SharedWine = SharedWineExperience&{
 id:string;
 ownerName:string;
 producer:string;
 /**
  * The VIEWER's own producer row for the same producer, matched on match_key,
  * or null when they have not logged this producer themselves. Never the source
  * owner's id: producers are keyed (owner_id, id), so that id does not resolve
  * in the viewer's account and a link built from it would 404.
  */
 producerId:string|null;
 wineName:string;
 vintage:number|null;
 country:string|null;
 region:string|null;
 appellation:string|null;
 /** What recognition first read off the label, before any correction. */
 recognizedRegion:string|null;
 recognizedAppellation:string|null;
 wineStyle:string|null;
 grapes:string[];
 /** Grapes with their percentages where the source owner recorded them. */
 grapeBlend:Array<{grape:string;percentage:number|null}>;
 classification:'grand_cru'|'premier_cru'|'village'|null;
 alcoholPercentage:number|null;
 /**
  * The research the source owner already paid for. Wine facts under this
  * feature's own rule, and the reusable-research tables already hand a friend's
  * research back rather than charging for it twice. Read-only: starting or
  * cancelling a run stays with the owner.
  */
 deepSearch:SharedDeepSearch|null;
 favorite:boolean;
 updatedAt:string;
 photos?:Array<{id:string;url:string}>;
};
