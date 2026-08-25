import { cuveeSignature,cuveeStyleFamily,normalizeCuveeAlias,stripKnownProducerPrefix } from './entities';

export type CuveeReleaseKind='edition'|'multi_vintage'|'reserve_span';

export type CuveeReleaseVariant={
  kind:CuveeReleaseKind;
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

type ReleaseCatalogCandidate={
  row:ReleaseCatalogRow;
  variant:CuveeReleaseVariant|null;
  familyKey:string;
  displayName:string;
};

const EDITION_SUFFIX=/^(.+?)\s+((\d{1,4})(?:er|e|eme|ème|th|st|nd|rd)?\s+(?:edition|édition))\s*$/i;
const EDITION_PREFIX=/^(.+?)\s+((?:edition|édition)\s+(?:no\.?\s*)?(\d{1,4}))\s*$/i;
const MULTI_VINTAGE=/^(.*?)\s*(MV\s*(\d{2,4}))(?=\s|$)(?:\s+(?:brut(?:\s+(?:nature|zero))?|extra\s+brut|zero\s+dosage))?\s*$/i;
const RESERVE_SPAN=/^(.*?)\s*((8\d|9\d)\s*[-–—/]\s*(\d{2}))\s*$/i;

function compactDesignation(value:string){return value.replace(/\s+/g,' ').replace(/\s*([-–—/])\s*/g,'$1').trim()}

/**
 * The identity of a release family, insensitive to the order its words are
 * written in. A catalogue lists "Ratafia Champenois Solera" while the bottles
 * read "Solera Ratafia Champenois 90-16" and "… 90-19"; those are one wine and
 * two releases of it, and comparing the names as written kept them apart.
 *
 * This is the token-set identity the rest of the app already uses for a cuvee,
 * so a release family and a cuvee agree on what counts as the same wine.
 */
function releaseFamilyKey(value:string,producerNames:string[]){return cuveeSignature(value,null,producerNames)}

export function parseCuveeReleaseVariant(value:string,producerNames:string[]=[]):CuveeReleaseVariant|null{
  const clean=stripKnownProducerPrefix(value,producerNames).trim();
  const edition=clean.match(EDITION_SUFFIX)??clean.match(EDITION_PREFIX);
  if(edition){
    const parentName=String(edition[1]??'').trim(),designation=String(edition[2]??'').trim(),sequence=Number(edition[3]);
    if(parentName&&designation&&Number.isInteger(sequence)&&sequence>0)return {kind:'edition',parentName,designation,sequence};
  }
  const multiVintage=clean.match(MULTI_VINTAGE);
  if(multiVintage){
    const prefix=String(multiVintage[1]??'').trim(),designation=compactDesignation(String(multiVintage[2]??'')),sequence=Number(multiVintage[3]);
    if(designation&&Number.isInteger(sequence)&&sequence>0)return {kind:'multi_vintage',parentName:prefix?`${prefix} MV`:'MV',designation,sequence};
  }
  const reserveSpan=clean.match(RESERVE_SPAN);
  if(reserveSpan){
    const parentName=String(reserveSpan[1]??'').trim(),designation=compactDesignation(String(reserveSpan[2]??''));
    const start=Number(reserveSpan[3]),end=Number(reserveSpan[4]),sequence=start*100+end;
    if(designation&&Number.isInteger(sequence)&&sequence>0)return {kind:'reserve_span',parentName,designation,sequence};
  }
  return null;
}

function compatibleAppellation(a:string|null|undefined,b:string|null|undefined){
  const left=normalizeCuveeAlias(a??''),right=normalizeCuveeAlias(b??'');
  return !left||!right||left===right;
}

function compatibleStyle(a:string|null|undefined,b:string|null|undefined){
  const left=cuveeStyleFamily(a),right=cuveeStyleFamily(b);
  return !left||!right||left===right;
}

function candidateFor(row:ReleaseCatalogRow,producerNames:string[]):ReleaseCatalogCandidate{
  const displayName=stripKnownProducerPrefix(row.canonicalName,producerNames).trim();
  const variant=parseCuveeReleaseVariant(row.canonicalName,producerNames);
  return {row,variant,familyKey:releaseFamilyKey(variant?.parentName??displayName,producerNames),displayName};
}

function genericReleaseParent(variant:CuveeReleaseVariant){
  const key=releaseFamilyKey(variant.parentName,[]);
  return !key||(variant.kind==='multi_vintage'&&key==='mv');
}

function chooseFamilyAnchor(candidates:ReleaseCatalogCandidate[],kind:CuveeReleaseKind){
  const plain=candidates.filter(candidate=>!candidate.variant);
  if(plain.length===1)return plain[0];
  if(plain.length>1)return null;
  const releases=candidates.filter(candidate=>candidate.variant?.kind===kind)
    .sort((a,b)=>(b.variant?.sequence??-1)-(a.variant?.sequence??-1)||a.displayName.localeCompare(b.displayName,undefined,{sensitivity:'base',numeric:true}));
  if(!releases.length)return null;
  if(releases.length>1&&releases[0].variant?.sequence===releases[1].variant?.sequence)return null;
  return releases[0];
}

function familyDisplay(candidate:ReleaseCatalogCandidate){
  return candidate.variant?.parentName.trim()||candidate.displayName;
}

export function matchCuveeReleaseVariantToCatalog(
  source:{name:string;appellation?:string|null;wineStyle?:string|null},
  catalogRows:ReleaseCatalogRow[],
  producerNames:string[]=[]
):ReleaseCatalogMatch|null{
  const variant=parseCuveeReleaseVariant(source.name,producerNames);if(!variant)return null;
  const parentKey=releaseFamilyKey(variant.parentName,producerNames);
  const compatible=catalogRows.filter(row=>compatibleAppellation(source.appellation,row.appellation)&&compatibleStyle(source.wineStyle,row.wineStyle)).map(row=>candidateFor(row,producerNames));

  if(parentKey){
    const exactFamily=compatible.filter(candidate=>candidate.familyKey===parentKey&&(!candidate.variant||candidate.variant.kind===variant.kind));
    if(exactFamily.length){
      const anchor=chooseFamilyAnchor(exactFamily,variant.kind);if(!anchor)return null;
      return {catalogCuveeId:anchor.row.id,catalogName:familyDisplay(anchor),variant};
    }
  }

  if(!genericReleaseParent(variant))return null;
  const releaseCandidates=compatible.filter(candidate=>candidate.variant?.kind===variant.kind);
  const familyKeys=[...new Set(releaseCandidates.map(candidate=>candidate.familyKey))];
  if(familyKeys.length!==1)return null;
  const familyKey=familyKeys[0];
  const family=compatible.filter(candidate=>candidate.familyKey===familyKey&&(!candidate.variant||candidate.variant.kind===variant.kind));
  const anchor=chooseFamilyAnchor(family,variant.kind);if(!anchor)return null;
  return {catalogCuveeId:anchor.row.id,catalogName:familyDisplay(anchor),variant};
}
