import type { WineFacts } from '../wine/detailFields';
import { burgundyAtlasWineDetailPlace,burgundyLocalAppellationMapIdentity } from './burgundyAtlasPremierCru';
import registry from './burgundyVillageMapRegistry.json';
import { burgundyGrandCruMapIdentity } from './burgundyGrandCruClimats';

export type VillageMapFeature={
 id:string;name:string;tier:string;kind:string;appellationId:number;denominationId:number|null;denominationIds?:number[];
 sourceName:string;communes:string[];areaHa:number;matchId:string;atlasUrl:string|null;bounds:number[];labelPoint:number[];parentAppellation?:string;
};
export type VillageMapCatalogue={
 id:string;name:string;region:string;communes:{id:string;name:string}[];dataUrl:string;bounds:number[];
 sources:{name:string;date:string;url:string;sha256:string;license:string}[];
 notes:Record<string,{note:string;paintedBy?:string;sameBoundaryAs?:string}>;features:VillageMapFeature[];coverageNote?:string;
 // Premier Crus lying inside a wider Premier Cru name, keyed by the wider one.
 umbrellas?:Record<string,string[]>;
 // Separate parts of one appellation, each with its own zoom button and map label.
 areas?:{id:string;label:string;name:string;bounds:number[]}[];
};
export type BurgundyVillageMapTarget={villageId:string;villageName:string;region:string;featureId:string;name:string;scope:'vineyard'|'appellation'};

// Only this small identity index joins wine details. Per-village metadata and
// geometry load when the dialog opens, independently of the other villages.
const byMatchId=new Map(registry.targets.map(target=>[target.matchId,target]));
const byVillageId=new Map(registry.villages.map(village=>[village.id,village]));

const normalise=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
// A recorded colour wins; a red/white/rosé wine style stands in when the
// colour is blank. Sparkling and other styles say nothing about the area.
function wineColour(wine:{colour?:string|null;wineStyle?:string|null}){
 const style=normalise(wine.wineStyle??'');
 return normalise(wine.colour??'')||(['red','white','rose'].includes(style)?style:'');
}

type MapWine=WineFacts&{classification?:string|null;wineStyle?:string|null};
/** Reuse the reviewed geographic/tier conflict checks. INAO identities, not
 * Atlas URLs, select geometry; the catalogue crosswalk is checked at build time. */
export function burgundyVillageMapTarget(wine:MapWine):BurgundyVillageMapTarget|null{
 // Santenots lies in Meursault, but its red wine is Volnay Premier Cru:
 // Meursault's own Santenots designations are white only. A red wine recorded
 // as Meursault Santenots is shown on Volnay's map, whose note explains this.
 const fields=['appellation','wineName','referenceSite','referenceParcel'] as const;
 const text=fields.map(field=>normalise(wine[field]??'')).join(' ');
 if(wineColour(wine)==='red'&&/\bmeursault\b/.test(text)&&/\bsantenots\b/.test(text)){
  return burgundyVillageMapTarget({...wine,...Object.fromEntries(fields.map(field=>[field,wine[field]?.replace(/\bmeursault\b/gi,'Volnay')]))});
 }
 const local=burgundyGrandCruMapIdentity(wine);
 if(local===null)return null;
 const matchId=local??burgundyLocalAppellationMapIdentity(wine)??burgundyAtlasWineDetailPlace(wine)?.placeId;
 const target=matchId?byMatchId.get(matchId):undefined;
 const village=target?byVillageId.get(target.villageId):undefined;
 if(!target||!village)return null;
 // Some village appellations have separate colour areas. Choose only with
 // explicit colour evidence; keep a labelled overview when unknown.
 const colours=('colourTargets' in target?target.colourTargets:undefined) as Record<string,{featureId:string;name:string}>|undefined;
 const colour=wineColour(wine);
 if(colour&&'wineColours' in village&&!(village.wineColours as string[]).includes(colour))return null;
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

/** "1 Grand Cru", "9 Grand Crus". */
export function countLabel(count:number,singular:string,plural:string){
 return `${count} ${count===1?singular:plural}`;
}

/** "A & B" for a pair; "A, B, C & D" for more, rather than a chain of ampersands. */
export function joinPlaces(names:string[]){
 return names.length<=2?names.join(' & '):`${names.slice(0,-1).join(', ')} & ${names[names.length-1]}`;
}

/** "A", "A and B", "A, B and C" for prose. */
function sentenceList(names:string[]){
 return names.length<2?names.join(''):`${names.slice(0,-1).join(', ')} and ${names[names.length-1]}`;
}

/**
 * What a Premier Cru's umbrella relationships mean for a label: a wider name
 * (Chassagne's Morgeot) covers named vineyards, so its wine may come from any
 * of them; a vineyard inside one lies within that wider name.
 */
export function umbrellaNote(catalogue:Pick<VillageMapCatalogue,'features'|'umbrellas'>,featureId:string){
 const umbrellas=catalogue.umbrellas??{};
 const byId=new Map(catalogue.features.map(feature=>[feature.id,feature]));
 const name=(id:string)=>byId.get(id)?.name??id;
 const sentences:string[]=[];
 const covered=umbrellas[featureId]??[];
 if(covered.length){
  const shown=covered.slice(0,4).map(name);
  sentences.push(covered.length>4
   ?`${name(featureId)} is a wider Premier Cru name covering ${covered.length} named vineyards, including ${sentenceList(shown)}.`
   :`${name(featureId)} is a wider Premier Cru name covering ${sentenceList(shown)}.`);
 }
 const within=Object.entries(umbrellas).filter(([,inner])=>inner.includes(featureId)).map(([outer])=>outer)
  .sort((a,b)=>(byId.get(b)?.areaHa??0)-(byId.get(a)?.areaHa??0));
 if(within.length)sentences.push(`${name(featureId)} lies within ${sentenceList(within.map(name))}, ${within.length>1?'wider Premier Cru names':'a wider Premier Cru name'}.`);
 return sentences.join(' ')||undefined;
}
