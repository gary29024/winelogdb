import type { AchievementDefinition,AchievementDefinitionItem } from './types';

const slug=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[’'`]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
type NamedEntry=string|readonly [string,...string[]];
const names=(entry:NamedEntry)=>typeof entry==='string'?[entry]:[entry[0],...entry.slice(1)];
const producerItems=(prefix:string,entries:readonly NamedEntry[]):AchievementDefinitionItem[]=>entries.map(entry=>{const [label,...aliases]=names(entry);return {id:`${prefix}-${slug(label)}`,label,selector:{type:'producer',producerNames:[label,...aliases]}}});
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

const sauternesTop:readonly NamedEntry[]=[
  "Château d’Yquem",'Château La Tour Blanche','Château Lafaurie-Peyraguey','Clos Haut-Peyraguey','Château de Rayne-Vigneau','Château Suduiraut','Château Coutet','Château Climens','Château Guiraud','Château Rieussec','Château Rabaud-Promis','Château Sigalas-Rabaud'
];
const sauternesSecond:readonly NamedEntry[]=[
  'Château de Myrat','Château Doisy Daëne','Château Doisy-Dubroca','Château Doisy-Védrines',"Château d’Arche",'Château Filhot','Château Broustet','Château Nairac','Château Caillou','Château Suau','Château de Malle','Château Romer','Château Romer-du-Hayot','Château Lamothe','Château Lamothe-Guignard'
];
const sauternes1855=[...sauternesTop,...sauternesSecond] as const;

const gravesClassed:readonly NamedEntry[]=[
  'Château Bouscaut','Château Carbonnieux','Domaine de Chevalier','Château Couhins','Château Couhins-Lurton','Château de Fieuzal','Château Haut-Bailly','Château Haut-Brion','Château Latour-Martillac','Château Malartic-Lagravière','Château La Mission Haut-Brion','Château Olivier','Château Pape Clément','Château Smith Haut Lafitte'
];
const saintEmilionPremiers2022:readonly NamedEntry[]=[
  'Château Beau-Séjour Bécot','Château Beauséjour Héritiers Duffau-Lagarrosse','Château Bélair-Monange','Château Canon','Château Canon La Gaffelière','Château Figeac','Château Larcis Ducasse','Château Pavie','Château Pavie Macquin','Château Troplong Mondot','Château TrotteVieille','Château Valandraud','Clos Fourtet','La Mondotte'
];

const coteDeNuitsGrandCrus=[
  'Chambertin','Chambertin-Clos de Bèze','Chapelle-Chambertin','Charmes-Chambertin','Griotte-Chambertin','Latricières-Chambertin','Mazis-Chambertin','Mazoyères-Chambertin','Ruchottes-Chambertin',
  'Clos Saint-Denis','Clos de la Roche','Clos des Lambrays','Clos de Tart','Bonnes-Mares','Musigny','Clos de Vougeot','Échezeaux','Grands Échezeaux','La Grande Rue','La Romanée','La Tâche','Richebourg','Romanée-Conti','Romanée-Saint-Vivant'
] as const;
const coteDeBeauneGrandCrus=['Corton','Charlemagne','Corton-Charlemagne','Montrachet','Chevalier-Montrachet','Bâtard-Montrachet','Bienvenues-Bâtard-Montrachet','Criots-Bâtard-Montrachet'] as const;
const burgundyGrandCrus=['Chablis Grand Cru',...coteDeNuitsGrandCrus,...coteDeBeauneGrandCrus] as const;
const gevreyGrandCrus=coteDeNuitsGrandCrus.slice(0,9);
const northernRhone=['Château-Grillet','Condrieu','Cornas','Côte-Rôtie','Crozes-Hermitage','Hermitage','Saint-Joseph','Saint-Péray'] as const;
const southernRhone=['Beaumes-de-Venise','Cairanne','Châteauneuf-du-Pape','Gigondas','Laudun','Lirac','Rasteau','Tavel','Vacqueyras','Vinsobres'] as const;

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
  {id:'burgundy-33-grand-crus',title:'Burgundy Grand Cru Explorer',subtitle:'Taste wine from all 33 Grand Cru appellations of Bourgogne.',category:'regional-exploration',icon:'burgundy-grand-cru',references:[{title:'Bourgogne Wines · Grand Cru appellations',url:burgundy}],items:appellationItems('burgundy33',burgundyGrandCrus,true)},
  {id:'cote-de-nuits-24-grand-crus',title:'Côte de Nuits Grand Crus',subtitle:'Taste all 24 Grand Cru appellations of the Côte de Nuits.',category:'regional-exploration',icon:'burgundy-grand-cru',references:[{title:'Bourgogne Wines · Appellations',url:burgundy}],items:appellationItems('nuits24',coteDeNuitsGrandCrus,true)},
  {id:'cote-de-beaune-8-grand-crus',title:'Côte de Beaune Grand Crus',subtitle:'Taste all 8 Grand Cru appellations of the Côte de Beaune.',category:'regional-exploration',icon:'burgundy-grand-cru',references:[{title:'Bourgogne Wines · Appellations',url:burgundy}],items:appellationItems('beaune8',coteDeBeauneGrandCrus,true)},
  {id:'gevrey-nine-grand-crus',title:'The Nine Gevrey Grand Crus',subtitle:'Complete the nine Grand Cru appellations associated with Gevrey-Chambertin.',category:'regional-exploration',icon:'gevrey-grand-cru',references:[{title:'Bourgogne Wines · Appellations',url:burgundy}],items:appellationItems('gevrey9',gevreyGrandCrus,true)},
  {id:'northern-rhone-eight-crus',title:'Northern Rhône Crus',subtitle:'Taste all eight official Northern Rhône cru AOCs.',category:'regional-exploration',icon:'rhone-crus',references:[{title:'Inter Rhône · Crus',url:rhone}],items:appellationItems('north-rhone',northernRhone)},
  {id:'southern-rhone-ten-crus',title:'Southern Rhône Crus',subtitle:'Taste all ten current Southern Rhône cru AOCs, including Cairanne and Laudun.',category:'regional-exploration',icon:'rhone-crus',references:[{title:'Inter Rhône · Crus',url:rhone}],items:appellationItems('south-rhone',southernRhone)}
];
