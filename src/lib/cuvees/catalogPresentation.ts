import { cuveeIdentitySignature,cuveeStyleFamily,normalizeCuveeAlias,stripKnownProducerPrefix } from './entities';

export type CatalogPresentationLike={
  name:string;
  category?:string|null;
  appellation?:string|null;
  classification?:string|null;
  style?:string|null;
  notes?:string|null;
};

export const CATALOG_HIERARCHY_LABELS=['Grand Cru','Premier Cru / 1er Cru','Village / appellation','Regional','Other / unclassified'] as const;
export type CatalogHierarchyLabel=(typeof CATALOG_HIERARCHY_LABELS)[number];
export type CatalogIdentityRowLike={id:string;canonicalName:string;appellation:string|null;wineStyle:string|null};
export type CatalogPresentationChoice={
  key:string;
  id:string|null;
  canonicalName:string;
  appellation:string|null;
  wineStyle:string|null;
  classification:string|null;
  hierarchy:CatalogHierarchyLabel;
  issue:string|null;
};

function normalizedText(wine:CatalogPresentationLike){
  return normalizeCuveeAlias([wine.classification,wine.appellation,wine.name].filter(Boolean).join(' '));
}

export function catalogHierarchyRank(wine:CatalogPresentationLike){
  const text=normalizedText(wine),words=new Set(text.split(/\s+/).filter(Boolean));
  if(words.has('grand')&&words.has('cru'))return 0;
  if(words.has('premier')&&words.has('cru'))return 1;
  if(words.has('village')||words.has('communal'))return 2;
  if(words.has('regional')||text.includes('bourgogne')||text.includes('coteaux bourguignons')||text.includes('vin de france')||words.has('igp'))return 3;
  if(String(wine.appellation??'').trim()||String(wine.classification??'').trim())return 2;
  return 4;
}

export function catalogHierarchyLabel(wine:CatalogPresentationLike):CatalogHierarchyLabel{
  return CATALOG_HIERARCHY_LABELS[catalogHierarchyRank(wine)];
}

export function catalogPresentationKey(wine:CatalogPresentationLike,producerNames:string[]=[]){
  const key=cuveeIdentitySignature(wine.name,wine.appellation,wine.category??wine.style,producerNames);
  return key||normalizeCuveeAlias([wine.name,wine.appellation,wine.category??wine.style].filter(Boolean).join(' '));
}

export function compareCatalogPresentation(a:CatalogPresentationLike,b:CatalogPresentationLike,producerNames:string[]=[]){
  const hierarchy=catalogHierarchyRank(a)-catalogHierarchyRank(b);if(hierarchy)return hierarchy;
  const aName=stripKnownProducerPrefix(a.name,producerNames),bName=stripKnownProducerPrefix(b.name,producerNames);
  const byName=aName.localeCompare(bName,undefined,{sensitivity:'base',numeric:true});if(byName)return byName;
  const byApp=String(a.appellation??'').localeCompare(String(b.appellation??''),undefined,{sensitivity:'base',numeric:true});if(byApp)return byApp;
  return String(a.category??a.style??'').localeCompare(String(b.category??b.style??''),undefined,{sensitivity:'base',numeric:true});
}

export function canonicalCatalogEntries<T extends CatalogPresentationLike>(catalog:T[],producerNames:string[]=[]){
  const byKey=new Map<string,T>();
  for(const item of catalog){
    if(!item||!String(item.name??'').trim())continue;
    const key=catalogPresentationKey(item,producerNames);if(!key)continue;
    const existing=byKey.get(key);
    if(!existing){byKey.set(key,item);continue}
    // Refresh results are stored before retained historical entries. Preserve the newer
    // wording while filling any metadata that only existed on the older duplicate.
    byKey.set(key,{...existing,
      category:existing.category??item.category,
      appellation:existing.appellation??item.appellation,
      classification:existing.classification??item.classification,
      style:existing.style??item.style,
      notes:existing.notes??item.notes
    } as T);
  }
  return [...byKey.values()].sort((a,b)=>compareCatalogPresentation(a,b,producerNames));
}

function compatibleCatalogRow(item:CatalogPresentationLike,row:CatalogIdentityRowLike,producerNames:string[]){
  const itemName=normalizeCuveeAlias(stripKnownProducerPrefix(item.name,producerNames)),rowName=normalizeCuveeAlias(stripKnownProducerPrefix(row.canonicalName,producerNames));
  if(!itemName||itemName!==rowName)return false;
  const itemStyle=cuveeStyleFamily(item.category??item.style),rowStyle=cuveeStyleFamily(row.wineStyle);
  if(itemStyle&&rowStyle&&itemStyle!==rowStyle)return false;
  const itemApp=normalizeCuveeAlias(item.appellation??''),rowApp=normalizeCuveeAlias(row.appellation??'');
  return !itemApp||!rowApp||itemApp===rowApp;
}

export function catalogChoicesForPresentation<T extends CatalogPresentationLike>(catalog:T[],producerNames:string[],rows:CatalogIdentityRowLike[]):CatalogPresentationChoice[]{
  const canonical=canonicalCatalogEntries(catalog,producerNames),used=new Set<string>();
  return canonical.map(item=>{
    const key=catalogPresentationKey(item,producerNames),available=rows.filter(row=>!used.has(row.id));
    let row=available.find(candidate=>catalogPresentationKey({name:candidate.canonicalName,appellation:candidate.appellation,style:candidate.wineStyle},producerNames)===key);
    if(!row){const compatible=available.filter(candidate=>compatibleCatalogRow(item,candidate,producerNames));if(compatible.length===1)row=compatible[0]}
    if(row)used.add(row.id);
    return {
      key,
      id:row?.id??null,
      canonicalName:row?.canonicalName??stripKnownProducerPrefix(item.name,producerNames),
      appellation:(item.appellation??row?.appellation??null)||null,
      wineStyle:(item.category??item.style??row?.wineStyle??null)||null,
      classification:item.classification??null,
      hierarchy:catalogHierarchyLabel(item),
      issue:row?null:'Catalog identity needs repair'
    };
  });
}
