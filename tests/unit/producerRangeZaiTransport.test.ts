import type { DatabaseSync } from 'node:sqlite';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { tryDirectProducerRangeRefresh } from '../../src/lib/producers/catalogDirectResearch';
import { migratedSqliteD1 } from './support/sqliteD1';

const gateway={CF_AI_GATEWAY_TOKEN:'cf-token',AI_GATEWAY_ACCOUNT_ID:'account-123',AI_GATEWAY_ID:'winelog'};
const rootHtml='<html><body><p>Domaine Test official estate page with current information for visitors and collectors.</p><a href="/our-wines">Our wines</a></body></html>';
const rangeHtml='<html><body><h1>Our wines</h1><p>The complete current domaine range is presented here with estate bottlings and appellations for the current release.</p></body></html>';
let sqlite:DatabaseSync,db:D1Database;

function seedProducer(){
 const stamp=new Date().toISOString(),range=[{name:'Clos A',category:'red'}];
 sqlite.prepare(`INSERT INTO producers(id,owner_id,canonical_name,match_key,profile,home_country,profile_researched_at,official_website_url,catalog_json,catalog_researched_json,sources_json,catalog_sources_json,created_at,updated_at)
   VALUES('p1','owner','Domaine Test','domaine test','Estate profile','France',?,'https://domaine.example/',?,?, '[]','[]',?,?)`)
   .run(stamp,JSON.stringify(range),JSON.stringify(range),stamp,stamp);
 sqlite.prepare(`INSERT INTO producer_aliases(owner_id,normalized_alias,producer_id,display_alias,created_at) VALUES('owner','domaine test','p1','Domaine Test',?)`).run(stamp);
 sqlite.prepare(`INSERT INTO producer_research_runs(owner_id,request_id,producer_id,status,stage,attempt,message,started_at,updated_at) VALUES('owner','run-1','p1','running','searching',0,'running',?,?)`).run(stamp,stamp);
}
function responseAt(url:string,body:string){const response=new Response(body,{headers:{'Content-Type':'text/html; charset=utf-8'}});Object.defineProperty(response,'url',{value:url});return response}
function sse(data:unknown){return `data: ${JSON.stringify(data)}\n\n`}
function modelResponse(){
 const content=JSON.stringify({rangeComplete:false,coverageNote:'Partial',range:[]}),split=Math.floor(content.length/2);
 return new Response(sse({choices:[{delta:{content:content.slice(0,split)}}]})+sse({choices:[{delta:{content:content.slice(split)},finish_reason:'stop'}],usage:{prompt_tokens:50,completion_tokens:30}})+'data: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});
}
function stubTransport(handler:(init?:RequestInit)=>Response|Promise<Response>){
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=String(input);
  if(url==='https://domaine.example/')return responseAt(url,rootHtml);
  if(url==='https://domaine.example/our-wines')return responseAt(url,rangeHtml);
  if(url.startsWith('https://gateway.ai.cloudflare.com/'))return await handler(init);
  throw new Error(`Unexpected fetch ${url}`);
 }));
}
function logFor(calls:readonly unknown[][],stage:string){
 for(const call of calls){try{const row=JSON.parse(String(call[0])) as Record<string,unknown>;if(row.event==='producer_range_phase2'&&row.stage===stage)return row}catch{/* non-JSON log */}}
 return undefined;
}
function controlledStream(init:RequestInit|undefined){
 let streamController!:ReadableStreamDefaultController<Uint8Array>;
 const body=new ReadableStream<Uint8Array>({start(controller){streamController=controller;(init?.signal as AbortSignal).addEventListener('abort',()=>controller.error(new DOMException('Aborted','AbortError')),{once:true})}});
 return {response:new Response(body,{headers:{'Content-Type':'text/event-stream'}}),controller:streamController};
}

beforeEach(()=>{({sqlite,db}=migratedSqliteD1())});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();vi.useRealTimers();sqlite.close()});

describe('Z.ai streaming transport observability',()=>{
 it('waits 60 seconds for the first response before aborting',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-13T14:30:00Z'));seedProducer();
  const warn=vi.spyOn(console,'warn').mockImplementation(()=>undefined);let reached!:()=>void,aborted=false;
  const ready=new Promise<void>(resolve=>{reached=resolve});
  stubTransport(init=>{reached();return new Promise<Response>((_resolve,reject)=>{
   (init?.signal as AbortSignal).addEventListener('abort',()=>{aborted=true;reject(new DOMException('Aborted','AbortError'))},{once:true});
  })});
  const pending=tryDirectProducerRangeRefresh({DB:db,...gateway},'owner','p1','run-1');
  await ready;
  expect(String(sqlite.prepare("SELECT message FROM producer_research_runs WHERE request_id='run-1'").get()!.message)).toContain('60-second timeout');
  await vi.advanceTimersByTimeAsync(35_000);expect(aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(24_999);expect(aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(1);expect(aborted).toBe(true);
  expect(await pending).toEqual({handled:false,reason:'cheap model failed'});
  expect(logFor(warn.mock.calls,'zai_timeout')).toMatchObject({producerId:'p1',requestId:'run-1',timeoutType:'first_chunk',elapsedMs:60_000,timeoutMs:60_000});
 });

 it('resets a 30-second idle timeout whenever stream data arrives',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-13T14:30:00Z'));seedProducer();const warn=vi.spyOn(console,'warn').mockImplementation(()=>undefined),encoder=new TextEncoder();let live!:ReturnType<typeof controlledStream>,reached!:()=>void;
  const ready=new Promise<void>(resolve=>{reached=resolve});
  stubTransport(init=>{live=controlledStream(init);reached();return live.response});
  const pending=tryDirectProducerRangeRefresh({DB:db,...gateway},'owner','p1','run-1');await ready;await vi.advanceTimersByTimeAsync(0);
  live.controller.enqueue(encoder.encode(sse({choices:[{delta:{content:'{"rangeComplete":false'}}]})));await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(29_999);expect(logFor(warn.mock.calls,'zai_timeout')).toBeUndefined();
  live.controller.enqueue(encoder.encode(sse({choices:[{delta:{content:',"range":[]}'}}]})));await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(29_999);expect(logFor(warn.mock.calls,'zai_timeout')).toBeUndefined();
  await vi.advanceTimersByTimeAsync(1);expect(await pending).toEqual({handled:false,reason:'cheap model failed'});
  expect(logFor(warn.mock.calls,'zai_timeout')).toMatchObject({timeoutType:'idle',timeoutMs:30_000});
 });

 it('keeps a 180-second absolute ceiling even while chunks continue',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-13T14:30:00Z'));seedProducer();const warn=vi.spyOn(console,'warn').mockImplementation(()=>undefined),encoder=new TextEncoder();let live!:ReturnType<typeof controlledStream>,reached!:()=>void;
  const ready=new Promise<void>(resolve=>{reached=resolve});stubTransport(init=>{live=controlledStream(init);reached();return live.response});
  const pending=tryDirectProducerRangeRefresh({DB:db,...gateway},'owner','p1','run-1');await ready;await vi.advanceTimersByTimeAsync(0);live.controller.enqueue(encoder.encode(sse({choices:[{delta:{content:'{'}}]})));await vi.advanceTimersByTimeAsync(0);
  for(let i=0;i<8;i++){await vi.advanceTimersByTimeAsync(20_000);live.controller.enqueue(encoder.encode(sse({choices:[{delta:{content:' '}}]})));await vi.advanceTimersByTimeAsync(0)}
  await vi.advanceTimersByTimeAsync(19_999);expect(logFor(warn.mock.calls,'zai_timeout')).toBeUndefined();await vi.advanceTimersByTimeAsync(1);
  expect(await pending).toEqual({handled:false,reason:'cheap model failed'});expect(logFor(warn.mock.calls,'zai_timeout')).toMatchObject({timeoutType:'absolute',elapsedMs:180_000,timeoutMs:180_000});
 });

 it('logs a network failure separately without exposing the thrown error text',async()=>{
  seedProducer();const warn=vi.spyOn(console,'warn').mockImplementation(()=>undefined);
  stubTransport(()=>{throw new TypeError('socket closed secret-token-123')});
  expect(await tryDirectProducerRangeRefresh({DB:db,...gateway},'owner','p1','run-1')).toEqual({handled:false,reason:'cheap model failed'});
  const row=logFor(warn.mock.calls,'zai_network_error');expect(row).toMatchObject({producerId:'p1',requestId:'run-1',phase:'connect'});expect(typeof row?.elapsedMs).toBe('number');
  expect(warn.mock.calls.flat().join(' ')).not.toContain('secret-token-123');
 });

 it('keeps Gateway HTTP errors distinct and includes elapsed time',async()=>{
  seedProducer();const warn=vi.spyOn(console,'warn').mockImplementation(()=>undefined);
  stubTransport(()=>new Response(JSON.stringify({error:{message:'The specified key does not exist'}}),{status:401,headers:{'Content-Type':'application/json'}}));
  expect(await tryDirectProducerRangeRefresh({DB:db,...gateway},'owner','p1','run-1')).toEqual({handled:false,reason:'cheap model failed'});
  const row=logFor(warn.mock.calls,'gateway_error');expect(row).toMatchObject({producerId:'p1',requestId:'run-1',httpStatus:401,providerMessage:'AI Gateway provider key not found'});expect(typeof row?.elapsedMs).toBe('number');
 });

 it('requests streaming, assembles SSE deltas and logs first-chunk timing',async()=>{
  seedProducer();const log=vi.spyOn(console,'log').mockImplementation(()=>undefined);let requestBody='';stubTransport(init=>{requestBody=String(init?.body??'');return modelResponse()});
  const result=await tryDirectProducerRangeRefresh({DB:db,...gateway},'owner','p1','run-1');expect(result).toMatchObject({handled:false,reason:'official evidence incomplete'});
  expect((JSON.parse(requestBody) as {stream?:unknown}).stream).toBe(true);
  const started=logFor(log.mock.calls,'zai_stream_started');expect(started).toMatchObject({producerId:'p1',requestId:'run-1'});expect(typeof started?.firstChunkMs).toBe('number');
  const row=logFor(log.mock.calls,'zai_response');expect(row).toMatchObject({producerId:'p1',requestId:'run-1',httpStatus:200,mode:'stream',events:2,doneEvent:true});expect(typeof row?.elapsedMs).toBe('number');
 });

 it('still accepts a buffered JSON response if the provider ignores stream mode',async()=>{
  seedProducer();const log=vi.spyOn(console,'log').mockImplementation(()=>undefined);stubTransport(()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({rangeComplete:false,coverageNote:'Partial',range:[]})}}],usage:{prompt_tokens:50,completion_tokens:30}}),{headers:{'Content-Type':'application/json'}}));
  expect(await tryDirectProducerRangeRefresh({DB:db,...gateway},'owner','p1','run-1')).toMatchObject({handled:false,reason:'official evidence incomplete'});
  expect(logFor(log.mock.calls,'zai_response')).toMatchObject({mode:'buffered',httpStatus:200});
 });
});
