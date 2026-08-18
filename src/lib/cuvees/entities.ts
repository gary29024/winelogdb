export type CuveeEntity={
  id:string;
  producerId:string;
  canonicalName:string;
  appellation:string|null;
  wineStyle:string|null;
  catalogBacked:boolean;
};

export type CuveeResolution=CuveeEntity&{
  matchedName:string;
  matchType:'canonical'|'alias'|'structured';
  tastedCount:number;
  vintages:number[];
};

type CatalogWine={name?:unknown;category?:unknown;appellation?:unknown;style?:unknown};
type CuveeRow={id:string;producer_id:string;canonical_name:string;appellation:string|null;wine_style:string|null;catalog_backed:number;display_alias?:string|null};
const parseJson=<T>(value:unknown,fallback:T):T=>{try{return JSON.parse(String(value)) as T}catch{return fallback}};
const escapeRegExp=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

export function normalizeCuveeAlias(value:string){
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/\b1(?:er|ère|ere)\b/g,'premier')
    .replace(/&/g,' and ').replace(/[’'`]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
}

export function stripKnownProducerPrefix(value:string,producerNames:string[]){
  const input=value.trim();
  for(const producer of [...new Set(producerNames.map(x=>x.trim()).filter(Boolean))].sort((a,b)=>b.length-a.length)){
    const pattern=new RegExp(`^${escapeRegExp(producer)}(?:\\s+|\\s*[-–—:]\\s*)`,'i');
    const stripped=input.replace(pattern,'').trim();
    if(stripped&&stripped!==input)return stripped;
  }
  return input;
}

export function cuveeSignature(name:string,appellation:string|null|undefined,producerNames:string[]=[]){
  const stripped=stripKnownProducerPrefix(name,producerNames);
  const normalized=normalizeCuveeAlias(`${stripped} ${appellation??''}`);
  const tokens=normalized.split(/\s+/).filter(Boolean).filter(token=>{
    if(/^\d{4}$/.test(token))return false;
    // Monopole describes ownership of the same named site rather than a separate vintage/cuvee identity.
    return !['monopole','aoc'].includes(token);
  });
  return [...new Set(tokens)].sort().join(' ');
}

async function producerNames(db:D1Database,owner:string,producerId:string){
  const [producer,aliases]=await Promise.all([
    db.prepare('SELECT canonical_name FROM producers WHERE owner_id=? AND id=?').bind(owner,producerId).first<{canonical_name:string}>(),
    db.prepare('SELECT display_alias FROM producer_aliases WHERE owner_id=? AND producer_id=?').bind(owner,producerId).all<{display_alias:string}>()
  ]);
  return [producer?.canonical_name??'',...aliases.results.map(x=>x.display_alias)].filter(Boolean);
}

const styleCompatible=(stored:string|null|undefined,incoming:string|null|undefined)=>!stored||!incoming||normalizeCuveeAlias(stored)===normalizeCuveeAlias(incoming);
const mapEntity=(row:CuveeRow):CuveeEntity=>({id:row.id,producerId:row.producer_id,canonicalName:row.canonical_name,appellation:row.appellation??null,wineStyle:row.wine_style??null,catalogBacked:Boolean(row.catalog_backed)});

export async function resolveExistingCuvee(db:D1Database,owner:string,producerId:string,name:string,appellation?:string|null,wineStyle?:string|null):Promise<CuveeResolution|null>{
  const candidate=name.trim();if(!candidate)return null;
  const names=await producerNames(db,owner,producerId),cleaned=stripKnownProducerPrefix(candidate,names),aliasKey=normalizeCuveeAlias(cleaned);
  const byAlias=await db.prepare(`SELECT c.*,a.display_alias FROM cuvee_aliases a JOIN cuvees c ON c.owner_id=a.owner_id AND c.id=a.cuvee_id
    WHERE a.owner_id=? AND a.producer_id=? AND a.normalized_alias=? LIMIT 1`).bind(owner,producerId,aliasKey).first<CuveeRow>();
  let row:CuveeRow|null=byAlias??null,matchType:CuveeResolution['matchType']='alias';
  if(!row){
    const signature=cuveeSignature(cleaned,appellation,names);
    row=(await db.prepare('SELECT * FROM cuvees WHERE owner_id=? AND producer_id=? AND signature_key=? LIMIT 1').bind(owner,producerId,signature).first<CuveeRow>())??null;
    matchType='structured';
  }
  if(!row||!styleCompatible(row.wine_style,wineStyle))return null;
  if(normalizeCuveeAlias(row.canonical_name)===aliasKey)matchType='canonical';
  const vintages=await db.prepare('SELECT DISTINCT vintage FROM wines WHERE owner_id=? AND cuvee_id=? AND vintage IS NOT NULL ORDER BY vintage DESC').bind(owner,row.id).all<{vintage:number}>();
  const count=await db.prepare('SELECT count(*) AS count FROM wines WHERE owner_id=? AND cuvee_id=?').bind(owner,row.id).first<{count:number}>();
  return {...mapEntity(row),matchedName:row.display_alias||cleaned,matchType,tastedCount:Number(count?.count)||0,vintages:vintages.results.map(x=>Number(x.vintage)).filter(Number.isFinite)};
}

export async function ensureCuveeEntity(db:D1Database,owner:string,producerId:string,name:string,appellation?:string|null,wineStyle?:string|null,catalogBacked=false){
  const raw=name.trim();if(!raw)throw new Error('Wine name is required');
  const names=await producerNames(db,owner,producerId),canonical=stripKnownProducerPrefix(raw,names),aliasKey=normalizeCuveeAlias(canonical),signature=cuveeSignature(canonical,appellation,names),now=new Date().toISOString();
  let row=(await db.prepare(`SELECT c.* FROM cuvee_aliases a JOIN cuvees c ON c.owner_id=a.owner_id AND c.id=a.cuvee_id
    WHERE a.owner_id=? AND a.producer_id=? AND a.normalized_alias=? LIMIT 1`).bind(owner,producerId,aliasKey).first<CuveeRow>())??null;
  if(!row)row=(await db.prepare('SELECT * FROM cuvees WHERE owner_id=? AND producer_id=? AND signature_key=? LIMIT 1').bind(owner,producerId,signature).first<CuveeRow>())??null;
  if(row&&!styleCompatible(row.wine_style,wineStyle))row=null;
  if(!row){
    const id=crypto.randomUUID();
    try{
      await db.prepare(`INSERT INTO cuvees(id,owner_id,producer_id,canonical_name,signature_key,appellation,wine_style,catalog_backed,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(id,owner,producerId,canonical,signature,appellation??null,wineStyle??null,catalogBacked?1:0,now,now).run();
      row={id,producer_id:producerId,canonical_name:canonical,appellation:appellation??null,wine_style:wineStyle??null,catalog_backed:catalogBacked?1:0};
    }catch{
      row=(await db.prepare('SELECT * FROM cuvees WHERE owner_id=? AND producer_id=? AND signature_key=? LIMIT 1').bind(owner,producerId,signature).first<CuveeRow>())??null;
    }
  }
  if(!row)throw new Error('Could not resolve cuvee entity');
  if(catalogBacked&&!row.catalog_backed){
    await db.prepare('UPDATE cuvees SET canonical_name=?,appellation=coalesce(?,appellation),wine_style=coalesce(?,wine_style),catalog_backed=1,updated_at=? WHERE owner_id=? AND id=?')
      .bind(canonical,appellation??null,wineStyle??null,now,owner,row.id).run();
    await db.prepare('UPDATE wines SET wine_name=? WHERE owner_id=? AND cuvee_id=?').bind(canonical,owner,row.id).run();
    row={...row,canonical_name:canonical,appellation:appellation??row.appellation,wine_style:wineStyle??row.wine_style,catalog_backed:1};
  }
  for(const alias of new Set([raw,canonical])){
    const normalized=normalizeCuveeAlias(stripKnownProducerPrefix(alias,names));if(!normalized)continue;
    await db.prepare(`INSERT INTO cuvee_aliases(owner_id,producer_id,normalized_alias,cuvee_id,display_alias,created_at) VALUES(?,?,?,?,?,?)
      ON CONFLICT(owner_id,producer_id,normalized_alias) DO UPDATE SET cuvee_id=excluded.cuvee_id,display_alias=excluded.display_alias`)
      .bind(owner,producerId,normalized,row.id,alias,now).run();
  }
  return mapEntity(row);
}

export async function syncProducerCatalogCuvees(db:D1Database,owner:string,producerId:string){
  const row=await db.prepare('SELECT catalog_json FROM producers WHERE owner_id=? AND id=?').bind(owner,producerId).first<{catalog_json:string}>();
  const catalog=parseJson<CatalogWine[]>(row?.catalog_json,[]);
  for(const item of catalog){
    const name=typeof item.name==='string'?item.name.trim():'';if(!name)continue;
    const appellation=typeof item.appellation==='string'&&item.appellation.trim()?item.appellation.trim():null;
    const style=typeof item.category==='string'&&item.category.trim()?item.category.trim():typeof item.style==='string'&&item.style.trim()?item.style.trim():null;
    await ensureCuveeEntity(db,owner,producerId,name,appellation,style,true);
  }
}

export async function linkWineCuvee(db:D1Database,owner:string,wineId:string){
  const wine=await db.prepare(`SELECT id,producer_id,wine_name,recognized_wine_name,appellation,wine_style FROM wines WHERE owner_id=? AND id=?`).bind(owner,wineId).first<{id:string;producer_id:string|null;wine_name:string;recognized_wine_name:string|null;appellation:string|null;wine_style:string|null}>();
  if(!wine?.producer_id||!wine.wine_name?.trim())return null;
  const sourceName=wine.recognized_wine_name?.trim()||wine.wine_name.trim();
  const entity=await ensureCuveeEntity(db,owner,wine.producer_id,sourceName,wine.appellation,wine.wine_style,false);
  await db.prepare(`UPDATE wines SET cuvee_id=?,recognized_wine_name=coalesce(recognized_wine_name,?),wine_name=? WHERE owner_id=? AND id=?`)
    .bind(entity.id,wine.wine_name,entity.canonicalName,owner,wineId).run();
  return entity;
}

export async function ensureAllCuveeLinksForProducer(db:D1Database,owner:string,producerId:string){
  await syncProducerCatalogCuvees(db,owner,producerId);
  const rows=await db.prepare('SELECT id FROM wines WHERE owner_id=? AND producer_id=? ORDER BY created_at ASC').bind(owner,producerId).all<{id:string}>();
  for(const row of rows.results)await linkWineCuvee(db,owner,row.id);
}
