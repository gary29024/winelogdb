import { resolvePlace } from '../places/resolve';
import type { PlaceClassification } from '../places/hierarchy';
import type { wineStyles } from '../db/schema';

type WineStyle=typeof wineStyles[number];

/** Years after the vintage, inclusive at both ends. */
export type MaturityWindow={from:number;to:number};

/**
 * How long a wine from somewhere tends to be worth keeping.
 *
 * A rule of thumb, and it says so wherever it is shown. It is not research and
 * it knows nothing about the vintage, the producer or the bottle - a great year
 * lengthens the window and a poor one shortens it, and neither is in here. What
 * it is instead is free: no request, no token, and an answer for every wine in
 * the journal rather than only the ones somebody has paid to research.
 *
 * Keyed on the place tree's own ids, so a window is found by walking the
 * ancestry from the narrowest place named to the broadest - Barolo before
 * Piedmont before Italy - and the first entry that answers wins. Adding a
 * region is one line, and nothing else has to know.
 *
 * Where a place carries cru tiers, byTier outranks byStyle: a grand cru is a
 * different wine from the village wine beside it, and much the longer keeper.
 */
type AgeingEntry={
  default?:MaturityWindow;
  byStyle?:Partial<Record<WineStyle,MaturityWindow>>;
  byTier?:Partial<Record<PlaceClassification,MaturityWindow>>;
};

const w=(from:number,to:number):MaturityWindow=>({from,to});

/**
 * What a style keeps for when nothing narrower is known. Deliberately modest:
 * most wine in the world is made to drink, and a window that flatters
 * everything would be worth nothing.
 */
const BY_STYLE:Record<WineStyle,MaturityWindow>={
  red:w(2,8),white:w(1,5),rose:w(0,2),sparkling:w(1,5),
  dessert:w(3,20),fortified:w(3,30),orange:w(1,6),other:w(1,5)
};

/**
 * Bottlings that outlive the rule of thumb for where they are made.
 *
 * The table below answers by place, which is right almost everywhere: what a
 * Pommard keeps for is a fact about Pommard. Champagne is where it breaks. A
 * vintage Champagne is filed under one window for the whole region, and a
 * prestige cuvee is not that wine - a Salon or a Krug is built to be opened at
 * twenty-five years and is only starting at fifteen, so the region's figure
 * reads them as past their peak while they are still climbing. The difference
 * is the house and the cuvee, and no amount of place data will ever carry it.
 *
 * So this is the exception, and it is deliberately a short, named list rather
 * than a rule. It claims nothing about a wine it does not name: an unlisted
 * Champagne falls through to the region exactly as before, which is the right
 * answer for most of them. Adding one is a line, and the label is what the
 * screen will say the window came from - so it has to be the name a person
 * would recognise.
 *
 * `within` keeps each entry inside the place it is about, so a producer
 * somewhere else who happens to share a name cannot inherit a Champagne window.
 */
type Keeper={
  /** What the screen calls the answer: "Typical for Dom Perignon". */
  label:string;
  /** Matched against the producer and the wine name together, normalised. */
  match:RegExp;
  /** A second pattern, where a house makes both long and short keepers. */
  cuvee?:RegExp;
  /** The place-tree id this only counts inside. */
  within:string;
  window:MaturityWindow;
};

const CHAMPAGNE='france/champagne';

const KEEPERS:readonly Keeper[]=[
  // Houses whose vintage wines are long keepers whatever the bottling.
  {label:'Salon',match:/\bsalon\b/,within:CHAMPAGNE,window:w(12,45)},
  {label:'Krug',match:/\bkrug\b/,within:CHAMPAGNE,window:w(10,40)},
  // Bollinger makes both, so the cuvee decides.
  {label:'Bollinger',match:/\bbollinger\b/,cuvee:/\bgrande annee\b|\br d\b|\bvieilles vignes\b/,within:CHAMPAGNE,window:w(8,35)},
  // Named prestige cuvees.
  {label:'Dom Perignon',match:/\bdom perignon\b/,within:CHAMPAGNE,window:w(8,35)},
  {label:'Cristal',match:/\bcristal\b/,within:CHAMPAGNE,window:w(8,35)},
  {label:'Clos des Goisses',match:/\bclos des goisses\b/,within:CHAMPAGNE,window:w(8,35)},
  {label:'Blanc des Millenaires',match:/\bblanc des millenaires\b/,within:CHAMPAGNE,window:w(10,35)},
  {label:'Comtes de Champagne',match:/\bcomtes de champagne\b/,within:CHAMPAGNE,window:w(8,30)},
  {label:'Dom Ruinart',match:/\bdom ruinart\b/,within:CHAMPAGNE,window:w(8,30)},
  {label:'Sir Winston Churchill',match:/\bwinston churchill\b/,within:CHAMPAGNE,window:w(8,30)},
  {label:'La Grande Dame',match:/\bgrande dame\b/,within:CHAMPAGNE,window:w(7,30)},
  {label:'Grand Siecle',match:/\bgrand siecle\b/,within:CHAMPAGNE,window:w(6,30)},
  {label:'Belle Epoque',match:/\bbelle epoque\b/,within:CHAMPAGNE,window:w(6,25)},
  {label:'Cuvee William Deutz',match:/\bwilliam deutz\b/,within:CHAMPAGNE,window:w(6,25)}
];

/** Accents off, punctuation to spaces: "R.D." and "Perrier-Jouet" have to match. */
const plainName=(value:unknown)=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

/**
 * The house and the cuvee are read together, because which field a name lands
 * in is not reliable: Dom Perignon is a producer on one bottle and a cuvee
 * under Moet on the next, and a scan can put the house in front of the wine
 * name as well as in the producer box.
 */
function keeperFor(producer:unknown,wineName:unknown,path:readonly string[]):Maturity|null{
  const text=plainName(`${String(producer??'')} ${String(wineName??'')}`);
  if(!text)return null;
  for(const keeper of KEEPERS){
    if(!path.includes(keeper.within))continue;
    if(!keeper.match.test(text))continue;
    if(keeper.cuvee&&!keeper.cuvee.test(text))continue;
    return {window:keeper.window,basis:{placeId:null,label:keeper.label}};
  }
  return null;
}

const AGEING:Record<string,AgeingEntry>={
  // France
  'france/burgundy':{byStyle:{red:w(4,12),white:w(3,10)},
    byTier:{village:w(3,10),premier_cru:w(5,15),grand_cru:w(8,25)}},
  'france/burgundy/chablis':{byStyle:{white:w(2,8)},byTier:{premier_cru:w(3,12),grand_cru:w(5,18)}},
  'france/burgundy/maconnais':{byStyle:{white:w(1,6)}},
  'france/beaujolais':{byStyle:{red:w(1,5)}},
  'france/bordeaux':{byStyle:{red:w(4,15),white:w(2,8)},byTier:{grand_cru:w(8,30)}},
  'france/bordeaux/medoc':{byStyle:{red:w(6,25)}},
  'france/bordeaux/right-bank':{byStyle:{red:w(5,20)}},
  'france/bordeaux/graves/pessac-leognan':{byStyle:{red:w(5,20),white:w(3,15)}},
  'france/bordeaux/graves/sauternes':{default:w(5,40)},
  'france/bordeaux/graves/barsac':{default:w(5,40)},
  'france/champagne':{byStyle:{sparkling:w(3,15)},byTier:{grand_cru:w(5,20)}},
  'france/rhone/northern-rhone':{byStyle:{red:w(5,20),white:w(2,10)}},
  'france/rhone/northern-rhone/hermitage':{byStyle:{red:w(8,30)}},
  'france/rhone/northern-rhone/cote-rotie':{byStyle:{red:w(6,25)}},
  'france/rhone/northern-rhone/cornas':{byStyle:{red:w(6,25)}},
  'france/rhone/southern-rhone':{byStyle:{red:w(3,12)}},
  'france/rhone/southern-rhone/chateauneuf-du-pape':{byStyle:{red:w(5,20)}},
  'france/alsace':{byStyle:{white:w(2,10)},byTier:{grand_cru:w(5,20)}},
  'france/loire/vouvray':{byStyle:{white:w(3,20),sparkling:w(2,10),dessert:w(10,40)}},
  'france/loire/savennieres':{byStyle:{white:w(3,15)}},
  'france/loire/sancerre':{byStyle:{white:w(1,6),red:w(2,8)}},
  'france/loire/chinon':{byStyle:{red:w(3,12)}},
  'france/loire/coteaux-du-layon':{default:w(5,30)},
  'france/provence/bandol':{byStyle:{red:w(5,20),rose:w(1,4)}},
  'france/provence':{byStyle:{rose:w(0,2)}},
  'france/south-west-france/madiran':{byStyle:{red:w(5,20)}},
  'france/south-west-france/cahors':{byStyle:{red:w(4,15)}},
  'france/jura/chateau-chalon':{byStyle:{white:w(10,50)}},
  'france/jura':{byStyle:{white:w(3,15),red:w(2,10)}},
  // Italy
  'italy/piedmont/barolo':{byStyle:{red:w(8,25)}},
  'italy/piedmont/barbaresco':{byStyle:{red:w(6,20)}},
  'italy/piedmont':{byStyle:{red:w(2,10),white:w(1,4),sparkling:w(0,2)}},
  'italy/tuscany/brunello-di-montalcino':{byStyle:{red:w(6,25)}},
  'italy/tuscany/chianti-classico':{byStyle:{red:w(3,12)}},
  'italy/tuscany/bolgheri':{byStyle:{red:w(5,20)}},
  'italy/tuscany/bolgheri-sassicaia':{byStyle:{red:w(8,30)}},
  'italy/tuscany/vino-nobile-di-montepulciano':{byStyle:{red:w(4,15)}},
  'italy/veneto/amarone-della-valpolicella':{byStyle:{red:w(5,20)}},
  'italy/veneto/valpolicella':{byStyle:{red:w(1,6)}},
  'italy/veneto/soave':{byStyle:{white:w(1,6)}},
  'italy/veneto/prosecco':{byStyle:{sparkling:w(0,2)}},
  'italy/sicily/etna':{byStyle:{red:w(3,12),white:w(2,8)}},
  'italy/campania/taurasi':{byStyle:{red:w(5,20)}},
  'italy/umbria/montefalco-sagrantino':{byStyle:{red:w(6,20)}},
  'italy/lombardy/franciacorta':{byStyle:{sparkling:w(2,10)}},
  'italy/lombardy/valtellina':{byStyle:{red:w(4,15)}},
  'italy/basilicata/aglianico-del-vulture':{byStyle:{red:w(5,18)}},
  // Iberia
  'spain/rioja':{byStyle:{red:w(4,15),white:w(2,10)}},
  'spain/ribera-del-duero':{byStyle:{red:w(5,18)}},
  'spain/priorat':{byStyle:{red:w(5,18)}},
  'spain/rias-baixas':{byStyle:{white:w(1,4)}},
  'spain/castilla-y-leon/toro':{byStyle:{red:w(4,15)}},
  'spain/jerez':{byStyle:{fortified:w(0,10)}},
  'portugal/douro/port':{byStyle:{fortified:w(10,40)}},
  'portugal/douro':{byStyle:{red:w(4,15)}},
  'portugal/madeira':{byStyle:{fortified:w(5,50)}},
  'portugal/dao':{byStyle:{red:w(3,12)}},
  // Germany and Austria
  'germany/mosel':{byStyle:{white:w(3,20)}},
  'germany/rheingau':{byStyle:{white:w(3,15)}},
  'germany/pfalz':{byStyle:{white:w(2,12)}},
  'germany':{byStyle:{white:w(2,10),red:w(2,8)}},
  'austria/wachau':{byStyle:{white:w(2,12)}},
  'austria':{byStyle:{white:w(2,8),red:w(2,8)}},
  // New World
  'united-states/california/north-coast/napa-valley':{byStyle:{red:w(5,20),white:w(2,6)}},
  'united-states/california/north-coast/sonoma-county':{byStyle:{red:w(3,12),white:w(1,5)}},
  'united-states/oregon/willamette-valley':{byStyle:{red:w(3,12),white:w(1,6)}},
  'united-states/washington/columbia-valley':{byStyle:{red:w(4,15)}},
  'australia/south-australia/barossa-valley':{byStyle:{red:w(5,20)}},
  'australia/south-australia/clare-valley':{byStyle:{white:w(3,15),red:w(3,12)}},
  'australia/south-australia/eden-valley':{byStyle:{white:w(3,15),red:w(4,15)}},
  'australia/south-australia/coonawarra':{byStyle:{red:w(5,18)}},
  'australia/victoria/yarra-valley':{byStyle:{red:w(3,12)}},
  'australia/new-south-wales/hunter-valley':{byStyle:{white:w(3,20),red:w(3,12)}},
  'new-zealand/marlborough':{byStyle:{white:w(1,4)}},
  'new-zealand/central-otago':{byStyle:{red:w(3,10)}},
  'argentina/mendoza':{byStyle:{red:w(3,12)}},
  'chile/maipo-valley':{byStyle:{red:w(4,15)}},
  'south-africa/stellenbosch':{byStyle:{red:w(4,15),white:w(2,8)}},
  // Elsewhere
  'greece/santorini':{byStyle:{white:w(2,10)}},
  'hungary/tokaj':{byStyle:{dessert:w(5,30),white:w(2,10)}},
  'united-kingdom':{byStyle:{sparkling:w(2,10)}}
};

export type MaturityBasis={
  /** The place the window came from, or null where only the style answered. */
  placeId:string|null;
  /** What to call it on screen: "Barolo", "a red wine". */
  label:string;
};
export type Maturity={window:MaturityWindow;basis:MaturityBasis};

const fromEntry=(entry:AgeingEntry,classification:PlaceClassification|null,style:WineStyle|null)=>
  (classification&&entry.byTier?.[classification])??(style&&entry.byStyle?.[style])??entry.default??null;

/**
 * The window for a wine, and where the answer came from.
 *
 * Never guesses at a style it was not given: a wine with no style falls to the
 * place's default where it has one, and to nothing where it does not, rather
 * than being quietly treated as red.
 */
export function maturityFor(wine:{country?:string|null;region?:string|null;appellation?:string|null;
  classification?:string|null;wineStyle?:string|null;
  /** Read only by the keeper list, and only to recognise a named bottling. */
  producer?:string|null;wineName?:string|null}):Maturity|null{
  const style=(wine.wineStyle??null) as WineStyle|null;
  const classification=(wine.classification??null) as PlaceClassification|null;
  const place=resolvePlace({country:wine.country??null,region:wine.region??null,appellation:wine.appellation??null});
  // A named bottling outranks its region, because it is the more specific fact
  // about the wine in the glass and the one the region cannot express.
  const keeper=keeperFor(wine.producer,wine.wineName,place.path);
  if(keeper)return keeper;
  // Narrowest first: Barolo before Piedmont before Italy.
  for(const placeId of [...place.path].reverse()){
    const entry=AGEING[placeId];
    if(!entry)continue;
    const window=fromEntry(entry,classification,style);
    if(window)return {window,basis:{placeId,label:place.appellation??place.region??place.country??placeId}};
  }
  if(!style)return null;
  return {window:BY_STYLE[style],basis:{placeId:null,label:`a ${style} wine`}};
}

export type Readiness='hold'|'ready'|'mature'|'past-peak';
export type MaturityVerdict=Maturity&{
  readiness:Readiness;
  /** Years until the window opens, where it has not. */
  opensIn:number;
  /** The years the window spans, as calendar years. */
  drinkFrom:number;drinkTo:number;
};

/**
 * Where a bottle sits in its window this year.
 *
 * "mature" is the last third rather than a second date: a wine does not fall
 * off a cliff, and saying "drink it" a year before the end is more use than
 * saying "ready" until the day it is not.
 */
export function maturityVerdict(wine:Parameters<typeof maturityFor>[0]&{vintage?:number|null},
  year=new Date().getFullYear()):MaturityVerdict|null{
  const vintage=wine.vintage;
  // Non-vintage is not a young wine, it is a wine with no clock. Saying nothing
  // is the honest answer.
  if(vintage==null||!Number.isFinite(vintage))return null;
  const maturity=maturityFor(wine);
  if(!maturity)return null;
  const {from,to}=maturity.window,age=year-vintage;
  const readiness:Readiness=age<from?'hold':age>to?'past-peak':age>=from+(to-from)*2/3?'mature':'ready';
  return {...maturity,readiness,opensIn:Math.max(0,from-age),drinkFrom:vintage+from,drinkTo:vintage+to};
}

/** How the window reads on screen: "2028–2038". */
export const windowLabel=(verdict:Pick<MaturityVerdict,'drinkFrom'|'drinkTo'>)=>`${verdict.drinkFrom}–${verdict.drinkTo}`;

export const readinessLabel:Record<Readiness,string>={
  hold:'Too young',ready:'Ready',mature:'Drink up',['past-peak']:'Past its window'
};
