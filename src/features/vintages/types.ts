/**
 * The Vintages data contract.
 *
 * The weather pipeline (scripts/vintages) writes measurements only - degree
 * days, millimetres, dates, sugar curves. Everything a reader sees on top of
 * them (early or late, "cool, wet, late", helps or hurts) is derived in
 * model.ts, so the wording can change without re-running the pipeline, and the
 * same file shape serves any region: Burgundy is the first, not a special case.
 */

export type GrapeId='pinot-noir'|'chardonnay';

/** Where a sampled place sits; one weather series is read per village. */
export type VintageVillage={id:string;name:string;area:string;lat:number;lon:number};

export type VintageArea={id:string;name:string};

export type VintageGrape={
  id:GrapeId;
  name:string;
  /** Sugar, in g/L, the region treats as normal ripeness for its still wines. */
  ripeSugar:number;
  /** The appellation's minimum sugar at harvest for village wines (g/L of must). */
  minSugar:number;
};

export type VintageRegionConfig={
  id:string;
  name:string;
  country:string;
  /** The growing season runs Apr–Oct in the north and Oct–Apr in the south. */
  hemisphere:'north'|'south';
  areas:readonly VintageArea[];
  villages:readonly VintageVillage[];
  grapes:readonly VintageGrape[];
  /** Static folder the page loads from: index.json plus one <village>.json each. */
  dataDir:string;
};

/** One season's weather at one village, Apr–Oct unless named otherwise. */
export type SeasonWeather={
  /** Growing degree days above 10 °C, 1 Apr – 30 Sep. */
  gdd:number;
  /** Rain 1 Apr – 30 Sep, mm. */
  rainAprSep:number;
  /** Mean of August daily minimum temperatures, °C. */
  augNights:number;
  /** Days with a minimum at or below 0 °C, 1 Apr – 15 May. */
  frostDays:number;
  /** Days with a maximum at or above 30 °C, 1 Apr – 30 Sep. */
  heatDays:number;
  /** Rain in September, mm. */
  sepRain:number;
  /** Rain from a week before the area's harvest start to the end of the picking fortnight (absent while a harvest is under way). */
  harvestRain?:number;
  /** 1 km radar rain (from 1997), or the 8 km record scaled to it (earlier years). Absent on normals. */
  rainSource?:'1km'|'8km';
};

/** What the season did after colour change, read up to the middle of the picking window. */
export type RipeningWeather={
  /** Mean daily temperature, °C. */
  meanTemp:number;
  /** Share of nights with a minimum below 13 °C, 0–1. */
  coolNights:number;
  /** Days with a maximum at or above 35 °C. */
  heatStressDays:number;
  /** Rain, mm. */
  rain:number;
  /** Days with at least 2 mm of rain and a mean of 10 °C or more, when grey rot spreads (absent in older files). */
  wetDays?:number;
  /** Solar radiation, daily mean over the ripening weeks, MJ/m². */
  radiation:number;
};

/**
 * A modelled sugar curve. Values are g/L at `step`-day intervals starting on
 * `start` (MM-DD in the season's year).
 */
export type SugarCurve={start:string;step:number;values:number[]};

export type GrapeSeason={
  /** Modelled véraison, ISO date. */
  veraison:string;
  sugar:SugarCurve;
  ripening:RipeningWeather;
  /** What the season's weather points to on the critics' 1-5 scale (scripts/vintages/pipeline/quality.py). */
  outlook?:QualityOutlook;
};

export type OutlookDriver={id:'ripeness'|'warmth'|'heat'|'wet'|'harvestRain'|'acidity'|'hail';effect:'helps'|'hurts'};
export type QualityOutlook={score:number;low:number;high:number;drivers:OutlookDriver[];
  /** Inputs that went well past every season the outlook was tested on; read at the edge of that range. */
  beyondTested?:OutlookDriver['id'][]};
export type OutlookCheck={years:number;correlation:number|null;error:number;errorIfAverage:number;withinOneStep:number;spread:number};
export type QualityModel={
  labels:string[];modernFrom:number;sources:string[];
  grapes:Partial<Record<GrapeId,{colour:'red'|'white';modernScale:number;warmthCap?:number|null;validation:{before:OutlookCheck;since:OutlookCheck;all:OutlookCheck};
    /** Côte d'Or outlooks recorded before critics rated the season (data/outlook_record.csv). */
    recorded?:{year:number;score:number;low:number;high:number;recorded:string;critics?:number}[]}>>;
  /** Critics' consensus by colour then year: [rating 1-5, number of critics]. */
  consensus:Record<'red'|'white',Record<string,[number,number]>>;
};

export type VillageSeason=SeasonWeather&{grapes:Partial<Record<GrapeId,GrapeSeason>>};

/** The same fields averaged over the baseline, with the sugar curve's usual spread. */
export type VillageNormal=SeasonWeather&{grapes:Partial<Record<GrapeId,{
  veraison:string; // MM-DD
  sugar:SugarCurve;
  /** 10th and 90th percentile curves, same start and step. */
  sugarLow:number[];
  sugarHigh:number[];
  ripening:RipeningWeather;
}>>};

export type HarvestStart={
  /** ISO date picking began, or the modelled date where no source records one. */
  date:string;
  /** official: a ban des vendanges or declared opening; reported: a start a source records; estimated: modelled. */
  source:'official'|'reported'|'estimated';
};

export type AreaHarvest={
  /** Usual start over the baseline, MM-DD. */
  typical:string;
  years:Record<string,HarvestStart>;
};

/** <dataDir>/index.json - what every village of a region shares. */
/** A dated frost or hail a source records: weather grids miss both, so they are kept by hand. */
export type VineyardEvent={date:string;type:'spring-frost'|'hail';villages?:string;source:string};

export type VintageIndex={
  region:string;
  generatedAt:string;
  /** True for the hand-built sample shipped before the real pipeline has run. */
  sample:boolean;
  baseline:{from:number;to:number;
    /** Radar rain starts later than the temperature record; the rain baseline says so. */
    rainFrom?:number};
  sources:{label:string;detail:string}[];
  harvest:Record<string,AreaHarvest>;
  /** Frost and hail a source records, by area then year (scripts/vintages/data/vineyard_events.csv). */
  events?:Record<string,Record<string,VineyardEvent[]>>;
  quality?:QualityModel;
  /** Villages that have a data file. */
  villages:string[];
};

/** <dataDir>/<village>.json - one village's normal and every season. */
export type VillageData={normal:VillageNormal;years:Record<string,VillageSeason>};
