import { mapProducerRow,normalizeProducerAlias } from '../producers/entities';
import { scopePassesQuality,type ResearchTarget } from './cache';
import { publishResearch } from './shared';

export function producerSubjectKey(row:Record<string,unknown>){const name=normalizeProducerAlias(String(row.canonical_name??'')),country=normalizeProducerAlias(String(row.home_country??''));return name&&country?JSON.stringify([name,country]):null}
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
 const row=await db.prepare('SELECT * FROM producers WHERE owner_id=? AND id=?').bind(viewer,producerId).first<Record<string,unknown>>();if(!row)return null;
 const key=producerSubjectKey(row);if(!key)return null;
 const own=mapProducerRow(row),target:ResearchTarget={scope:'producer',cacheKey:key,subject:{producer:String(row.canonical_name),country:String(row.home_country)}};
 if(row.researched_at&&scopePassesQuality('producer',{producerDetails:own.profile,producerWinemakingPractices:own.winemakingPractices},target,own.sources))return {profile:own.profile,winemakingPractices:own.winemakingPractices,catalog:own.catalog,sources:own.sources,researchedAt:own.researchedAt,researchContributorId:viewer};
 const results=await db.prepare(`SELECT r.entry_json,r.contributor_id FROM reusable_research r JOIN friendships f ON f.friend_id=r.contributor_id AND f.user_id=?
 JOIN app_users u ON u.id=r.contributor_id AND u.status='active' WHERE r.scope='producer_catalog' AND r.subject_key=? AND r.quality_version=1 ORDER BY r.researched_at DESC,r.contributor_id LIMIT 25`).bind(viewer,key).all<{entry_json:string;contributor_id:string}>();
 for(const result of results.results??[]){
  try{
   const data=JSON.parse(result.entry_json) as {profile:string;winemakingPractices:string;sources:Array<{title:string;url:string}>};
   if(!data||!scopePassesQuality('producer',{producerDetails:data.profile,producerWinemakingPractices:data.winemakingPractices},target,data.sources))continue;
   return {...data,...own.profile?{profile:own.profile}:{},...own.winemakingPractices?{winemakingPractices:own.winemakingPractices}:{},researchContributorId:result.contributor_id};
  }catch{continue}
 }
 return null;
}
