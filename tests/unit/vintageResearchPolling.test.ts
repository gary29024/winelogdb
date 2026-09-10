import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { lookUpVintageWindow } from '../../src/features/maturity/api';
import { clearSession } from '../../src/lib/auth/client';
vi.mock('../../src/lib/auth/client',()=>({authHeaders:()=>({}),clearSession:vi.fn()}));
const subject={country:'France',region:'Burgundy',vintage:2019};
const queued=()=>Response.json({job:{id:'job',status:'queued'}},{status:202});
beforeEach(()=>{vi.useFakeTimers();vi.clearAllMocks()});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals()});

describe('vintage research status polling',()=>{
  it('posts once then only reads status until the result is saved',async()=>{
    const fetch=vi.fn().mockResolvedValueOnce(queued())
      .mockResolvedValueOnce(Response.json({job:{id:'job',status:'running'}}))
      .mockResolvedValueOnce(Response.json({job:{id:'job',status:'complete',window:{note:'saved'}}}));
    vi.stubGlobal('fetch',fetch);
    const result=lookUpVintageWindow(subject);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await result).toMatchObject({window:{note:'saved'},cached:false});
    expect(fetch.mock.calls.map(call=>call[0])).toEqual(['/api/maturity/vintage','/api/maturity/vintage/jobs/job','/api/maturity/vintage/jobs/job']);
    expect(fetch.mock.calls.slice(1).every(call=>!call[1].method)).toBe(true);
  });
  it('stops observing a closed panel without sending a cancellation or another lookup',async()=>{
    const fetch=vi.fn().mockResolvedValueOnce(queued());vi.stubGlobal('fetch',fetch);
    const controller=new AbortController(),result=lookUpVintageWindow(subject,false,controller.signal);
    const rejection=expect(result).rejects.toMatchObject({name:'AbortError'});
    await vi.advanceTimersByTimeAsync(0);controller.abort();
    await vi.advanceTimersByTimeAsync(5000);await rejection;
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('bounds polling and reports still pending without re-enqueueing',async()=>{
    const fetch=vi.fn().mockResolvedValueOnce(queued()).mockImplementation(async()=>Response.json({job:{id:'job',status:'queued'}}));
    vi.stubGlobal('fetch',fetch);
    const result=lookUpVintageWindow(subject,true);
    await vi.advanceTimersByTimeAsync(180_000);
    expect(await result).toEqual({window:null,cached:false,pending:true});
    expect(fetch).toHaveBeenCalledTimes(37);
  });
  it('reports terminal failure without automatically paying for another attempt',async()=>{
    const fetch=vi.fn().mockResolvedValueOnce(queued()).mockResolvedValueOnce(Response.json({job:{id:'job',status:'failed',error:'No grounded answer'}}));
    vi.stubGlobal('fetch',fetch);
    const rejection=expect(lookUpVintageWindow(subject)).rejects.toThrow('No grounded answer');
    await vi.advanceTimersByTimeAsync(5000);await rejection;
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('returns cache hits immediately without polling',async()=>{
    const fetch=vi.fn().mockResolvedValueOnce(Response.json({window:{note:'cached'},cached:true}));vi.stubGlobal('fetch',fetch);
    expect(await lookUpVintageWindow(subject)).toMatchObject({window:{note:'cached'},cached:true});
    expect(fetch).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(0);
  });
  it('stops polling when the session expires',async()=>{
    const fetch=vi.fn().mockResolvedValueOnce(queued()).mockResolvedValueOnce(Response.json({error:'Unauthorized'},{status:401}));vi.stubGlobal('fetch',fetch);
    const rejection=expect(lookUpVintageWindow(subject)).rejects.toThrow('Session expired');
    await vi.advanceTimersByTimeAsync(5000);await rejection;
    expect(clearSession).toHaveBeenCalledOnce();expect(fetch).toHaveBeenCalledTimes(2);
  });
});
