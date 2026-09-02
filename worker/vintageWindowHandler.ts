import { geminiCallTokens,recordAiUsage,type AnalyticsSink } from '../src/lib/usage/aiUsage';
import { askableVintage,readVintageWindow,vintageWindowSchema,writeVintageWindow,type VintageSubject } from '../src/lib/maturity/vintageWindow';
import { maturityFor } from '../src/lib/maturity/ageing';
import { describeResponseSchema,groundedGenerationConfig } from '../src/lib/research/geminiBatch';
import { postGeminiGenerateContent,type GeminiTransportBindings } from './geminiTransport';

export type VintageWindowBindings=GeminiTransportBindings&{DB:D1Database;AI_USAGE?:AnalyticsSink};

/**
 * The model the grounded paths use, not the cheap one.
 *
 * The question is narrow and the answer is four fields, which argued for
 * flash-lite - but what matters here is whether the model actually searches,
 * and grounding is what producer and wine research chose 3.7 Flash for. An
 * answer that arrives without sources is rejected outright by this handler, so
 * a model that grounds unreliably does not save money: it spends a call and
 * returns nothing.
 */
const MODEL='gemini-3.7-flash';
// Grounded calls carry a search round trip before the model writes anything,
// so the budget is the research paths' rather than a plain call's.
const TIMEOUT_MS=45_000;

const place=(subject:VintageSubject)=>[subject.appellation,subject.region,subject.country].filter(Boolean).join(', ');

/**
 * One question, asked once per region and vintage.
 *
 * It is told what the ageing table already says, and asked to say where the
 * year moves it and why - which is the only thing a search can add. Asking for
 * the window from scratch would spend a search re-deriving what a lookup
 * already knows.
 */
function prompt(subject:VintageSubject,baseline:{from:number;to:number}|null){
  const where=place(subject),style=subject.wineStyle?`${subject.wineStyle} wine`:'wine';
  const usual=baseline?`Wines like this are usually worth drinking between ${baseline.from} and ${baseline.to}.`
    :'No typical window is known for this combination.';
  return `You must use the Google Search tool before answering, and every claim must come from a page you actually retrieved in this request. Do not answer from prior knowledge and do not reconstruct a plausible answer. If the search tool is unavailable or returns nothing usable about this vintage, return null for both years and say so in the note.

For ${style} from ${where}, vintage ${subject.vintage}: what is the drinking window, as calendar years?

${usual} Your job is the vintage: say where ${subject.vintage} sits against that, and why - growing season, harvest conditions, the structure of the wines. A cool or difficult year usually shortens the window; a great one lengthens it.

drinkFrom and drinkTo are calendar years, not ages, and they are for a wine of the kind described above rather than for the region's longest-lived bottling. Return null for both rather than guessing if no source discusses this vintage in this place. Keep the note to three sentences, and name the year explicitly rather than writing about the region in general.`;
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
  candidates?:Array<{content?:{parts?:Array<{text?:string}>};groundingMetadata?:{
    groundingChunks?:Array<{web?:{title?:string;uri?:string}}>;webSearchQueries?:string[]}}>;
  usageMetadata?:{promptTokenCount?:number;candidatesTokenCount?:number;thoughtsTokenCount?:number};
};

const parseJson=(raw:string)=>JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g,''));

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

export async function researchVintageWindow(env:VintageWindowBindings,owner:string,subject:VintageSubject,requestId:string){
  if(!askableVintage(subject))throw new Error('A vintage and a place are needed before a year can be looked up');
  const table=maturityFor(subject),vintage=subject.vintage as number;
  const baseline=table?{from:vintage+table.window.from,to:vintage+table.window.to}:null;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
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
    const {response}=await postGeminiGenerateContent(env,MODEL,JSON.stringify({
      contents:[{role:'user',parts:[{text:`${prompt(subject,baseline)}\n\n${describeResponseSchema(responseSchema)}`}]}],
      tools:[{google_search:{}}],
      generationConfig:groundedGenerationConfig(2048)
    }),controller.signal,{kind:'vintage_window',vintage,requestId});
    if(!response.ok){
      const detail=(await response.text().catch(()=>'')).slice(0,400);
      throw new Error(`Vintage lookup failed (${response.status})${detail?`: ${detail}`:''}`);
    }
    const payload=await response.json() as GeminiResponse;
    const text=payload.candidates?.[0]?.content?.parts?.map(part=>part.text??'').join('')??'';
    if(!text)throw new Error('The vintage lookup came back empty');
    const answer=parseJson(text) as {sources?:unknown};
    const parsed=vintageWindowSchema.parse({...answer,sources:groundedSources(payload,answer.sources)});
    // An answer nothing was retrieved for is a memory, not research, and this
    // whole feature exists so the two are told apart.
    if(!parsed.sources.length||!wasGrounded(payload,parsed.sources))
      throw new Error('Nothing was retrieved for this vintage, so there is nothing to show');
    const tokens=geminiCallTokens(payload.usageMetadata);
    await recordAiUsage(env,owner,{kind:'vintage_window',runId:requestId,model:MODEL,requests:1,units:1,
      // The searches the model actually ran, not an assumed one. Grounding is
      // billed per query and it is most of what this costs, so guessing here
      // would misprice the panel that exists to say what it cost.
      searchQueries:payload.candidates?.[0]?.groundingMetadata?.webSearchQueries?.length??1,
      promptTokens:tokens.promptTokens,outputTokens:tokens.outputTokens});
    return writeVintageWindow(env.DB,owner,subject,parsed,baseline,MODEL);
  }finally{clearTimeout(timer)}
}

export const cachedVintageWindow=(env:VintageWindowBindings,owner:string,subject:VintageSubject)=>
  readVintageWindow(env.DB,owner,subject);
