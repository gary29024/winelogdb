import { canonicalCountryName } from '../wine/canonicalize';

export type ProducerEntity={
  id:string;
  canonicalName:string;
  homeCountry:string|null;
  homeRegion:string|null;
  homeLocality:string|null;
  profile:string;
  winemakingPractices:string;
  catalog:Array<{name:string;category?:'red'|'white'|'rose'|'sparkling'|'dessert'|'fortified'|'orange'|'other';appellation?:string|null;classification?:string|null;style?:string|null;notes?:string|null}>;
  sources:Array<{title:string;url:string}>;
  officialWebsiteUrl:string|null;
  instagramUrl:string|null;
  contactEmail:string|null;
  contactPhone:string|null;
  contactSources:Array<{title:string;url:string}>;
  heroImageAvailable:boolean;
  heroImageSourceUrl:string|null;
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

/**
 * The identity key for a producer name.
 *
 * Letters and digits from any script, not only ASCII. Keeping `[a-z0-9]` alone
 * mapped every name written entirely in Chinese, Japanese, Korean, Cyrillic,
 * Greek, Hebrew or Arabic to the empty string, so the first such producer
 * claimed the empty key and every later one silently resolved to it: 赤恋葡萄酒
 * and 联合丹麓酒庄 became one producer. Latin names are unchanged - the NFD pass
 * above has already removed the accents, and \p{L} covers a-z.
 *
 * The fallback keeps a name made only of punctuation distinct from another one;
 * an empty key must never be something two different names can share.
 */
export function normalizeProducerAlias(value:string){
  const key=value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[’'`]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  return key||value.trim().toLowerCase();
}

// Automatic identity matching is intentionally conservative. Do not strip words such
// as Domaine, Chateau, Estate, Pere et Fils, etc.; those can distinguish real producers.
// Broader variants may be stored later as explicit aliases after they are verified.
export function producerMatchKey(value:string){
  return normalizeProducerAlias(value);
}

export function shouldSeedProducerCountry(homeCountry:string|null|undefined,researchedAt:string|null|undefined,wineCountry:string|null|undefined){
  return !String(homeCountry??'').trim()&&!String(researchedAt??'').trim()&&Boolean(String(wineCountry??'').trim());
}

/**
 * Which country a producer is filed under, given the countries of its wines.
 * The commonest wins, so one mis-typed bottle does not move a domaine, and ties
 * break alphabetically so the answer never depends on row order. Names are
 * canonicalised first: England and the United Kingdom are one place, and a
 * producer split across the two spellings has all its wines in one country.
 */
export function pickProducerHomeCountry(rows:readonly {country:string|null;wines:number}[]):string|null{
  const tally=new Map<string,number>();
  for(const row of rows){
    const name=canonicalCountryName(String(row.country??'').trim());
    if(name)tally.set(name,(tally.get(name)??0)+(Number(row.wines)||0));
  }
  if(!tally.size)return null;
  return [...tally.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0][0];
}

export type ProducerSuggestion={id:string;canonicalName:string;tastedCount:number};
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

/**
 * A house the reader almost certainly means, when nothing matched exactly.
 *
 * The exact resolvers above are deliberately conservative - "Domaine", "Château"
 * and "Pere et Fils" can be the whole difference between two real producers, so
 * they are never stripped. That is right for matching automatically and wrong
 * for saying nothing at all: a label read as "Antinori" against a library
 * holding "Marchesi Antinori" silently makes a second producer, and the two are
 * only ever joined by hand afterwards.
 *
 * So this proposes rather than decides. One name's words being wholly contained
 * in another's is the signal, and it has to point at exactly one producer: a
 * candidate that fits two houses is precisely the case where guessing is worst.
 */
const GENERIC_PRODUCER_WORDS=new Set(['chateau','domaine','tenuta','castello','weingut','bodega','bodegas','quinta','clos','maison','cantina','azienda','agricola','estate','winery','vineyard','vineyards','cellars','fattoria','marchesi','famille','family','de','del','della','dell','di','du','la','le','les','el','and']);

/**
 * The words of a name, with an elided article counted as its own.
 *
 * normalizeProducerAlias drops an apostrophe without putting anything in its
 * place, which is right for a key - "d'Yquem" and "dYquem" must land together -
 * and wrong for asking which words a name is made of: it turns "Tenuta
 * dell'Ornellaia" into two words, one of them "dellornellaia", so the Ornellaia
 * inside it is invisible. Split here, and only here.
 */
const producerWords=(value:string)=>new Set(normalizeProducerAlias(value.replace(/[’'`]/g,' ')).split(' ').filter(Boolean));
const contains=(outer:Set<string>,inner:Set<string>)=>[...inner].every(word=>outer.has(word));

export async function suggestExistingProducer(db:D1Database,owner:string,name:string):Promise<ProducerSuggestion|null>{
  const words=producerWords(name);
  // A bare "Château" belongs to every house that has one; a name that is only
  // generic words carries no signal to contain anything by.
  if(!words.size||[...words].every(word=>GENERIC_PRODUCER_WORDS.has(word)))return null;
  const {results}=await db.prepare(`SELECT p.id,p.canonical_name,
    (SELECT count(*) FROM wines w WHERE w.owner_id=p.owner_id AND w.producer_id=p.id) AS tasted_count
    FROM producers p WHERE p.owner_id=?`).bind(owner).all<{id:string;canonical_name:string;tasted_count:number}>();
  const hits=(results??[]).filter(row=>{
    const stored=producerWords(row.canonical_name);
    if(!stored.size||stored.size===words.size)return false;
    return contains(stored,words)||contains(words,stored);
  });
  if(hits.length!==1)return null;
  return {id:hits[0].id,canonicalName:hits[0].canonical_name,tastedCount:Number(hits[0].tasted_count)||0};
}

/**
 * A first wine's country, taken as the producer's home while nothing better is
 * known. It only fills a blank: at this point the wine is not linked yet, so
 * there is nothing to count, and a producer that has been researched has a real
 * answer that a wine's country must not overwrite.
 */
export async function seedProducerCountryFromWine(db:D1Database,owner:string,producerId:string,wineCountry?:string|null){
  const country=canonicalCountryName(String(wineCountry??'').trim())??'';
  if(!country)return false;
  const result=await db.prepare(`UPDATE producers SET home_country=?,updated_at=?
    WHERE owner_id=? AND id=? AND researched_at IS NULL AND trim(coalesce(home_country,''))=''`)
    .bind(country,new Date().toISOString(),owner,producerId).run();
  return Boolean(result.meta.changes);
}

/**
 * Re-derive an unresearched producer's home country from the wines actually
 * filed under it, so correcting a wine's country moves the producer with it.
 *
 * The seed above fires once, on the first wine, and only into a blank - which
 * left the producers page showing wherever a producer was first seen, for good.
 * Amending the wine changed `wines.country` and nothing else, because
 * ensureWineIdentity returns early for a wine that already has both links, so
 * the correction had nowhere to land.
 *
 * The commonest country among the producer's wines wins rather than the newest,
 * so one mis-typed bottle does not move a domaine; ties break alphabetically so
 * the answer does not depend on row order. Research still outranks all of it.
 */
export async function refreshProducerHomeCountry(db:D1Database,owner:string,producerId:string){
  const producer=await db.prepare(`SELECT home_country,researched_at FROM producers WHERE owner_id=? AND id=?`)
    .bind(owner,producerId).first<{home_country:string|null;researched_at:string|null}>();
  if(!producer||producer.researched_at)return false;
  const {results}=await db.prepare(`SELECT trim(country) country,count(*) wines FROM wines
    WHERE owner_id=? AND producer_id=? AND trim(coalesce(country,''))<>'' GROUP BY trim(country)`)
    .bind(owner,producerId).all<{country:string;wines:number}>();
  const country=pickProducerHomeCountry(results??[]);
  if(!country||country===(producer.home_country??''))return false;
  await db.prepare('UPDATE producers SET home_country=?,updated_at=? WHERE owner_id=? AND id=? AND researched_at IS NULL')
    .bind(country,new Date().toISOString(),owner,producerId).run();
  return true;
}

export async function ensureProducerEntity(db:D1Database,owner:string,name:string,provisionalCountry?:string|null){
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
  // Guard the conflict branch: re-resolving a producer that is already correctly
  // aliased is a read-path operation and must not charge a D1 row write.
  await db.prepare('INSERT INTO producer_aliases(owner_id,normalized_alias,producer_id,display_alias,created_at) VALUES(?,?,?,?,?) ON CONFLICT(owner_id,normalized_alias) DO UPDATE SET producer_id=excluded.producer_id,display_alias=excluded.display_alias WHERE producer_aliases.producer_id<>excluded.producer_id OR producer_aliases.display_alias<>excluded.display_alias').bind(owner,alias,found.id,canonical,now).run();
  await seedProducerCountryFromWine(db,owner,found.id,provisionalCountry);
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

export async function linkWineProducer(db:D1Database,owner:string,wineId:string,producerName:string,wineCountry?:string|null){
  const entity=await ensureProducerEntity(db,owner,producerName,wineCountry);
  // Only write when the link actually changes; every wines UPDATE also bumps the
  // achievement cache revision and forces a full progress recompute.
  await db.prepare('UPDATE wines SET producer_id=? WHERE owner_id=? AND id=? AND coalesce(producer_id,\'\')<>?').bind(entity.id,owner,wineId,entity.id).run();
  return entity;
}

export async function ensureAllProducerLinks(db:D1Database,owner:string){
  const rows=await db.prepare('SELECT id,producer,country FROM wines WHERE owner_id=? AND (producer_id IS NULL OR producer_id=\'\')').bind(owner).all<{id:string;producer:string;country:string|null}>();
  for(const row of rows.results){if(row.producer?.trim())await linkWineProducer(db,owner,row.id,row.producer,row.country)}
}

export function mapProducerRow(row:Record<string,unknown>):ProducerEntity{
  return {
    id:String(row.id),canonicalName:String(row.canonical_name),homeCountry:row.home_country?canonicalCountryName(String(row.home_country))??null:null,homeRegion:row.home_region?String(row.home_region):null,homeLocality:row.home_locality?String(row.home_locality):null,
    profile:String(row.profile??''),winemakingPractices:String(row.winemaking_practices??''),catalog:parseJson(row.catalog_json,[]),sources:parseJson(row.sources_json,[]),officialWebsiteUrl:row.official_website_url?String(row.official_website_url):null,
    instagramUrl:row.instagram_url?String(row.instagram_url):null,contactEmail:row.contact_email?String(row.contact_email):null,contactPhone:row.contact_phone?String(row.contact_phone):null,contactSources:parseJson(row.contact_sources_json,[]),
    heroImageAvailable:Boolean(row.hero_image_object_key),heroImageSourceUrl:row.hero_image_source_url?String(row.hero_image_source_url):null,
    researchModel:row.research_model?String(row.research_model):null,researchedAt:row.researched_at?String(row.researched_at):null
  };
}