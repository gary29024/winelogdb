import { afterEach,describe,expect,it,vi } from 'vitest';
import { realD1 } from './support/realD1';
import { readTranslationReply,translationPrompt,translationRequestSchema,translationTextHash } from '../../src/lib/research/translation';
import { readResearchTranslation,translateResearch,translateResearchAfterRun,translateTexts } from '../../src/lib/research/translationService';
import { processRolloutJob,rolloutRoute,rolloutStatus } from '../../worker/multiUser/rollout';
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
/** A model that translates each section it is sent by looking it up here. */
const dictionary:Record<string,string>={[english.summary]:chinese.summary,[english.terroir]:chinese.terroir,'A family domaine.':'一個家族酒莊。','Careful sorting.':'仔細揀選 (sorting)。'};
const sentFields=(call:unknown[])=>JSON.parse(JSON.parse(String((call[1] as RequestInit).body)).contents[0].parts[0].text.split('Input:\n')[1]) as Record<string,string>;
function translatingModel(){
 return vi.fn(async(_url:string,init:RequestInit)=>{
  const fields=sentFields([_url,init]);
  return geminiReply(Object.fromEntries(Object.entries(fields).map(([key,text])=>[key,dictionary[text]??`譯：${text}`])));
 });
}

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
 it('files each section under its own text, whatever field it is shown in',async()=>{
  expect(await translationTextHash('zh-Hant-HK',' A ')).toBe(await translationTextHash('zh-Hant-HK','A'));
  expect(await translationTextHash('zh-Hant-HK','A')).not.toBe(await translationTextHash('zh-Hant-HK','B'));
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
  const d=realD1(),fetch=translatingModel();vi.stubGlobal('fetch',fetch);
  const env={DB:d.db,GEMINI_API_KEY:'key',CREDIT_CONTEXT:{exempt:true as const,reason:'owner'}};
  expect(await readResearchTranslation(d.db,request(english))).toEqual({lang:'zh-Hant-HK',fields:{}});
  expect(await translateResearch(env,'owner',request(english))).toEqual({lang:'zh-Hant-HK',fields:chinese});
  const sent=JSON.parse(String((fetch.mock.calls[0] as unknown as [string,RequestInit])[1].body));
  expect(sent.tools).toBeUndefined();
  expect(sent.generationConfig.responseJsonSchema.required).toEqual(['t0','t1']);
  expect(d.sql.prepare("SELECT kind,tier,requests,prompt_tokens,output_tokens FROM ai_usage_events").all()).toEqual([{kind:'research_translation',tier:'standard',requests:1,prompt_tokens:900,output_tokens:600}]);
  expect(await translateResearch(env,'owner',request({terroir:english.terroir,summary:english.summary}))).toEqual({lang:'zh-Hant-HK',fields:chinese});
  expect(fetch).toHaveBeenCalledTimes(1);
 });
 it('reuses a section wherever its text appears and translates only what is new',async()=>{
  const d=realD1(),fetch=translatingModel();vi.stubGlobal('fetch',fetch);
  const env={DB:d.db,GEMINI_API_KEY:'key'};
  await translateResearch(env,'owner',request(english));
  // Another wine from the same producer: same terroir text, new summary.
  expect(await readResearchTranslation(d.db,request({summary:'Another cuvée.',terroir:english.terroir}))).toEqual({lang:'zh-Hant-HK',fields:{terroir:chinese.terroir}});
  // The producer page shows the same text under a different field name.
  expect(await readResearchTranslation(d.db,request({profile:english.terroir}))).toEqual({lang:'zh-Hant-HK',fields:{profile:chinese.terroir}});
  await translateResearch(env,'owner',request({summary:'Another cuvée.',terroir:english.terroir}));
  expect(sentFields(fetch.mock.calls[1] as unknown[])).toEqual({t0:'Another cuvée.'});
 });
 it('lets a member read a saved translation but never reach the provider for a new one',async()=>{
  const d=realD1(),fetch=translatingModel();vi.stubGlobal('fetch',fetch);
  const member={DB:d.db,GEMINI_API_KEY:'key',CREDIT_CONTEXT:{deny:true as const,reason:'unpriced'}};
  await expect(translateResearch(member,'viewer',request(english))).rejects.toMatchObject({status:403});
  expect(fetch).not.toHaveBeenCalled();
  await translateResearch({DB:d.db,GEMINI_API_KEY:'key'},'owner',request(english));
  expect(await translateResearch(member,'viewer',request(english))).toEqual({lang:'zh-Hant-HK',fields:chinese});
 });
 it('meters an incomplete reply but saves nothing from it',async()=>{
  const d=realD1();vi.stubGlobal('fetch',vi.fn(async()=>geminiReply({t0:chinese.summary})));
  await expect(translateResearch({DB:d.db,GEMINI_API_KEY:'key'},'owner',request(english))).rejects.toMatchObject({status:502});
  expect(d.sql.prepare('SELECT COUNT(*) AS n FROM research_translations').get()).toEqual({n:0});
  expect(d.sql.prepare("SELECT COUNT(*) AS n FROM ai_usage_events WHERE kind='research_translation'").get()).toEqual({n:1});
 });
 it('reports a provider failure without saving',async()=>{
  const d=realD1();vi.stubGlobal('fetch',vi.fn(async()=>new Response('busy',{status:503})));
  await expect(translateResearch({DB:d.db,GEMINI_API_KEY:'key'},'owner',request(english))).rejects.toMatchObject({status:502});
  expect(d.sql.prepare('SELECT COUNT(*) AS n FROM research_translations').get()).toEqual({n:0});
 });
 it('splits a long translation into several calls',async()=>{
  const d=realD1(),fetch=translatingModel();vi.stubGlobal('fetch',fetch);
  const texts=Array.from({length:5},(_,i)=>`${i} ${'x'.repeat(5000)}`);
  const {translations,translatedCount}=await translateTexts({DB:d.db,GEMINI_API_KEY:'key'},'owner','zh-Hant-HK',texts);
  expect(translatedCount).toBe(5);expect(translations.size).toBe(5);
  expect(fetch.mock.calls.length).toBeGreaterThan(1);
 });
});

describe('translation as the last step of a research run',()=>{
 it('translates a member run too, metered to that member, outside the run’s credit operation',async()=>{
  const d=realD1(),fetch=translatingModel();vi.stubGlobal('fetch',fetch);
  const run={DB:d.db,GEMINI_API_KEY:'key',CREDIT_CONTEXT:{db:d.db,operationId:'op-1',namespace:'queue'}};
  await translateResearchAfterRun(run,'viewer',[english.summary,'',null,english.terroir,english.summary],{runId:'run-1',targetId:'w1'});
  expect(await readResearchTranslation(d.db,request(english))).toEqual({lang:'zh-Hant-HK',fields:chinese});
  expect(d.sql.prepare('SELECT owner_id,run_id,target_id FROM ai_usage_events').all()).toEqual([{owner_id:'viewer',run_id:'run-1',target_id:'w1'}]);
  expect(d.sql.prepare('SELECT COUNT(*) AS n FROM provider_operations').get()).toEqual({n:0});
  // A re-delivered run finds everything saved and spends nothing.
  await translateResearchAfterRun(run,'viewer',[english.summary,english.terroir]);
  expect(fetch).toHaveBeenCalledTimes(1);
 });
 it('never fails the run, and never reaches a provider from a context that may not',async()=>{
  const d=realD1();vi.stubGlobal('fetch',vi.fn(async()=>new Response('down',{status:500})));
  vi.spyOn(console,'warn').mockImplementation(()=>undefined);
  await expect(translateResearchAfterRun({DB:d.db,GEMINI_API_KEY:'key'},'owner',[english.summary])).resolves.toBeUndefined();
  const blocked=vi.fn();vi.stubGlobal('fetch',blocked);
  await translateResearchAfterRun({DB:d.db,GEMINI_API_KEY:'key',CREDIT_CONTEXT:{deny:true,reason:'cleanup'}},'owner',[english.summary]);
  expect(blocked).not.toHaveBeenCalled();
 });
});

describe('translating existing research',()=>{
 it('works through producers in the background, skipping what is already translated',async()=>{
  const d=realD1(),fetch=translatingModel();vi.stubGlobal('fetch',fetch);
  d.sql.exec(`INSERT INTO producers(id,owner_id,canonical_name,match_key,profile,winemaking_practices,created_at,updated_at) VALUES
   ('p1','owner','Domaine A','domaine a','A family domaine.','Careful sorting.','now','now'),
   ('p2','viewer','Domaine B','domaine b','A family domaine.','','now','now'),
   ('p3','owner','Domaine C','domaine c','','','now','now')`);
  const sent:unknown[]=[];
  const env={DB:d.db,GEMINI_API_KEY:'key',AUTH_SECRET:'a'.repeat(48),APP_URL:'https://wine.example',WINE_IMAGES:{} as R2Bucket,REFERENCE_DATA:{} as R2Bucket,RESEARCH_QUEUE:{send:vi.fn(async(job:unknown)=>{sent.push(job)})} as unknown as Queue<unknown>};
  const owner={id:'owner',email:'o@example.com',display_name:'Owner',role:'owner',status:'active'} as const;
  expect((await rolloutRoute(new Request('https://wine.example/api/admin/rollout/translate',{method:'POST'}),env,owner))?.status).toBe(202);
  expect(sent.at(-1)).toEqual({kind:'admin_rollout',owner:'owner',rollout:'translate'});
  expect(await processRolloutJob(env,'translate',{kind:'admin_rollout',owner:'owner',rollout:'translate'})).toMatchObject({complete:true,processed:3});
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(sentFields(fetch.mock.calls[0] as unknown[])).toEqual({t0:'A family domaine.',t1:'Careful sorting.'});
  expect((await rolloutStatus(d.db)).translation).toMatchObject({state:'complete',producers:{processed:3,total:3},sections:2,error:null});
  expect(await readResearchTranslation(d.db,request({profile:'A family domaine.'}))).toEqual({lang:'zh-Hant-HK',fields:{profile:'一個家族酒莊。'}});
  // Checking again after it finished finds nothing new to pay for.
  await rolloutRoute(new Request('https://wine.example/api/admin/rollout/translate',{method:'POST',body:JSON.stringify({refresh:true})}),env,owner);
  await processRolloutJob(env,'translate',{kind:'admin_rollout',owner:'owner',rollout:'translate'});
  expect(fetch).toHaveBeenCalledTimes(1);
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
  const d=realD1(),fetch=translatingModel();vi.stubGlobal('fetch',fetch);
  const env={DB:d.db,GEMINI_API_KEY:'key'};
  expect(await (await call(env,'/api/research/translation/lookup',{lang:'zh-Hant-HK',fields:english})).json()).toEqual({translation:{lang:'zh-Hant-HK',fields:{}}});
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
