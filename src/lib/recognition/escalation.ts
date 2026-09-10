import type { GroupRecognitionResult } from '../../features/recognition/groupSchema';
import type { RecognitionResult } from '../../features/recognition/schema';

export const RECOGNITION_ESCALATION_MODEL='gemini-3.8-flash';
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
  if(preservesIdentity(primary,escalated)&&(escalated.confidence>primary.confidence||!hasIdentity(primary)||(primary.vintage==null&&escalated.vintage!=null)))return escalated;
  return primary;
}

type Identity=Pick<RecognitionResult,'producer'|'wineName'|'vintage'|'confidence'>;
const normalized=(value:string|null|undefined)=>(value??'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const sameNames=(a:Identity,b:Identity)=>normalized(a.producer)===normalized(b.producer)&&normalized(a.wineName)===normalized(b.wineName);

function preservesIdentity(primary:Identity,candidate:Identity){
  if(!hasIdentity(candidate)||candidate.confidence<primary.confidence)return false;
  // Confidence is a selection heuristic, not proof that a conflicting label is correct.
  if(primary.vintage!=null&&candidate.vintage!==primary.vintage)return false;
  if(primary.confidence>=RECOGNITION_ESCALATION_CONFIDENCE){
    if(primary.producer?.trim()&&normalized(primary.producer)!==normalized(candidate.producer))return false;
    if(primary.wineName?.trim()&&normalized(primary.wineName)!==normalized(candidate.wineName))return false;
  }
  return true;
}

/** Whole-result selection: never merge two model lists into duplicate phantom bottles. */
function preservesWines<T extends Identity>(primary:T[],candidate:T[],extra:(a:T,b:T)=>boolean=()=>true){
  const available=new Set(candidate.map((_,index)=>index));
  return primary.every(wine=>{
    const index=candidate.findIndex((other,index)=>available.has(index)&&sameNames(wine,other)&&preservesIdentity(wine,other)&&extra(wine,other));
    if(index<0)return false;
    available.delete(index);return true;
  });
}

export function preferEscalatedGroup(primary:GroupRecognitionResult,candidate:GroupRecognitionResult){
  if(candidate.wines.length<primary.wines.length||candidate.unresolvedCount>primary.unresolvedCount)return primary;
  return preservesWines(primary.wines,candidate.wines)?candidate:primary;
}

export function preferEscalatedSheet(primary:import('../../features/recognition/sheetSchema').SheetPage,candidate:import('../../features/recognition/sheetSchema').SheetPage){
  if(candidate.wines.length<primary.wines.length||candidate.unresolvedCount>primary.unresolvedCount||(!primary.truncated&&candidate.truncated))return primary;
  if(primary.currency&&normalized(primary.currency)!==normalized(candidate.currency))return primary;
  if((candidate.lastLineNumber??0)<(primary.lastLineNumber??0))return primary;
  return preservesWines(primary.wines,candidate.wines,(a,b)=>
    (a.lineNumber==null||a.lineNumber===b.lineNumber)&&
    a.priceOptions.every(price=>b.priceOptions.some(other=>price.amount===other.amount&&normalized(price.label)===normalized(other.label)))
  )?candidate:primary;
}
