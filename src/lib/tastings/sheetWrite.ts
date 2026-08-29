import { z } from 'zod';
import { canonicalizeWineFields } from '../wine/canonicalize';
import { ensureWineIdentity } from '../wine/identity';
import { attachWinesToTasting } from './attach';

/**
 * Writing what a wine list said, once the reader has agreed to it.
 *
 * Both actions are batched rather than done a row at a time. Writing `wines`
 * fires the 0030 revision triggers, so a hundred single-row updates would be a
 * hundred cache invalidations for one sheet; batched, it is a handful and one
 * Passport recompute on the next read.
 */
const CHUNK=50;
const MAX_ROWS=500;
const currencySchema=z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/,'Use a 3-letter currency code such as USD, EUR or HKD');
const chunked=<T>(items:T[])=>{const out:T[][]=[];for(let i=0;i<items.length;i+=CHUNK)out.push(items.slice(i,i+CHUNK));return out};

export const sheetPricesSchema=z.object({
  currency:currencySchema,
  prices:z.array(z.object({
    wineId:z.string().uuid(),
    // A misread cannot write a negative, and the ceiling is the same one the
    // parse applies - a price of 10 million is an OCR failure, not a bottle.
    price:z.number().nonnegative().max(1_000_000)
  })).min(1).max(MAX_ROWS)
});
export type SheetPricesInput=z.infer<typeof sheetPricesSchema>;

/**
 * Fills prices on wines already in the tasting.
 *
 * Guarded on `price IS NULL` in SQL as well as unticked in the UI: a number you
 * entered yourself must not be replaced by one read off paper, and the guard
 * belongs where a second device racing the same sheet still hits it.
 */
export async function applySheetPrices(db:D1Database,owner:string,tastingId:string,input:SheetPricesInput){
  const wanted=new Map(input.prices.map(entry=>[entry.wineId,entry.price]));
  const {results}=await db.prepare(`SELECT w.id FROM wine_experiences we JOIN wines w ON w.owner_id=we.owner_id AND w.id=we.wine_id
    WHERE we.owner_id=? AND we.tasting_id=?`).bind(owner,tastingId).all<{id:string}>();
  const inTasting=(results??[]).map(row=>String(row.id)).filter(id=>wanted.has(id));
  if(!inTasting.length)throw new Error('None of those wines are in this tasting');

  const stamp=new Date().toISOString();
  for(const chunk of chunked(inTasting))
    await db.batch(chunk.map(wineId=>db.prepare(
      'UPDATE wines SET price=?,currency=?,updated_at=? WHERE owner_id=? AND id=? AND price IS NULL')
      .bind(wanted.get(wineId)!,input.currency,stamp,owner,wineId)));
  return {filled:inTasting.length,skipped:input.prices.length-inTasting.length};
}

const sheetWineInput=z.object({
  producer:z.string().trim().min(1).max(300),
  wineName:z.string().trim().min(1).max(300),
  vintage:z.number().int().min(1000).max(2200).nullable().optional(),
  country:z.string().trim().max(300).nullable().optional(),
  region:z.string().trim().max(300).nullable().optional(),
  appellation:z.string().trim().max(300).nullable().optional(),
  wineStyle:z.enum(['red','white','rose','sparkling','dessert','fortified','orange','other']).nullable().optional(),
  grapes:z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  price:z.number().nonnegative().max(1_000_000).nullable().optional()
});

export const sheetWinesSchema=z.object({
  currency:currencySchema.nullable().optional(),
  tastingName:z.string().trim().max(300).nullable().optional(),
  tastingDate:z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  venue:z.string().trim().max(300).nullable().optional(),
  wines:z.array(sheetWineInput).min(1).max(MAX_ROWS)
});
export type SheetWinesInput=z.infer<typeof sheetWinesSchema>;

/**
 * Creates the wines a sheet lists that the evening does not have, and attaches
 * them.
 *
 * A real endpoint rather than one POST /api/wines per row: a hundred-wine list
 * would be a hundred round trips from a phone on venue wifi. The rows still go
 * through the same canonicalisation and the same ensureWineIdentity, so a wine
 * created from paper is indistinguishable afterwards from one typed in.
 */
export async function createSheetWines(db:D1Database,owner:string,tastingId:string,input:SheetWinesInput){
  const tasting=await db.prepare('SELECT id FROM tastings WHERE owner_id=? AND id=?').bind(owner,tastingId).first<{id:string}>();
  if(!tasting)throw new Error('That tasting no longer exists');

  const stamp=new Date().toISOString();
  const rows=input.wines.map(raw=>{
    const wine=canonicalizeWineFields({...raw,grapeBlend:[],recognizedRegion:null,recognizedAppellation:null,classification:null});
    return {id:crypto.randomUUID(),wine};
  });

  for(const chunk of chunked(rows))
    await db.batch(chunk.map(({id,wine})=>db.prepare(
      `INSERT INTO wines(id,owner_id,producer,wine_name,vintage,country,region,appellation,recognized_region,recognized_appellation,classification,grapes_json,grape_blend_json,wine_style,tasting_notes,tasting_date,event,venue,price,currency,tags_json,recognition_status,created_at,updated_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,'',?,NULL,?,?,?,'[]','review',?,?)`)
      .bind(id,owner,wine.producer,wine.wineName,wine.vintage??null,wine.country??null,wine.region??null,wine.appellation??null,
        wine.recognizedRegion??null,wine.recognizedAppellation??null,wine.classification??null,
        JSON.stringify(wine.grapes??[]),'[]',wine.wineStyle??null,
        input.tastingDate??null,input.venue??null,
        wine.price??null,wine.price==null?null:input.currency??null,stamp,stamp)));

  // Serial and after the inserts: producer and cuvée linking reads rows back
  // and writes alias tables, so it cannot be folded into the insert batch.
  // A failure here leaves a real wine that simply has not been linked yet -
  // the identity maintenance sweep picks those up.
  for(const {id} of rows)await ensureWineIdentity(db,owner,id).catch(()=>undefined);

  // Attached in the same request, so a half-run never leaves a sheet's worth of
  // wines floating outside the evening they were poured at.
  await attachWinesToTasting(db,owner,tastingId,rows.map(row=>row.id));
  return {created:rows.length,wineIds:rows.map(row=>row.id)};
}
