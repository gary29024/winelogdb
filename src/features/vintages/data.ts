import { listWines,type JournalWine } from '../wines/api';
import type { VillageData,VintageIndex,VintageRegionConfig,VintageVillage } from './types';

/**
 * Loading for the Vintages page. The weather files are static and change once
 * a year, so each is fetched once per session; a reader's own wines come from
 * the Journal they already have.
 */

const cache=new Map<string,Promise<unknown>>();

function fetchJson<T>(url:string):Promise<T>{
  let pending=cache.get(url) as Promise<T>|undefined;
  if(!pending){
    pending=fetch(url).then(async response=>{
      if(!response.ok)throw new Error('Vintage data could not be loaded.');
      return response.json() as Promise<T>;
    });
    pending.catch(()=>cache.delete(url));
    cache.set(url,pending);
  }
  return pending;
}

export const loadVintageIndex=(region:VintageRegionConfig)=>fetchJson<VintageIndex>(`${region.dataDir}/index.json`);
export const loadVillageData=(region:VintageRegionConfig,village:string)=>fetchJson<VillageData>(`${region.dataDir}/${encodeURIComponent(village)}.json`);

/* ---------- The reader's own wines, by village ---------- */

const plain=(value:string)=>value.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

/**
 * Grand crus and named crus that do not carry their village's name. A Chambertin
 * is a Gevrey-Chambertin wine for the weather, though its label never says so.
 */
const CRU_VILLAGE:[string,string][]=[
  ['chambertin','gevrey-chambertin'],['charmes chambertin','gevrey-chambertin'],['mazis chambertin','gevrey-chambertin'],['latricieres chambertin','gevrey-chambertin'],['griotte chambertin','gevrey-chambertin'],['chapelle chambertin','gevrey-chambertin'],['ruchottes chambertin','gevrey-chambertin'],['mazoyeres chambertin','gevrey-chambertin'],
  ['clos de la roche','morey-saint-denis'],['clos saint denis','morey-saint-denis'],['clos des lambrays','morey-saint-denis'],['clos de tart','morey-saint-denis'],['bonnes mares','chambolle-musigny'],
  ['musigny','chambolle-musigny'],['clos de vougeot','vougeot'],['clos vougeot','vougeot'],
  ['echezeaux','vosne-romanee'],['grands echezeaux','vosne-romanee'],['richebourg','vosne-romanee'],['romanee conti','vosne-romanee'],['romanee saint vivant','vosne-romanee'],['la tache','vosne-romanee'],['la romanee','vosne-romanee'],['la grande rue','vosne-romanee'],
  ['corton charlemagne','aloxe-corton'],['charlemagne','aloxe-corton'],['corton','aloxe-corton'],
  ['montrachet','puligny-montrachet'],['chevalier montrachet','puligny-montrachet'],['batard montrachet','puligny-montrachet'],['bienvenues batard montrachet','puligny-montrachet'],['criots batard montrachet','chassagne-montrachet'],
  ['hautes cotes de nuits','hautes-cotes-de-nuits'],['hautes cotes de beaune','hautes-cotes-de-beaune'],['cote de beaune villages','beaune'],['cote de nuits villages','nuits-saint-georges'],
  ['maranges','maranges'],['petit chablis','chablis']
];

/**
 * Champagne's grand and premier cru villages and the sub-region whose weather they share. A
 * Champagne names its village, never its sub-region; matched as whole words (Aÿ is "ay").
 */
const CHAMPAGNE_CRUS:[string,string][]=[['ambonnay','montagne-de-reims'],['avenay val d or','vallee-de-la-marne'],['avize','cote-des-blancs'],['ay','vallee-de-la-marne'],['beaumont sur vesle','montagne-de-reims'],['bergeres les vertus','cote-des-blancs'],['bezannes','montagne-de-reims'],['billy le grand','montagne-de-reims'],['bisseuil','vallee-de-la-marne'],['bouzy','montagne-de-reims'],['chamery','montagne-de-reims'],['champillon','vallee-de-la-marne'],['chigny les roses','montagne-de-reims'],['chouilly','cote-des-blancs'],['coligny val des marais','cote-des-blancs'],['cormontreuil','montagne-de-reims'],['coulommes la montagne','montagne-de-reims'],['cramant','cote-des-blancs'],['cuis','cote-des-blancs'],['cumieres','vallee-de-la-marne'],['dizy','vallee-de-la-marne'],['ecueil','montagne-de-reims'],['etrechy','cote-des-blancs'],['grauves','cote-des-blancs'],['hautvillers','vallee-de-la-marne'],['jouy les reims','montagne-de-reims'],['le mesnil sur oger','cote-des-blancs'],['les mesneux','montagne-de-reims'],['louvois','montagne-de-reims'],['ludes','montagne-de-reims'],['mailly champagne','montagne-de-reims'],['mareuil sur ay','vallee-de-la-marne'],['montbre','montagne-de-reims'],['mutigny','vallee-de-la-marne'],['oger','cote-des-blancs'],['oiry','cote-des-blancs'],['pargny les reims','montagne-de-reims'],['pierry','cote-des-blancs'],['puisieulx','montagne-de-reims'],['rilly la montagne','montagne-de-reims'],['sacy','montagne-de-reims'],['sermiers','montagne-de-reims'],['sillery','montagne-de-reims'],['taissy','montagne-de-reims'],['tauxieres mutry val de livre','vallee-de-la-marne'],['tours sur marne','vallee-de-la-marne'],['trepail','montagne-de-reims'],['trois puits','montagne-de-reims'],['vaudemanges','montagne-de-reims'],['vertus blancs coteaux','cote-des-blancs'],['verzenay','montagne-de-reims'],['verzy','montagne-de-reims'],['villedommange ville dommange','montagne-de-reims'],['villeneuve renneville chevigny','cote-des-blancs'],['villers allerand','montagne-de-reims'],['villers aux nuds','montagne-de-reims'],['villers marmery','montagne-de-reims'],['voipreux blancs coteaux','cote-des-blancs'],['vrigny','montagne-de-reims']];

/**
 * Neighbouring appellations whose names contain a covered one: a Lalande-de-Pomerol is
 * not a Pomerol, and a Lussac-Saint-Émilion grows outside the Saint-Émilion vineyard.
 */
const SATELLITES=['lalande de pomerol','lussac saint emilion','montagne saint emilion','puisseguin saint emilion','saint georges saint emilion'];

/** Which village's weather a wine belongs to, from its appellation and name; null when it cannot tell. */
export function villageForWine(wine:Pick<JournalWine,'appellation'|'wineName'>,villages:readonly VintageVillage[]):string|null{
  const texts=[wine.appellation,wine.wineName].filter((value):value is string=>!!value)
    .map(value=>SATELLITES.reduce((text,name)=>text.replace(name,' '),plain(value)));
  const known=(id:string)=>villages.some(item=>item.id===id);
  for(const text of texts){
    const champagne=CHAMPAGNE_CRUS.find(([name,area])=>known(area)&&new RegExp(`(^| )${name}( |$)`).test(text));
    if(champagne)return champagne[1];
    // Longest village name first, so "Chorey-lès-Beaune" is not read as Beaune.
    const byLength=[...villages].sort((a,b)=>b.name.length-a.name.length);
    const village=byLength.find(item=>text.includes(plain(item.name))&&!item.id.startsWith('hautes-cotes'));
    const cru=[...CRU_VILLAGE].sort((a,b)=>b[0].length-a[0].length).find(([name])=>text.includes(name));
    // A cru named outright beats a village name the cru happens to contain
    // (Chevalier-Montrachet sits in Puligny, not in a "Montrachet" village).
    if(cru&&known(cru[1])&&(!village||cru[0].length>=plain(village.name).length))return cru[1];
    if(village)return village.id;
  }
  return null;
}

export type VintageWine=Pick<JournalWine,'id'|'producer'|'wineName'|'vintage'|'appellation'|'wineStyle'>&{village:string};

/** The reader's wines in this region that name a vintage and a village we cover. Read once per visit. */
export async function loadRegionWines(region:VintageRegionConfig,signal?:AbortSignal):Promise<VintageWine[]>{
  const wines:VintageWine[]=[];
  const params=new URLSearchParams({region:region.name});
  let offset:number|null=0;
  // A Journal page is capped; five pages covers any cellar this page is for.
  for(let page=0;page<5&&offset!=null;page++){
    const result=await listWines(params,{limit:100,offset,signal});
    for(const wine of result.items){
      if(!wine.vintage||wine.shared)continue;
      const village=villageForWine(wine,region.villages);
      if(village)wines.push({id:wine.id,producer:wine.producer,wineName:wine.wineName,vintage:wine.vintage,appellation:wine.appellation,wineStyle:wine.wineStyle,village});
    }
    offset=result.nextOffset;
  }
  return wines;
}

/** The village the reader has logged most, to open the page on. */
export function favouriteVillage(wines:readonly VintageWine[]){
  const counts=new Map<string,number>();
  for(const wine of wines)counts.set(wine.village,(counts.get(wine.village)??0)+1);
  return [...counts].sort((a,b)=>b[1]-a[1])[0]?.[0]??null;
}
