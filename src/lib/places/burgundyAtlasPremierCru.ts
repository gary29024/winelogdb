import type { WineFacts } from '../wine/detailFields';
import { burgundyAtlasWinePlace,type BurgundyAtlasPlace } from './burgundyAtlas';
import { PLACES } from './hierarchy';
import { placeKey } from './resolve';
import mapping from './burgundyAtlasPremierCruLinks.json';

type Wine=WineFacts&{classification?:string|null};
const nameKey=(value:string)=>placeKey(value.replace(/œ/g,'oe').replace(/Œ/g,'OE')).replace(/\bst\b/g,'saint');
const premierMarker=/\b(?:premier(?:s)?\s+cru(?:s)?|1er(?:\s*cru)?|1st\s+cru)\b/g;
const textKey=(value:string)=>nameKey(value).replace(premierMarker,' ').replace(/\b(?:aoc|aop)\b/g,' ').replace(/\s+/g,' ').trim();
const contains=(text:string,phrase:string)=>` ${text} `.includes(` ${phrase} `);
const withoutArticle=(name:string)=>name.replace(/^(?:les|le|la) /,'');
const placeFields=(wine:Wine)=>[wine.appellation,wine.wineName,wine.referenceSite,wine.referenceParcel].map(value=>value?.trim()??'');
const namesPremierCru=(wine:Wine)=>wine.classification==='premier_cru'||placeFields(wine).some(value=>nameKey(value).match(premierMarker));

const groups=mapping.groups.map(group=>({...group,key:nameKey(group.appellation),entries:group.entries.map(entry=>{
  // "ou" alternatives are published names, not fuzzy spelling guesses. Article
  // omission is a fallback: an exact "Porusot" beats an alias of "Le Porusot".
  const names=[entry.name,...entry.name.split(/ ou /i)].map(nameKey);
  const variants=[...new Set(names)].flatMap(key=>[
    {key,exact:true},...(withoutArticle(key)!==key?[{key:withoutArticle(key),exact:false}]:[])
  ]);
  return {...entry,variants};
})}));
type Group=typeof groups[number];
type Entry=Group['entries'][number];
type Match={entry:Entry;start:number;end:number;exact:boolean};

function matches(text:string,group:Group):Match[]{
  const found:Match[]=[];
  for(const entry of group.entries)for(const variant of entry.variants){
    const pattern=new RegExp(`(?<![a-z0-9])${variant.key}(?![a-z0-9])`,'g');
    for(const match of text.matchAll(pattern))found.push({entry,start:match.index!,end:match.index!+match[0].length,exact:variant.exact});
  }
  // A nested name is not another vineyard: Clos des Perrières must not become
  // Perrières. Separate, non-overlapping names remain ambiguous and are refused.
  return found.filter(match=>!found.some(other=>other!==match&&other.start<=match.start&&other.end>=match.end&&
    (other.end-other.start>match.end-match.start||other.exact&&!match.exact)));
}
function remainder(text:string,found:Match[]){
  const characters=[...text];
  for(const match of found)characters.fill(' ',match.start,match.end);
  return characters.join('').replace(/\s+/g,' ').trim();
}

function separateVillage(text:string,group:Group){
  const crus=matches(text,group),characters=[...text];let named=false;
  for(const match of text.matchAll(new RegExp(`(?<![a-z0-9])${group.key}(?![a-z0-9])`,'g'))){
    const start=match.index!,end=start+match[0].length;
    // Blagny inside "Sous Blagny" is part of the climat, not evidence of the
    // appellation (the same climat name also exists under Meursault).
    if(crus.some(cru=>cru.start<=start&&cru.end>=end&&cru.end-cru.start>end-start))continue;
    characters.fill(' ',start,end);named=true;
  }
  return {text:characters.join('').replace(/\s+/g,' ').trim(),named};
}

const regionNames=PLACES.filter(place=>place.id.startsWith('france/burgundy')).flatMap(place=>
  [place.name,...place.aliases].map(name=>({key:nameKey(name),id:place.id})));
function compatibleRegion(region:string,group:Group){
  return !region||region===group.key||regionNames.some(place=>place.key===region&&
    (group.regionId===place.id||group.regionId.startsWith(`${place.id}/`)));
}

/** A Premier Cru needs both the named vineyard and its village appellation.
 * Sites with the same name in different villages are separate Atlas records.
 * This is wine-detail matching only; the Grand Cru collection matcher stays exact. */
export function burgundyAtlasPremierCru(wine:Wine):BurgundyAtlasPlace|null{
  if(wine.identityMatchStatus==='conflict'||(wine.classification&&wine.classification!=='premier_cru'))return null;
  if(wine.country?.trim()&&nameKey(wine.country)!=='france')return null;
  const raw=placeFields(wine);
  // The classification marker matters: several climats include village-level
  // land as well. A bare vineyard name does not establish Premier Cru status.
  if(!namesPremierCru(wine))return null;
  if(raw.some(value=>/\bgrand\s+cru\b/.test(nameKey(value))||/[/&+]/.test(value)))return null;
  const fields=raw.map(textKey),region=textKey(wine.region??'');
  const destinations:BurgundyAtlasPlace[]=[];
  for(const group of groups){
    if(!compatibleRegion(region,group))continue;
    const separated=fields.map(field=>separateVillage(field,group));
    if(region!==group.key&&!separated.some(field=>field.named))continue;
    const candidates=new Set<Entry>();let invalid=false;
    for(const [index,field] of fields.entries()){
      if(!field)continue;
      // Remove the village before looking for the cru: "Chassagne" is itself
      // a climat and must not match the village name Chassagne-Montrachet.
      const text=separated[index].text,found=matches(text,group),rest=remainder(text,found);
      if(groups.some(other=>other!==group&&contains(rest,other.key))||/\b(?:et|and|ou)\b/.test(rest)){
        invalid=true;break;
      }
      // Appellation and reference fields must name a whole place. Only the
      // wine title can contain producer/vintage text around a named climat.
      const whole=!rest||(found.length>0&&/^(?:les|le|la)$/.test(rest));
      if(index===0&&!whole){invalid=true;break}
      if(index===1||whole)for(const match of found)candidates.add(match.entry);
    }
    if(invalid||candidates.size!==1)continue;
    const [entry]=candidates;
    destinations.push({placeId:entry.path.split('/')[2],name:`${group.appellation} — ${entry.name}`,
      url:`https://burgundyatlas.com${entry.path}`});
  }
  return destinations.length===1?destinations[0]:null;
}

/** An explicit Premier Cru must never fall back to a Grand Cru namesake such
 * as La Romanée when the stored classification field is absent. */
export function burgundyAtlasWineDetailPlace(wine:Wine):BurgundyAtlasPlace|null{
  return namesPremierCru(wine)?burgundyAtlasPremierCru(wine):burgundyAtlasWinePlace(wine);
}
