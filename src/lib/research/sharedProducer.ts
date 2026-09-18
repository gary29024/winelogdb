import { mapProducerRow,normalizeProducerAlias,producerMatchKey } from '../producers/entities';
import { sharedProducerId } from '../producers/sharedRef';
import { scopePassesQuality,type ResearchTarget } from './cache';
import { publishResearch } from './shared';
import { producerRangeAllowed } from '../producers/rangeAccess';

export function producerSubjectKey(row:Record<string,unknown>){const name=normalizeProducerAlias(String(row.canonical_name??'')),country=normalizeProducerAlias(String(row.home_country??''));return name&&country?JSON.stringify([name,country]):null}
export async function resolveVisibleSharedProducer(db:D1Database,viewer:string,name:string){
 const candidate=name.trim();if(!candidate)return null;
 const alias=normalizeProducerAlias(candidate),matchKey=producerMatchKey(candidate);
 const row=await db.prepare(`SELECT p.owner_id AS source_owner_id,p.id,p.canonical_name,p.researched_at,a.display_alias,
   coalesce(json_array_length(p.catalog_json),0) AS catalog_count,count(DISTINCT v.id) AS tasted_count
   FROM member_visible_wines v
   JOIN wines source_wine ON source_wine.owner_id=v.source_owner_id AND source_wine.id=v.id
   JOIN producers p ON p.owner_id=source_wine.owner_id AND p.id=source_wine.producer_id
   LEFT JOIN producer_aliases a ON a.owner_id=p.owner_id AND a.producer_id=p.id AND a.normalized_alias=?
   WHERE v.owner_id=? AND v.is_shared=1 AND (p.match_key=? OR a.normalized_alias=?)
   GROUP BY p.owner_id,p.id,a.display_alias
   ORDER BY p.researched_at IS NULL,p.researched_at DESC,p.canonical_name COLLATE NOCASE LIMIT 1`)
  .bind(alias,viewer,matchKey,alias).first<{source_owner_id:string;id:string;canonical_name:string;researched_at:string|null;display_alias:string|null;catalog_count:number;tasted_count:number}>();
 if(!row)return null;
 const canonical=String(row.canonical_name),canonicalAlias=normalizeProducerAlias(canonical);
 return {
  id:sharedProducerId(String(row.source_owner_id),String(row.id)),canonicalName:canonical,
  matchedName:row.display_alias||canonical,
  matchType:(canonicalAlias===alias?'canonical':row.display_alias?'alias':'normalized') as 'canonical'|'alias'|'normalized',
  researchedAt:row.researched_at?String(row.researched_at):null,catalogCount:Number(row.catalog_count)||0,tastedCount:Number(row.tasted_count)||0,
  sharedOnly:true
 };
}
export async function publishProducerResearch(db:D1Database,owner:string,producerId:string){
 const row=await db.prepare('SELECT * FROM producers WHERE owner_id=? AND id=?').bind(owner,producerId).first<Record<string,unknown>>();if(!row)return;
 const key=producerSubjectKey(row);if(!key||!row.researched_at)return;
 const entity=mapProducerRow(row),target:ResearchTarget={scope:'producer',cacheKey:key,subject:{producer:entity.canonicalName,country:entity.homeCountry}};
 const payload={producerDetails:entity.profile,producerWinemakingPractices:entity.winemakingPractices};
 if(!scopePassesQuality('producer',payload,target,entity.sources))return;
 const result={profile:entity.profile,winemakingPractices:entity.winemakingPractices,catalog:entity.catalog,sources:entity.sources,officialWebsiteUrl:entity.officialWebsiteUrl,instagramUrl:entity.instagramUrl,contactEmail:entity.contactEmail,contactPhone:entity.contactPhone,researchModel:entity.researchModel,researchedAt:entity.researchedAt};
 await db.prepare("INSERT INTO reusable_research(contributor_id,subject_key,scope,entry_json,quality_version,researched_at) VALUES(?,?,'producer_catalog',?,1,?) ON CONFLICT(contributor_id,subject_key,scope) DO UPDATE SET entry_json=excluded.entry_json,researched_at=excluded.researched_at").bind(owner,key,JSON.stringify(result),entity.researchedAt).run();
 await publishResearch(db,owner,{target,payload,sources:entity.sources,model:entity.researchModel||'producer',researchedAt:entity.researchedAt!});
}
export async function reusableProducer(db:D1Database,viewer:string,producerId:string){
 const withRange=await producerRangeAllowed(db,viewer);
 // Members do not have the wine range at all, so reuse hands back the profile,
 // practices and contacts only - never a contributor's catalogue.
 const range=<T extends object>(value:T)=>withRange?value:{...value,catalog:[] as unknown[]};
 const row=await db.prepare('SELECT * FROM producers WHERE owner_id=? AND id=?').bind(viewer,producerId).first<Record<string,unknown>>();if(!row)return null;
 const own=mapProducerRow(row),key=producerSubjectKey(row);
 if(key){
  const target:ResearchTarget={scope:'producer',cacheKey:key,subject:{producer:String(row.canonical_name),country:String(row.home_country)}};
  if(row.researched_at&&scopePassesQuality('producer',{producerDetails:own.profile,producerWinemakingPractices:own.winemakingPractices},target,own.sources))return range({profile:own.profile,winemakingPractices:own.winemakingPractices,catalog:own.catalog,sources:own.sources,researchedAt:own.researchedAt,researchContributorId:viewer});
  const results=await db.prepare(`SELECT r.entry_json,r.contributor_id FROM reusable_research r JOIN friendships f ON f.friend_id=r.contributor_id AND f.user_id=?
   JOIN app_users u ON u.id=r.contributor_id AND u.status='active' WHERE r.scope='producer_catalog' AND r.subject_key=? AND r.quality_version=1 ORDER BY r.researched_at DESC,r.contributor_id LIMIT 25`).bind(viewer,key).all<{entry_json:string;contributor_id:string}>();
  for(const result of results.results??[]){
   try{
    const data=JSON.parse(result.entry_json) as {profile:string;winemakingPractices:string;sources:Array<{title:string;url:string}>};
    if(!data||!scopePassesQuality('producer',{producerDetails:data.profile,producerWinemakingPractices:data.winemakingPractices},target,data.sources))continue;
    return range({...data,...own.profile?{profile:own.profile}:{},...own.winemakingPractices?{winemakingPractices:own.winemakingPractices}:{},researchContributorId:result.contributor_id});
   }catch{continue}
  }
 }
 // A shared-only producer page reads the source row directly. Once the recipient
 // logs their own bottle, their local producer shadows that page. Older research
 // may predate reusable_research, so keep the same visible profile as a fallback.
 const matchKey=String(row.match_key??'').trim();
 if(matchKey){
  const sources=await db.prepare(`SELECT p.* FROM member_visible_wines v
    JOIN wines source_wine ON source_wine.owner_id=v.source_owner_id AND source_wine.id=v.id
    JOIN producers p ON p.owner_id=source_wine.owner_id AND p.id=source_wine.producer_id
    WHERE v.owner_id=? AND v.is_shared=1 AND p.match_key=?
    GROUP BY p.owner_id,p.id
    ORDER BY coalesce(p.profile_researched_at,p.researched_at,p.updated_at) DESC LIMIT 25`).bind(viewer,matchKey).all<Record<string,unknown>>();
  for(const source of sources.results??[]){
   const inherited=mapProducerRow(source);
   const hasUsefulProfile=Boolean(inherited.profile.trim()||inherited.winemakingPractices.trim()||inherited.officialWebsiteUrl||inherited.instagramUrl||inherited.contactEmail||inherited.contactPhone||inherited.sources.length||inherited.contactSources.length);
   if(!hasUsefulProfile)continue;
   return range({
    profile:own.profile||inherited.profile,winemakingPractices:own.winemakingPractices||inherited.winemakingPractices,
    catalog:inherited.catalog,sources:inherited.sources,officialWebsiteUrl:inherited.officialWebsiteUrl,instagramUrl:inherited.instagramUrl,
    contactEmail:inherited.contactEmail,contactPhone:inherited.contactPhone,contactSources:inherited.contactSources,
    researchModel:inherited.researchModel,researchedAt:inherited.profileResearchedAt||inherited.researchedAt,
    researchContributorId:String(source.owner_id)
   });
  }
 }
 return null;
}
