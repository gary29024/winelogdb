import type { DeepSearchProvenance } from '../db/schema';
import type { DeepResearchField } from './qualityGate';
import { summarizeFieldProvenance,type ClaimSource,type ResearchClaimProvenance } from './provenance';

export type TechnicalConflictMetric='new_oak_percentage'|'whole_cluster_percentage'|'destemmed_percentage'|'reserve_wine_percentage'|'dosage_g_l'|'fermentation_duration'|'maceration_duration'|'lees_duration'|'barrel_maturation_duration'|'bottle_maturation_duration'|'maturation_duration'|'fermentation_temperature_c'|'yield_hl_ha'|'planting_density_vines_ha';
export type TechnicalConflictObservation={field:DeepResearchField;claim:string;displayValue:string;sources:ClaimSource[]};
export type TechnicalConflict={metric:TechnicalConflictMetric;label:string;acknowledged:boolean;observations:TechnicalConflictObservation[]};
export type TechnicalContradictionAudit={provenance:DeepSearchProvenance|undefined;conflicts:TechnicalConflict[];unacknowledged:TechnicalConflict[]};

type StrictField='summary'|'winemakingTechniques';
type Observation={field:StrictField;claimIndex:number;claim:string;metric:TechnicalConflictMetric;label:string;value:number;tolerance:number;displayValue:string;sources:ClaimSource[]};

const STRICT_FIELDS:StrictField[]=['summary','winemakingTechniques'];
const PERCENT='(?:%|percent\\b|per\\s+cent\\b)';
const CONFLICT_SIGNAL=/\b(?:conflicting|contradictory|inconsistent|irreconcilable)\b|\b(?:sources?|reports?|figures?|accounts?|references?)\b[^.!?]{0,80}\b(?:disagree|conflict|differ|diverge|vary)\b|\bdifferent sources? report\b|\bcannot be reconciled\b|\bmay reflect different (?:bottlings?|disgorgements?|lots?|batches?)\b/i;
const DURATION=/\b(\d+(?:\.\d+)?)\s*(days?|weeks?|months?|years?)\b/i;

function cloneProvenance(provenance:DeepSearchProvenance|undefined){
  if(!provenance)return undefined;
  const fields:DeepSearchProvenance['fields']={};
  for(const [field,item] of Object.entries(provenance.fields))fields[field]={...item,claims:item.claims.map(claim=>({...claim,sources:claim.sources.map(source=>({...source}))}))};
  return {version:1 as const,fields};
}

function captureNumber(claim:string,patterns:RegExp[]){
  for(const pattern of patterns){const match=claim.match(pattern);if(!match)continue;const raw=match[1]??match[2];if(raw==null)continue;const value=Number(raw);if(Number.isFinite(value))return {value,displayValue:match[0].trim()}}
  return null;
}

function percentageObservation(claim:string,field:StrictField,claimIndex:number,sources:ClaimSource[]){
  const definitions:Array<{metric:TechnicalConflictMetric;label:string;patterns:RegExp[]}>= [
    {metric:'new_oak_percentage',label:'new oak percentage',patterns:[new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*${PERCENT}[^.!?]{0,45}\\bnew\\s+(?:oak|barrels?|casks?|wood)\\b`,'i'),new RegExp(`\\bnew\\s+(?:oak|barrels?|casks?|wood)\\b[^.!?]{0,45}\\b(\\d+(?:\\.\\d+)?)\\s*${PERCENT}`,'i')]},
    {metric:'whole_cluster_percentage',label:'whole-cluster / whole-bunch percentage',patterns:[new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*${PERCENT}[^.!?]{0,45}\\bwhole[- ]?(?:cluster|bunch)(?:es)?\\b`,'i'),new RegExp(`\\bwhole[- ]?(?:cluster|bunch)(?:es)?\\b[^.!?]{0,45}\\b(\\d+(?:\\.\\d+)?)\\s*${PERCENT}`,'i')]},
    {metric:'destemmed_percentage',label:'destemmed percentage',patterns:[new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*${PERCENT}[^.!?]{0,45}\\bdestemm(?:ed|ing)?\\b`,'i'),new RegExp(`\\bdestemm(?:ed|ing)?\\b[^.!?]{0,45}\\b(\\d+(?:\\.\\d+)?)\\s*${PERCENT}`,'i')]},
    {metric:'reserve_wine_percentage',label:'reserve-wine percentage',patterns:[new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*${PERCENT}[^.!?]{0,45}\\breserve\\s+wines?\\b`,'i'),new RegExp(`\\breserve\\s+wines?\\b[^.!?]{0,45}\\b(\\d+(?:\\.\\d+)?)\\s*${PERCENT}`,'i')]}
  ];
  const out:Observation[]=[];
  for(const definition of definitions){const found=captureNumber(claim,definition.patterns);if(found)out.push({field,claimIndex,claim,metric:definition.metric,label:definition.label,value:found.value,tolerance:.5,displayValue:found.displayValue,sources})}
  return out;
}

function durationDays(value:number,unit:string){
  if(/^day/i.test(unit))return value;
  if(/^week/i.test(unit))return value*7;
  if(/^month/i.test(unit))return value*(365.25/12);
  return value*365.25;
}

function durationObservation(claim:string,field:StrictField,claimIndex:number,sources:ClaimSource[]):Observation|null{
  const match=claim.match(DURATION);if(!match)return null;const raw=Number(match[1]);if(!Number.isFinite(raw))return null;
  const text=claim.toLowerCase();let metric:TechnicalConflictMetric|null=null,label='';
  if(/macerat/.test(text)){metric='maceration_duration';label='maceration duration'}
  else if(/ferment/.test(text)){metric='fermentation_duration';label='fermentation duration'}
  else if(/\blees?\b/.test(text)){metric='lees_duration';label='time on lees'}
  else if(/\bbottl/.test(text)&&/(?:aged|ageing|aging|matur|rest)/.test(text)){metric='bottle_maturation_duration';label='bottle maturation duration'}
  else if(/(?:barrel|cask|oak)/.test(text)&&/(?:aged|ageing|aging|matur|elevage|élevage)/.test(text)){metric='barrel_maturation_duration';label='barrel / oak maturation duration'}
  else if(/(?:aged|ageing|aging|matur|elevage|élevage)/.test(text)){metric='maturation_duration';label='maturation duration'}
  if(!metric)return null;const days=durationDays(raw,match[2]),tolerance=Math.max(10,days*.05);
  return {field,claimIndex,claim,metric,label,value:days,tolerance,displayValue:match[0],sources};
}

function dosageObservation(claim:string,field:StrictField,claimIndex:number,sources:ClaimSource[]):Observation|null{
  if(!/\bdosage\b/i.test(claim))return null;
  const found=captureNumber(claim,[/\bdosage\b[^.!?]{0,45}\b(\d+(?:\.\d+)?)\s*(?:g\s*\/?\s*l|grams?\s+per\s+lit(?:re|er))/i,/\b(\d+(?:\.\d+)?)\s*(?:g\s*\/?\s*l|grams?\s+per\s+lit(?:re|er))\b[^.!?]{0,45}\bdosage\b/i]);
  return found?{field,claimIndex,claim,metric:'dosage_g_l',label:'dosage',value:found.value,tolerance:.15,displayValue:found.displayValue,sources}:null;
}

function temperatureObservation(claim:string,field:StrictField,claimIndex:number,sources:ClaimSource[]):Observation|null{
  if(!/ferment/i.test(claim))return null;const match=claim.match(/\b(\d+(?:\.\d+)?)\s*(?:°\s*c|°c|degrees?\s+c(?:elsius)?)\b/i);if(!match)return null;
  return {field,claimIndex,claim,metric:'fermentation_temperature_c',label:'fermentation temperature',value:Number(match[1]),tolerance:1,displayValue:match[0],sources};
}

function yieldObservation(claim:string,field:StrictField,claimIndex:number,sources:ClaimSource[]):Observation|null{
  const match=claim.match(/\b(\d+(?:\.\d+)?)\s*hl\s*\/?\s*ha\b/i);if(!match)return null;
  return {field,claimIndex,claim,metric:'yield_hl_ha',label:'yield',value:Number(match[1]),tolerance:1,displayValue:match[0],sources};
}

function densityObservation(claim:string,field:StrictField,claimIndex:number,sources:ClaimSource[]):Observation|null{
  const match=claim.match(/\b(\d+(?:\.\d+)?)\s*(?:vines?\s*\/?\s*ha|vines?\s+per\s+hectare)\b/i);if(!match)return null;
  return {field,claimIndex,claim,metric:'planting_density_vines_ha',label:'planting density',value:Number(match[1]),tolerance:100,displayValue:match[0],sources};
}

function observationsForClaim(field:StrictField,claimIndex:number,claim:ResearchClaimProvenance){
  if((claim.supportStatus!=='supported'&&claim.supportStatus!=='conflicting')||!claim.sources.length)return [];
  const out=percentageObservation(claim.claim,field,claimIndex,claim.sources),single=[durationObservation(claim.claim,field,claimIndex,claim.sources),dosageObservation(claim.claim,field,claimIndex,claim.sources),temperatureObservation(claim.claim,field,claimIndex,claim.sources),yieldObservation(claim.claim,field,claimIndex,claim.sources),densityObservation(claim.claim,field,claimIndex,claim.sources)];
  for(const item of single)if(item)out.push(item);return out;
}

function independentSources(a:Observation,b:Observation){
  const left=new Set(a.sources.map(source=>source.url)),right=new Set(b.sources.map(source=>source.url));if(!left.size||!right.size)return false;
  for(const url of left)if(right.has(url))return false;return true;
}
function equivalent(a:Observation,b:Observation){return Math.abs(a.value-b.value)<=Math.max(a.tolerance,b.tolerance)}
function uniqueObservations(items:Observation[]){const seen=new Set<string>();return items.filter(item=>{const key=`${item.field}:${item.claimIndex}`;if(seen.has(key))return false;seen.add(key);return true})}
function conflictAcknowledged(payload:Record<string,unknown>){return STRICT_FIELDS.some(field=>CONFLICT_SIGNAL.test(typeof payload[field]==='string'?payload[field] as string:''))}

export function auditTechnicalContradictions(payload:Record<string,unknown>,provenance?:DeepSearchProvenance):TechnicalContradictionAudit{
  const next=cloneProvenance(provenance);if(!next)return {provenance:undefined,conflicts:[],unacknowledged:[]};
  const observations:Observation[]=[];for(const field of STRICT_FIELDS){const evidence=next.fields[field];if(!evidence)continue;evidence.claims.forEach((claim,index)=>observations.push(...observationsForClaim(field,index,claim)))}
  const grouped=new Map<TechnicalConflictMetric,Observation[]>();for(const observation of observations){const list=grouped.get(observation.metric)??[];list.push(observation);grouped.set(observation.metric,list)}
  const conflicts:TechnicalConflict[]=[],acknowledged=conflictAcknowledged(payload);
  for(const [metric,items] of grouped){const involved:Observation[]=[];for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){if(equivalent(items[i],items[j])||!independentSources(items[i],items[j]))continue;involved.push(items[i],items[j])}
    const unique=uniqueObservations(involved);if(unique.length<2)continue;conflicts.push({metric,label:unique[0].label,acknowledged,observations:unique.map(item=>({field:item.field,claim:item.claim,displayValue:item.displayValue,sources:item.sources}))});
    if(acknowledged)for(const item of unique){const field=next.fields[item.field],claim=field?.claims[item.claimIndex];if(claim&&claim.supportStatus==='supported')claim.supportStatus='conflicting'}
  }
  for(const field of STRICT_FIELDS){const evidence=next.fields[field];if(evidence)next.fields[field]=summarizeFieldProvenance(evidence.claims)}
  return {provenance:next,conflicts,unacknowledged:conflicts.filter(item=>!item.acknowledged)};
}

export function technicalContradictionScopePasses(scope:string,payload:Record<string,unknown>,provenance?:DeepSearchProvenance){return scope!=='wine_vintage'||auditTechnicalContradictions(payload,provenance).unacknowledged.length===0}
export function technicalContradictionFailureMessage(payload:Record<string,unknown>,provenance?:DeepSearchProvenance){
  const conflicts=auditTechnicalContradictions(payload,provenance).unacknowledged;if(!conflicts.length)return null;
  const examples=conflicts.slice(0,3).map(item=>`${item.label}: ${item.observations.map(observation=>observation.displayValue).join(' vs ')}`).join(' | ');
  return `Cross-source evidence contains ${conflicts.length} unresolved technical disagreement${conflicts.length===1?'':'s'}. The exact-wine result must explicitly disclose the conflict instead of silently choosing one value${examples?`: ${examples}`:''}`;
}

export function disputedTechnicalClaimCount(provenance?:DeepSearchProvenance){let count=0;for(const field of Object.values(provenance?.fields??{}))count+=field.conflictingCount??0;return count}
