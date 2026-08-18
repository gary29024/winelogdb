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

const parseJson=<T>(value:unknown,fallback:T):T=>{try{return JSON.parse(String(value)) as T}catch{return fallback}};

export function normalizeProducerAlias(value:string){
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[’'`]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
}

export function producerMatchKey(value:string){
  const words=normalizeProducerAlias(value).split(' ').filter(Boolean);
  while(words[0]&&['domaine','domaines','estate','winery'].includes(words[0]))words.shift();
  const suffixes=[['pere','et','fils'],['pere','and','fils'],['pere','fils']];
  for(const suffix of suffixes){
    if(words.length>=suffix.length&&suffix.every((word,i)=>words[words.length-suffix.length+i]===word)){words.splice(words.length-suffix.length);break}
  }
  return words.join(' ')||normalizeProducerAlias(value);
}

export async function ensureProducerEntity(db:D1Database,owner:string,name:string){
  const canonical=name.trim();
  if(!canonical)throw new Error('Producer name is required');
  const alias=normalizeProducerAlias(canonical),matchKey=producerMatchKey(canonical),now=new Date().toISOString();
  let found=await db.prepare('SELECT p.id,p.canonical_name FROM producer_aliases a JOIN producers p ON p.owner_id=a.owner_id AND p.id=a.producer_id WHERE a.owner_id=? AND a.normalized_alias=?').bind(owner,alias).first<{id:string;canonical_name:string}>();
  if(!found)found=await db.prepare('SELECT id,canonical_name FROM producers WHERE owner_id=? AND match_key=?').bind(owner,matchKey).first<{id:string;canonical_name:string}>();
  if(!found){
    const id=crypto.randomUUID();
    try{await db.prepare('INSERT INTO producers(id,owner_id,canonical_name,match_key,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(id,owner,canonical,matchKey,now,now).run();found={id,canonical_name:canonical}}
    catch{found=await db.prepare('SELECT id,canonical_name FROM producers WHERE owner_id=? AND match_key=?').bind(owner,matchKey).first<{id:string;canonical_name:string}>()??undefined}
  }
  if(!found)throw new Error('Could not resolve producer entity');
  await db.prepare('INSERT INTO producer_aliases(owner_id,normalized_alias,producer_id,display_alias,created_at) VALUES(?,?,?,?,?) ON CONFLICT(owner_id,normalized_alias) DO UPDATE SET producer_id=excluded.producer_id,display_alias=excluded.display_alias').bind(owner,alias,found.id,canonical,now).run();
  try{await db.prepare('UPDATE producers SET match_key=?,updated_at=? WHERE owner_id=? AND id=?').bind(matchKey,now,owner,found.id).run()}catch{}
  return found;
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
