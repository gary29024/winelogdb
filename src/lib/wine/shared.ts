import type { DeepSearchResult } from '../db/schema';
import type { TastingStructure } from './tastingStructure';
import type { SparklingDetails } from './sparklingDetails';

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
  * The viewer's own producer row when one exists for the same match_key;
  * otherwise an authorised shared-producer reference that opens a read-only
  * source profile. It is never the raw source producer id by itself.
  */
 producerId:string|null;
 wineName:string;
 vintage:number|null;
 vintageKind:'vintage'|'non_vintage'|'multi_vintage'|'unknown'|null;
 releaseDesignation:string|null;
 lwin7:string|null;lwin11:string|null;elid:string|null;
 colour:string|null;productType:string|null;productSubtype:string|null;
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
 /**
  * The source owner's release details for the bottle they shared: dosage,
  * disgorgement, tirage, assemblage and the rest. Facts about that bottle
  * rather than anyone's experience of it, and the schema they are parsed with
  * is strict and wholly public, which a test pins - so the whole of it crosses
  * rather than a hand-listed subset. They are per-owner because an NV cuvee is
  * disgorged differently between releases, and what a friend is looking at is
  * the bottle that was shared.
  */
 sparklingDetails:SparklingDetails|null;
 favorite:boolean;
 updatedAt:string;
 photos?:Array<{id:string;url:string}>;
};
