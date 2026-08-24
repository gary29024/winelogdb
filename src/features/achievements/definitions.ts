import type { AchievementDefinition,AchievementDefinitionItem } from './types';
import { expandedAchievementDefinitions } from './expandedDefinitions';
import { michelinAchievementDefinitions } from './michelinDefinitions';

const producer=(id:string,label:string,...producerNames:string[]):AchievementDefinitionItem=>({id,label,selector:{type:'producer',producerNames}});
const vintage=(id:string,label:string,producerNames:string[],cuveeNames:string[],year:number,note?:string):AchievementDefinitionItem=>({id,label,note,selector:{type:'wine_vintage',producerNames,cuveeNames,vintage:year}});
const appellation=(id:string,label:string,...appellationNames:string[]):AchievementDefinitionItem=>({id,label,selector:{type:'appellation',appellationNames}});

const coreAchievementDefinitions:AchievementDefinition[]=[
  {
    id:'bordeaux-first-growths',
    title:'Bordeaux First Growths',
    subtitle:'Taste all five red Premiers Crus of the 1855 Classification.',
    category:'iconic-estates',
    icon:'first-growth',
    references:[{title:'Bordeaux.com · The 1855 Wines Classifications',url:'https://www.bordeaux.com/en/classifications/classifications-1855/'}],
    items:[
      producer('lafite-rothschild','Château Lafite Rothschild','Château Lafite Rothschild','Chateau Lafite Rothschild'),
      producer('latour','Château Latour','Château Latour','Chateau Latour'),
      producer('margaux','Château Margaux','Château Margaux','Chateau Margaux'),
      producer('haut-brion','Château Haut-Brion','Château Haut-Brion','Chateau Haut-Brion'),
      producer('mouton-rothschild','Château Mouton Rothschild','Château Mouton Rothschild','Chateau Mouton Rothschild','Château Mouton-Rothschild','Chateau Mouton-Rothschild')
    ]
  },
  {
    id:'judgment-of-paris-1976',
    title:'Judgment of Paris 1976',
    subtitle:'The 20 exact vintages poured in the historic Paris tasting.',
    category:'historic-tastings',
    icon:'judgment-paris',
    references:[
      {title:'Judgement of Paris 50 · The Wines',url:'https://judgementofparis50.com/the-wines'},
      {title:'Smithsonian · The 1976 Paris tasting',url:'https://www.smithsonianmag.com/smithsonian-institution/that-revolutionary-May-day-1976-when-california-wines-bested-france-finest-180958971/'}
    ],
    items:[
      vintage('montelena-1973-chardonnay','Chateau Montelena Chardonnay 1973',['Chateau Montelena','Château Montelena'],['Chardonnay','Napa Valley Chardonnay'],1973,'White flight'),
      vintage('roulot-1973-meursault-charmes','Domaine Roulot Meursault-Charmes 1973',['Domaine Roulot','Guy Roulot'],['Meursault Charmes','Meursault-Charmes','Meursault 1er Cru Charmes','Meursault Premier Cru Charmes'],1973,'White flight'),
      vintage('chalone-1974-chardonnay','Chalone Vineyard Chardonnay 1974',['Chalone Vineyard','Chalone'],['Chardonnay','Estate Chardonnay'],1974,'White flight'),
      vintage('spring-mountain-1973-chardonnay','Spring Mountain Vineyard Chardonnay 1973',['Spring Mountain Vineyard'],['Chardonnay','Napa Valley Chardonnay'],1973,'White flight'),
      vintage('drouhin-1973-clos-des-mouches','Joseph Drouhin Beaune Clos des Mouches 1973',['Joseph Drouhin','Maison Joseph Drouhin'],['Beaune Clos des Mouches','Beaune 1er Cru Clos des Mouches','Clos des Mouches Blanc'],1973,'White flight'),
      vintage('freemark-abbey-1972-chardonnay','Freemark Abbey Chardonnay 1972',['Freemark Abbey','Freemark Abbey Winery'],['Chardonnay','Napa Valley Chardonnay'],1972,'White flight'),
      vintage('ramonet-1973-batard-montrachet','Ramonet-Prudhon Bâtard-Montrachet 1973',['Ramonet-Prudhon','Domaine Ramonet','Ramonet'],['Bâtard-Montrachet','Batard-Montrachet'],1973,'White flight'),
      vintage('leflaive-1972-les-pucelles','Domaine Leflaive Puligny-Montrachet Les Pucelles 1972',['Domaine Leflaive'],['Puligny-Montrachet Les Pucelles','Puligny-Montrachet 1er Cru Les Pucelles','Les Pucelles'],1972,'White flight'),
      vintage('veedercrest-1972-chardonnay','Veedercrest Chardonnay 1972',['Veedercrest Vineyards','Veedercrest'],['Chardonnay'],1972,'White flight'),
      vintage('david-bruce-1973-chardonnay','David Bruce Chardonnay 1973',['David Bruce Winery','David Bruce'],['Chardonnay'],1973,'White flight'),
      vintage('stags-leap-1973-cabernet','Stag’s Leap Wine Cellars Cabernet Sauvignon 1973',["Stag's Leap Wine Cellars",'Stag’s Leap Wine Cellars'],['Cabernet Sauvignon','S.L.V. Cabernet Sauvignon','SLV Cabernet Sauvignon','S.L.V.'],1973,'Red flight · winning red'),
      vintage('mouton-rothschild-1970','Château Mouton Rothschild 1970',['Château Mouton Rothschild','Chateau Mouton Rothschild','Château Mouton-Rothschild'],['Château Mouton Rothschild','Chateau Mouton Rothschild','Mouton Rothschild'],1970,'Red flight'),
      vintage('haut-brion-1970','Château Haut-Brion 1970',['Château Haut-Brion','Chateau Haut-Brion'],['Château Haut-Brion','Chateau Haut-Brion','Haut-Brion'],1970,'Red flight'),
      vintage('montrose-1970','Château Montrose 1970',['Château Montrose','Chateau Montrose'],['Château Montrose','Chateau Montrose','Montrose'],1970,'Red flight'),
      vintage('ridge-monte-bello-1971','Ridge Monte Bello 1971',['Ridge Vineyards','Ridge'],['Monte Bello','Monte Bello Cabernet Sauvignon'],1971,'Red flight'),
      vintage('leoville-las-cases-1971','Château Léoville Las Cases 1971',['Château Léoville Las Cases','Chateau Leoville Las Cases','Château Léoville-Las-Cases'],['Château Léoville Las Cases','Chateau Leoville Las Cases','Léoville Las Cases','Leoville Las Cases'],1971,'Red flight'),
      vintage('heitz-marthas-1970','Heitz Martha’s Vineyard Cabernet Sauvignon 1970',['Heitz Cellar','Heitz Cellars','Heitz Wine Cellars'],["Martha's Vineyard Cabernet Sauvignon",'Martha’s Vineyard Cabernet Sauvignon',"Martha's Vineyard"],1970,'Red flight'),
      vintage('clos-du-val-1972-cabernet','Clos du Val Cabernet Sauvignon 1972',['Clos du Val','Clos Du Val Winery','Clos du Val Winery'],['Cabernet Sauvignon','Estate Cabernet Sauvignon'],1972,'Red flight'),
      vintage('mayacamas-1971-cabernet','Mayacamas Cabernet Sauvignon 1971',['Mayacamas Vineyards','Mayacamas'],['Cabernet Sauvignon'],1971,'Red flight'),
      vintage('freemark-abbey-1969-cabernet','Freemark Abbey Cabernet Sauvignon 1969',['Freemark Abbey','Freemark Abbey Winery'],['Cabernet Sauvignon','Napa Valley Cabernet Sauvignon'],1969,'Red flight')
    ]
  },
  {
    id:'beaujolais-ten-crus',
    title:'The 10 Beaujolais Crus',
    subtitle:'Taste a wine from every cru appellation of Beaujolais.',
    category:'regional-exploration',
    icon:'beaujolais-crus',
    references:[{title:'Inter Beaujolais · The 10 Beaujolais Crus',url:'https://www.beaujolais.com/wp-content/uploads/sites/2/2020/09/Carnet-Beaujolais-EN.pdf'}],
    items:[
      appellation('brouilly','Brouilly','Brouilly'),appellation('cote-de-brouilly','Côte de Brouilly','Côte de Brouilly','Cote de Brouilly','Côte-de-Brouilly'),
      appellation('regnie','Régnié','Régnié','Regnie'),appellation('morgon','Morgon','Morgon'),appellation('chiroubles','Chiroubles','Chiroubles'),
      appellation('fleurie','Fleurie','Fleurie'),appellation('moulin-a-vent','Moulin-à-Vent','Moulin-à-Vent','Moulin a Vent','Moulin-a-Vent'),
      appellation('chenas','Chénas','Chénas','Chenas'),appellation('julienas','Juliénas','Juliénas','Julienas'),appellation('saint-amour','Saint-Amour','Saint-Amour','Saint Amour')
    ]
  }
];

const allDefinitions=[...coreAchievementDefinitions,...expandedAchievementDefinitions,...michelinAchievementDefinitions];
const launchIds=[
  'bordeaux-first-growths','bordeaux-second-growths','bordeaux-1855-red-classified-growths','sauternes-barsac-top-1855','sauternes-barsac-second-growths','sauternes-barsac-1855-all','graves-crus-classes',
  'judgment-of-paris-1976','saint-emilion-2022-premiers','burgundy-33-grand-crus','cote-de-nuits-24-grand-crus','cote-de-beaune-8-grand-crus','beaujolais-ten-crus','gevrey-nine-grand-crus','northern-rhone-eight-crus','southern-rhone-ten-crus',
  'michelin-grapes-burgundy-2026-three','michelin-grapes-burgundy-2026-two','michelin-grapes-burgundy-2026-one','michelin-grapes-burgundy-2026-selected'
] as const;

export const achievementDefinitions:AchievementDefinition[]=launchIds.map(id=>{
  const definition=allDefinitions.find(item=>item.id===id);
  if(!definition)throw new Error(`Missing launch achievement definition: ${id}`);
  return definition;
});

export function getAchievementDefinition(id:string){return achievementDefinitions.find(item=>item.id===id)??null}