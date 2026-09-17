import { normalizeProducerAlias } from '../producers/entities';
import { normalizeCuveeAlias } from '../cuvees/entities';
import { producerNameVariants } from './aliasBridge';
import type { CachedResearch,ResearchScope,ResearchTarget } from './cache';

export type SharedKeySkip='no-producer'|'no-country'|'no-wine-name'|'no-style'|'no-place'|'no-vintage';
export type SharedKeyOutcome={keys:string[];skipped?:undefined}|{keys:[];skipped:SharedKeySkip};

/**
 * The identity a scope is shared under, or why it cannot be shared.
 *
 * Exact and Unicode-preserving: missing geography is deliberately not a wildcard,
 * because a shared pool serves a wrong answer to everyone rather than to one
 * reader. But the previous rule refused a key whenever the country or the wine
 * style was blank, and wine_style is optional throughout the schema - so reuse
 * silently did nothing for a large share of real rows and nothing recorded that
 * it had. The reason is now returned, and the two over-strict refusals are gone:
 *
 * - The producer scope is a fact about a producer, not about a place, so it is
 *   keyed on the name alone when no country is recorded. Where a country IS
 *   known the scope publishes under both keys, so a reader who knows the country
 *   and a reader who does not still meet on the same research.
 * - Terroir is a fact about a vineyard. Whether the row happens to say "red"
 *   does not change it, so style is no longer part of that key.
 *
 * Style still keys vintage_context and wine_vintage, where a vintage genuinely
 * differs by colour.
 */
export function sharedSubjectKeys(target:ResearchTarget):SharedKeyOutcome{
 // Reads target.identity, kept apart from target.subject precisely so the quality
 // gate's input and the sharing key cannot drift into each other. Callers that
 // build a target by hand fall back to subject.
 const s=(target.identity??target.subject) as Record<string,unknown>,n=(v:unknown)=>normalizeCuveeAlias(String(v??''));
 const producer=normalizeProducerAlias(String(s.producer??'')),country=n(s.country),region=n(s.region),appellation=n(s.appellation),style=n(s.wineStyle),wineName=n(s.wineName);

 if(target.scope==='vintage_context'){
  if(!country)return {keys:[],skipped:'no-country'};
  if(s.vintage==null)return {keys:[],skipped:'no-vintage'};
  if(!region&&!appellation)return {keys:[],skipped:'no-place'};
  if(!style)return {keys:[],skipped:'no-style'};
  return {keys:[JSON.stringify([country,region,appellation,style,s.vintage])]};
 }

 if(!producer)return {keys:[],skipped:'no-producer'};
 if(target.scope==='producer')return {keys:country?[JSON.stringify([producer,country]),JSON.stringify([producer])]:[JSON.stringify([producer])]};

 if(!country)return {keys:[],skipped:'no-country'};
 if(!wineName)return {keys:[],skipped:'no-wine-name'};
 if(target.scope==='terroir')return {keys:[JSON.stringify([producer,country,region,appellation,wineName,null,null])]};

 if(!style)return {keys:[],skipped:'no-style'};
 // A missing vintage does not identify a bottling, disgorgement or NV release.
 // Stable producer/terroir facts remain reusable; exact-release facts need identity.
 if(s.vintage==null)return {keys:[],skipped:'no-vintage'};
 return {keys:[JSON.stringify([producer,country,region,appellation,wineName,style,s.vintage])]};
}

/** The key a scope is read under: the most specific one it has. */
export function sharedSubjectKey(target:ResearchTarget):string|null{
 return sharedSubjectKeys(target).keys[0]??null;
}

export async function publishResearch(db:D1Database,owner:string,entry:CachedResearch){
 if(entry.contributorId&&entry.contributorId!==owner)return;
 const {keys}=sharedSubjectKeys(entry.target);if(!keys.length)return;
 const payload=JSON.stringify({...entry,contributorId:owner});
 for(const key of keys)await db.prepare(`INSERT INTO reusable_research(contributor_id,subject_key,scope,entry_json,quality_version,researched_at) VALUES(?,?,?,?,1,?)
 ON CONFLICT(contributor_id,subject_key,scope) DO UPDATE SET entry_json=excluded.entry_json,quality_version=1,researched_at=excluded.researched_at`)
 .bind(owner,key,entry.target.scope,payload,entry.researchedAt).run();
}
/**
 * Friends' research for a whole wine in one query.
 *
 * This used to run one lookup per missing scope, and - once alias variants
 * arrived - one per key inside that, each awaited in turn. A wine with four
 * missing scopes could therefore spend eight sequential round trips on a page
 * view, plus one repeat read of the same producer's aliases per scope.
 *
 * Every scope of a wine shares its producer, so the alias read happens once and
 * all scope/key pairs go up together. Results are ranked back into each scope's
 * own key order, so the most specific key still wins - the country-qualified
 * producer key is preferred over the bare-name one that exists to reach readers
 * with no country recorded.
 */
export async function friendResearchBatch(db:D1Database,owner:string,targets:ResearchTarget[]):Promise<Map<ResearchScope,CachedResearch[]>>{
 const found=new Map<ResearchScope,CachedResearch[]>();
 if(!targets.length)return found;
 const identity=(targets[0].identity??targets[0].subject) as Record<string,unknown>;
 const variants=await producerNameVariants(db,owner,String(identity.producer??''));
 const keysByScope=new Map<ResearchScope,string[]>();
 for(const target of targets){
  const own=(target.identity??target.subject) as Record<string,unknown>;
  const keys=variants.length>1
   ?[...new Set(variants.flatMap(name=>sharedSubjectKeys({...target,identity:{...own,producer:name} as ResearchTarget['identity']}).keys))]
   :sharedSubjectKeys(target).keys;
  if(keys.length)keysByScope.set(target.scope,keys);
 }
 const scopes=[...keysByScope.keys()],allKeys=[...new Set([...keysByScope.values()].flat())];
 if(!scopes.length||!allKeys.length)return found;
 // Filtering on subject_key first uses idx_reusable_research_subject; the scope
 // filter then costs nothing, and a key from one scope cannot collide with
 // another's - they are tuples of different arity.
 const rows=await db.prepare(`SELECT r.scope,r.subject_key,r.entry_json FROM reusable_research r
  JOIN friendships f ON f.friend_id=r.contributor_id AND f.user_id=?
  JOIN app_users u ON u.id=r.contributor_id AND u.status='active'
  WHERE r.subject_key IN (${allKeys.map(()=>'?').join(',')}) AND r.scope IN (${scopes.map(()=>'?').join(',')}) AND r.quality_version=1
  ORDER BY r.researched_at DESC,r.contributor_id LIMIT 100`).bind(owner,...allKeys,...scopes).all<{scope:ResearchScope;subject_key:string;entry_json:string}>();
 for(const [scope,order] of keysByScope){
  const entries=(rows.results??[])
   .filter(row=>row.scope===scope&&order.includes(row.subject_key))
   // Stable sort, so researched_at DESC still decides between two rows on the same key.
   .sort((a,b)=>order.indexOf(a.subject_key)-order.indexOf(b.subject_key))
   .flatMap(row=>{try{return [JSON.parse(row.entry_json) as CachedResearch]}catch{return []}});
  if(entries.length)found.set(scope,entries);
 }
 return found;
}

/** One scope's worth of the above, for callers that only have a single target. */
export async function friendResearch(db:D1Database,owner:string,target:ResearchTarget){
 return (await friendResearchBatch(db,owner,[target])).get(target.scope)??[];
}
