// @vitest-environment jsdom
import { afterEach,expect,it,vi } from 'vitest';
import { accountStorageKey,apiFetch,bootstrapAccount,clearSession } from '../../src/lib/auth/client';
afterEach(()=>{clearSession();vi.unstubAllGlobals();localStorage.clear();sessionStorage.clear()});
it('discards a late private response after switching accounts',async()=>{
 let id='alice',finish!:(r:Response)=>void;const late=new Promise<Response>(resolve=>{finish=resolve});
 vi.stubGlobal('fetch',vi.fn((path:string)=>path==='/api/me'?Promise.resolve(Response.json({user:{id}})):late));
 await bootstrapAccount();localStorage.setItem(accountStorageKey('draft'),'Alice private draft');const reading=apiFetch('/api/wines');
 id='bob';await bootstrapAccount();expect(localStorage.getItem(accountStorageKey('draft'))).toBeNull();finish(Response.json({private:'Alice'}));await expect(reading).rejects.toThrow('Account changed');
});
it('retries an uncertain network delivery with the same accepted quote and idempotency key',async()=>{
 const sent:Headers[]=[];let count=0;
 vi.stubGlobal('fetch',vi.fn(async(path:string,init?:RequestInit)=>{
  if(path==='/api/me')return Response.json({user:{id:'alice'}});
  if(path.startsWith('/api/credits/quotes'))return Response.json({id:'quote',total:0,available:10,units:[]});
  sent.push(new Headers(init?.headers));if(count++===0)throw new Error('Connection lost');return Response.json({ok:true});
 }));
 await bootstrapAccount();expect((await apiFetch('/api/recognition',{method:'POST',body:'{}'})).ok).toBe(true);
 expect(sent).toHaveLength(2);expect(sent[0].get('Idempotency-Key')).toBe(sent[1].get('Idempotency-Key'));expect(sent[1].get('X-WineLog-Quote')).toBe('quote');
});
