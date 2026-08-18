export type ProducerEntity={
  id:string;
  canonicalName:string;
  homeCountry:string|null;
  homeRegion:string|null;
  homeLocality:string|null;
  profile:string;
  catalog:Array<{name:string;appellation?:string|null;classification?:string|null;style?:string|null;notes?:string|null}>;
  sources:Array<{title:string;url:string}>;
  researchModel:string|null;
  researchedAt:string|null;
};

export type ProducerResolution={
  id:string;
  canonicalName:string;
  matchedName:string;
  matchType:'canonical'|'alias'|'normalized';
  researchedAt:string|null;
  catalogCount:number;
  tastedCount:number;
};

const parseJson=<T>(value:unknown,fallback:T):T=>{try{return JSON.parse(String(value)) as T}catch{return fallback}};

export function normalizeProducerAlias(value:string){
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[’'`]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
}

// Automatic identity matching is intentionally conservative. Do not strip words such
// as Domaine, Chateau, Estate, Pere et Fils, etc.; those can distinguish real producers.
// Broader variants may be stored later as explicit aliases after they are verified.
export function producerMatchKey(value:string){
  return normalizeProducerAlias(value);
}

type ResolutionRow={id:string;canonical_name:string;display_alias?:string|null;researched_at:string|null;catalog_count:number;tasted_count:number};
const mapResolution=(row:ResolutionRow,matchType:ProducerResolution['matchType']):ProducerResolution=>({
  id:row.id,
  canonicalName:row.canonical_name,
  matchedName:row.display_alias||row.canonical_name,
  matchType,
  researchedAt:row.researched_at??null,
  catalogCount:Number(row.catalog_count)||0,
  tastedCount:Number(row.tasted_count)||0
});

export async function resolveExistingProducer(db:D1Database,owner:string,name:string):Promise<ProducerResolution|null>{
  const candidate=name.trim();
  if(!candidate)return null;
  const alias=normalizeProducerAlias(candidate),matchKey=producerMatchKey(candidate);
  const byAlias=await db.prepare(`SELECT p.id,p.canonical_name,p.researched_at,a.display_alias,
    coalesce(json_array_length(p.catalog_json),0) AS catalog_count,
    (SELECT count(*) FROM wines w WHERE w.owner_id=p.owner_id AND w.producer_id=p.id) AS tasted_count
    FROM producer_aliases a JOIN producers p ON p.owner_id=a.owner_id AND p.id=a.producer_id
    WHERE a.owner_id=? AND a.normalized_alias=? LIMIT 1`).bind(owner,alias).first<ResolutionRow>();
  if(byAlias)return mapResolution(byAlias,normalizeProducerAlias(byAlias.canonical_name)===alias?'canonical':'alias');
  const byMatch=await db.prepare(`SELECT p.id,p.canonical_name,p.researched_at,p.canonical_name AS display_alias,
    coalesce(json_array_length(p.catalog_json),0) AS catalog_count,
    (SELECT count(*) FROM wines w WHERE w.owner_id=p.owner_id AND w.producer_id=p.id) AS tasted_count
    FROM producers p WHERE p.owner_id=? AND p.match_key=? LIMIT 1`).bind(owner,matchKey).first<ResolutionRow>();
  if(byMatch)return mapResolution(byMatch,'normalized');
  const legacy=await db.prepare(`SELECT p.id,p.canonical_name,p.researched_at,p.canonical_name AS display_alias,
    coalesce(json_array_length(p.catalog_json),0) AS catalog_count,
    (SELECT count(*) FROM wines w WHERE w.owner_id=p.owner_id AND w.producer_id=p.id) AS tasted_count
    FROM producers p WHERE p.owner_id=? AND lower(trim(p.canonical_name))=lower(trim(?)) LIMIT 1`).bind(owner,candidate).first<ResolutionRow>();
  return legacy?mapResolution(legacy,'canonical'):null;
}

export async function ensureProducerEntity(db:D1Database,owner:string,name:string){
  const canonical=name.trim();
  if(!canonical)throw new Error('Producer name is required');
  const alias=normalizeProducerAlias(canonical),matchKey=producerMatchKey(canonical),now=new Date().toISOString();
  let found:{id:string;canonical_name:string}|null=(await db.prepare('SELECT p.id,p.canonical_name FROM producer_aliases a JOIN producers p ON p.owner_id=a.owner_id AND p.id=a.producer_id WHERE a.owner_id=? AND a.normalized_alias=?').bind(owner,alias).first<{id:string;canonical_name:string}>())??null;
  if(!found)found=(await db.prepare('SELECT id,canonical_name FROM producers WHERE owner_id=? AND match_key=?').bind(owner,matchKey).first<{id:string;canonical_name:string}>())??null;
  // Compatibility with migration 0005, whose initial backfill uses lower(trim(name)).
  if(!found)found=(await db.prepare('SELECT id,canonical_name FROM producers WHERE owner_id=? AND lower(trim(canonical_name))=lower(trim(?)) LIMIT 1').bind(owner,canonical).first<{id:string;canonical_name:string}>())??null;
  if(!found){
    const id=crypto.randomUUID();
    try{
      await db.prepare('INSERT INTO producers(id,owner_id,canonical_name,match_key,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(id,owner,canonical,matchKey,now,now).run();
      found={id,canonical_name:canonical};
    }catch{
      found=(await db.prepare('SELECT id,canonical_name FROM producers WHERE owner_id=? AND match_key=?').bind(owner,matchKey).first<{id:string;canonical_name:string}>())??null;
    }
  }
  if(!found)throw new Error('Could not resolve producer entity');
  await db.prepare('INSERT INTO producer_aliases(owner_id,normalized_alias,producer_id,display_alias,created_at) VALUES(?,?,?,?,?) ON CONFLICT(owner_id,normalized_alias) DO UPDATE SET producer_id=excluded.producer_id,display_alias=excluded.display_alias').bind(owner,alias,found.id,canonical,now).run();
  // Do not rewrite match_key here when a known alias is encountered. match_key follows
  // the user-selected primary/canonical name and only changes via setProducerPrimaryName.
  return found;
}

export async function setProducerPrimaryName(db:D1Database,owner:string,producerId:string,name:string){
  const requested=name.trim(),normalized=normalizeProducerAlias(requested);
  if(!requested||!normalized)throw new Error('Choose an existing producer name');
  const alias=await db.prepare('SELECT display_alias FROM producer_aliases WHERE owner_id=? AND producer_id=? AND normalized_alias=?').bind(owner,producerId,normalized).first<{display_alias:string}>();
  if(!alias)throw new Error('Primary name must be one of this producer’s existing names');
  const matchKey=producerMatchKey(alias.display_alias);
  const conflict=await db.prepare('SELECT id FROM producers WHERE owner_id=? AND match_key=? AND id<>? LIMIT 1').bind(owner,matchKey,producerId).first<{id:string}>();
  if(conflict)throw new Error('That primary name conflicts with another producer identity');
  const now=new Date().toISOString();
  await db.prepare('UPDATE producers SET canonical_name=?,match_key=?,updated_at=? WHERE owner_id=? AND id=?').bind(alias.display_alias,matchKey,now,owner,producerId).run();
  return {id:producerId,canonicalName:alias.display_alias};
}

export async function linkWineProducer(db:D1Database,owner:string,wineId:string,producerName:string){
  const entity=await ensureProducerEntity(db,owner,producerName);
  await db.prepare('UPDATE wines SET producer_id=? WHERE owner_id=? AND id=?').bind(entity.id,owner,wineId).run();
  return entity;
}

export async function ensureAllProducerLinks(db:D1Database,owner:string){
  const rows=await db.prepare('SELECT id,producer FROM wines WHERE owner_id=? AND (producer_id IS NULL OR producer_id=\'\')').bind(owner).all<{id:string;producer:string}>();
  for(const row of rows.results){if(row.producer?.trim())await linkWineProducer(db,owner,row.id,row.producer)}
}

export function mapProducerRow(row:Record<string,unknown>):ProducerEntity{
  return {
    id:String(row.id),canonicalName:String(row.canonical_name),homeCountry:row.home_country?String(row.home_country):null,homeRegion:row.home_region?String(row.home_region):null,homeLocality:row.home_locality?String(row.home_locality):null,
    profile:String(row.profile??''),catalog:parseJson(row.catalog_json,[]),sources:parseJson(row.sources_json,[]),researchModel:row.research_model?String(row.research_model):null,researchedAt:row.researched_at?String(row.researched_at):null
  };
}
