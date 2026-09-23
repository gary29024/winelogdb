/** Refresh factual names/identifiers only, never Atlas geometry or map assets.
 * Run: npx vite-node --config vitest.config.ts scripts/sync_burgundy_atlas_premiers.ts
 * Review the generated diff before committing. There are no runtime requests. */
import { writeFile } from 'node:fs/promises';
import { PLACES } from '../src/lib/places/hierarchy';
import { placeKey } from '../src/lib/places/resolve';
import unmappedNames from '../src/lib/places/burgundyAtlasUnmappedPremierCruNames.json';

const origin='https://burgundyatlas.com';
const source=`${origin}/sitemap.xml`;
type Route={canonical_path:string;entity_type:string;canonical_name:string;classification_tier:string|null;
  preferred:{area_id:string;classification_filter:string}|null};
type Shard={registry_version:string;routes:Record<string,Route>};
const fetchText=async(url:string)=>{
  const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(`${response.status}: ${url}`);
  return response.text();
};
async function pooled<T,R>(items:T[],read:(item:T)=>Promise<R>):Promise<R[]>{
  let next=0;const results:R[]=new Array(items.length);
  await Promise.all(Array.from({length:4},async()=>{
    while(next<items.length){const index=next++;results[index]=await read(items[index])}
  }));
  return results;
}

const sitemap=await fetchText(source);
const urls=new Set([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match=>match[1]));
const shardKeys=[...new Set([...urls].flatMap(url=>url.match(/\/ba_\w+?_([a-z2-7])/)?.[1]??[]))].sort();
if(shardKeys.length!==32)throw new Error('Unexpected Atlas registry shard set');
const shards=await pooled(shardKeys,async key=>JSON.parse(await fetchText(`${origin}/burgundy/registry/place-route-shards/${key}.json`)) as Shard);
if(new Set(shards.map(shard=>shard.registry_version)).size!==1)throw new Error('Atlas registry changed during the refresh; retry');
const routes=shards.flatMap(shard=>Object.values(shard.routes));
const premiers=routes.filter(route=>route.entity_type==='designation'&&route.classification_tier==='premier_cru');
const mapped=premiers.filter(route=>route.preferred?.classification_filter==='premier_cru');
// Identity-only routes have no village context. Keep the reviewed names and
// parents in the guard-only file, and stop when new records need that review.
const reviewedUnmapped=new Map(unmappedNames.groups.flatMap(group=>group.entries.map(entry=>[entry.placeId,entry.name] as const)));
for(const route of premiers.filter(route=>!mapped.includes(route))){
  if(reviewedUnmapped.get(route.canonical_path.split('/')[2])!==route.canonical_name)
    throw new Error(`Review the unmapped Premier Cru name and appellation: ${route.canonical_path}`);
}
const groups=new Map<string,{appellation:string;regionId:string;entries:{name:string;path:string}[]}>();
// These legal appellations have no node in WineLog's current hierarchy. Keep
// them under a verified existing ancestor without changing that shared tree.
const extraAreas:Record<string,{appellation:string;regionId:string}>={
  blagny:{appellation:'Blagny',regionId:'france/burgundy/cote-de-beaune'},
  maranges:{appellation:'Maranges',regionId:'france/burgundy/cote-de-beaune'}
};
for(const route of mapped){
  const area=route.preferred!.area_id;
  const place=PLACES.find(place=>place.id.startsWith('france/burgundy/')&&placeKey(place.name).replace(/ /g,'-')===area);
  const parent=place?{appellation:place.name,regionId:place.tier==='subregion'?place.id:place.parent!}:extraAreas[area];
  if(!parent)throw new Error(`Unreviewed Atlas area: ${area}`);
  if(!urls.has(origin+route.canonical_path))throw new Error(`Not published in sitemap: ${route.canonical_path}`);
  if(!/^\/place\/ba_designation_[a-z2-7]+\/[a-z0-9-]+$/.test(route.canonical_path))throw new Error(`Unexpected route: ${route.canonical_path}`);
  const group=groups.get(area)??{...parent,entries:[]};
  group.entries.push({name:route.canonical_name,path:route.canonical_path});groups.set(area,group);
}
let checked=0;
await pooled(mapped,async route=>{
  const url=origin+route.canonical_path,html=await fetchText(url);
  const canonical=html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  const raw=html.match(/<script id="burgundy-atlas-place-jsonld"[^>]*>(.*?)<\/script>/)?.[1];
  const data=raw?JSON.parse(raw):null;
  if(canonical!==url||data?.name!==route.canonical_name||!data?.additionalProperty?.some((property:{propertyID:string;value:string})=>
    property.propertyID==='Burgundy classification'&&property.value==='Premier Cru'))throw new Error(`Metadata mismatch: ${url}`);
  if(++checked%100===0)console.log(`Verified ${checked}/${mapped.length} Premier Cru pages`);
});
const output={source,registrySource:`${origin}/burgundy/registry/place-route-shards/{shard}.json`,
  registryVersion:shards[0].registry_version,verifiedAt:new Date().toISOString().slice(0,10),
  excludedWithoutMap:premiers.length-mapped.length,
  groups:[...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([,group])=>({...group,
    entries:group.entries.sort((a,b)=>a.path.localeCompare(b.path))}))};
await writeFile('src/lib/places/burgundyAtlasPremierCruLinks.json',JSON.stringify(output,null,2)+'\n');
console.log(`Mapped ${mapped.length} Premier Cru designations across ${groups.size} appellations; ${output.excludedWithoutMap} without map context excluded.`);
