import { normalizeProducerAlias } from '../producers/entities';
import { normalizeCuveeAlias,stripKnownProducerPrefix } from '../cuvees/entities';
import type { SheetWine } from '../../features/recognition/sheetSchema';

/**
 * Is this printed line one of the wines already in this evening?
 *
 * Note the question. The obvious implementation - resolveExistingProducer then
 * resolveExistingCuvee for every parsed row - answers a different one ("does
 * this exist anywhere in the library") and does not survive a real trade list:
 * resolveExistingCuvee runs an alias probe, a signature probe, a signature
 * adoption write and two counting queries, so a two-hundred-wine sheet would be
 * over a thousand D1 statements for one parse.
 *
 * The lineup, by contrast, is bounded - it is what was actually poured and
 * logged - so it is loaded once and matched against in memory. Zero queries per
 * row, and the keys are the normalisations the rest of the app already agrees
 * on rather than a second private notion of sameness.
 *
 * The library resolvers still run, where they belong: on creation, inside
 * ensureWineIdentity.
 */
export type LineupWine={
  wineId:string;producer:string;wineName:string;vintage:number|null;
  producerId:string|null;cuveeId:string|null;price:number|null;currency:string|null;
};

export type SheetMatch=
  |{status:'matched';wine:SheetWine;wineId:string;hasPrice:boolean;currentPrice:number|null;currentCurrency:string|null}
  |{status:'new';wine:SheetWine};

/**
 * Vintage is part of the key on purpose: 2019 and 2020 of one cuvée are two
 * wines, and a good list prints both. Collapsing them would fill one vintage's
 * price onto the other.
 */
const key=(producer:string,wineName:string,vintage:number|null|undefined)=>
  `${normalizeProducerAlias(producer)}::${normalizeCuveeAlias(wineName)}::${vintage??'nv'}`;

/**
 * A list often prints "Domaine Dujac Morey-Saint-Denis" where the journal holds
 * the cuvée as "Morey-Saint-Denis" under that producer, so the producer prefix
 * is stripped before the name is keyed - the same thing resolveExistingCuvee
 * does before it looks anything up.
 */
const wineKeys=(producer:string,wineName:string,vintage:number|null|undefined)=>{
  const bare=stripKnownProducerPrefix(wineName,[producer]);
  const keys=[key(producer,wineName,vintage)];
  if(bare!==wineName)keys.push(key(producer,bare,vintage));
  return keys;
};

export function buildLineupIndex(lineup:LineupWine[]){
  const index=new Map<string,LineupWine>();
  for(const wine of lineup)
    for(const candidate of wineKeys(wine.producer,wine.wineName,wine.vintage))
      if(!index.has(candidate))index.set(candidate,wine);
  return index;
}

/**
 * One wine looked up in the evening, by the same keys the sheet matching uses.
 *
 * Used when a bottle is photographed at a tasting that already holds it - read
 * off the printed list an hour earlier, say - so the scan can offer to add its
 * photo to that wine rather than create a second copy of it.
 */
export function findLineupWine(lineup:LineupWine[],producer:string,wineName:string,vintage:number|null|undefined){
  const index=buildLineupIndex(lineup);
  return wineKeys(producer,wineName,vintage).map(candidate=>index.get(candidate))
    .find((match):match is LineupWine=>match!==undefined)??null;
}

export function matchSheetWines(wines:SheetWine[],lineup:LineupWine[]):SheetMatch[]{
  const index=buildLineupIndex(lineup);
  // One wine in the evening can only claim one printed line. Without this a
  // list that prints the same cuvée twice (two bottles, two flights) would
  // report both as already logged and fill the same wine's price twice.
  const claimed=new Set<string>();
  return wines.map(wine=>{
    const found=wineKeys(wine.producer,wine.wineName,wine.vintage)
      .map(candidate=>index.get(candidate))
      .find((match):match is LineupWine=>match!==undefined&&!claimed.has(match.wineId));
    if(!found)return {status:'new',wine};
    claimed.add(found.wineId);
    return {
      status:'matched',wine,wineId:found.wineId,
      hasPrice:found.price!=null,currentPrice:found.price,currentCurrency:found.currency
    };
  });
}

/** The tasting's wines with the columns matching needs, which the lineup read does not carry. */
export async function readLineupForMatching(db:D1Database,owner:string,tastingId:string):Promise<LineupWine[]>{
  const {results}=await db.prepare(`SELECT w.id AS wine_id,w.producer,w.wine_name,w.vintage,w.producer_id,w.cuvee_id,w.price,w.currency
    FROM wine_experiences we JOIN wines w ON w.owner_id=we.owner_id AND w.id=we.wine_id
    WHERE we.owner_id=? AND we.tasting_id=?`).bind(owner,tastingId).all<Record<string,unknown>>();
  return (results??[]).map(row=>({
    wineId:String(row.wine_id),producer:String(row.producer),wineName:String(row.wine_name),
    vintage:row.vintage==null?null:Number(row.vintage),
    producerId:row.producer_id?String(row.producer_id):null,
    cuveeId:row.cuvee_id?String(row.cuvee_id):null,
    price:row.price==null?null:Number(row.price),
    currency:row.currency?String(row.currency):null
  }));
}
