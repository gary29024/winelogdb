import { ApiError,json,ownerOnly,stamp,type IdentityEnv,type Member } from './common';
import { deepSearchSchema } from '../../src/lib/db/schema';
import { loadResearchCache,splitDeepSearchResult,upsertResearchCache } from '../../src/lib/research/cache';
import { publishResearch } from '../../src/lib/research/shared';
import { wineTargets } from './credits';
import { publishProducerResearch } from '../../src/lib/research/sharedProducer';

/** Bounded, resumable owner tasks; never inventory the bucket on ordinary reads. */
export async function rolloutRoute(request:Request,env:IdentityEnv&{WINE_IMAGES:R2Bucket},member:Member):Promise<Response|null>{
 const path=new URL(request.url).pathname;if(!path.startsWith('/api/admin/rollout/'))return null;ownerOnly(member);
 if(request.method!=='POST')throw new ApiError(405,'Use POST');
 if(path==='/api/admin/rollout/storage'){
  const state=await env.DB.prepare("SELECT value FROM rollout_state WHERE name='storage_cursor'").first<{value:string}>();
  const listing=await env.WINE_IMAGES.list({limit:100,...(state?.value?{cursor:state.value}:{})});
  if(listing.objects.length)await env.DB.batch(listing.objects.map(object=>{
   const owner=object.key.match(/^owners\/([^/]+)\//)?.[1]??object.key.match(/^shared\/([^/]+)\//)?.[1]??'owner';
   return env.DB.prepare('INSERT INTO stored_objects(object_key,owner_id,byte_size,updated_at) VALUES(?,?,?,?) ON CONFLICT(object_key) DO UPDATE SET byte_size=excluded.byte_size,updated_at=excluded.updated_at').bind(object.key,owner,object.size,stamp());
  }));
  await env.DB.prepare("INSERT INTO rollout_state(name,value) VALUES('storage_cursor',?) ON CONFLICT(name) DO UPDATE SET value=excluded.value").bind(listing.truncated?listing.cursor:'').run();
  if(!listing.truncated)await env.DB.prepare("INSERT INTO rollout_state(name,value) VALUES('storage_inventory','complete') ON CONFLICT(name) DO UPDATE SET value='complete'").run();
  return json({complete:!listing.truncated,processed:listing.objects.length});
 }
 if(path==='/api/admin/rollout/research'){
  const state=await env.DB.prepare("SELECT value FROM rollout_state WHERE name='research_cursor'").first<{value:string}>();
  const rows=await env.DB.prepare('SELECT * FROM wines WHERE id>? ORDER BY id LIMIT 2').bind(state?.value??'').all<Record<string,unknown>>();
  for(const row of rows.results){
   const owner=String(row.owner_id),targets=wineTargets(row),cache=await loadResearchCache(env.DB,owner,targets);
   if(row.producer_id)await publishProducerResearch(env.DB,owner,String(row.producer_id));
   if(row.deep_search_json){const parsed=deepSearchSchema.safeParse(JSON.parse(String(row.deep_search_json)));if(parsed.success)for(const entry of splitDeepSearchResult(parsed.data,targets))if(!cache.has(entry.target.scope)){await upsertResearchCache(env.DB,owner,entry);cache.set(entry.target.scope,entry)}}
   for(const target of targets){const entry=cache.get(target.scope);if(entry)await publishResearch(env.DB,owner,{...entry,target})}
  }
  if(rows.results.length)await env.DB.prepare("INSERT INTO rollout_state(name,value) VALUES('research_cursor',?) ON CONFLICT(name) DO UPDATE SET value=excluded.value").bind(String(rows.results.at(-1)!.id)).run();
  let complete=false,producerCount=0;
  if(rows.results.length<2){
   const cursor=await env.DB.prepare("SELECT value FROM rollout_state WHERE name='producer_research_cursor'").first<{value:string}>();
   const producers=await env.DB.prepare('SELECT id,owner_id FROM producers WHERE id>? ORDER BY id LIMIT 2').bind(cursor?.value??'').all<{id:string;owner_id:string}>();
   for(const producer of producers.results)await publishProducerResearch(env.DB,producer.owner_id,producer.id);
   producerCount=producers.results.length;complete=producerCount<2;
   if(producerCount)await env.DB.prepare("INSERT INTO rollout_state(name,value) VALUES('producer_research_cursor',?) ON CONFLICT(name) DO UPDATE SET value=excluded.value").bind(producers.results.at(-1)!.id).run();
   if(complete)await env.DB.prepare("INSERT INTO rollout_state(name,value) VALUES('research_index','complete') ON CONFLICT(name) DO UPDATE SET value='complete'").run();
  }
  return json({complete,processed:rows.results.length+producerCount});
 }
 throw new ApiError(404,'Unknown rollout task');
}
