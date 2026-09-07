import { normalizeProducerAlias } from '../producers/entities';
import { normalizeCuveeAlias } from '../cuvees/entities';
import type { CachedResearch,ResearchTarget } from './cache';

/** Exact, Unicode-preserving identity. Missing geography is deliberately not a wildcard. */
export function sharedSubjectKey(target:ResearchTarget):string|null{
 const s=target.subject,n=(v:unknown)=>normalizeCuveeAlias(String(v??''));
 const producer=normalizeProducerAlias(String(s.producer??'')),country=n(s.country),region=n(s.region),appellation=n(s.appellation);
 if(!country)return null;
 if(target.scope==='vintage_context')return s.vintage!=null&&(region||appellation)&&n(s.wineStyle)?JSON.stringify([country,region,appellation,n(s.wineStyle),s.vintage]):null;
 if(!producer)return null;
 if(target.scope==='producer')return JSON.stringify([producer,country]);
 if(!n(s.wineName)||!n(s.wineStyle))return null;
 // A missing vintage does not identify a bottling, disgorgement or NV release.
 // Stable producer/terroir facts remain reusable; exact-release facts need identity.
 if(target.scope==='wine_vintage'&&s.vintage==null)return null;
 return JSON.stringify([producer,country,region,appellation,n(s.wineName),n(s.wineStyle),target.scope==='wine_vintage'?(s.vintage??'NV'):null]);
}
export async function publishResearch(db:D1Database,owner:string,entry:CachedResearch){
 if(entry.contributorId&&entry.contributorId!==owner)return;
 const key=sharedSubjectKey(entry.target);if(!key)return;
 await db.prepare(`INSERT INTO reusable_research(contributor_id,subject_key,scope,entry_json,quality_version,researched_at) VALUES(?,?,?,?,1,?)
 ON CONFLICT(contributor_id,subject_key,scope) DO UPDATE SET entry_json=excluded.entry_json,quality_version=1,researched_at=excluded.researched_at`)
 .bind(owner,key,entry.target.scope,JSON.stringify({...entry,contributorId:owner}),entry.researchedAt).run();
}
export async function friendResearch(db:D1Database,owner:string,target:ResearchTarget){
 const key=sharedSubjectKey(target);if(!key)return [];
 const rows=await db.prepare(`SELECT r.entry_json FROM reusable_research r JOIN friendships f ON f.friend_id=r.contributor_id AND f.user_id=?
 JOIN app_users u ON u.id=r.contributor_id AND u.status='active' WHERE r.subject_key=? AND r.scope=? AND r.quality_version=1
 ORDER BY r.researched_at DESC,r.contributor_id LIMIT 25`).bind(owner,key,target.scope).all<{entry_json:string}>();
 return (rows.results??[]).flatMap(row=>{try{return [JSON.parse(row.entry_json) as CachedResearch]}catch{return []}});
}
