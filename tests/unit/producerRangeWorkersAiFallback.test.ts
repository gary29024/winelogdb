import type { DatabaseSync } from 'node:sqlite';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { tryWorkersAiProducerRangeRefresh,workersFallbackEligible } from '../../src/lib/producers/catalogWorkersAiFallback';
import { migratedSqliteD1 } from './support/sqliteD1';

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
function stubPages(){vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{const url=String(input);if(url==='https://domaine.example/')return responseAt(url,rootHtml);if(url==='https://domaine.example/our-wines')return responseAt(url,rangeHtml);throw new Error(`Unexpected fetch ${url}`)}))}
function aiWith(result:unknown){return {run:vi.fn(async()=>result)} as unknown as Ai}

beforeEach(()=>{({sqlite,db}=migratedSqliteD1())});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();vi.useRealTimers();sqlite.close()});

describe('Workers AI producer range fallback',()=>{
  it('only runs for provider/model failures, not weak official evidence',()=>{
    expect(workersFallbackEligible('cheap model failed')).toBe(true);
    expect(workersFallbackEligible('cheap result invalid')).toBe(true);
    expect(workersFallbackEligible('no cheap provider')).toBe(true);
    expect(workersFallbackEligible('official evidence incomplete')).toBe(false);
    expect(workersFallbackEligible('profile requires research')).toBe(false);
  });

  it('aborts the binding request on timeout',async()=>{
    vi.useFakeTimers();seedProducer();stubPages();let signal:AbortSignal|undefined;
    const AI={run:vi.fn((_model:unknown,_input:unknown,options:{signal:AbortSignal})=>{signal=options.signal;return new Promise(()=>{})})} as unknown as Ai;
    const pending=tryWorkersAiProducerRangeRefresh({DB:db,AI},'owner','p1','run-1');await vi.advanceTimersByTimeAsync(0);
    expect(signal?.aborted).toBe(false);await vi.advanceTimersByTimeAsync(75_000);
    expect(await pending).toEqual({handled:false,reason:'workers ai failed'});expect(signal?.aborted).toBe(true);
  });

  it('skips inference after cancellation during the crawl',async()=>{
    seedProducer();const AI=aiWith({});
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{
      sqlite.prepare("UPDATE producer_research_runs SET status='failed'").run();return responseAt(String(input),rangeHtml);
    }));
    expect(await tryWorkersAiProducerRangeRefresh({DB:db,AI},'owner','p1','run-1')).toMatchObject({reason:'research run is no longer active'});
    expect(AI.run).not.toHaveBeenCalled();
  });

  it('uses the shared apex fallback when the saved www site is unavailable',async()=>{
    seedProducer();sqlite.prepare("UPDATE producers SET official_website_url='https://www.domaine.example/'").run();
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{
      if(String(input).includes('www.'))throw new Error('TLS failure');return responseAt(String(input),rangeHtml);
    }));
    const AI=aiWith({response:{rangeComplete:false,range:[]}});await tryWorkersAiProducerRangeRefresh({DB:db,AI},'owner','p1','run-1');
    expect(AI.run).toHaveBeenCalledTimes(1);
  });

  it('accepts a complete official range from Cloudflare-hosted GLM and completes the existing run',async()=>{
    seedProducer();stubPages();
    const AI=aiWith({choices:[{message:{content:JSON.stringify({rangeComplete:true,coverageNote:'Complete',range:[{name:'Clos A',category:'red',sourceUrl:'https://domaine.example/our-wines'}]})}}],usage:{prompt_tokens:80,completion_tokens:30}});
    const result=await tryWorkersAiProducerRangeRefresh({DB:db,AI},'owner','p1','run-1');
    expect(result).toMatchObject({handled:true,provider:'workers-ai',catalogCount:1});
    expect((AI.run as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    expect((AI.run as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('@cf/zai-org/glm-4.7-flash');
    const run=sqlite.prepare("SELECT status,message FROM producer_research_runs WHERE owner_id='owner' AND request_id='run-1'").get() as {status:string;message:string};
    expect(run.status).toBe('complete');expect(run.message).toContain('Workers AI GLM-4.7-Flash');
    const producer=sqlite.prepare("SELECT research_model FROM producers WHERE owner_id='owner' AND id='p1'").get() as {research_model:string};
    expect(producer.research_model).toContain('official-source range via Workers AI');
  });

  it('falls through to grounded Gemini when Workers AI itself fails',async()=>{
    seedProducer();stubPages();const AI={run:vi.fn(async()=>{throw new Error('capacity exhausted')})} as unknown as Ai;
    expect(await tryWorkersAiProducerRangeRefresh({DB:db,AI},'owner','p1','run-1')).toEqual({handled:false,reason:'workers ai failed'});
    const run=sqlite.prepare("SELECT status FROM producer_research_runs WHERE owner_id='owner' AND request_id='run-1'").get() as {status:string};
    expect(run.status).toBe('running');
  });

  it('does not replace a known range when the second cheap extractor still sees incomplete evidence',async()=>{
    seedProducer();stubPages();
    const AI=aiWith({response:{rangeComplete:false,coverageNote:'Partial',range:[]},usage:{prompt_tokens:70,completion_tokens:10}});
    expect(await tryWorkersAiProducerRangeRefresh({DB:db,AI},'owner','p1','run-1')).toMatchObject({handled:false,reason:'official evidence incomplete'});
    const producer=sqlite.prepare("SELECT catalog_researched_json FROM producers WHERE owner_id='owner' AND id='p1'").get() as {catalog_researched_json:string};
    expect(JSON.parse(producer.catalog_researched_json)).toHaveLength(1);
  });
});