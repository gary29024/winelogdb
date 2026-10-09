// The four Champagne sub-regions, each read over the vines of its grand and premier cru and main
// villages (scripts/vintages/data/champagne/villages.json).
import type { VintageVillage } from './types';

export const CHAMPAGNE_VILLAGES:readonly VintageVillage[]=[
  {id:'montagne-de-reims',name:'Montagne de Reims',area:'montagne-de-reims',lat:49.13,lon:4.03},
  {id:'vallee-de-la-marne',name:'Vallée de la Marne',area:'vallee-de-la-marne',lat:49.07,lon:3.8},
  {id:'cote-des-blancs',name:'Côte des Blancs',area:'cote-des-blancs',lat:48.97,lon:4},
  {id:'cote-des-bar',name:'Côte des Bar',area:'cote-des-bar',lat:48.08,lon:4.4}
];
