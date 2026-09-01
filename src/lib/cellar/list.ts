import { mapHolding,type CellarHolding } from './holdings';

export type CellarListQuery=Record<string,string|undefined>;

/**
 * The cellar page, on the same contract as the journal page: one D1 batch for
 * the count and the rows, the same limit and offset rules, so the Journal can
 * switch scope without switching how it paginates.
 *
 * What it does not share is the sort and the filters. A holding has no drinking
 * date, no rating and no tasting, so ordering by "newest drinking date" or
 * filtering by month would be sorting on a column that is not there. The
 * defaults are the ones a cellar actually reads by: the vintage, then who made
 * it.
 */
const orders:Record<string,string>={
  vintage:'c.vintage DESC, c.producer COLLATE NOCASE ASC, c.wine_name COLLATE NOCASE ASC, c.id ASC',
  oldestVintage:'c.vintage ASC, c.producer COLLATE NOCASE ASC, c.wine_name COLLATE NOCASE ASC, c.id ASC',
  producer:'c.producer COLLATE NOCASE ASC, c.wine_name COLLATE NOCASE ASC, c.vintage DESC, c.id ASC',
  bottles:'c.bottles DESC, c.producer COLLATE NOCASE ASC, c.vintage DESC, c.id ASC',
  added:'c.created_at DESC, c.id DESC',
  purchased:'c.purchased_at DESC, c.created_at DESC, c.id DESC'
};
export const cellarSorts=Object.keys(orders);

export async function listCellarPage(db:D1Database,owner:string,q:CellarListQuery){
  const args:unknown[]=[owner];let where='c.owner_id=?';
  const filters:[string,string][]=[['vintage','c.vintage'],['country','c.country'],['region','c.region'],['style','c.wine_style'],['location','c.location']];
  const rawQuery=(q.query??'').trim();
  const vintageSearch=!q.vintage&&/^\d{4}$/.test(rawQuery)?rawQuery:null;
  for(const [key,column] of filters){
    const value=key==='vintage'?(q.vintage??vintageSearch):q[key];
    if(value){where+=` AND ${column}=?`;args.push(value)}
  }
  // No FTS table stands behind the cellar, and building one for a list this
  // small would cost a trigger on every write to save a scan of a few hundred
  // rows. LIKE over the two name columns is the honest trade.
  if(rawQuery&&!vintageSearch){
    where+=' AND (lower(c.producer) LIKE lower(?) OR lower(c.wine_name) LIKE lower(?) OR lower(coalesce(c.appellation,\'\')) LIKE lower(?))';
    const pattern=`%${rawQuery}%`;args.push(pattern,pattern,pattern);
  }
  const limit=Math.min(Math.max(Number(q.limit)||36,1),72),offset=Math.max(Number(q.offset)||0,0);
  const columns='c.id,c.producer_id,c.cuvee_id,c.producer,c.wine_name,c.vintage,c.country,c.region,c.appellation,c.wine_style,c.classification,c.bottles,c.bottle_size_ml,c.purchase_price,c.currency,c.purchased_at,c.merchant,c.location,c.notes,c.created_at,c.updated_at';
  const [countResult,rowsResult]=await db.batch([
    // Bottles as well as lines: twelve wines and thirty-one bottles are
    // different facts about a cellar, and only one of them is the row count.
    db.prepare(`SELECT count(*) AS total,coalesce(sum(c.bottles),0) AS bottles FROM cellar_holdings c WHERE ${where}`).bind(...args),
    db.prepare(`SELECT ${columns} FROM cellar_holdings c WHERE ${where} ORDER BY ${orders[q.sort??'']||orders.vintage} LIMIT ? OFFSET ?`).bind(...args,limit,offset)
  ]);
  const summary=countResult.results[0] as {total?:unknown;bottles?:unknown}|undefined;
  const total=Number(summary?.total??0);
  const items:CellarHolding[]=(rowsResult.results as Record<string,unknown>[]).map(mapHolding);
  return {items,total,bottles:Number(summary?.bottles??0),nextOffset:offset+limit<total?offset+limit:null};
}
