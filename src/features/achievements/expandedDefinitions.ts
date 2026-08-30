import type { AchievementDefinition,AchievementDefinitionItem } from './types';

const slug=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[’'`]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
type NamedEntry=string|readonly [string,...string[]];
const names=(entry:NamedEntry)=>typeof entry==='string'?[entry]:[entry[0],...entry.slice(1)];
const producerItems=(prefix:string,entries:readonly NamedEntry[]):AchievementDefinitionItem[]=>entries.map(entry=>{const [label,...aliases]=names(entry);return {id:`${prefix}-${slug(label)}`,label,selector:{type:'producer',producerNames:[label,...aliases]}}});
/**
 * Which heading each estate belongs under, keyed by the item id the checklist
 * will carry.
 *
 * Built from the very arrays that build the items, so the two cannot disagree -
 * and keyed by id rather than by position, because the checklist is served from
 * a per-owner cache that can be a release behind. An out-of-date order makes a
 * position-keyed heading confidently wrong: Château Pape Clément was shown as
 * classified for white, which it is not. Wrong facts about real wines are worse
 * than an oddly grouped list, so the estate carries its own answer.
 */
export type ChecklistHeading={section:string;subsection:string|null};
type SectionGroup={section:string;subsection?:string;entries:readonly NamedEntry[]};
const sectionsById=(prefix:string,groups:readonly SectionGroup[])=>{
  const result:Record<string,ChecklistHeading>={};
  for(const group of groups)
    for(const entry of group.entries)
      result[`${prefix}-${slug(names(entry)[0])}`]={section:group.section,subsection:group.subsection??null};
  return result;
};

const appellationItems=(prefix:string,entries:readonly string[],grandCru=false):AchievementDefinitionItem[]=>entries.map(label=>{
  const variants=grandCru&&!/grand cru/i.test(label)?[label,`${label} Grand Cru`,`Grand Cru ${label}`]:[label];
  return {id:`${prefix}-${slug(label)}`,label,selector:{type:'appellation',appellationNames:[...variants,`${label} AOC`,`AOC ${label}`]}};
});

const gcc1855='https://gcc-1855.fr/classement-grands-crus-classes-1855/';
const graves='https://www.crus-classes-de-graves.com/en/presentation/';
const saintEmilion='https://www.inao.gouv.fr/node/32334/printable/print';
const burgundy='https://www.bourgogne-wines.com/our-wines-our-terroir/the-bourgogne-winegrowing-region-and-its-appellations/the-bourgogne-winegrowing-region-an-ideal-location%2C2458%2C9253.html';
const rhone='https://www.vins-rhone.com/en/wine-school/glossary/crus';

const firstGrowths:readonly NamedEntry[]=[
  ['Château Lafite Rothschild','Château Lafite-Rothschild'],
  'Château Latour','Château Margaux',
  ['Château Mouton Rothschild','Château Mouton-Rothschild'],
  'Château Haut-Brion'
];
const secondGrowths:readonly NamedEntry[]=[
  ['Château Rauzan-Ségla','Château Rausan-Ségla'],
  ['Château Rauzan-Gassies','Château Rausan-Gassies'],
  ['Château Léoville Las Cases','Château Léoville-Las-Cases'],
  ['Château Léoville-Poyferré','Château Leoville Poyferre'],
  ['Château Léoville Barton','Château Leoville Barton'],
  'Château Durfort-Vivens','Château Gruaud Larose','Château Lascombes','Château Brane-Cantenac',
  ['Château Pichon Baron','Château Pichon Longueville Baron'],
  ['Château Pichon Longueville Comtesse de Lalande','Château Pichon Comtesse de Lalande','Pichon Comtesse'],
  'Château Ducru-Beaucaillou',"Château Cos d’Estournel",'Château Montrose'
];
const thirdGrowths:readonly NamedEntry[]=[
  'Château Kirwan',"Château d’Issan",'Château Lagrange','Château Langoa Barton','Château Giscours','Château Malescot Saint-Exupéry','Château Boyd-Cantenac','Château Cantenac Brown','Château Palmer','Château La Lagune','Château Desmirail','Château Calon-Ségur','Château Ferrière',"Château Marquis d’Alesme"
];
const fourthGrowths:readonly NamedEntry[]=[
  'Château Saint-Pierre','Château Talbot','Château Branaire-Ducru','Château Duhart-Milon','Château Pouget','Château Prieuré-Lichine','Château Marquis de Terme','Château Lafon-Rochet','Château Beychevelle','Château La Tour Carnet'
];
const fifthGrowths:readonly NamedEntry[]=[
  'Château Pontet-Canet','Château Batailley','Château Haut-Batailley','Château Grand-Puy-Lacoste','Château Grand-Puy Ducasse','Château Lynch-Bages','Château Lynch-Moussas','Château Dauzac',"Château d’Armailhac",'Château du Tertre','Château Haut-Bages Libéral','Château Pédesclaux','Château Belgrave','Château de Camensac','Château Cos Labory','Château Clerc Milon','Château Croizet-Bages','Château Cantemerle'
];
const red1855=[...firstGrowths,...secondGrowths,...thirdGrowths,...fourthGrowths,...fifthGrowths] as const;
const red1855Appellations=['Pauillac','Margaux','Saint-Julien','Saint-Estèphe','Haut-Médoc','Pessac-Léognan'] as const;

const sauternesPremierSuperieur:readonly NamedEntry[]=["Château d’Yquem"];
const sauternesPremiers:readonly NamedEntry[]=[
  'Château La Tour Blanche','Château Lafaurie-Peyraguey','Clos Haut-Peyraguey','Château de Rayne-Vigneau','Château Suduiraut','Château Coutet','Château Climens','Château Guiraud','Château Rieussec','Château Rabaud-Promis','Château Sigalas-Rabaud'
];
const sauternesTop=[...sauternesPremierSuperieur,...sauternesPremiers] as const;
const sauternesSecond:readonly NamedEntry[]=[
  'Château de Myrat','Château Doisy Daëne','Château Doisy-Dubroca','Château Doisy-Védrines',"Château d’Arche",'Château Filhot','Château Broustet','Château Nairac','Château Caillou','Château Suau','Château de Malle','Château Romer','Château Romer-du-Hayot','Château Lamothe','Château Lamothe-Guignard'
];
const sauternes1855=[...sauternesTop,...sauternesSecond] as const;

/**
 * The Graves classification does not rank; it classifies an estate for red, for
 * white, or for both, which is the only division it has. Ordered by that so the
 * checklist can head each run - the detail page groups consecutive items, so a
 * heading needs its estates together.
 *
 * The counts come out at twelve classified for red and eight for white, against
 * the thirteen and nine of 1959. The difference is exactly the two estates since
 * absorbed into Château La Mission Haut-Brion: La Tour Haut-Brion for the red
 * and Laville Haut-Brion for the white. La Mission is filed under red, which is
 * how the Union des Crus Classés de Graves lists it today.
 */
const gravesRedAndWhite:readonly NamedEntry[]=[
  'Château Bouscaut','Château Carbonnieux','Domaine de Chevalier','Château Latour-Martillac','Château Malartic-Lagravière','Château Olivier'
];
const gravesRedOnly:readonly NamedEntry[]=[
  'Château de Fieuzal','Château Haut-Bailly','Château Haut-Brion','Château La Mission Haut-Brion','Château Pape Clément','Château Smith Haut Lafitte'
];
const gravesWhiteOnly:readonly NamedEntry[]=['Château Couhins','Château Couhins-Lurton'];
const gravesClassed=[...gravesRedAndWhite,...gravesRedOnly,...gravesWhiteOnly] as const;
/**
 * Saint-Émilion's Premiers Grands Crus Classés come in two ranks, and the gap
 * between them is the whole story of the 2022 classification: Ausone and Cheval
 * Blanc withdrew from it, and Figeac was promoted to join Pavie as an A. Listing
 * all fourteen as one rank loses that.
 */
const saintEmilionPremiersA:readonly NamedEntry[]=['Château Figeac','Château Pavie'];
const saintEmilionPremiersB:readonly NamedEntry[]=[
  'Château Beau-Séjour Bécot','Château Beauséjour Héritiers Duffau-Lagarrosse','Château Bélair-Monange','Château Canon','Château Canon La Gaffelière','Château Larcis Ducasse','Château Pavie Macquin','Château Troplong Mondot','Château TrotteVieille','Château Valandraud','Clos Fourtet','La Mondotte'
];
const saintEmilionPremiers2022=[...saintEmilionPremiersA,...saintEmilionPremiersB] as const;


const coteDeNuitsGrandCrus=[
  'Chambertin','Chambertin-Clos de Bèze','Chapelle-Chambertin','Charmes-Chambertin','Griotte-Chambertin','Latricières-Chambertin','Mazis-Chambertin','Mazoyères-Chambertin','Ruchottes-Chambertin',
  'Clos Saint-Denis','Clos de la Roche','Clos des Lambrays','Clos de Tart','Bonnes-Mares','Musigny','Clos de Vougeot','Échezeaux','Grands Échezeaux','La Grande Rue','La Romanée','La Tâche','Richebourg','Romanée-Conti','Romanée-Saint-Vivant'
] as const;
const coteDeBeauneGrandCrus=['Corton','Charlemagne','Corton-Charlemagne','Montrachet','Chevalier-Montrachet','Bâtard-Montrachet','Bienvenues-Bâtard-Montrachet','Criots-Bâtard-Montrachet'] as const;
const burgundyGrandCrus=['Chablis Grand Cru',...coteDeNuitsGrandCrus,...coteDeBeauneGrandCrus] as const;
/** Which commune each Grand Cru sits in, for the checklist's subheadings. */
const gevreyGrandCrus=coteDeNuitsGrandCrus.slice(0,9);
const moreySoleClimats=['Clos Saint-Denis','Clos de la Roche','Clos des Lambrays','Clos de Tart'] as const;
const vosneClimats=['Échezeaux','Grands Échezeaux','La Grande Rue','La Romanée','La Tâche','Richebourg','Romanée-Conti','Romanée-Saint-Vivant'] as const;
const cortonClimats=['Corton','Charlemagne','Corton-Charlemagne'] as const;
const montrachetClimats=['Montrachet','Chevalier-Montrachet','Bâtard-Montrachet','Bienvenues-Bâtard-Montrachet','Criots-Bâtard-Montrachet'] as const;

/**
 * Every checklist heading, keyed by the item it belongs to.
 *
 * A growth, a classification and a commune are all facts about the wine, not
 * about where it happens to sit in an array - so none of them is answered from
 * a position any more. The checklist is served from a per-owner cache that can
 * be a release behind, and reordering the Graves list once put Château Pape
 * Clément under "Classified for white", which it is not. Keying by id means the
 * worst a stale order can now do is group the page untidily.
 *
 * Built from the same arrays that build the items, so a list and its headings
 * cannot drift apart, and a test holds every item in every headed collection to
 * having an entry here.
 */
export const checklistHeadings:Record<string,Record<string,ChecklistHeading>>={
  'bordeaux-1855-red-classified-growths':sectionsById('red1855',[
    {section:'First Growths · Premiers Crus',entries:firstGrowths},
    {section:'Second Growths · Deuxièmes Crus',entries:secondGrowths},
    {section:'Third Growths · Troisièmes Crus',entries:thirdGrowths},
    {section:'Fourth Growths · Quatrièmes Crus',entries:fourthGrowths},
    {section:'Fifth Growths · Cinquièmes Crus',entries:fifthGrowths}
  ]),
  'sauternes-barsac-1855-all':sectionsById('sauternes-all',[
    {section:'Superior First Growth · Premier Cru Supérieur',entries:sauternesPremierSuperieur},
    {section:'First Growths · Premiers Crus',entries:sauternesPremiers},
    {section:'Second Growths · Seconds Crus',entries:sauternesSecond}
  ]),
  'sauternes-barsac-top-1855':sectionsById('sauternes-top',[
    {section:'Superior First Growth · Premier Cru Supérieur',entries:sauternesPremierSuperieur},
    {section:'First Growths · Premiers Crus',entries:sauternesPremiers}
  ]),
  'graves-crus-classes':sectionsById('graves',[
    {section:'Classified for red and white',entries:gravesRedAndWhite},
    {section:'Classified for red',entries:gravesRedOnly},
    {section:'Classified for white',entries:gravesWhiteOnly}
  ]),
  'saint-emilion-2022-premiers':sectionsById('stemilion2022',[
    {section:'Premier Grand Cru Classé A',entries:saintEmilionPremiersA},
    {section:'Premier Grand Cru Classé B',entries:saintEmilionPremiersB}
  ]),
  'burgundy-33-grand-crus':sectionsById('burgundy33',[
    {section:'Chablis',subsection:'Chablis Grand Cru',entries:['Chablis Grand Cru']},
    {section:'Côte de Nuits',subsection:'Gevrey-Chambertin',entries:gevreyGrandCrus},
    {section:'Côte de Nuits',subsection:'Morey-Saint-Denis',entries:moreySoleClimats},
    {section:'Côte de Nuits',subsection:'Chambolle-Musigny / Morey-Saint-Denis',entries:['Bonnes-Mares']},
    {section:'Côte de Nuits',subsection:'Chambolle-Musigny',entries:['Musigny']},
    {section:'Côte de Nuits',subsection:'Vougeot',entries:['Clos de Vougeot']},
    {section:'Côte de Nuits',subsection:'Vosne-Romanée / Flagey-Échezeaux',entries:vosneClimats},
    {section:'Côte de Beaune',subsection:'Corton hill · Aloxe-Corton / Pernand-Vergelesses / Ladoix-Serrigny',entries:cortonClimats},
    {section:'Côte de Beaune',subsection:'Montrachet hill · Puligny-Montrachet / Chassagne-Montrachet',entries:montrachetClimats}
  ])
};

const northernRhone=['Château-Grillet','Condrieu','Cornas','Côte-Rôtie','Crozes-Hermitage','Hermitage','Saint-Joseph','Saint-Péray'] as const;
const southernRhone=['Beaumes-de-Venise','Cairanne','Châteauneuf-du-Pape','Gigondas','Laudun','Lirac','Rasteau','Tavel','Vacqueyras','Vinsobres'] as const;

/**
 * Pomerol has never been classified - no 1855, no Saint-Émilion-style revision -
 * so this is a curated set of the appellation's benchmark estates rather than an
 * official list, and it says so in its subtitle. Producer-level: a Pomerol
 * estate's reputation rests on one wine, and second labels are rare enough that
 * requiring the grand vin by name would cost more matches than it saves.
 */
const pomerolEstates:readonly NamedEntry[]=[
  ['Pétrus','Petrus','Château Pétrus'],
  ['Château Lafleur','Lafleur'],
  ['Vieux Château Certan','VCC'],
  ['Le Pin','Château Le Pin'],
  ['Château Trotanoy','Trotanoy'],
  ["Château L’Église-Clinet","Château L'Église-Clinet","Chateau LEglise-Clinet","L’Église-Clinet"],
  ['Château La Conseillante','La Conseillante'],
  ["Château L’Évangile","Château L'Évangile","L’Évangile"],
  ['Château La Fleur-Pétrus','La Fleur-Pétrus','Château La Fleur Pétrus'],
  ['Château Clinet','Clinet'],
  ['Château Hosanna','Hosanna'],
  ['Château Latour à Pomerol','Latour à Pomerol'],
  ['Château Le Gay','Le Gay'],
  ['Château Nénin','Nénin'],
  ['Château Gazin','Gazin'],
  ['Château Petit-Village','Petit-Village','Château Petit Village']
] as const;

/**
 * Napa estates that were already making wine before the modern era - several
 * founded in the nineteenth century, all of them still working. Founding dates
 * are what puts an estate on this list, not scores.
 */
const napaHistoricEstates:readonly NamedEntry[]=[
  ['Charles Krug','Charles Krug Winery'],
  ['Beringer','Beringer Vineyards'],
  ['Inglenook','Niebaum-Coppola','Rubicon Estate'],
  ['Schramsberg','Schramsberg Vineyards'],
  ['Beaulieu Vineyard','BV'],
  ['Freemark Abbey'],
  ['Louis M. Martini','Louis Martini'],
  ['Mayacamas','Mayacamas Vineyards'],
  ['Stony Hill','Stony Hill Vineyard'],
  ['Heitz Cellar','Heitz Wine Cellars','Heitz'],
  ['Chateau Montelena','Château Montelena'],
  ['Robert Mondavi','Robert Mondavi Winery']
] as const;

/**
 * The Napa cabernets that trade on allocation rather than distribution. Curated,
 * like the Pomerol list: there is no body that names them.
 */
const napaCultCabernets:readonly NamedEntry[]=[
  ['Screaming Eagle'],
  ['Harlan Estate','Harlan'],
  ['Colgin Cellars','Colgin'],
  ['Bryant Family Vineyard','Bryant Estate','Bryant Family'],
  ['Dalla Valle Vineyards','Dalla Valle'],
  ['Abreu Vineyards','Abreu'],
  ['Scarecrow','Scarecrow Wine'],
  ['Schrader Cellars','Schrader'],
  ['Hundred Acre'],
  ['Eisele Vineyard','Araujo Estate','Araujo']
] as const;

/** The wineries that established Willamette Valley Pinot Noir from 1965 onward. */
const oregonPinotPioneers:readonly NamedEntry[]=[
  ['The Eyrie Vineyards','Eyrie Vineyards','Eyrie'],
  ['Ponzi Vineyards','Ponzi'],
  ['Adelsheim Vineyard','Adelsheim'],
  ['Sokol Blosser','Sokol Blosser Winery'],
  ['Erath','Erath Winery','Knudsen Erath'],
  ['Elk Cove Vineyards','Elk Cove'],
  ['Domaine Drouhin Oregon','Domaine Drouhin'],
  ['Bethel Heights Vineyard','Bethel Heights'],
  ['Cristom Vineyards','Cristom'],
  ['Beaux Frères']
] as const;

/** Washington's benchmark estates, mostly Walla Walla and the Columbia Valley. */
const washingtonBenchmarks:readonly NamedEntry[]=[
  ['Quilceda Creek'],
  ['Leonetti Cellar','Leonetti'],
  ['Woodward Canyon'],
  ['Andrew Will','Andrew Will Winery'],
  ['Cayuse Vineyards','Cayuse'],
  ['Figgins','Figgins Family Wine Estates'],
  ['DeLille Cellars','DeLille'],
  ["L'Ecole No 41","L’Ecole No 41",'LEcole No 41'],
  ['Chateau Ste. Michelle','Château Ste. Michelle','Chateau Ste Michelle'],
  ['Betz Family Winery','Betz Family']
] as const;

/**
 * Club Trésors de Champagne - the grower association whose members bottle a
 * Special Club cuvee in the shared bottle. Membership changes, so the subtitle
 * says "current members" and the reference is the club's own roster.
 */
const specialClub:readonly NamedEntry[]=[
  ['Agrapart & Fils','Agrapart'],
  ['Bereche & Fils','Bérêche & Fils','Bereche','Bérêche'],
  ['Chartogne-Taillet'],
  ['Claude Cazals','Cazals'],
  ['De Sousa & Fils','De Sousa'],
  ['Doyard'],
  ['Franck Bonville'],
  ['Gaston Chiquet'],
  ['Hugues Godmé','Hugues Godme','Godmé'],
  ['Guiborat','Guiborat Fils'],
  ['J. Lassalle','Lassalle'],
  ['Lacourte-Godbillon'],
  ['Lancelot-Pienne'],
  ['Marc Hébrart','Marc Hebrart'],
  ['Moussé Fils','Mousse Fils'],
  ['Paul Bara'],
  ['Pierre Gimonnet & Fils','Pierre Gimonnet','Gimonnet'],
  ['Pierre Paillard'],
  ['Péhu-Simonet','Pehu-Simonet'],
  ['Roger Coulon'],
  ['Vazart-Coquart & Fils','Vazart-Coquart'],
  ['Vilmart & Cie','Vilmart']
] as const;

/**
 * The grandes marques and prestige houses. Curated: the Syndicat de Grandes
 * Marques was dissolved in 1997 and nothing official replaced it, so the
 * subtitle says curated rather than implying a classification.
 */
const prestigeChampagneHouses:readonly NamedEntry[]=[
  ['Krug'],['Bollinger'],['Louis Roederer','Roederer'],['Salon','Champagne Salon'],
  ['Dom Pérignon','Dom Perignon'],['Pol Roger'],['Taittinger'],['Billecart-Salmon','Billecart Salmon'],
  ['Philipponnat'],['Jacquesson'],['Charles Heidsieck'],['Veuve Clicquot','Veuve Clicquot Ponsardin'],
  ['Perrier-Jouët','Perrier-Jouet'],['Ruinart'],['Laurent-Perrier','Laurent Perrier'],
  ['Deutz'],['Bruno Paillard'],['Henriot']
] as const;

/**
 * The Domaine's own bottlings. A cuvee selector rather than a producer one: the
 * point is to work through the monopoles and grand crus one at a time, and a
 * producer selector would tick the whole card off the first bottle.
 */
const drcNames=['Domaine de la Romanée-Conti','Domaine de la Romanee-Conti','DRC','Romanée-Conti','Romanee-Conti'] as const;
const drcWines:ReadonlyArray<readonly [string,...string[]]>=[
  ['Romanée-Conti','Romanee-Conti','La Romanée-Conti'],
  ['La Tâche','La Tache'],
  ['Richebourg'],
  ['Romanée-Saint-Vivant','Romanee-Saint-Vivant','Romanée St Vivant'],
  ['Grands Échezeaux','Grands Echezeaux'],
  ['Échezeaux','Echezeaux'],
  ['Montrachet','Le Montrachet'],
  ['Corton'],
  ['Corton-Charlemagne','Corton Charlemagne'],
  ['Cuvée Duvault-Blochet','Cuvee Duvault-Blochet','Vosne-Romanée 1er Cru Cuvée Duvault-Blochet']
] as const;

/**
 * Barolo's celebrated MGAs. There are 181 official ones - a list to consult
 * rather than a checklist to finish - so this is a curated twelve. Like the
 * Chablis climats they are named on the label rather than being appellations of
 * their own, so the cuvee name identifies them and Barolo is the appellation.
 */
const baroloCrus:ReadonlyArray<readonly [string,...string[]]>=[
  ['Cannubi'],['Brunate'],['Cerequio'],['Bussia'],['Ginestra'],['Monprivato'],
  ['Rocche dell’Annunziata','Rocche dell Annunziata','Rocche dellAnnunziata'],
  ['Vigna Rionda','Vignarionda'],['Francia'],['Falletto'],['Villero'],['Lazzarito']
] as const;

/**
 * The wines that made Tuscany's reputation outside its appellations. A cuvee
 * selector: Tignanello is a wine, not an estate, and Antinori make a great deal
 * that is not it.
 */
/**
 * [producer or its names, cuvée, ...cuvée aliases].
 *
 * The producer takes a list because a house is not always written the way the
 * curator wrote it. Tignanello was recorded here under "Antinori" while the
 * bottle says Marchesi Antinori, and producer names are matched by exact
 * equality after normalising - so the item failed at the producer before its
 * cuvée was ever considered, and a wine that was plainly in the collection went
 * unchecked. Only variants that appear on a real label are listed; a guess here
 * ticks a box for a wine nobody drank.
 */
const superTuscans:ReadonlyArray<readonly [string|readonly string[],string,...string[]]>=[
  ['Tenuta San Guido','Sassicaia','Bolgheri Sassicaia'],
  [['Ornellaia','Tenuta dell’Ornellaia'],'Ornellaia','Tenuta dell’Ornellaia'],
  [['Ornellaia','Tenuta dell’Ornellaia'],'Masseto'],
  [['Antinori','Marchesi Antinori'],'Tignanello','Marchesi Antinori Tignanello'],
  [['Antinori','Marchesi Antinori'],'Solaia'],
  [['Antinori','Marchesi Antinori'],'Guado al Tasso'],
  ['Montevertine','Le Pergole Torte'],
  [['Fontodi','Tenuta Fontodi'],'Flaccianello della Pieve','Flaccianello'],
  ['Isole e Olena','Cepparello'],
  ['Tua Rita','Redigaffi'],
  ['Le Macchiole','Messorio'],
  ['Le Macchiole','Paleo Rosso','Paleo'],
  ['Fattoria Le Pupille','Saffredi'],
  ['San Giusto a Rentennano','Percarlo'],
  ['Querciabella','Camartina'],
  ['Castello dei Rampolla','Sammarco']
] as const;

/** Tuscany's appellations, which is the tier a bottle actually records. */
const tuscanAppellations:readonly string[]=[
  'Chianti Classico','Brunello di Montalcino','Vino Nobile di Montepulciano','Carmignano',
  'Bolgheri','Bolgheri Sassicaia','Rosso di Montalcino','Maremma Toscana','Chianti','Montecucco'
];

/** One wine of one producer: both names have to match, so a second label cannot tick it. */
const cuveeItems=(prefix:string,entries:ReadonlyArray<readonly [string|readonly string[],string,...string[]]>):AchievementDefinitionItem[]=>
  entries.map(([producer,label,...aliases])=>({
    id:`${prefix}-${slug(label)}`,label,
    selector:{type:'cuvee',producerNames:typeof producer==='string'?[producer]:[...producer],cuveeNames:[label,...aliases]}
  }));

/** Every wine of one domaine, keyed on the cuvee name. */
const domaineCuveeItems=(prefix:string,producerNames:readonly string[],wines:ReadonlyArray<readonly [string,...string[]]>):AchievementDefinitionItem[]=>
  wines.map(([label,...aliases])=>({
    id:`${prefix}-${slug(label)}`,label,
    selector:{type:'cuvee',producerNames:[...producerNames],cuveeNames:[label,...aliases]}
  }));

/**
 * A named vineyard inside one appellation, whoever bottles it. The appellation
 * list carries the bare site name too: a climat or an MGA is often what lands in
 * the appellation field even though it is not an appellation.
 */
const siteItems=(prefix:string,appellation:string,sites:ReadonlyArray<readonly [string,...string[]]>):AchievementDefinitionItem[]=>
  sites.map(([label,...aliases])=>({
    id:`${prefix}-${slug(label)}`,label,
    selector:{
      type:'site',
      cuveeNames:[label,...aliases,`${appellation} ${label}`,...aliases.map(alias=>`${appellation} ${alias}`)],
      appellationNames:[appellation,label,...aliases,`${appellation} ${label}`]
    }
  }));

export const expandedAchievementDefinitions:AchievementDefinition[]=[
  {id:'bordeaux-second-growths',title:'Bordeaux Second Growths',subtitle:'Taste all 14 Deuxièmes Crus of the 1855 red-wine classification.',category:'iconic-estates',icon:'bordeaux-classification',references:[{title:'Conseil des Grands Crus Classés en 1855 · Classification',url:gcc1855}],items:producerItems('second',secondGrowths)},
  {id:'bordeaux-third-growths',title:'Bordeaux Third Growths',subtitle:'Taste all 14 Troisièmes Crus of the 1855 red-wine classification.',category:'iconic-estates',icon:'bordeaux-classification',references:[{title:'Conseil des Grands Crus Classés en 1855 · Classification',url:gcc1855}],items:producerItems('third',thirdGrowths)},
  {id:'bordeaux-fourth-growths',title:'Bordeaux Fourth Growths',subtitle:'Taste all 10 Quatrièmes Crus of the 1855 red-wine classification.',category:'iconic-estates',icon:'bordeaux-classification',references:[{title:'Conseil des Grands Crus Classés en 1855 · Classification',url:gcc1855}],items:producerItems('fourth',fourthGrowths)},
  {id:'bordeaux-fifth-growths',title:'Bordeaux Fifth Growths',subtitle:'Taste all 18 Cinquièmes Crus of the 1855 red-wine classification.',category:'iconic-estates',icon:'bordeaux-classification',references:[{title:'Conseil des Grands Crus Classés en 1855 · Classification',url:gcc1855}],items:producerItems('fifth',fifthGrowths)},
  {id:'bordeaux-1855-red-classified-growths',title:'All 1855 Bordeaux Red Classified Growths',subtitle:'The master challenge: all 61 current red classified-growth estates.',category:'iconic-estates',icon:'bordeaux-classification',references:[{title:'Conseil des Grands Crus Classés en 1855 · Classification',url:gcc1855}],items:producerItems('red1855',red1855)},
  {id:'bordeaux-1855-red-appellations',title:'1855 Bordeaux Red Appellations',subtitle:'Taste all six appellations represented by the 61 red classified growths.',category:'regional-exploration',icon:'bordeaux-classification',references:[{title:'Conseil des Grands Crus Classés en 1855 · Classification',url:gcc1855}],items:appellationItems('red1855-app',red1855Appellations)},
  {id:'sauternes-barsac-top-1855',title:'Sauternes & Barsac 1855 Top Growths',subtitle:'Premier Cru Supérieur Château d’Yquem plus all 11 current Premiers Crus.',category:'iconic-estates',icon:'sauternes',references:[{title:'Conseil des Grands Crus Classés en 1855 · Sauternes & Barsac',url:gcc1855}],items:producerItems('sauternes-top',sauternesTop)},
  {id:'sauternes-barsac-second-growths',title:'Sauternes & Barsac Second Growths',subtitle:'Taste all 15 current Seconds Crus in the 1855 sweet-wine classification.',category:'iconic-estates',icon:'sauternes',references:[{title:'Conseil des Grands Crus Classés en 1855 · Sauternes & Barsac',url:gcc1855}],items:producerItems('sauternes-second',sauternesSecond)},
  {id:'sauternes-barsac-1855-all',title:'All 1855 Sauternes & Barsac Growths',subtitle:'The complete current 27-estate Sauternes & Barsac classification.',category:'iconic-estates',icon:'sauternes',references:[{title:'Conseil des Grands Crus Classés en 1855 · Sauternes & Barsac',url:gcc1855}],items:producerItems('sauternes-all',sauternes1855)},
  {id:'graves-crus-classes',title:'Graves Crus Classés',subtitle:'Taste all 14 estates in the permanent Graves classification.',category:'iconic-estates',icon:'graves',references:[{title:'Union des Crus Classés de Graves · Presentation',url:graves}],items:producerItems('graves',gravesClassed)},
  {id:'saint-emilion-2022-premiers',title:'Saint-Émilion 2022 Premiers Grands Crus Classés',subtitle:'Taste all 14 Premiers Grands Crus Classés in the 2022 classification.',category:'iconic-estates',icon:'saint-emilion',references:[{title:'INAO · Saint-Émilion grand cru 2022 classification',url:saintEmilion}],items:producerItems('stemilion2022',saintEmilionPremiers2022)},
  {id:'pomerol-benchmark-estates',title:'Pomerol Benchmark Estates',subtitle:'Pomerol has no classification; a curated set of 16 estates that define the appellation.',category:'iconic-estates',icon:'saint-emilion',references:[{title:'Syndicat Viticole de Pomerol',url:'https://www.vins-pomerol.fr/en/'}],items:producerItems('pomerol',pomerolEstates)},
  {id:'champagne-special-club',title:'Club Trésors de Champagne',subtitle:'Taste a Special Club cuvee from each current member of the growers’ club.',category:'iconic-estates',icon:'beaujolais-crus',references:[{title:'Club Trésors de Champagne · The club',url:'https://www.clubtresorsdechampagne.com/en/the-club/'}],items:producerItems('special-club',specialClub)},
  {id:'champagne-prestige-houses',title:'Champagne’s Prestige Houses',subtitle:'A curated 18: the grandes marques, which have had no official list since 1997.',category:'iconic-estates',icon:'first-growth',references:[{title:'Comité Champagne',url:'https://www.champagne.fr/en/'}],items:producerItems('prestige-champagne',prestigeChampagneHouses)},
  {id:'domaine-romanee-conti',title:'Domaine de la Romanée-Conti',subtitle:'Work through all ten wines the Domaine bottles, from Échezeaux to the monopoles.',category:'iconic-estates',icon:'burgundy-grand-cru',references:[{title:'Domaine de la Romanée-Conti',url:'https://www.romanee-conti.fr/'}],items:domaineCuveeItems('drc',drcNames,drcWines)},
  {id:'barolo-great-crus',title:'The Great Crus of Barolo',subtitle:'A curated twelve of Barolo’s 181 MGAs, the ones a label wears like a name.',category:'regional-exploration',icon:'rhone-crus',references:[{title:'Langhe Vini · Barolo DOCG',url:'https://www.langhevini.it/en/barolo-docg/'}],items:siteItems('barolo','Barolo',baroloCrus)},
  {id:'super-tuscans',title:'Super Tuscans',subtitle:'Sixteen wines that built Tuscany’s reputation outside its appellations.',category:'iconic-estates',icon:'saint-emilion',references:[{title:'Consorzio Vino Chianti Classico',url:'https://www.consorziovinochianticlassico.it/en/'}],items:cuveeItems('super-tuscan',superTuscans)},
  {id:'tuscany-appellations',title:'Tuscan Appellation Explorer',subtitle:'Taste across ten Tuscan appellations, from Chianti Classico to Bolgheri.',category:'regional-exploration',icon:'graves',references:[{title:'Consorzio Vino Chianti Classico',url:'https://www.consorziovinochianticlassico.it/en/'}],items:appellationItems('tuscany',tuscanAppellations)},
  {id:'napa-historic-estates',title:'Napa Valley Historic Estates',subtitle:'Taste a wine from 12 Napa estates that were making wine before the modern era.',category:'iconic-estates',icon:'judgment-paris',references:[{title:'Napa Valley Vintners',url:'https://napavintners.com/'}],items:producerItems('napa-historic',napaHistoricEstates)},
  {id:'napa-cult-cabernets',title:'Napa Cult Cabernets',subtitle:'A curated ten: the Napa cabernets sold by allocation rather than distribution.',category:'iconic-estates',icon:'first-growth',references:[{title:'Napa Valley Vintners',url:'https://napavintners.com/'}],items:producerItems('napa-cult',napaCultCabernets)},
  {id:'oregon-pinot-pioneers',title:'Oregon Pinot Pioneers',subtitle:'Taste the ten wineries that established Willamette Valley Pinot Noir.',category:'iconic-estates',icon:'beaujolais-crus',references:[{title:'Willamette Valley Wineries Association',url:'https://www.willamettewines.com/'}],items:producerItems('oregon-pioneer',oregonPinotPioneers)},
  {id:'washington-benchmark-estates',title:'Washington Benchmark Estates',subtitle:'Ten estates that set the standard for Washington reds.',category:'iconic-estates',icon:'graves',references:[{title:'Washington State Wine Commission',url:'https://www.washingtonwine.org/'}],items:producerItems('washington',washingtonBenchmarks)},
  {id:'burgundy-33-grand-crus',title:'Burgundy Grand Cru Explorer',subtitle:'Taste wine from all 33 Grand Cru appellations of Bourgogne.',category:'regional-exploration',icon:'burgundy-grand-cru',references:[{title:'Bourgogne Wines · Grand Cru appellations',url:burgundy}],items:appellationItems('burgundy33',burgundyGrandCrus,true)},
  {id:'cote-de-nuits-24-grand-crus',title:'Côte de Nuits Grand Crus',subtitle:'Taste all 24 Grand Cru appellations of the Côte de Nuits.',category:'regional-exploration',icon:'burgundy-grand-cru',references:[{title:'Bourgogne Wines · Appellations',url:burgundy}],items:appellationItems('nuits24',coteDeNuitsGrandCrus,true)},
  {id:'cote-de-beaune-8-grand-crus',title:'Côte de Beaune Grand Crus',subtitle:'Taste all 8 Grand Cru appellations of the Côte de Beaune.',category:'regional-exploration',icon:'burgundy-grand-cru',references:[{title:'Bourgogne Wines · Appellations',url:burgundy}],items:appellationItems('beaune8',coteDeBeauneGrandCrus,true)},
  {id:'gevrey-nine-grand-crus',title:'The Nine Gevrey Grand Crus',subtitle:'Complete the nine Grand Cru appellations associated with Gevrey-Chambertin.',category:'regional-exploration',icon:'gevrey-grand-cru',references:[{title:'Bourgogne Wines · Appellations',url:burgundy}],items:appellationItems('gevrey9',gevreyGrandCrus,true)},
  {id:'northern-rhone-eight-crus',title:'Northern Rhône Crus',subtitle:'Taste all eight official Northern Rhône cru AOCs.',category:'regional-exploration',icon:'rhone-crus',references:[{title:'Inter Rhône · Crus',url:rhone}],items:appellationItems('north-rhone',northernRhone)},
  {id:'southern-rhone-ten-crus',title:'Southern Rhône Crus',subtitle:'Taste all ten current Southern Rhône cru AOCs, including Cairanne and Laudun.',category:'regional-exploration',icon:'rhone-crus',references:[{title:'Inter Rhône · Crus',url:rhone}],items:appellationItems('south-rhone',southernRhone)}
];
