import { buildPlaceNames,parseAdmin1Codes,parseCountryInfo,parseGeonamesCities,shardPlaces } from '../../../src/lib/places/geonamesImport';
import { REFERENCE_SHARDS,type ReferenceManifest } from '../../../src/lib/wine/referenceCatalog';

/** One row of a GeoNames citiesNNN file, in the dump's own 19-column layout. */
export function geonamesRow(id:number,name:string,latitude:number,longitude:number,code:string,country:string,admin1:string,population:number,modified='2026-10-28'){
  return [id,name,name,'',latitude,longitude,'P',code,country,'',admin1,'','','',population,'','','',modified].join('\t');
}

/** Real rows from GeoNames cities500, around where the reported batch was photographed. */
export const GEONAMES_CITIES=[
  geonamesRow(1850147,'Tokyo',35.6895,139.69171,'PPLC','JP','40',9733276,'2025-07-22'),
  geonamesRow(10866784,'Jiyūgaoka',35.61099,139.66782,'PPLX','JP','40',7503,'2024-11-12'),
  geonamesRow(1864381,'Den’enchōfu',35.59548,139.66535,'PPL','JP','40',18952,'2024-04-22'),
  geonamesRow(10866730,'Ebisu',35.64595,139.7155,'PPLX','JP','40',15112,'2024-04-22'),
  geonamesRow(13353695,'Chūō',35.67004,139.77544,'PPLA2','JP','40',169179,'2026-09-14'),
  geonamesRow(1863198,'Haneda',35.54913,139.7456,'PPLX','JP','40',14885,'2025-01-13'),
  geonamesRow(2129218,'Yoichi',43.20389,140.77028,'PPL','JP','12',18993,'2021-10-01'),
  geonamesRow(1819729,'Hong Kong',22.27832,114.17469,'PPLC','HK','',7396076,'2025-08-25'),
  geonamesRow(12719546,'Tin Hau',22.28093,114.1924,'PPL','HK','HEA',13521,'2024-01-30')
].join('\n');
export const GEONAMES_ADMIN1=['JP.40\tTokyo\tTokyo\t1850144','JP.12\tHokkaido\tHokkaido\t2130037','HK.HEA\tEastern District\tEastern District\t7533608'].join('\n');
export const GEONAMES_COUNTRIES=['#ISO\tISO3\tISO-Numeric\tfips\tCountry\tCapital\tArea(in sq km)','JP\tJPN\t392\tJA\tJapan\tTokyo\t377835','HK\tHKG\t344\tHK\tHong Kong\tHong Kong\t1092'].join('\n');

/** The reference bucket as `npm run places:import` leaves it for these rows, with every key read. */
export function placesBucket(cities=GEONAMES_CITIES){
  const {places}=parseGeonamesCities(cities),prefix='reference/places/versions/test';
  const manifest:ReferenceManifest={provider:'places',version:'test',prefix,shardCount:REFERENCE_SHARDS,rows:places.length,source:'test',sourceUpdatedAt:null,generatedAt:'2026-10-29T00:00:00.000Z',namesKey:`${prefix}/names.json`};
  const objects=new Map<string,string>([
    ['reference/places/current.json',JSON.stringify(manifest)],
    [`${prefix}/names.json`,JSON.stringify(buildPlaceNames(parseCountryInfo(GEONAMES_COUNTRIES),parseAdmin1Codes(GEONAMES_ADMIN1)))]
  ]);
  for(const [id,cells] of shardPlaces(places))objects.set(`${prefix}/shard-${id}.json`,JSON.stringify(cells));
  const reads:string[]=[];
  const bucket={get:async(key:string)=>{reads.push(key);const body=objects.get(key);return body==null?null:{text:async()=>body}}} as unknown as R2Bucket;
  return {bucket,reads};
}
