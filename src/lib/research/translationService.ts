import { AI_MODELS } from '../ai/policy';
import { ApiError } from '../credits/primitives';
import type { ProviderAuthorization } from '../credits/provider';
import { geminiCallTokens,recordAiUsage,type AiUsageEnv,type AiUsageTier } from '../usage/aiUsage';
import { readTranslationReply,translationPrompt,translationResponseJsonSchema,translationTextHash,type TranslationLang,type TranslationRequest } from './translation';
import { postGeminiGenerateContent,resolveGeminiTransport,type GeminiTransportBindings } from '../../../worker/geminiTransport';

export type TranslationEnv=GeminiTransportBindings&AiUsageEnv&{CREDIT_CONTEXT?:ProviderAuthorization};
type GeminiPayload={candidates?:Array<{finishReason?:string;content?:{parts?:Array<{text?:string}>}}>;usageMetadata?:Parameters<typeof geminiCallTokens>[0]};
export type ResearchTranslation={lang:TranslationLang;fields:Record<string,string>};
/**
 * 'flex' is half price on Vertex and may queue for minutes, so it is for work
 * nobody is waiting on (translating existing research). The Developer API has
 * no flex tier: the call goes out at standard price and is metered as such.
 */
export type TranslationOptions={tier?:'standard'|'flex';runId?:string;targetId?:string|null;timeoutMs?:number};

// One model call per chunk. Chinese runs to about one token per character plus
// the bracketed English, well inside the output cap.
const AFTER_RUN_TIMEOUT_MS=45_000,CHUNK_CHARS=12_000,OUTPUT_TOKENS=32_768,STANDARD_TIMEOUT_MS=90_000,FLEX_TIMEOUT_MS=660_000,FLEX_SERVER_TIMEOUT_S=600;

const unique=(texts:string[])=>[...new Set(texts.map(text=>text.trim()).filter(Boolean))];

/** Free: the saved translation of each text that has one, keyed by the English. */
export async function savedTranslations(db:D1Database,lang:TranslationLang,texts:string[]):Promise<Map<string,string>>{
 const wanted=unique(texts),found=new Map<string,string>();if(!wanted.length)return found;
 const byHash=new Map<string,string>();for(const text of wanted)byHash.set(await translationTextHash(lang,text),text);
 const rows=await db.prepare('SELECT source_hash,content FROM research_translations WHERE lang=? AND source_hash IN (SELECT value FROM json_each(?))')
  .bind(lang,JSON.stringify([...byHash.keys()])).all<{source_hash:string;content:string}>();
 for(const row of rows.results){const text=byHash.get(row.source_hash);if(text)found.set(text,row.content)}
 return found;
}

function chunks(texts:string[]){
 const out:string[][]=[];let current:string[]=[],size=0;
 for(const text of texts){if(current.length&&size+text.length>CHUNK_CHARS){out.push(current);current=[];size=0}current.push(text);size+=text.length}
 if(current.length)out.push(current);
 return out;
}

async function translateChunk(env:TranslationEnv&{DB:D1Database},owner:string,lang:TranslationLang,texts:string[],options:TranslationOptions){
 const keys=texts.map((_,index)=>`t${index}`),fields=Object.fromEntries(keys.map((key,index)=>[key,texts[index]]));
 const model=AI_MODELS.researchTranslation,runId=options.runId??crypto.randomUUID();
 const flex=options.tier==='flex'&&resolveGeminiTransport(env)==='vertex-ai-gateway',tier:AiUsageTier=flex?'flex':'standard';
 const body=JSON.stringify({contents:[{role:'user',parts:[{text:translationPrompt(fields)}]}],
  generationConfig:{temperature:0.2,responseMimeType:'application/json',responseJsonSchema:translationResponseJsonSchema(keys),maxOutputTokens:OUTPUT_TOKENS,thinkingConfig:{thinkingLevel:'minimal'}}});
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),options.timeoutMs??(flex?FLEX_TIMEOUT_MS:STANDARD_TIMEOUT_MS));
 let payload:GeminiPayload;
 try{
  const {response}=await postGeminiGenerateContent(env,model,body,controller.signal,{kind:'research_translation',lang,requestId:runId,model},flex?{serviceTier:'flex',serverTimeoutSeconds:FLEX_SERVER_TIMEOUT_S}:{});
  if(!response.ok){await response.body?.cancel().catch(()=>{});throw new ApiError(502,`The translation could not be made (HTTP ${response.status}). Please try again.`)}
  try{payload=await response.json() as GeminiPayload}catch{throw new ApiError(502,'The translation came back unreadable. Please try again.')}
 }catch(error){
  if(controller.signal.aborted)throw new ApiError(504,'The translation took too long. Please try again.');
  throw error;
 }finally{clearTimeout(timer)}
 // Billed whether or not the reply is usable, so the spend card stays honest.
 await recordAiUsage(env,owner,{kind:'research_translation',runId,targetId:options.targetId??null,model,tier,requests:1,units:1,...geminiCallTokens(payload.usageMetadata)});
 const candidate=payload.candidates?.[0],text=candidate?.content?.parts?.map(part=>part.text??'').join('')??'';
 const reply=readTranslationReply(text,keys);
 if(!reply)throw new ApiError(502,candidate?.finishReason==='MAX_TOKENS'?'The translation ran out of room before it finished. Please try again.':'The translation came back incomplete. Please try again.');
 const createdAt=new Date().toISOString(),rows=await Promise.all(texts.map(async(source,index)=>({hash:await translationTextHash(lang,source),source,content:reply[keys[index]]})));
 await env.DB.batch(rows.map(row=>env.DB.prepare(`INSERT INTO research_translations(source_hash,lang,content,model,created_by,created_at) VALUES(?,?,?,?,?,?)
  ON CONFLICT(source_hash,lang) DO UPDATE SET content=excluded.content,model=excluded.model,created_by=excluded.created_by,created_at=excluded.created_at`)
  .bind(row.hash,lang,row.content,model,owner,createdAt)));
 return rows;
}

/**
 * Saved translations first; one model call per chunk of what is still missing.
 * Callers decide who may spend: this only refuses a context that can never
 * reach a provider.
 */
export async function translateTexts(env:TranslationEnv&{DB:D1Database},owner:string,lang:TranslationLang,texts:string[],options:TranslationOptions={}){
 const found=await savedTranslations(env.DB,lang,texts),missing=unique(texts).filter(text=>!found.has(text));
 for(const chunk of chunks(missing))for(const row of await translateChunk(env,owner,lang,chunk,options))found.set(row.source,row.content);
 return {translations:found,translatedCount:missing.length};
}

const byField=(request:TranslationRequest,translations:Map<string,string>)=>
 Object.fromEntries(Object.entries(request.fields).flatMap(([field,text])=>translations.has(text)?[[field,translations.get(text)!]]:[]));

/** Free: whichever sections of this research already have a translation. */
export async function readResearchTranslation(db:D1Database,request:TranslationRequest):Promise<ResearchTranslation>{
 return {lang:request.lang,fields:byField(request,await savedTranslations(db,request.lang,Object.values(request.fields)))};
}

/**
 * The owner's on-demand translation of whatever is still missing.
 *
 * Members are refused before the provider is reached. On-demand translation has
 * no member price, so their HTTP requests carry a CreditDenial and durableProvider
 * would refuse them anyway - this only turns that into a clear message. Members'
 * own research is translated inside the research run instead.
 */
export async function translateResearch(env:TranslationEnv&{DB:D1Database},owner:string,request:TranslationRequest):Promise<ResearchTranslation>{
 const saved=await savedTranslations(env.DB,request.lang,Object.values(request.fields));
 if(Object.values(request.fields).every(text=>saved.has(text)))return {lang:request.lang,fields:byField(request,saved)};
 if(env.CREDIT_CONTEXT&&'deny' in env.CREDIT_CONTEXT)throw new ApiError(403,'No Chinese translation has been made for this research yet. Only the account owner can create one.');
 const {translations}=await translateTexts(env,owner,request.lang,Object.values(request.fields));
 return {lang:request.lang,fields:byField(request,translations)};
}

/**
 * The last step of a Deep Search or producer research run: translate whatever
 * the run left untranslated, so 繁中 is ready the moment the research is.
 *
 * Best effort by design. The research is already saved and its run complete;
 * a translation that fails is logged and left for the owner to make on demand,
 * never a reason to fail or hold the research. It is also capped well short of
 * the on-demand timeout: a rare recovery can finish a run inside someone's HTTP
 * request (Check status, Cancel), and that request must not wait on Chinese.
 * It does not go through
 * the run's credit operation either - an uncertain send there would put a
 * finished Deep Search into review. The call is metered in the AI usage ledger
 * against the run's owner like the research itself, and a context that may
 * never reach a provider (cleanup) still never does.
 */
export async function translateResearchAfterRun(env:TranslationEnv&{DB:D1Database},owner:string,texts:Array<string|null|undefined>,options:TranslationOptions={}){
 if(env.CREDIT_CONTEXT&&'deny' in env.CREDIT_CONTEXT)return;
 const sources=unique(texts.filter((text):text is string=>typeof text==='string'));if(!sources.length)return;
 try{
  const {translatedCount}=await translateTexts({...env,CREDIT_CONTEXT:{exempt:true,reason:'Translation step of a research run'}},owner,'zh-Hant-HK',sources,{timeoutMs:AFTER_RUN_TIMEOUT_MS,...options});
  if(translatedCount)console.log(JSON.stringify({event:'research_translated',owner,targetId:options.targetId??null,runId:options.runId??null,sections:translatedCount}));
 }catch(error){
  console.warn(JSON.stringify({event:'research_translation_failed',owner,targetId:options.targetId??null,runId:options.runId??null,error:(error as Error).message}));
 }
}
