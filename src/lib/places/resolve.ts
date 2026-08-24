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

export function lookupPlace(value:string|null|undefined):PlaceNode[]{
  if(!value)return [];
  return byName.get(key(value))??[];
}

export type PlaceInput={country?:string|null;region?:string|null;appellation?:string|null};
export type ResolvedPlace={
  country:string|null;
  region:string|null;
  appellation:string|null;
  /** Root-to-leaf ids of the narrowest place that resolved, for roll-up counting. */
  path:string[];
  placeId:string|null;
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

  if(!anchor)return {
    country:trimmed(input.country),region:trimmed(input.region),appellation:trimmed(input.appellation),
    path:[],placeId:null,unresolved
  };

  const chain=ancestry(anchor);
  const at=(tier:PlaceTier)=>chain.find(step=>step.tier===tier)?.name??null;
  const belowRegion=TIER_DEPTH[anchor.tier]>TIER_DEPTH.region;
  return {
    country:at('country')??trimmed(input.country),
    region:at('region')??(belowRegion?null:anchor.name),
    // An area such as California is not a growing region; it stays in the
    // region column only because there is nothing narrower to put there.
    appellation:belowRegion?anchor.name:null,
    path:chain.map(step=>step.id),
    placeId:anchor.id,
    unresolved
  };
}

function trimmed(value:string|null|undefined){const text=value?.trim();return text||null}

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
  const leftMatches=lookupPlace(left),rightMatches=lookupPlace(right);
  if(!leftMatches.length||!rightMatches.length)return false;
  return leftMatches.some(a=>rightMatches.some(b=>a.id===b.id||isAncestor(a,b)||isAncestor(b,a)));
}

/** Every place id a wine sits inside, narrowest first, for roll-up counting. */
export function placeRollup(input:PlaceInput):string[]{
  return resolvePlace(input).path.slice().reverse();
}
