import type { WineInput } from '../db/schema';

export const vintageKinds=['vintage','non_vintage','multi_vintage','unknown'] as const;
export type VintageKind=typeof vintageKinds[number];
export type IdentityMatchStatus='matched'|'suggested'|'ambiguous'|'unmatched'|'manual'|'conflict';

export function normalizeReferenceText(value:string|null|undefined){
  return (value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/[’'\`]/g,'').replace(/&/g,' and ').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
}

export function normalizeLwinId(value:unknown){
  if(value==null)return null;
  const text=String(value).trim();
  if(!text||/^na$/i.test(text))return null;
  const normalized=text.replace(/\.0+$/,'');
  return /^\d{7}$/.test(normalized)?normalized:null;
}

/**
 * Syntax validation only. A syntactically valid ELID is not necessarily a
 * registered ELID; WineLog attaches one only from wine_reference_external_ids.
 */
export function isValidElid(value:string|null|undefined){
  if(!value)return false;
  return /^[A-Z]{2}-[A-Z]{3}-[A-Z0-9]{6}-(?:\d{4}|XXXX|NVXX|N[A-Z0-9]{3})(?:\+[A-Z0-9]{3,4})?$/.test(value.trim().toUpperCase());
}

export function normalizedVintageKind(vintage:number|null|undefined,kind:VintageKind|null|undefined):VintageKind{
  if(kind&&vintageKinds.includes(kind))return kind;
  return vintage==null?'unknown':'vintage';
}

export function vintageReferenceCode(vintage:number|null|undefined,kind:VintageKind|null|undefined){
  const resolved=normalizedVintageKind(vintage,kind);
  return resolved==='vintage'&&vintage!=null?String(vintage):'';
}

function colourFromStyle(style:string|null|undefined){
  const value=(style??'').trim().toLowerCase();
  return ['red','white','rose','orange'].includes(value)?value:'';
}

/**
 * Appended to every wine create/update batch. The first statement preserves
 * label evidence and release semantics; the second performs an indexed, local
 * exact-reference match. No network/API request sits on the save hot path.
 *
 * Only a single live reference candidate is auto-linked. Multiple exact-name
 * candidates remain ambiguous rather than being guessed. User-entered wine
 * identity is never overwritten by the reference catalogue.
 */
export function referenceIdentityStatements(
  db:D1Database,owner:string,wineId:string,w:WineInput,stamp=new Date().toISOString(),updateExisting=false
){
  const vintageKind=normalizedVintageKind(w.vintage,w.vintageKind as VintageKind|null|undefined);
  const evidence=updateExisting
    ?db.prepare(`UPDATE wines SET
       recognized_producer=coalesce(recognized_producer,?),
       recognized_wine_name=coalesce(recognized_wine_name,?),
       recognized_vintage_text=coalesce(recognized_vintage_text,?),
       vintage_kind=?,release_designation=?
       WHERE owner_id=? AND id=?`).bind(
        w.recognizedProducer??w.producer,w.recognizedWineName??w.wineName,w.recognizedVintageText??(w.vintage!=null?String(w.vintage):null),
        vintageKind,w.releaseDesignation??null,owner,wineId)
    :db.prepare(`UPDATE wines SET
       recognized_producer=?,recognized_wine_name=?,recognized_vintage_text=?,
       vintage_kind=?,release_designation=?
       WHERE owner_id=? AND id=?`).bind(
        w.recognizedProducer??w.producer,w.recognizedWineName??w.wineName,w.recognizedVintageText??(w.vintage!=null?String(w.vintage):null),
        vintageKind,w.releaseDesignation??null,owner,wineId);

  const producerKey=normalizeReferenceText(w.producer),wineKey=normalizeReferenceText(w.wineName);
  const countryKey=normalizeReferenceText(w.country),regionKey=normalizeReferenceText(w.region);
  const colourKey=colourFromStyle(w.wineStyle),vintageCode=vintageReferenceCode(w.vintage,vintageKind);
  const resolution=db.prepare(`WITH candidates AS (
      SELECT product_key,lwin7,colour,product_type,product_subtype
      FROM wine_reference_products
      WHERE status='Live' AND producer_key=? AND wine_key=?
        AND (?='' OR country_key='' OR country_key=?)
        AND (?='' OR region_key='' OR region_key=?)
        AND (?='' OR colour_key='' OR colour_key=?)
    ), tally AS (SELECT count(*) AS n FROM candidates),
    chosen AS (SELECT * FROM candidates LIMIT 1)
    UPDATE wines SET
      reference_product_key=CASE WHEN (SELECT n FROM tally)=1 THEN (SELECT product_key FROM chosen) ELSE NULL END,
      lwin7=CASE WHEN (SELECT n FROM tally)=1 THEN (SELECT lwin7 FROM chosen) ELSE NULL END,
      lwin11=CASE WHEN (SELECT n FROM tally)=1 THEN (
        SELECT external_id FROM wine_reference_external_ids
        WHERE provider='lwin11' AND product_key=(SELECT product_key FROM chosen) AND vintage_code=? LIMIT 1
      ) ELSE NULL END,
      elid=CASE WHEN (SELECT n FROM tally)=1 THEN (
        SELECT external_id FROM wine_reference_external_ids
        WHERE provider='elid' AND product_key=(SELECT product_key FROM chosen)
          AND (vintage_code=? OR vintage_code='') ORDER BY CASE WHEN vintage_code=? THEN 0 ELSE 1 END LIMIT 1
      ) ELSE NULL END,
      colour=CASE WHEN (SELECT n FROM tally)=1 THEN coalesce((SELECT colour FROM chosen),colour) ELSE colour END,
      product_type=CASE WHEN (SELECT n FROM tally)=1 THEN coalesce((SELECT product_type FROM chosen),product_type) ELSE product_type END,
      product_subtype=CASE WHEN (SELECT n FROM tally)=1 THEN coalesce((SELECT product_subtype FROM chosen),product_subtype) ELSE product_subtype END,
      identity_match_status=CASE WHEN (SELECT n FROM tally)=1 THEN 'matched' WHEN (SELECT n FROM tally)>1 THEN 'ambiguous' ELSE 'unmatched' END,
      identity_match_confidence=CASE WHEN (SELECT n FROM tally)=1 THEN 1.0 ELSE NULL END,
      identity_matched_at=CASE WHEN (SELECT n FROM tally)=1 THEN ? ELSE NULL END
    WHERE owner_id=? AND id=?`)
    .bind(producerKey,wineKey,countryKey,countryKey,regionKey,regionKey,colourKey,colourKey,
      vintageCode,vintageCode,vintageCode,stamp,owner,wineId);
  return [evidence,resolution];
}
