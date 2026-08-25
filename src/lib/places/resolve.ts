import { PLACES,type PlaceNode,type PlaceTier } from './hierarchy';

const key=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’'`]/g,'').replace(/[^a-z0-9]+/g,' ').trim();

const byId=new Map(PLACES.map(place=>[place.id,place]));

/**
 * Name (and alias) to node. A bare name can be ambiguous - "Chablis" is a
 * Burgundy subregion, "Ballard Canyon" is both a Santa Barbara appellation and
 * a region - so each key holds every candidate and the caller disambiguates
 * with whatever other places came alongside it.
 */
const byName=(()=>{
  const index=new Map<string,PlaceNode[]>();
  const add=(name:string,place:PlaceNode)=>{
    const normalized=key(name);
    if(!normalized)return;
    const bucket=index.get(normalized);
    if(bucket){if(!bucket.includes(place))bucket.push(place)}
    else index.set(normalized,[place]);
  };
  for(const place of PLACES){add(place.name,place);for(const alias of place.aliases)add(alias,place)}
  return index;
})();


const TIER_DEPTH:Record<PlaceTier,number>={country:0,area:1,region:2,subregion:3,appellation:4};

export function ancestry(place:PlaceNode):PlaceNode[]{
  const chain:PlaceNode[]=[];
  for(let current:PlaceNode|undefined=place;current;current=current.parent?byId.get(current.parent):undefined)chain.unshift(current);
  return chain;
}

const isAncestor=(candidate:PlaceNode,place:PlaceNode)=>ancestry(place).some(step=>step.id===candidate.id&&step.id!==place.id);

/**
 * Denomination tokens that trail a place name without being part of it. A
 * closed list, so stripping them is safe at any tier - unlike dropping an
 * arbitrary suffix, which is only allowed to reach a specific place.
 *
 * Without this the behaviour split on where the tree happened to file a place:
 * "Barolo DOCG" lost its suffix because Barolo is an appellation, while "Rioja
 * DOCa" and "Douro DOC" kept theirs because those are regions.
 */
const DENOMINATION=/ (?:docg|doca|doc|dop|do|igt|igp|aoc|aop|ava|dac|qba)$/;

/**
 * Ageing and selection tiers, longest first. These are not places and not crus -
 * a Barolo Riserva is neither a different appellation nor a grand cru - so they
 * come off the appellation the same way a denomination does. What they are not
 * is disposable: canonicalizeWineFields moves the term to the wine name, which
 * is where a label carries it.
 *
 * "Classico" is deliberately absent: Chianti Classico is its own appellation.
 */
export const AGEING_TERMS=['gran selezione','gran reserva','garrafeira','riserva','reserva','crianza','superiore'] as const;
const AGEING=new RegExp(` (?:${AGEING_TERMS.join('|')})$`);

/** The ageing tier a place value names, in the casing the label would use. */
export function ageingTerm(value:string|null|undefined):string|null{
  if(!value)return null;
  const match=AGEING.exec(key(value));
  if(!match)return null;
  return match[0].trim().replace(/\b[a-z]/g,letter=>letter.toUpperCase());
}

/**
 * A place name, or the longest known place it starts with.
 *
 * "Vosne-Romanée 1er Cru Les Suchots", "Vosne-Romanée Les Suchots" and plain
 * "Vosne Romanee Suchots" all name the Vosne-Romanée appellation - the climat
 * is part of the wine, not of the legal origin - and recognition writes all
 * three. Matching on a cru marker only caught the first, so the same wine still
 * landed under three different appellations.
 *
 * Only a place below the region tier may be reached by dropping a suffix. A
 * broader prefix would swallow the rest of the name: "Bourgogne Hautes Côtes de
 * Nuits" starts with "Bourgogne", and reading it as Burgundy would lose which
 * appellation the wine actually came from.
 */
export function lookupPlace(value:string|null|undefined):PlaceNode[]{
  if(!value)return [];
  const normalized=key(value);
  const exact=byName.get(normalized);
  if(exact)return exact;
  for(let trimmedValue=normalized;DENOMINATION.test(trimmedValue)||AGEING.test(trimmedValue);){
    trimmedValue=trimmedValue.replace(DENOMINATION,'').replace(AGEING,'');
    const match=byName.get(trimmedValue);
    if(match)return match;
  }
  // "Oakville, Napa Valley" is two places, not one name, and recognition writes
  // them in either order. Read every part and keep the narrowest, so the list
  // settles on the same appellation whichever way round it arrived.
  const parts=value.split(/[,/|;]/).map(part=>part.trim()).filter(Boolean);
  if(parts.length>1){
    const listed=parts.flatMap(part=>lookupPlace(part));
    if(listed.length)return [pickAnchor(listed)!];
  }
  const tokens=normalized.split(' ');
  for(let take=tokens.length-1;take>0;take-=1){
    const specific=(byName.get(tokens.slice(0,take).join(' '))??[]).filter(place=>TIER_DEPTH[place.tier]>TIER_DEPTH.region);
    if(specific.length)return specific;
  }
  return [];
}

/**
 * Where a wine sits in a classified hierarchy. `premier_cru` is never its own
 * appellation - Vosne-Romanée 1er Cru Les Suchots is recorded under the
 * Vosne-Romanée appellation - so it is read off the label text rather than the
 * tree, and the tier survives the place normalisation instead of being lost
 * with the climat.
 */
export type WineClassification='grand_cru'|'premier_cru'|'village';

const GRAND_CRU=/\bgrand[s]?\s+cru\b/;
const PREMIER_CRU=/\b(?:premier|1er|1ere)\s+cru\b/;

/**
 * Read the cru tier from whatever text the label gave us. The appellation field
 * is asked first; the wine name is the fallback, because recognition often puts
 * "1er Cru Les Suchots" there instead.
 *
 * "Saint-Émilion Grand Cru" is an appellation, not a classification, and would
 * otherwise read every Saint-Émilion as a grand cru - so a value that resolves
 * to a place in its own right is never read as a tier.
 */
export function classifyFromText(...values:readonly (string|null|undefined)[]):WineClassification|null{
  for(const value of values){
    if(!value)continue;
    const normalized=key(value);
    if(byName.has(normalized))continue;
    if(PREMIER_CRU.test(normalized))return 'premier_cru';
    if(GRAND_CRU.test(normalized))return 'grand_cru';
  }
  return null;
}

export type PlaceInput={country?:string|null;region?:string|null;appellation?:string|null;wineName?:string|null};
export type ResolvedPlace={
  country:string|null;
  region:string|null;
  appellation:string|null;
  /** Root-to-leaf ids of the narrowest place that resolved, for roll-up counting. */
  path:string[];
  placeId:string|null;
  /** The cru tier, from the label text where it says one and the tree otherwise. */
  classification:WineClassification|null;
  /**
   * The denomination in force at the narrowest place that resolved - DOCG, AOC,
   * AVA. Null unless the tree knows that place, because the denomination is a
   * legal fact about it and guessing one from the country would put "AVA"
   * beside any American name recognition happened to invent.
   */
  denomination:string|null;
  /** Input values that matched nothing in the tree, kept so nothing is silently dropped. */
  unresolved:string[];
};

/**
 * Choose the narrowest place any of the three inputs names, then derive the
 * levels from the tree instead of trusting which slot each value arrived in.
 *
 * "region: California, appellation: Napa Valley" and "region: Napa Valley,
 * appellation: Oakville" both anchor on the deepest node that resolves, so the
 * first becomes Napa Valley with no appellation and the second becomes Napa
 * Valley / Oakville - stable whichever way recognition slotted them.
 */
export function resolvePlace(input:PlaceInput):ResolvedPlace{
  const raw=[input.appellation,input.region,input.country];
  const candidates=raw.map(value=>({value,matches:lookupPlace(value)}));
  const anchor=pickAnchor(candidates.flatMap(entry=>entry.matches));
  const unresolved=candidates.filter(entry=>entry.value&&entry.value.trim()&&!entry.matches.length)
    .map(entry=>entry.value!.trim());

  // Text evidence outranks the tree: the tree says Vosne-Romanée is a village,
  // and "Vosne-Romanée 1er Cru Les Suchots" says this particular bottle is not.
  const spoken=classifyFromText(input.appellation,input.wineName);
  if(!anchor)return {
    country:trimmed(input.country),region:trimmed(input.region),appellation:trimmed(input.appellation),
    path:[],placeId:null,classification:spoken,denomination:null,unresolved
  };

  const chain=ancestry(anchor);
  const at=(tier:PlaceTier)=>chain.find(step=>step.tier===tier)?.name??null;
  const below=(place:PlaceNode)=>TIER_DEPTH[place.tier]>TIER_DEPTH.region;
  // What the appellation field itself named beats what another field implies:
  // given region Gevrey-Chambertin and appellation Charmes-Chambertin, the wine
  // is a Charmes, and reading the region field would quietly rewrite it.
  const own=pickAnchor(candidates[0].matches);
  // A name the tree does not carry is still the most specific thing known about
  // the wine, so it is kept verbatim rather than dropped - but with no node
  // behind it, there is nothing to read a denomination off.
  const verbatim=input.appellation?.trim()&&!candidates[0].matches.length?input.appellation.trim():null;
  const appellationNode=own&&below(own)?own:verbatim?null:below(anchor)?anchor:null;
  const appellation=appellationNode?.name??verbatim;
  return {
    country:at('country')??trimmed(input.country),
    // An area such as California is not a growing region; it stays in the
    // region column only because there is nothing narrower to put there.
    region:at('region')??(below(anchor)?null:anchor.name),
    appellation,
    path:chain.map(step=>step.id),
    placeId:anchor.id,
    classification:spoken??villageIfCertain((own??anchor).classification,candidates[0].value),
    // A verbatim appellation is the narrowest thing the wine names, and the tree
    // knows nothing about it - so the region's denomination is not the wine's.
    denomination:verbatim?null:denominationInForce(appellationNode??anchor),
    unresolved
  };
}

function trimmed(value:string|null|undefined){const text=value?.trim();return text||null}

/**
 * The denomination in force at a place: its own where it carries one, and its
 * country's otherwise. Most appellations do not name their scheme - the tree
 * marks Barolo as DOCG and lets the other 300 Italian entries inherit DOC from
 * Italy - so the answer is nearly always an inherited one.
 *
 * How far down an inherited default reaches is the country's to say. Old World
 * defaults stop at the appellation tier, because above it they are often simply
 * false: Bourgogne is an AOC but Burgundy is not, and Chianti is a DOCG but
 * Tuscany is nothing at all - so an Old World region says a denomination only
 * where the tree marks it with one, as Rioja and Priorat are. New World schemes
 * reach the region tier, where Napa Valley and Barossa Valley are themselves the
 * registration.
 */
function denominationInForce(place:PlaceNode|null):string|null{
  // A country's denomination is the default it lends its appellations, never a
  // statement about the country: France is not an AOC.
  if(!place||place.tier==='country')return null;
  if(place.denomination)return place.denomination;
  for(const step of ancestry(place).reverse()){
    if(!step.denomination)continue;
    return TIER_DEPTH[place.tier]>=TIER_DEPTH[step.denominationFrom??'appellation']?step.denomination:null;
  }
  return null;
}

/**
 * A village reading is only asserted when the appellation matched exactly.
 * "Vosne Romanee Suchots" reaches Vosne-Romanée by dropping a suffix we could
 * not interpret; that trailing text may well be a premier cru climat, so the
 * honest answer is that the tier is unknown rather than village. A grand cru
 * survives an inexact match, because there the named place is itself the cru.
 */
function villageIfCertain(classification:WineClassification|undefined,value:string|null|undefined){
  if(!classification)return null;
  if(classification!=='village')return classification;
  return value&&byName.has(key(value))?classification:null;
}

/**
 * The deepest candidate wins, and a candidate that sits under another candidate
 * settles an ambiguous name: "Chablis" alongside "Burgundy" is the Burgundy one.
 */
function pickAnchor(matches:readonly PlaceNode[]):PlaceNode|null{
  if(!matches.length)return null;
  const supported=matches.filter(place=>matches.some(other=>isAncestor(other,place)));
  const pool=supported.length?supported:matches;
  return [...pool].sort((a,b)=>TIER_DEPTH[b.tier]-TIER_DEPTH[a.tier]||a.id.localeCompare(b.id))[0];
}

/**
 * Whether two appellation strings can name the same wine's origin. "Napa
 * Valley" and "Oakville" describe one place at two depths, so a cuvée recorded
 * under either must not fork into two entities.
 */
export function placesCompatible(left:string|null|undefined,right:string|null|undefined){
  if(!left||!right)return true;
  if(key(left)===key(right))return true;
  // Exact nodes only. The premier-cru reading is right for deciding which field
  // a place belongs in, but too loose for identity: cuvee matching deliberately
  // keeps "Corton Grand Cru" and "Corton" apart on a weak signature match, and
  // stripping at the marker would quietly merge them.
  const leftMatches=byName.get(key(left))??[],rightMatches=byName.get(key(right))??[];
  if(!leftMatches.length||!rightMatches.length)return false;
  return leftMatches.some(a=>rightMatches.some(b=>a.id===b.id||isAncestor(a,b)||isAncestor(b,a)));
}

/** Every place id a wine sits inside, narrowest first, for roll-up counting. */
export function placeRollup(input:PlaceInput):string[]{
  return resolvePlace(input).path.slice().reverse();
}
