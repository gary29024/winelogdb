import type { DeepSearchProvenance } from '../db/schema';
import { explicitResearchStatus,type DeepResearchField } from './qualityGate';
import { splitResearchClaims,type ClaimSupportStatus } from './provenance';
import { highRiskTechnicalReasons,type HighRiskTechnicalReason } from './preciseFigures';

export { highRiskTechnicalReasons,type HighRiskTechnicalReason };

// These checks no longer reject a scope. An uncited precise figure is saved,
// labelled on the claim evidence and counted against the confidence score
// (see qualityGate). The functions remain for retry feedback and diagnostics.

export type HighRiskTechnicalViolation={field:DeepResearchField;claim:string;reasons:HighRiskTechnicalReason[];supportStatus:ClaimSupportStatus|'missing'};

const STRICT_FIELDS=new Set<DeepResearchField>(['summary','winemakingTechniques']);

export function highRiskTechnicalViolations(payload:Record<string,string>,provenance?:DeepSearchProvenance){
  const violations:HighRiskTechnicalViolation[]=[];
  for(const field of STRICT_FIELDS){
    const value=payload[field]?.trim();if(!value)continue;
    const provenanceClaims=new Map((provenance?.fields[field]?.claims??[]).map(item=>[item.claim.trim(),item] as const));
    for(const claim of splitResearchClaims(value)){
      const reasons=highRiskTechnicalReasons(claim);if(!reasons.length||explicitResearchStatus(claim))continue;
      const evidence=provenanceClaims.get(claim.trim()),status=evidence?.supportStatus??'missing';
      if(status==='supported'||status==='conflicting'||status==='uncertainty')continue;
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
