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
const withoutRegionalOrigin=(text:string)=>text.replace(/\b(?:vins? de bourgogne|wine of burgundy)\b/g,'').trim();
// Hyphens become a marker word so a split village's neighbour stays visible.
const joined='xjoinedx';
// Unspaced hyphen, non-breaking hyphen and en dash all join words.
const joinedKey=(text:string)=>key(text.replace(/([\p{L}\d])[-\u2010-\u2013](?=[\p{L}\d])/gu,`$1 ${joined} `));
// Removes a producer however its words are joined (Prissé-Sologny vs Prissé Sologny).
const withoutProducer=(label:string,producer:string)=>{
 const words=label.split(' ').filter(Boolean),name=producer.split(' ').filter(Boolean);
 if(!name.length)return label;
 const kept:string[]=[];
 for(let i=0;i<words.length;){
  let j=i,k=0;
  while(j<words.length&&k<name.length){
   if(words[j]===joined&&k>0){j++;continue;}
   if(words[j]!==name[k])break;
   j++;k++;
  }
  if(k===name.length){i=j;continue;}
  kept.push(words[i++]);
 }
 return kept.join(' ');
};
// Grape names recorded after a full denomination ("Mâcon-Lugny Chardonnay")
// limit the wine's possible colours; "Mâcon Chardonnay" alone remains the
// village. Black grapes make both red and rosé, so they never pick one.
const grapeColours:readonly (readonly [string,readonly string[]])[]=[['chardonnay',['white']],['pinot noir',['red','rose']],['gamay',['red','rose']]];
const withoutGrapes=(text:string)=>grapeColours.reduce((value,[name])=>` ${value} `.replaceAll(` ${name} `,' ').trim(),text);
// "Vieilles Vignes" (old vines) is a label mention, not part of the denomination,
// so "Bourgogne Aligoté Vieilles Vignes" in the appellation field still matches.
const withoutOldVines=(text:string)=>text.replace(/\bvieilles? vignes?\b/g,' ').replace(/\s+/g,' ').trim();
const withoutAccessoryGrapes=(text:string,names:readonly string[])=>
 names.reduce((value,name)=>` ${value} `.replaceAll(` ${name} `,' ').trim(),text);
// Sweetness (dosage) terms describe a sparkling wine, not a place, so
// "Bourgogne Mousseux Brut" still names the AOC. Still-wine maps keep "Sec"
// and similar words as unrecognised text.
const withoutDosage=(text:string)=>text.replace(/\b(?:brut nature|pas dose|dosage zero|extra brut|brut|extra sec|extra dry|demi sec|sec|doux)\b/g,' ').replace(/\s+/g,' ').trim();
const withoutLabelTerms=(text:string,accessoryGrapes:readonly string[]=[],sparkling=false)=>{
 const value=withoutOldVines(withoutGrapes(withoutAccessoryGrapes(text,accessoryGrapes)));
 return sparkling?withoutDosage(value):value;
};
const byLength=(a:string,b:string)=>b.length-a.length;
// Clairet, like rosé, can precede a denomination recorded in the wine name.
const bourgogneAppellations=['bourgogne','burgundy','bourgogne rouge','bourgogne blanc','bourgogne rose','bourgogne clairet'];
const groups=registry.maps.map(group=>({...group,keys:group.aliases.map(key).sort(byLength),regions:group.compatibleRegions.map(key),
 sparkling:(group as {productStyle?:string}).productStyle==='sparkling',
 accessoryKeys:((group as {accessoryGrapes?:string[]}).accessoryGrapes??[]).map(key),
 broad:!!(group as {broadAppellation?:boolean}).broadAppellation,
 blockedKeys:((group as {conflictingNames?:string[]}).conflictingNames??[]).map(key),
 // A split label requires its own base AOC: Mâcon + Fuissé is not Bourgogne + Fuissé.
 baseKeys:((group as {baseAppellations?:string[]}).baseAppellations??bourgogneAppellations).map(key),
 siteKeys:((group as {siteNames?:string[]}).siteNames??[]).map(key).sort(byLength),
 // Hyphenated site names (Solutré-Pouilly) match written either way.
 joinedSiteKeys:((group as {siteNames?:string[]}).siteNames??[]).flatMap(name=>[key(name),joinedKey(name)])}));
const higherNames=[...new Set([
 ...villages.villages.map(village=>key(village.name)),
 ...PLACES.filter(place=>place.id.startsWith('france/burgundy/')&&place.classification)
  .flatMap(place=>[place.name,...place.aliases].map(key)),
])];
const otherRegionals=[...registry.otherAppellations.map(key),...PLACES.filter(place=>place.id.startsWith('france/burgundy/')&&!place.classification&&place.tier==='appellation')
 .flatMap(place=>[place.name,...place.aliases].map(key))
 .filter(name=>!groups.some(group=>group.keys.includes(name))&&!['bourgogne rouge','bourgogne blanc'].includes(name))];
const conflictingNames=[...new Set([...higherNames,...otherRegionals,...groups.filter(group=>group.broad).flatMap(group=>group.keys)])];

// A village in a producer or landmark name (Château-Fuissé, Domaine de Fuissé,
// Cave de Charnay, Roche de Solutré) is not the denomination on the label.
// Nor is one hyphenated, on either side, into a longer proper name
// (Cave de Prissé-Sologny-Verzé).
const ownerWords=new Set(['de','du','des','d','chateau','domaine','cave','caves','cellier','maison','clos','roche',joined]);
const namesPlace=(text:string,name:string)=>{
 const words=` ${text} `,needle=` ${name} `;
 for(let at=words.indexOf(needle);at>=0;at=words.indexOf(needle,at+1)){
  const before=words.slice(0,at).trim().split(' ').pop()??'',after=words.slice(at+needle.length).split(' ')[0];
  if(!ownerWords.has(before)&&after!==joined)return true;
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
 // Normalise old-vine wording on split bases too, retaining colour/grape words.
 const plainAppellation=(group:typeof groups[number])=>group.baseKeys.includes(withoutOldVines(fields[0]));
 const joinedLabel=withoutProducer(joinedKey(wine.wineName??''),producer);
 const namesSite=(group:typeof groups[number])=>plainAppellation(group)&&group.joinedSiteKeys.some(name=>namesPlace(joinedLabel,name));
 // Chardonnay is also a grape: only a recorded full appellation establishes
 // that geographic denomination, never a grape description or split label.
 const specific=groups.filter(group=>!group.broad&&((group as {matchAppellationOnly?:boolean}).matchAppellationOnly
  ?group.keys.some(name=>contains(fields[0],name))
  :fields.some(text=>group.keys.some(name=>contains(text,name)))||namesSite(group)));
 // A broad AOC is established by the recorded appellation alone. Only use it
 // when no more specific denomination is present, including conflicting ones.
 // Exact suffix validation keeps Mâcon-Villages distinct from Mâcon and avoids
 // turning an unknown "Mâcon <place>" into a broad match.
 // Reviewed split labels can establish a separate broad AOC, such as
 // Bourgogne + Aligoté or Bourgogne Rouge + Passe-tout-grains.
 const split=specific.length?[]:groups.filter(group=>group.broad&&namesSite(group));
 const candidates=specific.length?specific:split.length?split:groups.filter(group=>group.broad&&group.keys.some(name=>
  fields[0]===name||fields[0].startsWith(name+' ')&&['','blanc','white','rouge','red','rose','clairet'].includes(withoutLabelTerms(fields[0].slice(name.length).trim(),group.accessoryKeys,group.sparkling))));
 if(!candidates.length)return undefined;
 if(candidates.length!==1||wine.identityMatchStatus==='conflict'||wine.classification)return null;
 const group=candidates[0],country=key(wine.country??''),region=key(wine.region??'');
 // Strip the broad name only after checking a competing broad identity. A
 // Mâcon-Villages label must not disappear into the generic word "Mâcon".
 if(group.broad&&fields.slice(1).some(text=>groups.some(other=>other.broad&&other.id!==group.id&&
  other.keys.some(name=>contains(withoutRegionalOrigin(text),name)&&!group.keys.some(own=>contains(own,name))))))return null;
 // Check full pending AOC names before stripping a broad prefix: removing
 // "Bourgogne" must not conceal "Bourgogne Aligoté" in a conflicting label.
 if(group.broad&&fields.some(text=>otherRegionals.some(name=>contains(text,name)&&!group.keys.some(own=>contains(own,name)))))return null;
 // Reviewed grape conflicts belong to each appellation, not every regional AOC.
 if(fields.some(text=>group.blockedKeys.some(name=>contains(text,name))))return null;
 if(country&&!['france','fr'].includes(country))return null;
 if(region&&!group.regions.includes(region)&&!group.keys.includes(region))return null;
 // The reviewed Joigny vin gris is rosé. A grape name such as Pinot Gris
 // alone is not colour evidence (the producer also uses it in white wine).
 const vinGris=group.featureId==='inao-denom-374';
 const normaliseColour=(value:string)=>vinGris&&['gris','vin gris'].includes(value)?'rose':value;
 const type=key(wine.productType??''),subtype=key(wine.productSubtype??''),style=normaliseColour(key(wine.wineStyle??''));
 // Sparkling is a product style, not a colour. Only explicitly reviewed AOCs
 // accept it; the app's red/white/rosé styles describe still wines (as in LWIN
 // matching). Unknown style is allowed when the recorded AOC establishes it.
 if(type&&!(group.sparkling?['wine','sparkling wine']:['wine','still wine']).includes(type))return null;
 if(subtype&&!(group.sparkling?['sparkling','sparkling wine']:['still','still wine']).includes(subtype))return null;
 if(style&&!(group.sparkling?['sparkling']:['red','white','rose']).includes(style))return null;
 const colourStyle=group.sparkling?'':style;
 const colour=normaliseColour(key(wine.colour??''))||colourStyle;
 if(colour&&!group.wineColours.includes(colour))return null;
 if(colourStyle&&colour&&colourStyle!==colour)return null;
 const removeFullDesignation=(text:string)=>group.keys
  .reduce((value,name)=>` ${value} `.replaceAll(` ${name} `,' ').trim(),text);
 // Check complete competing names before removing a split site name: stripping
 // "Fuissé" first would hide "Pouilly-Fuissé" on a contradictory Mâcon record.
 if(namesSite(group)&&higherNames.some(name=>contains(removeFullDesignation(wineLabel),name)))return null;
 const removeDesignation=(text:string)=>[...group.keys,...(namesSite(group)?group.siteKeys:[])]
  .reduce((value,name)=>` ${value} `.replaceAll(` ${name} `,' ').trim(),text);
 const app=fields[0];
 if(app&&!plainAppellation(group)&&
  (!group.keys.some(name=>contains(app,name))||!['','rouge','blanc','rose','clairet','red','white',...(vinGris?['gris','vin gris']:[])].includes(withoutLabelTerms(removeDesignation(app),group.accessoryKeys,group.sparkling))))return null;
 // A cuvée/reference name alone must not infer its regional denomination,
 // except a reviewed site name beside its explicit base appellation.
 if(!fields.slice(0,2).some(text=>group.keys.some(name=>contains(text,name)))&&!namesSite(group))return null;
 const remaining=fields.map((text,index)=>{
  if(index===1&&producer)text=` ${text} `.replaceAll(` ${producer} `,' ').trim();
  // Remove origin wording only after full denomination/conflict checks, so
  // "Vin de Bourgogne Aligoté" cannot become an apparently harmless "Aligoté".
  if(index!==0)text=withoutRegionalOrigin(text);
  return removeDesignation(text);
 });
 if(remaining.some((text,index)=>/\b(?:grands? crus?|premiers? crus?|1ers?|1st cru|cremant)\b/.test(text)||
  (!group.sparkling&&contains(text,'mousseux'))||
  (!(index===0&&plainAppellation(group))&&conflictingNames.some(name=>contains(text,name)))))return null;
 // Label colour must also agree with the denomination, even if the explicit
 // colour/style is absent. Côte d'Or does not include rosé.
 // Clairet is the traditional label word for a Bourgogne rosé.
 const labelColours=[['rouge','red'],['red','red'],['blanc','white'],['white','white'],['rose','rose'],['clairet','rose']] as const;
 // Pinot Blanc within a reviewed blend is a grape name, not a white label.
 const colourFields=remaining.slice(0,2).map(text=>withoutAccessoryGrapes(text,group.accessoryKeys));
 const namedColours=labelColours.filter(([name])=>colourFields.some(text=>contains(text,name))).map(([,value])=>value);
 if(vinGris&&(['gris','vin gris'].includes(remaining[0])||remaining.slice(0,2).some(text=>contains(text,'vin gris'))))namedColours.push('rose');
 if(new Set(namedColours).size>1)return null;
 if(namedColours.some(value=>!group.wineColours.includes(value)||(colour&&colour!==value)))return null;
 // Principal grape wording constrains colour. Reviewed accessory grapes do
 // not imply a white wine when blended into a red/rosé denomination.
 const grapes=plainAppellation(group)?[]:grapeColours.filter(([name])=>!group.accessoryKeys.includes(name)&&contains(remaining[0],name)).map(([,allowed])=>allowed);
 const explicit=colour||namedColours[0];
 const possible=group.wineColours.filter(value=>grapes.every(allowed=>allowed.includes(value))&&(!explicit||value===explicit));
 if(grapes.length&&!possible.length)return null;
 return {villageId:group.id,villageName:group.name,region:group.region,featureId:group.featureId,name:group.name,scope:'appellation',mapKind:'regional'};
}
