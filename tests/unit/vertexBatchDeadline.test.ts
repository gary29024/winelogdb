import type { DatabaseSync } from 'node:sqlite';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { clearGeminiBatchGateway,configureGeminiBatchGateway,createGeminiBatch,fetchGeminiBatch } from '../../src/lib/research/geminiBatch';
import { migratedSqliteD1 } from './support/sqliteD1';

let sqlite:DatabaseSync;
const requestId='25bea56b-d4f2-4e32-a5d4-777c0fa63265';
beforeEach(()=>{
  vi.useFakeTimers();const store=migratedSqliteD1();sqlite=store.sqlite;
  configureGeminiBatchGateway(undefined,{DB:store.db,CF_AI_GATEWAY_TOKEN:'test',AI_GATEWAY_ACCOUNT_ID:'test',AI_GATEWAY_ID:'test',VERTEX_PROJECT_ID:'test',VERTEX_REGION:'global'});
  vi.spyOn(console,'log').mockImplementation(()=>{});vi.spyOn(console,'warn').mockImplementation(()=>{});
});
afterEach(()=>{clearGeminiBatchGateway(undefined);vi.unstubAllGlobals();vi.restoreAllMocks();vi.useRealTimers();sqlite.close()});
async function start(count=1){
  const name=await createGeminiBatch(undefined,'gemini-3.8-flash',`winelog-producer-${requestId}-1`,Array.from({length:count},(_,i)=>({key:`catalog-${i}`,request:{contents:[]}})));
  return {name,pending:fetchGeminiBatch(undefined,name)};
}

describe('Vertex execution stays inside a queue invocation',()=>{
  it('persists timeout results within 11 minutes even when fetch ignores abort',async()=>{
    const signals:AbortSignal[]=[];const fetcher=vi.fn((_url:unknown,init:RequestInit)=>{signals.push(init.signal!);return new Promise<Response>(()=>{})});vi.stubGlobal('fetch',fetcher);
    const {pending}=await start();await vi.advanceTimersByTimeAsync(660_000);
    const result=await pending;expect(result.ok).toBe(true);
    if(!result.ok)throw new Error(result.error);
    expect(result.responses[0].error?.status).toBe(408);expect(fetcher).toHaveBeenCalledTimes(2);expect(signals.every(s=>s.aborted)).toBe(true);
    expect(sqlite.prepare('SELECT state,requests_json FROM vertex_batch_emulation_jobs').get()).toMatchObject({state:'JOB_STATE_SUCCEEDED',requests_json:'[]'});
    expect(vi.mocked(console.warn).mock.calls.map(([line])=>JSON.parse(String(line)))).toContainEqual(expect.objectContaining({event:'vertex-flex-attempt',stage:'failed',requestId,failureKind:'timeout'}));
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([200,503])('bounds a stalled HTTP %s response body as well as headers',async status=>{
    const fetcher=vi.fn(async()=>new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{'))}}),{status}));vi.stubGlobal('fetch',fetcher);
    const {pending}=await start();await vi.advanceTimersByTimeAsync(660_000);
    const result=await pending;if(!result.ok)throw new Error(result.error);
    expect(result.responses[0].error?.status).toBe(408);expect(fetcher).toHaveBeenCalledTimes(2);expect(vi.getTimerCount()).toBe(0);
  });

  it('shares the budget with later waves instead of starting another ten-minute call',async()=>{
    const fetcher=vi.fn(()=>new Promise<Response>(()=>{}));vi.stubGlobal('fetch',fetcher);
    const {pending}=await start(7);await vi.advanceTimersByTimeAsync(660_000);
    const result=await pending;if(!result.ok)throw new Error(result.error);
    expect(result.responses).toHaveLength(7);expect(result.responses.every(item=>item.error?.status===408)).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(12);expect(result.responses[6].error?.message).toContain('budget exhausted');
  });

  it('still retries a transient HTTP failure and returns a successful response',async()=>{
    const fetcher=vi.fn().mockResolvedValueOnce(new Response('busy',{status:503})).mockResolvedValueOnce(Response.json({candidates:[{content:{parts:[{text:'{}'}]}}]}));vi.stubGlobal('fetch',fetcher);
    const {pending}=await start();await vi.advanceTimersByTimeAsync(900);
    const result=await pending;if(!result.ok)throw new Error(result.error);
    expect(result.responses[0].response?.candidates).toHaveLength(1);expect(fetcher).toHaveBeenCalledTimes(2);expect(vi.getTimerCount()).toBe(0);
  });
});
