// Detects precise technical figures (blend percentages, ageing times, dosage,
// disgorgement dates...) in one research sentence. A precise figure without a
// direct citation is more misleading than unsourced prose, so it is labelled
// for the reader and lowers the confidence score. No imports: the quality gate
// and the browser both use it.
export type HighRiskTechnicalReason='percentage'|'duration'|'dosage_or_concentration'|'disgorgement_or_bottling_date'|'temperature'|'vessel_size'|'yield_or_density';
const MONTH='(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const PERCENTAGE=/\b\d+(?:\.\d+)?\s*(?:%|percent\b|per\s+cent\b)/i;
const TECHNICAL_DURATION=/\b(?:aged|ageing|aging|matured|maturation|elevage|élevage|macerat(?:ed|ion)|ferment(?:ed|ation)|lees?|barrel|oak|tank|bottle|rest(?:ed|ing))\b[^.!?]{0,90}\b\d+(?:\.\d+)?\s*(?:months?|days?|weeks?|years?)\b|\b\d+(?:\.\d+)?\s*(?:months?|days?|weeks?|years?)\b[^.!?]{0,90}\b(?:aged|ageing|aging|matured|maturation|elevage|élevage|macerat(?:ed|ion)|ferment(?:ed|ation)|lees?|barrel|oak|tank|bottle|rest(?:ed|ing))\b/i;
const DOSAGE_OR_CONCENTRATION=/\b\d+(?:\.\d+)?\s*(?:g\s*\/?\s*l|mg\s*\/?\s*l|grams?\s+per\s+lit(?:re|er)|milligrams?\s+per\s+lit(?:re|er)|brix|°\s*brix)\b/i;
const EVENT_DATE=new RegExp(`\\b(?:disgorg(?:ed|ement)?|bottl(?:ed|ing)|tirage|harvest(?:ed|ing)?)\\b[^.!?]{0,70}(?:\\b(?:19|20)\\d{2}\\b|\\b${MONTH}\\b|\\b\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{2,4}\\b)`,'i');
const TEMPERATURE=/\b\d+(?:\.\d+)?\s*(?:°\s*c|°c|degrees?\s+c(?:elsius)?)\b/i;
const VESSEL='(?:barrels?|casks?|tanks?|amphorae?|foudres?|demi[- ]?muids?|vats?)';
const VESSEL_SIZE=new RegExp(`\\b\\d+(?:\\.\\d+)?\\s*(?:l|litres?|liters?)\\b[^.!?]{0,55}\\b${VESSEL}\\b|\\b${VESSEL}\\b[^.!?]{0,55}\\b\\d+(?:\\.\\d+)?\\s*(?:l|litres?|liters?)\\b`,'i');
const YIELD_OR_DENSITY=/\b\d+(?:\.\d+)?\s*(?:hl\s*\/?\s*ha|kg\s*\/?\s*ha|ton(?:ne)?s?\s*\/?\s*ha|vines?\s*\/?\s*ha|vines?\s+per\s+hectare)\b/i;

export function highRiskTechnicalReasons(claim:string):HighRiskTechnicalReason[]{
  const reasons:HighRiskTechnicalReason[]=[];
  if(PERCENTAGE.test(claim))reasons.push('percentage');
  if(TECHNICAL_DURATION.test(claim))reasons.push('duration');
  if(DOSAGE_OR_CONCENTRATION.test(claim))reasons.push('dosage_or_concentration');
  if(EVENT_DATE.test(claim))reasons.push('disgorgement_or_bottling_date');
  if(TEMPERATURE.test(claim))reasons.push('temperature');
  if(VESSEL_SIZE.test(claim))reasons.push('vessel_size');
  if(YIELD_OR_DENSITY.test(claim))reasons.push('yield_or_density');
  return [...new Set(reasons)];
}

/** A sentence carrying a precise figure that no cited source directly backs. */
export function isUnverifiedPreciseFigure(item:{claim:string;supportStatus:string}){
  return (item.supportStatus==='partial'||item.supportStatus==='unsupported')&&highRiskTechnicalReasons(item.claim).length>0;
}
