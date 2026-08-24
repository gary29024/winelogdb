import type {
  AchievementCuveeIdentity,AchievementDefinition,AchievementIdentityRegistry,AchievementItemProgress,AchievementProgress,AchievementProducerIdentity,AchievementSelector,AchievementWine
} from './types';

export function normalizeAchievementIdentity(value:string){
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[’'`]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
}

type IdentityIndexes={producerNames:Map<string,Set<string>>;cuveeNames:Map<string,Map<string,Set<string>>>};

function addIndex(index:Map<string,Set<string>>,name:string,id:string){
  const key=normalizeAchievementIdentity(name);if(!key)return;
  const ids=index.get(key)??new Set<string>();ids.add(id);index.set(key,ids);
}

function buildIndexes(registry:AchievementIdentityRegistry):IdentityIndexes{
  const producerNames=new Map<string,Set<string>>(),cuveeNames=new Map<string,Map<string,Set<string>>>();
  for(const producer of registry.producers){for(const name of [producer.canonicalName,...(producer.aliases??[])])addIndex(producerNames,name,producer.id)}
  for(const cuvee of registry.cuvees){
    const producerIndex=cuveeNames.get(cuvee.producerId)??new Map<string,Set<string>>();
    for(const name of [cuvee.canonicalName,...(cuvee.aliases??[])])addIndex(producerIndex,name,cuvee.id);
    cuveeNames.set(cuvee.producerId,producerIndex);
  }
  return {producerNames,cuveeNames};
}

function uniqueIndexedId(names:string[],index:Map<string,Set<string>>){
  const ids=new Set<string>();
  for(const name of names){for(const id of index.get(normalizeAchievementIdentity(name))??[])ids.add(id)}
  return ids.size===1?[...ids][0]:undefined;
}

function selectorProducerNames(selector:AchievementSelector){return selector.type==='appellation'?[]:selector.producerNames}
function selectorCuveeNames(selector:AchievementSelector){return selector.type==='cuvee'||selector.type==='wine_vintage'?selector.cuveeNames:[]}
function normalizedSet(values:string[]){return new Set(values.map(normalizeAchievementIdentity).filter(Boolean))}
function matchesName(value:string|undefined|null,names:Set<string>){return Boolean(value&&names.has(normalizeAchievementIdentity(value)))}
function matchesAppellation(value:string|undefined|null,names:string[]|undefined){return !names?.length||matchesName(value,normalizedSet(names))}

function resolveProducer(selector:AchievementSelector,registry:AchievementIdentityRegistry,indexes:IdentityIndexes){
  if(selector.type!=='appellation'&&selector.producerId&&registry.producers.some(item=>item.id===selector.producerId))return selector.producerId;
  const names=selectorProducerNames(selector);return names.length?uniqueIndexedId(names,indexes.producerNames):undefined;
}

function resolveCuvee(selector:AchievementSelector,producerId:string|undefined,registry:AchievementIdentityRegistry,indexes:IdentityIndexes){
  if(!producerId||(selector.type!=='cuvee'&&selector.type!=='wine_vintage'))return undefined;
  if(selector.cuveeId){
    const direct=registry.cuvees.find(item=>item.id===selector.cuveeId&&item.producerId===producerId);
    if(direct&&matchesAppellation(direct.appellation,selector.appellationNames))return direct.id;
  }
  const producerIndex=indexes.cuveeNames.get(producerId);if(!producerIndex)return undefined;
  const ids=new Set<string>();
  for(const name of selector.cuveeNames){for(const id of producerIndex.get(normalizeAchievementIdentity(name))??[])ids.add(id)}
  const compatible=[...ids].filter(id=>{
    const cuvee=registry.cuvees.find(item=>item.id===id);return cuvee&&matchesAppellation(cuvee.appellation,selector.appellationNames);
  });
  return compatible.length===1?compatible[0]:undefined;
}

function rawPossibleMatches(selector:AchievementSelector,wines:AchievementWine[]){
  if(selector.type==='appellation')return [];
  const producerNames=normalizedSet(selector.producerNames),cuveeNames=normalizedSet(selectorCuveeNames(selector));
  return wines.filter(wine=>{
    if(!matchesName(wine.producer,producerNames))return false;
    if(selector.type==='producer')return !wine.producerId;
    if(!matchesName(wine.wineName,cuveeNames)||!matchesAppellation(wine.appellation,selector.appellationNames))return false;
    if(selector.type==='wine_vintage'&&wine.vintage!==selector.vintage)return false;
    return !wine.cuveeId;
  });
}

function directMatches(selector:AchievementSelector,producerId:string|undefined,cuveeId:string|undefined,wines:AchievementWine[]){
  if(selector.type==='appellation'){
    const names=normalizedSet(selector.appellationNames);return wines.filter(wine=>matchesName(wine.appellation,names));
  }
  if(selector.type==='producer')return producerId?wines.filter(wine=>wine.producerId===producerId):[];
  if(!cuveeId)return [];
  return wines.filter(wine=>wine.cuveeId===cuveeId&&(selector.type!=='wine_vintage'||wine.vintage===selector.vintage));
}

function progressItem(definitionItem:AchievementDefinition['items'][number],registry:AchievementIdentityRegistry,indexes:IdentityIndexes,wines:AchievementWine[]):AchievementItemProgress{
  const resolvedProducerId=resolveProducer(definitionItem.selector,registry,indexes),resolvedCuveeId=resolveCuvee(definitionItem.selector,resolvedProducerId,registry,indexes);
  const direct=directMatches(definitionItem.selector,resolvedProducerId,resolvedCuveeId,wines),possible=direct.length?[]:rawPossibleMatches(definitionItem.selector,wines),matched=direct.length?direct:possible;
  const vintages=[...new Set(matched.map(wine=>wine.vintage).filter((value):value is number=>typeof value==='number'))].sort((a,b)=>a-b);
  return {
    id:definitionItem.id,label:definitionItem.label,note:definitionItem.note,status:direct.length?'tasted':possible.length?'possible':'pending',
    tastedWineIds:matched.map(wine=>wine.id),tastedVintages:vintages,
    ...(resolvedProducerId?{resolvedProducerId}:{}),...(resolvedCuveeId?{resolvedCuveeId}:{})
  };
}

export function buildAchievementProgress(definition:AchievementDefinition,registry:AchievementIdentityRegistry,wines:AchievementWine[]):AchievementProgress{
  const indexes=buildIndexes(registry),items=definition.items.map(item=>progressItem(item,registry,indexes,wines));
  const completed=items.filter(item=>item.status==='tasted').length,possible=items.filter(item=>item.status==='possible').length,total=items.length,pending=total-completed-possible;
  return {definition,completed,possible,pending,total,percent:total?Math.round(completed/total*100):0,complete:total>0&&completed===total,items};
}

export function buildAllAchievementProgress(definitions:AchievementDefinition[],registry:AchievementIdentityRegistry,wines:AchievementWine[]){
  return definitions.map(definition=>buildAchievementProgress(definition,registry,wines));
}

export function achievementRegistryFromEntities(producers:AchievementProducerIdentity[],cuvees:AchievementCuveeIdentity[]):AchievementIdentityRegistry{return {producers,cuvees}}
