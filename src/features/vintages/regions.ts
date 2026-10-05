import { BORDEAUX_VILLAGES } from './bordeauxVillages';
import { BURGUNDY_VILLAGES } from './burgundyVillages';
import { CHAMPAGNE_VILLAGES } from './champagneVillages';
import type { GrapeId,VintageGrape,VintageIndex,VintageRegionConfig,VintageVillage } from './types';

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

/**
 * The red communes, Pessac-Léognan's dry whites, and Sauternes and Barsac. Each place blends
 * its grapes; the page reads the blend unless a grape is chosen.
 */
export const BORDEAUX:VintageRegionConfig={
  id:'bordeaux',
  name:'Bordeaux',
  country:'France',
  hemisphere:'north',
  areas:[
    {id:'left-bank',name:'Left bank'},
    {id:'right-bank',name:'Right bank'},
    {id:'sauternes',name:'Sauternes & Barsac'},
    // Pessac-Léognan's white grapes, picked on their own dates; no village sits in it.
    {id:'dry-white',name:'Dry whites'}
  ],
  villages:BORDEAUX_VILLAGES,
  grapes:[
    // Minimum sugar from each appellation's cahier des charges (INAO): Merlot 189 g/L, other
    // grapes 180; Saint-Émilion grand cru 194 / 189; Pomerol 194 / 180. Pessac-Léognan white:
    // Sauvignon 187, Sémillon 178. Sauternes and Barsac: 221 for every grape. A blend takes its mix.
    {id:'blend',name:'Blend',ripeSugar:200,minSugar:189,colour:'red',blend:true},
    {id:'blend-white',name:'White blend',ripeSugar:200,minSugar:183,colour:'white',blend:true},
    {id:'blend-sweet',name:'Blend',ripeSugar:200,minSugar:221,colour:'white',blend:true,sweet:true},
    {id:'merlot',name:'Merlot',ripeSugar:200,minSugar:189,minSugarAt:{'saint-emilion':194,pomerol:194},colour:'red'},
    {id:'cabernet-sauvignon',name:'Cabernet Sauvignon',ripeSugar:200,minSugar:180,minSugarAt:{'saint-emilion':189},colour:'red'},
    {id:'cabernet-franc',name:'Cabernet Franc',ripeSugar:200,minSugar:180,minSugarAt:{'saint-emilion':189},colour:'red'},
    {id:'semillon',name:'Sémillon',ripeSugar:200,minSugar:178,minSugarAt:{sauternes:221,barsac:221},colour:'white'},
    {id:'sauvignon-blanc',name:'Sauvignon Blanc',ripeSugar:200,minSugar:187,minSugarAt:{sauternes:221,barsac:221},colour:'white'}
  ],
  dataDir:'/data/vintages/bordeaux',
  defaultVillage:'pauillac',
  defaultGrape:'blend'
};

/** The grapes a village is read for: those its data file carries, in the region's order. */
export function villageGrapes(region:VintageRegionConfig,available:readonly string[]|null):readonly VintageGrape[]{
  return available?region.grapes.filter(grape=>available.includes(grape.id)):region.grapes;
}

/** The grape a village opens on: the one asked for if it grows there, else its first blend, else its first grape. */
export function pickGrape(grapes:readonly VintageGrape[],asked:string|null,fallback:GrapeId):GrapeId{
  return grapes.find(grape=>grape.id===asked)?.id??grapes.find(grape=>grape.id===fallback)?.id??grapes.find(grape=>grape.blend)?.id??grapes[0]?.id??fallback;
}

/** Whose harvest dates a grape follows here: its colour's own area where the index sets one. */
export function harvestArea(index:Pick<VintageIndex,'colourAreas'>|null|undefined,village:VintageVillage,grape:Pick<VintageGrape,'colour'>){
  return index?.colourAreas?.[grape.colour]?.[village.area]??village.area;
}

/**
 * Champagne by sub-region. Each blends Pinot Noir, Meunier and Chardonnay; all three are read
 * as the base for a sparkling white, so black grapes are judged on freshness, not colour.
 */
export const CHAMPAGNE:VintageRegionConfig={
  id:'champagne',
  name:'Champagne',
  country:'France',
  hemisphere:'north',
  areas:[
    {id:'montagne-de-reims',name:'Montagne de Reims'},
    {id:'vallee-de-la-marne',name:'Vallée de la Marne'},
    {id:'cote-des-blancs',name:'Côte des Blancs'},
    {id:'cote-des-bar',name:'Côte des Bar'}
  ],
  villages:CHAMPAGNE_VILLAGES,
  grapes:[
    // Minimum sugar 143 g/L for every grape (décret of 2010: 9 % vol natural strength).
    {id:'blend',name:'Blend',ripeSugar:200,minSugar:143,colour:'white',blend:true},
    {id:'pinot-noir',name:'Pinot Noir',ripeSugar:200,minSugar:143,colour:'red'},
    {id:'meunier',name:'Meunier',ripeSugar:200,minSugar:143,colour:'red'},
    {id:'chardonnay',name:'Chardonnay',ripeSugar:200,minSugar:143,colour:'white'}
  ],
  dataDir:'/data/vintages/champagne',
  defaultVillage:'montagne-de-reims',
  defaultGrape:'blend',
  sparkling:true
};

export const VINTAGE_REGIONS:readonly VintageRegionConfig[]=[BURGUNDY,BORDEAUX,CHAMPAGNE];

/** The region a village belongs to; village ids are unique across regions. */
export function regionOfVillage(id:string|null|undefined):VintageRegionConfig|null{
  return VINTAGE_REGIONS.find(region=>region.villages.some(village=>village.id===id))??null;
}

export function regionById(id:string|null|undefined):VintageRegionConfig|null{
  return VINTAGE_REGIONS.find(region=>region.id===id)??null;
}

export const DEFAULT_VILLAGE=BURGUNDY.defaultVillage;
