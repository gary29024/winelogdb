// The Bordeaux red communes, Sauternes and Barsac, placed on their INAO appellation vineyard
// (scripts/vintages/data/bordeaux/villages.json). Saint-Émilion reads the grand cru area;
// Sauternes reads its appellation outside Barsac, which has its own page.
import type { VintageVillage } from './types';

export const BORDEAUX_VILLAGES:readonly VintageVillage[]=[
  {id:'saint-estephe',name:'Saint-Estèphe',area:'left-bank',lat:45.2481,lon:-0.7766},
  {id:'pauillac',name:'Pauillac',area:'left-bank',lat:45.2134,lon:-0.7756},
  {id:'saint-julien',name:'Saint-Julien',area:'left-bank',lat:45.1578,lon:-0.7720},
  {id:'margaux',name:'Margaux',area:'left-bank',lat:45.0269,lon:-0.6666},
  {id:'pessac-leognan',name:'Pessac-Léognan',area:'left-bank',lat:44.7195,lon:-0.6245},
  {id:'saint-emilion',name:'Saint-Émilion',area:'right-bank',lat:44.8843,lon:-0.0995},
  {id:'pomerol',name:'Pomerol',area:'right-bank',lat:44.9303,lon:-0.1967},
  {id:'sauternes',name:'Sauternes',area:'sauternes',lat:44.5305,lon:-0.2994},
  {id:'barsac',name:'Barsac',area:'sauternes',lat:44.5965,lon:-0.3397}
];
