import { normalizeProducerAlias,resolveExistingProducer } from '../producers/entities';
import { normalizeCuveeAlias,resolveExistingCuvee,stripKnownProducerPrefix } from '../cuvees/entities';
import { canonicalizeWineFields } from '../wine/canonicalize';
import { resolvePlace } from '../places/resolve';
import type { CellarInput,CellarPatch } from './schema';

export type CellarHolding={
  id:string;producerId:string|null;cuveeId:string|null;
  producer:string;wineName:string;vintage:number|null;
  country:string|null;region:string|null;appellation:string|null;
  wineStyle:string|null;classification:string|null;
  bottles:number;bottleSizeMl:number;
  purchasePrice:number|null;currency:string|null;purchasedAt:string|null;
  merchant:string|null;location:string|null;notes:string;
  createdAt:string;updatedAt:string;
};

type Row=Record<string,unknown>;
const text=(value:unknown)=>{const trimmed=String(value??'').trim();return trimmed||null};
const num=(value:unknown)=>value==null?null:Number(value);
const now=()=>new Date().toISOString();
const derivedTier=(row:Row)=>resolvePlace({country:text(row.country),region:text(row.region),
  appellation:text(row.appellation)}).classification??null;

export const mapHolding=(row:Row):CellarHolding=>({
  id:String(row.id),
  producerId:row.producer_id?String(row.producer_id):null,
  cuveeId:row.cuvee_id?String(row.cuvee_id):null,
  producer:String(row.producer),wineName:String(row.wine_name),
  vintage:row.vintage==null?null:Number(row.vintage),
  country:text(row.country),region:text(row.region),appellation:text(row.appellation),
  wineStyle:text(row.wine_style),
  // Derived where it is missing, rather than trusted blindly. Rows written
  // before this was kept properly - and any row whose tier an edit had already
  // forgotten - come back right on the next read instead of waiting for someone
  // to notice a grand cru with a village window. A place that carries no tier
  // still derives none, so this invents nothing.
  classification:text(row.classification)??derivedTier(row),
  bottles:Number(row.bottles)||0,bottleSizeMl:Number(row.bottle_size_ml)||750,
  purchasePrice:num(row.purchase_price),currency:text(row.currency),
  purchasedAt:text(row.purchased_at),merchant:text(row.merchant),location:text(row.location),
  notes:String(row.notes??''),
  createdAt:String(row.created_at),updatedAt:String(row.updated_at)
});

/**
 * The identity a holding is filed under, so buying six more of a wine you
 * already hold adds to the line instead of opening a second one.
 *
 * Built from the same normalisers the rest of the app agrees on, and with the
 * producer stripped off the wine name the way a cuvee alias is - "Cusumano
 * Feudo di Mezzo" and "Feudo di Mezzo" are one wine, and a cellar that filed
 * them apart would be wrong in the same way two producer panels were.
 *
 * Bottle size is part of the key on purpose: a magnum is not three more of the
 * same bottle, and it does not mature like one either.
 */
export function cellarMatchKey(producer:string,wineName:string,vintage:number|null,bottleSizeMl:number){
  const producerKey=normalizeProducerAlias(producer);
  const wineKey=normalizeCuveeAlias(stripKnownProducerPrefix(wineName,[producer]));
  return JSON.stringify([producerKey,wineKey,vintage??'NV',bottleSizeMl]);
}

/**
 * Which producer and cuvee a holding belongs to - matching only.
 *
 * Deliberately never creates either. A holding is a bottle you have not drunk,
 * and creating an entity for one would put a producer you have never opened
 * into the producer library at nought tasted, and a cuvee into a range you have
 * never tasted from. Both are statistics, and a cellar is not allowed to move
 * one. ensureWineIdentity creates them the ordinary way when the bottle is
 * opened and a wines row exists to justify them.
 */
export async function resolveHoldingIdentity(db:D1Database,owner:string,input:{producer:string;wineName:string;appellation?:string|null;wineStyle?:string|null}){
  const producer=await resolveExistingProducer(db,owner,input.producer).catch(()=>null);
  if(!producer)return {producerId:null,cuveeId:null};
  const cuvee=await resolveExistingCuvee(db,owner,producer.id,input.wineName,input.appellation??null,input.wineStyle??null).catch(()=>null);
  return {producerId:producer.id,cuveeId:cuvee?.id??null};
}

const columns='id,producer_id,cuvee_id,producer,wine_name,vintage,country,region,appellation,wine_style,classification,bottles,bottle_size_ml,purchase_price,currency,purchased_at,merchant,location,notes,created_at,updated_at';

export async function readHolding(db:D1Database,owner:string,id:string){
  const row=await db.prepare(`SELECT ${columns} FROM cellar_holdings WHERE owner_id=? AND id=?`).bind(owner,id).first<Row>();
  return row?mapHolding(row):null;
}

/**
 * Add bottles to the cellar. A wine already held gains the bottles rather than
 * a second line; everything else about the line is left as it was, because the
 * earlier entry is the one that has been corrected by hand.
 */
export async function addHolding(db:D1Database,owner:string,input:CellarInput):Promise<CellarHolding>{
  const matchKey=cellarMatchKey(input.producer,input.wineName,input.vintage,input.bottleSizeMl);
  const existing=await db.prepare(`SELECT ${columns} FROM cellar_holdings WHERE owner_id=? AND match_key=?`).bind(owner,matchKey).first<Row>();
  const stamp=now();
  if(existing){
    await db.prepare('UPDATE cellar_holdings SET bottles=bottles+?,updated_at=? WHERE owner_id=? AND id=?')
      .bind(input.bottles,stamp,owner,String(existing.id)).run();
    return {...mapHolding(existing),bottles:Number(existing.bottles)+input.bottles,updatedAt:stamp};
  }
  const {producerId,cuveeId}=await resolveHoldingIdentity(db,owner,input);
  const id=crypto.randomUUID();
  await db.prepare(`INSERT INTO cellar_holdings(id,owner_id,producer_id,cuvee_id,producer,wine_name,vintage,country,region,appellation,wine_style,classification,bottles,bottle_size_ml,purchase_price,currency,purchased_at,merchant,location,notes,match_key,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id,owner,producerId,cuveeId,input.producer,input.wineName,input.vintage,input.country??null,input.region??null,input.appellation??null,
      input.wineStyle??null,input.classification??null,input.bottles,input.bottleSizeMl,input.purchasePrice??null,input.currency??null,
      input.purchasedAt??null,input.merchant??null,input.location??null,input.notes??'',matchKey,stamp,stamp).run();
  return {id,producerId,cuveeId,producer:input.producer,wineName:input.wineName,vintage:input.vintage,
    country:input.country??null,region:input.region??null,appellation:input.appellation??null,
    wineStyle:input.wineStyle??null,classification:input.classification??null,
    bottles:input.bottles,bottleSizeMl:input.bottleSizeMl,purchasePrice:input.purchasePrice??null,
    currency:input.currency??null,purchasedAt:input.purchasedAt??null,merchant:input.merchant??null,
    location:input.location??null,notes:input.notes??'',createdAt:stamp,updatedAt:stamp};
}


/**
 * Correct a line, and let the place tree answer again.
 *
 * The patch is merged onto what is stored and the whole thing re-canonicalised,
 * for the same reason a wine save does it: correcting the appellation from
 * Gevrey-Chambertin to Charmes-Chambertin has to move the cru tier with it, and
 * the tier is what decides whether the drinking window reads eight-to-
 * twenty-five years or four-to-twelve.
 *
 * Editing to nought bottles is the same statement as drinking the last one.
 */
export async function updateHolding(db:D1Database,owner:string,id:string,patch:CellarPatch){
  const current=await readHolding(db,owner,id);
  if(!current)return null;
  if(patch.bottles===0){await deleteHolding(db,owner,id);return {...current,bottles:0}}
  const merged={...current,...patch};
  const place=canonicalizeWineFields({producer:merged.producer,wineName:merged.wineName,
    country:merged.country,region:merged.region,appellation:merged.appellation,
    classification:merged.classification,classificationOverride:null});
  const next={...merged,country:place.country??null,region:place.region??null,
    appellation:place.appellation??null,classification:place.classification??null};
  const stamp=new Date().toISOString();
  await db.prepare(`UPDATE cellar_holdings SET producer=?,wine_name=?,vintage=?,country=?,region=?,appellation=?,
    wine_style=?,classification=?,bottles=?,bottle_size_ml=?,purchase_price=?,currency=?,purchased_at=?,
    merchant=?,location=?,notes=?,match_key=?,updated_at=? WHERE owner_id=? AND id=?`)
    .bind(next.producer,next.wineName,next.vintage,next.country,next.region,next.appellation,
      next.wineStyle,next.classification,next.bottles,next.bottleSizeMl,next.purchasePrice,next.currency,
      next.purchasedAt,next.merchant,next.location,next.notes,
      cellarMatchKey(next.producer,next.wineName,next.vintage,next.bottleSizeMl),stamp,owner,id).run();
  return readHolding(db,owner,id);
}

export async function deleteHolding(db:D1Database,owner:string,id:string){
  const result=await db.prepare('DELETE FROM cellar_holdings WHERE owner_id=? AND id=?').bind(owner,id).run();
  return Boolean(result.meta.changes);
}

/**
 * One bottle leaves the cellar, because it has just been drunk.
 *
 * Called after the wines row is written, never when the form is opened: the
 * bottle is gone once there is a record of drinking it, and decrementing on the
 * way in would lose a bottle every time someone backed out of the form.
 */
export async function takeBottleFromHolding(db:D1Database,owner:string,id:string){
  const stamp=now();
  const taken=await db.prepare('UPDATE cellar_holdings SET bottles=bottles-1,updated_at=? WHERE owner_id=? AND id=? AND bottles>0')
    .bind(stamp,owner,id).run();
  if(!taken.meta.changes)return false;
  await db.prepare('DELETE FROM cellar_holdings WHERE owner_id=? AND id=? AND bottles<=0').bind(owner,id).run();
  return true;
}

/** The bottles still held of a wine that is open on the detail page. */
export async function holdingsForWine(db:D1Database,owner:string,wine:{cuveeId?:string|null;producer:string;wineName:string;vintage:number|null}){
  if(wine.cuveeId){
    const {results}=await db.prepare(`SELECT ${columns} FROM cellar_holdings WHERE owner_id=? AND cuvee_id=? AND ((vintage IS NULL AND ? IS NULL) OR vintage=?) ORDER BY bottle_size_ml ASC`)
      .bind(owner,wine.cuveeId,wine.vintage,wine.vintage).all<Row>();
    if(results.length)return results.map(mapHolding);
  }
  // A holding whose producer was not in the library when it was entered has no
  // cuvee to match on, so fall back to the name it was filed under.
  const key=cellarMatchKey(wine.producer,wine.wineName,wine.vintage,750);
  const [,wineKey]=JSON.parse(key) as [string,string,unknown,number];
  const {results}=await db.prepare(`SELECT ${columns} FROM cellar_holdings WHERE owner_id=? AND producer=? AND ((vintage IS NULL AND ? IS NULL) OR vintage=?) ORDER BY bottle_size_ml ASC`)
    .bind(owner,wine.producer,wine.vintage,wine.vintage).all<Row>();
  return results.map(mapHolding).filter(holding=>{
    const [,candidate]=JSON.parse(cellarMatchKey(holding.producer,holding.wineName,holding.vintage,holding.bottleSizeMl)) as [string,string];
    return candidate===wineKey;
  });
}
