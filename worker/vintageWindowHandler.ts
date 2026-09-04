import { geminiCallTokens,recordAiUsage,type AnalyticsSink } from '../src/lib/usage/aiUsage';
import { askableVintage,readVintageWindow,vintageCell,vintageWindowSchema,writeVintageWindow,type VintageCell,type VintageSubject } from '../src/lib/maturity/vintageWindow';
import { maturityFor } from '../src/lib/maturity/ageing';
import { describeResponseSchema,groundedGenerationConfig } from '../src/lib/research/geminiBatch';
import { firstBalancedJsonObject } from '../src/lib/producers/structuredJson';
import { postGeminiGenerateContent,type GeminiTransportBindings } from './geminiTransport';

export type VintageWindowBindings=GeminiTransportBindings&{DB:D1Database;AI_USAGE?:AnalyticsSink};

/**
 * The cheap model first, the grounded paths' model only when it has to be.
 *
 * The question is narrow and the work is retrieval, not reasoning: the search
 * tool fetches the pages and the model reads three of them and returns two
 * integers and three sentences. Flash-lite is priced at a third of 3.8 Flash
 * per token and does not spend thinking tokens on top, which on a call this
 * shape is five to eight times cheaper.
 *
 * What argued against it was never the wine knowledge - it was whether it
 * would actually search, because an answer with no grounding receipt is
 * rejected outright below and a model that grounds unreliably spends the call
 * and returns nothing. That is a question with an answer rather than a reason
 * to pay: ask the cheap one, and where what comes back is not a grounded,
 * well-shaped answer, ask the expensive one once. The common case pays
 * flash-lite; 3.8 Flash is paid for only on the calls that would otherwise
 * have failed and returned nothing at all.
 *
 * Both attempts are metered under the one run, so the spend panel shows what
 * the pair cost and how often the second one is needed. If it never fires, the
 * escalation can go.
 */
const MODEL='gemini-3.1-flash-lite';
const ESCALATION_MODEL='gemini-3.8-flash';
/**
 * Grounded calls carry a search round trip before the model writes anything,
 * so the budget is the research paths' rather than a plain call's - but split
 * across the two attempts rather than doubled, because a person is waiting on
 * a button. Flash-lite does not think before it writes and gets the shorter
 * half; the escalation, which does, gets the longer one.
 */
const TIMEOUT_MS=30_000;
const ESCALATION_TIMEOUT_MS=45_000;
/**
 * Room to answer in, which is not the same as room to write in.
 *
 * Thinking tokens count against this cap as well as billing as output, so a
 * model that thinks before it writes can spend the whole budget on thoughts and
 * return a sentence cut off mid-object - which arrives here as a reply that is
 * not JSON. The answer itself is four fields and three sentences and never
 * needed two thousand; the escalation gets the larger share because it is the
 * one that thinks. Only tokens actually produced are billed, so a cap that is
 * never reached costs nothing.
 */
const OUTPUT_TOKENS=4096;
const ESCALATION_OUTPUT_TOKENS=8192;

const place=(subject:VintageSubject)=>[subject.appellation,subject.region,subject.country].filter(Boolean).join(', ');

/**
 * One question, asked once per region and vintage.
 *
 * It is told what the ageing table already says, and asked to say where the
 * year moves it and why - which is the only thing a search can add. Asking for
 * the window from scratch would spend a search re-deriving what a lookup
 * already knows.
 */
function prompt(subject:VintageSubject,baseline:{from:number;to:number}|null,cell:VintageCell){
  const where=place(subject),style=subject.wineStyle?`${subject.wineStyle} wine`:'wine';
  const usual=baseline?`Wines like this are usually worth drinking between ${baseline.from} and ${baseline.to}.`
    :'No typical window is known for this combination.';
  /**
   * Who the note is being written for, which is not always the bottle that
   * asked. A region cell is read by every wine of that style from that region,
   * so a note naming one vineyard would be wrong on all the others; a grand cru
   * cell is read only by that vineyard, and naming it is the point.
   */
  const kept=cell.scope==='appellation'
    ?`The note is kept for every ${style} of ${subject.vintage} from ${cell.label} itself, so write it about that vineyard in that year: what the season did there, and how the wines of ${cell.label} turned out. Name the vineyard and the year; do not name a producer or an estate.`
    :`The note is kept for every ${style} of ${subject.vintage} from ${cell.label}, not for the bottling named above, so write it about the growing season in ${cell.label}: name the year, and do not name a producer, an estate or a single vineyard in it.`;
  return `You must use the Google Search tool before answering, and every claim must come from a page you actually retrieved in this request. Do not answer from prior knowledge and do not reconstruct a plausible answer. If the search tool is unavailable or returns nothing usable about this vintage, return null for both years and say so in the note.

For ${style} from ${where}, vintage ${subject.vintage}: what is the drinking window, as calendar years?

${usual} Your job is the vintage: say where ${subject.vintage} sits against that, and why - growing season, harvest conditions, the structure of the wines. A cool or difficult year usually shortens the window; a great one lengthens it.

drinkFrom and drinkTo are calendar years, not ages, and they are for a wine of the kind described above rather than for the region's longest-lived bottling. Return null for both rather than guessing if no source discusses this vintage in this place.

${kept} Keep it to three sentences.`;
}

/**
 * Rendered into the prompt, never sent as a responseSchema.
 *
 * Google Search grounding and controlled generation cannot both be used on one
 * request: declaring the search tool alongside responseMimeType and a
 * responseSchema gets a well-formed JSON answer back with the grounding
 * silently dropped. This whole feature then rejects its own answer for having
 * no sources, which is exactly what it did - "nothing was retrieved for this
 * vintage", every time, because nothing ever was. geminiBatch documents the
 * same trap for the research paths; this is the same trap.
 */
const responseSchema={type:'OBJECT',properties:{
  drinkFrom:{type:'INTEGER',nullable:true},drinkTo:{type:'INTEGER',nullable:true},
  note:{type:'STRING'},
  sources:{type:'ARRAY',items:{type:'OBJECT',properties:{title:{type:'STRING'},url:{type:'STRING'}},required:['title','url']}}
},required:['drinkFrom','drinkTo','note','sources']};

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

/** A Vertex grounding redirect: the search tool's own receipt for a page. */
const GROUNDING_HOST='vertexaisearch.cloud.google.com';

const dedupe=(sources:Array<{title?:unknown;url?:unknown}>)=>{
  const seen=new Set<string>(),kept:Array<{title:string;url:string}>=[];
  for(const source of sources){
    const url=typeof source?.url==='string'?source.url.trim():'';
    if(!url||seen.has(url))continue;
    seen.add(url);
    kept.push({title:String(source?.title||url).slice(0,300),url});
  }
  return kept.slice(0,12);
};

/**
 * The pages the search actually fetched.
 *
 * Grounding metadata is the authoritative record and is preferred whenever the
 * reply carries it. It often does not: on this endpoint the citations come back
 * inside the model's own JSON, as vertexaisearch grounding-redirect links -
 * which are issued by the search tool and are therefore a receipt rather than a
 * claim, whatever the model says about them.
 *
 * Reading only the metadata is what made this feature report "nothing was
 * retrieved" for answers that had plainly retrieved three sources: the list was
 * overwritten with an empty one and the answer thrown away.
 */
function groundedSources(payload:GeminiResponse,fromReply:unknown){
  const chunks=payload.candidates?.[0]?.groundingMetadata?.groundingChunks??[];
  const metadata=dedupe(chunks.map(chunk=>({title:chunk.web?.title,url:chunk.web?.uri})));
  if(metadata.length)return metadata;
  return dedupe(Array.isArray(fromReply)?fromReply as Array<{title?:unknown;url?:unknown}>:[]);
}

/** Whether anything here came from the search tool rather than from memory. */
const wasGrounded=(payload:GeminiResponse,sources:Array<{url:string}>)=>
  Boolean(payload.candidates?.[0]?.groundingMetadata?.groundingChunks?.length)
  ||sources.some(source=>source.url.includes(GROUNDING_HOST));

type Answer=ReturnType<typeof vintageWindowSchema.parse>;
/** What one call billed, whether or not its answer turned out to be usable. */
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
    /**
     * Through the same transport as every other call in the app.
     *
     * This handler posted to generativelanguage.googleapis.com by hand, which
     * is the one path that never reaches AI Gateway - so the lookup was
     * invisible there, and on a deployment configured for Vertex through the
     * gateway it had no working credential at all. postGeminiGenerateContent
     * decides between the gateway and the developer API from what is actually
     * configured, and carries the authorization, the payload-logging rule and
     * the request tagging with it.
     */
    const {response}=await postGeminiGenerateContent(env,model,JSON.stringify({
      contents:[{role:'user',parts:[{text:`${prompt(subject,baseline,cell)}\n\n${describeResponseSchema(responseSchema)}`}]}],
      tools:[{google_search:{}}],
      generationConfig:groundedGenerationConfig(outputTokens)
    }),controller.signal,{kind:'vintage_window',vintage,requestId,model});
    if(!response.ok){
      const detail=(await response.text().catch(()=>'')).slice(0,400);
      return {model,billed,detail:{status:response.status,body:detail.slice(0,300)},ok:false,reason:`http-${response.status}`,
        error:new Error(`Vintage lookup failed (${response.status})${detail?`: ${detail}`:''}`)};
    }
    const payload=await response.json() as GeminiResponse;
    const tokens=geminiCallTokens(payload.usageMetadata);
    billed={
      // The searches the model actually ran, not an assumed one. Grounding is
      // billed per query and it is most of what this costs, so guessing here
      // would misprice the panel that exists to say what it cost.
      searchQueries:payload.candidates?.[0]?.groundingMetadata?.webSearchQueries?.length??1,
      promptTokens:tokens.promptTokens,outputTokens:tokens.outputTokens
    };
    const candidate=payload.candidates?.[0];
    const text=candidate?.content?.parts?.map(part=>part.text??'').join('')??'';
    const detail:Detail={finishReason:candidate?.finishReason??null,
      metadataChunks:candidate?.groundingMetadata?.groundingChunks?.length??0,
      searchQueries:billed.searchQueries,replyChars:text.length,reply:text.slice(0,300)};
    if(!text)return {model,billed,detail,ok:false,reason:'empty',error:new Error('The vintage lookup came back empty')};
    let answer:{sources?:unknown};
    // A weaker model garbling the JSON is the risk that comes with a weaker
    // model, so it is a reason to escalate rather than a 500.
    try{answer=parseJson(text) as {sources?:unknown}}
    catch{
      // Told apart because they need different answers: a truncated reply wants
      // more room, and an unreadable one wants a different model.
      const cut=candidate?.finishReason==='MAX_TOKENS';
      return {model,billed,detail,ok:false,reason:cut?'truncated':'unparseable',
        error:new Error(cut?'The vintage lookup ran out of room before it finished answering'
          :'The vintage lookup did not come back as JSON')};
    }
    const parsed=vintageWindowSchema.safeParse({...answer,sources:groundedSources(payload,answer.sources)});
    if(!parsed.success)return {model,billed,detail,ok:false,reason:'invalid-shape',
      error:new Error(`The vintage lookup came back in the wrong shape: ${parsed.error.issues.map(issue=>issue.message).join('; ')}`)};
    // An answer nothing was retrieved for is a memory, not research, and this
    // whole feature exists so the two are told apart.
    // Counted apart from the sources themselves: a reply with five citations
    // and no redirect among them is a model citing its own memory, and the log
    // has to say which of the two happened.
    const sources=parsed.data.sources;
    detail.sources=sources.length;
    detail.redirects=sources.filter(source=>source.url.includes(GROUNDING_HOST)).length;
    if(!sources.length||!wasGrounded(payload,sources))
      return {model,billed,detail,ok:false,reason:'ungrounded',
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
 */
const meter=(env:VintageWindowBindings,owner:string,requestId:string,attempt:Attempt,units:number)=>
  attempt.billed
    ?recordAiUsage(env,owner,{kind:'vintage_window',runId:requestId,model:attempt.model,requests:1,units,
      searchQueries:attempt.billed.searchQueries,
      promptTokens:attempt.billed.promptTokens,outputTokens:attempt.billed.outputTokens})
    :Promise.resolve();

export async function researchVintageWindow(env:VintageWindowBindings,owner:string,subject:VintageSubject,requestId:string){
  if(!askableVintage(subject))throw new Error('A vintage and a place are needed before a year can be looked up');
  const table=maturityFor(subject),vintage=subject.vintage as number;
  const baseline=table?{from:vintage+table.window.from,to:vintage+table.window.to}:null;
  /**
   * The cell the answer is filed under, which is what the note has to be about.
   *
   * A village Gevrey and a premier cru beside it are one Burgundy 2011 and
   * share an answer, so a note naming one vineyard would be wrong on the other.
   * A named grand cru is its own cell and its own answer, so there the vineyard
   * is exactly what the note should be about.
   */
  const cell=vintageCell(subject);

  let attempt=await ask(env,subject,baseline,cell,MODEL,requestId,TIMEOUT_MS,OUTPUT_TOKENS);
  if(!attempt.ok){
    await meter(env,owner,requestId,attempt,0);
    // Everything needed to tell why, in the Worker log rather than in the
    // gateway's - which stores no bodies unless payload logging is on, and
    // turning that on to catch this would keep every research prompt and answer
    // outside D1 in the meantime.
    console.warn(JSON.stringify({event:'vintage-window-escalation',requestId,vintage,cell:cell.label,
      fromModel:MODEL,toModel:ESCALATION_MODEL,reason:attempt.reason,error:attempt.error.message,...attempt.detail}));
    const escalated=await ask(env,subject,baseline,cell,ESCALATION_MODEL,requestId,ESCALATION_TIMEOUT_MS,ESCALATION_OUTPUT_TOKENS);
    // Both models refused, so the reader gets the stronger one's reason: it is
    // the more informative of the two and the one that was asked last.
    if(!escalated.ok){
      await meter(env,owner,requestId,escalated,0);
      console.error(JSON.stringify({event:'vintage-window-refused',requestId,vintage,cell:cell.label,
        model:escalated.model,reason:escalated.reason,error:escalated.error.message,...escalated.detail}));
      throw escalated.error;
    }
    attempt=escalated;
  }
  // Which model actually answered, so the escalation rate is countable from the
  // log as well as from requests against runs on the spend panel.
  console.log(JSON.stringify({event:'vintage-window-answered',requestId,vintage,cell:cell.label,
    model:attempt.model,escalated:attempt.model!==MODEL,
    sources:attempt.detail?.sources??null,redirects:attempt.detail?.redirects??null}));
  await meter(env,owner,requestId,attempt,1);
  return writeVintageWindow(env.DB,owner,subject,attempt.answer,baseline,attempt.model);
}

export const cachedVintageWindow=(env:VintageWindowBindings,owner:string,subject:VintageSubject)=>
  readVintageWindow(env.DB,owner,subject);
