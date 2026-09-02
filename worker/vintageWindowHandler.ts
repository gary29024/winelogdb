import { geminiCallTokens,recordAiUsage,type AnalyticsSink } from '../src/lib/usage/aiUsage';
import { askableVintage,readVintageWindow,vintageWindowSchema,writeVintageWindow,type VintageSubject } from '../src/lib/maturity/vintageWindow';
import { maturityFor } from '../src/lib/maturity/ageing';
import { describeResponseSchema,groundedGenerationConfig } from '../src/lib/research/geminiBatch';

export type VintageWindowBindings={DB:D1Database;GEMINI_API_KEY:string;AI_USAGE?:AnalyticsSink};

/**
 * The model that answers this. The cheap one: the question is narrow, the
 * answer is four fields, and what costs money here is the search rather than
 * the thinking.
 */
const MODEL='gemini-3.1-flash-lite';
const TIMEOUT_MS=30_000;

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
  candidates?:Array<{content?:{parts?:Array<{text?:string}>};groundingMetadata?:{groundingChunks?:Array<{web?:{title?:string;uri?:string}}>}}>;
  usageMetadata?:{promptTokenCount?:number;candidatesTokenCount?:number;thoughtsTokenCount?:number};
};

const parseJson=(raw:string)=>JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g,''));

/**
 * What the search actually retrieved, as the sources shown on screen.
 *
 * Taken from the grounding metadata rather than from the model's own list: a
 * model asked for its sources will happily invent them, and the metadata is the
 * record of pages the tool really fetched.
 */
function groundedSources(payload:GeminiResponse){
  const chunks=payload.candidates?.[0]?.groundingMetadata?.groundingChunks??[];
  const seen=new Set<string>(),sources:Array<{title:string;url:string}>=[];
  for(const chunk of chunks){
    const url=chunk.web?.uri;if(!url||seen.has(url))continue;
    seen.add(url);sources.push({title:(chunk.web?.title||url).slice(0,300),url});
  }
  return sources.slice(0,12);
}

export async function researchVintageWindow(env:VintageWindowBindings,owner:string,subject:VintageSubject,requestId:string){
  if(!askableVintage(subject))throw new Error('A vintage and a place are needed before a year can be looked up');
  const table=maturityFor(subject),vintage=subject.vintage as number;
  const baseline=table?{from:vintage+table.window.from,to:vintage+table.window.to}:null;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try{
    const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,{
      method:'POST',signal:controller.signal,
      headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},
      body:JSON.stringify({
        contents:[{role:'user',parts:[{text:`${prompt(subject,baseline)}\n\n${describeResponseSchema(responseSchema)}`}]}],
        tools:[{google_search:{}}],
        generationConfig:groundedGenerationConfig(2048)
      })
    });
    if(!response.ok)throw new Error(`Vintage lookup failed (${response.status})`);
    const payload=await response.json() as GeminiResponse;
    const text=payload.candidates?.[0]?.content?.parts?.map(part=>part.text??'').join('')??'';
    if(!text)throw new Error('The vintage lookup came back empty');
    const parsed=vintageWindowSchema.parse({...parseJson(text),sources:groundedSources(payload)});
    // An answer nothing was retrieved for is a memory, not research, and this
    // whole feature exists so the two are told apart.
    if(!parsed.sources.length)throw new Error('Nothing was retrieved for this vintage, so there is nothing to show');
    const tokens=geminiCallTokens(payload.usageMetadata);
    await recordAiUsage(env,owner,{kind:'vintage_window',runId:requestId,model:MODEL,requests:1,units:1,
      searchQueries:1,promptTokens:tokens.promptTokens,outputTokens:tokens.outputTokens});
    return writeVintageWindow(env.DB,owner,subject,parsed,baseline,MODEL);
  }finally{clearTimeout(timer)}
}

export const cachedVintageWindow=(env:VintageWindowBindings,owner:string,subject:VintageSubject)=>
  readVintageWindow(env.DB,owner,subject);
