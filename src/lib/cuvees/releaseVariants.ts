import { cuveeStyleFamily,normalizeCuveeAlias,stripKnownProducerPrefix } from './entities';

export type CuveeReleaseVariant={
  kind:'edition';
  parentName:string;
  designation:string;
  sequence:number;
};

export type ReleaseCatalogRow={
  id:string;
  canonicalName:string;
  appellation:string|null;
  wineStyle:string|null;
};

export type ReleaseCatalogMatch={
  catalogCuveeId:string;
  catalogName:string;
  variant:CuveeReleaseVariant;
};

const EDITION_SUFFIX=/^(.+?)\s+((\d{1,4})(?:er|e|eme|ème|th|st|nd|rd)?\s+(?:edition|édition))\s*$/i;
const EDITION_PREFIX=/^(.+?)\s+((?:edition|édition)\s+(?:no\.?\s*)?(\d{1,4}))\s*$/i;

export function parseCuveeReleaseVariant(value:string,producerNames:string[]=[]):CuveeReleaseVariant|null{
  const clean=stripKnownProducerPrefix(value,producerNames).trim();
  const match=clean.match(EDITION_SUFFIX)??clean.match(EDITION_PREFIX);
  if(!match)return null;
  const parentName=String(match[1]??'').trim(),designation=String(match[2]??'').trim(),sequence=Number(match[3]);
  if(!parentName||!designation||!Number.isInteger(sequence)||sequence<1)return null;
  return {kind:'edition',parentName,designation,sequence};
}

function compatibleAppellation(a:string|null|undefined,b:string|null|undefined){
  const left=normalizeCuveeAlias(a??''),right=normalizeCuveeAlias(b??'');
  return !left||!right||left===right;
}

function compatibleStyle(a:string|null|undefined,b:string|null|undefined){
  const left=cuveeStyleFamily(a),right=cuveeStyleFamily(b);
  return !left||!right||left===right;
}

export function matchCuveeReleaseVariantToCatalog(
  source:{name:string;appellation?:string|null;wineStyle?:string|null},
  catalogRows:ReleaseCatalogRow[],
  producerNames:string[]=[]
):ReleaseCatalogMatch|null{
  const variant=parseCuveeReleaseVariant(source.name,producerNames);if(!variant)return null;
  const parentKey=normalizeCuveeAlias(variant.parentName);if(!parentKey)return null;
  const candidates=catalogRows.filter(row=>
    normalizeCuveeAlias(stripKnownProducerPrefix(row.canonicalName,producerNames))===parentKey&&
    compatibleAppellation(source.appellation,row.appellation)&&compatibleStyle(source.wineStyle,row.wineStyle)
  );
  if(candidates.length!==1)return null;
  const row=candidates[0];return {catalogCuveeId:row.id,catalogName:row.canonicalName,variant};
}
