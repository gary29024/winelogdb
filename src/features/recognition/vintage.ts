const RELEASE_OR_NON_VINTAGE=/^(?:n[.\s/-]?v\.?|non[-\s]?vintage|multi[-\s]?vintage|sans[-\s]?ann(?:ee|e)|unknown|unreadable|not\s+(?:visible|readable)|n\/?a|null|none|mv\s*\d{2,4}|(?:8\d|9\d)\s*[-–—/]\s*\d{2}|\d{1,4}(?:e|eme|th|st|nd|rd)?\s+(?:edition|édition)|(?:edition|édition)\s+(?:no\.?\s*)?\d{1,4})$/i;

export function normalizeRecognitionVintage(value:unknown){
  if(value==null||typeof value==='number')return value;
  if(typeof value!=='string')return value;
  const trimmed=value.trim();
  if(!trimmed)return null;
  if(/^\d{4}$/.test(trimmed))return Number(trimmed);
  const normalized=trimmed.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(RELEASE_OR_NON_VINTAGE.test(normalized))return null;
  return value;
}
