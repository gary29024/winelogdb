import { currentOwnerRevision,missingTable } from '../src/lib/db/ownerRevision';

// Bump when the shape of the payload below changes, so caches written by an older
// deployment are recomputed rather than served.
export const JOURNEY_PAYLOAD_VERSION=3;

const numberOrNull=(value:unknown)=>value==null?null:Number(value);
const parseJson=<T>(value:unknown,fallback:T):T=>{try{return JSON.parse(String(value)) as T}catch{return fallback}};

export async function buildJourneyPayload(db:D1Database,owner:string){
  const statements=[
    db.prepare(`SELECT COUNT(*) total_wines,
      COUNT(DISTINCT COALESCE(producer_id,lower(trim(producer)))) producers,
      COUNT(DISTINCT NULLIF(trim(country),'')) countries,
      COUNT(DISTINCT NULLIF(trim(region),'')) regions,
      COUNT(DISTINCT NULLIF(trim(appellation),'')) appellations,
      COUNT(DISTINCT vintage) vintages,
      SUM(CASE WHEN favorite=1 THEN 1 ELSE 0 END) favorites,
      AVG(rating) average_rating,COUNT(rating) rated_wines,
      SUM(CASE WHEN price IS NOT NULL THEN 1 ELSE 0 END) priced_wines
      FROM wines WHERE owner_id=?`).bind(owner),
    db.prepare(`SELECT COUNT(*) structured_tastings FROM wine_tasting_structures
      WHERE owner_id=? AND structure_json<>'{}'`).bind(owner),
    db.prepare(`SELECT trim(country) country,COUNT(*) wines,
      COUNT(DISTINCT COALESCE(producer_id,lower(trim(producer)))) producers,
      COUNT(DISTINCT NULLIF(trim(appellation),'')) appellations,AVG(rating) average_rating
      FROM wines WHERE owner_id=? AND country IS NOT NULL AND trim(country)<>''
      GROUP BY trim(country) ORDER BY wines DESC,country ASC LIMIT 20`).bind(owner),
    db.prepare(`SELECT NULLIF(trim(country),'') country,trim(region) region,COUNT(*) wines,
      COUNT(DISTINCT COALESCE(producer_id,lower(trim(producer)))) producers,
      COUNT(DISTINCT NULLIF(trim(appellation),'')) appellations,AVG(rating) average_rating,
      SUM(CASE WHEN favorite=1 THEN 1 ELSE 0 END) favorites
      FROM wines WHERE owner_id=? AND region IS NOT NULL AND trim(region)<>''
      GROUP BY NULLIF(trim(country),''),trim(region) ORDER BY wines DESC,region ASC LIMIT 20`).bind(owner),
    db.prepare(`SELECT NULLIF(trim(country),'') country,NULLIF(trim(region),'') region,trim(appellation) appellation,
      COUNT(*) wines,AVG(rating) average_rating FROM wines
      WHERE owner_id=? AND appellation IS NOT NULL AND trim(appellation)<>''
      GROUP BY NULLIF(trim(country),''),NULLIF(trim(region),''),trim(appellation)
      ORDER BY wines DESC,appellation ASC LIMIT 24`).bind(owner),
    db.prepare(`SELECT wine_style style,COUNT(*) wines,COUNT(rating) rated_wines,AVG(rating) average_rating,
      SUM(CASE WHEN favorite=1 THEN 1 ELSE 0 END) favorites
      FROM wines WHERE owner_id=? AND wine_style IS NOT NULL AND trim(wine_style)<>''
      GROUP BY wine_style ORDER BY wines DESC,style ASC`).bind(owner),
    // Producers you come back to. This used to require two *rated* wines from
    // the same producer, which returns nothing at all for a journal that rarely
    // scores; returning to a producer is the signal, whether or not a number
    // ever got attached to the bottle.
    db.prepare(`SELECT MAX(producer) producer,COUNT(*) wines,COUNT(rating) rated_wines,AVG(rating) average_rating,
      SUM(CASE WHEN favorite=1 THEN 1 ELSE 0 END) favorites,
      MAX(COALESCE(NULLIF(tasting_date,''),created_at)) last_tasted FROM wines
      WHERE owner_id=? GROUP BY COALESCE(producer_id,lower(trim(producer)))
      HAVING COUNT(*)>=2 ORDER BY wines DESC,last_tasted DESC,producer ASC LIMIT 10`).bind(owner),
    db.prepare(`SELECT upper(trim(currency)) currency,COUNT(*) wines,AVG(price) average_price,AVG(rating) average_rating
      FROM wines WHERE owner_id=? AND price IS NOT NULL AND currency IS NOT NULL AND trim(currency)<>''
      GROUP BY upper(trim(currency)) ORDER BY wines DESC,currency ASC LIMIT 8`).bind(owner),
    db.prepare(`SELECT substr(COALESCE(NULLIF(tasting_date,''),created_at),1,4) year,COUNT(*) wines,
      COUNT(rating) rated_wines,AVG(rating) average_rating FROM wines WHERE owner_id=?
      GROUP BY substr(COALESCE(NULLIF(tasting_date,''),created_at),1,4) ORDER BY year DESC LIMIT 8`).bind(owner),
    db.prepare(`SELECT s.structure_json,w.rating FROM wine_tasting_structures s
      JOIN wines w ON w.owner_id=s.owner_id AND w.id=s.wine_id
      WHERE s.owner_id=? AND s.structure_json<>'{}'`).bind(owner),
    db.prepare(`SELECT MIN(trim(CAST(g.value AS TEXT))) grape,COUNT(DISTINCT w.id) wines,
      COUNT(DISTINCT CASE WHEN w.favorite=1 THEN w.id END) favorites
      FROM wines w,json_each(CASE WHEN json_valid(w.grapes_json) THEN w.grapes_json ELSE '[]' END) g
      WHERE w.owner_id=? AND trim(CAST(g.value AS TEXT))<>''
      GROUP BY lower(trim(CAST(g.value AS TEXT))) ORDER BY wines DESC,grape ASC LIMIT 14`).bind(owner),
    db.prepare(`SELECT w.id,w.producer,w.wine_name,w.vintage,NULLIF(trim(w.country),'') country,
      NULLIF(trim(w.region),'') region,NULLIF(trim(w.appellation),'') appellation,w.rating,
      NULLIF(w.tasting_date,'') tasting_date,w.created_at,
      (SELECT wi.id FROM wine_images wi WHERE wi.owner_id=w.owner_id AND wi.wine_id=w.id ORDER BY wi.created_at ASC LIMIT 1) image_id
      FROM wines w WHERE w.owner_id=?
      ORDER BY COALESCE(NULLIF(w.tasting_date,''),w.created_at) DESC,w.created_at DESC LIMIT 4`).bind(owner),
    // Discovery: of the most recent tastings, how many were the first from that
    // producer, region or country. Ranking every wine within its own group and
    // then taking the tail is what makes "first" mean first in the whole
    // journal rather than first in the window.
    db.prepare(`WITH ordered AS (
        SELECT id,COALESCE(NULLIF(tasting_date,''),created_at) sort_key,created_at,
          COALESCE(producer_id,lower(trim(producer))) producer_key,
          NULLIF(lower(trim(COALESCE(region,''))),'') region_key,
          NULLIF(lower(trim(COALESCE(country,''))),'') country_key
        FROM wines WHERE owner_id=?
      ),ranked AS (
        SELECT sort_key,created_at,id,
          ROW_NUMBER() OVER (PARTITION BY producer_key ORDER BY sort_key,created_at,id) producer_rank,
          CASE WHEN region_key IS NULL THEN NULL ELSE
            ROW_NUMBER() OVER (PARTITION BY region_key ORDER BY sort_key,created_at,id) END region_rank,
          CASE WHEN country_key IS NULL THEN NULL ELSE
            ROW_NUMBER() OVER (PARTITION BY country_key ORDER BY sort_key,created_at,id) END country_rank
        FROM ordered
      ),recent AS (
        SELECT * FROM ranked ORDER BY sort_key DESC,created_at DESC,id DESC LIMIT 30
      )
      SELECT COUNT(*) tastings,
        SUM(CASE WHEN producer_rank=1 THEN 1 ELSE 0 END) new_producers,
        SUM(CASE WHEN region_rank=1 THEN 1 ELSE 0 END) new_regions,
        SUM(CASE WHEN country_rank=1 THEN 1 ELSE 0 END) new_countries
      FROM recent`).bind(owner),
    db.prepare(`SELECT substr(COALESCE(NULLIF(tasting_date,''),created_at),1,7) month,COUNT(*) wines,
      SUM(CASE WHEN favorite=1 THEN 1 ELSE 0 END) favorites FROM wines WHERE owner_id=?
      GROUP BY month ORDER BY month DESC LIMIT 18`).bind(owner),
    // Where a wine sits in a classified hierarchy, for the countries that have
    // one. Null everywhere else, so the card only appears when there is a mix.
    db.prepare(`SELECT classification,COUNT(*) wines,
      SUM(CASE WHEN favorite=1 THEN 1 ELSE 0 END) favorites FROM wines
      WHERE owner_id=? AND classification IS NOT NULL AND trim(classification)<>''
      GROUP BY classification`).bind(owner),
    // How old a bottle is when it gets opened. Ages are bucketed in SQL so the
    // payload stays a histogram rather than one row per wine.
    db.prepare(`SELECT CAST(substr(COALESCE(NULLIF(tasting_date,''),created_at),1,4) AS INTEGER)-vintage age,
      COUNT(*) wines FROM wines WHERE owner_id=? AND vintage IS NOT NULL AND vintage>1900
      AND CAST(substr(COALESCE(NULLIF(tasting_date,''),created_at),1,4) AS INTEGER)>=vintage
      GROUP BY age ORDER BY age ASC`).bind(owner)
  ];
  const results=await db.batch(statements);
  const first=<T extends Record<string,unknown>>(index:number)=>(results[index]?.results?.[0]??{}) as T;
  const rows=<T extends Record<string,unknown>>(index:number)=>(results[index]?.results??[]) as T[];
  const summary=first<Record<string,unknown>>(0),structured=first<Record<string,unknown>>(1);
  const structures=rows<{structure_json:unknown;rating:unknown}>(9).flatMap(row=>{
    try{return [{structure:JSON.parse(String(row.structure_json||'{}')) as Record<string,string>,rating:numberOrNull(row.rating)}]}
    catch{return []}
  });
  return {
    summary:{
      totalWines:Number(summary.total_wines??0),producers:Number(summary.producers??0),countries:Number(summary.countries??0),regions:Number(summary.regions??0),appellations:Number(summary.appellations??0),vintages:Number(summary.vintages??0),favorites:Number(summary.favorites??0),averageRating:numberOrNull(summary.average_rating),ratedWines:Number(summary.rated_wines??0),pricedWines:Number(summary.priced_wines??0),structuredTastings:Number(structured.structured_tastings??0)
    },
    countries:rows<Record<string,unknown>>(2).map(row=>({country:String(row.country),wines:Number(row.wines),producers:Number(row.producers),appellations:Number(row.appellations),averageRating:numberOrNull(row.average_rating)})),
    regions:rows<Record<string,unknown>>(3).map(row=>({country:row.country==null?null:String(row.country),region:String(row.region),wines:Number(row.wines),producers:Number(row.producers),appellations:Number(row.appellations),averageRating:numberOrNull(row.average_rating),favorites:Number(row.favorites??0)})),
    appellations:rows<Record<string,unknown>>(4).map(row=>({country:row.country==null?null:String(row.country),region:row.region==null?null:String(row.region),appellation:String(row.appellation),wines:Number(row.wines),averageRating:numberOrNull(row.average_rating)})),
    styles:rows<Record<string,unknown>>(5).map(row=>({style:String(row.style),wines:Number(row.wines),ratedWines:Number(row.rated_wines),averageRating:numberOrNull(row.average_rating),favorites:Number(row.favorites??0)})),
    producers:rows<Record<string,unknown>>(6).map(row=>({producer:String(row.producer),wines:Number(row.wines),ratedWines:Number(row.rated_wines),averageRating:numberOrNull(row.average_rating),favorites:Number(row.favorites??0),lastTasted:row.last_tasted==null?null:String(row.last_tasted)})),
    currencies:rows<Record<string,unknown>>(7).map(row=>({currency:String(row.currency),wines:Number(row.wines),averagePrice:numberOrNull(row.average_price),averageRating:numberOrNull(row.average_rating)})),
    years:rows<Record<string,unknown>>(8).map(row=>({year:String(row.year),wines:Number(row.wines),ratedWines:Number(row.rated_wines),averageRating:numberOrNull(row.average_rating)})),
    structures,
    grapes:rows<Record<string,unknown>>(10).map(row=>({grape:String(row.grape),wines:Number(row.wines),favorites:Number(row.favorites??0)})),
    discovery:(()=>{
      const row=first<Record<string,unknown>>(12);
      return {tastings:Number(row.tastings??0),newProducers:Number(row.new_producers??0),newRegions:Number(row.new_regions??0),newCountries:Number(row.new_countries??0)};
    })(),
    months:rows<Record<string,unknown>>(13).map(row=>({month:String(row.month),wines:Number(row.wines),favorites:Number(row.favorites??0)})),
    classifications:rows<Record<string,unknown>>(14).map(row=>({classification:String(row.classification),wines:Number(row.wines),favorites:Number(row.favorites??0)})),
    drinkingAges:rows<Record<string,unknown>>(15).map(row=>({age:Number(row.age),wines:Number(row.wines)})),
    recentTastings:rows<Record<string,unknown>>(11).map(row=>({
      id:String(row.id),producer:String(row.producer),wineName:String(row.wine_name),vintage:row.vintage==null?null:Number(row.vintage),
      country:row.country==null?null:String(row.country),region:row.region==null?null:String(row.region),appellation:row.appellation==null?null:String(row.appellation),
      rating:numberOrNull(row.rating),tastingDate:row.tasting_date==null?null:String(row.tasting_date),createdAt:String(row.created_at),imageId:row.image_id==null?null:String(row.image_id)
    }))
  };
}

async function cachedJourneyPayload(db:D1Database,owner:string,revision:number){
  try{
    const row=await db.prepare('SELECT revision,payload_version,result_json FROM journey_summary_cache WHERE owner_id=?').bind(owner).first<{revision:number;payload_version:number;result_json:string}>();
    if(!row||Number(row.revision)!==revision||Number(row.payload_version)!==JOURNEY_PAYLOAD_VERSION)return null;
    const parsed=parseJson<Record<string,unknown>|null>(row.result_json,null);
    return parsed&&typeof parsed==='object'?parsed:null;
  }catch(error){if(missingTable(error))return null;throw error}
}

async function storeJourneyPayload(db:D1Database,owner:string,revision:number,payload:unknown){
  try{
    await db.prepare(`INSERT INTO journey_summary_cache(owner_id,revision,payload_version,result_json,updated_at) VALUES(?,?,?,?,?)
      ON CONFLICT(owner_id) DO UPDATE SET revision=excluded.revision,payload_version=excluded.payload_version,result_json=excluded.result_json,updated_at=excluded.updated_at
      WHERE journey_summary_cache.revision<>excluded.revision OR journey_summary_cache.payload_version<>excluded.payload_version`)
      .bind(owner,revision,JOURNEY_PAYLOAD_VERSION,JSON.stringify(payload),new Date().toISOString()).run();
  }catch(error){if(!missingTable(error))throw error}
}

// Twelve aggregate scans of the owner's wines is the single largest read on the
// application landing page. Serve them from the revision-keyed cache whenever the
// journal has not changed, and report the revision so the route can answer a
// conditional request with 304 instead of a body.
export async function loadJourneySummary(db:D1Database,owner:string):Promise<{revision:number|null;payload:Record<string,unknown>}>{
  const revision=await currentOwnerRevision(db,owner);
  if(revision!==null){
    const cached=await cachedJourneyPayload(db,owner,revision);
    if(cached)return {revision,payload:cached};
  }
  const payload=await buildJourneyPayload(db,owner);
  // Re-read the revision: a concurrent write during the rebuild must not be cached
  // under the stale counter, or the next request would serve a payload missing it.
  const after=revision===null?null:await currentOwnerRevision(db,owner);
  if(after===null||after!==revision)return {revision:null,payload};
  await storeJourneyPayload(db,owner,after,payload);
  return {revision:after,payload};
}
