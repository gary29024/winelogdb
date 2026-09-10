import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { lookUpVintageWindow } from '../../src/features/maturity/api';
import { clearSession } from '../../src/lib/auth/client';
vi.mock('../../src/lib/auth/client',()=>({authHeaders:()=>({}),clearSession:vi.fn()}));
const subject={country:'France',region:'Burgundy',vintage:2019};
const queued=()=>Response.json({job:{id:'job',status:'queued'}},{status:202});
const state=(status:string)=>Response.json({job:{id:'job',status}});
beforeEach(()=>{vi.useFakeTimers();vi.clearAllMocks()});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals()});

describe('vintage research status polling',()=>{
  it('shows an already-finished job immediately without a polling sleep',async()=>{
    const fetch=vi.fn().mockResolvedValueOnce(queued())
      .mockResolvedValueOnce(Response.json({job:{id:'job',status:'complete',window:{note:'saved'}}}));
    vi.stubGlobal('fetch',fetch);
    expect(await lookUpVintageWindow(subject)).toMatchObject({window:{note:'saved'},cached:false});
    expect(fetch).toHaveBeenCalledTimes(2);expect(vi.getTimerCount()).toBe(0);
  });
  it('reads immediately, then at one and three seconds for a quick result',async()=>{
    const fetch=vi.fn().mockResolvedValueOnce(queued())
      .mockResolvedValueOnce(state('queued')).mockResolvedValueOnce(state('running'))
      .mockResolvedValueOnce(Response.json({job:{id:'job',status:'complete',window:{note:'saved'}}}));
    vi.stubGlobal('fetch',fetch);
    const result=lookUpVintageWindow(subject);
    await vi.advanceTimersByTimeAsync(0);expect(fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(999);expect(fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);expect(fetch).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1999);expect(fetch).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toMatchObject({window:{note:'saved'},cached:false});
    expect(fetch.mock.calls.slice(1).every(call=>call[0]==='/api/maturity/vintage/jobs/job'&&!call[1].method)).toBe(true);
  });
  it('stops observing a closed panel without sending a cancellation or another lookup',async()=>{
    const fetch=vi.fn().mockResolvedValueOnce(queued()).mockResolvedValueOnce(state('running'));vi.stubGlobal('fetch',fetch);
    const controller=new AbortController(),result=lookUpVintageWindow(subject,false,controller.signal);
    const rejection=expect(result).rejects.toMatchObject({name:'AbortError'});
    await vi.advanceTimersByTimeAsync(0);controller.abort();
    await vi.advanceTimersByTimeAsync(1000);await rejection;
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each(['queued','running'])('bounds polling and reports the last observed %s state without re-enqueueing',async status=>{
    const fetch=vi.fn().mockResolvedValueOnce(queued()).mockImplementation(async()=>state(status));
    vi.stubGlobal('fetch',fetch);
    const result=lookUpVintageWindow(subject,true);
    await vi.advanceTimersByTimeAsync(180_000);
    expect(await result).toEqual({window:null,cached:false,pending:true,pendingStatus:status});
    expect(fetch).toHaveBeenCalledTimes(39); // one POST; 38 status reads with backoff
  });
  it('reports terminal failure without automatically paying for another attempt',async()=>{
    const fetch=vi.fn().mockResolvedValueOnce(queued()).mockResolvedValueOnce(Response.json({job:{id:'job',status:'failed',error:'No grounded answer'}}));
    vi.stubGlobal('fetch',fetch);
    await expect(lookUpVintageWindow(subject)).rejects.toThrow('No grounded answer');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('returns cache hits immediately without polling',async()=>{
    const fetch=vi.fn().mockResolvedValueOnce(Response.json({window:{note:'cached'},cached:true}));vi.stubGlobal('fetch',fetch);
    expect(await lookUpVintageWindow(subject)).toMatchObject({window:{note:'cached'},cached:true});
    expect(fetch).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(0);
  });
  it('stops polling when the session expires',async()=>{
    const fetch=vi.fn().mockResolvedValueOnce(queued()).mockResolvedValueOnce(Response.json({error:'Unauthorized'},{status:401}));vi.stubGlobal('fetch',fetch);
    await expect(lookUpVintageWindow(subject)).rejects.toThrow('Session expired');
    expect(clearSession).toHaveBeenCalledOnce();expect(fetch).toHaveBeenCalledTimes(2);
  });
});
