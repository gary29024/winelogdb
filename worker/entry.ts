import { Hono } from 'hono';
import baseApp from './index';
import layeredApp from './layered';
import { applyJournalVintageSearch } from '../src/lib/journal/searchQuery';
import { favoriteUpdateSchema } from '../src/lib/journal/favorite';
import { requireSession } from '../src/lib/auth/session';
import { handleRecognitionRequest } from './recognitionHandler';

type Bindings={DB:D1Database;WINE_IMAGES:R2Bucket;ASSETS:Fetcher;GEMINI_API_KEY:string;AUTH_SECRET:string;APP_PASSWORD:string;APP_URL:string;MAX_FILE_BYTES?:string;MAX_BATCH_FILES?:string};
type AppEnv={Bindings:Bindings};
const app=new Hono<AppEnv>();

async function user(c:{req:{header:(name:string)=>string|undefined};env:Bindings}){return (await requireSession(c.req.header('Authorization'),c.env.AUTH_SECRET)).userId}
const numberOrNull=(value:unknown)=>value==null?null:Number(value);

app.post('/api/recognition',c=>handleRecognitionRequest(c.req.raw,c.env));

app.get('/api/wines',c=>{
  const url=new URL(c.req.raw.url);
  if(!applyJournalVintageSearch(url))return layeredApp.fetch(c.req.raw,c.env,c.executionCtx);
  const request=new Request(url.toString(),{method:'GET',headers:c.req.raw.headers});
  return layeredApp.fetch(request,c.env,c.executionCtx);
});

app.get('/api/journey',async c=>{
  let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const statements=[
    c.env.DB.prepare(`SELECT COUNT(*) total_wines,
      COUNT(DISTINCT COALESCE(producer_id,lower(trim(producer)))) producers,
      COUNT(DISTINCT NULLIF(trim(country),'')) countries,
      COUNT(DISTINCT NULLIF(trim(region),'')) regions,
      COUNT(DISTINCT NULLIF(trim(appellation),'')) appellations,
      COUNT(DISTINCT vintage) vintages,
      SUM(CASE WHEN favorite=1 THEN 1 ELSE 0 END) favorites,
      AVG(rating) average_rating,COUNT(rating) rated_wines,
      SUM(CASE WHEN price IS NOT NULL THEN 1 ELSE 0 END) priced_wines
      FROM wines WHERE owner_id=?`).bind(owner),
    c.env.DB.prepare(`SELECT COUNT(*) structured_tastings FROM wine_tasting_structures
      WHERE owner_id=? AND structure_json<>'{}'`).bind(owner),
    c.env.DB.prepare(`SELECT trim(country) country,COUNT(*) wines,
      COUNT(DISTINCT COALESCE(producer_id,lower(trim(producer)))) producers,
      COUNT(DISTINCT NULLIF(trim(appellation),'')) appellations,AVG(rating) average_rating
      FROM wines WHERE owner_id=? AND country IS NOT NULL AND trim(country)<>''
      GROUP BY trim(country) ORDER BY wines DESC,country ASC LIMIT 20`).bind(owner),
    c.env.DB.prepare(`SELECT NULLIF(trim(country),'') country,trim(region) region,COUNT(*) wines,
      COUNT(DISTINCT COALESCE(producer_id,lower(trim(producer)))) producers,
      COUNT(DISTINCT NULLIF(trim(appellation),'')) appellations,AVG(rating) average_rating
      FROM wines WHERE owner_id=? AND region IS NOT NULL AND trim(region)<>''
      GROUP BY NULLIF(trim(country),''),trim(region) ORDER BY wines DESC,region ASC LIMIT 20`).bind(owner),
    c.env.DB.prepare(`SELECT NULLIF(trim(country),'') country,NULLIF(trim(region),'') region,trim(appellation) appellation,
      COUNT(*) wines,AVG(rating) average_rating FROM wines
      WHERE owner_id=? AND appellation IS NOT NULL AND trim(appellation)<>''
      GROUP BY NULLIF(trim(country),''),NULLIF(trim(region),''),trim(appellation)
      ORDER BY wines DESC,appellation ASC LIMIT 24`).bind(owner),
    c.env.DB.prepare(`SELECT wine_style style,COUNT(*) wines,COUNT(rating) rated_wines,AVG(rating) average_rating
      FROM wines WHERE owner_id=? AND wine_style IS NOT NULL AND trim(wine_style)<>''
      GROUP BY wine_style ORDER BY wines DESC,style ASC`).bind(owner),
    c.env.DB.prepare(`SELECT MAX(producer) producer,COUNT(*) wines,COUNT(rating) rated_wines,AVG(rating) average_rating,
      SUM(CASE WHEN favorite=1 THEN 1 ELSE 0 END) favorites FROM wines
      WHERE owner_id=? GROUP BY COALESCE(producer_id,lower(trim(producer)))
      HAVING COUNT(rating)>=2 ORDER BY average_rating DESC,wines DESC,producer ASC LIMIT 10`).bind(owner),
    c.env.DB.prepare(`SELECT upper(trim(currency)) currency,COUNT(*) wines,AVG(price) average_price,AVG(rating) average_rating
      FROM wines WHERE owner_id=? AND price IS NOT NULL AND currency IS NOT NULL AND trim(currency)<>''
      GROUP BY upper(trim(currency)) ORDER BY wines DESC,currency ASC LIMIT 8`).bind(owner),
    c.env.DB.prepare(`SELECT substr(COALESCE(NULLIF(tasting_date,''),created_at),1,4) year,COUNT(*) wines,
      COUNT(rating) rated_wines,AVG(rating) average_rating FROM wines WHERE owner_id=?
      GROUP BY substr(COALESCE(NULLIF(tasting_date,''),created_at),1,4) ORDER BY year DESC LIMIT 8`).bind(owner),
    c.env.DB.prepare(`SELECT s.structure_json,w.rating FROM wine_tasting_structures s
      JOIN wines w ON w.owner_id=s.owner_id AND w.id=s.wine_id
      WHERE s.owner_id=? AND s.structure_json<>'{}'`).bind(owner)
  ];
  const results=await c.env.DB.batch(statements);
  const first=<T extends Record<string,unknown>>(index:number)=>(results[index]?.results?.[0]??{}) as T;
  const rows=<T extends Record<string,unknown>>(index:number)=>(results[index]?.results??[]) as T[];
  const summary=first<Record<string,unknown>>(0),structured=first<Record<string,unknown>>(1);
  const mapRating=<T extends Record<string,unknown>>(row:T)=>({...row,averageRating:numberOrNull(row.average_rating)});
  const structures=rows<{structure_json:unknown;rating:unknown}>(9).flatMap(row=>{
    try{return [{structure:JSON.parse(String(row.structure_json||'{}')) as Record<string,string>,rating:numberOrNull(row.rating)}]}
    catch{return []}
  });
  return c.json({
    summary:{
      totalWines:Number(summary.total_wines??0),producers:Number(summary.producers??0),countries:Number(summary.countries??0),regions:Number(summary.regions??0),appellations:Number(summary.appellations??0),vintages:Number(summary.vintages??0),favorites:Number(summary.favorites??0),averageRating:numberOrNull(summary.average_rating),ratedWines:Number(summary.rated_wines??0),pricedWines:Number(summary.priced_wines??0),structuredTastings:Number(structured.structured_tastings??0)
    },
    countries:rows<Record<string,unknown>>(2).map(row=>({country:String(row.country),wines:Number(row.wines),producers:Number(row.producers),appellations:Number(row.appellations),averageRating:numberOrNull(row.average_rating)})),
    regions:rows<Record<string,unknown>>(3).map(row=>({country:row.country==null?null:String(row.country),region:String(row.region),wines:Number(row.wines),producers:Number(row.producers),appellations:Number(row.appellations),averageRating:numberOrNull(row.average_rating)})),
    appellations:rows<Record<string,unknown>>(4).map(row=>({country:row.country==null?null:String(row.country),region:row.region==null?null:String(row.region),appellation:String(row.appellation),wines:Number(row.wines),averageRating:numberOrNull(row.average_rating)})),
    styles:rows<Record<string,unknown>>(5).map(row=>({style:String(row.style),wines:Number(row.wines),ratedWines:Number(row.rated_wines),averageRating:numberOrNull(row.average_rating)})),
    producers:rows<Record<string,unknown>>(6).map(row=>({producer:String(row.producer),wines:Number(row.wines),ratedWines:Number(row.rated_wines),averageRating:numberOrNull(row.average_rating),favorites:Number(row.favorites??0)})),
    currencies:rows<Record<string,unknown>>(7).map(row=>({currency:String(row.currency),wines:Number(row.wines),averagePrice:numberOrNull(row.average_price),averageRating:numberOrNull(row.average_rating)})),
    years:rows<Record<string,unknown>>(8).map(row=>({year:String(row.year),wines:Number(row.wines),ratedWines:Number(row.rated_wines),averageRating:numberOrNull(row.average_rating)})),
    structures
  });
});

app.put('/api/wines/:id/favorite',async c=>{
  let owner:string;try{owner=await user(c)}catch{return c.json({error:'Unauthorized'},401)}
  const parsed=favoriteUpdateSchema.safeParse(await c.req.json().catch(()=>null));
  if(!parsed.success)return c.json({error:'Favorite must be true or false',issues:parsed.error.issues},400);
  const id=c.req.param('id'),exists=await c.env.DB.prepare('SELECT id FROM wines WHERE owner_id=? AND id=?').bind(owner,id).first<{id:string}>();
  if(!exists)return c.json({error:'Wine not found'},404);
  const stamp=new Date().toISOString();
  await c.env.DB.prepare('UPDATE wines SET favorite=?,updated_at=? WHERE owner_id=? AND id=?').bind(parsed.data.favorite?1:0,stamp,owner,id).run();
  return c.json({id,favorite:parsed.data.favorite});
});

app.get('/api/wines/:id',async c=>{
  const response=await layeredApp.fetch(c.req.raw,c.env,c.executionCtx);
  if(!response.ok)return response;
  let owner:string;try{owner=await user(c)}catch{return response}
  const meta=await c.env.DB.prepare('SELECT producer_id,favorite FROM wines WHERE owner_id=? AND id=?').bind(owner,c.req.param('id')).first<{producer_id:string|null;favorite:number|null}>();
  if(!meta)return response;
  try{
    const body=await response.clone().json() as Record<string,unknown>;
    const headers=new Headers(response.headers);headers.set('Content-Type','application/json; charset=utf-8');headers.delete('Content-Length');
    return new Response(JSON.stringify({...body,producerId:meta.producer_id??null,favorite:Boolean(meta.favorite)}),{status:response.status,statusText:response.statusText,headers});
  }catch{return response}
});

app.all('*',c=>layeredApp.fetch(c.req.raw,c.env,c.executionCtx));
export default app;
