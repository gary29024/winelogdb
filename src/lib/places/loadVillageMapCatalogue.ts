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
 ['savigny-les-beaune',()=>import('./savignyVillageMapCatalogue.json')],
 ['chorey-les-beaune',()=>import('./choreyVillageMapCatalogue.json')],
 ['auxey-duresses',()=>import('./auxeyVillageMapCatalogue.json')],
 ['monthelie',()=>import('./monthelieVillageMapCatalogue.json')],
 ['saint-romain',()=>import('./saintRomainVillageMapCatalogue.json')],
 ['santenay',()=>import('./santenayVillageMapCatalogue.json')],
 ['maranges',()=>import('./marangesVillageMapCatalogue.json')],
 ['cote-de-beaune',()=>import('./coteBeauneVillageMapCatalogue.json')],
 ['cote-de-beaune-villages',()=>import('./coteBeauneVillagesMapCatalogue.json')],
 ['bouzeron',()=>import('./bouzeronVillageMapCatalogue.json')],
 ['rully',()=>import('./rullyVillageMapCatalogue.json')],
 ['mercurey',()=>import('./mercureyVillageMapCatalogue.json')],
 ['givry',()=>import('./givryVillageMapCatalogue.json')],
 ['montagny',()=>import('./montagnyVillageMapCatalogue.json')],
 ['pouilly-fuisse',()=>import('./pouillyFuisseVillageMapCatalogue.json')],
 ['pouilly-loche',()=>import('./pouillyLocheVillageMapCatalogue.json')],
 ['pouilly-vinzelles',()=>import('./pouillyVinzellesVillageMapCatalogue.json')],
 ['saint-veran',()=>import('./saintVeranVillageMapCatalogue.json')],
 ['vire-clesse',()=>import('./vireClesseVillageMapCatalogue.json')],
]);

export async function loadVillageMapCatalogue(villageId:string):Promise<VillageMapCatalogue>{
 const load=loaders.get(villageId);
 if(!load)throw new Error('Village map is unavailable');
 return (await load()).default;
}
