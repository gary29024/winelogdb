import { normalizeCuveeAlias } from '../../lib/cuvees/entities';
import { normalizeProducerAlias } from '../../lib/producers/entities';

export type CheckableWine={
  producer?:string|null;wineName?:string|null;vintage?:number|null;
  country?:string|null;region?:string|null;appellation?:string|null;
  wineStyle?:string|null;alcoholPercentage?:number|null;
};
export type LabelReading={
  producer?:string|null;wineName?:string|null;vintage?:number|null;
  country?:string|null;region?:string|null;appellation?:string|null;
  style?:string|null;alcoholPercentage?:number|null;
};
export type CheckField=keyof CheckableWine;
export type LabelDifference={field:CheckField;label:string;held:string;read:string;value:string|number|null};

const FIELDS:Array<{field:CheckField;label:string;from:(reading:LabelReading)=>unknown}>=[
  {field:'producer',label:'Producer',from:reading=>reading.producer},
  {field:'wineName',label:'Wine name',from:reading=>reading.wineName},
  {field:'vintage',label:'Vintage',from:reading=>reading.vintage},
  {field:'country',label:'Country',from:reading=>reading.country},
  {field:'region',label:'Region',from:reading=>reading.region},
  {field:'appellation',label:'Appellation',from:reading=>reading.appellation},
  {field:'wineStyle',label:'Style',from:reading=>reading.style},
  {field:'alcoholPercentage',label:'Alcohol',from:reading=>reading.alcoholPercentage}
];

const shown=(value:unknown)=>value==null||value===''?'—':String(value);

/**
 * Whether two readings of a field mean the same thing.
 *
 * A name is compared the way the identity system compares names, so "Château
 * Léoville-Barton" and "Chateau Leoville Barton" are not offered as a
 * correction; everything else is compared as trimmed, case-folded text, and a
 * number as a number. Alcohol is allowed a tenth either way, because a label
 * that reads 13.5 and a form that says 13.5 must not differ on a float.
 */
function same(field:CheckField,held:unknown,read:unknown){
  if(held==null||held==='')return read==null||read==='';
  if(read==null||read==='')return false;
  if(field==='producer')return normalizeProducerAlias(String(held))===normalizeProducerAlias(String(read));
  if(field==='wineName'||field==='appellation'||field==='region'||field==='country')
    return normalizeCuveeAlias(String(held))===normalizeCuveeAlias(String(read));
  if(field==='alcoholPercentage')return Math.abs(Number(held)-Number(read))<0.05;
  if(field==='vintage')return Number(held)===Number(read);
  return String(held).trim().toLowerCase()===String(read).trim().toLowerCase();
}

/**
 * What the label says that the entry does not.
 *
 * A cellar line was typed months ago from an invoice; the bottle in your hand
 * is the authority. But it is only ever offered, never applied: a reading is a
 * reading, and a wine about to enter the producer page, the Passport and
 * Insights should not be corrected by something nobody looked at.
 *
 * A field the label cannot see is not a difference. Recognition returns null
 * for what it could not read, and treating that as "the label says empty" would
 * invite someone to delete a good value with one tap.
 */
export function compareToLabel(held:CheckableWine,reading:LabelReading):LabelDifference[]{
  const differences:LabelDifference[]=[];
  for(const {field,label,from} of FIELDS){
    const read=from(reading);
    if(read==null||read==='')continue;
    const current=held[field];
    if(same(field,current,read))continue;
    differences.push({field,label,held:shown(current),read:shown(read),
      value:typeof read==='number'?read:String(read)});
  }
  return differences;
}

/** The entry with the differences the reader accepted folded in. */
export function applyLabelDifferences<T extends CheckableWine>(held:T,differences:readonly LabelDifference[],accepted:ReadonlySet<CheckField>):T{
  const next={...held};
  for(const difference of differences){
    if(!accepted.has(difference.field))continue;
    (next as Record<string,unknown>)[difference.field]=difference.value;
  }
  return next;
}
