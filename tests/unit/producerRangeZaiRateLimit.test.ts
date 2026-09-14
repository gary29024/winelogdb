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
function modelResponse(){return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({rangeComplete:false,coverageNote:'Partial',range:[]})}}],usage:{prompt_tokens:50,completion_tokens:30}}),{headers:{'Content-Type':'application/json'}})}
function rowsFor(calls:readonly unknown[][],stage:string){
  const rows:Record<string,unknown>[]=[];
  for(const call of calls){try{const row=JSON.parse(String(call[0])) as Record<string,unknown>;if(row.event==='producer_range_phase2'&&row.stage===stage)rows.push(row)}catch{/* non-JSON log */}}
  return rows;
}

beforeEach(()=>{({sqlite,db}=migratedSqliteD1())});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();vi.useRealTimers();sqlite.close()});

describe('Z.ai transient rate-limit retry',()=>{
  it('respects Retry-After and retries code 1305 twice before using a successful response',async()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-14T00:00:00Z'));seedProducer();
    const warn=vi.spyOn(console,'warn').mockImplementation(()=>undefined);let gatewayCalls=0;const secret='raw-provider-message-must-not-leak';
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{
      const url=String(input);
      if(url==='https://domaine.example/')return responseAt(url,rootHtml);
      if(url==='https://domaine.example/our-wines')return responseAt(url,rangeHtml);
      if(url.startsWith('https://gateway.ai.cloudflare.com/')){
        gatewayCalls++;
        if(gatewayCalls<3)return new Response(JSON.stringify({error:{code:1305,message:secret}}),{status:429,headers:{'Content-Type':'application/json','Retry-After':'1'}});
        return modelResponse();
      }
      throw new Error(`Unexpected fetch ${url}`);
    }));

    const pending=tryDirectProducerRangeRefresh({DB:db,...gateway},'owner','p1','run-1');
    await vi.advanceTimersByTimeAsync(0);expect(gatewayCalls).toBe(1);
    await vi.advanceTimersByTimeAsync(999);expect(gatewayCalls).toBe(1);
    await vi.advanceTimersByTimeAsync(1);expect(gatewayCalls).toBe(2);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(await pending).toMatchObject({handled:false,reason:'official evidence incomplete'});
    expect(gatewayCalls).toBe(3);

    const retries=rowsFor(warn.mock.calls,'zai_retry');
    expect(retries).toHaveLength(2);
    expect(retries[0]).toMatchObject({attempt:1,nextAttempt:2,delayMs:1_000,httpStatus:429,providerCode:'1305',providerMessage:'Z.AI rate limit triggered',retryAfter:'1'});
    expect(retries[1]).toMatchObject({attempt:2,nextAttempt:3,delayMs:1_000,httpStatus:429,providerCode:'1305'});
    expect(warn.mock.calls.flat().join(' ')).not.toContain(secret);
  });

  it('does not retry an unclassified or non-transient 429 code',async()=>{
    seedProducer();let gatewayCalls=0;
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{
      const url=String(input);
      if(url==='https://domaine.example/')return responseAt(url,rootHtml);
      if(url==='https://domaine.example/our-wines')return responseAt(url,rangeHtml);
      if(url.startsWith('https://gateway.ai.cloudflare.com/')){gatewayCalls++;return new Response(JSON.stringify({error:{code:1304,message:'daily limit'}}),{status:429,headers:{'Content-Type':'application/json'}})}
      throw new Error(`Unexpected fetch ${url}`);
    }));

    expect(await tryDirectProducerRangeRefresh({DB:db,...gateway},'owner','p1','run-1')).toEqual({handled:false,reason:'cheap model failed'});
    expect(gatewayCalls).toBe(1);
  });

  it('stops after three total attempts when a retryable 429 persists',async()=>{
    vi.useFakeTimers();seedProducer();let gatewayCalls=0;
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{
      const url=String(input);
      if(url==='https://domaine.example/')return responseAt(url,rootHtml);
      if(url==='https://domaine.example/our-wines')return responseAt(url,rangeHtml);
      if(url.startsWith('https://gateway.ai.cloudflare.com/')){gatewayCalls++;return new Response(JSON.stringify({error:{code:1305,message:'rate limited'}}),{status:429,headers:{'Content-Type':'application/json','Retry-After':'0'}})}
      throw new Error(`Unexpected fetch ${url}`);
    }));

    const pending=tryDirectProducerRangeRefresh({DB:db,...gateway},'owner','p1','run-1');
    await vi.runAllTimersAsync();
    expect(await pending).toEqual({handled:false,reason:'cheap model failed'});
    expect(gatewayCalls).toBe(3);
  });
});