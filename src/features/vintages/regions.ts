import { BURGUNDY_VILLAGES } from './burgundyVillages';
import type { VintageRegionConfig } from './types';

/**
 * Every region the Vintages page can show. Adding one is a config entry plus a
 * data file from the pipeline - the screens read nothing Burgundy-specific.
 */
export const BURGUNDY:VintageRegionConfig={
  id:'burgundy',
  name:'Burgundy',
  country:'France',
  hemisphere:'north',
  areas:[
    {id:'chablis-auxerrois',name:'Chablis & Auxerrois'},
    {id:'cote-de-nuits',name:'Côte de Nuits'},
    {id:'hautes-cotes',name:'Hautes-Côtes'},
    {id:'cote-de-beaune',name:'Côte de Beaune'},
    {id:'cote-chalonnaise',name:'Côte Chalonnaise'},
    {id:'maconnais',name:'Mâconnais'}
  ],
  villages:BURGUNDY_VILLAGES,
  grapes:[
    {id:'pinot-noir',name:'Pinot Noir',ripeSugar:200,minSugar:180},
    {id:'chardonnay',name:'Chardonnay',ripeSugar:200,minSugar:178}
  ],
  dataDir:'/data/vintages/burgundy'
};

export const VINTAGE_REGIONS:readonly VintageRegionConfig[]=[BURGUNDY];

export const DEFAULT_VILLAGE='meursault';
