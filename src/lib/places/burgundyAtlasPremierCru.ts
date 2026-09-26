import type { WineFacts } from '../wine/detailFields';
import { burgundyAtlasWinePlace,type BurgundyAtlasPlace } from './burgundyAtlas';
import { PLACES } from './hierarchy';
import { placeKey } from './resolve';
import mapping from './burgundyAtlasPremierCruLinks.json';
import appellationMapping from './burgundyAtlasAppellationLinks.json';
import unmappedPremiers from './burgundyAtlasUnmappedPremierCruNames.json';
import villageMaps from './burgundyVillageMapRegistry.json';

type Wine=WineFacts&{classification?:string|null};
const nameKey=(value:string)=>placeKey(value.replace(/œ/g,'oe').replace(/Œ/g,'OE')).replace(/\bst\b/g,'saint');
const premierMarker=/\b(?:premier(?:s)?\s+cru(?:s)?|1er(?:\s*cru)?|1st\s+cru)\b/g;
const textKey=(value:string)=>nameKey(value).replace(premierMarker,' ').replace(/\b(?:aoc|aop)\b/g,' ').replace(/\s+/g,' ').trim();
const contains=(text:string,phrase:string)=>` ${text} `.includes(` ${phrase} `);
// Aux and Au are articles too: labels write Les Boudots (Jadot) or plain Boudots
// for Nuits' Aux Boudots. The omission is a non-exact fallback, so where both
// exist (Chambolle's Aux Combottes and Les Combottes) the exact name still wins.
const withoutArticle=(name:string)=>name.replace(/^(?:les|le|la|aux|au) /,'');
// Only static dictionary keys reach this cache, never wine text. Reuse compiled
// patterns across fields and renders; matchAll keeps their lastIndex untouched.
const patterns=new Map<string,RegExp>();
function patternFor(key:string){
  let pattern=patterns.get(key);
  if(!pattern){
    // The complete climat Le Clos must not consume the start of an unrelated
    // clos name. Reviewed longer names still match their own dictionary entry.
    const suffix=key==='le clos'?'(?![a-z0-9]| (?:de|des|du|d)\\b)':'(?![a-z0-9])';
    pattern=new RegExp(`(?<![a-z0-9])${key}${suffix}`,'g');patterns.set(key,pattern);
  }
  return pattern;
}
const placeFields=(wine:Wine)=>[wine.appellation,wine.wineName,wine.referenceSite,wine.referenceParcel].map(value=>value?.trim()??'');
const namesPremierCru=(wine:Wine)=>wine.classification==='premier_cru'||placeFields(wine).some(value=>nameKey(value).match(premierMarker));

function nameVariants(name:string){
  // "ou" alternatives are published names, not fuzzy spelling guesses. Article
  // omission is a fallback: an exact "Porusot" beats an alias of "Le Porusot".
  const names=[name,...name.split(/ ou /i)].map(nameKey);
  return [...new Set(names)].flatMap(key=>[
    {key,exact:true},...(withoutArticle(key)!==key&&withoutArticle(key)!=='clos'?[{key:withoutArticle(key),exact:false}]:[])
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
  // Armand Rousseau and most labels write Lavaux; INAO writes Lavaut.
  'Gevrey-Chambertin':{'Lavaut Saint-Jacques':['Lavaux Saint-Jacques']},
  'Vosne-Romanée':{'Les Petis Monts':['Les Petits Monts'],'Aux Raignots':['Aux Reignots']},
  'Nuits-Saint-Georges':{'Les Saints-Georges':['Les Saint-Georges']},
  // Domaine Leflaive's label spelling; the INAO/Atlas source writes Clavaillon.
  'Puligny-Montrachet':{'Clavaillon':['Clavoillon']},
  // Labels write Les Ruchottes (Ramonet) for the only Ruchottes Premier Cru,
  // Les Grandes Ruchottes; and Les Caillerets for Cailleret, the Premier Cru
  // covering Les Combards and Vigne Derrière. En Cailleret keeps its own name.
  // Château de la Maltroye spells its Clos du Château de la Maltroye, within
  // La Maltroie, with a y.
  'Chassagne-Montrachet':{'Les Grandes Ruchottes':['Les Ruchottes'],'Cailleret':['Les Caillerets'],'La Maltroie':['La Maltroye']},
  // Louis Latour writes Cent Vignes; Domaine de Montille writes Les Taillepieds.
  // Clos des Ursules (Jadot) and Clos des 60 Ouvrées (Pousse d'Or) are walled
  // Premier Crus beside Vignes Franches and Caillerets, not inside them, so
  // labels naming both select the clos as one name rather than two crus.
  // Labels (Lafon, Parent) write Epenottes; Pousse d'Or writes Jarollières;
  // Jean-Marc Boillot and Jadot write Saucilles; Henri Boillot writes Chevrets.
  'Beaune':{'Les Cents Vignes':['Les Cent Vignes'],'Clos des Ursules':['Les Vignes Franches Clos des Ursules'],'Les Epenotes':['Les Epenottes']},
  'Pommard':{'Les Jarolières':['Les Jarollières'],'Les Saussilles':['Les Saucilles']},
  'Volnay':{'Taille Pieds':['Les Taillepieds'],'En Chevret':['Chevret','Les Chevrets'],"Clos de la Bousse-d'Or":["Bousse d'Or"],
    'Clos des 60 ouvrées':['Les Caillerets Clos des 60 Ouvrées','Clos des 60 Ouvrées En Caillerets','Clos des Soixante Ouvrées','Les Caillerets Clos des Soixante Ouvrées']},
  // Morot names Bataillère with Vergelesses on older labels; the two INAO
  // boundaries are separate. Drouhin and Rapet also write Fournaux.
  'Savigny-lès-Beaune':{'Bataillère':['Clos de la Bataillère','La Bataillère aux Vergelesses'],'Aux Fourneaux':['Aux Fournaux']},
  // BIVB and producer labels use Bretterins; INAO writes Bréterins. Lafouge,
  // Buisson and Ampeau write Ecusseaux; INAO writes Ecussaux. La Chapelle is
  // formed from parts of Les Bréterins and Reugne, so a label naming either
  // with La Chapelle means La Chapelle.
  'Auxey-Duresses':{'Les Bréterins':['Les Bretterins'],'Les Ecussaux':['Les Ecusseaux'],
    'La Chapelle':['Les Bréterins La Chapelle','Les Bretterins La Chapelle','Les Bréterins dit La Chapelle','Les Bretterins dit La Chapelle','Reugne La Chapelle','Reugne dit La Chapelle']},
  // Changarnier writes singular Fulliot. Tricot's clos has no separate INAO
  // boundary: these names select the whole climat, explained in its map note.
  'Monthélie':{'Les Champs Fulliots':['Les Champs Fulliot','Clos des Champs Fulliot','Clos des Champs Fulliots','Clos Les Champs Fulliot']},
  // Mestre writes Passe-Temps; Monnot-Roche writes La Croix aux Moines.
  // Saint Marc uses singular Clos Roussot for INAO's Les Clos Roussots.
  'Santenay':{'Passetemps':['Passe-Temps']},
  'Maranges':{'Le Croix Moines':['La Croix aux Moines'],'Les Clos Roussots':['Clos Roussot']},
  // BIVB retains Jean de France in Rully's full climat name and writes
  // Crauzot in Givry; the INAO geometry calls the latter Crausot.
  'Rully':{'Clos du Chaigne':['Clos du Chaigne à Jean de France']},
  // Chamirey, Juillot and Devillard write Clos du Roi; d'Aligny and Chandesais
  // write Barraude; Thénard writes Cellier aux Moines without Clos du.
  'Mercurey':{'Le Clos du Roy':['Le Clos du Roi']},
  'Givry':{'Crausot':['Crauzot'],'Clos de la Baraude':['Clos de la Barraude'],'Clos du Cellier aux Moines':['Cellier aux Moines']},
  // Merlin's published label forms and Ferret's named subdivisions. Map the
  // full official climat, with a note explaining the missing producer boundary.
  'Pouilly-Fuissé':{'Aux Quarts':['Clos des Quarts'],'Au Vignerais':['Aux Vignerais'],
    'En France':['Clos de France'],'Les Perrières':['Le Clos de Jeanne','La Baudotte'],
    'Les Reisses':['Tournant de Pouilly'],
    // Albert Bichot writes Clos Reyssié; INAO and Matisco write Reyssier.
    'Le Clos Reyssier':['Le Clos Reyssié']}
};
// New Premier Cru appellations may have no named Atlas pages at all. Include
// their reviewed local names in the same matching and ambiguity rules.
const premierGroups=[...mapping.groups,...villageMaps.localPremierCrus
  .filter(local=>!mapping.groups.some(group=>group.appellation===local.appellation))
  .map(local=>({appellation:local.appellation,regionId:local.regionId,entries:[]}))];
const groups=premierGroups.map(group=>({...group,key:nameKey(group.appellation),entries:[
  ...group.entries.map(entry=>({...entry,matchId:entry.path.split('/')[2]})),
  ...(villageMaps.localPremierCrus.find(local=>local.appellation===group.appellation)?.entries??[]).map(entry=>({...entry,path:null})),
  // A known climat without geometry must participate in ambiguity and tier
  // checks, so it cannot disappear from a mixed label and select its neighbour.
  ...(villageMaps.localPremierCrus.find(local=>local.appellation===group.appellation)?.unmappedNames??[]).map(name=>({name,path:null,matchId:null}))
].map(entry=>
  ({...entry,variants:[entry.name,...(reviewedNameAliases[group.appellation]?.[entry.name]??[])].flatMap(nameVariants)
    .map(variant=>({...variant,pattern:patternFor(variant.key)}))}))}));
type Group=typeof groups[number];
const umbrellas:Record<string,string[]>=villageMaps.umbrellas;
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
  const crus=matches(text,group),characters=[...text];let named=false,firstEnd=0;
  for(const match of text.matchAll(patternFor(group.key))){
    const start=match.index!,end=start+match[0].length;
    // Blagny inside "Sous Blagny" is part of the climat, not evidence of the
    // appellation (the same climat name also exists under Meursault).
    if(crus.some(cru=>cru.start<=start&&cru.end>=end&&cru.end-cru.start>end-start))continue;
    characters.fill(' ',start,end);if(!named)firstEnd=end;named=true;
  }
  const collapse=(value:string[])=>value.join('').replace(/\s+/g,' ').trim();
  // What follows the first village name: in a title, the text before it is
  // producer text.
  return {text:collapse(characters),named,after:collapse(characters.slice(firstEnd))};
}

// Producer names are not blends: Bouchard Père & Fils, Mestre Père et Fils,
// Pierre Morey et Fils.
// Family phrases leave the title before a conjunction is read as a blend.
const producerPhrase=/\b(?:pere|mere|freres?|fils|filles?|soeurs?|enfants|cousins?)(?: et (?:fils|filles?|freres?|soeurs?|enfants|cousins?|cie))+\b|\bet (?:cie|fils|filles|freres|soeurs)\b/g;
const titleKey=(value:string)=>textKey(value.replace(/&/g,' et ')).replace(producerPhrase,' ').replace(/\s+/g,' ').trim();

const regionNames=PLACES.filter(place=>place.id.startsWith('france/burgundy')).flatMap(place=>
  [place.name,...place.aliases].map(name=>({key:nameKey(name),id:place.id})));
function compatibleRegion(region:string,group:{key:string;regionId:string}){
  return !region||region===group.key||regionNames.some(place=>place.key===region&&
    (group.regionId===place.id||group.regionId.startsWith(`${place.id}/`)));
}

/** A Premier Cru needs both the named vineyard and its village appellation.
 * Sites with the same name in different villages are separate Atlas records.
 * This is wine-detail matching only; the Grand Cru collection matcher stays exact. */
type PremierCruIdentity={placeId:string;name:string;url:string|null};
function premierCruIdentity(wine:Wine):PremierCruIdentity|null{
  if(wine.identityMatchStatus==='conflict'||(wine.classification&&wine.classification!=='premier_cru'))return null;
  if(wine.country?.trim()&&nameKey(wine.country)!=='france')return null;
  const raw=placeFields(wine);
  // The classification marker matters: several climats include village-level
  // land as well. A bare vineyard name does not establish Premier Cru status.
  if(!namesPremierCru(wine))return null;
  // An ampersand in the title is read as "et" below, so a producer's "&" is
  // judged like any other conjunction; elsewhere it still marks a blend.
  if(raw.some((value,index)=>/\b(?:grand\s+cru|blend|assemblage|melange|multi(?:ple)? (?:plots|parcelles|climats|vineyards))\b/.test(nameKey(value))||
    (index===1?/[/+]/:/[/&+]/).test(value)))return null;
  const fields=raw.map((value,index)=>index===1?titleKey(value):textKey(value)),region=textKey(wine.region??'');
  const destinations:PremierCruIdentity[]=[];
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
      // In a title that names the village, a conjunction before it belongs to
      // the producer (Domaine Vincent et Sophie Morey Santenay Les Gravières);
      // after it, it still marks a blend (Les Gravières et Clos Genet).
      const {after,named}=separated[index],joined=index===1&&named?remainder(after,matches(after,group)):rest;
      if(groups.some(other=>other!==group&&contains(rest,other.key))||/\b(?:et|and|ou)\b/.test(joined)){
        invalid=true;break;
      }
      // Appellation and reference fields must name a whole place. Only the
      // wine title can contain producer/vintage text around a named climat.
      const whole=!rest||(found.length>0&&/^(?:les|le|la)$/.test(rest));
      if(index===0&&!whole){invalid=true;break}
      if(index===1||whole)for(const match of found)candidates.add(match.entry);
    }
    if(invalid)continue;
    // Ferret historically called its Clos de Jeanne cuvée "Le Clos". It is
    // not Château Fuissé's separate Le Clos climat. Require an unambiguous
    // modern name rather than highlighting the wrong producer's vineyard.
    if(group.key==='pouilly fuisse'&&contains(fields[1],'ferret')&&
      [...candidates].some(entry=>entry.name==='Le Clos'))continue;
    // A label may name a wider Premier Cru with a cru inside it: Meursault-Blagny
    // Sous le Dos d'Ane, Morgeot Clos Pitois. The wider name gives way to the
    // inner cru; two unrelated crus stay ambiguous.
    const named=[...candidates],ids=named.map(entry=>entry.matchId);
    const [entry,...others]=named.filter(entry=>!entry.matchId||!(umbrellas[entry.matchId]??[]).some(inner=>ids.includes(inner)));
    if(!entry?.matchId||others.length)continue;
    destinations.push({placeId:entry.matchId,name:`${group.appellation} — ${entry.name}`,
      url:entry.path?`https://burgundyatlas.com${entry.path}`:null});
  }
  return destinations.length===1?destinations[0]:null;
}

/** A local boundary never manufactures a named Atlas link. */
export function burgundyAtlasPremierCru(wine:Wine):BurgundyAtlasPlace|null{
  const match=premierCruIdentity(wine);
  return match?.url?{...match,url:match.url}:null;
}

// Local appellations use the same geographic and tier checks as Atlas places,
// but never manufacture an outbound link when Atlas has no corresponding page.
const appellations=[
  ...appellationMapping.groups.map(group=>({...group,villageMatchId:null as string|null,
    premierCruMatchId:villageMaps.localAppellations.find(local=>local.appellation===group.appellation)?.premierCruMatchId??null})),
  ...villageMaps.localAppellations.filter(local=>!appellationMapping.groups.some(group=>group.appellation===local.appellation))
    .map(group=>({...group,villagePath:null,premierCruPath:null}))
].map(group=>({...group,key:nameKey(group.appellation),
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

/** Local appellations and named crus share all wine identity safeguards. */
export function burgundyLocalAppellationMapIdentity(wine:Wine):string|null{
  const tier=namesPremierCru(wine)?'premier_cru':'village';
  const group=wineAppellation(wine,tier);
  if(group&&tier==='premier_cru'){
    const match=premierCruIdentity(wine);
    if(match?.url===null)return match.placeId;
  }
  return group?.[tier==='premier_cru'?'premierCruMatchId':'villageMatchId']??null;
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
