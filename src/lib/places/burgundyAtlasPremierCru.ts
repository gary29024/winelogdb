import type { WineFacts } from '../wine/detailFields';
import { burgundyAtlasWinePlace,type BurgundyAtlasPlace } from './burgundyAtlas';
import { PLACES } from './hierarchy';
import { placeKey } from './resolve';
import mapping from './burgundyAtlasPremierCruLinks.json';
import appellationMapping from './burgundyAtlasAppellationLinks.json';
import unmappedPremiers from './burgundyAtlasUnmappedPremierCruNames.json';

type Wine=WineFacts&{classification?:string|null};
const nameKey=(value:string)=>placeKey(value.replace(/œ/g,'oe').replace(/Œ/g,'OE')).replace(/\bst\b/g,'saint');
const premierMarker=/\b(?:premier(?:s)?\s+cru(?:s)?|1er(?:\s*cru)?|1st\s+cru)\b/g;
const textKey=(value:string)=>nameKey(value).replace(premierMarker,' ').replace(/\b(?:aoc|aop)\b/g,' ').replace(/\s+/g,' ').trim();
const contains=(text:string,phrase:string)=>` ${text} `.includes(` ${phrase} `);
const withoutArticle=(name:string)=>name.replace(/^(?:les|le|la) /,'');
// Only static dictionary keys reach this cache, never wine text. Reuse compiled
// patterns across fields and renders; matchAll keeps their lastIndex untouched.
const patterns=new Map<string,RegExp>();
function patternFor(key:string){
  let pattern=patterns.get(key);
  if(!pattern){pattern=new RegExp(`(?<![a-z0-9])${key}(?![a-z0-9])`,'g');patterns.set(key,pattern)}
  return pattern;
}
const placeFields=(wine:Wine)=>[wine.appellation,wine.wineName,wine.referenceSite,wine.referenceParcel].map(value=>value?.trim()??'');
const namesPremierCru=(wine:Wine)=>wine.classification==='premier_cru'||placeFields(wine).some(value=>nameKey(value).match(premierMarker));

function nameVariants(name:string){
  // "ou" alternatives are published names, not fuzzy spelling guesses. Article
  // omission is a fallback: an exact "Porusot" beats an alias of "Le Porusot".
  const names=[name,...name.split(/ ou /i)].map(nameKey);
  return [...new Set(names)].flatMap(key=>[
    {key,exact:true},...(withoutArticle(key)!==key?[{key:withoutArticle(key),exact:false}]:[])
  ]);
}
// Reviewed spellings, scoped to the village and the exact registry entry.
// BIVB spells Les Petits Monts with a second t; the source registry says Petis.
// Domaine du Comte Liger-Belair documents Reignots and Raignots as alternatives.
// INAO and the registry write Les Saints-Georges; labels (Henri Gouges, Thibault
// Liger-Belair) and BIVB write Les Saint-Georges. The village name is removed
// before crus are sought, so the bare "Saint-Georges" of Nuits-Saint-Georges
// never reaches this alias.
// Sources: docs/burgundy-village-map.md. Do not use fuzzy matching for identities.
const reviewedNameAliases:Record<string,Record<string,string[]>>={
  'Vosne-Romanée':{'Les Petis Monts':['Les Petits Monts'],'Aux Raignots':['Aux Reignots']},
  'Nuits-Saint-Georges':{'Les Saints-Georges':['Les Saint-Georges']},
  // Domaine Leflaive's label spelling; the INAO/Atlas source writes Clavaillon.
  'Puligny-Montrachet':{'Clavaillon':['Clavoillon']}
};
const groups=mapping.groups.map(group=>({...group,key:nameKey(group.appellation),entries:group.entries.map(entry=>
  ({...entry,variants:[entry.name,...(reviewedNameAliases[group.appellation]?.[entry.name]??[])].flatMap(nameVariants)
    .map(variant=>({...variant,pattern:patternFor(variant.key)}))}))}));
type Group=typeof groups[number];
type Entry=Group['entries'][number];
type Match={entry:Entry;start:number;end:number;exact:boolean};

function matches(text:string,group:Group):Match[]{
  const found:Match[]=[];
  for(const entry of group.entries)for(const variant of entry.variants){
    for(const match of text.matchAll(variant.pattern))found.push({entry,start:match.index!,end:match.index!+match[0].length,exact:variant.exact});
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
  for(const match of text.matchAll(patternFor(group.key))){
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
function compatibleRegion(region:string,group:{key:string;regionId:string}){
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
  if(raw.some(value=>/\b(?:grand\s+cru|blend|assemblage|melange|multi(?:ple)? (?:plots|parcelles|climats|vineyards))\b/.test(nameKey(value))||/[/&+]/.test(value)))return null;
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

const appellations=appellationMapping.groups.map(group=>({...group,key:nameKey(group.appellation),
  keys:[...new Set([group.appellation,...group.aliases].map(nameKey))]}));
type Appellation=typeof appellations[number];
const namedPlaces=[...new Map([
  ...appellations.flatMap(group=>group.keys.map(key=>({key,id:null as string|null}))),
  ...PLACES.filter(place=>place.id.startsWith('france/burgundy/')&&place.classification)
    .flatMap(place=>[place.name,...place.aliases].map(name=>({key:nameKey(name),id:place.id})))
].map(place=>[place.key,place])).values()];
function spans(text:string,key:string){
  return [...text.matchAll(patternFor(key))]
    .map(match=>({start:match.index!,end:match.index!+match[0].length}));
}
// Crus named by the field itself, not the ones nested inside the village's own
// name: "Chassagne" is a climat, and Chassagne-Montrachet does not name it.
function crusOutsideVillage(field:string,group:Appellation,cruGroup:Group){
  const villages=group.keys.flatMap(key=>spans(field,key));
  return matches(field,cruGroup).filter(cru=>!villages.some(village=>
    village.start<=cru.start&&village.end>=cru.end&&village.end-village.start>cru.end-cru.start));
}
// Chablis Grand Cru is one appellation, so its seven climats are not separate
// places in the hierarchy. Whole names only, and only inside Chablis.
const grandCruClimats:Record<string,string[]>={
  Chablis:['Blanchot','Bougros','Les Clos','Grenouilles','Les Preuses','Preuses','Valmur','Vaudésir','La Moutonne']
};
// Identity-only Atlas records cannot supply map links. Their independently
// reviewed appellation names still prevent a false village-tier assertion.
const additionalCruKeys=new Map(appellations.map(group=>[group.key,[
  ...(unmappedPremiers.groups.find(cru=>nameKey(cru.appellation)===group.key)?.entries
    .flatMap(entry=>nameVariants(entry.name).map(variant=>variant.key))??[]),
  ...(grandCruClimats[group.appellation]??[]).map(nameKey)
]]));
/** Whether a wine without a recorded tier names a Premier or Grand Cru of this
 * appellation. Only the appellation's own crus count: La Romanée is a Premier
 * Cru in Gevrey-Chambertin and a Grand Cru in Vosne-Romanée, and Les Perrières
 * in Meursault says nothing about a wine from another village. */
function namesHigherTierPlot(fields:string[],group:Appellation){
  const cruGroup=groups.find(cru=>cru.key===group.key);
  const climats=additionalCruKeys.get(group.key)??[];
  return fields.some(field=>(cruGroup?crusOutsideVillage(field,group,cruGroup).length>0:false)||
    climats.some(key=>spans(field,key).length>0));
}
function namedPlaceMentions(text:string){
  const found=namedPlaces.flatMap(place=>spans(text,place.key).map(span=>({...place,...span})));
  // Beaune inside Savigny-lès-Beaune, or Chablis inside Petit Chablis, is not
  // evidence for a second appellation.
  return found.filter(match=>!found.some(other=>other.start<=match.start&&other.end>=match.end&&other.end-other.start>match.end-match.start));
}

/** Establish the appellation independently of how many plots can be matched.
 * Failure to find one cru permits a broader link; conflicting geography does not. */
function wineAppellation(wine:Wine,tier:'village'|'premier_cru'):Appellation|null{
  if(wine.identityMatchStatus==='conflict'||(wine.classification&&wine.classification!==tier))return null;
  if(wine.country?.trim()&&nameKey(wine.country)!=='france')return null;
  const raw=placeFields(wine);
  if(raw.some(value=>/\bgrand\s+cru\b/.test(nameKey(value))))return null;
  const fields=raw.map(textKey),region=textKey(wine.region??'');
  const appAnchors=appellations.flatMap(group=>group.keys.filter(key=>fields[0]===key||fields[0].startsWith(`${key} `))
    .map(key=>({group,length:key.length}))).sort((a,b)=>b.length-a.length);
  const recordedAppellation=appAnchors[0]?.group;
  const candidates=appellations.filter(group=>{
    // A stored village is authoritative even when its name is also a climat
    // elsewhere (Blagny, for example). Do not erase it as vineyard text.
    if(recordedAppellation&&recordedAppellation!==group)return false;
    if(!compatibleRegion(region,group)&&!group.keys.includes(region))return false;
    const cruGroup=groups.find(cru=>cru.key===group.key);
    const context=fields.map(field=>cruGroup?remainder(field,crusOutsideVillage(field,group,cruGroup)):field);
    const mentions=context.map(namedPlaceMentions);
    // A subregion alone is not proof of its namesake village appellation.
    const regionIsAppellation=group.keys.includes(region)&&(tier==='premier_cru'||
      !PLACES.some(place=>place.tier==='subregion'&&nameKey(place.name)===region));
    if(!regionIsAppellation&&!mentions.some(names=>names.some(place=>group.keys.includes(place.key))))return false;
    if(mentions.some(names=>names.some(place=>!group.keys.includes(place.key)&&
      !(place.id&&(group.regionId===place.id||group.regionId.startsWith(`${place.id}/`))))))return false;
    // A combined appellation may name one or several plots after the village.
    // A cru-only appellation field must be fully recognised; arbitrary text
    // cannot override a conflicting or unrecognised stored appellation.
    const app=context[0];
    if(app&&!group.keys.some(key=>app===key||app.startsWith(`${key} `))&&
      !(cruGroup&&matches(fields[0],cruGroup).length>0&&/^(?:(?:les|le|la|et|and|ou)\s*)*$/.test(app)))return false;
    return true;
  });
  if(candidates.length!==1)return null;
  // Without a recorded tier, a named Premier or Grand Cru is not a village wine.
  // Linking the village page would state a tier the record never gave, so the
  // link is withheld. A recorded village classification stays authoritative.
  if(tier==='village'&&wine.classification!=='village'&&namesHigherTierPlot(fields,candidates[0]))return null;
  return candidates[0];
}

function appellationLink(group:Appellation,tier:'village'|'premier_cru'):BurgundyAtlasPlace|null{
  const path=tier==='premier_cru'?group.premierCruPath:group.villagePath;
  if(!path)return null;
  return {placeId:path.split('/')[2],name:`${group.appellation}${tier==='premier_cru'?' Premier Cru':''}`,
    url:`https://burgundyatlas.com${path}`,scope:'appellation'};
}

/** Preserve the wine's tier when broadening from a named climat to its
 * appellation. A Premier Cru never falls back to a village or Grand Cru page. */
export function burgundyAtlasWineDetailPlace(wine:Wine):BurgundyAtlasPlace|null{
  if(namesPremierCru(wine)){
    const group=wineAppellation(wine,'premier_cru');
    return group?(burgundyAtlasPremierCru(wine)??appellationLink(group,'premier_cru')):null;
  }
  const grand=burgundyAtlasWinePlace(wine);
  if(grand)return grand;
  const group=wineAppellation(wine,'village');
  return group?appellationLink(group,'village'):null;
}
