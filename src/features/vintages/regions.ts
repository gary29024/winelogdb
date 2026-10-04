import { BORDEAUX_VILLAGES } from './bordeauxVillages';
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
    {id:'pinot-noir',name:'Pinot Noir',ripeSugar:200,minSugar:180,colour:'red'},
    {id:'chardonnay',name:'Chardonnay',ripeSugar:200,minSugar:178,colour:'white'}
  ],
  dataDir:'/data/vintages/burgundy',
  defaultVillage:'meursault',
  defaultGrape:'chardonnay'
};

/** The red communes. Each blends its grapes; the page reads the blend unless a grape is chosen. */
export const BORDEAUX:VintageRegionConfig={
  id:'bordeaux',
  name:'Bordeaux',
  country:'France',
  hemisphere:'north',
  areas:[
    {id:'left-bank',name:'Left bank'},
    {id:'right-bank',name:'Right bank'}
  ],
  villages:BORDEAUX_VILLAGES,
  grapes:[
    // Minimum sugar from each appellation's cahier des charges (INAO): Merlot 189 g/L, other
    // grapes 180; Saint-Émilion grand cru 194 / 189; Pomerol 194 / 180. A blend takes its mix.
    {id:'blend',name:'Blend',ripeSugar:200,minSugar:189,colour:'red',blend:true},
    {id:'merlot',name:'Merlot',ripeSugar:200,minSugar:189,minSugarAt:{'saint-emilion':194,pomerol:194},colour:'red'},
    {id:'cabernet-sauvignon',name:'Cabernet Sauvignon',ripeSugar:200,minSugar:180,minSugarAt:{'saint-emilion':189},colour:'red'},
    {id:'cabernet-franc',name:'Cabernet Franc',ripeSugar:200,minSugar:180,minSugarAt:{'saint-emilion':189},colour:'red'}
  ],
  dataDir:'/data/vintages/bordeaux',
  defaultVillage:'pauillac',
  defaultGrape:'blend'
};

export const VINTAGE_REGIONS:readonly VintageRegionConfig[]=[BURGUNDY,BORDEAUX];

/** The region a village belongs to; village ids are unique across regions. */
export function regionOfVillage(id:string|null|undefined):VintageRegionConfig|null{
  return VINTAGE_REGIONS.find(region=>region.villages.some(village=>village.id===id))??null;
}

export function regionById(id:string|null|undefined):VintageRegionConfig|null{
  return VINTAGE_REGIONS.find(region=>region.id===id)??null;
}

export const DEFAULT_VILLAGE=BURGUNDY.defaultVillage;
