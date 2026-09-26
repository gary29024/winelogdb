import type { WineFacts } from '../wine/detailFields';
import type { BurgundyVillageMapTarget } from './burgundyVillageMap';
import { PLACES } from './hierarchy';
import { placeKey } from './resolve';
import registry from './burgundyRegionalMapRegistry.json';
import villages from './burgundyVillageMapRegistry.json';

type Wine=WineFacts&{classification?:string|null;wineStyle?:string|null};
const key=(text:string)=>placeKey(text).replace(/\b(?:aoc|aop|appellation controlee|appellation protegee)\b/g,' ').replace(/\s+/g,' ').trim();
const contains=(text:string,name:string)=>` ${text} `.includes(` ${name} `);
const groups=registry.maps.map(group=>({...group,keys:group.aliases.map(key).sort((a,b)=>b.length-a.length),regions:group.compatibleRegions.map(key)}));
const higherNames=[...new Set([
 ...villages.villages.map(village=>key(village.name)),
 ...PLACES.filter(place=>place.id.startsWith('france/burgundy/')&&place.classification)
  .flatMap(place=>[place.name,...place.aliases].map(key)),
])];
const otherRegionals=[...registry.otherAppellations.map(key),...PLACES.filter(place=>place.id.startsWith('france/burgundy/')&&!place.classification&&place.tier==='appellation')
 .flatMap(place=>[place.name,...place.aliases].map(key))
 .filter(name=>!groups.some(group=>group.keys.includes(name))&&!['bourgogne rouge','bourgogne blanc'].includes(name))];
const conflictingNames=[...new Set([...higherNames,...otherRegionals])];
const genericAppellations=['bourgogne','burgundy','bourgogne rouge','bourgogne blanc','bourgogne rose'];

/** Undefined leaves unrelated wines to the village resolver. Null blocks an
 * ambiguous regional label from falling through to nested Beaune/Nuits names.
 * Region alone is context, never evidence for one of these denominations. */
export function burgundyRegionalMapTarget(wine:Wine):BurgundyVillageMapTarget|null|undefined{
 const fields=[wine.appellation,wine.wineName,wine.referenceSite,wine.referenceParcel].map(value=>key(value??''));
 const candidates=groups.filter(group=>fields.some(text=>group.keys.some(name=>contains(text,name))));
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
 const removeDesignation=(text:string)=>group.keys
  .reduce((value,name)=>` ${value} `.replaceAll(` ${name} `,' ').trim(),text);
 const app=fields[0];
 if(app&&!genericAppellations.includes(app)&&
  (!group.keys.some(name=>contains(app,name))||!['','rouge','blanc','rose','red','white',...(vinGris?['gris','vin gris']:[])].includes(removeDesignation(app))))return null;
 // A cuvée/reference name alone must not infer its regional denomination.
 if(!fields.slice(0,2).some(text=>group.keys.some(name=>contains(text,name))))return null;
 const producer=key(wine.producer??'');
 const remaining=fields.map((text,index)=>{
  if(index===1&&producer)text=` ${text} `.replaceAll(` ${producer} `,' ').trim();
  return removeDesignation(text);
 });
 if(remaining.some(text=>/\b(?:grands? crus?|premiers? crus?|1ers?|1st cru|cremant|mousseux)\b/.test(text)||
  conflictingNames.some(name=>contains(text,name))))return null;
 // Label colour must also agree with the denomination, even if the explicit
 // colour/style is absent. Côte d'Or does not include rosé.
 const labelColours=[['rouge','red'],['red','red'],['blanc','white'],['white','white'],['rose','rose']] as const;
 const namedColours=labelColours.filter(([name])=>remaining.slice(0,2).some(text=>contains(text,name))).map(([,value])=>value);
 if(vinGris&&(['gris','vin gris'].includes(remaining[0])||remaining.slice(0,2).some(text=>contains(text,'vin gris'))))namedColours.push('rose');
 if(namedColours.some(value=>!group.wineColours.includes(value)||(colour&&colour!==value)))return null;
 return {villageId:group.id,villageName:group.name,region:group.region,featureId:group.featureId,name:group.name,scope:'appellation',mapKind:'regional'};
}
