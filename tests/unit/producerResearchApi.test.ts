// @vitest-environment jsdom
import { afterEach,describe,expect,it,vi } from 'vitest';
import { researchProducer } from '../../src/features/producers/api';

afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks()});

const existingRun=()=>new Response(JSON.stringify({accepted:true,researchRequestId:'existing-run',existing:true}),{status:202,headers:{'content-type':'application/json'}});
const requestId='00000000-0000-4000-8000-000000000001';

describe('producer research API refresh intent',()=>{
  it('surfaces when a forced profile refresh collides with an existing run',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>existingRun()));
    await expect(researchProducer('p1',requestId,true)).rejects.toThrow('requested refresh was not queued');
  });

  it('does not describe an existing broader job as the requested range-only refresh',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>existingRun()));
    await expect(researchProducer('p1',requestId,false,true)).rejects.toThrow('requested refresh was not queued');
  });

  it('still lets an ordinary refresh attach to the existing run',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>existingRun()));
    await expect(researchProducer('p1',requestId,false)).resolves.toMatchObject({existing:true,researchRequestId:'existing-run'});
  });
});
