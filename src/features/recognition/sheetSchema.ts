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
});
// Deliberately not .strict(). A hundred-wine sheet is one call and a whole
// evening's paper; throwing all of it away because the model volunteered one
// key nobody asked for is the wrong trade. Reported as a wine list that failed
// to read at all because a `currency` had been printed on every row rather than
// on the envelope - useful information, and it took the page down with it.
// Unknown keys are dropped instead, and a row currency is lifted to the
// envelope below rather than lost. What .strict() used to guard - that every
// field canonicalizeWineFields adds has a home here - is asserted directly in
// the tests, where a stripped field fails on its value rather than on a throw.

/**
 * One currency for the sheet, not one per row. A list is printed in a single
 * currency, and asking per row invites HK$ / $ / ¥ drift down the page.
 *
 * A code that cannot be read becomes null rather than an error: the review
 * screen asks for the currency and will not write a price without it, so an
 * unreadable one costs a moment's typing, while throwing would cost the eighty
 * wines printed underneath it. Case is forgiven; a symbol is not a code.
 */
const sheetCurrencyField=z.preprocess(
  value=>typeof value==='string'&&/^[A-Za-z]{3}$/.test(value.trim())?value.trim().toUpperCase():value,
  z.string().regex(/^[A-Z]{3}$/).nullable().catch(null).default(null)
);

export const sheetPageSchema=z.object({
  wines:z.array(sheetWineSchema).max(80),
  currency:sheetCurrencyField,
  unresolvedCount:z.number().int().min(0).max(200).catch(0).default(0),
  /** The model's own report that it ran out of room. Corroborated by finishReason. */
  truncated:z.boolean().catch(false).default(false),
  lastLineNumber:z.number().int().min(0).max(2000).nullable().catch(null).default(null)
});

/**
 * The envelope, with its wines still unread.
 *
 * Rows are validated one at a time below rather than as an array, so one line
 * the model garbled costs that line instead of the page it was printed on.
 */
const sheetEnvelopeSchema=sheetPageSchema.extend({wines:z.array(z.unknown()).default([])});

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
  if(Array.isArray(value))return {wines:value};
  return value&&typeof value==='object'?value as Record<string,unknown>:{};
}

/**
 * A currency the model printed on every row instead of on the envelope.
 *
 * It was asked for once, at the top, and sometimes answers per wine anyway.
 * That is still the sheet's currency, so it is lifted rather than dropped - the
 * commonest code wins, which is the right reading of a list printed in one
 * currency with a stray misread somewhere down the page.
 */
function liftRowCurrency(envelope:Record<string,unknown>){
  if(typeof envelope.currency==='string'&&envelope.currency.trim())return envelope;
  const counts=new Map<string,number>();
  for(const row of Array.isArray(envelope.wines)?envelope.wines:[]){
    const value=(row as Record<string,unknown>|null)?.currency;
    if(typeof value!=='string')continue;
    const code=value.trim().toUpperCase();
    if(/^[A-Z]{3}$/.test(code))counts.set(code,(counts.get(code)??0)+1);
  }
  const best=[...counts.entries()].sort((a,b)=>b[1]-a[1])[0];
  return best?{...envelope,currency:best[0]}:envelope;
}

export function parseSheetPage(raw:string):SheetPage{
  const cleaned=raw.replace(/^```(?:json)?\s*|\s*```$/g,'');
  const envelope=sheetEnvelopeSchema.parse(liftRowCurrency(normalizeSheetEnvelope(JSON.parse(cleaned))));
  // A line that will not parse is counted, not thrown: unresolvedCount already
  // means "printed lines this read could not turn into a wine", and the review
  // screen already tells you to add those by hand rather than guessing.
  const wines:SheetWine[]=[];let unreadable=0;
  for(const row of envelope.wines){
    const parsed=sheetWineSchema.safeParse(row);
    if(parsed.success)wines.push(parsed.data);else unreadable++;
  }
  return {...envelope,wines:mergeSheetWines([wines]),unresolvedCount:Math.min(200,envelope.unresolvedCount+unreadable)};
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
