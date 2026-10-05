import { afterEach,describe,expect,it,vi } from 'vitest';
import { realD1 } from './support/realD1';
import { readTranslationReply,translationPrompt,translationRequestSchema,translationSourceHash } from '../../src/lib/research/translation';
import { readResearchTranslation,translateResearch } from '../../worker/researchTranslation';
import { deepResearchText } from '../../src/features/wines/researchSections';
import { DEEP_FIELD_LABELS_ZH } from '../../src/features/wines/researchTranslation';
import { DEEP_FIELDS } from '../../src/features/wines/researchSections';
import app from '../../worker/cuveeEntry';
import { createSession } from '../../src/lib/auth/session';

const SECRET='test-secret-test-secret-test-secret';
const request=(fields:Record<string,string>)=>translationRequestSchema.parse({lang:'zh-Hant-HK',fields});
const english={summary:'A Pinot Noir from a Grand Cru site.',terroir:'Limestone and clay.'};
const chinese={summary:'來自特級園 (Grand Cru) 的黑皮諾 (Pinot Noir)。',terroir:'石灰岩 (limestone) 與黏土 (clay)。'};

function geminiReply(body:unknown,usage={promptTokenCount:900,candidatesTokenCount:600}){
 return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:typeof body==='string'?body:JSON.stringify(body)}]}}],usageMetadata:usage}),{status:200,headers:{'Content-Type':'application/json'}});
}
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks()});

describe('translation request',()=>{
 it('drops empty sections and trims the rest',()=>{
  expect(request({summary:'  Text  ',terroir:'   ',drinkingWindow:''}).fields).toEqual({summary:'Text'});
 });
 it('refuses nothing to translate, odd keys and oversized research',()=>{
  expect(translationRequestSchema.safeParse({lang:'zh-Hant-HK',fields:{summary:'  '}}).success).toBe(false);
  expect(translationRequestSchema.safeParse({lang:'zh-Hant-HK',fields:{'bad key':'x'}}).success).toBe(false);
  expect(translationRequestSchema.safeParse({lang:'fr',fields:{summary:'x'}}).success).toBe(false);
  const huge=Object.fromEntries(Array.from({length:8},(_,i)=>[`f${i}`,'x'.repeat(6000)]));
  expect(translationRequestSchema.safeParse({lang:'zh-Hant-HK',fields:huge}).success).toBe(false);
 });
 it('files a translation under the text, not the order it was sent in',async()=>{
  const a=await translationSourceHash('zh-Hant-HK',{summary:'A',terroir:'B'}),b=await translationSourceHash('zh-Hant-HK',{terroir:'B',summary:'A'});
  expect(a).toBe(b);
  expect(await translationSourceHash('zh-Hant-HK',{summary:'A',terroir:'C'})).not.toBe(a);
 });
 it('asks for Hong Kong Traditional Chinese with English kept for names and terms',()=>{
  const prompt=translationPrompt(english);
  expect(prompt).toContain('Hong Kong');
  expect(prompt).toContain('黑皮諾 (Pinot Noir)');
  expect(prompt).toMatch(/Keep producer names.*exactly as written in English/);
  expect(prompt).toContain(JSON.stringify(english));
 });
 it('accepts only a reply with every section filled in',()=>{
  expect(readTranslationReply(JSON.stringify(chinese),['summary','terroir'])).toEqual(chinese);
  expect(readTranslationReply('```json\n'+JSON.stringify(chinese)+'\n```',['summary','terroir'])).toEqual(chinese);
  expect(readTranslationReply(JSON.stringify({summary:chinese.summary}),['summary','terroir'])).toBeNull();
  expect(readTranslationReply(JSON.stringify({...chinese,terroir:' '}),['summary','terroir'])).toBeNull();
  expect(readTranslationReply('not json',['summary'])).toBeNull();
 });
 it('has a Chinese heading for every Deep Search section and sends every section',()=>{
  for(const field of DEEP_FIELDS)expect(DEEP_FIELD_LABELS_ZH[field]).toBeTruthy();
  expect(Object.keys(deepResearchText(null))).toEqual(DEEP_FIELDS);
 });
});

describe('translateResearch',()=>{
 it('translates once, meters the call, and serves the saved copy after that',async()=>{
  const d=realD1(),fetch=vi.fn(async()=>geminiReply(chinese));vi.stubGlobal('fetch',fetch);
  const env={DB:d.db,GEMINI_API_KEY:'key',CREDIT_CONTEXT:{exempt:true as const,reason:'owner'}};
  expect(await readResearchTranslation(d.db,request(english))).toBeNull();
  const first=await translateResearch(env,'owner',request(english));
  expect(first).toMatchObject({cached:false,fields:chinese,model:'gemini-3.8-flash'});
  const sent=JSON.parse(String((fetch.mock.calls[0] as unknown as [string,RequestInit])[1].body));
  expect(sent.tools).toBeUndefined();
  expect(sent.generationConfig.responseJsonSchema.required).toEqual(['summary','terroir']);
  expect(d.sql.prepare("SELECT kind,requests,prompt_tokens,output_tokens FROM ai_usage_events").all()).toEqual([{kind:'research_translation',requests:1,prompt_tokens:900,output_tokens:600}]);
  const again=await translateResearch(env,'owner',request({terroir:english.terroir,summary:english.summary}));
  expect(again).toMatchObject({cached:true,fields:chinese});
  expect(fetch).toHaveBeenCalledTimes(1);
 });
 it('does not reuse a translation once the English changes',async()=>{
  const d=realD1();vi.stubGlobal('fetch',vi.fn(async()=>geminiReply(chinese)));
  await translateResearch({DB:d.db,GEMINI_API_KEY:'key'},'owner',request(english));
  expect(await readResearchTranslation(d.db,request({...english,terroir:'Limestone, clay and marl.'}))).toBeNull();
 });
 it('lets a member read a saved translation but never reach the provider for a new one',async()=>{
  const d=realD1();vi.stubGlobal('fetch',vi.fn(async()=>geminiReply(chinese)));
  const member={DB:d.db,GEMINI_API_KEY:'key',CREDIT_CONTEXT:{deny:true as const,reason:'unpriced'}};
  await expect(translateResearch(member,'viewer',request(english))).rejects.toMatchObject({status:403});
  expect(fetch).not.toHaveBeenCalled();
  await translateResearch({DB:d.db,GEMINI_API_KEY:'key'},'owner',request(english));
  expect(await translateResearch(member,'viewer',request(english))).toMatchObject({cached:true,fields:chinese});
 });
 it('meters an incomplete reply but saves nothing from it',async()=>{
  const d=realD1();vi.stubGlobal('fetch',vi.fn(async()=>geminiReply({summary:chinese.summary})));
  await expect(translateResearch({DB:d.db,GEMINI_API_KEY:'key'},'owner',request(english))).rejects.toMatchObject({status:502});
  expect(d.sql.prepare('SELECT COUNT(*) AS n FROM research_translations').get()).toEqual({n:0});
  expect(d.sql.prepare("SELECT COUNT(*) AS n FROM ai_usage_events WHERE kind='research_translation'").get()).toEqual({n:1});
 });
 it('reports a provider failure without saving',async()=>{
  const d=realD1();vi.stubGlobal('fetch',vi.fn(async()=>new Response('busy',{status:503})));
  await expect(translateResearch({DB:d.db,GEMINI_API_KEY:'key'},'owner',request(english))).rejects.toMatchObject({status:502});
  expect(d.sql.prepare('SELECT COUNT(*) AS n FROM research_translations').get()).toEqual({n:0});
 });
});

describe('translation routes',()=>{
 const call=async(env:Record<string,unknown>,path:string,body:unknown,user:string|null='owner')=>app.fetch(new Request(`https://x${path}`,{method:'POST',
  headers:{'Content-Type':'application/json',...user?{Authorization:`Bearer ${await createSession(user,SECRET)}`}:{}},body:JSON.stringify(body)}),{AUTH_SECRET:SECRET,...env} as never,{} as never);
 it('needs a session and a valid request',async()=>{
  const d=realD1();
  expect((await call({DB:d.db},'/api/research/translation/lookup',{lang:'zh-Hant-HK',fields:english},null)).status).toBe(401);
  expect((await call({DB:d.db},'/api/research/translation/lookup',{lang:'zh-Hant-HK',fields:{summary:''}})).status).toBe(400);
 });
 it('looks up for free and translates on request',async()=>{
  const d=realD1(),fetch=vi.fn(async()=>geminiReply(chinese));vi.stubGlobal('fetch',fetch);
  const env={DB:d.db,GEMINI_API_KEY:'key'};
  expect(await (await call(env,'/api/research/translation/lookup',{lang:'zh-Hant-HK',fields:english})).json()).toEqual({translation:null});
  expect(fetch).not.toHaveBeenCalled();
  const made=await call(env,'/api/research/translation',{lang:'zh-Hant-HK',fields:english});
  expect(made.status).toBe(200);
  expect((await made.json() as {translation:{fields:unknown}}).translation.fields).toEqual(chinese);
  expect(await (await call(env,'/api/research/translation/lookup',{lang:'zh-Hant-HK',fields:english},'viewer')).json()).toMatchObject({translation:{fields:chinese}});
 });
 it('tells a member why they cannot make one',async()=>{
  const d=realD1();vi.stubGlobal('fetch',vi.fn());
  const response=await call({DB:d.db,GEMINI_API_KEY:'key',CREDIT_CONTEXT:{deny:true,reason:'unpriced'}},'/api/research/translation',{lang:'zh-Hant-HK',fields:english},'viewer');
  expect(response.status).toBe(403);
  expect((await response.json() as {error:string}).error).toMatch(/Only the account owner/);
 });
});
