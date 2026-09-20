import type { LwinTaxonomy } from '../wine/lwinMetadata';
import { cuveeIdentitySignature,cuveeStyleFamily,normalizeCuveeAlias } from './entities';
import { stripProducerCatalogPrefix } from '../producers/catalogName';

export type CatalogPresentationLike={
  lwinReference?:LwinTaxonomy;
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
  hierarchy:string;
  issue:string|null;
};

function normalizedText(wine:CatalogPresentationLike){
  return normalizeCuveeAlias([wine.classification,wine.appellation,wine.name].filter(Boolean).join(' '));
}

export function catalogHierarchyRank(wine:CatalogPresentationLike){
  const reference=wine.lwinReference;
  if(reference){
    if(normalizeCuveeAlias(reference.region??'')==='burgundy'){
      const tier=normalizeCuveeAlias(reference.classification??'');
      if(tier==='grand cru')return 0;if(tier==='premier cru')return 1;
      if(normalizeCuveeAlias(reference.subRegion??'')==='bourgogne')return 3;
      return reference.subRegion?2:4;
    }
    // DOCG, Erste Lage and Bordeaux classes are not Burgundy cru tiers.
    return 4;
  }
  const text=normalizedText(wine),words=new Set(text.split(/\s+/).filter(Boolean));
  if(words.has('grand')&&words.has('cru'))return 0;
  if(words.has('premier')&&words.has('cru'))return 1;
  if(words.has('village')||words.has('communal'))return 2;
  // IGT sits beside IGP: both are the regional tier, and omitting IGT dropped
  // every Italian one into "Other / unclassified".
  if(words.has('regional')||text.includes('bourgogne')||text.includes('coteaux bourguignons')||text.includes('vin de france')||words.has('igp')||words.has('igt'))return 3;
  if(String(wine.appellation??'').trim()||String(wine.classification??'').trim())return 2;
  return 4;
}

export function catalogHierarchyLabel(wine:CatalogPresentationLike):string{
  if(wine.lwinReference&&normalizeCuveeAlias(wine.lwinReference.region??'')!=='burgundy')return wine.lwinReference.classification||wine.lwinReference.designation||'Other / unclassified';
  return CATALOG_HIERARCHY_LABELS[catalogHierarchyRank(wine)];
}

/** Cru wording that qualifies a village rather than naming a different one. */
const CRU_SUFFIX=/[\s,]+(grand\s+cru|premier\s+cru|1\s*er\s+cru|1°\s+cru|village|communal)\s*$/i;

/**
 * The village an entry sits in, for grouping a range by place.
 *
 * "Gevrey-Chambertin Premier Cru" and plain "Gevrey-Chambertin" are the same
 * village seen at two tiers, so the cru wording comes off and both land in one
 * group. It comes off repeatedly because catalogue wording doubles up -
 * "Chablis Premier Cru Village" is a real string.
 *
 * A grand cru is deliberately left standing as its own group. Clos de la Roche
 * IS an appellation in its own right, and the reference data does not say which
 * commune a grand cru sits in - the same gap that stops anyone saying a wine
 * comes from the Pernand side of Corton. Inventing the parent here would be
 * guessing, and it would be wrong at exactly the boundaries people care about.
 */
export function catalogVillageLabel(wine:CatalogPresentationLike):string{
  if(wine.lwinReference?.subRegion)return wine.lwinReference.subRegion;
  let text=String(wine.appellation??'').trim();
  for(let guard=0;guard<4;guard+=1){
    const next=text.replace(CRU_SUFFIX,'').trim();
    if(next===text||!next)break;
    text=next;
  }
  return text||'Appellation not stated';
}

export function catalogPresentationKey(wine:CatalogPresentationLike,producerNames:string[]=[]){
  const cleanName=stripProducerCatalogPrefix(wine.name,producerNames);
  const key=cuveeIdentitySignature(cleanName,wine.appellation,wine.category??wine.style);
  return key||normalizeCuveeAlias([cleanName,wine.appellation,wine.category??wine.style].filter(Boolean).join(' '));
}

export function compareCatalogPresentation(a:CatalogPresentationLike,b:CatalogPresentationLike,producerNames:string[]=[]){
  const hierarchy=catalogHierarchyRank(a)-catalogHierarchyRank(b);if(hierarchy)return hierarchy;
  const aName=stripProducerCatalogPrefix(a.name,producerNames),bName=stripProducerCatalogPrefix(b.name,producerNames);
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
  const itemName=normalizeCuveeAlias(stripProducerCatalogPrefix(item.name,producerNames)),rowName=normalizeCuveeAlias(stripProducerCatalogPrefix(row.canonicalName,producerNames));
  if(!itemName||itemName!==rowName)return false;
  const itemStyle=cuveeStyleFamily(item.category??item.style),rowStyle=cuveeStyleFamily(row.wineStyle);
  if(itemStyle&&rowStyle&&itemStyle!==rowStyle)return false;
  const itemApp=normalizeCuveeAlias(item.appellation??''),rowApp=normalizeCuveeAlias(row.appellation??'');
  return !itemApp||!rowApp||itemApp===rowApp;
}

export function catalogIdentityForPresentation(item:CatalogPresentationLike,producerNames:string[],rows:CatalogIdentityRowLike[]){
  const key=catalogPresentationKey(item,producerNames);
  const exact=rows.filter(candidate=>catalogPresentationKey({name:candidate.canonicalName,appellation:candidate.appellation,style:candidate.wineStyle},producerNames)===key);
  if(exact.length===1)return exact[0];
  const compatible=rows.filter(candidate=>compatibleCatalogRow(item,candidate,producerNames));
  return compatible.length===1?compatible[0]:null;
}

export function catalogChoicesForPresentation<T extends CatalogPresentationLike>(catalog:T[],producerNames:string[],rows:CatalogIdentityRowLike[]):CatalogPresentationChoice[]{
  const canonical=canonicalCatalogEntries(catalog,producerNames),used=new Set<string>();
  return canonical.map(item=>{
    const key=catalogPresentationKey(item,producerNames),available=rows.filter(row=>!used.has(row.id)),row=catalogIdentityForPresentation(item,producerNames,available);
    if(row)used.add(row.id);
    return {
      key,
      id:row?.id??null,
      canonicalName:stripProducerCatalogPrefix(item.name,producerNames),
      appellation:(item.appellation??row?.appellation??null)||null,
      wineStyle:(item.category??item.style??row?.wineStyle??null)||null,
      classification:item.classification??null,
      hierarchy:catalogHierarchyLabel(item),
      issue:row?null:'Catalog identity needs repair'
    };
  });
}

export function catalogRowsForPresentation<T extends CatalogIdentityRowLike>(catalog:CatalogPresentationLike[],producerNames:string[],rows:T[]):T[]{
  const choices=catalogChoicesForPresentation(catalog,producerNames,rows),presentationById=new Map(choices.flatMap(choice=>choice.id?[[choice.id,choice.canonicalName] as const]:[]));
  return rows.map(row=>{const canonicalName=presentationById.get(row.id);return canonicalName&&canonicalName!==row.canonicalName?{...row,canonicalName}:row});
}
