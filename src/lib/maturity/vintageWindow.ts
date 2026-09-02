import { z } from 'zod';
import { resolvePlace } from '../places/resolve';
import { maturityFor,type MaturityWindow } from './ageing';

export type ResearchSource={title:string;url:string};
export type VintageWindow={
  country:string|null;region:string|null;appellation:string|null;
  vintage:number;wineStyle:string|null;
  /** Years the vintage moves the usual window at each end; +2 opens two later. */
  shiftFrom:number|null;shiftTo:number|null;
  note:string;sources:ResearchSource[];model:string|null;researchedAt:string;
};

/** What a wine needs to name before a vintage can be looked up for it. */
export type VintageSubject={country?:string|null;region?:string|null;appellation?:string|null;
  vintage?:number|null;wineStyle?:string|null};

const normalized=(value:unknown)=>String(value??'').normalize('NFD').replace(/[̀-ͯ]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

/**
 * The cell a vintage answer belongs to.
 *
 * The region and the year, not the appellation and the year. A growing season
 * is a regional fact - Oakville and Rutherford had the same 2019, and so did
 * Barolo and Barbaresco - and it is how vintage reports are actually written.
 * Keying any narrower would buy a search per sub-appellation for one year's
 * weather, which is the cost this whole design exists to avoid.
 *
 * The place goes through the tree first, so a spelling, an alias and a sub-AVA
 * all arrive at the same region. What the appellation still decides is the
 * calculated window beside this one, where the difference between a grand cru
 * and a village wine is the whole point.
 *
 * Style is part of the key because a year is not equally kind to everything a
 * region makes: 2021 in Burgundy was a frost year for the reds and a fine one
 * for the whites.
 */
export function vintageCacheKey(subject:VintageSubject){
  const place=resolvePlace({country:subject.country??null,region:subject.region??null,appellation:subject.appellation??null});
  const where=`${normalized(place.country)}|${normalized(place.region)}`;
  const anchor=where==='|'?normalized([subject.appellation,subject.region,subject.country].filter(Boolean).join(' ')):where;
  return JSON.stringify([anchor,subject.vintage??'NV',normalized(subject.wineStyle)]);
}

/** A subject worth asking about: a year, and somewhere for the year to be about. */
export function askableVintage(subject:VintageSubject){
  return Boolean(subject.vintage&&Number.isFinite(subject.vintage)
    &&(subject.appellation?.trim()||subject.region?.trim()||subject.country?.trim()));
}

/**
 * What a source is allowed to say.
 *
 * Years rather than a span in years-from-vintage, because that is how a wine
 * writer writes it and converting invites an off-by-a-year. Bounded so a
 * misread cannot produce a window that outlives the reader.
 */
export const vintageWindowSchema=z.object({
  drinkFrom:z.number().int().min(1900).max(2200).nullable(),
  drinkTo:z.number().int().min(1900).max(2200).nullable(),
  note:z.string().trim().max(1200).default(''),
  sources:z.array(z.object({title:z.string().trim().max(300),url:z.string().url()})).max(12).default([])
}).superRefine((value,ctx)=>{
  if(value.drinkFrom!=null&&value.drinkTo!=null&&value.drinkTo<value.drinkFrom)
    ctx.addIssue({code:'custom',path:['drinkTo'],message:'A window cannot end before it opens'});
});

type Row=Record<string,unknown>;
const parseJson=<T>(value:unknown,fallback:T):T=>{try{return JSON.parse(String(value)) as T}catch{return fallback}};
const text=(value:unknown)=>{const trimmed=String(value??'').trim();return trimmed||null};

export const mapVintageWindow=(row:Row):VintageWindow=>({
  country:text(row.country),region:text(row.region),appellation:text(row.appellation),
  vintage:Number(row.vintage),wineStyle:text(row.wine_style),
  shiftFrom:row.shift_from==null?null:Number(row.shift_from),
  shiftTo:row.shift_to==null?null:Number(row.shift_to),
  note:String(row.vintage_note??''),sources:parseJson<ResearchSource[]>(row.sources_json,[]),
  model:text(row.model),researchedAt:String(row.researched_at)
});

const columns='country,region,appellation,vintage,wine_style,shift_from,shift_to,vintage_note,sources_json,model,researched_at';

export async function readVintageWindow(db:D1Database,owner:string,subject:VintageSubject){
  if(!askableVintage(subject))return null;
  const row=await db.prepare(`SELECT ${columns} FROM vintage_windows WHERE owner_id=? AND cache_key=?`)
    .bind(owner,vintageCacheKey(subject)).first<Row>();
  return row?mapVintageWindow(row):null;
}

/**
 * Store what the year did, not what one wine's window was.
 *
 * The source answers in calendar years for the wine that asked, because that is
 * how a vintage report is written. What is kept is the difference from that
 * wine's usual window - which is the part that holds for every other wine in
 * the region, and the reason one search can answer for all of them.
 */
export async function writeVintageWindow(db:D1Database,owner:string,subject:VintageSubject,
  answer:z.infer<typeof vintageWindowSchema>,baseline:{from:number;to:number}|null,model:string){
  const place=resolvePlace({country:subject.country??null,region:subject.region??null,appellation:subject.appellation??null});
  const stamp=new Date().toISOString();
  const shiftFrom=answer.drinkFrom!=null&&baseline?answer.drinkFrom-baseline.from:null;
  const shiftTo=answer.drinkTo!=null&&baseline?answer.drinkTo-baseline.to:null;
  await db.prepare(`INSERT INTO vintage_windows(id,owner_id,cache_key,country,region,appellation,vintage,wine_style,shift_from,shift_to,vintage_note,sources_json,model,researched_at,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(owner_id,cache_key) DO UPDATE SET shift_from=excluded.shift_from,shift_to=excluded.shift_to,
      vintage_note=excluded.vintage_note,sources_json=excluded.sources_json,model=excluded.model,
      researched_at=excluded.researched_at,updated_at=excluded.updated_at`)
    .bind(crypto.randomUUID(),owner,vintageCacheKey(subject),place.country,place.region,place.appellation,
      subject.vintage,subject.wineStyle??null,shiftFrom,shiftTo,answer.note,
      JSON.stringify(answer.sources),model,stamp,stamp,stamp).run();
  return readVintageWindow(db,owner,subject);
}

export type MaturityPair={
  calculated:{from:number;to:number;label:string}|null;
  researched:{from:number;to:number;note:string;sources:ResearchSource[];researchedAt:string}|null;
};

/**
 * Both answers, side by side, and neither standing in for the other.
 *
 * The calculated window is what the place and the style say and never changes;
 * the researched one is what a source said about this year. Where they differ
 * the difference is the point - a vintage that shortened or lengthened the
 * usual window is exactly the thing worth knowing - so nothing here collapses
 * them into one figure.
 */
export function maturityPair(wine:VintageSubject&{classification?:string|null},
  researched:VintageWindow|null):MaturityPair{
  const vintage=wine.vintage;
  const table=maturityFor(wine);
  const calculated=table&&vintage!=null
    ?{from:vintage+table.window.from,to:vintage+table.window.to,label:table.basis.label}
    :null;
  // The year's shift, applied to this wine's own window. A Piedmont 2019 that
  // ran two years late runs two years late for the Barolo and for the Dolcetto
  // alike, even though their windows are nothing like each other.
  const shifted=calculated&&researched&&researched.shiftFrom!=null&&researched.shiftTo!=null
    ?{from:calculated.from+researched.shiftFrom,to:calculated.to+researched.shiftTo,
      note:researched.note,sources:researched.sources,researchedAt:researched.researchedAt}
    :null;
  return {calculated,researched:shifted};
}

/** Years the two answers disagree by, for the line that says so. */
export function windowShift(pair:MaturityPair){
  if(!pair.calculated||!pair.researched)return null;
  return {from:pair.researched.from-pair.calculated.from,to:pair.researched.to-pair.calculated.to};
}

export type {MaturityWindow};
