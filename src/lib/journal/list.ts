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
  is_shared:number;
  shared_by:string|null;
  shared_tasting_name:string|null;
};

const parseJson=<T>(value:unknown,fallback:T):T=>{try{return JSON.parse(String(value)) as T}catch{return fallback}};

export function sliceJournalPage<T>(rows:T[],limit:number,offset:number){
  const items=rows.slice(0,limit);
  return {items,nextOffset:rows.length>limit?offset+limit:null};
}

export async function listJournalPage(db:D1Database,owner:string,q:JournalListQuery,semanticIds:string[]=[],includeShared=false){
  const wineSource=includeShared?'member_visible_wines':'wines';
  // structureEntry forwards semantic candidates through the canonical Journal
  // route using an internal query parameter. The owner predicate below still
  // scopes every candidate, and the cap prevents an oversized URL/result set.
  const forwarded=(q.__semanticIds??'').split(',').map(id=>id.trim()).filter(Boolean).slice(0,72);
  const semanticMatches=[...new Set((semanticIds.length?semanticIds:forwarded).slice(0,72))];
  // D1 permits at most 100 bound parameters per statement. A full 72-result
  // semantic set used to consume 144 variables because every ID was rebound for
  // membership and ranking. Pack the ordered IDs into JSON instead: json_each()
  // preserves the array key as the semantic rank while using one variable each
  // for membership and (when applicable) default ranking.
  const semanticJson=JSON.stringify(semanticMatches);
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
  if(q.tasting){
    const like=`%${q.tasting}%`;
    if(includeShared){
      where+=" AND ((w.is_shared=1 AND lower(coalesce(w.shared_tasting_name,'')) LIKE lower(?)) OR (w.is_shared=0 AND EXISTS (SELECT 1 FROM wine_experiences we JOIN tastings t ON t.id=we.tasting_id WHERE we.wine_id=w.id AND we.owner_id=? AND lower(t.name) LIKE lower(?))))";
      args.push(like,owner,like);
    }else{
      where+=' AND EXISTS (SELECT 1 FROM wine_experiences we JOIN tastings t ON t.id=we.tasting_id WHERE we.wine_id=w.id AND we.owner_id=? AND lower(t.name) LIKE lower(?))';
      args.push(owner,like);
    }
  }
  if(rawQuery&&!vintageSearch){
    const searchPredicates:string[]=[];
    const clean=rawQuery.replace(/[^\p{L}\p{N}\s]/gu,' ').trim();
    if(clean){
      searchPredicates.push('(w.id IN (SELECT wine_id FROM wine_search WHERE wine_search MATCH ? AND owner_id=?) OR EXISTS (SELECT 1 FROM wine_experiences we JOIN tastings t ON t.id=we.tasting_id WHERE we.wine_id=w.id AND we.owner_id=? AND lower(t.name) LIKE lower(?)))');
      args.push(clean+'*',owner,owner,`%${rawQuery}%`);
      if(includeShared){
        const like=`%${rawQuery}%`;
        searchPredicates.push("(w.is_shared=1 AND (lower(w.producer) LIKE lower(?) OR lower(w.wine_name) LIKE lower(?) OR lower(coalesce(w.country,'')) LIKE lower(?) OR lower(coalesce(w.region,'')) LIKE lower(?) OR lower(coalesce(w.appellation,'')) LIKE lower(?) OR lower(w.grapes_json) LIKE lower(?) OR lower(coalesce(w.shared_tasting_name,'')) LIKE lower(?)))");
        args.push(like,like,like,like,like,like,like);
      }
    }
    if(semanticMatches.length){
      searchPredicates.push('w.id IN (SELECT CAST(value AS TEXT) FROM json_each(?))');
      args.push(semanticJson);
    }
    if(searchPredicates.length)where+=` AND (${searchPredicates.join(' OR ')})`;
  }

  /**
   * Written as the expressions rather than the aliases, because this is what the
   * planner matches against idx_wines_owner_journal_order. An alias resolves to
   * the same thing and orders the same rows; it just does not look like the
   * index while it is deciding.
   */
  const journalDate='coalesce(w.tasting_date,w.created_at)',photoSort='coalesce(w.photo_sort_at,w.created_at)';
  const orders:Record<string,string>={
    newest:`${journalDate} DESC, ${photoSort} DESC, w.created_at DESC, w.id DESC`,
    oldest:`${journalDate} ASC, ${photoSort} ASC, w.created_at ASC, w.id ASC`,
    rating:`w.rating DESC, ${journalDate} DESC, ${photoSort} DESC, w.created_at DESC, w.id DESC`,
    producer:'w.producer COLLATE NOCASE ASC, w.wine_name COLLATE NOCASE ASC, w.vintage DESC, w.id ASC',
    vintage:'w.vintage DESC, w.producer COLLATE NOCASE ASC, w.wine_name COLLATE NOCASE ASC, w.id ASC'
  };
  let order=orders[q.sort??'']||orders.newest;
  const orderArgs:unknown[]=[];
  // A natural-language search is useful only if its nearest matches appear first.
  // An explicit user-selected sort still wins, so semantic search never silently
  // overrides "rating", "producer", etc. A direct LEFT JOIN to json_each also
  // scans the virtual table per wine; keep the simpler scalar rank expression.
  if(!q.sort&&semanticMatches.length&&rawQuery&&!vintageSearch){
    order=`COALESCE((SELECT CAST(key AS INTEGER) FROM json_each(?) WHERE CAST(value AS TEXT)=w.id), ${semanticMatches.length}), ${orders.newest}`;
    orderArgs.push(semanticJson);
  }
  const limit=Math.min(Math.max(Number(q.limit)||36,1),72),offset=Math.max(Number(q.offset)||0,0);
  // Count and page share the exact same predicate and travel in one D1 batch.
  // The old limit+1 query could answer only "is there another page?", which
  // made an exact result count and direct page navigation impossible.
  const countStatement=db.prepare(`SELECT count(*) AS total FROM ${wineSource} w WHERE ${where}`).bind(...args);
  const visibilityColumns=includeShared
    ?'w.is_shared,w.shared_by,w.source_owner_id'
    :'0 AS is_shared,NULL AS shared_by,w.owner_id AS source_owner_id';
  const tastingName=includeShared
    ?"CASE WHEN w.is_shared=1 THEN w.shared_tasting_name ELSE (SELECT t.name FROM wine_experiences we LEFT JOIN tastings t ON t.id=we.tasting_id WHERE we.wine_id=w.id AND we.owner_id=w.owner_id ORDER BY we.created_at DESC LIMIT 1) END"
    :' (SELECT t.name FROM wine_experiences we LEFT JOIN tastings t ON t.id=we.tasting_id WHERE we.wine_id=w.id AND we.owner_id=w.owner_id ORDER BY we.created_at DESC LIMIT 1)';
  const imageId=includeShared
    ?`CASE WHEN w.is_shared=1 THEN
        (SELECT p.image_id FROM shared_photos p JOIN wine_images wi ON wi.id=p.image_id AND wi.owner_id=p.owner_id WHERE wi.owner_id=w.source_owner_id AND wi.wine_id=w.id ORDER BY wi.rowid ASC LIMIT 1)
       ELSE (SELECT wi.id FROM wine_images wi WHERE wi.owner_id=w.owner_id AND wi.wine_id=w.id ORDER BY wi.rowid ASC LIMIT 1) END`
    :' (SELECT wi.id FROM wine_images wi WHERE wi.owner_id=w.owner_id AND wi.wine_id=w.id ORDER BY wi.rowid ASC LIMIT 1)';
  const pageStatement=db.prepare(`SELECT w.id,w.producer,w.wine_name,w.vintage,w.country,w.region,w.appellation,w.grapes_json,w.wine_style,w.rating,w.venue,w.favorite,
    coalesce(w.tasting_date,w.created_at) AS journal_date,
    coalesce(w.photo_sort_at,w.created_at) AS photo_sort_at,
    w.created_at,${visibilityColumns},
    ${tastingName} AS tasting_name,
    ${imageId} AS image_id
    FROM ${wineSource} w WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...args,...orderArgs,limit,offset);
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
    imageIds:row.image_id&&!row.is_shared?[row.image_id]:[],
    imageUrl:row.image_id&&row.is_shared?`/api/shared/wines/${row.id}/photos/${row.image_id}`:null,
    shared:Boolean(row.is_shared),
    sharedBy:row.shared_by??null,
    createdAt:row.created_at
  }));
  return {items,nextOffset:offset+limit<total?offset+limit:null,total};
}
