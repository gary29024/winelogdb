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
 // The INAO denomination alone does not distinguish Marsannay's colour areas.
 // Choose only with explicit colour evidence; keep an overview when unknown.
 const colours=('colourTargets' in target?target.colourTargets:undefined) as Record<string,{featureId:string;name:string}>|undefined;
 const normalise=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const colour=normalise(wine.colour??'');
 const namedRose=[wine.appellation,wine.wineName].some(value=>/\bmarsannay\s+rose\b/.test(normalise(value??'')));
 if(colours&&namedRose&&colour&&colour!=='rose')return null;
 const selected=colours?.[colour||(namedRose?'rose':'')]??target;
 return {villageId:village.id,villageName:village.name,region:village.region,featureId:selected.featureId,name:selected.name,
  scope:target.scope==='vineyard'?'vineyard':'appellation'};
}

// Source snapshots are ISO dates in the catalogue. INAO publishes a dated
// release; the Cadastre is a monthly snapshot, so it shows the month alone
// rather than a day it does not have. Spelled out rather than Intl, whose en-GB
// "Sept" would differ from the rest of the app.
const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export function snapshotLabel(iso:string|undefined,monthOnly=false){
 const [year,month,day]=(iso??'').split('-').map(Number);
 if(!year||!month||month>12)return iso??'';
 return monthOnly?`${months[month-1]} ${year}`:`${day} ${months[month-1]} ${year}`;
}

/**
 * The order in which overlapping designations answer clicks on one spot. The
 * first is what the spot is coloured as: a Grand Cru before a Premier Cru
 * overlapping it (Échezeaux over a corner of Les Beaux Monts), then the
 * smallest, so Clos de Bèze is reachable inside Chambertin.
 */
export function clickOrder(candidates:{id:string;tier:string;areaHa:number|string}[]){
 const rank=(tier:string)=>tier==='grand_cru'?0:1;
 return [...new Set([...candidates]
  .sort((a,b)=>rank(a.tier)-rank(b.tier)||Number(a.areaHa)-Number(b.areaHa)||a.id.localeCompare(b.id))
  .map(candidate=>candidate.id))];
}
