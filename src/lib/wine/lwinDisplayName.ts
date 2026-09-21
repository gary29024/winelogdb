import { normalizeReferenceText } from './referenceCatalog';

/** Presentation only: preserve raw WINE and matching keys in the catalogue. */
export type LwinNameSource={displayName?:string|null;wineName?:string|null;country?:string|null;region?:string|null;subRegion?:string|null};
export function lwinDisplayWineName(reference:LwinNameSource){
 const display=reference.displayName?.trim(),comma=display?.indexOf(',')??-1;
 if(display&&comma>0){
  const parts=display.slice(comma+1).split(',').map(part=>part.trim()).filter(Boolean),raw=reference.wineName?.trim();
  const geography=new Set([reference.country,reference.region,reference.subRegion].map(normalizeReferenceText).filter(Boolean));
  // Remove only whole trailing catalogue location fields, never vineyard or
  // appellation words embedded in a distinctive wine name.
  while(parts.length&&geography.has(normalizeReferenceText(parts.at(-1)))&&normalizeReferenceText(parts.at(-1))!==normalizeReferenceText(raw))parts.pop();
  const wine=parts.join(', ');
  // Some estate wines put their wine name before the comma and only the
  // appellation after it. Do not discard that distinctive structured name.
  if(wine)return raw&&!normalizeReferenceText(wine).includes(normalizeReferenceText(raw))?`${raw}, ${wine}`:wine;
 }
 return reference.wineName?.trim()||null;
}

/** A matched catalogue name contained in a fuller logged name is not a correction. */
export function wineNameNeedsReview(current:string,suggested:string){
 if(sameWineDisplayName(current,suggested))return false;
 const tokens=(value:string)=>normalizeReferenceText(value).replace(/\b1er cru\b/g,'premier cru').split(' ').filter(Boolean);
 const actual=new Set(tokens(current)),expected=tokens(suggested);
 return !expected.length||!expected.every(token=>actual.has(token));
}

export function sameWineDisplayName(a:string,b:string){
 const key=(value:string)=>normalizeReferenceText(value).replace(/\b1er cru\b/g,'premier cru');
 return key(a)===key(b);
}
