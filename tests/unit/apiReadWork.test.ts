// @vitest-environment jsdom
import { afterEach,expect,it,vi } from 'vitest';
import { apiFetch,bootstrapAccount,clearSession } from '../../src/lib/auth/client';
afterEach(()=>{clearSession();vi.unstubAllGlobals()});
it('coalesces overlapping producer and shared-wine reads',async()=>{
 let release!:()=>void;
 let pending:Promise<void>;
 const fetcher=vi.fn(async()=>{await pending;return Response.json({id:'wine'})});
 vi.stubGlobal('fetch',fetcher);
 for(const url of ['/api/producers/p','/api/shared/wines/w']){
  pending=new Promise<void>(resolve=>{release=resolve});
  const responsesPending=Promise.all([apiFetch(url),apiFetch(url),apiFetch(url)]);
  release();
  const responses=await responsesPending;
  expect(await Promise.all(responses.map(r=>r.json()))).toEqual([{id:'wine'},{id:'wine'},{id:'wine'}]);
 }
 expect(fetcher).toHaveBeenCalledTimes(2);
});

it('revalidates settled reads and never reuses a read across a mutation',async()=>{
 let release!:(value:Response)=>void;
 const fetcher=vi.fn().mockImplementationOnce(()=>new Promise<Response>(resolve=>{release=resolve})).mockImplementation(async()=>Response.json({version:2}));
 vi.stubGlobal('fetch',fetcher);
 const old=apiFetch('/api/producers/p');
 await apiFetch('/api/producers/p/primary-name',{method:'POST',body:'{}'});
 expect(await (await apiFetch('/api/producers/p')).json()).toEqual({version:2});
 release(Response.json({version:1}));expect(await (await old).json()).toEqual({version:1});
 await apiFetch('/api/producers/p');expect(fetcher).toHaveBeenCalledTimes(4);
});

it('does not poison retries with rejected or failed requests',async()=>{
 const fetcher=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(Response.json({error:'unavailable'},{status:503})).mockImplementation(async()=>Response.json({ok:true}));
 vi.stubGlobal('fetch',fetcher);
 await expect(apiFetch('/api/producers/p')).rejects.toThrow('offline');
 expect((await apiFetch('/api/producers/p')).status).toBe(503);
 expect((await apiFetch('/api/producers/p')).status).toBe(200);
 expect(fetcher).toHaveBeenCalledTimes(3);
});

it('keeps abortable requests independent',async()=>{
 const controller=new AbortController();
 const fetcher=vi.fn(async(_input:unknown,init?:RequestInit)=>{
  if(init?.signal)return new Promise<Response>((_resolve,reject)=>init.signal!.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))));
  return Response.json({ok:true});
 });vi.stubGlobal('fetch',fetcher);
 const cancelled=apiFetch('/api/journal',{signal:controller.signal}),active=apiFetch('/api/journal');
 controller.abort();await expect(cancelled).rejects.toMatchObject({name:'AbortError'});
 expect((await active).status).toBe(200);expect(fetcher).toHaveBeenCalledTimes(2);
});

it('isolates accounts and rejects the old account response',async()=>{
 let release!:(value:Response)=>void;
 const fetcher=vi.fn().mockImplementationOnce(()=>new Promise<Response>(resolve=>{release=resolve})).mockImplementation(async(input:unknown)=>Response.json(String(input)==='/api/me'?{user:{id:'next',email:'n@example.com',display_name:'Next',role:'member',status:'active'}}:{id:'new'}));
 vi.stubGlobal('fetch',fetcher);
 const old=apiFetch('/api/shared/wines/w');await bootstrapAccount();
 expect(await (await apiFetch('/api/shared/wines/w')).json()).toEqual({id:'new'});
 release(Response.json({id:'old'}));await expect(old).rejects.toThrow('Account changed');
});
