import type { WineFacts } from '../wine/detailFields';
import { burgundyAtlasWineDetailPlace } from './burgundyAtlasPremierCru';
import registry from './burgundyVillageMapRegistry.json';

export type VillageMapFeature={
 id:string;name:string;tier:string;kind:string;appellationId:number;denominationId:number;
 sourceName:string;communes:string[];areaHa:number;matchId:string;atlasUrl:string;bounds:number[];labelPoint:number[];
};
export type VillageMapCatalogue={
 id:string;name:string;region:string;communes:{id:string;name:string}[];dataUrl:string;bounds:number[];
 sources:{name:string;date:string;url:string;sha256:string;license:string}[];
 notes:Record<string,{note:string;paintedBy?:string}>;features:VillageMapFeature[];
};
export type BurgundyVillageMapTarget={villageId:string;villageName:string;region:string;featureId:string;name:string;scope:'vineyard'|'appellation'};

// Only this small identity index joins wine details. Per-village metadata and
// geometry load when the dialog opens, independently of the other villages.
const byMatchId=new Map(registry.targets.map(target=>[target.matchId,target]));
const byVillageId=new Map(registry.villages.map(village=>[village.id,village]));

/** Reuse the reviewed geographic/tier conflict checks. INAO identities, not
 * Atlas URLs, select geometry; the catalogue crosswalk is checked at build time. */
export function burgundyVillageMapTarget(wine:WineFacts&{classification?:string|null}):BurgundyVillageMapTarget|null{
 const place=burgundyAtlasWineDetailPlace(wine);
 const target=place?byMatchId.get(place.placeId):undefined;
 const village=target?byVillageId.get(target.villageId):undefined;
 if(!target||!village)return null;
 return {villageId:village.id,villageName:village.name,region:village.region,featureId:target.featureId,name:target.name,
  scope:target.scope==='vineyard'?'vineyard':'appellation'};
}
