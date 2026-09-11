import { geminiCallTokens,recordAiUsage,type AnalyticsSink } from '../src/lib/usage/aiUsage';
import { askableVintage,readVintageWindow,vintageCell,vintageQualitySchema,vintageWindowSchema,writeVintageWindow,type VintageCell,type VintageSubject } from '../src/lib/maturity/vintageWindow';
import { maturityFor } from '../src/lib/maturity/ageing';
import { describeResponseSchema,groundedGenerationConfig } from '../src/lib/research/geminiBatch';
import { firstBalancedJsonObject } from '../src/lib/producers/structuredJson';
import { postGeminiGenerateContent,type GeminiTransportBindings } from './geminiTransport';

export type VintageWindowBindings=GeminiTransportBindings&{DB:D1Database;AI_USAGE?:AnalyticsSink};

/** Start with the cheaper model and escalate only when its window or grounding
 * is unusable. Both attempts are metered under one run: rejected answers still
 * consume tokens and searches. Malformed optional quality alone must not escalate. */
const MODEL='gemini-3.1-flash-lite';
const ESCALATION_MODEL='gemini-3.8-flash';
const TIMEOUT_MS=30_000;
const ESCALATION_TIMEOUT_MS=45_000;
/** Thinking tokens share the output cap. Too little room can truncate otherwise
 * valid JSON; the escalation gets extra room for thinking plus the quality fields.
 * Only generated tokens are metered, not the unused allowance. */
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
  /**
   * Write for the cell that shares this answer, not just the bottle asking.
   * A region cell serves every wine of that style from the region, so naming
   * one vineyard would make the note wrong for the others. A named grand cru
   * has its own cell: there, naming the vineyard and the year is the point.
   */
  const kept=cell.scope==='appellation'
    ?`The note is kept for every ${style} of ${subject.vintage} from ${cell.label}; write it about that vineyard in that year. Name the vineyard and the year; do not name a producer or estate.`
    :`The note is kept for every ${style} of ${subject.vintage} from ${cell.label}; write about the regional growing season and resulting wines, and do not name a producer, an estate or a single vineyard in it.`;
  return `You must use Google Search before answering. Every factual claim must come from a page retrieved in this request. Do not answer from prior knowledge. If search returns nothing usable about this vintage and place, return null for both drinking years and quality.score, use low confidence, and explain the evidence gap.

For ${style} from ${where}, vintage ${subject.vintage}, research both the drinking window and the quality of the vintage.

${usual} For the drinking window, say where ${subject.vintage} moves that usual window and why. drinkFrom and drinkTo are calendar years, not ages, and apply to a wine of the kind described above rather than the region's longest-lived bottling.

For quality, assess ${cell.label} ${subject.vintage} for ${style}, the shared cache scope, rather than this individual bottle or a narrower place within it. This applies to the score, consensus, strengths and cautions as well as the note. Synthesize public evidence rather than copying any critic score. Prioritize, where available: official regional or grower bodies; established wine publications/critics' publicly accessible vintage commentary; reputable merchants' vintage reports; producer/harvest reports. Do not quote or reproduce paywalled reviews, and do not present a third party's numeric rating as WineLog's score.

Return a WineLog quality score only when the retrieved evidence supports one. Use this calibration consistently: 95-100 exceptional/historic; 90-94 outstanding; 85-89 excellent; 80-84 very good; 75-79 good; 70-74 variable/challenging. If the evidence describes a vintage worse than the 70-74 band, return score:null and explain the below-scale assessment in consensus; never inflate it to 70. confidence is high only when several independent sources materially agree, medium for narrower but credible agreement, and low for thin or conflicting evidence. consensus is a concise synthesis, strengths and cautions are short evidence-backed phrases.

${kept} Keep note to at most three sentences and within 1200 characters and consensus within 600 characters. Return at most 5 strengths and 5 cautions, each 1-120 characters, and at most 12 sources with titles no longer than 300 characters.`;
}

/** Rendered into the prompt, never sent as responseSchema.
 * Sending controlled generation alongside google_search previously produced valid
 * JSON with grounding silently dropped, causing every lookup to report "nothing
 * was retrieved". Keep groundedGenerationConfig and validate locally; geminiBatch
 * documents the same failure in the other research paths. */
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

/**
 * The JSON out of a grounded reply, wherever in it the model put it.
 *
 * This used to require the whole reply to be JSON, stripping a fence only if it
 * sat at both ends - and a grounded model does not oblige. It writes a
 * sentence first, or appends its citations after the object, or fences it
 * mid-reply, and every one of those came back as "did not come back as JSON"
 * with a perfectly good answer inside it.
 *
 * Three attempts, cheapest first: the whole thing, a fenced block anywhere in
 * it, then the first balanced object - the same scan the producer catalogue
 * uses for the same reason, reused rather than written twice.
 */
function parseJson(raw:string){
  const text=raw.replace(/^\uFEFF/,'').trim();
  const fenced=text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  for(const candidate of [text,fenced,firstBalancedJsonObject(text)]){
    if(!candidate)continue;
    try{return JSON.parse(candidate) as unknown}catch{/* try the next shape */}
  }
  throw new Error('No JSON object in the reply');
}

const webUrl=(value:unknown)=>{
  if(typeof value!=='string')return null;
  try{
    const url=new URL(value.trim());
    return (url.protocol==='https:'||url.protocol==='http:')&&!url.username&&!url.password?url:null;
  }catch{return null}
};

// Some captured replies carry citations only in their JSON. Keep that fallback,
// but a host mentioned in a query string or lookalike domain is not a receipt.
const groundingRedirect=(value:string)=>{
  const url=webUrl(value);
  return url?.protocol==='https:'&&url.hostname===GROUNDING_HOST&&!url.port
    &&/^\/grounding-api-redirect\/[^/]+/.test(url.pathname);
};

const dedupe=(sources:Array<{title?:unknown;url?:unknown}>)=>{
  const seen=new Set<string>(),kept:Array<{title:string;url:string}>=[];
  for(const source of sources){
    const url=typeof source?.url==='string'?source.url.trim():'';
    if(!webUrl(url)||seen.has(url))continue;
    seen.add(url);kept.push({title:String(source?.title||url).slice(0,300),url});
  }
  return kept.slice(0,12);
};

function metadataSources(payload:GeminiResponse){
  const chunks=payload.candidates?.[0]?.groundingMetadata?.groundingChunks??[];
  return dedupe(chunks.map(chunk=>({title:chunk.web?.title,url:chunk.web?.uri})));
}

/** Prefer usable provider metadata. Captured production replies sometimes put
 * all citations in JSON; dropping that fallback discarded real retrieved sources.
 * Accept only strict grounding redirects there, never arbitrary publisher URLs. */
function groundedSources(payload:GeminiResponse,fromReply:unknown){
  const metadata=metadataSources(payload);
  if(metadata.length)return metadata;
  return dedupe(Array.isArray(fromReply)?fromReply as Array<{title?:unknown;url?:unknown}>:[])
    .filter(source=>groundingRedirect(source.url));
}

const wasGrounded=(payload:GeminiResponse,sources:Array<{url:string}>)=>
  metadataSources(payload).length>0||sources.some(source=>groundingRedirect(source.url));

type Answer=ReturnType<typeof vintageWindowSchema.parse>;
type Billed={searchQueries:number;promptTokens:number;outputTokens:number};
/**
 * Enough about a refused reply to tell why, from the Worker log alone.
 *
 * AI Gateway stores no bodies unless payload logging is turned on, and turning
 * it on to catch an intermittent failure means keeping every research prompt
 * and answer outside D1 in the meantime. This is the cheap half of that: the
 * shape of what came back, and the first few hundred characters of it, only on
 * the calls that failed.
 */
type Detail=Record<string,unknown>;
type Attempt={model:string;billed:Billed|null;detail?:Detail}&
  ({ok:true;answer:Answer}|{ok:false;reason:string;error:Error});

/**
 * One model's go at the question.
 *
 * Every way this can fail returns rather than throws, because a failure here is
 * a reason to ask the other model rather than the end of the request - and
 * because the call still billed on its way to failing, which the caller has to
 * meter either way.
 */
async function ask(env:VintageWindowBindings,subject:VintageSubject,baseline:{from:number;to:number}|null,
  cell:VintageCell,model:string,requestId:string,timeoutMs:number,outputTokens:number):Promise<Attempt>{
  const vintage=subject.vintage as number;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  let billed:Billed|null=null;
  try{
    // The former manual developer-API request bypassed AI Gateway and had no
    // working credential on Vertex-only deployments. Shared transport selects the
    // configured endpoint and carries authorization, logging policy and tags.
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
    let answer:{sources?:unknown;quality?:unknown};
    try{answer=parseJson(text) as {sources?:unknown;quality?:unknown}}
    catch{
      const cut=candidate?.finishReason==='MAX_TOKENS';
      return {model,billed,detail,ok:false,reason:cut?'truncated':'unparseable',
        error:new Error(cut?'The vintage lookup ran out of room before it finished answering':'The vintage lookup did not come back as JSON')};
    }
    detail.replySources=Array.isArray(answer.sources)?answer.sources.length:0;
    detail.metadataSources=metadataSources(payload).length;
    detail.qualityDiscarded=answer.quality!=null&&!vintageQualitySchema.safeParse(answer.quality).success;
    const parsed=vintageWindowSchema.safeParse({...answer,sources:groundedSources(payload,answer.sources)});
    if(!parsed.success)return {model,billed,detail,ok:false,reason:'invalid-shape',
      error:new Error(`The vintage lookup came back in the wrong shape: ${parsed.error.issues.map(issue=>issue.message).join('; ')}`)};
    const sources=parsed.data.sources;
    detail.sources=sources.length;detail.redirects=sources.filter(source=>groundingRedirect(source.url)).length;
    detail.vintageScore=parsed.data.quality?.score??null;detail.confidence=parsed.data.quality?.confidence??null;
    if(!sources.length||!wasGrounded(payload,sources))return {model,billed,detail,ok:false,reason:'ungrounded',
      error:new Error('Nothing was retrieved for this vintage, so there is nothing to show')};
    return {model,billed,detail,ok:true,answer:parsed.data};
  }catch(e){
    return {model,billed,ok:false,reason:controller.signal.aborted?'timeout':'transport',
      error:e instanceof Error?e:new Error('The vintage lookup could not be made')};
  }finally{clearTimeout(timer)}
}

/**
 * What the call cost, recorded whether or not its answer was kept.
 *
 * A rejected answer is not a free one: the tokens were spent and the search
 * was run. Leaving those out is what would make the cheap-first pairing look
 * cheaper than it is, which is the one thing this panel must not do.
 *
 * The vintage cache key is also the stable target ID in the ledger. That lets
 * Insights resolve a successful run back to its region/vintage/style without
 * storing another copy of the label in every usage row.
 */
const meter=(env:VintageWindowBindings,owner:string,requestId:string,targetId:string,attempt:Attempt,units:number)=>
  attempt.billed?recordAiUsage(env,owner,{kind:'vintage_window',runId:requestId,targetId,model:attempt.model,requests:1,units,
    searchQueries:attempt.billed.searchQueries,promptTokens:attempt.billed.promptTokens,outputTokens:attempt.billed.outputTokens}):Promise.resolve();

export async function researchVintageWindow(env:VintageWindowBindings,owner:string,subject:VintageSubject,requestId:string){
  if(!askableVintage(subject))throw new Error('A vintage and a place are needed before a year can be looked up');
  const table=maturityFor(subject),vintage=subject.vintage as number;
  const baseline=table?{from:vintage+table.window.from,to:vintage+table.window.to}:null;
  const cell=vintageCell(subject);

  let attempt=await ask(env,subject,baseline,cell,MODEL,requestId,TIMEOUT_MS,OUTPUT_TOKENS);
  if(!attempt.ok){
    await meter(env,owner,requestId,cell.key,attempt,0);
    console.warn(JSON.stringify({event:'vintage-window-escalation',requestId,vintage,cell:cell.label,
      fromModel:MODEL,toModel:ESCALATION_MODEL,reason:attempt.reason,error:attempt.error.message,...attempt.detail}));
    const escalated=await ask(env,subject,baseline,cell,ESCALATION_MODEL,requestId,ESCALATION_TIMEOUT_MS,ESCALATION_OUTPUT_TOKENS);
    if(!escalated.ok){
      await meter(env,owner,requestId,cell.key,escalated,0);
      console.error(JSON.stringify({event:'vintage-window-refused',requestId,vintage,cell:cell.label,
        model:escalated.model,reason:escalated.reason,error:escalated.error.message,...escalated.detail}));
      throw escalated.error;
    }
    attempt=escalated;
  }
  console.log(JSON.stringify({event:'vintage-window-answered',requestId,vintage,cell:cell.label,
    model:attempt.model,escalated:attempt.model!==MODEL,sources:attempt.detail?.sources??null,
    redirects:attempt.detail?.redirects??null,vintageScore:attempt.detail?.vintageScore??null,
    confidence:attempt.detail?.confidence??null,replySources:attempt.detail?.replySources??null,
    metadataSources:attempt.detail?.metadataSources??null,qualityDiscarded:attempt.detail?.qualityDiscarded??false}));
  await meter(env,owner,requestId,cell.key,attempt,1);
  return writeVintageWindow(env.DB,owner,subject,attempt.answer,baseline,attempt.model);
}

export const cachedVintageWindow=(env:VintageWindowBindings,owner:string,subject:VintageSubject)=>
  readVintageWindow(env.DB,owner,subject);