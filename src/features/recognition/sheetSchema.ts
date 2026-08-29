import { z } from 'zod';
import { canonicalizeWineFields } from '../../lib/wine/canonicalize';
import { normalizeRecognitionVintage } from './vintage';

/**
 * The printed wine list handed out at a tasting, read as text.
 *
 * Deliberately not an extension of groupRecognitionWineSchema. That one is
 * strict and requires a bounding box and a confidence for a bottle in a photo;
 * a line of type has no bottle to crop. It is also re-parsed by the browser and
 * by the R2 group-scan session store, so every field added there has to have a
 * home in three places - and a price field would be one a group photo can never
 * fill.
 *
 * What this adds that no bottle photograph can ever give you is the price.
 */
const nullableText=z.string().trim().max(300).nullable().optional();
const wineStyles=['red','white','rose','sparkling','dessert','fortified','orange','other'] as const;
const grapeBlendEntry=z.object({grape:z.string().trim().min(1).max(100),percentage:z.number().min(0).max(100).nullable().optional()});
const recognitionVintageSchema=z.preprocess(normalizeRecognitionVintage,z.number().int().min(1000).max(2200).nullable().optional());

/**
 * Every number printed against one wine, rather than one chosen for you.
 *
 * Lists carry bottle-vs-glass, member-vs-list and "from $X". Asking the model
 * to pick means it picks silently and wrongly; asking for all of them means the
 * review screen can show the choice where there is one, which is rare enough
 * not to be a burden and important enough not to guess.
 */
export const sheetPriceOptionSchema=z.object({
  amount:z.number().nonnegative().max(1_000_000),
  label:nullableText
});

export const sheetWineSchema=z.object({
  producer:z.string().trim().min(1).max(300),
  wineName:z.string().trim().min(1).max(300),
  vintage:recognitionVintageSchema,
  country:nullableText,
  region:nullableText,
  appellation:nullableText,
  // Filled by canonicalizeWineFields during merge, not by the model - same
  // reason as the group schema: the object is parsed again downstream, so every
  // field canonicalisation adds needs a home here.
  recognizedRegion:nullableText,
  recognizedAppellation:nullableText,
  classification:z.enum(['grand_cru','premier_cru','village']).nullable().optional(),
  grapes:z.array(z.string().trim().max(100)).max(20).default([]),
  grapeBlend:z.array(grapeBlendEntry).max(20).default([]),
  style:z.enum(wineStyles).nullable().optional(),
  alcoholPercentage:z.number().min(0).max(100).nullable().optional(),
  priceOptions:z.array(sheetPriceOptionSchema).max(4).default([]),
  /** The flight or heading this wine is printed under. Not a wine itself. */
  section:nullableText,
  /** Where it sits on the page, so a cut-short page can be continued from here. */
  lineNumber:z.number().int().min(0).max(2000).nullable().optional(),
  confidence:z.number().min(0).max(1)
}).strict();

export const sheetPageSchema=z.object({
  wines:z.array(sheetWineSchema).max(80),
  /**
   * One currency for the sheet, not one per row. A list is printed in a single
   * currency, and asking per row invites HK$ / $ / ¥ drift down the page.
   */
  currency:z.string().trim().regex(/^[A-Z]{3}$/).nullable().optional(),
  unresolvedCount:z.number().int().min(0).max(200).default(0),
  /** The model's own report that it ran out of room. Corroborated by finishReason. */
  truncated:z.boolean().default(false),
  lastLineNumber:z.number().int().min(0).max(2000).nullable().optional()
}).strict();

export type SheetPriceOption=z.infer<typeof sheetPriceOptionSchema>;
export type SheetWine=z.infer<typeof sheetWineSchema>;
export type SheetPage=z.infer<typeof sheetPageSchema>;

/**
 * The same identity the group scan dedupes on, minus the bounding box: a
 * continuation overlaps the page it continues by a row or two, and a wine can
 * be reprinted at a page break.
 */
export const sheetIdentityKey=(wine:Pick<SheetWine,'producer'|'wineName'|'vintage'>)=>[
  wine.producer.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim(),
  wine.wineName.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim(),
  wine.vintage??'nv'
].join('::');

/**
 * Merges pages into one list, keeping printed order.
 *
 * Where the same wine appears twice the richer row wins: a row carrying a price
 * beats one without, then higher confidence. A page break that splits a wine
 * across two photographs would otherwise drop whichever half was read second.
 */
export function mergeSheetWines(pages:SheetWine[][]){
  const byIdentity=new Map<string,SheetWine>();
  for(const page of pages)for(const raw of page){
    const wine=canonicalizeWineFields(raw) as SheetWine,key=sheetIdentityKey(wine),existing=byIdentity.get(key);
    if(!existing){byIdentity.set(key,wine);continue}
    const better=wine.priceOptions.length>existing.priceOptions.length
      ||(wine.priceOptions.length===existing.priceOptions.length&&wine.confidence>existing.confidence);
    if(better)byIdentity.set(key,wine);
  }
  return [...byIdentity.values()];
}

function normalizeSheetEnvelope(value:unknown){
  if(Array.isArray(value))return {wines:value,unresolvedCount:0,truncated:false};
  return value;
}

export function parseSheetPage(raw:string):SheetPage{
  const cleaned=raw.replace(/^```(?:json)?\s*|\s*```$/g,'');
  const parsed=sheetPageSchema.parse(normalizeSheetEnvelope(JSON.parse(cleaned)));
  return {...parsed,wines:mergeSheetWines([parsed.wines])};
}

/**
 * A page is short when it says so, or when the model stopped because it ran out
 * of output room. Both matter: a sheet read 180 of 200 wines looks exactly like
 * a sheet of 180, so this is the difference between a continuation and silently
 * losing the tail.
 */
export const sheetPageWasCutShort=(page:SheetPage,finishReason:string|null)=>
  page.truncated||finishReason==='MAX_TOKENS';

/** Where a continuation should resume from. */
export const sheetResumeLine=(page:SheetPage)=>{
  const lines=page.wines.map(wine=>wine.lineNumber).filter((line):line is number=>typeof line==='number');
  return Math.max(page.lastLineNumber??0,...(lines.length?lines:[0]))||null;
};
