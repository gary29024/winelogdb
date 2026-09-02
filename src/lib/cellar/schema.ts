import { z } from 'zod';
import { canonicalizeWineFields } from '../wine/canonicalize';
import { wineRecordSchema,wineStyles } from '../db/schema';

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

/**
 * A correction: only what was actually sent.
 *
 * Written out rather than taken from the insert shape with .partial(), because
 * a defaulted field survives that - classification defaults to null, so a form
 * that had no reason to send it was silently telling the row to forget its own
 * cru tier. A Charmes-Chambertin came back as ordinary Burgundy red the moment
 * anyone opened it to look, and its drinking window fell from eight-to-
 * twenty-five years to four-to-twelve.
 *
 * Nothing here has a default. Absent means absent.
 */
export const cellarPatchSchema=z.object({
  producer:z.string().trim().min(1).max(200),
  wineName:z.string().trim().min(1).max(200),
  vintage:z.number().int().min(1000).max(2200).nullable(),
  country:optionalText,region:optionalText,appellation:optionalText,
  wineStyle:z.enum(wineStyles).nullable(),
  classification:z.enum(['grand_cru','premier_cru','village']).nullable(),
  currency:z.string().trim().length(3).nullable(),
  bottles:z.number().int().min(0).max(MAX_BOTTLES),
  bottleSizeMl:z.number().int().min(1).max(MAX_BOTTLE_ML),
  purchasePrice:z.preprocess(blankToNull,z.number().nonnegative().max(1_000_000).nullable()),
  purchasedAt:optionalDate,
  merchant:optionalText,location:optionalText,
  notes:z.string().trim().max(2000)
}).partial();
export type CellarPatch=z.infer<typeof cellarPatchSchema>;
