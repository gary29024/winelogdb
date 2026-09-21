import { normalizeReferenceText } from './referenceCatalog';

/** Presentation only: preserve raw WINE and matching keys in the catalogue. */
export function lwinDisplayWineName(reference:{displayName?:string|null;wineName?:string|null}){
 const display=reference.displayName?.trim(),comma=display?.indexOf(',')??-1;
 if(display&&comma>0){
  const wine=display.slice(comma+1).trim(),raw=reference.wineName?.trim();
  // Some estate wines put their wine name before the comma and only the
  // appellation after it. Do not discard that distinctive structured name.
  if(wine)return raw&&!normalizeReferenceText(wine).includes(normalizeReferenceText(raw))?`${raw}, ${wine}`:wine;
 }
 return reference.wineName?.trim()||null;
}

export function sameWineDisplayName(a:string,b:string){
 const key=(value:string)=>normalizeReferenceText(value).replace(/\b1er cru\b/g,'premier cru');
 return key(a)===key(b);
}
