import { AI_MODELS } from '../src/lib/ai/policy';
import { ApiError } from '../src/lib/credits/primitives';
import type { ProviderAuthorization } from '../src/lib/credits/provider';
import { geminiCallTokens,recordAiUsage,type AiUsageEnv } from '../src/lib/usage/aiUsage';
import { readTranslationReply,translationPrompt,translationResponseJsonSchema,translationSourceHash,type TranslationRequest } from '../src/lib/research/translation';
import { postGeminiGenerateContent,type GeminiTransportBindings } from './geminiTransport';

type Env=GeminiTransportBindings&AiUsageEnv&{CREDIT_CONTEXT?:ProviderAuthorization};
type GeminiPayload={candidates?:Array<{finishReason?:string;content?:{parts?:Array<{text?:string}>}}>;usageMetadata?:Parameters<typeof geminiCallTokens>[0]};
export type ResearchTranslation={lang:string;fields:Record<string,string>;model:string;createdAt:string};

const TIMEOUT_MS=90_000;
// Chinese runs to about one token per character, plus the bracketed English.
// The largest accepted request is 40,000 English characters.
const OUTPUT_TOKENS=32_768;

/** Free: a saved translation of exactly this English, or null. */
export async function readResearchTranslation(db:D1Database,request:TranslationRequest):Promise<ResearchTranslation|null>{
 const hash=await translationSourceHash(request.lang,request.fields);
 const row=await db.prepare('SELECT content_json,model,created_at FROM research_translations WHERE source_hash=? AND lang=?').bind(hash,request.lang).first<{content_json:string;model:string;created_at:string}>();
 if(!row)return null;
 try{return {lang:request.lang,fields:JSON.parse(row.content_json) as Record<string,string>,model:row.model,createdAt:row.created_at}}
 catch{return null}
}

/**
 * Saved translation first; otherwise one ungrounded model call, metered and saved.
 *
 * Members are refused before the provider is reached. Translation has no member
 * price yet, so their requests carry a CreditDenial and durableProvider would
 * refuse them anyway - this only turns that into a clear message.
 */
export async function translateResearch(env:Env,owner:string,request:TranslationRequest):Promise<ResearchTranslation&{cached:boolean}>{
 const saved=await readResearchTranslation(env.DB,request);
 if(saved)return {...saved,cached:true};
 if(env.CREDIT_CONTEXT&&'deny' in env.CREDIT_CONTEXT)throw new ApiError(403,'No Chinese translation has been made for this research yet. Only the account owner can create one.');
 const keys=Object.keys(request.fields),model=AI_MODELS.researchTranslation,runId=crypto.randomUUID();
 const body=JSON.stringify({contents:[{role:'user',parts:[{text:translationPrompt(request.fields)}]}],
  generationConfig:{temperature:0.2,responseMimeType:'application/json',responseJsonSchema:translationResponseJsonSchema(keys),maxOutputTokens:OUTPUT_TOKENS,thinkingConfig:{thinkingLevel:'low'}}});
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
 let payload:GeminiPayload;
 try{
  const {response}=await postGeminiGenerateContent(env,model,body,controller.signal,{kind:'research_translation',lang:request.lang,requestId:runId,model});
  if(!response.ok){await response.body?.cancel().catch(()=>{});throw new ApiError(502,`The translation could not be made (HTTP ${response.status}). Please try again.`)}
  try{payload=await response.json() as GeminiPayload}catch{throw new ApiError(502,'The translation came back unreadable. Please try again.')}
 }catch(error){
  if(controller.signal.aborted)throw new ApiError(504,'The translation took too long. Please try again.');
  throw error;
 }finally{clearTimeout(timer)}
 // Billed whether or not the reply is usable, so the spend card stays honest.
 await recordAiUsage(env,owner,{kind:'research_translation',runId,model,requests:1,units:1,...geminiCallTokens(payload.usageMetadata)});
 const candidate=payload.candidates?.[0],text=candidate?.content?.parts?.map(part=>part.text??'').join('')??'';
 const fields=readTranslationReply(text,keys);
 if(!fields)throw new ApiError(502,candidate?.finishReason==='MAX_TOKENS'?'The translation ran out of room before it finished. Please try again.':'The translation came back incomplete. Please try again.');
 const hash=await translationSourceHash(request.lang,request.fields),createdAt=new Date().toISOString();
 await env.DB.prepare(`INSERT INTO research_translations(source_hash,lang,content_json,model,created_by,created_at) VALUES(?,?,?,?,?,?)
  ON CONFLICT(source_hash,lang) DO UPDATE SET content_json=excluded.content_json,model=excluded.model,created_by=excluded.created_by,created_at=excluded.created_at`)
  .bind(hash,request.lang,JSON.stringify(fields),model,owner,createdAt).run();
 return {lang:request.lang,fields,model,createdAt,cached:false};
}
