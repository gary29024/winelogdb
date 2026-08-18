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
  journal_date:string;
  created_at:string;
  tasting_name:string|null;
  image_id:string|null;
};

const parseJson=<T>(value:unknown,fallback:T):T=>{try{return JSON.parse(String(value)) as T}catch{return fallback}};

export async function listJournalPage(db:D1Database,owner:string,q:JournalListQuery){
  const args:unknown[]=[owner];let where='w.owner_id=?';
  const filters:[string,string][]=[['vintage','w.vintage'],['country','w.country'],['region','w.region'],['style','w.wine_style'],['tastingDate','w.tasting_date']];
  const rawQuery=(q.query??'').trim();
  const vintageSearch=!q.vintage&&/^\d{4}$/.test(rawQuery)?rawQuery:null;
  for(const [key,col] of filters){
    const value=key==='vintage'?(q.vintage??vintageSearch):q[key];
    if(value){where+=` AND ${col}=?`;args.push(value)}
  }
  if(q.rating){where+=' AND w.rating>=?';args.push(Number(q.rating))}
  if(q.grape){where+=' AND EXISTS (SELECT 1 FROM json_each(w.grapes_json) WHERE value=?)';args.push(q.grape)}
  if(q.tasting){where+=' AND EXISTS (SELECT 1 FROM wine_experiences we JOIN tastings t ON t.id=we.tasting_id WHERE we.wine_id=w.id AND we.owner_id=? AND lower(t.name) LIKE lower(?))';args.push(owner,`%${q.tasting}%`)}
  if(rawQuery&&!vintageSearch){
    const clean=rawQuery.replace(/[^\p{L}\p{N}\s]/gu,' ').trim();
    if(clean){where+=' AND (w.id IN (SELECT wine_id FROM wine_search WHERE wine_search MATCH ? AND owner_id=?) OR EXISTS (SELECT 1 FROM wine_experiences we JOIN tastings t ON t.id=we.tasting_id WHERE we.wine_id=w.id AND we.owner_id=? AND lower(t.name) LIKE lower(?)))';args.push(clean+'*',owner,owner,`%${rawQuery}%`)}
  }

  const orders:Record<string,string>={
    newest:'journal_date DESC, w.id DESC',
    oldest:'journal_date ASC, w.id ASC',
    rating:'w.rating DESC, journal_date DESC, w.id DESC',
    producer:'w.producer COLLATE NOCASE ASC, w.wine_name COLLATE NOCASE ASC, w.vintage DESC, w.id ASC',
    vintage:'w.vintage DESC, w.producer COLLATE NOCASE ASC, w.wine_name COLLATE NOCASE ASC, w.id ASC'
  };
  const limit=Math.min(Math.max(Number(q.limit)||36,1),72),offset=Math.max(Number(q.offset)||0,0);args.push(limit,offset);
  const rows=await db.prepare(`SELECT w.id,w.producer,w.wine_name,w.vintage,w.country,w.region,w.appellation,w.grapes_json,w.wine_style,w.rating,w.venue,
    coalesce(w.tasting_date,w.created_at) AS journal_date,w.created_at,
    (SELECT t.name FROM wine_experiences we LEFT JOIN tastings t ON t.id=we.tasting_id WHERE we.wine_id=w.id AND we.owner_id=w.owner_id ORDER BY we.created_at DESC LIMIT 1) AS tasting_name,
    (SELECT wi.id FROM wine_images wi WHERE wi.owner_id=w.owner_id AND wi.wine_id=w.id ORDER BY wi.rowid ASC LIMIT 1) AS image_id
    FROM wines w WHERE ${where} ORDER BY ${orders[q.sort??'']||orders.newest} LIMIT ? OFFSET ?`).bind(...args).all<JournalRow>();
  const items=rows.results.map(row=>({
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
    rating:row.rating==null?null:Number(row.rating),
    tastingDate:row.journal_date??null,
    imageIds:row.image_id?[row.image_id]:[],
    createdAt:row.created_at
  }));
  return {items,nextOffset:rows.results.length===limit?offset+limit:null};
}
