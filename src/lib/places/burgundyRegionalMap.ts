import type { WineFacts } from '../wine/detailFields';
import type { BurgundyVillageMapTarget } from './burgundyVillageMap';
import { PLACES } from './hierarchy';
import { placeKey } from './resolve';
import registry from './burgundyRegionalMapRegistry.json';
import villages from './burgundyVillageMapRegistry.json';

type Wine=WineFacts&{classification?:string|null;wineStyle?:string|null};
// "St" abbreviates Saint on labels (Côte St-Jacques), as in the village matcher.
const key=(text:string)=>placeKey(text).replace(/\bste\b/g,'sainte').replace(/\bst\b/g,'saint')
 .replace(/\b(?:aoc|aop|appellation controlee|appellation protegee)\b/g,' ').replace(/\s+/g,' ').trim();
const contains=(text:string,name:string)=>` ${text} `.includes(` ${name} `);
const byLength=(a:string,b:string)=>b.length-a.length;
const bourgogneAppellations=['bourgogne','burgundy','bourgogne rouge','bourgogne blanc','bourgogne rose'];
const groups=registry.maps.map(group=>({...group,keys:group.aliases.map(key).sort(byLength),regions:group.compatibleRegions.map(key),
 // A split label requires its own base AOC: Mâcon + Fuissé is not Bourgogne + Fuissé.
 baseKeys:((group as {baseAppellations?:string[]}).baseAppellations??bourgogneAppellations).map(key),
 siteKeys:((group as {siteNames?:string[]}).siteNames??[]).map(key).sort(byLength)}));
const higherNames=[...new Set([
 ...villages.villages.map(village=>key(village.name)),
 ...PLACES.filter(place=>place.id.startsWith('france/burgundy/')&&place.classification)
  .flatMap(place=>[place.name,...place.aliases].map(key)),
])];
const otherRegionals=[...registry.otherAppellations.map(key),...PLACES.filter(place=>place.id.startsWith('france/burgundy/')&&!place.classification&&place.tier==='appellation')
 .flatMap(place=>[place.name,...place.aliases].map(key))
 .filter(name=>!groups.some(group=>group.keys.includes(name))&&!['bourgogne rouge','bourgogne blanc'].includes(name))];
const conflictingNames=[...new Set([...higherNames,...otherRegionals])];

// A village in a producer or landmark name (Château-Fuissé, Domaine de Fuissé,
// Cave de Charnay, Roche de Solutré) is not the denomination on the label.
const ownerWords=new Set(['de','du','des','d','chateau','domaine','cave','caves','cellier','maison','clos','roche']);
const namesPlace=(text:string,name:string)=>{
 const words=` ${text} `,needle=` ${name} `;
 for(let at=words.indexOf(needle);at>=0;at=words.indexOf(needle,at+1)){
  if(!ownerWords.has(words.slice(0,at).trim().split(' ').pop()??''))return true;
 }
 return false;
};

/** Undefined leaves unrelated wines to the village resolver. Null blocks an
 * ambiguous regional label from falling through to nested Beaune/Nuits names.
 * Region alone is context, never evidence for one of these denominations. */
export function burgundyRegionalMapTarget(wine:Wine):BurgundyVillageMapTarget|null|undefined{
 const fields=[wine.appellation,wine.wineName,wine.referenceSite,wine.referenceParcel].map(value=>key(value??''));
 const producer=key(wine.producer??'');
 const wineLabel=producer?` ${fields[1]} `.replaceAll(` ${producer} `,' ').trim():fields[1];
 const plainAppellation=(group:typeof groups[number])=>group.baseKeys.includes(fields[0]);
 const namesSite=(group:typeof groups[number])=>plainAppellation(group)&&group.siteKeys.some(name=>namesPlace(wineLabel,name));
 const candidates=groups.filter(group=>fields.some(text=>group.keys.some(name=>contains(text,name)))||namesSite(group));
 if(!candidates.length)return undefined;
 if(candidates.length!==1||wine.identityMatchStatus==='conflict'||wine.classification)return null;
 const group=candidates[0],country=key(wine.country??''),region=key(wine.region??'');
 if(country&&!['france','fr'].includes(country))return null;
 if(region&&!group.regions.includes(region)&&!group.keys.includes(region))return null;
 // The reviewed Joigny vin gris is rosé. A grape name such as Pinot Gris
 // alone is not colour evidence (the producer also uses it in white wine).
 const vinGris=group.featureId==='inao-denom-374';
 const normaliseColour=(value:string)=>vinGris&&['gris','vin gris'].includes(value)?'rose':value;
 const type=key(wine.productType??''),subtype=key(wine.productSubtype??''),style=normaliseColour(key(wine.wineStyle??''));
 if(type&&!['wine','still wine'].includes(type))return null;
 if(subtype&&!['still','still wine'].includes(subtype))return null;
 if(style&&!['red','white','rose'].includes(style))return null;
 const colour=normaliseColour(key(wine.colour??''))||style;
 if(colour&&!group.wineColours.includes(colour))return null;
 if(style&&colour&&style!==colour)return null;
 const removeFullDesignation=(text:string)=>group.keys
  .reduce((value,name)=>` ${value} `.replaceAll(` ${name} `,' ').trim(),text);
 // Check complete competing names before removing a split site name: stripping
 // "Fuissé" first would hide "Pouilly-Fuissé" on a contradictory Mâcon record.
 if(namesSite(group)&&higherNames.some(name=>contains(removeFullDesignation(wineLabel),name)))return null;
 const removeDesignation=(text:string)=>[...group.keys,...(namesSite(group)?group.siteKeys:[])]
  .reduce((value,name)=>` ${value} `.replaceAll(` ${name} `,' ').trim(),text);
 const app=fields[0];
 if(app&&!plainAppellation(group)&&
  (!group.keys.some(name=>contains(app,name))||!['','rouge','blanc','rose','red','white',...(vinGris?['gris','vin gris']:[])].includes(removeDesignation(app))))return null;
 // A cuvée/reference name alone must not infer its regional denomination,
 // except a reviewed site name beside its explicit base appellation.
 if(!fields.slice(0,2).some(text=>group.keys.some(name=>contains(text,name)))&&!namesSite(group))return null;
 const remaining=fields.map((text,index)=>{
  if(index===1&&producer)text=` ${text} `.replaceAll(` ${producer} `,' ').trim();
  return removeDesignation(text);
 });
 if(remaining.some((text,index)=>/\b(?:grands? crus?|premiers? crus?|1ers?|1st cru|cremant|mousseux)\b/.test(text)||
  (!(index===0&&plainAppellation(group))&&conflictingNames.some(name=>contains(text,name)))))return null;
 // Label colour must also agree with the denomination, even if the explicit
 // colour/style is absent. Côte d'Or does not include rosé.
 const labelColours=[['rouge','red'],['red','red'],['blanc','white'],['white','white'],['rose','rose']] as const;
 const namedColours=labelColours.filter(([name])=>remaining.slice(0,2).some(text=>contains(text,name))).map(([,value])=>value);
 if(vinGris&&(['gris','vin gris'].includes(remaining[0])||remaining.slice(0,2).some(text=>contains(text,'vin gris'))))namedColours.push('rose');
 if(new Set(namedColours).size>1)return null;
 if(namedColours.some(value=>!group.wineColours.includes(value)||(colour&&colour!==value)))return null;
 return {villageId:group.id,villageName:group.name,region:group.region,featureId:group.featureId,name:group.name,scope:'appellation',mapKind:'regional'};
}
