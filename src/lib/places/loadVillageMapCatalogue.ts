import type { VillageMapCatalogue } from './burgundyVillageMap';

const loaders=new Map<string,()=>Promise<{default:VillageMapCatalogue}>>([
 ['gevrey-chambertin',()=>import('./burgundyVillageMapCatalogue.json')],
 ['morey-saint-denis',()=>import('./moreyVillageMapCatalogue.json')],
 ['chambolle-musigny',()=>import('./chambolleVillageMapCatalogue.json')],
 ['vosne-romanee',()=>import('./vosneVillageMapCatalogue.json')],
 ['fixin',()=>import('./fixinVillageMapCatalogue.json')],
 ['vougeot',()=>import('./vougeotVillageMapCatalogue.json')],
 ['nuits-saint-georges',()=>import('./nuitsVillageMapCatalogue.json')],
 ['marsannay',()=>import('./marsannayVillageMapCatalogue.json')],
 ['cote-de-nuits-villages',()=>import('./coteNuitsVillageMapCatalogue.json')],
 ['meursault',()=>import('./meursaultVillageMapCatalogue.json')],
 ['puligny-montrachet',()=>import('./pulignyVillageMapCatalogue.json')],
 ['chassagne-montrachet',()=>import('./chassagneVillageMapCatalogue.json')],
 ['saint-aubin',()=>import('./saintAubinVillageMapCatalogue.json')],
 ['blagny',()=>import('./blagnyVillageMapCatalogue.json')],
 ['aloxe-corton',()=>import('./aloxeVillageMapCatalogue.json')],
 ['pernand-vergelesses',()=>import('./pernandVillageMapCatalogue.json')],
 ['ladoix',()=>import('./ladoixVillageMapCatalogue.json')],
 ['beaune',()=>import('./beauneVillageMapCatalogue.json')],
 ['pommard',()=>import('./pommardVillageMapCatalogue.json')],
 ['volnay',()=>import('./volnayVillageMapCatalogue.json')],
]);

export async function loadVillageMapCatalogue(villageId:string):Promise<VillageMapCatalogue>{
 const load=loaders.get(villageId);
 if(!load)throw new Error('Village map is unavailable');
 return (await load()).default;
}
