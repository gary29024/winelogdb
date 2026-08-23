import type { GroundingMetadata } from './geminiBatch';
import { bestResearchSourceTier,explicitResearchStatus,type DeepResearchField,type ResearchSourceTier } from './qualityGate';

export type ClaimSupportStatus='supported'|'partial'|'unsupported'|'uncertainty';
export type ClaimSource={title:string;url:string};
export type ResearchClaimProvenance={claim:string;supportStatus:ClaimSupportStatus;sourceTier:ResearchSourceTier;sources:ClaimSource[]};
export type ResearchFieldProvenance={claimCount:number;supportedCount:number;partialCount:number;unsupportedCount:number;uncertaintyCount:number;directSupportRatio:number;claims:ResearchClaimProvenance[]};
export type DeepSearchProvenance={version:1;fields:Partial<Record<DeepResearchField,ResearchFieldProvenance>>};

export const deepResearchFields:DeepResearchField[]=['summary','vintageQuality','producerDetails','producerWinemakingPractices','winemakingTechniques','terroir','drinkingWindow'];

const STOP_WORDS=new Set(['the','and','that','this','with','from','into','for','was','were','are','its','their','his','her','has','have','had','but','not','wine','producer','domaine','estate','vintage','cuvee','cuvée']);
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’'`]/g,'').replace(/[^a-z0-9%]+/g,' ').trim();
const tokens=(value:string)=>new Set(normalize(value).split(/\s+/).filter(token=>token.length>1&&!STOP_WORDS.has(token)));
const roundRatio=(value:number)=>Math.round(value*100)/100;

function claimUnits(value:string){
  const out:string[]=[];
  for(const rawBlock of value.split(/\r?\n+/)){
    const block=rawBlock.trim().replace(/^[-•]\s+/,'');if(!block)continue;
    const sentences=block.split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/u).map(item=>item.trim()).filter(Boolean);
    for(const sentence of sentences){
      if(sentence.length<18&&out.length){out[out.length-1]=`${out[out.length-1]} ${sentence}`.trim();continue}
      if(!out.includes(sentence))out.push(sentence);
    }
  }
  return out.slice(0,60);
}

function safeSource(metadata:GroundingMetadata|undefined,index:number):ClaimSource|null{
  const web=metadata?.groundingChunks?.[index]?.web,url=web?.uri?.trim();if(!url)return null;
  try{const parsed=new URL(url);if(parsed.protocol!=='https:'&&parsed.protocol!=='http:')return null;return {title:web?.title?.trim()||parsed.hostname,url:parsed.toString()}}catch{return null}
}

function segmentSources(metadata:GroundingMetadata|undefined,indices:number[]|undefined){
  const seen=new Set<string>(),out:ClaimSource[]=[];
  for(const index of indices??[]){const source=safeSource(metadata,index);if(!source||seen.has(source.url))continue;seen.add(source.url);out.push(source);if(out.length>=5)break}
  return out;
}

function overlapScore(claim:string,segment:string){
  const a=normalize(claim),b=normalize(segment);if(!a||!b)return 0;if(b.includes(a))return 1;
  const claimTokens=tokens(claim),segmentTokens=tokens(segment);if(!claimTokens.size||!segmentTokens.size)return 0;
  let shared=0;for(const token of claimTokens)if(segmentTokens.has(token))shared++;
  if(shared<2&&claimTokens.size>2)return 0;
  const recall=shared/claimTokens.size;
  if(a.includes(b))return Math.max(recall,Math.min(1,segmentTokens.size/claimTokens.size));
  return recall;
}

function supports(metadata:GroundingMetadata|undefined){
  return (metadata?.groundingSupports??[]).map(item=>({text:item.segment?.text?.trim()||'',sources:segmentSources(metadata,item.groundingChunkIndices)})).filter(item=>item.text&&item.sources.length);
}

export function buildFieldProvenance(value:string,metadata?:GroundingMetadata):ResearchFieldProvenance{
  const grounded=supports(metadata),claims=claimUnits(value).map<ResearchClaimProvenance>(claim=>{
    if(explicitResearchStatus(claim))return {claim,supportStatus:'uncertainty',sourceTier:'none',sources:[]};
    let best=0;const matched:ClaimSource[]=[];const seen=new Set<string>();
    for(const support of grounded){const score=overlapScore(claim,support.text);if(score<.35)continue;best=Math.max(best,score);for(const source of support.sources){if(seen.has(source.url))continue;seen.add(source.url);matched.push(source)}}
    const direct=matched.slice(0,5),supportStatus:ClaimSupportStatus=best>=.72&&direct.length?'supported':best>=.35&&direct.length?'partial':'unsupported';
    return {claim,supportStatus,sourceTier:bestResearchSourceTier(direct),sources:direct};
  });
  const supportedCount=claims.filter(item=>item.supportStatus==='supported').length,partialCount=claims.filter(item=>item.supportStatus==='partial').length,unsupportedCount=claims.filter(item=>item.supportStatus==='unsupported').length,uncertaintyCount=claims.filter(item=>item.supportStatus==='uncertainty').length;
  const asserted=supportedCount+partialCount+unsupportedCount,directSupportRatio=asserted?roundRatio((supportedCount+partialCount*.5)/asserted):1;
  return {claimCount:claims.length,supportedCount,partialCount,unsupportedCount,uncertaintyCount,directSupportRatio,claims};
}

export function buildDeepSearchProvenance(payload:Partial<Record<DeepResearchField,string>>,metadata?:GroundingMetadata):DeepSearchProvenance{
  const fields:DeepSearchProvenance['fields']={};
  for(const field of deepResearchFields){const value=payload[field]?.trim();if(value)fields[field]=buildFieldProvenance(value,metadata)}
  return {version:1,fields};
}

export function provenanceForFields(provenance:DeepSearchProvenance|undefined,fields:readonly string[]):DeepSearchProvenance|undefined{
  if(!provenance)return undefined;const picked:DeepSearchProvenance['fields']={};
  for(const field of fields){const item=provenance.fields[field as DeepResearchField];if(item)picked[field as DeepResearchField]=item}
  return Object.keys(picked).length?{version:1,fields:picked}:undefined;
}

export function mergeDeepSearchProvenance(items:Array<DeepSearchProvenance|undefined>):DeepSearchProvenance|undefined{
  const fields:DeepSearchProvenance['fields']={};for(const item of items)if(item)Object.assign(fields,item.fields);
  return Object.keys(fields).length?{version:1,fields}:undefined;
}
