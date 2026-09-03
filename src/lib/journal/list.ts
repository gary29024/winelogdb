import { grapeGroup } from '../wine/grapes';
import { favoriteOnlyQuery } from './favorite';

export type JournalListQuery=Record<string,string|undefined>;

type JournalRow={
  id:string;
  producer:string;
  wine_name:string;
  vintage:number|null;
  country:string|null;
  region:string|null;
  appellation:string|null;
  grapes_json:string;
  wine_style:string|null;
  rating:number|null;
  venue:string|null;
  favorite:number|null;
  journal_date:string;
  photo_sort_at:string;
  created_at:string;
  tasting_name:string|null;
  image_id:string|null;
};

const parseJson=<T>(value:unknown,fallback:T):T=>{try{return JSON.parse(String(value)) as T}catch{return fallback}};

export function sliceJournalPage<T>(rows:T[],limit:number,offset:number){
  const items=rows.slice(0,limit);
  return {items,nextOffset:rows.length>limit?offset+limit:null};
}

export async function listJournalPage(db:D1Database,owner:string,q:JournalListQuery){
  const args:unknown[]=[owner];let where='w.owner_id=?';
  const filters:[string,string][]=[['vintage','w.vintage'],['country','w.country'],['region','w.region'],['style','w.wine_style'],['tastingDate','w.tasting_date']];
  const rawQuery=(q.query??'').trim();
  const vintageSearch=!q.vintage&&/^\d{4}$/.test(rawQuery)?rawQuery:null;
  for(const [key,col] of filters){
    const value=key==='vintage'?(q.vintage??vintageSearch):q[key];
    if(value){where+=` AND ${col}=?`;args.push(value)}
  }
  if(favoriteOnlyQuery(q.favorite))where+=' AND w.favorite=1';
  if(q.month){where+=" AND substr(coalesce(nullif(w.tasting_date,''),w.created_at),1,7)=?";args.push(q.month)}
  if(q.rating){where+=' AND w.rating>=?';args.push(Number(q.rating))}
  // Every name the grape answers to, because that is what is stored: the label
  // keeps its own spelling, so asking for Pinot Noir has to find the bottle
  // filed as Pinot Nero or the insight and the list behind it disagree.
  if(q.grape){
    const names=grapeGroup(q.grape);
    where+=` AND EXISTS (SELECT 1 FROM json_each(w.grapes_json) WHERE lower(trim(CAST(value AS TEXT))) IN (${names.map(()=>'?').join(',')}))`;
    args.push(...names.map(name=>name.toLowerCase()));
  }
  if(q.tasting){where+=' AND EXISTS (SELECT 1 FROM wine_experiences we JOIN tastings t ON t.id=we.tasting_id WHERE we.wine_id=w.id AND we.owner_id=? AND lower(t.name) LIKE lower(?))';args.push(owner,`%${q.tasting}%`)}
  if(rawQuery&&!vintageSearch){
    const clean=rawQuery.replace(/[^\p{L}\p{N}\s]/gu,' ').trim();
    if(clean){where+=' AND (w.id IN (SELECT wine_id FROM wine_search WHERE wine_search MATCH ? AND owner_id=?) OR EXISTS (SELECT 1 FROM wine_experiences we JOIN tastings t ON t.id=we.tasting_id WHERE we.wine_id=w.id AND we.owner_id=? AND lower(t.name) LIKE lower(?)))';args.push(clean+'*',owner,owner,`%${rawQuery}%`)}
  }

  const orders:Record<string,string>={
    newest:'journal_date DESC, photo_sort_at DESC, w.created_at DESC, w.id DESC',
    oldest:'journal_date ASC, photo_sort_at ASC, w.created_at ASC, w.id ASC',
    rating:'w.rating DESC, journal_date DESC, photo_sort_at DESC, w.created_at DESC, w.id DESC',
    producer:'w.producer COLLATE NOCASE ASC, w.wine_name COLLATE NOCASE ASC, w.vintage DESC, w.id ASC',
    vintage:'w.vintage DESC, w.producer COLLATE NOCASE ASC, w.wine_name COLLATE NOCASE ASC, w.id ASC'
  };
  const limit=Math.min(Math.max(Number(q.limit)||36,1),72),offset=Math.max(Number(q.offset)||0,0);
  // Count and page share the exact same predicate and travel in one D1 batch.
  // The old limit+1 query could answer only "is there another page?", which
  // made an exact result count and direct page navigation impossible.
  const countStatement=db.prepare(`SELECT count(*) AS total FROM wines w WHERE ${where}`).bind(...args);
  const pageStatement=db.prepare(`SELECT w.id,w.producer,w.wine_name,w.vintage,w.country,w.region,w.appellation,w.grapes_json,w.wine_style,w.rating,w.venue,w.favorite,
    coalesce(w.tasting_date,w.created_at) AS journal_date,
    coalesce((SELECT wi.captured_at FROM wine_images wi
      WHERE wi.owner_id=w.owner_id AND wi.wine_id=w.id AND wi.captured_at IS NOT NULL
      ORDER BY CASE WHEN wi.metadata_source='exif' THEN 0 ELSE 1 END,wi.captured_at ASC,wi.rowid ASC LIMIT 1),w.created_at) AS photo_sort_at,
    w.created_at,
    (SELECT t.name FROM wine_experiences we LEFT JOIN tastings t ON t.id=we.tasting_id WHERE we.wine_id=w.id AND we.owner_id=w.owner_id ORDER BY we.created_at DESC LIMIT 1) AS tasting_name,
    (SELECT wi.id FROM wine_images wi WHERE wi.owner_id=w.owner_id AND wi.wine_id=w.id ORDER BY wi.rowid ASC LIMIT 1) AS image_id
    FROM wines w WHERE ${where} ORDER BY ${orders[q.sort??'']||orders.newest} LIMIT ? OFFSET ?`).bind(...args,limit,offset);
  const [countResult,rowsResult]=await db.batch([countStatement,pageStatement]);
  const total=Number((countResult.results[0] as {total?:unknown}|undefined)?.total??0);
  const rows=rowsResult.results as JournalRow[];
  const items=rows.map(row=>({
    id:row.id,
    producer:row.producer,
    wineName:row.wine_name,
    vintage:row.vintage==null?null:Number(row.vintage),
    country:row.country??null,
    region:row.region??null,
    appellation:row.appellation??null,
    grapes:parseJson<string[]>(row.grapes_json,[]),
    wineStyle:row.wine_style??null,
    tastingName:row.tasting_name??null,
    venue:row.venue??null,
    favorite:Boolean(row.favorite),
    rating:row.rating==null?null:Number(row.rating),
    tastingDate:row.journal_date??null,
    imageIds:row.image_id?[row.image_id]:[],
    createdAt:row.created_at
  }));
  return {items,nextOffset:offset+limit<total?offset+limit:null,total};
}
