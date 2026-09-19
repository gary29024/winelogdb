import { AI_MODELS } from '../../src/lib/ai/policy';
import { geminiCallTokens,recordAiUsage,type AiUsageEnv } from '../../src/lib/usage/aiUsage';
import { lwinCandidateRows,normalizeReferenceText,producerLookupKeys } from '../../src/lib/wine/referenceCatalog';
import type { LwinReferenceProduct } from '../../src/lib/wine/lwinImport';
import { postGeminiGenerateContent,type GeminiTransportBindings } from '../geminiTransport';

export type LwinRepairWine={
 id:string;owner_id:string;producer:string|null;wine_name:string|null;country:string|null;region:string|null;wine_style:string|null;release_designation:string|null;
};
type Env=GeminiTransportBindings&AiUsageEnv&{REFERENCE_DATA:R2Bucket};
export type RepairChoice={lwin7:string;confidence:number;method:'deterministic'|'ai'}|null;

const words=(value:string|null|undefined)=>new Set(normalizeReferenceText(value).split(' ').filter(Boolean));
function similarity(a:string|null|undefined,b:string|null|undefined){
 const left=words(a),right=words(b);if(!left.size||!right.size)return 0;
 let common=0;for(const word of left)if(right.has(word))common++;
 return common/Math.max(left.size,right.size);
}
function candidateScore(wine:LwinRepairWine,row:LwinReferenceProduct){
 const producer=Math.max(...producerLookupKeys(wine.producer).map(key=>similarity(key,row.producerKey)),0);
 const name=similarity([wine.wine_name,wine.release_designation].filter(Boolean).join(' '),row.wineName);
 const country=wine.country&&row.country?similarity(wine.country,row.country):1;
 const region=wine.region&&row.region?similarity(wine.region,row.region):1;
 if(producer<0.45||name<0.34||country<0.5||region<0.34)return 0;
 return producer*.48+name*.42+country*.04+region*.06;
}
export async function repairCandidates(bucket:R2Bucket,wine:LwinRepairWine){
 const scored=await lwinCandidateRows<LwinReferenceProduct>(bucket,row=>row.status==='Live'&&candidateScore(wine,row)>=0.48,Number.MAX_SAFE_INTEGER);
 return scored.map(row=>({row,score:candidateScore(wine,row)})).sort((a,b)=>b.score-a.score).slice(0,8);
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
 const candidateData=candidates.map(({row,score})=>({lwin7:row.lwin7,producer:row.producerName,wine:row.wineName,country:row.country,region:row.region,subRegion:row.subRegion,site:row.site,parcel:row.parcel,colour:row.colour,type:row.productType,score:Number(score.toFixed(3))}));
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
