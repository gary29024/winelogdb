import type {
  AchievementCuveeIdentity,AchievementDefinition,AchievementIdentityRegistry,AchievementItemProgress,AchievementMatchMode,AchievementProgress,AchievementProducerIdentity,AchievementSelector,AchievementVintageLink,AchievementWine,SiteSelector
} from './types';

export function normalizeAchievementIdentity(value:string){
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[’'`]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
}

type WineKeys={producer:string;wine:string;appellation:string};
type IdentityIndexes={
  producerNames:Map<string,Set<string>>;
  cuveeNames:Map<string,Map<string,Set<string>>>;
  producerById:Map<string,AchievementProducerIdentity>;
  cuveeById:Map<string,AchievementCuveeIdentity>;
  cuveeIdsByName:Map<string,Set<string>>;
  winesByProducerId:Map<string,AchievementWine[]>;
  winesByCuveeId:Map<string,AchievementWine[]>;
  winesByProducerName:Map<string,AchievementWine[]>;
  winesByWineName:Map<string,AchievementWine[]>;
  winesByAppellation:Map<string,AchievementWine[]>;
  wineKeys:Map<string,WineKeys>;
};

function addIndex(index:Map<string,Set<string>>,name:string,id:string){
  const key=normalizeAchievementIdentity(name);if(!key)return;
  const ids=index.get(key)??new Set<string>();ids.add(id);index.set(key,ids);
}
function addRows(index:Map<string,AchievementWine[]>,key:string,row:AchievementWine){
  if(!key)return;const rows=index.get(key)??[];rows.push(row);index.set(key,rows);
}
function normalizedSet(values:string[]|undefined){return new Set((values??[]).map(normalizeAchievementIdentity).filter(Boolean))}
function matchesKey(value:string,names:Set<string>){return Boolean(value&&names.has(value))}
function uniqueRows(rows:AchievementWine[]){
  const seen=new Set<string>();return rows.filter(row=>!seen.has(row.id)&&Boolean(seen.add(row.id)));
}
function indexedRows(index:Map<string,AchievementWine[]>,keys:Set<string>){
  const rows:AchievementWine[]=[];for(const key of keys)rows.push(...(index.get(key)??[]));return uniqueRows(rows);
}

function buildIndexes(registry:AchievementIdentityRegistry,wines:AchievementWine[]):IdentityIndexes{
  const producerNames=new Map<string,Set<string>>(),cuveeNames=new Map<string,Map<string,Set<string>>>();
  const producerById=new Map<string,AchievementProducerIdentity>(),cuveeById=new Map<string,AchievementCuveeIdentity>(),cuveeIdsByName=new Map<string,Set<string>>();
  const winesByProducerId=new Map<string,AchievementWine[]>(),winesByCuveeId=new Map<string,AchievementWine[]>(),winesByProducerName=new Map<string,AchievementWine[]>(),winesByWineName=new Map<string,AchievementWine[]>(),winesByAppellation=new Map<string,AchievementWine[]>(),wineKeys=new Map<string,WineKeys>();
  for(const producer of registry.producers){
    producerById.set(producer.id,producer);
    for(const name of [producer.canonicalName,...(producer.aliases??[])])addIndex(producerNames,name,producer.id);
  }
  for(const cuvee of registry.cuvees){
    cuveeById.set(cuvee.id,cuvee);
    const producerIndex=cuveeNames.get(cuvee.producerId)??new Map<string,Set<string>>();
    for(const name of [cuvee.canonicalName,...(cuvee.aliases??[])]){
      addIndex(producerIndex,name,cuvee.id);addIndex(cuveeIdsByName,name,cuvee.id);
    }
    cuveeNames.set(cuvee.producerId,producerIndex);
  }
  for(const wine of wines){
    const keys={producer:normalizeAchievementIdentity(wine.producer),wine:normalizeAchievementIdentity(wine.wineName),appellation:normalizeAchievementIdentity(wine.appellation??'')};
    wineKeys.set(wine.id,keys);
    if(wine.producerId)addRows(winesByProducerId,wine.producerId,wine);
    if(wine.cuveeId)addRows(winesByCuveeId,wine.cuveeId,wine);
    addRows(winesByProducerName,keys.producer,wine);addRows(winesByWineName,keys.wine,wine);addRows(winesByAppellation,keys.appellation,wine);
  }
  return {producerNames,cuveeNames,producerById,cuveeById,cuveeIdsByName,winesByProducerId,winesByCuveeId,winesByProducerName,winesByWineName,winesByAppellation,wineKeys};
}

function uniqueIndexedId(names:string[],index:Map<string,Set<string>>){
  const ids=new Set<string>();
  for(const name of names){for(const id of index.get(normalizeAchievementIdentity(name))??[])ids.add(id)}
  return ids.size===1?[...ids][0]:undefined;
}

function selectorProducerNames(selector:AchievementSelector){return selector.type==='appellation'||selector.type==='site'?[]:selector.producerNames}
function selectorCuveeNames(selector:AchievementSelector){return selector.type==='cuvee'||selector.type==='wine_vintage'||selector.type==='site'?selector.cuveeNames:[]}
function matchesAppellationKey(value:string,names:string[]|undefined){return !names?.length||normalizedSet(names).has(value)}

function resolveProducer(selector:AchievementSelector,indexes:IdentityIndexes){
  if(selector.type!=='appellation'&&selector.type!=='site'&&selector.producerId&&indexes.producerById.has(selector.producerId))return selector.producerId;
  const names=selectorProducerNames(selector);return names.length?uniqueIndexedId(names,indexes.producerNames):undefined;
}

function resolveCuvee(selector:AchievementSelector,producerId:string|undefined,indexes:IdentityIndexes){
  if(!producerId||(selector.type!=='cuvee'&&selector.type!=='wine_vintage'))return undefined;
  if(selector.cuveeId){
    const direct=indexes.cuveeById.get(selector.cuveeId);
    if(direct?.producerId===producerId&&matchesAppellationKey(normalizeAchievementIdentity(direct.appellation??''),selector.appellationNames))return direct.id;
  }
  const producerIndex=indexes.cuveeNames.get(producerId);if(!producerIndex)return undefined;
  const ids=new Set<string>();
  for(const name of selector.cuveeNames){for(const id of producerIndex.get(normalizeAchievementIdentity(name))??[])ids.add(id)}
  const compatible=[...ids].filter(id=>{
    const cuvee=indexes.cuveeById.get(id);return Boolean(cuvee&&matchesAppellationKey(normalizeAchievementIdentity(cuvee.appellation??''),selector.appellationNames));
  });
  return compatible.length===1?compatible[0]:undefined;
}

function siteCuveeIds(selector:SiteSelector,indexes:IdentityIndexes){
  const names=normalizedSet(selector.cuveeNames),ids=new Set<string>();
  for(const name of names){
    for(const id of indexes.cuveeIdsByName.get(name)??[]){
      const cuvee=indexes.cuveeById.get(id);
      if(cuvee&&matchesAppellationKey(normalizeAchievementIdentity(cuvee.appellation??''),selector.appellationNames))ids.add(id);
    }
  }
  return ids;
}

function rawPossibleMatches(selector:AchievementSelector,indexes:IdentityIndexes,matchMode:AchievementMatchMode){
  if(selector.type==='appellation')return [];
  if(selector.type==='site'){
    const names=normalizedSet(selector.cuveeNames),rows=indexedRows(indexes.winesByWineName,names);
    return rows.filter(wine=>{
      const keys=indexes.wineKeys.get(wine.id);return Boolean(keys&&!wine.cuveeId&&matchesAppellationKey(keys.appellation,selector.appellationNames));
    });
  }
  const producerNames=normalizedSet(selector.producerNames),rows=indexedRows(indexes.winesByProducerName,producerNames);
  if(selector.type==='producer'||(selector.type==='wine_vintage'&&matchMode==='producer'))return rows.filter(wine=>!wine.producerId);
  const cuveeNames=normalizedSet(selectorCuveeNames(selector));
  return rows.filter(wine=>{
    const keys=indexes.wineKeys.get(wine.id);if(!keys||!matchesKey(keys.wine,cuveeNames)||!matchesAppellationKey(keys.appellation,selector.appellationNames))return false;
    if(selector.type==='wine_vintage'&&matchMode==='exact'&&wine.vintage!==selector.vintage)return false;
    return !wine.cuveeId;
  });
}

function directMatches(selector:AchievementSelector,producerId:string|undefined,cuveeId:string|undefined,indexes:IdentityIndexes,matchMode:AchievementMatchMode){
  if(selector.type==='appellation')return indexedRows(indexes.winesByAppellation,normalizedSet(selector.appellationNames));
  if(selector.type==='site'){
    const ids=siteCuveeIds(selector,indexes),rows:AchievementWine[]=[];for(const id of ids)rows.push(...(indexes.winesByCuveeId.get(id)??[]));return uniqueRows(rows);
  }
  if(selector.type==='producer'||(selector.type==='wine_vintage'&&matchMode==='producer'))return producerId?[...(indexes.winesByProducerId.get(producerId)??[])]:[];
  if(!cuveeId)return [];
  const rows=[...(indexes.winesByCuveeId.get(cuveeId)??[])];
  return selector.type==='wine_vintage'&&matchMode==='exact'?rows.filter(wine=>wine.vintage===selector.vintage):rows;
}

/**
 * Which tasting a checklist row opens.
 *
 * The wines arrive ordered by tasting date, but a row that matched several
 * still has to choose one, and taking whatever came first meant the link could
 * point somewhere different between two loads. The order here is deliberate:
 * the vintage the target actually names, then the most recent tasting, then the
 * id so it is stable across a cache rebuild.
 */
const tastedAt=(wine:AchievementWine)=>{const at=Date.parse(String(wine.tastingDate??''));return Number.isFinite(at)?at:-Infinity};

function orderMatches(matched:AchievementWine[],selector:AchievementSelector){
  const wanted=selector.type==='wine_vintage'?selector.vintage:null;
  const named=(wine:AchievementWine)=>wanted!=null&&wine.vintage===wanted?1:0;
  return [...matched].sort((a,b)=>named(b)-named(a)||tastedAt(b)-tastedAt(a)||a.id.localeCompare(b.id));
}

/**
 * One link per tasted vintage, so a row with five of them does not have to pick
 * a favourite. The wines are already ordered, so the first of each vintage is
 * its most recent tasting.
 */
function vintageLinks(ordered:AchievementWine[]):AchievementVintageLink[]{
  const best=new Map<number,string>();
  for(const wine of ordered)if(typeof wine.vintage==='number'&&!best.has(wine.vintage))best.set(wine.vintage,wine.id);
  return [...best.entries()].sort((a,b)=>a[0]-b[0]).map(([vintage,wineId])=>({vintage,wineId}));
}

function progressItem(definitionItem:AchievementDefinition['items'][number],indexes:IdentityIndexes,matchMode:AchievementMatchMode):AchievementItemProgress{
  const resolvedProducerId=resolveProducer(definitionItem.selector,indexes),resolvedCuveeId=resolveCuvee(definitionItem.selector,resolvedProducerId,indexes);
  const direct=directMatches(definitionItem.selector,resolvedProducerId,resolvedCuveeId,indexes,matchMode),possible=direct.length?[]:rawPossibleMatches(definitionItem.selector,indexes,matchMode),matched=direct.length?direct:possible;
  const ordered=orderMatches(matched,definitionItem.selector);
  const links=vintageLinks(ordered),vintages=links.map(link=>link.vintage);
  return {
    id:definitionItem.id,label:definitionItem.label,note:definitionItem.note,status:direct.length?'tasted':possible.length?'possible':'pending',
    tastedWineIds:ordered.map(wine=>wine.id),tastedVintages:vintages,tastedVintageLinks:links,
    ...(resolvedProducerId?{resolvedProducerId}:{}),...(resolvedCuveeId?{resolvedCuveeId}:{})
  };
}

function supportsRelaxedMatching(definition:AchievementDefinition){return definition.items.some(item=>item.selector.type==='wine_vintage')}
function progressWithIndexes(definition:AchievementDefinition,indexes:IdentityIndexes,requestedMode:AchievementMatchMode):AchievementProgress{
  const relaxed=supportsRelaxedMatching(definition),matchMode=relaxed?requestedMode:'exact';
  const items=definition.items.map(item=>progressItem(item,indexes,matchMode));
  const completed=items.filter(item=>item.status==='tasted').length,possible=items.filter(item=>item.status==='possible').length,total=items.length,pending=total-completed-possible;
  return {definition,completed,possible,pending,total,percent:total?Math.round(completed/total*100):0,complete:total>0&&completed===total,items,matchMode,supportsRelaxedMatching:relaxed};
}

export function buildAchievementProgress(definition:AchievementDefinition,registry:AchievementIdentityRegistry,wines:AchievementWine[],matchMode:AchievementMatchMode='exact'):AchievementProgress{
  return progressWithIndexes(definition,buildIndexes(registry,wines),matchMode);
}

export function buildAllAchievementProgress(definitions:AchievementDefinition[],registry:AchievementIdentityRegistry,wines:AchievementWine[],matchModes:Record<string,AchievementMatchMode>={}){
  const indexes=buildIndexes(registry,wines);
  return definitions.map(definition=>progressWithIndexes(definition,indexes,matchModes[definition.id]??'exact'));
}

export function achievementRegistryFromEntities(producers:AchievementProducerIdentity[],cuvees:AchievementCuveeIdentity[]):AchievementIdentityRegistry{return {producers,cuvees}}
