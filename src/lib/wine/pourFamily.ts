/**
 * Which tint the fallback tile takes for a wine with no photo yet. Recognition
 * writes one of eight style values, but a wine edited by hand or imported can
 * carry anything the label said, so this reads the words rather than matching
 * an enum - and every unknown lands on the neutral tile rather than a wrong
 * colour.
 */
export type PourFamily='red'|'white'|'rose'|'sparkling'|'orange'|'sweet'|'unknown';

export function pourFamily(style:string|null|undefined):PourFamily{
  const value=(style??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
  if(!value.trim())return 'unknown';
  // Sparkling first: a "sparkling rose" is shelved with the sparklings, and
  // "blanc de blancs" would otherwise read as a still white.
  if(/sparkling|champagne|cremant|cava|prosecco|espumante|sekt|petillant|franciacorta/.test(value))return 'sparkling';
  if(/rose|rosado|rosato|blush/.test(value))return 'rose';
  if(/orange|skin.?contact|amber/.test(value))return 'orange';
  if(/dessert|sweet|fortified|port|sherry|madeira|sauternes|tokaji|vin santo|ice ?wine/.test(value))return 'sweet';
  if(/white|blanc|bianco|blanco|weiss/.test(value))return 'white';
  if(/red|rouge|rosso|tinto|rot/.test(value))return 'red';
  return 'unknown';
}
