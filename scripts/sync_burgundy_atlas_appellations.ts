/** Verify published village and Premier Cru appellation destinations.
 * Run: npx vite-node --config vitest.config.ts scripts/sync_burgundy_atlas_appellations.ts */
import { writeFile } from 'node:fs/promises';
import { PLACES } from '../src/lib/places/hierarchy';
import { placeKey } from '../src/lib/places/resolve';
import premiers from '../src/lib/places/burgundyAtlasPremierCruLinks.json';

const origin='https://burgundyatlas.com',source=`${origin}/sitemap.xml`;
type Route={canonical_path:string;canonical_name:string;entity_type:string;classification_tier:string;
  preferred:{area_id:string;classification_filter:string}|null};
type Shard={registry_version:string;routes:Record<string,Route>};
const read=async(url:string)=>{
  const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(`${response.status}: ${url}`);
  return response.text();
};
async function pooled<T,R>(items:T[],fetchItem:(item:T)=>Promise<R>):Promise<R[]>{
  let next=0;const results:R[]=new Array(items.length);
  await Promise.all(Array.from({length:4},async()=>{
    while(next<items.length){const index=next++;results[index]=await fetchItem(items[index])}
  }));
  return results;
}
const urls=new Set([...((await read(source)).matchAll(/<loc>(.*?)<\/loc>/g))].map(match=>match[1]));
const keys=[...new Set([...urls].flatMap(url=>url.match(/\/ba_appellation_([a-z2-7])/)?.[1]??[]))].sort();
const shards=await pooled(keys,async key=>JSON.parse(await read(`${origin}/burgundy/registry/place-route-shards/${key}.json`)) as Shard);
if(new Set(shards.map(shard=>shard.registry_version)).size!==1)throw new Error('Registry changed during refresh; retry');
const routes=shards.flatMap(shard=>Object.values(shard.routes)).filter(route=>route.entity_type==='appellation'&&
  ['village','premier_cru'].includes(route.classification_tier));
const mapped=routes.filter(route=>route.preferred&&(route.preferred.classification_filter===route.classification_tier||
  route.classification_tier==='village'&&route.preferred.classification_filter==='all'));
const groups=new Map<string,{appellation:string;aliases:string[];regionId:string;villagePath:string|null;premierCruPath:string|null}>();
for(const route of mapped){
  const area=route.preferred!.area_id;
  const place=PLACES.find(place=>place.id.startsWith('france/burgundy/')&&[place.name,...place.aliases]
    .some(name=>placeKey(name).replace(/ /g,'-')===area));
  const premier=premiers.groups.find(group=>placeKey(group.appellation).replace(/ /g,'-')===area);
  const name=route.canonical_name.replace(/ premier cru$/i,'').split(' ou ')[0];
  const extraRegion=['pouilly-loche','pouilly-vinzelles'].includes(area)?'france/burgundy/maconnais':null;
  const regionId=premier?.regionId??(place?(place.tier==='subregion'?place.id:place.parent):extraRegion);
  if(!regionId)throw new Error(`Unreviewed geography for ${name}`);
  if(!urls.has(origin+route.canonical_path)||!/^\/place\/ba_appellation_[a-z2-7]+\/[a-z0-9-]+$/.test(route.canonical_path))
    throw new Error(`Unpublished or unexpected path: ${route.canonical_path}`);
  const group=groups.get(area)??{appellation:premier?.appellation??name,aliases:[],regionId,villagePath:null,premierCruPath:null};
  group.aliases=[...new Set([...group.aliases,...route.canonical_name.replace(/ premier cru$/i,'').split(' ou '),
    ...(place?[place.name,...place.aliases]:[])])].filter(alias=>alias!==group.appellation);
  const field=route.classification_tier==='village'?'villagePath':'premierCruPath';
  if(group[field])throw new Error(`Duplicate destination: ${name} ${field}`);
  group[field]=route.canonical_path;groups.set(area,group);
}
await pooled(mapped,async route=>{
  const url=origin+route.canonical_path,html=await read(url);
  const canonical=html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  const raw=html.match(/<script id="burgundy-atlas-place-jsonld"[^>]*>(.*?)<\/script>/)?.[1];
  const data=raw?JSON.parse(raw):null,tier=route.classification_tier==='village'?'Village':'Premier Cru';
  if(canonical!==url||data?.name!==route.canonical_name||!data?.additionalProperty?.some((property:{propertyID:string;value:string})=>
    property.propertyID==='Burgundy classification'&&property.value===tier))throw new Error(`Metadata mismatch: ${url}`);
});
const output={source,registrySource:`${origin}/burgundy/registry/place-route-shards/{shard}.json`,
  registryVersion:shards[0].registry_version,verifiedAt:new Date().toISOString().slice(0,10),
  excludedWithoutMap:routes.filter(route=>!mapped.includes(route)).map(route=>route.canonical_name).sort(),
  groups:[...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([,group])=>group)};
await writeFile('src/lib/places/burgundyAtlasAppellationLinks.json',JSON.stringify(output,null,2)+'\n');
console.log(`Verified ${mapped.length} appellation pages: ${output.groups.filter(group=>group.villagePath).length} village, ${output.groups.filter(group=>group.premierCruPath).length} Premier Cru. Excluded: ${output.excludedWithoutMap.join(', ')}`);
