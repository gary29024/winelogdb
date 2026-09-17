import type { AchievementDefinition,AchievementDefinitionItem } from './types';

type NamedEstate=string|readonly [string,...string[]];
type MichelinRegion='Bordeaux'|'Burgundy';
type MichelinReference={title:string;url:string};

const slug=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[’'`]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const producerItems=(prefix:string,entries:readonly NamedEstate[]):AchievementDefinitionItem[]=>entries.map(entry=>{
  const values=typeof entry==='string'?[entry]:[entry[0],...entry.slice(1)];
  const [label,...aliases]=values;
  return {id:`${prefix}-${slug(label)}`,label,selector:{type:'producer',producerNames:[label,...aliases]}};
});

const burgundyReference:MichelinReference={
  title:'MICHELIN · 2026 Burgundy Grape Selection',
  url:'https://www.michelin.com/en/publications/products-and-services/the-michelin-guide-first-grape-selection-burgundy-france'
};
const bordeauxReference:MichelinReference={
  title:'MICHELIN · 2026 Bordeaux Grape Selection',
  url:'https://guide.michelin.com/gb/en/article/wine/the-michelin-guide-s-bordeaux-wine-selection'
};

const burgundyThreeGrapes:readonly NamedEstate[]=[
  ["Cécile Tremblay", "Domaine Cécile Tremblay"],
  ["Dugat-Py", "Domaine Dugat-Py"],
  ["Roumier", "Domaine Georges Roumier", "Georges Roumier"],
  ["Domaine de la Romanée-Conti", "Domaine de la Romanee-Conti", "DRC"],
  ["Domaine Leroy", "Leroy"],
  ["Domaine d’Auvenay", "Domaine d'Auvenay", "Auvenay"],
  ["Coche-Dury", "Domaine Coche-Dury"],
  ["Jean-Marc & Thomas Bouley", "Domaine Jean-Marc & Thomas Bouley", "Jean-Marc et Thomas Bouley", "Domaine Jean-Marc Bouley"],
  ["Hubert Lamy", "Domaine Hubert Lamy"]
];

const burgundyTwoGrapes:readonly NamedEstate[]=[
  ["Dujac", "Domaine Dujac"],
  ["Denis Mortet", "Domaine Denis Mortet"],
  ["Georges Mugneret-Gibourg", "Domaine Georges Mugneret-Gibourg"],
  ["Bruno Clair", "Domaine Bruno Clair"],
  ["Gérard Mugneret", "Domaine Gérard Mugneret", "Gerard Mugneret"],
  ["Jacques-Frédéric Mugnier", "Domaine Jacques-Frédéric Mugnier", "Jacques-Frederic Mugnier"],
  ["Jean-Claude Bachelet", "Domaine Jean-Claude Bachelet"],
  ["Paul Pillot", "Domaine Paul Pillot"],
  ["Arnaud Ente", "Domaine Arnaud Ente"],
  ["Benoît Ente", "Domaine Benoît Ente", "Benoit Ente"],
  ["Benoît Moreau", "Domaine Benoît Moreau", "Benoit Moreau"],
  ["Lamy-Caillat", "Domaine Lamy-Caillat"],
  ["Bonneau du Martray", "Domaine Bonneau du Martray"],
  ["Domaine des Comtes Lafon", "Comtes Lafon"],
  ["Domaine des Croix", "Des Croix"],
  ["Domaine Leflaive", "Leflaive"],
  ["Etienne Sauzet", "Domaine Etienne Sauzet", "Étienne Sauzet"],
  ["Jean-Marc Vincent", "Domaine Jean-Marc Vincent"],
  ["Bruno Lorenzon", "Domaine Bruno Lorenzon"],
  ["Dureuil-Janthial", "Domaine Dureuil-Janthial"]
];

const burgundyOneGrape:readonly NamedEstate[]=[
  ["Armand Rousseau", "Domaine Armand Rousseau"],
  ["Claude Dugat", "Domaine Claude Dugat"],
  ["Denis Bachelet", "Domaine Denis Bachelet"],
  ["Duroché", "Domaine Duroché", "Domaine Duroche"],
  ["Joseph Roty", "Domaine Joseph Roty"],
  ["Trapet", "Domaine Trapet", "Domaine Jean-Louis Trapet"],
  ["Comte Georges de Vogüé", "Domaine Comte Georges de Vogüé", "Comte Georges de Vogue"],
  ["Ghislaine Barthod", "Domaine Ghislaine Barthod"],
  ["Hudelot-Noëllat", "Domaine Hudelot-Noëllat", "Hudelot-Noellat"],
  ["Louis Boillot", "Domaine Louis Boillot"],
  ["Clos de Tart", "Domaine du Clos de Tart"],
  ["Domaine des Lambrays", "Clos des Lambrays"],
  ["Domaine Ponsot", "Ponsot"],
  ["Arnoux-Lachaux", "Domaine Arnoux-Lachaux"],
  ["Domaine Sylvain Cathiard", "Sylvain Cathiard"],
  ["Méo-Camuzet", "Domaine Méo-Camuzet", "Meo-Camuzet"],
  ["Château de la Tour", "Chateau de la Tour"],
  ["Faiveley", "Domaine Faiveley"],
  ["Bernard-Bonin", "Domaine Bernard-Bonin"],
  ["Henri Boillot", "Domaine Henri Boillot"],
  ["Henri Germain", "Domaine Henri Germain"],
  ["Roulot", "Domaine Roulot", "Guy Roulot"],
  ["Vincent Girardin", "Domaine Vincent Girardin"],
  ["Domaine de Montille", "De Montille"],
  ["Marquis d'Angerville", "Domaine Marquis d’Angerville", "Domaine Marquis d'Angerville"],
  ["Michel Lafarge", "Domaine Michel Lafarge"],
  ["Roblet-Monnot", "Domaine Roblet-Monnot"],
  ["Benjamin Leroux", "Domaine Benjamin Leroux"],
  ["Joseph Drouhin", "Maison Joseph Drouhin"],
  ["Louis Jadot", "Maison Louis Jadot"],
  ["Pierre-Yves Colin-Morey", "Domaine Pierre-Yves Colin-Morey", "PYCM"],
  ["Marc Colin", "Domaine Marc Colin"],
  ["Henri & Gilles Buisson", "Domaine Henri & Gilles Buisson", "Henri et Gilles Buisson"]
];

const burgundySelected:readonly NamedEstate[]=[
  ["Domaine Berthaut-Gerbet", "Berthaut-Gerbet"],
  ["Sylvain Pataille", "Domaine Sylvain Pataille"],
  ["Domaine Felettig", "Felettig"],
  ["Domaine Camille Thiriet", "Camille Thiriet"],
  ["Benoit Chevallier", "Benoît Chevallier", "Domaine Benoit Chevallier"],
  ["Charles Audoin", "Domaine Charles Audoin"],
  ["Fourrier", "Domaine Fourrier"],
  ["Hubert Lignier", "Domaine Hubert Lignier"],
  ["Domaine Jobard-Morey", "Jobard-Morey"],
  ["Anne Boisson", "Domaine Anne Boisson"],
  ["Ballot-Millot", "Domaine Ballot-Millot"],
  ["Buisson-Charles", "Domaine Buisson-Charles"],
  ["Camille & Guillaume Boillot", "Domaine Camille & Guillaume Boillot", "Camille et Guillaume Boillot"],
  ["Pierre Boisson", "Domaine Pierre Boisson"],
  ["Pierre Girardin", "Domaine Pierre Girardin"],
  ["Pierre Morey", "Domaine Pierre Morey"],
  ["Alex Moreau", "Domaine Alex Moreau"],
  ["Ramonet", "Domaine Ramonet"],
  ["Vincent Dancer", "Domaine Vincent Dancer"],
  ["Jacques Carillon", "Domaine Jacques Carillon"],
  ["Thomas-Collardot", "Domaine Thomas-Collardot"],
  ["Albert Bichot", "Maison Albert Bichot"],
  ["Bouchard Père & Fils", "Bouchard Pere & Fils", "Maison Bouchard Père & Fils"],
  ["Bachelet-Monnot", "Domaine Bachelet-Monnot"],
  ["Nicolas Perrault", "Domaine Nicolas Perrault"],
  ["Alain Gras", "Domaine Alain Gras"],
  ["Joseph Colin", "Domaine Joseph Colin"],
  ["Lafouge", "Domaine Lafouge"],
  ["Pierre Guillemot", "Domaine Pierre Guillemot"],
  ["Rapet", "Domaine Rapet", "Domaine Rapet Père & Fils"],
  ["Yvon Clerget", "Domaine Yvon Clerget"],
  ["Maxime Cottenceau", "Domaine Maxime Cottenceau"]
];

const bordeauxThreeGrapes:readonly NamedEstate[]=[
  ["Château Léoville Las Cases", "Chateau Leoville Las Cases", "Château Léoville-Las-Cases", "Chateau Leoville-Las-Cases"],
  ["Château Lafite Rothschild", "Chateau Lafite Rothschild"],
  ["Château Montrose", "Chateau Montrose"],
  ["Petrus", "Pétrus"],
  ["Château La Conseillante", "Chateau La Conseillante"],
  ["Château Lafleur", "Chateau Lafleur"],
  ["Château Cheval Blanc", "Chateau Cheval Blanc"],
  ["Château-Figeac", "Château Figeac", "Chateau-Figeac", "Chateau Figeac"],
  ["Château d’Yquem", "Château d'Yquem", "Chateau d'Yquem", "Chateau d’Yquem"]
];

const bordeauxTwoGrapes:readonly NamedEstate[]=[
  ["Château Mouton Rothschild", "Chateau Mouton Rothschild", "Château Mouton-Rothschild", "Chateau Mouton-Rothschild"],
  ["Château Pichon Comtesse", "Chateau Pichon Comtesse", "Château Pichon Longueville Comtesse de Lalande", "Chateau Pichon Longueville Comtesse de Lalande", "Pichon Comtesse de Lalande"],
  ["Château Pichon Baron", "Chateau Pichon Baron", "Château Pichon Longueville Baron", "Chateau Pichon Longueville Baron"],
  ["Château Pontet-Canet", "Chateau Pontet-Canet", "Château Pontet Canet", "Chateau Pontet Canet"],
  ["Château Margaux", "Chateau Margaux"],
  ["Château Palmer", "Chateau Palmer"],
  ["Château Troplong Mondot", "Chateau Troplong Mondot", "Château Troplong-Mondot", "Chateau Troplong-Mondot"],
  ["Château Canon", "Chateau Canon"],
  ["Château Ausone", "Chateau Ausone"],
  ["Château Angélus", "Chateau Angelus", "Chateau Angélus"],
  ["Château Beau-Séjour Bécot", "Chateau Beau-Sejour Becot", "Château Beauséjour Bécot", "Chateau Beausejour Becot", "Beau-Séjour Bécot"],
  ["Vieux Château Certan", "Vieux Chateau Certan"],
  ["Château Haut-Brion", "Chateau Haut-Brion", "Château Haut Brion", "Chateau Haut Brion"],
  ["Château La Mission Haut-Brion", "Chateau La Mission Haut-Brion", "Château La Mission Haut Brion", "Chateau La Mission Haut Brion"],
  ["Château Les Carmes Haut-Brion", "Chateau Les Carmes Haut-Brion", "Château Les Carmes Haut Brion", "Chateau Les Carmes Haut Brion"],
  ["Château de Fargues", "Chateau de Fargues"]
];

const bordeauxOneGrape:readonly NamedEstate[]=[
  ["Château Canon La Gaffelière", "Chateau Canon La Gaffeliere", "Château Canon-la-Gaffelière", "Chateau Canon-la-Gaffeliere"],
  ["Château Bélair-Monange", "Chateau Belair-Monange", "Château Belair-Monange"],
  "La Mondotte",
  ["Château Beauséjour", "Chateau Beausejour", "Château Beauséjour (Duffau-Lagarrosse)", "Château Beauséjour Duffau-Lagarrosse", "Chateau Beausejour Duffau-Lagarrosse"],
  ["Château Bellefont-Belcier", "Chateau Bellefont-Belcier", "Château Bellefont Belcier", "Chateau Bellefont Belcier"],
  ["Château Jean Faure", "Chateau Jean Faure"],
  ["Château Larcis Ducasse", "Chateau Larcis Ducasse", "Château Larcis-Ducasse", "Chateau Larcis-Ducasse"],
  ["Château Berliquet", "Chateau Berliquet"],
  ["Château Mangot", "Chateau Mangot"],
  ["Château Soutard", "Chateau Soutard"],
  ["Château Branaire-Ducru", "Chateau Branaire-Ducru", "Château Branaire Ducru", "Chateau Branaire Ducru"],
  ["Château Léoville Barton", "Chateau Leoville Barton"],
  ["Château Lagrange", "Chateau Lagrange"],
  ["Château Langoa Barton", "Chateau Langoa Barton"],
  ["Château Calon Ségur", "Chateau Calon Segur", "Château Calon-Ségur", "Chateau Calon-Segur"],
  ["Château Cos d’Estournel", "Château Cos d'Estournel", "Chateau Cos d'Estournel", "Chateau Cos d’Estournel"],
  ["Château Haut-Marbuzet", "Chateau Haut-Marbuzet", "Château Haut Marbuzet", "Chateau Haut Marbuzet"],
  ["Château de Fieuzal", "Chateau de Fieuzal"],
  ["Domaine de Chevalier", "Château de Chevalier", "Chateau de Chevalier"],
  ["Château Haut-Bailly", "Chateau Haut-Bailly", "Château Haut Bailly", "Chateau Haut Bailly"],
  ["Château Smith Haut Lafitte", "Chateau Smith Haut Lafitte"],
  ["Château Giscours", "Chateau Giscours"],
  ["Château Brane-Cantenac", "Chateau Brane-Cantenac", "Château Brane Cantenac", "Chateau Brane Cantenac"],
  ["Château Rauzan-Ségla", "Chateau Rauzan-Segla", "Château Rauzan Segla", "Chateau Rauzan Segla"],
  ["Château Grand-Puy-Lacoste", "Chateau Grand-Puy-Lacoste", "Château Grand Puy Lacoste", "Chateau Grand Puy Lacoste"],
  ["Château Lynch-Bages", "Chateau Lynch-Bages", "Château Lynch Bages", "Chateau Lynch Bages"],
  ["Château Clerc Milon", "Chateau Clerc Milon"],
  ["Château Clinet", "Chateau Clinet"],
  ["Château La Fleur-Pétrus", "Chateau La Fleur-Petrus", "Château Lafleur-Pétrus", "Chateau Lafleur-Petrus", "La Fleur-Pétrus"],
  ["Château Trotanoy", "Chateau Trotanoy"],
  ["Château L’Évangile", "Château L'Evangile", "Chateau L'Evangile", "Chateau L’Évangile"],
  ["Château Le Pin", "Chateau Le Pin", "Le Pin"],
  ["Château Coutet", "Chateau Coutet"],
  ["Château Sigalas Rabaud", "Chateau Sigalas Rabaud", "Château Sigalas-Rabaud", "Chateau Sigalas-Rabaud"],
  ["Château Closiot", "Chateau Closiot"],
  ["Château Rieussec", "Chateau Rieussec"],
  ["Château Suduiraut", "Chateau Suduiraut"]
];

const bordeauxSelected:readonly NamedEstate[]=[
  ["Château d’Armailhac", "Château d'Armailhac", "Chateau d'Armailhac", "Chateau d’Armailhac"],
  ["Château Duhart-Milon", "Chateau Duhart-Milon", "Château Duhart Milon", "Chateau Duhart Milon"],
  ["Château Pédesclaux", "Chateau Pedesclaux"],
  ["Château Lascombes", "Chateau Lascombes"],
  ["Château Cantenac Brown", "Chateau Cantenac Brown", "Château Cantenac-Brown", "Chateau Cantenac-Brown"],
  ["Château Malescot Saint-Exupéry", "Chateau Malescot Saint-Exupery", "Château Malescot St-Exupéry", "Chateau Malescot St-Exupery"],
  ["Château Beychevelle", "Chateau Beychevelle"],
  ["Château Gruaud Larose", "Chateau Gruaud Larose", "Château Gruaud-Larose", "Chateau Gruaud-Larose"],
  ["Château Saint-Pierre", "Chateau Saint-Pierre", "Château Saint Pierre", "Chateau Saint Pierre"],
  ["Château Talbot", "Chateau Talbot"],
  ["Château Franc Mayne", "Chateau Franc Mayne", "Château Franc-Mayne", "Chateau Franc-Mayne"],
  ["Château Clos Fourtet", "Chateau Clos Fourtet", "Clos Fourtet"],
  ["Château La Clotte", "Chateau La Clotte"],
  ["Château Larmande", "Chateau Larmande"],
  ["Château Quintus", "Chateau Quintus"],
  ["Château Rocheyron", "Chateau Rocheyron"],
  ["Château Bourgneuf", "Chateau Bourgneuf"],
  ["Château Nénin", "Chateau Nenin", "Château Nenin"],
  ["Château Lafon-Rochet", "Chateau Lafon-Rochet", "Château Lafon Rochet", "Chateau Lafon Rochet"],
  ["Château Guiraud", "Chateau Guiraud"],
  ["Château La Tour Blanche", "Chateau La Tour Blanche"]
];

function collection(id:string,title:string,subtitle:string,region:MichelinRegion,reference:MichelinReference,tier:string,items:readonly NamedEstate[]):AchievementDefinition{
  return {
    id,title,subtitle,category:'guide-selections',icon:'michelin-grapes',references:[reference],
    items:producerItems(id,items),
    series:{id:'michelin-grapes',authority:'MICHELIN Guide',region,edition:2026,tier}
  };
}

// Edition-scoped lists are immutable achievement history. Later MICHELIN updates become
// new region/edition entries instead of rewriting progress already earned.
export const michelinAchievementDefinitions:AchievementDefinition[]=[
  collection('michelin-grapes-bordeaux-2026-three','Three MICHELIN Grapes · Bordeaux 2026','Taste wines from all 9 Bordeaux estates awarded Three MICHELIN Grapes.','Bordeaux',bordeauxReference,'three',bordeauxThreeGrapes),
  collection('michelin-grapes-bordeaux-2026-two','Two MICHELIN Grapes · Bordeaux 2026','Taste wines from all 16 Bordeaux estates awarded Two MICHELIN Grapes.','Bordeaux',bordeauxReference,'two',bordeauxTwoGrapes),
  collection('michelin-grapes-bordeaux-2026-one','One MICHELIN Grape · Bordeaux 2026','Taste wines from all 37 Bordeaux estates awarded One MICHELIN Grape.','Bordeaux',bordeauxReference,'one',bordeauxOneGrape),
  collection('michelin-grapes-bordeaux-2026-selected','MICHELIN Selected Estates · Bordeaux 2026','Taste wines from all 21 additional Bordeaux estates selected by the MICHELIN Guide.','Bordeaux',bordeauxReference,'selected',bordeauxSelected),
  collection('michelin-grapes-burgundy-2026-three','Three MICHELIN Grapes · Burgundy 2026','Taste wines from all 9 estates awarded the inaugural highest MICHELIN Grape distinction.','Burgundy',burgundyReference,'three',burgundyThreeGrapes),
  collection('michelin-grapes-burgundy-2026-two','Two MICHELIN Grapes · Burgundy 2026','Taste wines from all 20 estates awarded Two MICHELIN Grapes in Burgundy.','Burgundy',burgundyReference,'two',burgundyTwoGrapes),
  collection('michelin-grapes-burgundy-2026-one','One MICHELIN Grape · Burgundy 2026','Taste wines from all 33 Burgundy estates awarded One MICHELIN Grape.','Burgundy',burgundyReference,'one',burgundyOneGrape),
  collection('michelin-grapes-burgundy-2026-selected','MICHELIN Selected Estates · Burgundy 2026','Taste wines from all 32 additional Burgundy estates selected by the MICHELIN Guide.','Burgundy',burgundyReference,'selected',burgundySelected)
];
