import type { DatabaseSync } from 'node:sqlite';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { tryDirectProducerRangeRefresh } from '../../src/lib/producers/catalogDirectResearch';
import { syncMissingCandidates } from '../../src/lib/producers/catalogRangeOverlay';
import { createSession } from '../../src/lib/auth/session';
import structureEntry from '../../worker/structureEntry';
import { migratedSqliteD1 } from './support/sqliteD1';

const gateway={CF_AI_GATEWAY_TOKEN:'cf-token',AI_GATEWAY_ACCOUNT_ID:'account-123',AI_GATEWAY_ID:'winelog'};
let sqlite:DatabaseSync,db:D1Database;

function seedProducer(names=['Clos A','Clos B']){
 const stamp=new Date().toISOString(),range=names.map(name=>({name,category:'red'}));
 sqlite.prepare(`INSERT INTO producers(id,owner_id,canonical_name,match_key,profile,home_country,profile_researched_at,official_website_url,catalog_json,catalog_researched_json,sources_json,catalog_sources_json,created_at,updated_at)
   VALUES('p1','owner','Domaine Test','domaine test','Estate profile','France',?,'https://domaine.example/',?,?, '[]','[]',?,?)`)
   .run(stamp,JSON.stringify(range),JSON.stringify(range),stamp,stamp);
 sqlite.prepare(`INSERT INTO producer_aliases(owner_id,normalized_alias,producer_id,display_alias,created_at) VALUES('owner','domaine test','p1','Domaine Test',?)`).run(stamp);
 sqlite.prepare(`INSERT INTO producer_research_runs(owner_id,request_id,producer_id,status,stage,attempt,message,started_at,updated_at) VALUES('owner','run-1','p1','running','searching',0,'running',?,?)`).run(stamp,stamp);
}
function responseAt(url:string,body:string,contentType='text/html; charset=utf-8',status=200){
 const response=new Response(body,{status,headers:{'Content-Type':contentType}});Object.defineProperty(response,'url',{value:url});return response;
}
const rootHtml=`<html><body><p>Domaine Test official estate page with current information for visitors and collectors.</p><a href="/our-wines">Our wines</a></body></html>`;
const rangeHtml=`<html><body><h1>Our wines</h1><p>The complete current domaine range is presented here with estate bottlings and appellations for the current release.</p></body></html>`;
function modelResponse(result:unknown){return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(result)}}],usage:{prompt_tokens:50,completion_tokens:30}}),{headers:{'Content-Type':'application/json'}})}
function stubDirectFetch(result:unknown|Error,onGateway?:(body:string)=>void){
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=typeof input==='string'?input:input instanceof URL?input.toString():input.url;
  if(url==='https://domaine.example/')return responseAt(url,rootHtml);
  if(url==='https://domaine.example/our-wines')return responseAt(url,rangeHtml);
  if(url.startsWith('https://gateway.ai.cloudflare.com/')){
   onGateway?.(String(init?.body??''));
   if(result instanceof Error)return new Response(result.message,{status:500});
   return modelResponse(result);
  }
  throw new Error(`Unexpected fetch ${url}`);
 }));
}

beforeEach(()=>{({sqlite,db}=migratedSqliteD1())});
afterEach(()=>{vi.unstubAllGlobals();sqlite.close()});

describe('Phase 2 direct range integration',()=>{
 it('commits a complete official-site range, records sources and completes the existing run',async()=>{
  seedProducer();stubDirectFetch({rangeComplete:true,coverageNote:'Complete official range',range:[
   {name:'Clos A',category:'red',sourceUrl:'https://domaine.example/our-wines'},
   {name:'Clos B',category:'red',sourceUrl:'https://domaine.example/our-wines'}
  ]});
  const result=await tryDirectProducerRangeRefresh({DB:db,...gateway},'owner','p1','run-1');
  expect(result.handled).toBe(true);
  const producer=sqlite.prepare("SELECT catalog_json,catalog_sources_json,research_model FROM producers WHERE id='p1'").get()!;
  expect((JSON.parse(String(producer.catalog_json)) as Array<{name:string}>).map(row=>row.name).sort()).toEqual(['Clos A','Clos B']);
  expect(String(producer.catalog_sources_json)).toContain('https://domaine.example/our-wines');
  expect(String(producer.research_model)).toContain('zai/glm-4.7-flash');
  expect(sqlite.prepare("SELECT status FROM producer_research_runs WHERE owner_id='owner' AND request_id='run-1'").get()!.status).toBe('complete');
  expect(Number(sqlite.prepare("SELECT count(*) AS count FROM producer_catalog_missing_candidates").get()!.count)).toBe(0);
 });

 it('keeps incomplete evidence as suggestions and leaves the grounded workflow to continue',async()=>{
  seedProducer();stubDirectFetch({rangeComplete:false,coverageNote:'Partial page',range:[{name:'Clos Missing',category:'white',sourceUrl:'https://domaine.example/our-wines'}]});
  const result=await tryDirectProducerRangeRefresh({DB:db,...gateway},'owner','p1','run-1');
  expect(result.handled).toBe(false);expect(result.reason).toBe('official evidence incomplete');
  expect(sqlite.prepare("SELECT status FROM producer_research_runs WHERE owner_id='owner' AND request_id='run-1'").get()!.status).toBe('running');
  expect(sqlite.prepare("SELECT name FROM producer_catalog_missing_candidates WHERE producer_id='p1'").get()!.name).toBe('Clos Missing');
 });

 it('rejects a suspiciously collapsed range even when the model marks it complete',async()=>{
  seedProducer(['Clos 1','Clos 2','Clos 3','Clos 4','Clos 5','Clos 6','Clos 7','Clos 8']);
  stubDirectFetch({rangeComplete:true,coverageNote:'Claims complete',range:[{name:'Clos 1',category:'red',sourceUrl:'https://domaine.example/our-wines'},{name:'Clos 2',category:'red',sourceUrl:'https://domaine.example/our-wines'}]});
  const result=await tryDirectProducerRangeRefresh({DB:db,...gateway},'owner','p1','run-1');
  expect(result.handled).toBe(false);expect(result.reason).toBe('official evidence incomplete');
  expect(sqlite.prepare("SELECT status FROM producer_research_runs WHERE owner_id='owner' AND request_id='run-1'").get()!.status).toBe('running');
 });

 it('drops an off-domain redirect instead of feeding third-party content to the extractor',async()=>{
  seedProducer();let gatewayBody='';
  vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
   const url=typeof input==='string'?input:input instanceof URL?input.toString():input.url;
   if(url==='https://domaine.example/')return responseAt(url,rootHtml);
   if(url==='https://domaine.example/our-wines')return responseAt('https://merchant.example/wines','<html><body><h1>SECRET MERCHANT RANGE</h1><p>This third-party catalogue must never become official evidence.</p></body></html>');
   if(url.startsWith('https://gateway.ai.cloudflare.com/')){gatewayBody=String(init?.body??'');return modelResponse({rangeComplete:false,coverageNote:'Root page only',range:[]})}
   throw new Error(`Unexpected fetch ${url}`);
  }));
  const result=await tryDirectProducerRangeRefresh({DB:db,...gateway},'owner','p1','run-1');
  expect(result.handled).toBe(false);
  expect(gatewayBody).not.toContain('SECRET MERCHANT RANGE');
  expect(gatewayBody).not.toContain('merchant.example');
 });

 it('falls through cleanly when the Gateway extractor fails',async()=>{
  seedProducer();stubDirectFetch(new Error('gateway unavailable'));
  const result=await tryDirectProducerRangeRefresh({DB:db,...gateway},'owner','p1','run-1');
  expect(result.handled).toBe(false);expect(result.reason).toBe('cheap model failed');
  expect(sqlite.prepare("SELECT status FROM producer_research_runs WHERE owner_id='owner' AND request_id='run-1'").get()!.status).toBe('running');
 });
});

describe('producer range correction routes',()=>{
 const secret='range-route-test-secret';
 const ctx={waitUntil:()=>undefined,passThroughOnException:()=>undefined} as unknown as ExecutionContext;
 async function request(path:string,method='GET',body?:Record<string,unknown>){
  const token=await createSession('owner',secret),headers=new Headers({Authorization:`Bearer ${token}`});if(body)headers.set('Content-Type','application/json');
  return structureEntry.fetch(new Request(`https://winelog.test${path}`,{method,headers,body:body?JSON.stringify(body):undefined}),{DB:db,AUTH_SECRET:secret} as never,ctx);
 }
 it('requires explicit confirmation for create and delete while the list route stays readable',async()=>{
  seedProducer();
  expect((await request('/api/producers/p1/catalog-manual','POST',{name:'Clos Manual',category:'red'})).status).toBe(400);
  expect(Number(sqlite.prepare('SELECT count(*) AS count FROM producer_catalog_manual_entries').get()!.count)).toBe(0);
  const created=await request('/api/producers/p1/catalog-manual','POST',{confirmation:'ADD_MISSING_CATALOG_WINE',name:'Clos Manual',category:'red'});expect(created.status).toBe(201);
  const createdBody=await created.json() as {id:string};expect(createdBody.id).toBeTruthy();
  const listed=await request('/api/producers/p1/catalog-range-corrections');expect(listed.status).toBe(200);expect((await listed.json() as {manualEntries:unknown[]}).manualEntries).toHaveLength(1);
  expect((await request(`/api/producers/p1/catalog-manual/${createdBody.id}`,'DELETE',{})).status).toBe(400);
  expect((await request(`/api/producers/p1/catalog-manual/${createdBody.id}`,'DELETE',{confirmation:'REMOVE_MANUAL_CATALOG_WINE'})).status).toBe(200);
  expect(Number(sqlite.prepare('SELECT count(*) AS count FROM producer_catalog_manual_entries').get()!.count)).toBe(0);
 });

 it('requires the action-specific confirmation before dismissing a missing-wine suggestion',async()=>{
  seedProducer();await syncMissingCandidates(db,'owner','p1',[{name:'Clos Suggested',category:'white'}]);
  const id=String(sqlite.prepare("SELECT id FROM producer_catalog_missing_candidates WHERE status='suggested'").get()!.id);
  expect((await request(`/api/producers/p1/catalog-missing/${id}/ignore`,'POST',{confirmation:'ADD_MISSING_CATALOG_WINE'})).status).toBe(400);
  expect((await request(`/api/producers/p1/catalog-missing/${id}/ignore`,'POST',{confirmation:'IGNORE_CATALOG_CANDIDATE'})).status).toBe(200);
  expect(sqlite.prepare('SELECT status FROM producer_catalog_missing_candidates WHERE id=?').get(id)!.status).toBe('ignored');
 });
});
