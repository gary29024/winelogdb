import { z } from 'zod';
import { canonicalizeWineFields } from '../wine/canonicalize';
import { wineRecordSchema } from '../db/schema';

/** The largest format anyone cellars, in millilitres, plus room to be wrong. */
const MAX_BOTTLE_ML=30000;
/** Enough for a cellar; a number past it is a typo, not a collection. */
export const MAX_BOTTLES=9999;

const blankToNull=(value:unknown)=>typeof value==='string'&&!value.trim()?null:value;
const optionalText=z.preprocess(blankToNull,z.string().trim().max(500).optional().nullable());
const optionalDate=z.preprocess(blankToNull,z.string().date().optional().nullable());

/**
 * A cellar line describes the same wine a journal row does, so it validates its
 * place, vintage, style and currency with exactly the same rules rather than a
 * second, drifting set. What it does not carry is everything about drinking:
 * no rating, no tasting date, no notes about how it showed. Those arrive with
 * the wines row, when the bottle is opened.
 */
const cellarBaseSchema=wineRecordSchema.pick({
  producer:true,wineName:true,vintage:true,country:true,region:true,appellation:true,
  wineStyle:true,classification:true,currency:true
}).extend({
  bottles:z.number().int().min(1).max(MAX_BOTTLES),
  bottleSizeMl:z.number().int().min(1).max(MAX_BOTTLE_ML).default(750),
  purchasePrice:z.preprocess(blankToNull,z.number().nonnegative().max(1_000_000).optional().nullable()),
  purchasedAt:optionalDate,
  merchant:optionalText,
  location:optionalText,
  notes:z.string().trim().max(2000).default('')
});

// The same normalisation the journal gets: type an appellation and the place
// tree supplies the region and the country, so the cellar and the journal agree
// on where a wine is from without the cellar asking for it twice.
export const cellarInputSchema=cellarBaseSchema.transform(value=>{
  const place=canonicalizeWineFields(value);
  return {...value,country:place.country,region:place.region,appellation:place.appellation,
    wineName:place.wineName,classification:place.classification};
});
export type CellarInput=z.infer<typeof cellarInputSchema>;

/** Only the count moves for most edits, so everything here is optional. */
export const cellarPatchSchema=cellarBaseSchema.partial().extend({bottles:z.number().int().min(0).max(MAX_BOTTLES).optional()});
export type CellarPatch=z.infer<typeof cellarPatchSchema>;
