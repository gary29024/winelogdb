import type { WineFacts } from '../wine/detailFields';
import { burgundyAtlasWineDetailPlace } from './burgundyAtlasPremierCru';
import catalogue from './burgundyVillageMapCatalogue.json';

export type VillageMapFeature=typeof catalogue.features[number];
export type BurgundyVillageMapTarget={villageId:string;villageName:string;featureId:string;name:string;scope:'vineyard'|'appellation'};

const byMatchId=new Map(catalogue.features.map(feature=>[feature.matchId,feature]));

/** Reuse the reviewed geographic/tier conflict checks. INAO identities, not
 * Atlas URLs, select geometry; the catalogue crosswalk is checked at build time. */
export function burgundyVillageMapTarget(wine:WineFacts&{classification?:string|null}):BurgundyVillageMapTarget|null{
 const place=burgundyAtlasWineDetailPlace(wine);
 const feature=place?byMatchId.get(place.placeId):undefined;
 if(!feature)return null;
 return {villageId:catalogue.id,villageName:catalogue.name,featureId:feature.id,name:feature.name,
  scope:feature.kind==='vineyard'?'vineyard':'appellation'};
}

export const gevreyMapCatalogue=catalogue;
