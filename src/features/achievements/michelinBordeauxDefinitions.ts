import type { AchievementDefinition,AchievementDefinitionItem } from './types';

type NamedEstate=string|readonly [string,...string[]];
const slug=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[’'`]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const producerItems=(prefix:string,entries:readonly NamedEstate[]):AchievementDefinitionItem[]=>entries.map(entry=>{
  const values=typeof entry==='string'?[entry]:[entry[0],...entry.slice(1)];
  const [label,...aliases]=values;
  return {id:`${prefix}-${slug(label)}`,label,selector:{type:'producer',producerNames:[label,...aliases]}};
});

const michelin2026='https://guide.michelin.com/gb/en/article/wine/the-michelin-guide-s-bordeaux-wine-selection';
const reference={title:'MICHELIN Guide · 2026 Bordeaux Grape Selection',url:michelin2026};

const threeGrapes:readonly NamedEstate[]=[
  ['Château Léoville Las Cases','Chateau Leoville Las Cases','Château Léoville-Las-Cases'],['Château Lafite Rothschild','Chateau Lafite Rothschild'],['Château Montrose','Chateau Montrose'],
  ['Petrus','Pétrus'],['Château La Conseillante','Chateau La Conseillante'],['Château Lafleur','Chateau Lafleur'],['Château Cheval Blanc','Chateau Cheval Blanc'],['Château-Figeac','Château Figeac','Chateau Figeac'],["Château d’Yquem","Château d'Yquem","Chateau d'Yquem"]
];
const twoGrapes:readonly NamedEstate[]=[
  ['Château Mouton Rothschild','Chateau Mouton Rothschild'],['Château Pichon Longueville Comtesse de Lalande','Château Pichon Comtesse','Chateau Pichon Comtesse','Pichon Comtesse'],['Château Pichon Baron','Chateau Pichon Baron','Château Pichon Longueville Baron'],['Château Pontet-Canet','Chateau Pontet-Canet'],
  ['Château Margaux','Chateau Margaux'],['Château Palmer','Chateau Palmer'],['Château Troplong Mondot','Chateau Troplong Mondot'],['Château Canon','Chateau Canon'],['Château Ausone','Chateau Ausone'],['Château Angélus','Chateau Angelus'],['Château Beau-Séjour Bécot','Chateau Beau-Sejour Becot','Château Beau-Séjour Bécot'],
  ['Vieux Château Certan','Vieux Chateau Certan'],['Château Haut-Brion','Chateau Haut-Brion'],['Château La Mission Haut-Brion','Chateau La Mission Haut-Brion'],['Château Les Carmes Haut-Brion','Chateau Les Carmes Haut-Brion'],['Château de Fargues','Chateau de Fargues']
];
const oneGrape:readonly NamedEstate[]=[
  ['Château Canon La Gaffelière','Chateau Canon La Gaffeliere'],['Château Bélair-Monange','Chateau Belair-Monange'],['La Mondotte','Château La Mondotte'],['Château Beauséjour','Chateau Beausejour'],['Château Bellefont-Belcier','Chateau Bellefont-Belcier'],['Château Jean Faure','Chateau Jean Faure'],['Château Larcis Ducasse','Chateau Larcis Ducasse'],['Château Berliquet','Chateau Berliquet'],['Château Mangot','Chateau Mangot'],['Château Soutard','Chateau Soutard'],
  ['Château Branaire-Ducru','Chateau Branaire-Ducru'],['Château Léoville Barton','Chateau Leoville Barton'],['Château Lagrange','Chateau Lagrange'],['Château Langoa Barton','Chateau Langoa Barton'],['Château Calon Ségur','Chateau Calon Segur'],["Château Cos d’Estournel","Château Cos d'Estournel","Chateau Cos d'Estournel"],['Château Haut-Marbuzet','Chateau Haut-Marbuzet'],
  ['Château de Fieuzal','Chateau de Fieuzal'],['Domaine de Chevalier','Château de Chevalier','Chateau de Chevalier'],['Château Haut-Bailly','Chateau Haut-Bailly'],['Château Smith Haut Lafitte','Chateau Smith Haut Lafitte'],['Château Giscours','Chateau Giscours'],['Château Brane-Cantenac','Chateau Brane-Cantenac'],['Château Rauzan-Ségla','Chateau Rauzan-Segla'],
  ['Château Grand-Puy-Lacoste','Chateau Grand-Puy-Lacoste'],['Château Lynch-Bages','Chateau Lynch-Bages'],['Château Clerc Milon','Chateau Clerc Milon'],['Château Clinet','Chateau Clinet'],['Château Lafleur-Pétrus','Chateau Lafleur-Petrus'],['Château Trotanoy','Chateau Trotanoy'],["Château L’Évangile","Château L'Evangile","Chateau L'Evangile"],['Le Pin','Château Le Pin','Chateau Le Pin'],
  ['Château Coutet','Chateau Coutet'],['Château Sigalas Rabaud','Chateau Sigalas Rabaud'],['Château Closiot','Chateau Closiot'],['Château Rieussec','Chateau Rieussec'],['Château Suduiraut','Chateau Suduiraut']
];
const selected:readonly NamedEstate[]=[
  ["Château d’Armailhac","Château d'Armailhac","Chateau d'Armailhac"],['Château Duhart-Milon','Chateau Duhart-Milon'],['Château Pédesclaux','Chateau Pedesclaux'],['Château Lascombes','Chateau Lascombes'],['Château Cantenac Brown','Chateau Cantenac Brown'],['Château Malescot Saint-Exupéry','Chateau Malescot Saint-Exupery'],
  ['Château Beychevelle','Chateau Beychevelle'],['Château Gruaud Larose','Chateau Gruaud Larose'],['Château Saint-Pierre','Chateau Saint-Pierre'],['Château Talbot','Chateau Talbot'],['Château Franc Mayne','Chateau Franc Mayne'],['Clos Fourtet','Château Clos Fourtet','Chateau Clos Fourtet'],['Château La Clotte','Chateau La Clotte'],['Château Larmande','Chateau Larmande'],['Château Quintus','Chateau Quintus'],['Château Rocheyron','Chateau Rocheyron'],
  ['Château Bourgneuf','Chateau Bourgneuf'],['Château Nénin','Chateau Nenin'],['Château Lafon-Rochet','Chateau Lafon-Rochet'],['Château Guiraud','Chateau Guiraud'],['Château La Tour Blanche','Chateau La Tour Blanche']
];

function collection(id:string,title:string,subtitle:string,tier:string,items:readonly NamedEstate[]):AchievementDefinition{
  return {id,title,subtitle,category:'guide-selections',icon:'michelin-grapes',references:[reference],items:producerItems(id,items),series:{id:'michelin-grapes',authority:'MICHELIN Guide',region:'Bordeaux',edition:2026,tier}};
}

// Freeze the inaugural Bordeaux list as edition 2026 so later MICHELIN editions do not rewrite earned history.
export const michelinBordeauxAchievementDefinitions:AchievementDefinition[]=[
  collection('michelin-grapes-bordeaux-2026-three','Three MICHELIN Grapes · Bordeaux 2026','Taste wines from all 9 Bordeaux estates awarded the highest MICHELIN Grape distinction.','three',threeGrapes),
  collection('michelin-grapes-bordeaux-2026-two','Two MICHELIN Grapes · Bordeaux 2026','Taste wines from all 16 Bordeaux estates awarded Two MICHELIN Grapes.','two',twoGrapes),
  collection('michelin-grapes-bordeaux-2026-one','One MICHELIN Grape · Bordeaux 2026','Taste wines from all 37 Bordeaux estates awarded One MICHELIN Grape.','one',oneGrape),
  collection('michelin-grapes-bordeaux-2026-selected','MICHELIN Selected Estates · Bordeaux 2026','Taste wines from all 21 additional Bordeaux estates selected by the MICHELIN Guide.','selected',selected)
];
