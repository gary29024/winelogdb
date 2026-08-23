import type { DeepSearchProvenance } from '../db/schema';
import { explicitResearchStatus,type DeepResearchField } from './qualityGate';
import { splitResearchClaims,type ClaimSupportStatus } from './provenance';

export type HighRiskTechnicalReason='percentage'|'duration'|'dosage_or_concentration'|'disgorgement_or_bottling_date'|'temperature'|'vessel_size'|'yield_or_density';
export type HighRiskTechnicalViolation={field:DeepResearchField;claim:string;reasons:HighRiskTechnicalReason[];supportStatus:ClaimSupportStatus|'missing'};

const STRICT_FIELDS=new Set<DeepResearchField>(['summary','winemakingTechniques']);
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

export function highRiskTechnicalViolations(payload:Record<string,string>,provenance?:DeepSearchProvenance){
  const violations:HighRiskTechnicalViolation[]=[];
  for(const field of STRICT_FIELDS){
    const value=payload[field]?.trim();if(!value)continue;
    const provenanceClaims=new Map((provenance?.fields[field]?.claims??[]).map(item=>[item.claim.trim(),item] as const));
    for(const claim of splitResearchClaims(value)){
      const reasons=highRiskTechnicalReasons(claim);if(!reasons.length||explicitResearchStatus(claim))continue;
      const evidence=provenanceClaims.get(claim.trim()),status=evidence?.supportStatus??'missing';
      if(status==='supported'||status==='uncertainty')continue;
      violations.push({field,claim,reasons,supportStatus:status});
    }
  }
  return violations;
}

export function highRiskTechnicalScopePasses(scope:string,payload:Record<string,string>,provenance?:DeepSearchProvenance){
  if(scope!=='wine_vintage')return true;
  return highRiskTechnicalViolations(payload,provenance).length===0;
}

export function highRiskTechnicalFailureMessage(payload:Record<string,string>,provenance?:DeepSearchProvenance){
  const violations=highRiskTechnicalViolations(payload,provenance);if(!violations.length)return null;
  const examples=violations.slice(0,3).map(item=>`${item.field}: ${item.claim} [${item.supportStatus}]`).join(' | ');
  return `Strict technical evidence gate rejected ${violations.length} precise claim${violations.length===1?'':'s'} without direct grounding support${examples?`: ${examples}`:''}`;
}
