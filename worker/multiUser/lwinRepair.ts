import { AI_MODELS } from '../../src/lib/ai/policy';
import { geminiCallTokens,recordAiUsage,type AiUsageEnv } from '../../src/lib/usage/aiUsage';
import { lwinCandidateRowsForProducer,lwinReferenceIdentity,normalizeReferenceText,producerHouseQualifier,producerLookupKeys } from '../../src/lib/wine/referenceCatalog';
import type { LwinReferenceProduct } from '../../src/lib/wine/lwinImport';
import { postGeminiGenerateContent,type GeminiTransportBindings } from '../geminiTransport';

export type LwinRepairWine={
 id:string;owner_id:string;producer:string|null;wine_name:string|null;country:string|null;region:string|null;wine_style:string|null;release_designation:string|null;
};
type Env=GeminiTransportBindings&AiUsageEnv&{REFERENCE_DATA:R2Bucket};
export type RepairChoice={lwin7:string;confidence:number;method:'deterministic'|'ai'}|null;

const words=(value:string|null|undefined)=>new Set(normalizeReferenceText(value).split(' ').filter(Boolean));
function setSimilarity(left:Set<string>,right:Set<string>){if(!left.size||!right.size)return 0;let common=0;for(const word of left)if(right.has(word))common++;return common/Math.max(left.size,right.size)}
function scorer(wine:LwinRepairWine){
 const producerKeys=producerLookupKeys(wine.producer).map(words),inputQualifier=producerHouseQualifier(wine.producer),wineName=words([wine.wine_name,wine.release_designation].filter(Boolean).join(' ')),country=words(wine.country),region=words(wine.region);
 return (row:LwinReferenceProduct)=>{
  const identity=lwinReferenceIdentity(row),candidateQualifier=producerHouseQualifier(identity.producerName);
  // A qualifier the official display actually carries is identity-bearing.
  // A qualified user input against an unqualified official row remains a
  // plausible alias, but receives a small confidence penalty.
  if(inputQualifier&&candidateQualifier&&inputQualifier!==candidateQualifier)return 0;
  if(!inputQualifier&&candidateQualifier)return 0;
  const qualifierPenalty=inputQualifier&&!candidateQualifier?.95:1;
  const candidateProducerKeys=[identity.producerKey,identity.structuredProducerKey].filter(Boolean).map(words);
  const producer=Math.max(...producerKeys.flatMap(left=>candidateProducerKeys.map(right=>setSimilarity(left,right))),0),name=setSimilarity(wineName,words(identity.wineName));
  const countryScore=wine.country&&row.country?setSimilarity(country,words(row.country)):1,regionScore=wine.region&&row.region?setSimilarity(region,words(row.region)):1;
  if(producer<0.45||name<0.34||countryScore<0.5||regionScore<0.34)return 0;
  return (producer*.48+name*.42+countryScore*.04+regionScore*.06)*qualifierPenalty;
 };
}
export async function repairCandidates(bucket:R2Bucket,wine:LwinRepairWine){
 const score=scorer(wine),rows=await lwinCandidateRowsForProducer<LwinReferenceProduct>(bucket,wine.producer),best:Array<{row:LwinReferenceProduct;score:number}>=[];
 for(const row of rows){if(row.status!=='Live')continue;const value=score(row);if(value<0.48)continue;best.push({row,score:value});best.sort((a,b)=>b.score-a.score);if(best.length>8)best.pop()}
 return best;
}
export function deterministicRepair(candidates:Awaited<ReturnType<typeof repairCandidates>>):RepairChoice{
 const first=candidates[0],second=candidates[1];if(!first)return null;
 // Deliberately conservative: exact-ish producer/wine agreement and a useful
 // margin are cheaper and safer than asking the model to confirm an obvious row.
 return first.score>=.93&&(!second||first.score-second.score>=.12)?{lwin7:first.row.lwin7,confidence:first.score,method:'deterministic'}:null;
}
type GeminiPayload={usageMetadata?:{promptTokenCount?:unknown;candidatesTokenCount?:unknown;thoughtsTokenCount?:unknown};candidates?:Array<{content?:{parts?:Array<{text?:string}>}}>;error?:unknown};
function responseText(payload:GeminiPayload){return String(payload.candidates?.[0]?.content?.parts?.map(part=>part.text??'').join('')??'')}
export async function aiRepair(env:Env,wine:LwinRepairWine,candidates:Awaited<ReturnType<typeof repairCandidates>>):Promise<RepairChoice>{
 if(!candidates.length)return null;
 const deterministic=deterministicRepair(candidates);if(deterministic)return deterministic;
 const candidateData=candidates.map(({row,score})=>{const identity=lwinReferenceIdentity(row);return {lwin7:row.lwin7,producer:identity.producerName,wine:identity.wineName,country:row.country,region:row.region,subRegion:row.subRegion,site:row.site,parcel:row.parcel,colour:row.colour,type:row.productType,score:Number(score.toFixed(3))}});
 const prompt=`You are resolving a WineLog record to an official LWIN candidate. Choose ONLY from the supplied candidates. Never invent an LWIN. Treat abbreviations, accents, translated wording and producer prefixes as possible aliases, but reject conflicts in producer, cuvee, geography or wine type. If evidence is insufficient return NONE. Input: ${JSON.stringify({producer:wine.producer,wine:wine.wine_name,release:wine.release_designation,country:wine.country,region:wine.region,style:wine.wine_style})}. Candidates: ${JSON.stringify(candidateData)}`;
 const body=JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:0,responseMimeType:'application/json',responseJsonSchema:{type:'object',properties:{lwin7:{type:['string','null']},confidence:{type:'number'},reason:{type:'string'}},required:['lwin7','confidence','reason'],additionalProperties:false}}});
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45_000);
 try{
  const {response}=await postGeminiGenerateContent(env,AI_MODELS.recognitionPrimary,body,controller.signal,{feature:'lwin-backfill',wine:wine.id},{serviceTier:'flex',serverTimeoutSeconds:40});
  const payload=await response.json() as GeminiPayload;
  await recordAiUsage(env,wine.owner_id,{kind:'lwin_backfill',runId:'lwin-ai-backfill',targetId:wine.id,eventId:`lwin-backfill:${wine.owner_id}:${wine.id}`,model:AI_MODELS.recognitionPrimary,tier:'flex',requests:1,units:1,...geminiCallTokens(payload?.usageMetadata)});
  if(!response.ok)return null;
  let parsed:{lwin7?:string|null;confidence?:number};try{parsed=JSON.parse(responseText(payload))}catch{return null}
  const confidence=Number(parsed.confidence)||0,lwin7=String(parsed.lwin7??'');
  if(confidence<.90||!candidates.some(item=>item.row.lwin7===lwin7))return null;
  return {lwin7,confidence,method:'ai'};
 }finally{clearTimeout(timer)}
}
