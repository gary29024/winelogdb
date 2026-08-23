import type { GroupRecognitionResult } from '../../features/recognition/groupSchema';
import type { RecognitionResult } from '../../features/recognition/schema';

export const RECOGNITION_ESCALATION_MODEL='gemini-3.7-flash';
export const RECOGNITION_ESCALATION_CONFIDENCE=0.85;

function hasIdentity(result:Pick<RecognitionResult,'producer'|'wineName'>){
  return Boolean(result.producer?.trim()&&result.wineName?.trim());
}

export function recognitionEscalationReasons(result:RecognitionResult,options:{schemaFallback?:boolean}={}){
  const reasons:string[]=[];
  if(!result.producer?.trim())reasons.push('missing-producer');
  if(!result.wineName?.trim())reasons.push('missing-wine-name');
  if(result.confidence<RECOGNITION_ESCALATION_CONFIDENCE)reasons.push('low-confidence');
  if(options.schemaFallback)reasons.push('schema-fallback');
  return reasons;
}

export function groupRecognitionEscalationReasons(result:GroupRecognitionResult){
  const reasons:string[]=[];
  if(result.unresolvedCount>0)reasons.push('unresolved-wines');
  if(result.wines.some(wine=>wine.confidence<RECOGNITION_ESCALATION_CONFIDENCE))reasons.push('low-confidence');
  return reasons;
}

export function preferEscalatedRecognition(primary:RecognitionResult,escalated:RecognitionResult){
  if(hasIdentity(escalated))return escalated;
  return primary;
}
