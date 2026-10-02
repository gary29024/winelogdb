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

/** Which village's weather a wine belongs to, from its appellation and name; null when it cannot tell. */
export function villageForWine(wine:Pick<JournalWine,'appellation'|'wineName'>,villages:readonly VintageVillage[]):string|null{
  const texts=[wine.appellation,wine.wineName].filter((value):value is string=>!!value).map(plain);
  for(const text of texts){
    // Longest village name first, so "Chorey-lès-Beaune" is not read as Beaune.
    const byLength=[...villages].sort((a,b)=>b.name.length-a.name.length);
    const village=byLength.find(item=>text.includes(plain(item.name))&&!item.id.startsWith('hautes-cotes'));
    const cru=[...CRU_VILLAGE].sort((a,b)=>b[0].length-a[0].length).find(([name])=>text.includes(name));
    // A cru named outright beats a village name the cru happens to contain
    // (Chevalier-Montrachet sits in Puligny, not in a "Montrachet" village).
    if(cru&&(!village||cru[0].length>=plain(village.name).length))return cru[1];
    if(village)return village.id;
  }
  return null;
}

export type VintageWine=Pick<JournalWine,'id'|'producer'|'wineName'|'vintage'|'appellation'|'wineStyle'>&{village:string};

/** The reader's Burgundy wines that name a vintage and a village we cover. Read once per visit. */
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
