import { PLACES } from './hierarchy';
import { placeKey } from './resolve';
import mapping from './burgundyAtlasLinks.json';
import { departmentRegions } from './burgundyDepartments';

export type BurgundyAtlasPlace={placeId:string;name:string;url:string;scope?:'appellation'};
type WinePlace={country?:string|null;region?:string|null;appellation?:string|null;classification?:string|null;identityMatchStatus?:string|null};

const burgundyPlaces=PLACES.filter(place=>place.id.startsWith('france/burgundy'));
const regionIds=new Map<string,string[]>();
for(const place of burgundyPlaces)for(const name of [place.name,...place.aliases]){
  const key=placeKey(name);
  regionIds.set(key,[...(regionIds.get(key)??[]),place.id]);
}
for(const [key,ids] of Object.entries(departmentRegions))regionIds.set(key,[...(regionIds.get(key)??[]),...ids]);
const placesById=new Map(burgundyPlaces.map(place=>[place.id,place]));
const byName=new Map<string,BurgundyAtlasPlace>();

// These are whole-name aliases, never substring matches: Montrachet must not
// select Bâtard-Montrachet, and Échezeaux must not select Grands Échezeaux.
const aliases:Record<string,string[]>={
  'Clos de Vougeot':['Clos Vougeot'],
  'Romanée-Saint-Vivant':['Romanée St Vivant']
};
for(const entry of mapping.entries){
  const place=placesById.get(entry.placeId);
  if(!place||place.classification!=='grand_cru')continue;
  const target={...entry,name:place.name};
  for(const name of [place.name,...place.aliases,...(aliases[place.name]??[])]){
    const key=placeKey(name);
    byName.set(key,target);
    if(!key.includes('grand cru')){
      byName.set(`${key} grand cru`,target);
      byName.set(`grand cru ${key}`,target);
    }
  }
}

/** A verified appellation destination; never infer a named climat or parcel. */
export function burgundyAtlasPlace(appellation:string|null|undefined):BurgundyAtlasPlace|null{
  if(!appellation)return null;
  const key=placeKey(appellation).replace(/^(?:aoc|aop) /,'').replace(/ (?:aoc|aop)$/,'');
  return byName.get(key)??null;
}

/** A specific appellation is sufficient when broader fields are absent, but
 * contradictory geography or a disputed reference must not become a link. */
export function burgundyAtlasWinePlace(wine:WinePlace):BurgundyAtlasPlace|null{
  if(wine.identityMatchStatus==='conflict')return null;
  if(wine.classification&&wine.classification!=='grand_cru')return null;
  if(wine.country?.trim()&&placeKey(wine.country)!=='france')return null;
  const place=burgundyAtlasPlace(wine.appellation);
  if(!place)return null;
  if(wine.region?.trim()){
    const regions=regionIds.get(placeKey(wine.region))??[];
    if(!regions.some(id=>place.placeId===id||place.placeId.startsWith(`${id}/`)))return null;
  }
  return place;
}
