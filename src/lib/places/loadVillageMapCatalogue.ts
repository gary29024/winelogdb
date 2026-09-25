import type { VillageMapCatalogue } from './burgundyVillageMap';

const loaders=new Map<string,()=>Promise<{default:VillageMapCatalogue}>>([
 ['gevrey-chambertin',()=>import('./burgundyVillageMapCatalogue.json')],
 ['morey-saint-denis',()=>import('./moreyVillageMapCatalogue.json')],
 ['chambolle-musigny',()=>import('./chambolleVillageMapCatalogue.json')],
 ['vosne-romanee',()=>import('./vosneVillageMapCatalogue.json')],
]);

export async function loadVillageMapCatalogue(villageId:string):Promise<VillageMapCatalogue>{
 const load=loaders.get(villageId);
 if(!load)throw new Error('Village map is unavailable');
 return (await load()).default;
}
