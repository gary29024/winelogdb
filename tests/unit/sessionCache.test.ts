// @vitest-environment jsdom
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { createSessionCache } from '../../src/lib/cache/sessionCache';

const deferred=<T>()=>{
  let resolve!:(value:T)=>void;
  let reject!:(error:Error)=>void;
  const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no});
  return {promise,resolve,reject};
};

describe('session-scoped summary requests',()=>{
  beforeEach(()=>localStorage.clear());
  afterEach(()=>vi.restoreAllMocks());

  it('shares concurrent requests and reuses the response until its TTL expires',async()=>{
    const clock=vi.spyOn(Date,'now').mockReturnValue(1000);
    const reply=deferred<number>(),load=vi.fn(()=>reply.promise),cache=createSessionCache(load);
    const first=cache.get();
    expect(cache.get()).toBe(first);
    reply.resolve(1);await first;
    expect(await cache.get()).toBe(1);
    expect(load).toHaveBeenCalledTimes(1);
    clock.mockReturnValue(31_001);
    await cache.get();expect(load).toHaveBeenCalledTimes(2);
  });

  it.each([true,false])('does not restore old data after invalidation (old resolves first: %s)',async oldFirst=>{
    const old=deferred<number>(),fresh=deferred<number>();
    const load=vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const cache=createSessionCache<number>(load),first=cache.get();
    cache.invalidate();const second=cache.get();
    if(oldFirst){
      old.resolve(1);await first;
      expect(cache.get()).toBe(second);
      fresh.resolve(2);await second;
    }else{
      fresh.resolve(2);await second;
      old.resolve(1);await first;
    }
    expect(await cache.get()).toBe(2);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('does not share cached or in-flight data between sessions',async()=>{
    localStorage.setItem('session','a');
    const old=deferred<number>(),load=vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue(2);
    const cache=createSessionCache<number>(load),first=cache.get();
    localStorage.setItem('session','b');
    expect(await cache.get()).toBe(2);
    old.resolve(1);await first;
    expect(await cache.get()).toBe(2);
    localStorage.removeItem('session');await cache.get();
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('retries failed reads instead of caching the failure',async()=>{
    const load=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(2);
    const cache=createSessionCache<number>(load);
    await expect(cache.get()).rejects.toThrow('offline');
    expect(await cache.get()).toBe(2);
  });
});
