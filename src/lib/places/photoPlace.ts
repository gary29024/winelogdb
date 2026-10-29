import { normalizeReferenceText,placeNames,referenceManifest,referenceRowsByShard,referenceShardId,type PlaceNames,type ReferenceSource } from '../wine/referenceCatalog';

/**
 * Where a photo was taken, named from its EXIF GPS.
 *
 * The label model used to be handed the coordinates and asked to name the
 * place, in the same request that works out where the wine comes from. It
 * answered with the wine's home: bottles photographed in Tokyo came back as
 * "Yoichi, Hokkaido" and "Courmas". The name now comes from GeoNames' places of
 * over 500 people, imported into the reference bucket by `npm run places:import`
 * (docs/photo-places.md): the nearest one to the coordinates, if any is near.
 */

/** [name, latitude, longitude, ISO country code, GeoNames first-level division code] */
export type PlaceRow=[string,number,number,string,string];
/** Shards hold whole one-degree cells, as [cell key, the places in it]. */
export type PlaceCell=[string,PlaceRow[]];
export type NearestPlace={place:PlaceRow;distanceKm:number};

/** Farther than this, the nearest town says little about where the photo was taken. */
export const MAX_PLACE_DISTANCE_KM=50;
const EARTH_RADIUS_KM=6371,KM_PER_DEGREE=Math.PI*EARTH_RADIUS_KM/180;

const radians=(degrees:number)=>degrees*Math.PI/180;
const wrapLongitudeCell=(cell:number)=>((cell+180)%360+360)%360-180;
export const placeCellKey=(latitude:number,longitude:number)=>`${Math.floor(latitude)}:${wrapLongitudeCell(Math.floor(longitude))}`;

export function distanceKm(latitude:number,longitude:number,otherLatitude:number,otherLongitude:number){
  const a=Math.sin(radians(otherLatitude-latitude)/2)**2+Math.cos(radians(latitude))*Math.cos(radians(otherLatitude))*Math.sin(radians(otherLongitude-longitude)/2)**2;
  return 2*EARTH_RADIUS_KM*Math.asin(Math.min(1,Math.sqrt(a)));
}

/** The closest any point of a one-degree cell can be, across the antimeridian. */
function cellDistanceKm(latitude:number,longitude:number,cellLatitude:number,cellLongitude:number){
  const nearestLatitude=Math.min(Math.max(latitude,cellLatitude),cellLatitude+1);
  const east=((longitude-cellLongitude)%360+360)%360,offset=east<=1?0:Math.min(east-1,360-east);
  return distanceKm(latitude,longitude,nearestLatitude,longitude+offset);
}

/** Every cell that could hold a place within reach, closest first. */
function candidateCells(latitude:number,longitude:number){
  const latitudeCell=Math.floor(latitude),longitudeCell=Math.floor(longitude);
  const latitudeSpan=Math.ceil(MAX_PLACE_DISTANCE_KM/KM_PER_DEGREE);
  // A degree of longitude shrinks towards the poles, so reach spans more cells there.
  const widest=Math.cos(radians(Math.min(89,Math.abs(latitude)+latitudeSpan)));
  const longitudeSpan=Math.min(180,Math.ceil(MAX_PLACE_DISTANCE_KM/(KM_PER_DEGREE*widest)));
  const cells:Array<{key:string;distanceKm:number}>=[];
  for(let row=latitudeCell-latitudeSpan;row<=latitudeCell+latitudeSpan;row++){
    if(row<-90||row>89)continue;
    for(let column=longitudeCell-longitudeSpan;column<=longitudeCell+longitudeSpan;column++){
      const wrapped=wrapLongitudeCell(column),distance=cellDistanceKm(latitude,longitude,row,wrapped);
      if(distance<=MAX_PLACE_DISTANCE_KM)cells.push({key:`${row}:${wrapped}`,distanceKm:distance});
    }
  }
  return cells.sort((a,b)=>a.distanceKm-b.distanceKm);
}

export const validCoordinates=(latitude:unknown,longitude:unknown):latitude is number=>
  typeof latitude==='number'&&typeof longitude==='number'&&Number.isFinite(latitude)&&Number.isFinite(longitude)
  &&latitude>=-90&&latitude<=90&&longitude>=-180&&longitude<=180;

export async function nearestPlace(bucket:ReferenceSource,latitude:number,longitude:number):Promise<NearestPlace|null>{
  const manifest=await referenceManifest(bucket,'places');if(!manifest)return null;
  let best:NearestPlace|null=null;
  for(const cell of candidateCells(latitude,longitude)){
    // Cells come closest first, so none after this one can hold anything nearer.
    if(best&&cell.distanceKm>=best.distanceKm)break;
    const cells=await referenceRowsByShard<PlaceCell>(bucket,'places',referenceShardId(cell.key,manifest.shardCount));
    for(const place of cells.find(([key])=>key===cell.key)?.[1]??[]){
      const distance=distanceKm(latitude,longitude,place[1],place[2]);
      if(distance<=MAX_PLACE_DISTANCE_KM&&(!best||distance<best.distanceKm))best={place,distanceKm:distance};
    }
  }
  return best;
}

/**
 * "Jiyūgaoka, Tokyo": the place and its region, or its country when the region
 * names it too ("Tokyo, Japan"). The import leaves small countries' districts
 * out, so Hong Kong reads "Tin Hau, Hong Kong", not "Tin Hau, Eastern District".
 */
export function placeLabel(place:PlaceRow,names:PlaceNames){
  const [name,,,country,region]=place,own=normalizeReferenceText(name);
  const qualifier=[names.regions[`${country}.${region}`],names.countries[country]].find(value=>value&&normalizeReferenceText(value)!==own);
  return qualifier?`${name}, ${qualifier}`:name;
}

/** The approximate place a photo was taken, or null. Reference trouble never fails a scan. */
export async function photoPlaceName(bucket:ReferenceSource|undefined,latitude:number|null|undefined,longitude:number|null|undefined){
  if(!bucket||!validCoordinates(latitude,longitude))return null;
  try{
    const nearest=await nearestPlace(bucket,latitude,longitude as number);
    return nearest?placeLabel(nearest.place,await placeNames(bucket)):null;
  }catch(error){
    console.warn(JSON.stringify({event:'photo-place-lookup-failed',error:error instanceof Error?error.message:String(error)}));
    return null;
  }
}
