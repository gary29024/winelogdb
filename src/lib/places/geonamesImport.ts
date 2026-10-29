import { REFERENCE_SHARDS,referenceShardId,type PlaceNames } from '../wine/referenceCatalog';
import { placeCellKey,validCoordinates,type PlaceCell,type PlaceRow } from './photoPlace';

/**
 * Below this many square kilometres a country's own name says more than its
 * first-level districts: "Tin Hau, Hong Kong" rather than "Tin Hau, Eastern
 * District". Hong Kong (1,092), Singapore and Macao fall under it.
 */
export const SMALL_COUNTRY_KM2=2000;
/** Historical, abandoned and destroyed places are not where anyone takes a photo today. */
const GONE=new Set(['PPLH','PPLQ','PPLW','PPLCH']);

const lines=(text:string)=>text.split(/\r?\n/).filter(line=>line&&!line.startsWith('#'));
// Four decimals is about eleven metres: plenty for a nearest town, and a third of the bytes.
const round=(value:number)=>Math.round(value*1e4)/1e4;

/** GeoNames citiesNNN.txt: tab-separated, in the column order of the GeoNames dump readme. */
export function parseGeonamesCities(text:string){
  const places:PlaceRow[]=[];let updatedAt='';
  for(const line of lines(text)){
    const column=line.split('\t'),name=column[1]?.trim(),latitude=Number(column[4]),longitude=Number(column[5]);
    if(column.length<11||!name||column[6]!=='P'||GONE.has(column[7])||!validCoordinates(latitude,longitude))continue;
    places.push([name,round(latitude),round(longitude),column[8],column[10]]);
    if((column[18]??'')>updatedAt)updatedAt=column[18];
  }
  return {places,updatedAt:updatedAt||null};
}

/** countryInfo.txt: each country's ISO code, English name and area. */
export function parseCountryInfo(text:string){
  const countries=new Map<string,{name:string;areaKm2:number|null}>();
  for(const line of lines(text)){
    const column=line.split('\t'),code=column[0]??'',name=column[4]?.trim(),area=Number(column[6]);
    if(/^[A-Z]{2}$/.test(code)&&name)countries.set(code,{name,areaKm2:Number.isFinite(area)&&area>0?area:null});
  }
  return countries;
}

/** admin1CodesASCII.txt: "CC.code" and the first-level division's name. */
export function parseAdmin1Codes(text:string){
  const regions=new Map<string,string>();
  for(const line of lines(text)){const [code,name]=line.split('\t');if(code&&name?.trim())regions.set(code,name.trim())}
  return regions;
}

export function buildPlaceNames(countries:ReturnType<typeof parseCountryInfo>,regions:ReturnType<typeof parseAdmin1Codes>):PlaceNames{
  const small=new Set([...countries].filter(([,country])=>country.areaKm2!=null&&country.areaKm2<SMALL_COUNTRY_KM2).map(([code])=>code));
  return {
    regions:Object.fromEntries([...regions].filter(([code])=>!small.has(code.split('.')[0]))),
    countries:Object.fromEntries([...countries].map(([code,country])=>[code,country.name]))
  };
}

/** Whole one-degree cells per shard, cells in key order so a rebuild of the same data is byte-identical. */
export function shardPlaces(places:PlaceRow[],shardCount=REFERENCE_SHARDS){
  const cells=new Map<string,PlaceRow[]>();
  for(const place of places){const key=placeCellKey(place[1],place[2]),cell=cells.get(key);if(cell)cell.push(place);else cells.set(key,[place])}
  const shards=new Map<string,PlaceCell[]>();
  for(const key of [...cells.keys()].sort()){
    const id=referenceShardId(key,shardCount),shard=shards.get(id),entry:PlaceCell=[key,cells.get(key)!];
    if(shard)shard.push(entry);else shards.set(id,[entry]);
  }
  return shards;
}
