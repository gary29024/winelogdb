import { hasLikelyEmbeddedJsonFragment } from './structuredJson';

export type CatalogNote={short:string;full:string};

/** A style string long enough to be prose rather than a label ("Still dry white"). */
export function verboseCatalogStyle(value:unknown){
  const text=String(value??'').trim();
  return text.length>36||text.split(/\s+/).length>5||/[.;]/.test(text);
}

/**
 * The line under a catalogue row: the researched note, or the style when the
 * model wrote a sentence instead of a label.
 *
 * Rows researched before the parser learned a corruption signature still carry
 * it - "Still dry white唱.notes" was reported from the catalogue - and there is
 * no re-running research for every producer to clear them. A note the parser
 * would refuse to store today is not shown today either.
 */
export function catalogNote(notes:unknown,style:unknown):CatalogNote{
  const explicit=String(notes??'').trim(),styleText=String(style??'').trim();
  const full=explicit||(styleText&&verboseCatalogStyle(styleText)?styleText:'');
  if(!full||hasLikelyEmbeddedJsonFragment(full))return {short:'',full:''};
  if(full.length<=180)return {short:full,full};
  const clipped=full.slice(0,177).replace(/\s+\S*$/,'').trim();
  return {short:`${clipped||full.slice(0,177)}…`,full};
}
