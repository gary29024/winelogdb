import { geminiCallTokens,recordAiUsage,type AnalyticsSink } from '../src/lib/usage/aiUsage';
import { askableVintage,readVintageWindow,vintageCell,vintageWindowSchema,writeVintageWindow,type VintageCell,type VintageSubject } from '../src/lib/maturity/vintageWindow';
import { maturityFor } from '../src/lib/maturity/ageing';
import { describeResponseSchema,groundedGenerationConfig } from '../src/lib/research/geminiBatch';
import { firstBalancedJsonObject } from '../src/lib/producers/structuredJson';
import { postGeminiGenerateContent,type GeminiTransportBindings } from './geminiTransport';

export type VintageWindowBindings=GeminiTransportBindings&{DB:D1Database;AI_USAGE?:AnalyticsSink};

const MODEL='gemini-3.1-flash-lite';
const ESCALATION_MODEL='gemini-3.8-flash';
const TIMEOUT_MS=30_000;
const ESCALATION_TIMEOUT_MS=45_000;
const OUTPUT_TOKENS=4096;
const ESCALATION_OUTPUT_TOKENS=8192;
const GROUNDING_HOST='vertexaisearch.cloud.google.com';

const place=(subject:VintageSubject)=>[subject.appellation,subject.region,subject.country].filter(Boolean).join(', ');

/**
 * One grounded request now answers both questions WineLog asks about a year:
 * when it is likely to drink well, and how good the vintage appears to be.
 *
 * The score is explicitly WineLog's synthesis. We do not ask the model to copy
 * a critic's proprietary number or review text; public critic/merchant/regional
 * commentary is evidence, alongside harvest and growing-season reporting.
 */
function prompt(subject:VintageSubject,baseline:{from:number;to:number}|null,cell:VintageCell){
  const where=place(subject),style=subject.wineStyle?`${subject.wineStyle} wine`:'wine';
  const usual=baseline?`Wines like this are usually worth drinking between ${baseline.from} and ${baseline.to}.`
    :'No typical window is known for this combination.';
  const kept=cell.scope==='appellation'
    ?`The answer is kept for every ${style} of ${subject.vintage} from ${cell.label} itself. Write about that vineyard and year, but never about one producer.`
    :`The answer is kept for every ${style} of ${subject.vintage} from ${cell.label}. Write about the regional growing season and resulting wines, not one producer, estate or vineyard.`;
  return `You must use Google Search before answering. Every factual claim must come from a page retrieved in this request. Do not answer from prior knowledge. If search returns nothing usable about this vintage and place, return null for both drinking years and quality.score, use low confidence, and explain the evidence gap.

For ${style} from ${where}, vintage ${subject.vintage}, research both the drinking window and the quality of the vintage.

${usual} For the drinking window, say where ${subject.vintage} moves that usual window and why. drinkFrom and drinkTo are calendar years, not ages, and apply to a wine of the kind described above rather than the region's longest-lived bottling.

For quality, synthesize public evidence rather than copying any critic score. Prioritize, where available: official regional or grower bodies; established wine publications/critics' publicly accessible vintage commentary; reputable merchants' vintage reports; producer/harvest reports. Do not quote or reproduce paywalled reviews, and do not present a third party's numeric rating as WineLog's score.

Return a WineLog quality score only when the retrieved evidence supports one. Use this calibration consistently: 95-100 exceptional/historic; 90-94 outstanding; 85-89 excellent; 80-84 very good; 75-79 good; 70-74 variable/challenging. confidence is high only when several independent sources materially agree, medium for narrower but credible agreement, and low for thin or conflicting evidence. consensus is a concise synthesis, strengths and cautions are short evidence-backed phrases.

${kept} Keep note and consensus concise.`;
}

/** Search grounding and responseSchema cannot be sent together, so this schema
 * is rendered into the prompt and then validated locally. */
const responseSchema={type:'OBJECT',properties:{
  drinkFrom:{type:'INTEGER',nullable:true},drinkTo:{type:'INTEGER',nullable:true},
  note:{type:'STRING'},
  quality:{type:'OBJECT',nullable:true,properties:{
    score:{type:'INTEGER',nullable:true},confidence:{type:'STRING',enum:['low','medium','high']},
    consensus:{type:'STRING'},strengths:{type:'ARRAY',items:{type:'STRING'}},cautions:{type:'ARRAY',items:{type:'STRING'}}
  },required:['score','confidence','consensus','strengths','cautions']},
  sources:{type:'ARRAY',items:{type:'OBJECT',properties:{title:{type:'STRING'},url:{type:'STRING'}},required:['title','url']}}
},required:['drinkFrom','drinkTo','note','quality','sources']};

type GeminiResponse={
  candidates?:Array<{content?:{parts?:Array<{text?:string}>};finishReason?:string;groundingMetadata?:{
    groundingChunks?:Array<{web?:{title?:string;uri?:string}}>;webSearchQueries?:string[]}}>;
  usageMetadata?:{promptTokenCount?:number;candidatesTokenCount?:number;thoughtsTokenCount?:number};
};

function parseJson(raw:string){
  const text=raw.replace(/^\uFEFF/,'').trim();
  const fenced=text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  for(const candidate of [text,fenced,firstBalancedJsonObject(text)]){
    if(!candidate)continue;
    try{return JSON.parse(candidate) as unknown}catch{/* try the next shape */}
  }
  throw new Error('No JSON object in the reply');
}

const dedupe=(sources:Array<{title?:unknown;url?:unknown}>)=>{
  const seen=new Set<string>(),kept:Array<{title:string;url:string}>=[];
  for(const source of sources){
    const url=typeof source?.url==='string'?source.url.trim():'';
    if(!url||seen.has(url))continue;
    seen.add(url);kept.push({title:String(source?.title||url).slice(0,300),url});
  }
  return kept.slice(0,12);
};

function groundedSources(payload:GeminiResponse,fromReply:unknown){
  const chunks=payload.candidates?.[0]?.groundingMetadata?.groundingChunks??[];
  const metadata=dedupe(chunks.map(chunk=>({title:chunk.web?.title,url:chunk.web?.uri})));
  if(metadata.length)return metadata;
  return dedupe(Array.isArray(fromReply)?fromReply as Array<{title?:unknown;url?:unknown}>:[]);
}

const wasGrounded=(payload:GeminiResponse,sources:Array<{url:string}>)=>
  Boolean(payload.candidates?.[0]?.groundingMetadata?.groundingChunks?.length)
  ||sources.some(source=>source.url.includes(GROUNDING_HOST));

type Answer=ReturnType<typeof vintageWindowSchema.parse>;
type Billed={searchQueries:number;promptTokens:number;outputTokens:number};
type Detail=Record<string,unknown>;
type Attempt={model:string;billed:Billed|null;detail?:Detail}&
  ({ok:true;answer:Answer}|{ok:false;reason:string;error:Error});

async function ask(env:VintageWindowBindings,subject:VintageSubject,baseline:{from:number;to:number}|null,
  cell:VintageCell,model:string,requestId:string,timeoutMs:number,outputTokens:number):Promise<Attempt>{
  const vintage=subject.vintage as number;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  let billed:Billed|null=null;
  try{
    const {response}=await postGeminiGenerateContent(env,model,JSON.stringify({
      contents:[{role:'user',parts:[{text:`${prompt(subject,baseline,cell)}\n\n${describeResponseSchema(responseSchema)}`}]}],
      tools:[{google_search:{}}],generationConfig:groundedGenerationConfig(outputTokens)
    }),controller.signal,{kind:'vintage_window',vintage,requestId,model});
    if(!response.ok){
      const body=(await response.text().catch(()=>'')).slice(0,400);
      return {model,billed,detail:{status:response.status,body:body.slice(0,300)},ok:false,reason:`http-${response.status}`,
        error:new Error(`Vintage lookup failed (${response.status})${body?`: ${body}`:''}`)};
    }
    const payload=await response.json() as GeminiResponse,tokens=geminiCallTokens(payload.usageMetadata);
    billed={searchQueries:payload.candidates?.[0]?.groundingMetadata?.webSearchQueries?.length??1,
      promptTokens:tokens.promptTokens,outputTokens:tokens.outputTokens};
    const candidate=payload.candidates?.[0];
    const text=candidate?.content?.parts?.map(part=>part.text??'').join('')??'';
    const detail:Detail={finishReason:candidate?.finishReason??null,
      metadataChunks:candidate?.groundingMetadata?.groundingChunks?.length??0,
      searchQueries:billed.searchQueries,replyChars:text.length,reply:text.slice(0,300)};
    if(!text)return {model,billed,detail,ok:false,reason:'empty',error:new Error('The vintage lookup came back empty')};
    let answer:{sources?:unknown};
    try{answer=parseJson(text) as {sources?:unknown}}
    catch{
      const cut=candidate?.finishReason==='MAX_TOKENS';
      return {model,billed,detail,ok:false,reason:cut?'truncated':'unparseable',
        error:new Error(cut?'The vintage lookup ran out of room before it finished answering':'The vintage lookup did not come back as JSON')};
    }
    const parsed=vintageWindowSchema.safeParse({...answer,sources:groundedSources(payload,answer.sources)});
    if(!parsed.success)return {model,billed,detail,ok:false,reason:'invalid-shape',
      error:new Error(`The vintage lookup came back in the wrong shape: ${parsed.error.issues.map(issue=>issue.message).join('; ')}`)};
    const sources=parsed.data.sources;
    detail.sources=sources.length;detail.redirects=sources.filter(source=>source.url.includes(GROUNDING_HOST)).length;
    detail.vintageScore=parsed.data.quality?.score??null;detail.confidence=parsed.data.quality?.confidence??null;
    if(!sources.length||!wasGrounded(payload,sources))return {model,billed,detail,ok:false,reason:'ungrounded',
      error:new Error('Nothing was retrieved for this vintage, so there is nothing to show')};
    return {model,billed,detail,ok:true,answer:parsed.data};
  }catch(e){
    return {model,billed,ok:false,reason:controller.signal.aborted?'timeout':'transport',
      error:e instanceof Error?e:new Error('The vintage lookup could not be made')};
  }finally{clearTimeout(timer)}
}

const meter=(env:VintageWindowBindings,owner:string,requestId:string,attempt:Attempt,units:number)=>
  attempt.billed?recordAiUsage(env,owner,{kind:'vintage_window',runId:requestId,model:attempt.model,requests:1,units,
    searchQueries:attempt.billed.searchQueries,promptTokens:attempt.billed.promptTokens,outputTokens:attempt.billed.outputTokens}):Promise.resolve();

export async function researchVintageWindow(env:VintageWindowBindings,owner:string,subject:VintageSubject,requestId:string){
  if(!askableVintage(subject))throw new Error('A vintage and a place are needed before a year can be looked up');
  const table=maturityFor(subject),vintage=subject.vintage as number;
  const baseline=table?{from:vintage+table.window.from,to:vintage+table.window.to}:null;
  const cell=vintageCell(subject);

  let attempt=await ask(env,subject,baseline,cell,MODEL,requestId,TIMEOUT_MS,OUTPUT_TOKENS);
  if(!attempt.ok){
    await meter(env,owner,requestId,attempt,0);
    console.warn(JSON.stringify({event:'vintage-window-escalation',requestId,vintage,cell:cell.label,
      fromModel:MODEL,toModel:ESCALATION_MODEL,reason:attempt.reason,error:attempt.error.message,...attempt.detail}));
    const escalated=await ask(env,subject,baseline,cell,ESCALATION_MODEL,requestId,ESCALATION_TIMEOUT_MS,ESCALATION_OUTPUT_TOKENS);
    if(!escalated.ok){
      await meter(env,owner,requestId,escalated,0);
      console.error(JSON.stringify({event:'vintage-window-refused',requestId,vintage,cell:cell.label,
        model:escalated.model,reason:escalated.reason,error:escalated.error.message,...escalated.detail}));
      throw escalated.error;
    }
    attempt=escalated;
  }
  console.log(JSON.stringify({event:'vintage-window-answered',requestId,vintage,cell:cell.label,
    model:attempt.model,escalated:attempt.model!==MODEL,sources:attempt.detail?.sources??null,
    redirects:attempt.detail?.redirects??null,vintageScore:attempt.detail?.vintageScore??null,
    confidence:attempt.detail?.confidence??null}));
  await meter(env,owner,requestId,attempt,1);
  return writeVintageWindow(env.DB,owner,subject,attempt.answer,baseline,attempt.model);
}

export const cachedVintageWindow=(env:VintageWindowBindings,owner:string,subject:VintageSubject)=>
  readVintageWindow(env.DB,owner,subject);
